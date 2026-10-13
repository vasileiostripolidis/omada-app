// Patras Schools Soccer – χρεώσεις, αποδείξεις, υπενθυμίσεις, email
import { createClient } from 'npm:@supabase/supabase-js@2'
import { statementPdf, receiptPdf, toBase64, type Assets, type Club } from './pdf.ts'

const BRAND = 'https://vasileiostripolidis.github.io/omada-app/brand/'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const money = (n: number) => (Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

function b64(buf: ArrayBuffer) {
  const u = new Uint8Array(buf); let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
async function fetchB64(url: string) {
  const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url)
  return { data: b64(await r.arrayBuffer()), type: r.headers.get('content-type') || '' }
}

let fontCache: { regular: string; bold: string; logo: string } | null = null
async function loadAssets(db: ReturnType<typeof createClient>): Promise<Assets> {
  if (!fontCache) {
    const [r, b, l] = await Promise.all([fetchB64(BRAND + 'fonts/LS-Regular.ttf'), fetchB64(BRAND + 'fonts/LS-Bold.ttf'), fetchB64(BRAND + 'pss-logo-small.png')])
    fontCache = { regular: r.data, bold: b.data, logo: 'data:image/png;base64,' + l.data }
  }
  const { data: sp } = await db.from('sponsors').select('name, logo_url').eq('show_on_documents', true).order('sort').limit(7)
  const sponsors = await Promise.all((sp || []).map(async (s: { name: string; logo_url: string | null }) => {
    if (!s.logo_url) return { name: s.name }
    try {
      const f = await fetchB64(s.logo_url)
      const fmt = f.type.includes('png') ? 'PNG' : f.type.includes('jpeg') || f.type.includes('jpg') ? 'JPEG' : null
      return fmt ? { name: s.name, img: `data:${f.type};base64,${f.data}`, fmt } : { name: s.name }
    } catch { return { name: s.name } }
  }))
  return { ...fontCache, sponsors }
}

function emailHtml(c: Club & { logo_url?: string | null }, title: string, body: string, sponsors: { name: string; logo_url: string | null }[]) {
  const navy = c.primary_color || '#021534', red = c.accent_color || '#c8102e'
  const sp = sponsors.filter((s) => s.logo_url).map((s) => `<img src="${s.logo_url}" alt="${s.name}" style="height:38px;margin:6px 10px;vertical-align:middle">`).join('')
  return `<!doctype html><html><body style="margin:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:${navy};padding:20px 24px;border-bottom:4px solid ${red}">
<table><tr><td><img src="${c.logo_url || BRAND + 'pss-logo-small.png'}" height="64" alt=""></td>
<td style="padding-left:14px;color:#fff"><div style="font-size:20px;font-weight:bold;letter-spacing:.5px">${c.club_name.toUpperCase()}</div>
<div style="font-size:13px;opacity:.85;margin-top:4px">${title}</div></td></tr></table></td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${body}</td></tr>
${sp ? `<tr><td style="padding:10px 24px 18px;text-align:center;border-top:1px solid #e3e8f0"><div style="font-size:11px;color:#5b6475;letter-spacing:1px;margin:8px 0">ΜΕ ΤΗΝ ΥΠΟΣΤΗΡΙΞΗ ΤΩΝ ΧΟΡΗΓΩΝ ΜΑΣ</div>${sp}</td></tr>` : ''}
<tr><td style="background:${navy};color:#cfd6e4;font-size:12px;padding:14px 24px">${[c.club_name, c.address, c.phone, c.email].filter(Boolean).join(' · ')}</td></tr>
</table></td></tr></table></body></html>`
}

async function sendMail(to: string[], subject: string, html: string, attachments?: { filename: string; content: string }[]) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, error: 'Το email δεν έχει ρυθμιστεί ακόμα (λείπει το κλειδί Resend).' }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') || 'Patras Schools Soccer <onboarding@resend.dev>', to, subject, html, attachments }),
  })
  const out = await r.json().catch(() => ({}))
  return r.ok ? { ok: true } : { ok: false, error: out.message || 'Αποτυχία αποστολής' }
}

type DB = ReturnType<typeof createClient>

async function loadHousehold(db: DB, hid: string) {
  const [h, g, ph, ch, pay, bal] = await Promise.all([
    db.from('households').select('*').eq('id', hid).single(),
    db.from('guardians').select('*').eq('household_id', hid).order('created_at'),
    db.from('player_households').select('share_pct, players(first_name,last_name,active)').eq('household_id', hid),
    db.from('charges').select('*').eq('household_id', hid).order('due_date', { ascending: true, nullsFirst: false }).order('created_at'),
    db.from('payments').select('*, guardians(first_name,last_name)').eq('household_id', hid).order('created_at', { ascending: false }),
    db.from('household_balances').select('*').eq('household_id', hid).single(),
  ])
  if (!h.data) throw new Error('Δεν βρέθηκε η οικογένεια')
  const guardians = (g.data || []) as { first_name: string; last_name: string; relation: string | null; email: string | null; receives_emails: boolean }[]
  const children = ((ph.data || []) as { share_pct: number; players: { first_name: string; last_name: string; active: boolean } }[])
    .filter((x) => x.players).map((x) => `${x.players.last_name} ${x.players.first_name}${Number(x.share_pct) < 100 ? ` (${Number(x.share_pct)}%)` : ''}`)
  const recipients = [...new Set(guardians.filter((x) => x.receives_emails && x.email).map((x) => x.email!.trim()))]
  return { h: h.data, guardians, children, recipients, charges: ch.data || [], payments: pay.data || [], balance: Number(bal.data?.balance || 0) }
}

const gname = (g: { first_name: string; last_name: string } | null) => (g ? `${g.first_name} ${g.last_name}` : null)

async function statement(db: DB, c: Club & { logo_url?: string | null }, hid: string, send: boolean, reminder: boolean) {
  const x = await loadHousehold(db, hid)
  const assets = await loadAssets(db)
  const doc = statementPdf(assets, c, {
    household: x.h.name, reminder,
    guardians: x.guardians.map((g) => `${g.first_name} ${g.last_name}${g.relation ? ` (${g.relation})` : ''}`),
    children: x.children, balance: x.balance,
    charges: x.charges.map((r: Record<string, unknown>) => ({ ...r, amount: Number(r.amount), paid_amount: Number(r.paid_amount) })) as never,
    payments: x.payments.map((p: Record<string, unknown>) => ({ ...p, amount: Number(p.amount), payer: gname(p.guardians as never) })) as never,
  })
  const pdf = toBase64(doc)
  if (!send) return { pdf }
  if (!x.recipients.length) return { pdf, emailed: false, error: 'Δεν υπάρχει email γονέα με ενεργές ειδοποιήσεις' }
  const { data: sp } = await db.from('sponsors').select('name, logo_url').eq('show_on_documents', true).order('sort')
  const open = x.charges.filter((r: { status: string }) => r.status === 'pending' || r.status === 'partial')
  const rows = open.map((r: { description: string; amount: number; paid_amount: number }) =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${r.description}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #eee">${money(Number(r.amount) - Number(r.paid_amount))}</td></tr>`).join('')
  const body = `<p>Αγαπητοί γονείς,</p>
<p>${reminder ? 'Σας υπενθυμίζουμε φιλικά ότι εκκρεμεί υπόλοιπο' : 'Σας αποστέλλουμε την κατάσταση λογαριασμού'} για ${x.children.length > 1 ? 'τους αθλητές' : 'τον/την αθλητή/τρια'} <b>${x.children.join(', ') || x.h.name}</b>.</p>
${rows ? `<table width="100%" style="font-size:14px;border-collapse:collapse;margin:10px 0">${rows}</table>` : ''}
<p style="font-size:18px;margin:16px 0"><b>Υπόλοιπο: <span style="color:${x.balance > 0 ? (c.accent_color || '#c8102e') : '#1f8a4c'}">${money(x.balance)}</span></b></p>
${c.iban && x.balance > 0 ? `<p>Μπορείτε να εξοφλήσετε με κατάθεση στο IBAN <b>${c.iban}</b> (αιτιολογία: ${x.children[0] || x.h.name}) ή στη γραμματεία.</p>` : ''}
<p>Θα βρείτε αναλυτικά τα στοιχεία στο συνημμένο PDF.</p><p>${c.email_footer || ''}</p>`
  const subject = `${c.club_name} – ${reminder ? 'Υπενθύμιση οφειλής' : 'Κατάσταση λογαριασμού'} ${x.h.name}`
  const res = await sendMail(x.recipients, subject, emailHtml(c, reminder ? 'Υπενθύμιση οφειλής' : 'Κατάσταση λογαριασμού', body, sp || []),
    [{ filename: `Katastasi_${x.h.name.replace(/[^\p{L}\p{N}]+/gu, '_')}.pdf`, content: pdf }])
  await db.from('email_log').insert({ to_email: x.recipients.join(', '), subject, kind: reminder ? 'reminder' : 'statement', household_id: hid, status: res.ok ? 'sent' : 'error', error: res.ok ? null : res.error })
  if (res.ok) await db.from('charges').update({ emailed_at: new Date().toISOString() }).in('id', open.map((r: { id: string }) => r.id))
  return { pdf, emailed: res.ok, error: res.ok ? undefined : res.error }
}

async function receipt(db: DB, c: Club & { logo_url?: string | null }, pid: string, send: boolean) {
  const { data: p } = await db.from('payments').select('*, guardians(first_name,last_name)').eq('id', pid).single()
  if (!p) throw new Error('Δεν βρέθηκε η πληρωμή')
  const x = await loadHousehold(db, p.household_id)
  // ποιες χρεώσεις κάλυψε αυτή η πληρωμή (κατανομή από την παλαιότερη)
  const before = x.payments.filter((q: { created_at: string; id: string }) => q.created_at < p.created_at).reduce((a: number, q: { amount: number }) => a + Number(q.amount), 0)
  const after = before + Number(p.amount)
  let cum = 0; const covered: string[] = []
  for (const ch of x.charges.filter((r: { status: string }) => r.status !== 'cancelled') as { description: string; amount: number }[]) {
    const s = cum, e = cum + Number(ch.amount); cum = e
    const ov = Math.min(e, after) - Math.max(s, before)
    if (ov > 0.004) covered.push(e <= after + 0.004 ? `${ch.description} (εξόφληση)` : `${ch.description} (έναντι ${money(ov)})`)
  }
  if (after > cum + 0.004) covered.push(`Πίστωση λογαριασμού ${money(after - Math.max(cum, before))}`)
  const payer = gname(p.guardians) || x.guardians.map((g) => `${g.first_name} ${g.last_name}`)[0] || x.h.name
  const assets = await loadAssets(db)
  const doc = receiptPdf(assets, c, { receipt_no: p.receipt_no, paid_at: p.paid_at, amount: Number(p.amount), method: p.method, payer, household: x.h.name, children: x.children, note: p.note, covered, balance: x.balance })
  const pdf = toBase64(doc)
  if (!send) return { pdf }
  if (!x.recipients.length) return { pdf, emailed: false, error: 'Δεν υπάρχει email γονέα με ενεργές ειδοποιήσεις' }
  const { data: sp } = await db.from('sponsors').select('name, logo_url').eq('show_on_documents', true).order('sort')
  const owe = x.balance > 0.004
  const body = `<p>Αγαπητέ/ή ${payer},</p><p>Επιβεβαιώνουμε ότι λάβαμε την πληρωμή σας:</p>
<p style="font-size:22px;margin:12px 0"><b>${money(Number(p.amount))}</b> <span style="font-size:14px;color:#5b6475">· Απόδειξη #${p.receipt_no} · ${new Date(p.paid_at).toLocaleDateString('el-GR')}</span></p>
<ul>${covered.map((l) => `<li>${l}</li>`).join('')}</ul>
<div style="padding:14px 16px;border-radius:8px;background:${owe ? '#fff4e5' : '#e6f5ec'};color:${owe ? '#8a4b00' : '#11663a'};font-weight:bold">
${owe ? `Υπόλοιπο που εκκρεμεί: ${money(x.balance)}` : 'Ο λογαριασμός σας είναι πλήρως εξοφλημένος. Ευχαριστούμε!'}</div>
<p>Η απόδειξη επισυνάπτεται σε PDF.</p><p>${c.email_footer || ''}</p>`
  const subject = `${c.club_name} – Απόδειξη πληρωμής #${p.receipt_no}`
  const res = await sendMail(x.recipients, subject, emailHtml(c, 'Απόδειξη είσπραξης', body, sp || []), [{ filename: `Apodeixi_${p.receipt_no}.pdf`, content: pdf }])
  await db.from('email_log').insert({ to_email: x.recipients.join(', '), subject, kind: 'receipt', household_id: p.household_id, status: res.ok ? 'sent' : 'error', error: res.ok ? null : res.error })
  if (res.ok) await db.from('payments').update({ receipt_sent_at: new Date().toISOString() }).eq('id', pid)
  return { pdf, emailed: res.ok, error: res.ok ? undefined : res.error }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const secret = req.headers.get('x-cron-secret')
    let allowed = false
    if (secret) allowed = !!(await db.rpc('check_cron_secret', { s: secret })).data
    else {
      const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
      allowed = !!(await user.rpc('is_staff')).data
    }
    if (!allowed) return json({ error: 'Δεν επιτρέπεται' }, 403)

    const body = await req.json().catch(() => ({}))
    const { data: c } = await db.from('club_settings').select('*').eq('id', 1).single()

    switch (body.action) {
      case 'statement': return json(await statement(db, c, body.household_id, !!body.send, !!body.reminder))
      case 'receipt': return json(await receipt(db, c, body.payment_id, body.send !== false))
      case 'reminders': {
        const { data: bals } = await db.from('household_balances').select('household_id, balance').gt('balance', 0.004)
        const { data: act } = await db.from('households').select('id').eq('active', true)
        const ids = new Set((act || []).map((h: { id: string }) => h.id))
        let sent = 0, skipped = 0; const errors: string[] = []
        for (const b of (bals || []) as { household_id: string }[]) {
          if (!ids.has(b.household_id)) continue
          try {
            const r = await statement(db, c, b.household_id, true, true)
            if (r.emailed) sent++; else { skipped++; if (r.error) errors.push(r.error) }
          } catch (e) { errors.push((e as Error).message) }
        }
        return json({ sent, skipped, errors: [...new Set(errors)] })
      }
      case 'email': {
        const to = [...new Set((body.to || []) as string[])].filter(Boolean)
        if (!to.length) return json({ error: 'Δεν υπάρχουν παραλήπτες' })
        const { data: sp } = await db.from('sponsors').select('name, logo_url').eq('show_on_documents', true).order('sort')
        let ok = 0; let err = ''
        for (const t of to) { const r = await sendMail([t], body.subject, emailHtml(c, body.subject, body.html, sp || [])); if (r.ok) ok++; else err = r.error || '' }
        await db.from('email_log').insert({ to_email: to.join(', '), subject: body.subject, kind: 'announcement', status: ok ? 'sent' : 'error', error: err || null })
        return json({ sent: ok, total: to.length, error: ok ? undefined : err })
      }
      default: return json({ error: 'Άγνωστη ενέργεια' }, 400)
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
