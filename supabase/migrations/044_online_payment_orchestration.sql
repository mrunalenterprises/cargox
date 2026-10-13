-- Provider-neutral online payment orchestration with idempotent provider events.
-- Customer creates/reads only their own payment intent; provider order binding and webhook outcomes stay service-role only.

alter table public.customer_payments
  add column if not exists provider_order_created_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists customer_payments_provider_order_uidx
  on public.customer_payments(provider, provider_order_id)
  where provider is not null and provider_order_id is not null;

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_order_id text,
  provider_payment_id text,
  amount numeric(12,2),
  signature_valid boolean not null default false,
  payment_id uuid references public.customer_payments(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

alter table public.payment_provider_events enable row level security;
create index if not exists payment_provider_events_order_idx
  on public.payment_provider_events(provider, provider_order_id, processed_at desc);
create index if not exists payment_provider_events_payment_idx
  on public.payment_provider_events(payment_id, processed_at desc);

create or replace function public.prepare_my_online_payment(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_payment public.customer_payments;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select * into v_booking
  from public.bookings
  where id=p_booking_id
  for update;

  if not found or v_booking.customer_id is distinct from v_uid then
    raise exception 'booking_not_owned_by_customer' using errcode='42501';
  end if;
  if v_booking.customer_payment_mode <> 'ONLINE' then
    raise exception 'online_payment_mode_required' using errcode='22023';
  end if;
  if v_booking.status in ('COMPLETED','CANCELLED','FAILED') then
    raise exception 'booking_not_payable' using errcode='22023';
  end if;

  select * into v_payment
  from public.customer_payments
  where booking_id=p_booking_id and customer_id=v_uid and payment_mode='ONLINE'
    and status in ('PENDING','AUTHORIZED','PAID')
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.customer_payments(
      booking_id,customer_id,payment_mode,amount,currency,status
    ) values (
      p_booking_id,v_uid,'ONLINE',v_booking.locked_fare,'INR','PENDING'
    ) returning * into v_payment;
  end if;

  if v_payment.amount is distinct from v_booking.locked_fare then
    if v_payment.status='PAID' then raise exception 'paid_amount_mismatch' using errcode='22023'; end if;
    update public.customer_payments
      set amount=v_booking.locked_fare,updated_at=now()
      where id=v_payment.id returning * into v_payment;
  end if;

  return jsonb_build_object(
    'payment_id',v_payment.id,
    'booking_id',v_payment.booking_id,
    'amount',v_payment.amount,
    'currency',v_payment.currency,
    'status',v_payment.status,
    'provider',v_payment.provider,
    'provider_order_id',v_payment.provider_order_id,
    'provider_payment_id',v_payment.provider_payment_id,
    'fare_locked',v_booking.locked_fare,
    'gateway_fee_charged_to_customer',0
  );
end
$$;

create or replace function public.bind_loadin_provider_order(
  p_payment_id uuid,
  p_provider text,
  p_provider_order_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.customer_payments;
  v_provider text := upper(trim(coalesce(p_provider,'')));
begin
  if v_provider='' or nullif(trim(coalesce(p_provider_order_id,'')),'') is null then
    raise exception 'provider_order_required' using errcode='22023';
  end if;

  select * into v_payment from public.customer_payments where id=p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode='P0002'; end if;
  if v_payment.payment_mode <> 'ONLINE' then raise exception 'online_payment_required' using errcode='22023'; end if;
  if v_payment.status not in ('PENDING','AUTHORIZED') then raise exception 'payment_not_orderable' using errcode='22023'; end if;

  if v_payment.provider_order_id is not null then
    if v_payment.provider=v_provider and v_payment.provider_order_id=p_provider_order_id then
      return jsonb_build_object('payment_id',v_payment.id,'provider',v_payment.provider,'provider_order_id',v_payment.provider_order_id,'status',v_payment.status,'idempotent',true);
    end if;
    raise exception 'payment_provider_order_already_bound' using errcode='23505';
  end if;

  update public.customer_payments
  set provider=v_provider,
      provider_order_id=trim(p_provider_order_id),
      provider_order_created_at=now(),
      metadata=metadata||coalesce(p_metadata,'{}'::jsonb),
      updated_at=now()
  where id=p_payment_id
  returning * into v_payment;

  return jsonb_build_object('payment_id',v_payment.id,'provider',v_payment.provider,'provider_order_id',v_payment.provider_order_id,'status',v_payment.status,'idempotent',false);
end
$$;

create or replace function public.record_loadin_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_order_id text,
  p_provider_payment_id text default null,
  p_amount numeric default null,
  p_signature_valid boolean default false,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider text := upper(trim(coalesce(p_provider,'')));
  v_event_type text := lower(trim(coalesce(p_event_type,'')));
  v_payment public.customer_payments;
  v_event public.payment_provider_events;
  v_target_status text;
begin
  if v_provider='' or nullif(trim(coalesce(p_provider_event_id,'')),'') is null then raise exception 'provider_event_required' using errcode='22023'; end if;
  if not p_signature_valid then raise exception 'invalid_provider_signature' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_provider_order_id,'')),'') is null then raise exception 'provider_order_required' using errcode='22023'; end if;

  select * into v_event
  from public.payment_provider_events
  where provider=v_provider and provider_event_id=p_provider_event_id;
  if found then
    return jsonb_build_object('event_id',v_event.id,'payment_id',v_event.payment_id,'duplicate',true,'processed',true);
  end if;

  select * into v_payment
  from public.customer_payments
  where provider=v_provider and provider_order_id=p_provider_order_id
  for update;
  if not found then raise exception 'provider_order_not_found' using errcode='P0002'; end if;

  if p_amount is not null and round(p_amount,2) is distinct from round(v_payment.amount,2) then
    raise exception 'provider_amount_mismatch' using errcode='22023';
  end if;

  v_target_status := case
    when v_event_type in ('payment.captured','order.paid','payment.paid','payment.success') then 'PAID'
    when v_event_type in ('payment.authorized','payment.authorised') then 'AUTHORIZED'
    when v_event_type in ('payment.failed','payment.failure') then 'FAILED'
    else null
  end;

  insert into public.payment_provider_events(
    provider,provider_event_id,event_type,provider_order_id,provider_payment_id,amount,signature_valid,payment_id,payload
  ) values (
    v_provider,p_provider_event_id,v_event_type,p_provider_order_id,nullif(trim(coalesce(p_provider_payment_id,'')),''),p_amount,true,v_payment.id,coalesce(p_payload,'{}'::jsonb)
  ) returning * into v_event;

  if v_target_status='PAID' then
    update public.customer_payments
    set status='PAID',provider_payment_id=coalesce(nullif(trim(coalesce(p_provider_payment_id,'')),''),provider_payment_id),paid_at=coalesce(paid_at,now()),updated_at=now()
    where id=v_payment.id returning * into v_payment;
  elsif v_target_status='AUTHORIZED' and v_payment.status='PENDING' then
    update public.customer_payments
    set status='AUTHORIZED',provider_payment_id=coalesce(nullif(trim(coalesce(p_provider_payment_id,'')),''),provider_payment_id),updated_at=now()
    where id=v_payment.id returning * into v_payment;
  elsif v_target_status='FAILED' and v_payment.status not in ('PAID','REFUNDED','PARTIALLY_REFUNDED') then
    update public.customer_payments set status='FAILED',updated_at=now() where id=v_payment.id returning * into v_payment;
  end if;

  if v_target_status is not null then
    perform public.queue_loadin_notification(
      v_payment.customer_id,
      v_payment.booking_id,
      'PAYMENT_UPDATE',
      case when v_target_status='PAID' then 'HIGH' else 'NORMAL' end,
      case when v_target_status='PAID' then 'Payment received' when v_target_status='AUTHORIZED' then 'Payment authorized' else 'Payment failed' end,
      case when v_target_status='PAID' then 'Your online payment is confirmed. No extra gateway fee was added to your LOADIN fare.' when v_target_status='AUTHORIZED' then 'Your payment is authorized and is awaiting capture.' else 'Online payment failed. You can retry from Checkout.' end,
      jsonb_build_object('payment_id',v_payment.id,'status',v_target_status,'provider',v_provider),
      null,
      false,
      null
    );
  end if;

  return jsonb_build_object('event_id',v_event.id,'payment_id',v_payment.id,'status',v_payment.status,'duplicate',false,'processed',true);
end
$$;

revoke all on function public.prepare_my_online_payment(uuid) from public, anon;
revoke all on function public.bind_loadin_provider_order(uuid,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.record_loadin_payment_event(text,text,text,text,text,numeric,boolean,jsonb) from public, anon, authenticated;

grant execute on function public.prepare_my_online_payment(uuid) to authenticated, service_role;
grant execute on function public.bind_loadin_provider_order(uuid,text,text,jsonb) to service_role;
grant execute on function public.record_loadin_payment_event(text,text,text,text,text,numeric,boolean,jsonb) to service_role;
