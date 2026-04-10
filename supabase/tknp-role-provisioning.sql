-- TKNP role provisioning for Student vs Staff/Lec
-- Run this in Supabase SQL Editor.

-- 1) Normalize existing role values first (safe on dirty data).
update public.tknp_users
set role = case
  when upper(role) = 'STUDENT' then 'STUDENT'
  when upper(role) in ('LECRURER', 'LECTUER', 'LECUTRER') then 'LECTURER'
  else 'LECTURER'
end;

-- 2) Restrict tknp_users.role to two values only.
do $$
begin
  alter table public.tknp_users
    drop constraint if exists tknp_users_role_check;

  alter table public.tknp_users
    add constraint tknp_users_role_check
    check (upper(role) in ('STUDENT', 'LECTURER'));
exception
  when undefined_table then
    raise exception 'Table public.tknp_users does not exist. Run supabase/schema.sql first.';
end $$;

-- 3) Ensure profile table has all "Fill once" fields.
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

alter table public.tknp_profiles
  add column if not exists full_name text not null default '',
  add column if not exists school_registry_id text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists gender text not null default '',
  add column if not exists class_name text not null default '',
  add column if not exists department text not null default '',
  add column if not exists year text not null default '',
  add column if not exists age text not null default '',
  add column if not exists photo_data_url text not null default '';

-- 4) Keep auth metadata, roles, and profile rows aligned.
create or replace function public.tknp_sync_user_role_from_auth()
returns trigger
language plpgsql
security definer
as $$
declare
  normalized_role text;
  resolved_name text;
begin
  normalized_role := case
    when upper(coalesce(new.raw_user_meta_data->>'role', '')) = 'STUDENT' then 'STUDENT'
    else 'LECTURER'
  end;

  resolved_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Institutional User'
  );

  insert into public.tknp_users (user_id, name, email, role, department, admission_no)
  values (
    new.id,
    resolved_name,
    coalesce(new.email, ''),
    normalized_role,
    nullif(new.raw_user_meta_data->>'department', ''),
    nullif(new.raw_user_meta_data->>'admission_no', '')
  )
  on conflict (user_id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    department = excluded.department,
    admission_no = excluded.admission_no;

  insert into public.tknp_profiles (
    user_id,
    full_name,
    school_registry_id,
    phone,
    gender,
    class_name,
    department,
    year,
    age,
    photo_data_url
  )
  values (
    new.id,
    resolved_name,
    '',
    '',
    '',
    '',
    coalesce(nullif(new.raw_user_meta_data->>'department', ''), ''),
    '',
    '',
    ''
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    department = case
      when public.tknp_profiles.department = '' then excluded.department
      else public.tknp_profiles.department
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_tknp on auth.users;
create trigger on_auth_user_created_tknp
after insert on auth.users
for each row execute function public.tknp_sync_user_role_from_auth();

-- 5) Backfill any existing auth users missing in tknp_users.
insert into public.tknp_users (user_id, name, email, role, department, admission_no)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1), 'Institutional User') as name,
  coalesce(u.email, '') as email,
  case
    when upper(coalesce(u.raw_user_meta_data->>'role', '')) = 'STUDENT' then 'STUDENT'
    else 'LECTURER'
  end as role,
  nullif(u.raw_user_meta_data->>'department', '') as department,
  nullif(u.raw_user_meta_data->>'admission_no', '') as admission_no
from auth.users u
left join public.tknp_users t on t.user_id = u.id
where t.user_id is null;

-- 6) Backfill missing profile rows for existing users.
insert into public.tknp_profiles (
  user_id,
  full_name,
  school_registry_id,
  phone,
  gender,
  class_name,
  department,
  year,
  age,
  photo_data_url
)
select
  u.user_id,
  coalesce(nullif(u.name, ''), 'Institutional User'),
  '',
  '',
  '',
  '',
  coalesce(nullif(u.department, ''), ''),
  '',
  '',
  ''
from public.tknp_users u
left join public.tknp_profiles p on p.user_id = u.user_id
where p.user_id is null;

-- 7) Example invite calls (run in server code with service role key):
-- supabase.auth.admin.inviteUserByEmail('student@school.ac.ke', { data: { role: 'STUDENT', name: 'Jane Student' } });
-- supabase.auth.admin.inviteUserByEmail('lecturer@school.ac.ke', { data: { role: 'LECTURER', name: 'John Lecturer' } });
