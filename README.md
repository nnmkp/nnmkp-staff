# NNMKP Staff

แอปจัดการพนักงาน (วันหยุด เงินเดือน เบิกล่วงหน้า เงินยืม สลิป) หน้าเว็บ HTML ไฟล์เดียว + Supabase

## ไฟล์ในโฟลเดอร์นี้
| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `index.html` | หน้าเว็บทั้งหมด |
| `config.js` | ใส่ Project URL กับ anon key ของ Supabase |
| `schema.sql` | สร้างตาราง กฎสิทธิ์ (RLS) และที่เก็บไฟล์สลิป |
| `bootstrap-owner.sql` | ตั้งบัญชีของคุณเป็นผู้จัดการ |
| `supabase/functions/create-staff/index.ts` | ฟังก์ชันสร้างบัญชีพนักงาน / ตั้ง PIN |

ไฟล์ `seed.sql` (ข้อมูลจริง เงินเดือน เลขบัญชี) **ไม่อยู่ในโฟลเดอร์นี้** ห้ามอัปโหลดขึ้น GitHub

## ขั้นตอน (ทำตามลำดับ)
1. **Supabase → SQL Editor** → วางเนื้อหา `schema.sql` → Run
2. **Authentication → Users → Add user** (ใส่อีเมลกับรหัสผ่านของคุณ ติ๊ก Auto Confirm) แล้วเปิด `bootstrap-owner.sql` แก้ `YOUR_EMAIL` → Run
3. **Authentication → Sign In / Providers → Email** → ปิด "Confirm email"
4. **Edge Functions → Deploy a new function → Via Editor** ตั้งชื่อ `create-staff` → วางเนื้อหา `supabase/functions/create-staff/index.ts` → Deploy
5. **SQL Editor** → วางเนื้อหา `seed.sql` (ไฟล์ส่วนตัว) → Run (ย้ายข้อมูลที่กรอกไว้ในแอปทดลอง)
6. แก้ `config.js` ใส่ Project URL และ anon/publishable key
7. อัปโหลดโฟลเดอร์นี้ขึ้น GitHub (repo ใหม่) → **Settings → Pages → Deploy from a branch → main / (root)** จะได้ลิงก์ `https://<ชื่อ>.github.io/<repo>/`
8. เปิดลิงก์ → "เจ้าของ / ผู้จัดการ" → ล็อกอินด้วยอีเมลที่สร้างในข้อ 2
9. แท็บ **ตั้งค่า** → การ์ดพนักงานแต่ละคน → ใส่เบอร์โทร → ตั้ง PIN 6 หลัก → ส่งลิงก์ให้พนักงาน

## ความปลอดภัย
- `anon key` เปิดเผยได้ ข้อมูลถูกกันด้วย RLS ที่ฝั่งฐานข้อมูล: พนักงานอ่านเงินเดือน/เลขบัญชี/สลิปได้เฉพาะของตัวเอง และขอได้เฉพาะ "คำขอ" (หยุด/เบิก) สถานะ pending
- **ห้ามใส่ `service_role` key ในไฟล์ใด ๆ** (ฟังก์ชัน create-staff ใช้ค่านี้จากระบบของ Supabase เอง)
- PIN ถูกเก็บเป็นรหัสผ่านใน Supabase Auth (เข้ารหัสแล้ว) ไม่อยู่ในตารางข้อมูล
