-- Production-facing operations wiring: automatic initial dispatch, live GPS, notifications,
-- and idempotent partner settlement on completed bookings.

-- Expand notification types for trip lifecycle and finance/proof updates.
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
check (notification_type in (
  'BOOKING_ALERT','SCHEDULED_REMINDER','DOCUMENT_EXPIRY','HIGH_DEMAND','RETURN_LOAD',
  'REPLACEMENT','SUPPORT_UPDATE','TRIP_UPDATE','PROOF_UPDATE','PAYMENT_UPDATE'
));

create or replace function public.queue_loadin_notification(
  p_user_id uuid,
  p_booking_id uuid,
  p_type text,
  p_priority text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_sound_key text default null,
  p_vibration boolean default false,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then return null; end if;

  insert into public.notifications(
    user_id, booking_id, notification_type, priority, title, body, payload,
    sound_key, vibration, status, scheduled_for, expires_at
  ) values (
    p_user_id,
    p_booking_id,
    upper(trim(p_type)),
    upper(trim(p_priority)),
    p_title,
    p_body,
    coalesce(p_payload,'{}'::jsonb),
    p_sound_key,
    coalesce(p_vibration,false),
    'QUEUED',
    now(),
    p_expires_at
  ) returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.queue_loadin_notification(uuid,uuid,text,text,text,text,jsonb,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.queue_loadin_notification(uuid,uuid,text,text,text,text,jsonb,text,boolean,timestamptz) to service_role;

-- Initial wave: a new SEARCHING booking is offered only to active/online/finance-ready partners.
create or replace function public.enqueue_initial_booking_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate record;
  v_offer_id uuid;
  v_partner_ids uuid[] := '{}'::uuid[];
  v_deadline timestamptz := now() + interval '20 seconds';
begin
  if new.status <> 'SEARCHING' then return new; end if;

  for v_candidate in
    select
      pp.user_id as partner_id,
      pv.id as vehicle_id,
      fa.plan,
      fa.commission_balance,
      row_number() over(order by pa.last_seen_at desc nulls last, pp.user_id) as rn
    from public.partner_profiles pp
    join public.partner_availability pa
      on pa.partner_id = pp.user_id
     and pa.online_status = 'ONLINE'
    join public.partner_finance_accounts fa
      on fa.partner_id = pp.user_id
    left join lateral (
      select v.id
      from public.partner_vehicles v
      where v.partner_id = pp.user_id
        and v.active
        and v.eligible_for_booking
        and (new.vehicle_class is null or upper(v.vehicle_category) = upper(new.vehicle_class))
      order by v.created_at
      limit 1
    ) pv on true
    where pp.status = 'ACTIVE'
      and pp.city_code = new.city_code
      and (new.service_code in ('HELPER','FULL_SHIFTING') or pv.id is not null)
      and (
        (
          fa.plan = 'SUBSCRIPTION'
          and fa.subscription_valid_until is not null
          and fa.subscription_valid_until >= now()
          and new.customer_payment_mode in ('CASH','UPI_DIRECT')
        )
        or
        (
          fa.plan = 'COMMISSION'
          and (
            new.customer_payment_mode in ('ONLINE','BUSINESS_CREDIT')
            or (
              new.customer_payment_mode in ('CASH','UPI_DIRECT')
              and fa.commission_balance >= round(new.locked_fare * 0.15, 2)
            )
          )
        )
      )
    limit 10
  loop
    v_offer_id := null;
    insert into public.booking_dispatch_offers(
      booking_id, partner_id, vehicle_id, wave, score, status, offered_at, expires_at
    ) values (
      new.id,
      v_candidate.partner_id,
      v_candidate.vehicle_id,
      1,
      greatest(1, 101 - v_candidate.rn),
      'OFFERED',
      now(),
      v_deadline
    )
    on conflict (booking_id, partner_id, wave) do nothing
    returning id into v_offer_id;

    if v_offer_id is not null then
      v_partner_ids := array_append(v_partner_ids, v_candidate.partner_id);
      perform public.queue_loadin_notification(
        v_candidate.partner_id,
        new.id,
        'BOOKING_ALERT',
        'HIGH',
        'New LOADIN job',
        coalesce(new.pickup_address,'Pickup') || ' → ' || coalesce(new.drop_address,'Drop'),
        jsonb_build_object(
          'offer_id',v_offer_id,
          'fare',new.locked_fare,
          'service_code',new.service_code,
          'booking_mode',new.booking_mode,
          'response_seconds',20
        ),
        'loadin_booking_alert',
        true,
        v_deadline
      );
    end if;
  end loop;

  if cardinality(v_partner_ids) > 0 then
    insert into public.notification_alert_waves(
      booking_id, wave_no, partner_ids, response_deadline, outcome
    ) values (
      new.id, 1, v_partner_ids, v_deadline, 'WAITING'
    ) on conflict (booking_id, wave_no) do nothing;
  end if;

  return new;
end
$$;

drop trigger if exists loadin_booking_initial_dispatch on public.bookings;
create trigger loadin_booking_initial_dispatch
after insert on public.bookings
for each row
when (new.status = 'SEARCHING')
execute function public.enqueue_initial_booking_dispatch();

-- Notifications for lifecycle changes and proof capture.
create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_body text;
  v_priority text := 'NORMAL';
begin
  if new.status is not distinct from old.status then return new; end if;

  v_title := case new.status
    when 'ASSIGNED' then 'Partner assigned'
    when 'PARTNER_ARRIVING' then 'Partner is on the way'
    when 'AT_PICKUP' then 'Partner reached pickup'
    when 'IN_PROGRESS' then 'Trip started'
    when 'COMPLETED' then 'Delivery completed'
    when 'CANCELLED' then 'Booking cancelled'
    when 'FAILED' then 'Booking needs attention'
    else 'Booking updated'
  end;

  v_body := coalesce(new.pickup_address,'Pickup') || ' → ' || coalesce(new.drop_address,'Drop') || ' • ' || replace(new.status,'_',' ');
  if new.status in ('FAILED','CANCELLED') then v_priority := 'HIGH'; end if;

  perform public.queue_loadin_notification(
    new.customer_id,
    new.id,
    'TRIP_UPDATE',
    v_priority,
    v_title,
    v_body,
    jsonb_build_object('status',new.status,'previous_status',old.status),
    null,
    new.status in ('FAILED','CANCELLED'),
    null
  );

  if new.partner_id is not null and new.status in ('CANCELLED','FAILED') then
    perform public.queue_loadin_notification(
      new.partner_id,
      new.id,
      'TRIP_UPDATE',
      'HIGH',
      v_title,
      v_body,
      jsonb_build_object('status',new.status,'previous_status',old.status),
      'loadin_booking_alert',
      true,
      null
    );
  end if;

  return new;
end
$$;

drop trigger if exists loadin_booking_status_notification on public.bookings;
create trigger loadin_booking_status_notification
after update of status on public.bookings
for each row
execute function public.notify_booking_status_change();

create or replace function public.notify_booking_proof_added()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer uuid;
begin
  select customer_id into v_customer from public.bookings where id = new.booking_id;
  perform public.queue_loadin_notification(
    v_customer,
    new.booking_id,
    'PROOF_UPDATE',
    'NORMAL',
    'Trip proof captured',
    replace(new.proof_type,'_',' '),
    jsonb_build_object('proof_type',new.proof_type,'proof_id',new.id),
    null,
    false,
    null
  );
  return new;
end
$$;

drop trigger if exists loadin_booking_proof_notification on public.booking_proofs;
create trigger loadin_booking_proof_notification
after insert on public.booking_proofs
for each row execute function public.notify_booking_proof_added();

-- Live GPS write path for the assigned partner, plus participant-scoped read snapshot.
create or replace function public.publish_partner_location(
  p_booking_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_m numeric default null,
  p_speed_kph numeric default null,
  p_heading numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_point_id bigint;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 then raise exception 'invalid_latitude' using errcode = '22023'; end if;
  if p_longitude is null or p_longitude < -180 or p_longitude > 180 then raise exception 'invalid_longitude' using errcode = '22023'; end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.partner_id is distinct from v_uid then
    raise exception 'booking_not_assigned_to_partner' using errcode = '42501';
  end if;
  if v_booking.status not in ('ASSIGNED','PARTNER_ARRIVING','AT_PICKUP','IN_PROGRESS') then
    raise exception 'tracking_not_allowed_for_status' using errcode = '22023';
  end if;

  insert into public.trip_location_points(
    booking_id, partner_id, latitude, longitude, accuracy_m, speed_kph, heading, captured_at
  ) values (
    p_booking_id, v_uid, p_latitude, p_longitude, p_accuracy_m, p_speed_kph, p_heading, now()
  ) returning id into v_point_id;

  insert into public.trip_tracking_sessions(booking_id, active, started_at, updated_at)
  values (p_booking_id, true, now(), now())
  on conflict (booking_id) do update set
    active = true,
    started_at = coalesce(public.trip_tracking_sessions.started_at, now()),
    ended_at = null,
    updated_at = now();

  update public.partner_availability
     set latitude = p_latitude,
         longitude = p_longitude,
         heading = coalesce(p_heading, heading),
         last_seen_at = now(),
         updated_at = now()
   where partner_id = v_uid;

  return jsonb_build_object(
    'point_id',v_point_id,
    'booking_id',p_booking_id,
    'latitude',p_latitude,
    'longitude',p_longitude,
    'captured_at',now()
  );
end
$$;

create or replace function public.get_booking_tracking_snapshot(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_session jsonb;
  v_points jsonb;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or (v_booking.customer_id is distinct from v_uid and v_booking.partner_id is distinct from v_uid) then
    raise exception 'tracking_access_denied' using errcode = '42501';
  end if;

  select to_jsonb(s) into v_session from public.trip_tracking_sessions s where s.booking_id = p_booking_id;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.captured_at desc),'[]'::jsonb)
    into v_points
  from (
    select id, booking_id, latitude, longitude, accuracy_m, speed_kph, heading, captured_at
    from public.trip_location_points
    where booking_id = p_booking_id
    order by captured_at desc
    limit 20
  ) p;

  return jsonb_build_object(
    'booking_id',p_booking_id,
    'status',v_booking.status,
    'session',v_session,
    'points',v_points
  );
end
$$;

-- Customer/partner notification inbox helper.
create or replace function public.mark_notification_opened(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.notifications;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  update public.notifications
     set status = 'OPENED', opened_at = coalesce(opened_at, now())
   where id = p_notification_id
     and user_id = v_uid
  returning * into v_row;

  if not found then raise exception 'notification_not_found' using errcode = 'P0002'; end if;
  return v_row;
end
$$;

-- Idempotent finance settlement. This trigger intentionally blocks COMPLETED for unpaid ONLINE bookings.
create or replace function public.finalize_loadin_booking_finance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.partner_finance_accounts;
  v_commissionable numeric(12,2) := round(coalesce(new.locked_fare,0),2);
  v_commission numeric(12,2) := 0;
  v_entitlement numeric(12,2) := 0;
  v_mode text;
  v_plan text;
begin
  if new.status <> 'COMPLETED' or old.status = 'COMPLETED' then return new; end if;
  if new.partner_id is null then raise exception 'completed_booking_missing_partner'; end if;

  if exists (select 1 from public.booking_partner_settlements s where s.booking_id = new.id) then
    return new;
  end if;

  select * into v_account
  from public.partner_finance_accounts
  where partner_id = new.partner_id
  for update;

  if not found then raise exception 'partner_finance_account_missing'; end if;
  v_plan := v_account.plan;

  if v_plan = 'SUBSCRIPTION' then
    if v_account.subscription_valid_until is null or v_account.subscription_valid_until < now() then
      raise exception 'subscription_not_active';
    end if;
    if new.customer_payment_mode not in ('CASH','UPI_DIRECT') then
      raise exception 'subscription_requires_direct_customer_payment';
    end if;
    v_commission := 0;
    v_entitlement := v_commissionable;
    v_mode := 'DIRECT_CUSTOMER_PAYMENT';
  else
    v_commission := round(v_commissionable * 0.15, 2);
    v_entitlement := v_commissionable - v_commission;

    if new.customer_payment_mode in ('CASH','UPI_DIRECT') then
      if v_account.commission_balance < v_commission then
        raise exception 'insufficient_commission_balance';
      end if;

      update public.partner_finance_accounts
         set commission_balance = commission_balance - v_commission,
             updated_at = now()
       where partner_id = new.partner_id;

      insert into public.partner_finance_ledger(
        partner_id, booking_id, entry_type, amount, balance_bucket, reference, metadata
      ) values (
        new.partner_id, new.id, 'COMMISSION_DEBIT', -v_commission, 'COMMISSION',
        'COMMISSION_' || new.id::text,
        jsonb_build_object('gross_fare',v_commissionable,'commission_rate_pct',15)
      );

      insert into public.partner_balance_events(partner_id,booking_id,bucket,direction,amount,reason)
      values (new.partner_id,new.id,'COMMISSION','DEBIT',v_commission,'BOOKING_COMMISSION');

      v_mode := 'COMMISSION_BALANCE_DEBIT';
    else
      if new.customer_payment_mode = 'ONLINE' and not exists (
        select 1
        from public.customer_payments p
        where p.booking_id = new.id
          and p.customer_id = new.customer_id
          and p.status = 'PAID'
          and p.amount >= v_commissionable
      ) then
        raise exception 'online_payment_not_paid';
      end if;

      update public.partner_finance_accounts
         set earnings_balance = earnings_balance + v_entitlement,
             updated_at = now()
       where partner_id = new.partner_id;

      insert into public.partner_finance_ledger(
        partner_id, booking_id, entry_type, amount, balance_bucket, reference, metadata
      ) values (
        new.partner_id, new.id, 'ONLINE_EARNING_CREDIT', v_entitlement, 'EARNINGS',
        'EARNING_' || new.id::text,
        jsonb_build_object('gross_fare',v_commissionable,'commission_amount',v_commission,'commission_rate_pct',15)
      );

      insert into public.partner_balance_events(partner_id,booking_id,bucket,direction,amount,reason)
      values (new.partner_id,new.id,'EARNINGS','CREDIT',v_entitlement,'BOOKING_EARNING');

      v_mode := 'PLATFORM_PAYOUT';
    end if;
  end if;

  insert into public.booking_partner_settlements(
    booking_id, partner_id, plan, commissionable_fare, commission_rate_pct,
    commission_amount, partner_entitlement, settlement_mode, status, settled_at, metadata
  ) values (
    new.id,
    new.partner_id,
    v_plan,
    v_commissionable,
    case when v_plan = 'COMMISSION' then 15 else 0 end,
    v_commission,
    v_entitlement,
    v_mode,
    'SETTLED',
    now(),
    jsonb_build_object('customer_payment_mode',new.customer_payment_mode,'source','COMPLETION_TRIGGER')
  );

  update public.trip_tracking_sessions
     set active = false, ended_at = now(), updated_at = now()
   where booking_id = new.id;

  perform public.queue_loadin_notification(
    new.partner_id,
    new.id,
    'PAYMENT_UPDATE',
    'NORMAL',
    'Trip settlement ready',
    'Partner entitlement ₹' || trim(to_char(v_entitlement,'FM999999990.00')),
    jsonb_build_object('plan',v_plan,'commission',v_commission,'partner_entitlement',v_entitlement,'settlement_mode',v_mode),
    null,
    false,
    null
  );

  return new;
end
$$;

drop trigger if exists loadin_booking_finance_finalize on public.bookings;
create trigger loadin_booking_finance_finalize
after update of status on public.bookings
for each row
when (new.status = 'COMPLETED' and old.status is distinct from new.status)
execute function public.finalize_loadin_booking_finance();

create or replace function public.get_my_finance_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.partner_finance_accounts;
  v_gross numeric(14,2);
  v_commission numeric(14,2);
  v_entitlement numeric(14,2);
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select * into v_account from public.partner_finance_accounts where partner_id = v_uid;
  if not found then
    return jsonb_build_object('configured',false,'partner_id',v_uid);
  end if;

  select
    coalesce(sum(commissionable_fare),0),
    coalesce(sum(commission_amount),0),
    coalesce(sum(partner_entitlement),0)
  into v_gross, v_commission, v_entitlement
  from public.booking_partner_settlements
  where partner_id = v_uid and status = 'SETTLED';

  return jsonb_build_object(
    'configured',true,
    'partner_id',v_uid,
    'plan',v_account.plan,
    'commission_balance',v_account.commission_balance,
    'earnings_balance',v_account.earnings_balance,
    'pending_payout',v_account.pending_payout,
    'subscription_valid_until',v_account.subscription_valid_until,
    'completed_gross',v_gross,
    'platform_commission',v_commission,
    'partner_entitlement',v_entitlement
  );
end
$$;

-- Authenticated clients may call only the user-scoped RPCs below.
revoke all on function public.publish_partner_location(uuid,numeric,numeric,numeric,numeric,numeric) from public, anon;
revoke all on function public.get_booking_tracking_snapshot(uuid) from public, anon;
revoke all on function public.mark_notification_opened(uuid) from public, anon;
revoke all on function public.get_my_finance_summary() from public, anon;

grant execute on function public.publish_partner_location(uuid,numeric,numeric,numeric,numeric,numeric) to authenticated, service_role;
grant execute on function public.get_booking_tracking_snapshot(uuid) to authenticated, service_role;
grant execute on function public.mark_notification_opened(uuid) to authenticated, service_role;
grant execute on function public.get_my_finance_summary() to authenticated, service_role;

-- Internal trigger functions are not browser-callable.
revoke all on function public.enqueue_initial_booking_dispatch() from public, anon, authenticated;
revoke all on function public.notify_booking_status_change() from public, anon, authenticated;
revoke all on function public.notify_booking_proof_added() from public, anon, authenticated;
revoke all on function public.finalize_loadin_booking_finance() from public, anon, authenticated;
