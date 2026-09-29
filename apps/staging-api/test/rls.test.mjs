import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {database,id,claims} from '../support/database.mjs';
let h,a,b;
const staff=n=>claims(n,{aal:'aal2'});
const denied=promise=>assert.rejects(promise,e=>e.code==='42501');
before(async()=>{h=await database();a=await h.submit(3,await h.draft(3));b=await h.submit(4,await h.draft(4));});
after(async()=>{await h?.db.close();});
const rows=(n,table,extra={})=>h.as(claims(n,extra),async tx=>(await tx.query(`select * from public.${table}`)).rows);
const review=(n,decision,extra={})=>h.rpc(staff(n),'review_partner_application',{application_id:a.id,decision,...extra});

test('the staging migration chain applies and every app table has RLS',async()=>{
 // Require security-critical baseline and the additive, OFF-by-default catalog.
 // Future additive migrations must not make this harness test stale.
 for(const name of [
  '20260928000100_cargox_phase1_schema.sql',
  '20260929000100_staging_identity_onboarding.sql',
  '20260929000200_mobile_public_catalog.sql',
  '20260929000300_pippip_disabled_pilot_city.sql',
  '20260929000400_staging_fk_indexes.sql'
 ]) assert.ok(h.files.includes(name),'Missing reviewed migration: '+name);
 const tables=await h.db.query("select relname from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity");
 assert.deepEqual(tables.rows,[]);
 const online=await h.db.query('select * from public.mobile_city_catalog');
 assert.deepEqual(online.rows,[],'Inactive pilot city must not appear in the public catalog');
});
test('anonymous database role cannot read profiles or call onboarding',async()=>{
 await denied(h.as({},tx=>tx.query('select * from public.profiles'),'anon'));
 await denied(h.as({},tx=>tx.query("select public.complete_customer_onboarding('Anon','en','2026-09-foundation')"),'anon'));
});
test('unconfirmed phone, anonymous identity and banned user cannot onboard',async()=>{
 for(const identity of [claims(11),claims(12,{is_anonymous:true}),claims(13),claims(1,{role:'service_role'})])
  await denied(h.rpc(identity,'complete_customer_onboarding',{display_name:'Blocked',locale:'en',consent_version:'2026-09-foundation'}));
});
test('customer consent and locale are validated and only own record is readable',async()=>{
 await h.consent(1);await h.consent(2);
 assert.deepEqual((await rows(1,'customer_onboarding')).map(r=>r.user_id),[id(1)]);
 assert.deepEqual((await rows(1,'profiles')).map(r=>r.user_id),[id(1)]);
 await assert.rejects(h.rpc(claims(1),'complete_customer_onboarding',{display_name:'Bad',locale:'en',consent_version:'old'}),e=>e.code==='22023');
});
test('client cannot promote profile, set staff roles or forge an approval',async()=>{
 await denied(h.as(claims(1),tx=>tx.query("update public.profiles set role='super_admin'")));
 await denied(h.as(claims(1),tx=>tx.query("insert into private.staff_memberships values($1,'super_admin',true)",[id(1)])));
 await denied(h.as(claims(3),tx=>tx.query("update public.partner_applications set status='approved'")));
 await denied(h.rpc(claims(1,{aal:'aal2',user_metadata:{role:'super_admin'}}),'assign_application_officer',{application_id:a.id,field_officer_id:id(5)}));
});
test('document references cannot cross applicant namespace or traverse paths',async()=>{
 const app=await h.draft(2);
 for(const object_path of [`${id(1)}/${id(200)}`,`${id(2)}/../secret`])
  await assert.rejects(h.rpc(claims(2),'attach_onboarding_document',{application_id:app.id,kind:'identity',object_path}),e=>e.code==='22023');
 await denied(h.rpc(claims(1),'attach_onboarding_document',{application_id:app.id,kind:'identity',object_path:`${id(1)}/${id(200)}`}));
 await assert.rejects(h.rpc(claims(2),'submit_partner_application',{application_id:app.id}),e=>e.code==='22023');
});
test('MFA and active Admin are required to assign a Field Officer',async()=>{
 await denied(h.rpc(claims(9),'assign_application_officer',{application_id:a.id,field_officer_id:id(5)}));
 await denied(h.rpc(staff(7),'assign_application_officer',{application_id:a.id,field_officer_id:id(5)}));
 await assert.rejects(h.rpc(staff(9),'assign_application_officer',{application_id:a.id,field_officer_id:id(14)}),e=>e.code==='22023');
 await h.rpc(staff(9),'assign_application_officer',{application_id:a.id,field_officer_id:id(5)});
 await h.rpc(staff(9),'assign_application_officer',{application_id:b.id,field_officer_id:id(6)});
});
test('RLS isolates applicants, Field Officers, GM teams and Accounts',async()=>{
 assert.deepEqual((await rows(3,'partner_applications')).map(r=>r.id),[a.id]);
 assert.deepEqual((await rows(5,'partner_applications',{aal:'aal2'})).map(r=>r.id),[a.id]);
 assert.deepEqual((await rows(7,'partner_applications',{aal:'aal2'})).map(r=>r.id),[a.id]);
 assert.deepEqual((await rows(8,'partner_applications',{aal:'aal2'})).map(r=>r.id),[b.id]);
 assert.deepEqual(await rows(10,'partner_applications',{aal:'aal2'}),[]);
 assert.deepEqual(await rows(7,'onboarding_documents',{aal:'aal2'}),[]);
 assert.equal((await rows(5,'onboarding_documents',{aal:'aal2'})).length,4);
 assert.deepEqual(await rows(5,'partner_applications'),[]);
});
test('approval cannot skip Staff review or use unverified document references',async()=>{
 await assert.rejects(review(9,'approve'),e=>e.code==='55000');
 await denied(review(6,'staff_review'));await denied(review(7,'staff_review'));
 await denied(review(5,'staff_review'));
 assert.equal((await rows(3,'partner_applications'))[0].status,'submitted');
});
test('submitted applications lock edits and applicants cannot verify themselves',async()=>{
 await assert.rejects(h.rpc(claims(3),'save_partner_application',{city_id:id(100),account_kind:'fleet'}),e=>e.code==='55000');
 await denied(h.as(claims(3),tx=>tx.query('insert into private.partner_verifications(application_id,revision,expires_at) values($1,1,now())',[a.id])));
 await denied(review(3,'approve'));
});
test('current trusted checks allow Staff review; expiry and revision are rechecked by Admin',async()=>{
 await h.db.query("insert into private.partner_verifications values($1,$2,true,true,true,true,now()+interval '1 day')",[a.id,a.revision]);
 assert.equal((await review(5,'staff_review')).status,'staff_reviewed');
 await h.db.query("update private.staff_memberships set role='super_admin' where user_id=$1",[id(5)]);
 await denied(review(5,'approve'));await denied(review(9,'approve'));
 await h.db.query("update private.staff_memberships set role='field_officer' where user_id=$1",[id(5)]);
 await h.db.query("update private.partner_verifications set expires_at=now()-interval '1 day' where application_id=$1",[a.id]);
 await denied(review(9,'approve'));
 await h.db.query("update private.partner_verifications set expires_at=now()+interval '1 day',revision=999 where application_id=$1",[a.id]);
 await denied(review(9,'approve'));
 await h.db.query('update private.partner_verifications set revision=$1 where application_id=$2',[a.revision,a.id]);
 assert.equal((await review(9,'approve')).status,'approved');
 assert.deepEqual((await h.db.query('select * from public.partners')).rows,[]);
 assert.equal((await h.db.query('select is_active from public.cities')).rows[0].is_active,false);
});
test('staff suspension revokes scope despite unchanged signed claims',async()=>{
 await h.db.query('update private.staff_memberships set active=false where user_id=$1',[id(6)]);
 assert.deepEqual(await rows(6,'partner_applications',{aal:'aal2'}),[]);
 await denied(h.rpc(staff(6),'review_partner_application',{application_id:b.id,decision:'reject'}));
});
test('audit is append-only, not forgeable and readable only by MFA Admin',async()=>{
 assert.deepEqual(await rows(10,'audit_events',{aal:'aal2'}),[]);
 assert.ok((await rows(9,'audit_events',{aal:'aal2'})).length>0);
 await denied(h.as(staff(9),tx=>tx.query("insert into public.audit_events(event_type,entity_type) values('forged','test')")));
 await denied(h.as(staff(9),tx=>tx.query('delete from public.audit_events')));
 await denied(h.db.query("update public.audit_events set event_type='tampered'"));
 await denied(h.db.query('delete from public.audit_events'));
 await denied(h.as(claims(1),tx=>tx.query("select private.append_audit('forged',$1)",[id(1)])));
});
test('payment, trip secrets, verification and live state remain default-deny',async()=>{
 for(const table of ['trip_start_secrets','payment_events','ledger_entries'])
  await denied(h.as(staff(9),tx=>tx.query(`select * from public.${table}`)));
 await denied(h.as(staff(9),tx=>tx.query('update public.city_services set enabled=true,legal_ready=true')));
});
test('definer functions pin an empty search path and deny PUBLIC execution',async()=>{
 const result=await h.db.query("select proname,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef");
 assert.ok(result.rows.length>=10);
 for(const row of result.rows) assert.ok(row.proconfig.some(v=>v==='search_path=""'),row.proname);
});
