create table if not exists public.notification_preferences (
  user_id uuid primary key,
  booking_alerts boolean not null default true,
  scheduled_reminders boolean not null default true,
  document_expiry boolean not null default true,
  high_demand boolean not null default true,
  return_load boolean not null default true,
  support_updates boolean not null default true,
  booking_alert_sound_key text not null default 'loadin_booking_alert',
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  booking_id uuid,
  notification_type text not null check (notification_type in ('BOOKING_ALERT','SCHEDULED_REMINDER','DOCUMENT_EXPIRY','HIGH_DEMAND','RETURN_LOAD','REPLACEMENT','SUPPORT_UPDATE')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','CRITICAL')),
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  sound_key text,
  vibration boolean not null default false,
  status text not null default 'QUEUED' check (status in ('QUEUED','SENT','DELIVERED','OPENED','FAILED','EXPIRED','CANCELLED')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  provider text not null default 'FCM',
  provider_message_id text,
  attempt_no integer not null default 1 check (attempt_no > 0),
  outcome text not null check (outcome in ('SENT','DELIVERED','FAILED','RETRY')),
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now()
);

create table if not exists public.notification_alert_waves (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  wave_no integer not null check (wave_no > 0),
  partner_ids uuid[] not null default '{}',
  response_deadline timestamptz not null,
  outcome text not null default 'WAITING' check (outcome in ('WAITING','ACCEPTED','REBROADCAST','EXHAUSTED','CANCELLED')),
  accepted_partner_id uuid,
  created_at timestamptz not null default now(),
  unique (booking_id, wave_no)
);

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_delivery_attempts enable row level security;
alter table public.notification_alert_waves enable row level security;

create policy "user_read_own_notification_preferences" on public.notification_preferences
for select using (auth.uid() = user_id);
create policy "user_update_own_notification_preferences" on public.notification_preferences
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_insert_own_notification_preferences" on public.notification_preferences
for insert with check (auth.uid() = user_id);

create policy "user_read_own_notifications" on public.notifications
for select using (auth.uid() = user_id);

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_queue_idx on public.notifications(status, scheduled_for) where status = 'QUEUED';
create index if not exists notifications_booking_idx on public.notifications(booking_id) where booking_id is not null;
create index if not exists delivery_attempts_notification_idx on public.notification_delivery_attempts(notification_id, attempted_at desc);
create index if not exists notification_alert_waves_booking_idx on public.notification_alert_waves(booking_id, wave_no);
