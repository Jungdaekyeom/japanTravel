create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create table public.participants (
  id text primary key,
  name text not null unique,
  birth_year smallint not null check (birth_year between 1900 and 2100),
  departure_city text not null check (departure_city in ('부산', '인천')),
  role text not null check (role in ('contributor', 'admin')),
  code_salt text not null check (char_length(code_salt) > 0),
  code_hash text not null check (char_length(code_hash) > 0),
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);

create table public.opinions (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  target_day smallint check (target_day between 1 and 5),
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text references public.participants(id),
  reviewed_at timestamptz,
  rejection_category text check (rejection_category in ('schedule', 'budget', 'feasibility', 'other')),
  public_summary text check (char_length(public_summary) between 1 and 80),
  rejection_reason text check (char_length(rejection_reason) between 1 and 300),
  rejection_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opinions_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_category is null and public_summary is null and rejection_reason is null and rejection_accepted_at is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and rejection_category is null and public_summary is null and rejection_reason is null and rejection_accepted_at is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and rejection_category is not null and public_summary is not null and rejection_reason is not null)
  )
);

create table public.route_geometry_cache (
  segment_key text primary key check (segment_key in ('kix-kyoto', 'kyoto-odawara', 'odawara-tokyo', 'tokyo-narita')),
  status text not null check (status in ('placeholder', 'finalized', 'expired')),
  geometry jsonb not null default '[]'::jsonb check (jsonb_typeof(geometry) = 'array'),
  departure_time text,
  narita_rail_choice text check (narita_rail_choice in ('skyliner', 'nex')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at),
  check (segment_key = 'tokyo-narita' or narita_rail_choice is null)
);

create index sessions_expires_at_idx on public.sessions (expires_at);
create index login_attempts_ip_hash_attempted_at_idx on public.login_attempts (ip_hash, attempted_at);
create index login_attempts_attempted_at_idx on public.login_attempts (attempted_at);
create index opinions_participant_status_idx on public.opinions (participant_id, status, created_at desc);
create index route_geometry_cache_expires_at_idx on public.route_geometry_cache (expires_at);

alter table public.participants enable row level security;
alter table public.sessions enable row level security;
alter table public.login_attempts enable row level security;
alter table public.opinions enable row level security;
alter table public.route_geometry_cache enable row level security;

revoke all on schema public from anon, authenticated;
revoke all on table public.participants, public.sessions, public.login_attempts, public.opinions, public.route_geometry_cache from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to service_role;
grant all on table public.participants, public.sessions, public.login_attempts, public.opinions, public.route_geometry_cache to service_role;
grant all on all sequences in schema public to service_role;

create or replace function public.delete_expired_route_geometry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.route_geometry_cache where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_route_geometry() from public, anon, authenticated;

select cron.schedule(
  'delete-expired-route-geometry',
  '0 15 * * *',
  $$select public.delete_expired_route_geometry()$$
);
