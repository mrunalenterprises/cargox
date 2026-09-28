-- Additive staging foundation. No live services, payments or partner activation.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Staff roles are database-owned, never copied from editable user metadata.
create table private.staff_memberships (
 user_id uuid primary key references auth.users(id),
 role text not null check(role in ('super_admin','gm','accounts','field_officer')),
 active boolean not null default false
);
create table private.fo_teams (
 field_officer_id uuid primary key references private.staff_memberships(user_id),
 gm_id uuid not null references private.staff_memberships(user_id),
 check(field_officer_id <> gm_id)
);
alter table private.staff_memberships enable row level security;
alter table private.fo_teams enable row level security;
revoke all on private.staff_memberships, private.fo_teams from public, anon, authenticated;

create function private.verified_actor() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(auth.jwt()->>'role' = 'authenticated',false)
   and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false
   and exists(select 1 from auth.users u where u.id=auth.uid()
     and u.phone_confirmed_at is not null and (u.banned_until is null or u.banned_until < now()))
$$;
create function private.has_role(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.verified_actor() and coalesce(auth.jwt()->>'aal'='aal2',false)
   and exists(select 1 from private.staff_memberships s
     where s.user_id=auth.uid() and s.role=wanted and s.active)
$$;
create function private.require_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.verified_actor() then raise exception 'Verified phone identity required' using errcode='42501'; end if;
 return auth.uid();
end $$;

create table public.customer_onboarding (
 user_id uuid primary key references public.profiles(user_id) on delete cascade,
 locale text not null check(locale in ('en','hi','mr')),
 consent_version text not null check(consent_version='2026-09-foundation'),
 consented_at timestamptz not null default now()
);
create table public.partner_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(user_id),
 city_id uuid not null references public.cities(id),
 account_kind text not null check(account_kind in ('driver','owner','fleet','agency')),
 status text not null default 'draft' check(status in ('draft','submitted','staff_reviewed','approved','rejected')),
 revision integer not null default 1 check(revision>0),
 assigned_fo uuid references private.staff_memberships(user_id),
 staff_reviewer uuid references private.staff_memberships(user_id),
 admin_reviewer uuid references private.staff_memberships(user_id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.onboarding_documents (
 application_id uuid not null references public.partner_applications(id),
 kind text not null check(kind in ('identity','police','permit','insurance')),
 object_path text not null check(length(object_path) between 40 and 160),
 primary key(application_id,kind)
);
-- A future trusted verifier writes this table. Applicants/staff RPCs cannot.
create table private.partner_verifications (
 application_id uuid primary key references public.partner_applications(id),
 revision integer not null,
 identity_verified boolean not null default false,
 police_verified boolean not null default false,
 permit_verified boolean not null default false,
 insurance_verified boolean not null default false,
 expires_at timestamptz not null
);
alter table private.partner_verifications enable row level security;
revoke all on private.partner_verifications from public, anon, authenticated;

create function private.can_review(app_id uuid, include_gm boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.has_role('super_admin') or exists (
  select 1 from public.partner_applications a where a.id=app_id and
   ((private.has_role('field_officer') and a.assigned_fo=auth.uid()) or
    (include_gm and private.has_role('gm') and exists(
      select 1 from private.fo_teams t where t.gm_id=auth.uid() and t.field_officer_id=a.assigned_fo)))
 )
$$;
create function private.verification_ready(app_id uuid, expected_revision integer) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.partner_verifications v
  where v.application_id=app_id and v.revision=expected_revision and v.identity_verified
    and v.police_verified and v.permit_verified and v.insurance_verified and v.expires_at>now())
$$;

alter table public.customer_onboarding enable row level security;
alter table public.partner_applications enable row level security;
alter table public.onboarding_documents enable row level security;
create policy customer_onboarding_own on public.customer_onboarding for select to authenticated
 using (private.verified_actor() and user_id=auth.uid());
create policy application_scoped on public.partner_applications for select to authenticated
 using (private.verified_actor() and (user_id=auth.uid() or private.can_review(id,true)));
create policy document_scoped on public.onboarding_documents for select to authenticated
 using (private.verified_actor() and (private.can_review(application_id,false) or exists(
   select 1 from public.partner_applications a where a.id=application_id and a.user_id=auth.uid())));
create policy admin_audit_read on public.audit_events for select to authenticated using(private.has_role('super_admin'));
drop policy "customer initial profile" on public.profiles;

-- Close implicit Supabase table grants. All writes below are narrow RPCs.
revoke all on public.cities,public.city_services,public.profiles,public.partners,public.rides,
 public.monthly_packs,public.ride_occurrences,public.trip_start_secrets,public.payment_events,
 public.ledger_entries,public.incidents,public.audit_events,public.customer_onboarding,
 public.partner_applications,public.onboarding_documents from anon, authenticated;
grant select on public.cities,public.city_services,public.profiles,public.partners,public.rides,
 public.monthly_packs,public.ride_occurrences,public.incidents,public.customer_onboarding,
 public.partner_applications,public.onboarding_documents,public.audit_events to authenticated;

create function private.append_audit(event text, entity uuid) returns void
language sql security definer set search_path = '' as $$
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id)
 values(auth.uid(),event,'onboarding',entity)
$$;
create function private.reject_audit_change() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Audit events are append-only' using errcode='42501'; end $$;
create trigger audit_append_only before update or delete on public.audit_events
 for each row execute function private.reject_audit_change();

create function public.complete_customer_onboarding(display_name text, locale text, consent_version text)
returns public.customer_onboarding language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_actor(); result public.customer_onboarding;
begin
 if length(trim(display_name)) not between 2 and 80 or display_name is null then
  raise exception 'Display name must be 2–80 characters' using errcode='22023'; end if;
 if locale not in ('en','hi','mr') or locale is null or consent_version is distinct from '2026-09-foundation' then
  raise exception 'Locale and explicit current consent required' using errcode='22023'; end if;
 insert into public.profiles(user_id,display_name,role) values(actor,trim(display_name),'customer')
 on conflict(user_id) do update set display_name=excluded.display_name;
 insert into public.customer_onboarding(user_id,locale,consent_version) values(actor,locale,consent_version)
 on conflict(user_id) do update set locale=excluded.locale,consent_version=excluded.consent_version
 returning * into result;
 perform private.append_audit('customer_onboarding_saved',actor);
 return result;
end $$;

create function public.save_partner_application(city_id uuid, account_kind text)
returns public.partner_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_actor(); result public.partner_applications;
begin
 if not exists(select 1 from public.customer_onboarding c where c.user_id=actor) then
  raise exception 'Complete identity and consent first' using errcode='42501'; end if;
 if account_kind is null or account_kind not in ('driver','owner','fleet','agency') then
  raise exception 'Invalid partner type' using errcode='22023'; end if;
 -- Upsert locks the existing row; submitted/approved applications are immutable.
 insert into public.partner_applications(user_id,city_id,account_kind) values(actor,city_id,account_kind)
 on conflict(user_id) do update set city_id=excluded.city_id,account_kind=excluded.account_kind,
   revision=partner_applications.revision+1,updated_at=now()
 where partner_applications.status='draft' returning * into result;
 if result.id is null then raise exception 'Application is locked for review' using errcode='55000'; end if;
 perform private.append_audit('partner_draft_saved',result.id);
 return result;
end $$;

create function public.attach_onboarding_document(application_id uuid, kind text, object_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_actor(); application public.partner_applications;
begin
 select * into application from public.partner_applications a where a.id=application_id for update;
 if application.user_id is distinct from actor then raise exception 'Not permitted' using errcode='42501'; end if;
 if application.status <> 'draft' then raise exception 'Application is locked' using errcode='55000'; end if;
 if object_path is null or object_path !~ ('^' || actor::text || '/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then
  raise exception 'Document reference must be in your private namespace' using errcode='22023'; end if;
 insert into public.onboarding_documents values(application_id,kind,object_path)
 on conflict on constraint onboarding_documents_pkey do update set object_path=excluded.object_path;
 update public.partner_applications a set revision=a.revision+1,updated_at=now() where a.id=application_id;
 perform private.append_audit('document_reference_saved',application_id);
end $$;

create function public.submit_partner_application(application_id uuid)
returns public.partner_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_actor(); application public.partner_applications;
begin
 select * into application from public.partner_applications a where a.id=application_id for update;
 if application.user_id is distinct from actor then raise exception 'Not permitted' using errcode='42501'; end if;
 if application.status <> 'draft' then raise exception 'Application is locked' using errcode='55000'; end if;
 if (select count(*) from public.onboarding_documents d where d.application_id=application.id)<>4 then
  raise exception 'Four document references required; verification remains pending' using errcode='22023'; end if;
 update public.partner_applications a set status='submitted',updated_at=now() where a.id=application.id returning * into application;
 perform private.append_audit('partner_submitted',application.id);
 return application;
end $$;

create function public.assign_application_officer(application_id uuid, field_officer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare application public.partner_applications;
begin
 if not private.has_role('super_admin') then raise exception 'Admin with MFA required' using errcode='42501'; end if;
 if not exists(select 1 from private.staff_memberships s where s.user_id=field_officer_id and s.role='field_officer' and s.active) then
  raise exception 'Active Field Officer required' using errcode='22023'; end if;
 select * into application from public.partner_applications a where a.id=application_id for update;
 if application.id is null or application.status not in ('submitted','staff_reviewed') then
  raise exception 'Application is not assignable' using errcode='55000'; end if;
 if field_officer_id=application.user_id then raise exception 'Self review is forbidden' using errcode='42501'; end if;
 update public.partner_applications a set assigned_fo=field_officer_id,staff_reviewer=null,
   status='submitted',updated_at=now() where a.id=application_id;
 perform private.append_audit('officer_assigned',application_id);
end $$;

create function public.review_partner_application(application_id uuid, decision text)
returns public.partner_applications language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_actor(); application public.partner_applications;
begin
 select * into application from public.partner_applications a where a.id=application_id for update;
 if application.id is null or actor=application.user_id then raise exception 'Not permitted' using errcode='42501'; end if;
 if decision='staff_review' then
  if not private.has_role('field_officer') or application.assigned_fo is distinct from actor then
   raise exception 'Assigned Field Officer with MFA required' using errcode='42501'; end if;
  if application.status<>'submitted' then raise exception 'Staff review order invalid' using errcode='55000'; end if;
  if not private.verification_ready(application.id,application.revision) then
   raise exception 'Current trusted verification required' using errcode='42501'; end if;
  update public.partner_applications a set status='staff_reviewed',staff_reviewer=actor,updated_at=now()
   where a.id=application_id returning * into application;
 elsif decision='approve' then
  if not private.has_role('super_admin') or actor=application.staff_reviewer then
   raise exception 'Independent Admin with MFA required' using errcode='42501'; end if;
  if application.status<>'staff_reviewed' or application.staff_reviewer is null then
   raise exception 'Staff review required before Admin approval' using errcode='55000'; end if;
  if not exists(select 1 from private.staff_memberships s where s.user_id=application.staff_reviewer
    and s.role='field_officer' and s.active) then
   raise exception 'Staff reviewer is no longer authorized' using errcode='42501'; end if;
  if not private.verification_ready(application.id,application.revision) then
   raise exception 'Current trusted verification required' using errcode='42501'; end if;
  update public.partner_applications a set status='approved',admin_reviewer=actor,updated_at=now()
   where a.id=application_id returning * into application;
 elsif decision='reject' then
  if not private.can_review(application.id,false) then raise exception 'Not permitted' using errcode='42501'; end if;
  if application.status not in ('submitted','staff_reviewed') then raise exception 'Review order invalid' using errcode='55000'; end if;
  update public.partner_applications a set status='rejected',updated_at=now() where a.id=application_id returning * into application;
 else raise exception 'Invalid review decision' using errcode='22023'; end if;
 perform private.append_audit('partner_' || decision,application_id);
 -- Approval is an onboarding state only. No partners.online or service gate is changed.
 return application;
end $$;

-- Definer functions default to EXECUTE for PUBLIC: remove that default explicitly.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.verified_actor(),private.has_role(text),private.can_review(uuid,boolean) to authenticated;
revoke all on function public.complete_customer_onboarding(text,text,text),public.save_partner_application(uuid,text),
 public.attach_onboarding_document(uuid,text,text),public.submit_partner_application(uuid),
 public.assign_application_officer(uuid,uuid),public.review_partner_application(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_customer_onboarding(text,text,text),public.save_partner_application(uuid,text),
 public.attach_onboarding_document(uuid,text,text),public.submit_partner_application(uuid),
 public.assign_application_officer(uuid,uuid),public.review_partner_application(uuid,text) to authenticated;
commit;
