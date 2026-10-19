// Patras Schools Soccer – διαγραφή λογαριασμού από τον ίδιο τον χρήστη (απαίτηση App Store 5.1.1(v))
// Διαγράφεται ο λογαριασμός σύνδεσης και τα προσωπικά στοιχεία πρόσβασης. Τα στοιχεία του αθλητή/οικογένειας
// και τα οικονομικά παραμένουν στη γραμματεία (νομική υποχρέωση), αποσυνδεδεμένα από τον λογαριασμό.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Πεδία που δείχνουν στον χρήστη ως «δημιουργός» – μηδενίζονται ώστε να μείνει το ιστορικό
const REFS: [string, string][] = [
  ['guardians', 'profile_id'], ['staff', 'profile_id'], ['season_log', 'created_by'], ['player_metrics', 'recorded_by'], ['player_evaluations', 'coach_id'],
  ['registrations', 'handled_by'], ['player_goals', 'created_by'], ['goal_notes', 'created_by'], ['injuries', 'created_by'], ['drills', 'created_by'],
  ['announcements', 'author'], ['photos', 'uploaded_by'],
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
    const { data: u } = await user.auth.getUser()
    if (!u.user) return json({ error: 'Δεν είστε συνδεδεμένοι' }, 401)
    const uid = u.user.id
    const body = await req.json().catch(() => ({}))
    if (body.action !== 'delete') return json({ error: 'Άγνωστη ενέργεια' }, 400)

    const { data: me } = await db.from('profiles').select('role, email').eq('id', uid).single()
    if (me?.role === 'admin') {
      const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
      if ((count || 0) <= 1) return json({ error: 'Είστε ο μόνος διαχειριστής. Ορίστε πρώτα άλλον διαχειριστή από τις Ρυθμίσεις → Χρήστες.' }, 409)
    }
    for (const [t, c] of REFS) {
      const r = await db.from(t).update({ [c]: null }).eq(c, uid)
      if (r.error && !/does not exist|column/i.test(r.error.message)) return json({ error: `${t}: ${r.error.message}` }, 500)
    }
    await db.from('push_subscriptions').delete().eq('profile_id', uid)
    await db.from('coach_teams').delete().eq('profile_id', uid)
    const del = await db.auth.admin.deleteUser(uid)
    if (del.error) return json({ error: del.error.message }, 500)
    await db.from('audit_log').insert({ actor: null, actor_email: me?.email || null, tbl: 'profiles', op: 'DELETE', row_id: uid, old_data: { role: me?.role, email: me?.email, reason: 'Διαγραφή λογαριασμού από τον χρήστη' } })
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
