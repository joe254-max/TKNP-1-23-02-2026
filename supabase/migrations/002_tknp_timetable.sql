create extension if not exists pgcrypto;

create table if not exists public.tknp_timetable_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id text not null,
  session_id text not null,
  day text not null,
  time text not null,
  venue text not null,
  session_type text not null check (session_type in ('LECTURE', 'PRACTICAL', 'SEMINAR')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, session_id)
);

create index if not exists idx_tknp_timetable_class_id on public.tknp_timetable_sessions(class_id);

alter table public.tknp_timetable_sessions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'timetable_read') then
    create policy timetable_read on public.tknp_timetable_sessions
      for select using (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'timetable_write_lecturer') then
    create policy timetable_write_lecturer on public.tknp_timetable_sessions
      for all
      using (
        exists (
          select 1 from public.tknp_users
          where user_id = auth.uid()
            and role in ('LECTURER', 'ADMIN')
        )
      )
      with check (
        exists (
          select 1 from public.tknp_users
          where user_id = auth.uid()
            and role in ('LECTURER', 'ADMIN')
        )
      );
  end if;
end $$;
