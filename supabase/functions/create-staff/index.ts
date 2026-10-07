// Edge Function: create-staff
// ผู้จัดการเท่านั้น: สร้างบัญชีพนักงาน / ตั้ง PIN ใหม่ / ลบบัญชี
// body: { action?: 'set' | 'remove', staffId: string, phone?: string, pin?: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(url, svc)
    const { data: me } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
    if (me?.role !== 'manager') return json({ error: 'forbidden' }, 403)

    const { action = 'set', staffId, phone, pin } = await req.json()
    if (typeof staffId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(staffId)) return json({ error: 'bad staffId' }, 400)

    const { data: existing } = await admin.from('profiles').select('user_id').eq('staff_id', staffId).maybeSingle()

    if (action === 'remove') {
      if (existing) await admin.auth.admin.deleteUser(existing.user_id)
      return json({ ok: true })
    }

    const digits = String(phone ?? '').replace(/\D/g, '')
    if (digits.length < 9 || digits.length > 10) return json({ error: 'เบอร์โทรไม่ถูกต้อง' }, 400)
    if (!/^\d{6}$/.test(String(pin ?? ''))) return json({ error: 'PIN ต้องเป็นเลข 6 หลัก' }, 400)
    const email = `${digits}@staff.nnmkp.example.com`

    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.user_id, { email, password: pin, email_confirm: true })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, updated: true })
    }
    const { data: created, error } = await admin.auth.admin.createUser({ email, password: pin, email_confirm: true })
    if (error || !created.user) return json({ error: error?.message ?? 'create failed' }, 400)
    const { error: pe } = await admin.from('profiles').insert({ user_id: created.user.id, role: 'staff', staff_id: staffId })
    if (pe) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: pe.message }, 400) }
    return json({ ok: true, created: true })
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500)
  }
})
