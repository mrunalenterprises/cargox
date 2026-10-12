-- Secure partner-side RPCs for live dispatch without exposing privileged table writes.
-- All functions scope access to auth.uid(), pin search_path, and are executable only by authenticated/service roles.

create or replace function public.set_partner_availability(
  p_online boolean,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_heading numeric default null
)
returns public.partner_availability
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.partner_availability;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  insert into public.partner_availability (
    partner_id, online_status, latitude, longitude, heading, last_seen_at, updated_at
  ) values (
    v_uid,
    case when p_online then 'ONLINE' else 'OFFLINE' end,
    p_latitude,
    p_longitude,
    p_heading,
    now(),
    now()
  )
  on conflict (partner_id) do update set
    online_status = case when p_online then 'ONLINE' else 'OFFLINE' end,
    latitude = coalesce(excluded.latitude, public.partner_availability.latitude),
    longitude = coalesce(excluded.longitude, public.partner_availability.longitude),
    heading = coalesce(excluded.heading, public.partner_availability.heading),
    last_seen_at = now(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.get_my_dispatch_offers()
returns table (
  offer_id uuid,
  booking_id uuid,
  wave integer,
  score numeric,
  offered_at timestamptz,
  expires_at timestamptz,
  vehicle_id uuid,
  service_code text,
  city_code text,
  booking_mode text,
  scheduled_at timestamptz,
  goods_description text,
  pickup_address text,
  drop_address text,
  vehicle_class text,
  locked_fare numeric,
  customer_payment_mode text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.booking_id,
    o.wave,
    o.score,
    o.offered_at,
    o.expires_at,
    o.vehicle_id,
    b.service_code,
    b.city_code,
    b.booking_mode,
    b.scheduled_at,
    b.goods_description,
    b.pickup_address,
    b.drop_address,
    b.vehicle_class,
    b.locked_fare,
    b.customer_payment_mode
  from public.booking_dispatch_offers o
  join public.bookings b on b.id = o.booking_id
  where o.partner_id = v_uid
    and o.status = 'OFFERED'
    and o.expires_at > now()
    and b.status = 'SEARCHING'
    and b.partner_id is null
  order by o.offered_at desc
  limit 50;
end
$$;

create or replace function public.respond_to_dispatch_offer(
  p_offer_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_response text := upper(trim(coalesce(p_response, '')));
  v_offer public.booking_dispatch_offers;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if v_response not in ('ACCEPTED','DECLINED') then
    raise exception 'invalid_response' using errcode = '22023';
  end if;

  select * into v_offer
  from public.booking_dispatch_offers
  where id = p_offer_id
  for update;

  if not found or v_offer.partner_id <> v_uid then
    raise exception 'offer_not_found' using errcode = 'P0002';
  end if;

  if v_offer.status <> 'OFFERED' then
    return jsonb_build_object(
      'status',v_offer.status,
      'offer_id',v_offer.id,
      'booking_id',v_offer.booking_id
    );
  end if;

  if v_offer.expires_at <= now() then
    update public.booking_dispatch_offers
       set status = 'EXPIRED', responded_at = now()
     where id = v_offer.id;
    return jsonb_build_object(
      'status','EXPIRED',
      'offer_id',v_offer.id,
      'booking_id',v_offer.booking_id
    );
  end if;

  if v_response = 'DECLINED' then
    update public.booking_dispatch_offers
       set status = 'DECLINED', responded_at = now()
     where id = v_offer.id;

    return jsonb_build_object(
      'status','DECLINED',
      'offer_id',v_offer.id,
      'booking_id',v_offer.booking_id
    );
  end if;

  select * into v_booking
  from public.bookings
  where id = v_offer.booking_id
  for update;

  if not found or v_booking.status <> 'SEARCHING' or v_booking.partner_id is not null then
    update public.booking_dispatch_offers
       set status = 'CANCELLED', responded_at = now()
     where id = v_offer.id;
    return jsonb_build_object(
      'status','BOOKING_UNAVAILABLE',
      'offer_id',v_offer.id,
      'booking_id',v_offer.booking_id
    );
  end if;

  update public.bookings
     set partner_id = v_uid,
         vehicle_id = coalesce(v_offer.vehicle_id, vehicle_id),
         status = 'ASSIGNED',
         updated_at = now()
   where id = v_offer.booking_id;

  update public.booking_dispatch_offers
     set status = 'ACCEPTED', responded_at = now()
   where id = v_offer.id;

  update public.booking_dispatch_offers
     set status = 'CANCELLED', responded_at = now()
   where booking_id = v_offer.booking_id
     and id <> v_offer.id
     and status = 'OFFERED';

  insert into public.partner_availability (
    partner_id, online_status, last_seen_at, updated_at
  ) values (
    v_uid, 'BUSY', now(), now()
  )
  on conflict (partner_id) do update set
    online_status = 'BUSY',
    last_seen_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'status','ACCEPTED',
    'offer_id',v_offer.id,
    'booking_id',v_offer.booking_id,
    'partner_id',v_uid,
    'vehicle_id',v_offer.vehicle_id
  );
end
$$;

revoke all on function public.set_partner_availability(boolean,numeric,numeric,numeric) from public, anon;
revoke all on function public.get_my_dispatch_offers() from public, anon;
revoke all on function public.respond_to_dispatch_offer(uuid,text) from public, anon;

grant execute on function public.set_partner_availability(boolean,numeric,numeric,numeric) to authenticated, service_role;
grant execute on function public.get_my_dispatch_offers() to authenticated, service_role;
grant execute on function public.respond_to_dispatch_offer(uuid,text) to authenticated, service_role;
