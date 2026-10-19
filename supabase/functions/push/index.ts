// Patras Schools Soccer – ειδοποιήσεις στο κινητό
// • Web Push (VAPID) για browser / εφαρμογή οθόνης αφετηρίας
// • Apple Push Notification service (APNs) για την εφαρμογή iPhone/iPad
//   Απαιτεί secrets: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY (περιεχόμενο αρχείου .p8), προαιρετικά APNS_TOPIC
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const APP = 'https://vasileiostripolidis.github.io/omada-app/'

type Sub = { endpoint: string; p256dh: string | null; auth: string | null; platform?: string }
type Payload = { title: string; body: string; url: string; tag?: string }

// ---------- APNs ----------
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const u = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b instanceof Uint8Array ? b : b)
  let s = ''; u.forEach((x) => (s += String.fromCharCode(x)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
let apnsJwt: { token: string; at: number } | null = null
async function apnsToken(): Promise<string | null> {
  const keyId = Deno.env.get('APNS_KEY_ID'), team = Deno.env.get('APNS_TEAM_ID'), pem = Deno.env.get('APNS_KEY')
  if (!keyId || !team || !pem) return null
  if (apnsJwt && Date.now() - apnsJwt.at < 40 * 60 * 1000) return apnsJwt.token
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: keyId })), claims = b64url(JSON.stringify({ iss: team, iat: Math.floor(Date.now() / 1000) }))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${claims}`))
  apnsJwt = { token: `${head}.${claims}.${b64url(sig)}`, at: Date.now() }
  return apnsJwt.token
}
async function sendApns(token: string, p: Payload): Promise<'ok' | 'gone' | 'error'> {
  const jwt = await apnsToken(); if (!jwt) return 'error'
  const topic = Deno.env.get('APNS_TOPIC') || 'gr.patrasschoolssoccer.app'
  const body = JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: 'default', ...(p.tag ? { 'thread-id': p.tag } : {}) }, url: p.url })
  // Πρώτα παραγωγή (App Store / TestFlight), μετά sandbox (εγκατάσταση από Xcode)
  for (const host of ['api.push.apple.com', 'api.sandbox.push.apple.com']) {
    const r = await fetch(`https://${host}/3/device/${token}`, { method: 'POST', headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10' }, body })
    if (r.ok) return 'ok'
    const reason = (await r.json().catch(() => ({})))?.reason || ''
    if (r.status === 410 || reason === 'Unregistered') return 'gone'
    if (reason !== 'BadDeviceToken') { console.log('apns', host, r.status, reason); return 'error' }
  }
  return 'gone'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const secret = req.headers.get('x-cron-secret')
    let role = '', uid: string | null = null
    if (secret) { if ((await db.rpc('check_cron_secret', { s: secret })).data) role = 'system' }
    else {
      const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
      const { data: u } = await user.auth.getUser()
      if (u.user) { uid = u.user.id; const { data: pr } = await db.from('profiles').select('role').eq('id', uid).single(); role = pr?.role || '' }
    }
    if (!role || role === 'pending') return json({ error: 'Δεν επιτρέπεται' }, 403)
    const office = ['system', 'admin', 'secretary'].includes(role)
    const body = await req.json().catch(() => ({}))

    let { data: keys } = await db.rpc('push_keys')
    if (!keys?.public || !keys?.private) {
      const k = webpush.generateVAPIDKeys()
      await db.rpc('set_push_keys', { pub: k.publicKey, priv: k.privateKey })
      keys = (await db.rpc('push_keys')).data
    }
    if (body.action === 'public_key') return json({ key: keys.public })
    webpush.setVapidDetails('mailto:noreply@patrasschoolssoccer.gr', keys.public, keys.private)

    const deliver = async (subs: Sub[], p: Payload) => {
      let ok = 0
      const uniq = [...new Map(subs.map((s) => [s.endpoint, s])).values()]
      await Promise.all(uniq.map(async (s) => {
        if (s.platform === 'ios') {
          const r = await sendApns(s.endpoint, p)
          if (r === 'ok') ok++; else if (r === 'gone') await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          return
        }
        if (s.platform && s.platform !== 'web') return // Android: προστίθεται με το Firebase όταν μπει στο Play Store
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh!, auth: s.auth! } }, JSON.stringify(p), { TTL: 60 * 60 * 24 }); ok++ }
        catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint) }
      }))
      return { recipients: uniq.length, delivered: ok }
    }
    const log = (title: string, text: string, audience: string, r: { recipients: number; delivered: number }) =>
      db.from('push_log').insert({ sent_by: uid, title, body: text, audience, ...r })

    if (body.action === 'test') {
      const { data } = await db.from('push_subscriptions').select('endpoint, p256dh, auth, platform').eq('profile_id', uid)
      return json(await deliver(data || [], { title: 'Patras Schools Soccer', body: 'Οι ειδοποιήσεις λειτουργούν ✓', url: APP }))
    }

    if (body.action === 'send') {
      const title = String(body.title || '').slice(0, 120), text = String(body.body || '').slice(0, 400)
      const audience = ['parents', 'staff', 'all'].includes(body.audience) ? body.audience : 'parents'
      const team = body.team_id || null
      if (!title) return json({ error: 'Λείπει τίτλος' }, 400)
      if (!office) {
        if (role !== 'coach' || !team) return json({ error: 'Δεν επιτρέπεται' }, 403)
        const { data: ct } = await db.from('coach_teams').select('team_id').eq('profile_id', uid).eq('team_id', team)
        if (!ct?.length) return json({ error: 'Δεν επιτρέπεται' }, 403)
      }
      const { data: subs } = await db.rpc('push_targets_v2', { p_audience: audience, p_team: team, p_households: body.household_ids?.length && office ? body.household_ids : null })
      const r = await deliver((subs || []) as Sub[], { title, body: text, url: APP + (body.path || '#/'), tag: body.tag })
      await log(title, text, audience + (team ? ':' + team : ''), r)
      return json(r)
    }

    if (body.action === 'debts') {
      if (!office) return json({ error: 'Δεν επιτρέπεται' }, 403)
      const { data: bal } = await db.from('household_balances').select('household_id, balance').gt('balance', 0.004)
      const ids = (bal || []).map((b) => b.household_id)
      if (!ids.length) return json({ recipients: 0, delivered: 0 })
      const { data: subs } = await db.rpc('push_targets_v2', { p_audience: 'parents', p_team: null, p_households: ids })
      // Χωρίς ποσά στην ειδοποίηση (οδηγία Apple 4.5.4 – όχι ευαίσθητα στοιχεία στην οθόνη κλειδώματος)
      const r = await deliver((subs || []) as Sub[], { title: 'Ενημέρωση λογαριασμού', body: 'Υπάρχει ενημέρωση στα οικονομικά σας. Πατήστε για λεπτομέρειες.', url: APP + '#/', tag: 'account' })
      await log('Ενημέρωση λογαριασμού', '', 'debts', r)
      return json(r)
    }
    return json({ error: 'Άγνωστη ενέργεια' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
