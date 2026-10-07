-- NNMKP Staff — schema, RLS, storage
-- รันทั้งไฟล์ใน Supabase → SQL Editor → New query → Run (รันซ้ำได้ ไม่ทำข้อมูลหาย)

create table if not exists public.profiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     text not null check (role in ('manager','staff')),
  staff_id text unique
);

create table if not exists public.docs (
  col        text not null,
  id         text not null,
  staff_id   text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
create index if not exists docs_col_staff on public.docs (col, staff_id);

alter table public.profiles enable row level security;
alter table public.docs     enable row level security;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'manager')
$$;

create or replace function public.my_staff() returns text
language sql stable security definer set search_path = public as $$
  select staff_id from public.profiles where user_id = auth.uid()
$$;

-- สิทธิ์เข้าถึงผ่าน Data API (ใส่ไว้ชัดเจน ใช้ได้ไม่ว่าจะติ๊ก "Automatically expose new tables" หรือไม่)
-- ความปลอดภัยจริงอยู่ที่นโยบาย RLS ด้านล่าง; anon (คนที่ยังไม่ล็อกอิน) ไม่มีสิทธิ์อะไรเลย
grant usage on schema public to authenticated;
revoke all on public.docs, public.profiles from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant select on public.profiles to authenticated;

-- profiles: อ่านได้เฉพาะของตัวเอง (ผู้จัดการอ่านได้ทั้งหมด) / เขียนผ่าน Edge Function เท่านั้น
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_manager());

-- docs: อ่าน
--   staff / dayoffs / settings  -> ทุกคนที่ล็อกอิน (ชื่อ ตารางหยุด กติกา; ไม่มีเงินเดือน/เลขบัญชี)
--   staff_private / payroll / advances / loans -> ผู้จัดการ หรือเจ้าของข้อมูลเอง
drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select to authenticated using (
  public.is_manager()
  or col in ('staff','dayoffs','settings')
  or (staff_id is not null and staff_id = public.my_staff()
      and col in ('staff_private','payroll','advances','loans'))
);

-- docs: เขียน — ผู้จัดการทั้งหมด / พนักงานเฉพาะ "คำขอ" (status = pending) ของตัวเอง
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  public.is_manager()
  or (col in ('dayoffs','advances')
      and staff_id = public.my_staff()
      and data->>'staffId' = staff_id
      and data->>'status' = 'pending')
);

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
using (
  public.is_manager()
  or (col in ('dayoffs','advances') and staff_id = public.my_staff() and data->>'status' = 'pending')
)
with check (
  public.is_manager()
  or (col in ('dayoffs','advances')
      and staff_id = public.my_staff()
      and data->>'staffId' = staff_id
      and data->>'status' = 'pending')
);

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (
  public.is_manager()
  or (col in ('dayoffs','advances') and staff_id = public.my_staff() and data->>'status' = 'pending')
);

-- realtime
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- storage: สลิปโอนเงิน (ส่วนตัว) เก็บที่ proofs/<staff_id>/<ไฟล์>
insert into storage.buckets (id, name, public, file_size_limit)
values ('proofs', 'proofs', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists proofs_manager on storage.objects;
create policy proofs_manager on storage.objects for all to authenticated
  using (bucket_id = 'proofs' and public.is_manager())
  with check (bucket_id = 'proofs' and public.is_manager());

drop policy if exists proofs_own_read on storage.objects;
create policy proofs_own_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = public.my_staff());
