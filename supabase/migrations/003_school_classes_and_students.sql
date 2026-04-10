create table if not exists public.tknp_school_classes (
  class_key text primary key,
  code text not null,
  title text not null,
  department text not null default 'General',
  class_mode text not null check (class_mode in ('PHYSICAL', 'ONLINE')),
  room_or_platform text not null default '',
  teacher_name text not null default '',
  student_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_tknp_school_classes_code on public.tknp_school_classes(code);
create index if not exists idx_tknp_school_classes_title on public.tknp_school_classes(title);
create index if not exists idx_tknp_school_classes_department on public.tknp_school_classes(department);

create table if not exists public.tknp_school_class_students (
  class_key text not null,
  student_id text not null,
  adm_no text not null,
  student_name text not null,
  phone text not null default '',
  status text not null default 'ACTIVE',
  attendance numeric not null default 0,
  grade_average numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (class_key, adm_no)
);

create index if not exists idx_tknp_school_class_students_class_key on public.tknp_school_class_students(class_key);
create index if not exists idx_tknp_school_class_students_adm_no on public.tknp_school_class_students(adm_no);
create index if not exists idx_tknp_school_class_students_student_name on public.tknp_school_class_students(student_name);

alter table public.tknp_school_classes enable row level security;
alter table public.tknp_school_class_students enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'school_classes_read') then
    create policy school_classes_read on public.tknp_school_classes
      for select using (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'school_classes_write_lecturer') then
    create policy school_classes_write_lecturer on public.tknp_school_classes
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

  if not exists (select 1 from pg_policies where policyname = 'school_students_read') then
    create policy school_students_read on public.tknp_school_class_students
      for select using (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'school_students_write_lecturer') then
    create policy school_students_write_lecturer on public.tknp_school_class_students
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
