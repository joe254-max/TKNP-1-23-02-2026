-- Bondify demo schema (Supabase/Postgres)
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

-- STORIES (Bondify-like)
-- Images only in the current Bondify UI, but we also support text-only stories.
create table if not exists public.classnet_stories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  author_name text not null,
  author_avatar_url text,
  audience text not null default 'FRIENDS', -- FRIENDS | CLOSE_BONDS
  caption text,
  text_body text,
  media_path text, -- storage object path (e.g. stories/<user>/<id>.jpg)
  media_url text, -- public URL for quick rendering
  created_at timestamptz default now(),
  expires_at timestamptz not null
);
create index if not exists idx_classnet_stories_expires on public.classnet_stories(expires_at);
create index if not exists idx_classnet_stories_user on public.classnet_stories(user_id);

-- DEMO RLS (OPEN). For production you must lock this down.
alter table public.classnet_profiles enable row level security;
alter table public.classnet_live_sessions enable row level security;
alter table public.classnet_live_guest_requests enable row level security;
alter table public.classnet_live_guests enable row level security;
alter table public.classnet_live_chat_messages enable row level security;
alter table public.classnet_stories enable row level security;

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

  -- stories (demo)
  if not exists (select 1 from pg_policies where policyname = 'demo_stories_all') then
    create policy demo_stories_all on public.classnet_stories for all using (true) with check (true);
  end if;
end $$;

-- FoodHub (Mess sub-app) tables (replacing Firestore collections)
create table if not exists public.menu (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price integer not null,
  category text not null,
  image_url text not null,
  is_available boolean not null default true,
  rating double precision,
  tags text[] default '{}'::text[],
  containers jsonb default '[]'::jsonb
);

create index if not exists idx_menu_category on public.menu(category);

alter table public.menu enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'menu_all_authenticated') then
    create policy menu_all_authenticated on public.menu
      for all using (true) with check (true);
  end if;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  full_name text not null,
  phone_number text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null,
  status text not null default 'PENDING',
  payment_status text not null default 'PENDING',
  created_at timestamptz default now(),
  checkout_request_id text,
  verification_token text
);

create index if not exists idx_orders_created_at on public.orders(created_at desc);

alter table public.orders enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'orders_all_authenticated') then
    create policy orders_all_authenticated on public.orders
      for all using (true) with check (true);
  end if;
end $$;

-- Storage bucket for story media
-- Note: This is a demo setup (bucket is public and RLS is open).
insert into storage.buckets (id, name, public)
values ('classnet-stories', 'classnet-stories', true)
on conflict (id) do nothing;

do $$
begin
  begin
    alter table storage.objects enable row level security;
  exception
    when insufficient_privilege then
      raise notice 'Skipping storage.objects RLS change (insufficient privilege).';
    when undefined_table then
      raise notice 'Skipping storage.objects RLS change (table not available).';
  end;

  begin
    if not exists (select 1 from pg_policies where policyname = 'demo_story_objects_all') then
      create policy demo_story_objects_all on storage.objects
        for all
        using (bucket_id = 'classnet-stories')
        with check (bucket_id = 'classnet-stories');
    end if;
  exception
    when insufficient_privilege then
      raise notice 'Skipping storage.objects policy creation (insufficient privilege).';
    when undefined_table then
      raise notice 'Skipping storage.objects policy creation (table not available).';
  end;
end $$;

-- Realtime (optional): enable in Supabase UI if needed.

-- TKNP (portal) tables
-- Create these tables in addition to the existing `classnet_*` demo tables.

-- Portal users (maps Supabase auth.users -> app user profile row)
create table if not exists public.tknp_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null,
  department text,
  admission_no text
);

alter table public.tknp_users enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'tknp_users_select_own') then
    create policy tknp_users_select_own on public.tknp_users
      for select using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname = 'tknp_users_insert_own') then
    create policy tknp_users_insert_own on public.tknp_users
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname = 'tknp_users_update_own') then
    create policy tknp_users_update_own on public.tknp_users
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Portal profiles (used by Profile.tsx + student identity)
create table if not exists public.tknp_profiles (
  user_id uuid primary key references public.tknp_users(user_id) on delete cascade,
  full_name text not null default '',
  school_registry_id text not null default '',
  phone text not null default '',
  gender text not null default '',
  class_name text not null default '',
  department text not null default '',
  year text not null default '',
  age text not null default '',
  photo_data_url text not null default ''
);

alter table public.tknp_profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'tknp_profiles_select_own') then
    create policy tknp_profiles_select_own on public.tknp_profiles
      for select using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname = 'tknp_profiles_insert_own') then
    create policy tknp_profiles_insert_own on public.tknp_profiles
      for insert with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname = 'tknp_profiles_update_own') then
    create policy tknp_profiles_update_own on public.tknp_profiles
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- WebRTC signaling (teacher <-> student)
-- Both sides INSERT and then DELETE rows after processing.
-- Demo-friendly: permissive RLS so signaling works for both participants.
create table if not exists public.tknp_signals (
  id uuid primary key default gen_random_uuid(),
  class_id text not null,
  type text not null,
  role text not null,
  from_id text,
  to_id text,
  name text,
  sdp jsonb,
  candidate jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_tknp_signals_class_created_at
  on public.tknp_signals (class_id, created_at desc);

alter table public.tknp_signals enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'tknp_signals_all_authenticated') then
    create policy tknp_signals_all_authenticated on public.tknp_signals
      for all using (true) with check (true);
  end if;
end $$;

-- Enable Realtime for signaling inserts (idempotent).
-- Note: Realtime must also be enabled for the project in the Supabase Dashboard.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tknp_signals'
  ) then
    execute 'alter publication supabase_realtime add table public.tknp_signals';
  end if;
end $$;

