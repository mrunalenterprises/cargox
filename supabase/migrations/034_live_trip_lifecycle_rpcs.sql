-- Auth-scoped live lifecycle RPCs used by Customer and Partner browser clients.
-- They replace unsafe direct writes while keeping table RLS read-only for participants.

create or replace function public.add_partner_booking_proof(
  p_booking_id uuid,
  p_proof_type text,
  p_note text default null,
  p_storage_path text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.booking_proofs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_proof public.booking_proofs;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or v_booking.partner_id is distinct from v_uid then
    raise exception 'booking_not_assigned_to_partner' using errcode = '42501';
  end if;

  if v_booking.status not in ('ASSIGNED','PARTNER_ARRIVING','AT_PICKUP','IN_PROGRESS') then
    raise exception 'proof_not_allowed_for_status' using errcode = '22023';
  end if;

  insert into public.booking_proofs (
    booking_id, proof_type, storage_path, note, latitude, longitude, captured_by
  ) values (
    p_booking_id,
    upper(trim(p_proof_type)),
    nullif(trim(coalesce(p_storage_path,'')),''),
    nullif(trim(coalesce(p_note,'')),''),
    p_latitude,
    p_longitude,
    v_uid
  )
  returning * into v_proof;

  return v_proof;
end
$$;

create or replace function public.advance_partner_booking(
  p_booking_id uuid,
  p_to_status text,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_to text := upper(trim(coalesce(p_to_status,'')));
  v_booking public.bookings;
  v_required_from text;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or v_booking.partner_id is distinct from v_uid then
    raise exception 'booking_not_assigned_to_partner' using errcode = '42501';
  end if;

  v_required_from := case v_to
    when 'PARTNER_ARRIVING' then 'ASSIGNED'
    when 'AT_PICKUP' then 'PARTNER_ARRIVING'
    when 'IN_PROGRESS' then 'AT_PICKUP'
    when 'COMPLETED' then 'IN_PROGRESS'
    else null
  end;

  if v_required_from is null then
    raise exception 'invalid_target_status' using errcode = '22023';
  end if;

  if v_booking.status <> v_required_from then
    raise exception 'invalid_status_transition:%->%', v_booking.status, v_to using errcode = '22023';
  end if;

  if v_to = 'IN_PROGRESS' and not exists (
    select 1 from public.booking_proofs p
    where p.booking_id = p_booking_id
      and p.proof_type in ('PICKUP_PHOTO','PICKUP_VIDEO','HANDOVER_PHOTO')
  ) then
    raise exception 'pickup_proof_required' using errcode = '22023';
  end if;

  if v_to = 'COMPLETED' and not exists (
    select 1 from public.booking_proofs p
    where p.booking_id = p_booking_id
      and p.proof_type in ('DELIVERY_PHOTO','DELIVERY_VIDEO','RECEIVER_SIGNATURE')
  ) then
    raise exception 'delivery_proof_required' using errcode = '22023';
  end if;

  update public.bookings
     set status = v_to,
         updated_at = now(),
         completed_at = case when v_to = 'COMPLETED' then now() else completed_at end
   where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, actor_id, actor_role, latitude, longitude, metadata
  ) values (
    p_booking_id,
    v_required_from,
    v_to,
    v_uid,
    'PARTNER',
    p_latitude,
    p_longitude,
    jsonb_build_object('source','PARTNER_RPC')
  );

  if v_to = 'COMPLETED' then
    update public.partner_availability
       set online_status = case when online_status = 'BLOCKED' then 'BLOCKED' else 'ONLINE' end,
           last_seen_at = now(),
           updated_at = now()
     where partner_id = v_uid;
  end if;

  return v_booking;
end
$$;

create or replace function public.cancel_customer_booking(
  p_booking_id uuid,
  p_reason text default 'Customer cancelled'
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_partner uuid;
  v_from_status text;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or v_booking.customer_id is distinct from v_uid then
    raise exception 'booking_not_owned_by_customer' using errcode = '42501';
  end if;

  if v_booking.status in ('IN_PROGRESS','COMPLETED','CANCELLED','FAILED') then
    raise exception 'customer_cancel_requires_support' using errcode = '22023';
  end if;

  v_partner := v_booking.partner_id;
  v_from_status := v_booking.status;

  update public.bookings
     set status = 'CANCELLED',
         cancelled_at = now(),
         updated_at = now()
   where id = p_booking_id
  returning * into v_booking;

  update public.booking_dispatch_offers
     set status = 'CANCELLED', responded_at = coalesce(responded_at, now())
   where booking_id = p_booking_id
     and status = 'OFFERED';

  insert into public.booking_status_events (
    booking_id, from_status, to_status, actor_id, actor_role, metadata
  ) values (
    p_booking_id,
    v_from_status,
    'CANCELLED',
    v_uid,
    'CUSTOMER',
    jsonb_build_object('reason',coalesce(p_reason,'Customer cancelled'),'source','CUSTOMER_RPC')
  );

  if v_partner is not null then
    update public.partner_availability
       set online_status = case when online_status = 'BLOCKED' then 'BLOCKED' else 'ONLINE' end,
           last_seen_at = now(),
           updated_at = now()
     where partner_id = v_partner;
  end if;

  return v_booking;
end
$$;

revoke all on function public.add_partner_booking_proof(uuid,text,text,text,numeric,numeric) from public, anon;
revoke all on function public.advance_partner_booking(uuid,text,numeric,numeric) from public, anon;
revoke all on function public.cancel_customer_booking(uuid,text) from public, anon;

grant execute on function public.add_partner_booking_proof(uuid,text,text,text,numeric,numeric) to authenticated, service_role;
grant execute on function public.advance_partner_booking(uuid,text,numeric,numeric) to authenticated, service_role;
grant execute on function public.cancel_customer_booking(uuid,text) to authenticated, service_role;
