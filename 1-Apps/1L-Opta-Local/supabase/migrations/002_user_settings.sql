-- User settings — per-user LMX connection config synced across devices.
-- Applied after 001_cloud_sync.sql.

create table if not exists user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  lmx_host       text        not null default '192.168.188.11',
  lmx_port       int         not null default 1234,
  admin_key_encrypted text,
  tunnel_url     text,
  use_tunnel     boolean     not null default false,
  updated_at     timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users read own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users write own settings"
  on user_settings for all
  using (auth.uid() = user_id);
