-- Classnet demo schema (Supabase/Postgres)
-- Paste into Supabase SQL Editor and run.

create extension if not exists pgcrypto;

-- PROFILES (for search + profile pages)
create table if not exists public.classnet_profiles (
  user_id text primary key,
  display_name text not null,
  headline text,
  department text,
  avatar_url text,
  last_seen_at timestamptz default now()
);

-- LIVE SESSIONS
create table if not exists public.classnet_live_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  host_name text not null,
  title text not null,
  type text not null,
  audience text not null,
  status text not null default 'LIVE',
  invite_code text not null,
  passkey text not null,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create index if not exists idx_classnet_live_sessions_status on public.classnet_live_sessions(status);
create index if not exists idx_classnet_live_sessions_host on public.classnet_live_sessions(host_id);

-- GUEST REQUESTS
create table if not exists public.classnet_live_guest_requests (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.classnet_live_sessions(id) on delete cascade,
  from_user_id text not null,
  from_name text not null,
  note text,
  status text not null default 'PENDING',
  created_at timestamptz default now()
);
create index if not exists idx_classnet_guest_requests_live on public.classnet_live_guest_requests(live_id);
create index if not exists idx_classnet_guest_requests_status on public.classnet_live_guest_requests(status);

-- GUESTS (on stage)
create table if not exists public.classnet_live_guests (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.classnet_live_sessions(id) on delete cascade,
  user_id text not null,
  name text not null,
  muted boolean not null default false,
  video_off boolean not null default false,
  joined_at timestamptz default now()
);
create index if not exists idx_classnet_live_guests_live on public.classnet_live_guests(live_id);

-- LIVE CHAT
create table if not exists public.classnet_live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.classnet_live_sessions(id) on delete cascade,
  author_id text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists idx_classnet_live_chat_live on public.classnet_live_chat_messages(live_id);

-- DEMO RLS (OPEN). For production you must lock this down.
alter table public.classnet_profiles enable row level security;
alter table public.classnet_live_sessions enable row level security;
alter table public.classnet_live_guest_requests enable row level security;
alter table public.classnet_live_guests enable row level security;
alter table public.classnet_live_chat_messages enable row level security;

do $$
begin
  -- profiles
  if not exists (select 1 from pg_policies where policyname = 'demo_profiles_all') then
    create policy demo_profiles_all on public.classnet_profiles for all using (true) with check (true);
  end if;
  -- live sessions
  if not exists (select 1 from pg_policies where policyname = 'demo_lives_all') then
    create policy demo_lives_all on public.classnet_live_sessions for all using (true) with check (true);
  end if;
  -- guest requests
  if not exists (select 1 from pg_policies where policyname = 'demo_guest_requests_all') then
    create policy demo_guest_requests_all on public.classnet_live_guest_requests for all using (true) with check (true);
  end if;
  -- guests
  if not exists (select 1 from pg_policies where policyname = 'demo_guests_all') then
    create policy demo_guests_all on public.classnet_live_guests for all using (true) with check (true);
  end if;
  -- chat
  if not exists (select 1 from pg_policies where policyname = 'demo_chat_all') then
    create policy demo_chat_all on public.classnet_live_chat_messages for all using (true) with check (true);
  end if;
end $$;

-- Realtime (optional): enable in Supabase UI if needed.

