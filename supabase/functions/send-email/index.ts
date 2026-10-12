// Αποστολή email μέσω Resend (https://resend.com). Χρειάζεται secrets: RESEND_API_KEY, MAIL_FROM
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
  const { data: staff } = await userClient.rpc('is_staff')
  if (!staff) return json({ error: 'Δεν επιτρέπεται' }, 403)

  const { to, subject, html, attachments, player_id, kind } = await req.json()
  const key = Deno.env.get('RESEND_API_KEY')
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  if (!key) {
    await admin.from('email_log').insert({ to_email: to, subject, kind, player_id, status: 'error', error: 'missing RESEND_API_KEY' })
    return json({ error: 'Το email δεν έχει ρυθμιστεί ακόμα (λείπει το κλειδί Resend).' })
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') || 'Ομάδα <onboarding@resend.dev>', to: [to], subject, html, attachments }),
  })
  const out = await r.json()
  await admin.from('email_log').insert({ to_email: to, subject, kind, player_id, status: r.ok ? 'sent' : 'error', error: r.ok ? null : JSON.stringify(out) })
  return r.ok ? json({ ok: true, id: out.id }) : json({ error: out.message || 'Αποτυχία αποστολής' })
})
