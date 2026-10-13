-- Secure Admin/Accounts payout queue for browser portals without service-role exposure.

create or replace function public.loadin_admin_payout_queue()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.admin_members;
  v_city text;
  v_rows jsonb;
begin
  v_member := public.require_loadin_admin(array['SUPER_ADMIN','GM','ACCOUNTS']);
  v_city := case when v_member.role='SUPER_ADMIN' then null else v_member.city_code end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,
    'partner_id',x.partner_id,
    'partner_name',x.full_name,
    'city_code',x.city_code,
    'amount',x.amount,
    'status',x.status,
    'bank_reference',x.bank_reference,
    'requested_at',x.requested_at,
    'processed_at',x.processed_at,
    'earnings_balance',x.earnings_balance,
    'pending_payout',x.pending_payout,
    'plan',x.plan
  ) order by x.requested_at desc),'[]'::jsonb)
  into v_rows
  from (
    select pr.id,pr.partner_id,pp.full_name,pp.city_code,pr.amount,pr.status,pr.bank_reference,
      pr.requested_at,pr.processed_at,fa.earnings_balance,fa.pending_payout,fa.plan
    from public.partner_payout_requests pr
    join public.partner_profiles pp on pp.user_id=pr.partner_id
    left join public.partner_finance_accounts fa on fa.partner_id=pr.partner_id
    where (v_city is null or pp.city_code=v_city)
      and pr.status in ('REQUESTED','APPROVED','PROCESSING','PAID','REJECTED')
    order by pr.requested_at desc
    limit 200
  ) x;

  return jsonb_build_object('role',v_member.role,'cityCode',v_member.city_code,'requests',v_rows);
end
$$;

revoke all on function public.loadin_admin_payout_queue() from public, anon;
grant execute on function public.loadin_admin_payout_queue() to authenticated, service_role;
