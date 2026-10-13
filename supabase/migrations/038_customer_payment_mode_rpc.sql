-- Customer payment-mode selection before trip start.
-- Keeps Fare Lock unchanged and creates/cancels payment intents idempotently.

create or replace function public.set_customer_booking_payment_mode(
  p_booking_id uuid,
  p_payment_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_mode text := upper(trim(coalesce(p_payment_mode,'')));
  v_booking public.bookings;
  v_payment public.customer_payments;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if v_mode not in ('CASH','UPI_DIRECT','ONLINE','BUSINESS_CREDIT') then
    raise exception 'invalid_payment_mode' using errcode = '22023';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found or v_booking.customer_id is distinct from v_uid then
    raise exception 'booking_not_owned_by_customer' using errcode = '42501';
  end if;

  if v_booking.status in ('IN_PROGRESS','COMPLETED','CANCELLED','FAILED') then
    raise exception 'payment_mode_locked_after_trip_start' using errcode = '22023';
  end if;

  update public.bookings
  set customer_payment_mode = v_mode, updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  if v_mode = 'ONLINE' then
    select * into v_payment
    from public.customer_payments
    where booking_id = p_booking_id and customer_id = v_uid
      and payment_mode = 'ONLINE' and status in ('PENDING','AUTHORIZED','PAID')
    order by created_at desc limit 1;

    if not found then
      insert into public.customer_payments(
        booking_id,customer_id,payment_mode,amount,currency,status,provider
      ) values (
        p_booking_id,v_uid,'ONLINE',v_booking.locked_fare,'INR','PENDING',null
      ) returning * into v_payment;
    end if;
  else
    update public.customer_payments
    set status = 'CANCELLED', updated_at = now()
    where booking_id = p_booking_id and customer_id = v_uid
      and status in ('PENDING','AUTHORIZED') and payment_mode = 'ONLINE';
    v_payment := null;
  end if;

  perform public.queue_loadin_notification(
    v_uid,
    p_booking_id,
    'PAYMENT_UPDATE',
    'NORMAL',
    'Payment method updated',
    case v_mode
      when 'CASH' then 'Cash selected. Pay the partner directly as shown in the app.'
      when 'UPI_DIRECT' then 'Direct UPI selected. Pay the partner directly as shown in the app.'
      when 'ONLINE' then 'Online payment selected. Complete payment before trip completion.'
      else 'Business credit selected for this booking.'
    end,
    jsonb_build_object('payment_mode',v_mode,'fare_locked',v_booking.locked_fare),
    null,
    false,
    null
  );

  return jsonb_build_object(
    'booking_id',v_booking.id,
    'payment_mode',v_booking.customer_payment_mode,
    'fare_locked',v_booking.locked_fare,
    'payment_id',v_payment.id,
    'payment_status',v_payment.status,
    'customer_total',v_booking.locked_fare,
    'gateway_fee_charged_to_customer',0
  );
end
$$;

revoke all on function public.set_customer_booking_payment_mode(uuid,text) from public, anon;
grant execute on function public.set_customer_booking_payment_mode(uuid,text) to authenticated, service_role;
