// Patras Schools Soccer – ειδοποιήσεις push στο κινητό (Web Push / VAPID)
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const money = (n: number) => (Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const APP = 'https://vasileiostripolidis.github.io/omada-app/'

type Sub = { endpoint: string; p256dh: string; auth: string }

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

    // Κλειδιά VAPID: δημιουργούνται μία φορά και φυλάσσονται στη βάση (private schema)
    let { data: keys } = await db.rpc('push_keys')
    if (!keys?.public || !keys?.private) {
      const k = webpush.generateVAPIDKeys()
      await db.rpc('set_push_keys', { pub: k.publicKey, priv: k.privateKey })
      keys = (await db.rpc('push_keys')).data
    }
    if (body.action === 'public_key') return json({ key: keys.public })
    webpush.setVapidDetails('mailto:noreply@patrasschoolssoccer.gr', keys.public, keys.private)

    const deliver = async (subs: Sub[], payload: Record<string, unknown>) => {
      let ok = 0
      const uniq = [...new Map(subs.map((s) => [s.endpoint, s])).values()]
      await Promise.all(uniq.map(async (s) => {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 }); ok++ }
        catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint) }
      }))
      return { recipients: uniq.length, delivered: ok }
    }
    const log = (title: string, text: string, audience: string, r: { recipients: number; delivered: number }) =>
      db.from('push_log').insert({ sent_by: uid, title, body: text, audience, ...r })

    if (body.action === 'test') {
      const { data } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('profile_id', uid)
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
      const { data: subs } = await db.rpc('push_targets', { p_audience: audience, p_team: team, p_households: body.household_ids?.length && office ? body.household_ids : null })
      const r = await deliver((subs || []) as Sub[], { title, body: text, url: APP + (body.path || '#/'), tag: body.tag })
      await log(title, text, audience + (team ? ':' + team : ''), r)
      return json(r)
    }

    if (body.action === 'debts') {
      if (!office) return json({ error: 'Δεν επιτρέπεται' }, 403)
      const { data: bal } = await db.from('household_balances').select('household_id, balance').gt('balance', 0.004)
      let recipients = 0, delivered = 0
      for (const b of bal || []) {
        const { data: subs } = await db.rpc('push_targets', { p_audience: 'parents', p_team: null, p_households: [b.household_id] })
        if (!subs?.length) continue
        const r = await deliver(subs as Sub[], { title: 'Υπενθύμιση οφειλής', body: `Υπόλοιπο λογαριασμού: ${money(b.balance)}. Πατήστε για λεπτομέρειες.`, url: APP + '#/', tag: 'debt' })
        recipients += r.recipients; delivered += r.delivered
      }
      await log('Υπενθύμιση οφειλής', '', 'debts', { recipients, delivered })
      return json({ recipients, delivered })
    }
    return json({ error: 'Άγνωστη ενέργεια' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
