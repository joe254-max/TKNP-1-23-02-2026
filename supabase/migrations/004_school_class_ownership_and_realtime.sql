alter table public.tknp_school_classes
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists idx_tknp_school_classes_owner_id on public.tknp_school_classes(owner_id);

do $$
begin
  if exists (select 1 from pg_policies where policyname = 'school_classes_write_lecturer') then
    drop policy school_classes_write_lecturer on public.tknp_school_classes;
  end if;

  if exists (select 1 from pg_policies where policyname = 'school_students_write_lecturer') then
    drop policy school_students_write_lecturer on public.tknp_school_class_students;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'school_classes_write_owner_or_admin') then
    create policy school_classes_write_owner_or_admin on public.tknp_school_classes
      for all
      using (
        owner_id = auth.uid()
        or exists (
          select 1 from public.tknp_users
          where user_id = auth.uid()
            and role = 'ADMIN'
        )
      )
      with check (
        owner_id = auth.uid()
        or exists (
          select 1 from public.tknp_users
          where user_id = auth.uid()
            and role = 'ADMIN'
        )
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'school_students_write_owner_or_admin') then
    create policy school_students_write_owner_or_admin on public.tknp_school_class_students
      for all
      using (
        exists (
          select 1
          from public.tknp_school_classes c
          where c.class_key = tknp_school_class_students.class_key
            and (
              c.owner_id = auth.uid()
              or exists (
                select 1 from public.tknp_users
                where user_id = auth.uid()
                  and role = 'ADMIN'
              )
            )
        )
      )
      with check (
        exists (
          select 1
          from public.tknp_school_classes c
          where c.class_key = tknp_school_class_students.class_key
            and (
              c.owner_id = auth.uid()
              or exists (
                select 1 from public.tknp_users
                where user_id = auth.uid()
                  and role = 'ADMIN'
              )
            )
        )
      );
  end if;
end $$;
