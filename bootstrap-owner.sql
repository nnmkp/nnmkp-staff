-- ทำให้บัญชีของคุณเป็นผู้จัดการ (รันครั้งเดียว หลังสร้างผู้ใช้ใน Authentication → Users)
-- แก้ 'YOUR_EMAIL' เป็นอีเมลที่คุณใช้สร้างผู้ใช้ก่อนรัน
insert into public.profiles (user_id, role)
select id, 'manager' from auth.users where email = 'nantharat.cnf@gmail.com'
on conflict (user_id) do update set role = 'manager';
