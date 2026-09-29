// TEST HARNESS ONLY. Auth schema below is a minimal Supabase contract fixture.
// PGlite runs PostgreSQL SQL/RLS; it does not emulate GoTrue, Storage or PostgREST.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdir, readFile } from 'node:fs/promises';
export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const claims = (n, extra={}) => ({sub:id(n),role:'authenticated',is_anonymous:false,aal:'aal1',...extra});
export async function database() {
  const db=await PGlite.create({extensions:{pgcrypto}});
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, phone_confirmed_at timestamptz, banned_until timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
  `);
  const directory=new URL('../../../supabase/migrations/',import.meta.url);
  const files=(await readdir(directory)).filter(n=>n.endsWith('.sql')).sort();
  for(const file of files) await db.exec(await readFile(new URL(file,directory),'utf8'));
  await db.query('insert into public.cities(id,name,timezone) values($1,$2,$3)',[id(100),'Isolated policy fixture','Asia/Kolkata']);
  for(let n=1;n<=14;n++) {
    await db.query('insert into auth.users values($1,$2,$3)',[id(n),n===11?null:new Date().toISOString(),n===13?'2099-01-01':null]);
    await db.query('insert into public.profiles(user_id,display_name) values($1,$2)',[id(n),`Fixture ${n}`]);
  }
  for(const [n,role] of [[5,'field_officer'],[6,'field_officer'],[7,'gm'],[8,'gm'],[9,'super_admin'],[10,'accounts'],[14,'field_officer']])
    await db.query('insert into private.staff_memberships values($1,$2,$3)',[id(n),role,n!==14]);
  await db.query('insert into private.fo_teams values($1,$2),($3,$4)',[id(5),id(7),id(6),id(8)]);
  const as = (identity, work, role='authenticated')=>db.transaction(async tx=>{
    await tx.exec(`set local role ${role==='anon'?'anon':'authenticated'}`);
    await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(identity)]);
    return work(tx);
  });
  const functions={complete_customer_onboarding:['display_name','locale','consent_version'],save_partner_application:['city_id','account_kind'],
    attach_onboarding_document:['application_id','kind','object_path'],submit_partner_application:['application_id'],
    assign_application_officer:['application_id','field_officer_id'],review_partner_application:['application_id','decision']};
  const rpc=(identity,name,params)=>as(identity,async tx=>{
    if(!Object.hasOwn(functions,name)) throw new Error('Test RPC allowlist');
    const keys=functions[name];
    return (await tx.query(`select to_jsonb(public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')})) as result`,keys.map(k=>params[k]))).rows[0].result;
  });
  const consent=n=>rpc(claims(n),'complete_customer_onboarding',{display_name:`Fixture ${n}`,locale:'en',consent_version:'2026-09-foundation'});
  const draft=async n=>{await consent(n);return rpc(claims(n),'save_partner_application',{city_id:id(100),account_kind:'driver'});};
  const submit=async(n,application)=>{
    for(const kind of ['identity','police','permit','insurance']) await rpc(claims(n),'attach_onboarding_document',{
      application_id:application.id,kind,object_path:`${id(n)}/${id(200)}`});
    return rpc(claims(n),'submit_partner_application',{application_id:application.id});
  };
  return {db,as,rpc,consent,draft,submit,files};
}
