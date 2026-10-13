import { useEffect, useState } from 'react'
import { ShieldCheck, Download, CalendarRange, ArrowRight, KeyRound, History } from 'lucide-react'
import { sb, dt, type Player } from '../lib/supabase'
import { useApp, Modal } from '../ui'

function saveJson(obj: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// ===== Αλλαγή σεζόν =====
export function SeasonRollover() {
  const { settings, teams, toast, reloadSettings, reloadTeams } = useApp()
  const [open, setOpen] = useState(false)
  const cur = settings?.current_season || ''
  const nextLabel = (() => { const y = Number(cur.slice(0, 4)) || new Date().getFullYear(); return `${y + 1}-${String((y + 2) % 100).padStart(2, '0')}` })()
  const [to, setTo] = useState(nextLabel)
  const [mode, setMode] = useState<'next' | 'birth'>('next')
  const [map, setMap] = useState<Record<string, string>>({})
  const [shift, setShift] = useState(true)
  const [players, setPlayers] = useState<Player[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setTo(nextLabel); setMap(Object.fromEntries(teams.map((t) => [t.id, t.next_team_id || t.id]))); sb.from('players').select('*').eq('active', true).then(({ data }) => setPlayers(data || [])) } }, [open])
  const hasRanges = teams.some((t) => t.birth_year_from && t.birth_year_to)
  const target = (p: Player): string | null | 'out' => {
    if (mode === 'birth' && p.birth_date) { const y = new Date(p.birth_date).getFullYear(); const t = teams.find((x) => x.birth_year_from && x.birth_year_to && y >= x.birth_year_from - (shift ? 1 : 0) && y <= x.birth_year_to - (shift ? 1 : 0)); return t ? t.id : p.team_id }
    if (!p.team_id) return null
    const m = map[p.team_id]; return m === 'out' ? 'out' : m || p.team_id
  }
  const moves = players.map((p) => ({ p, to: target(p) })).filter((x) => x.to !== x.p.team_id)
  async function apply() {
    if (!confirm(`Αλλαγή σεζόν ${cur} → ${to}: ${moves.length} αλλαγές αθλητών. Συνέχεια;`)) return
    setBusy(true)
    for (const m of moves) await sb.from('players').update(m.to === 'out' ? { active: false } : { team_id: m.to }).eq('id', m.p.id)
    for (const t of teams) await sb.from('teams').update({ season: to, ...(shift && t.birth_year_from ? { birth_year_from: t.birth_year_from + 1, birth_year_to: (t.birth_year_to || t.birth_year_from) + 1 } : {}) }).eq('id', t.id)
    await sb.from('club_settings').update({ current_season: to }).eq('id', 1)
    await sb.from('season_log').insert({ season_from: cur, season_to: to, moved: moves.length, details: moves.map((m) => ({ player: m.p.id, from: m.p.team_id, to: m.to })) })
    setBusy(false); setOpen(false); reloadSettings(); reloadTeams(); toast(`Η σεζόν ${to} ξεκίνησε ✓`)
  }
  return <div className="card row">
    <CalendarRange size={22} color="var(--red)" /><div className="grow"><b>Σεζόν {cur}</b><div className="muted">Κλείσιμο σεζόν και μεταφορά αθλητών στην επόμενη ηλικιακή κατηγορία. Τα στατιστικά, οι μετρήσεις και τα οικονομικά της σεζόν μένουν στο ιστορικό.</div></div>
    <button className="btn" onClick={() => setOpen(true)}>Αλλαγή σεζόν</button>
    {open && <Modal wide title={`Αλλαγή σεζόν ${cur} → ${to}`} onClose={() => setOpen(false)} foot={<><span className="muted grow">{moves.length} αλλαγές</span><button className="btn ghost" onClick={() => setOpen(false)}>Άκυρο</button><button className="btn red" disabled={busy} onClick={apply}>{busy ? '…' : 'Εφαρμογή'}</button></>}>
      <div className="stack">
        <div className="form"><label className="f">Νέα σεζόν<input value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="f">Τρόπος μεταφοράς<select value={mode} onChange={(e) => setMode(e.target.value as 'next' | 'birth')}><option value="next">Κάθε ομάδα → επόμενη ομάδα</option>{hasRanges && <option value="birth">Με βάση το έτος γέννησης</option>}</select></label></div>
        {mode === 'next' && <div className="card flush"><table><thead><tr><th>Ομάδα</th><th></th><th>Τη νέα σεζόν οι αθλητές πάνε</th><th className="r">Αθλητές</th></tr></thead><tbody>
          {teams.map((t) => <tr key={t.id}><td><b>{t.name}</b></td><td><ArrowRight size={15} /></td>
            <td><select value={map[t.id] || t.id} onChange={(e) => setMap({ ...map, [t.id]: e.target.value })}><option value={t.id}>Παραμένουν στην ίδια</option>{teams.filter((x) => x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}<option value="out">Αποχωρούν (ανενεργοί)</option></select></td>
            <td className="r num">{players.filter((p) => p.team_id === t.id).length}</td></tr>)}</tbody></table></div>}
        {hasRanges && <label className="check"><input type="checkbox" checked={shift} onChange={(e) => setShift(e.target.checked)} />Μετατόπιση ετών γέννησης των ομάδων κατά +1 (π.χ. 2014-15 → 2015-16)</label>}
        {moves.length > 0 && <details><summary className="muted" style={{ cursor: 'pointer' }}>Προεπισκόπηση αλλαγών ({moves.length})</summary>
          <div className="list">{moves.slice(0, 200).map((m) => <div key={m.p.id} className="item" style={{ padding: '6px 0' }}><span className="grow">{m.p.last_name} {m.p.first_name}</span><span className="muted">{teams.find((t) => t.id === m.p.team_id)?.name || '—'} → {m.to === 'out' ? 'Αποχώρηση' : teams.find((t) => t.id === m.to)?.name}</span></div>)}</div></details>}
        <div className="note">Πριν την αλλαγή σεζόν δημιουργείται αυτόματα αντίγραφο ασφαλείας κάθε Κυριακή — μπορείς να κατεβάσεις ένα και τώρα από την ενότητα «Αντίγραφα ασφαλείας».</div>
      </div></Modal>}
  </div>
}

// ===== Σύνδεση 2 βημάτων (TOTP) =====
export function TwoFactor() {
  const { toast } = useApp()
  const [factors, setFactors] = useState<{ id: string; status: string; friendly_name?: string; created_at: string }[]>([])
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const load = () => sb.auth.mfa.listFactors().then(({ data }) => setFactors((data?.totp || []) as never))
  useEffect(() => { load() }, [])
  async function start() {
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'PSS ' + new Date().toLocaleDateString('el-GR') })
    if (error) return toast(error.message)
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }
  async function verify() {
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: enroll!.id, code })
    if (error) return toast('Λάθος κωδικός, δοκίμασε ξανά')
    toast('Η σύνδεση 2 βημάτων ενεργοποιήθηκε ✓'); setEnroll(null); setCode(''); load()
  }
  async function remove(id: string) { if (!confirm('Απενεργοποίηση σύνδεσης 2 βημάτων;')) return; const { error } = await sb.auth.mfa.unenroll({ factorId: id }); if (error) toast(error.message); load() }
  const active = factors.filter((f) => f.status === 'verified')
  return <div className="card">
    <div className="row"><ShieldCheck size={22} color={active.length ? 'var(--ok)' : 'var(--muted)'} /><div className="grow"><b>Σύνδεση 2 βημάτων</b><div className="muted">Εκτός από τον κωδικό, ζητείται 6ψήφιος κωδικός από εφαρμογή στο κινητό (Google Authenticator, Microsoft Authenticator). Συνιστάται για διαχειριστή και γραμματεία.</div></div>
      {active.length ? <span className="badge b-ok">Ενεργή</span> : <button className="btn" onClick={start}><KeyRound size={15} />Ενεργοποίηση</button>}</div>
    {active.map((f) => <div key={f.id} className="row" style={{ marginTop: 8 }}><span className="muted grow">{f.friendly_name || 'Authenticator'} · από {dt(f.created_at)}</span><button className="btn danger sm" onClick={() => remove(f.id)}>Απενεργοποίηση</button></div>)}
    {enroll && <Modal title="Ενεργοποίηση σύνδεσης 2 βημάτων" onClose={() => setEnroll(null)} foot={<button className="btn red" onClick={verify} disabled={code.length !== 6}>Επιβεβαίωση</button>}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div>1. Σκάναρε τον κωδικό QR με την εφαρμογή Authenticator του κινητού.</div>
        <img src={enroll.qr} alt="QR" style={{ width: 200, height: 200, background: '#fff', padding: 8, borderRadius: 10 }} />
        <div className="muted">ή πληκτρολόγησε: <code>{enroll.secret}</code></div>
        <div>2. Γράψε τον 6ψήφιο κωδικό που εμφανίζεται:</div>
        <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 180, textAlign: 'center', fontSize: 24, letterSpacing: 6 }} />
      </div></Modal>}
  </div>
}

// ===== Αντίγραφα ασφαλείας =====
export function Backups() {
  const { toast } = useApp()
  const [list, setList] = useState<{ slot: number; created_at: string }[]>([])
  const [busy, setBusy] = useState(false)
  const load = () => sb.from('backups').select('slot, created_at').order('created_at', { ascending: false }).then(({ data }) => setList(data || []))
  useEffect(() => { load() }, [])
  async function now() { setBusy(true); const r = await sb.rpc('make_backup'); setBusy(false); if (r.error) return toast(r.error.message); toast('Δημιουργήθηκε αντίγραφο ✓'); load() }
  async function dl(slot: number, at: string) { const { data } = await sb.from('backups').select('data').eq('slot', slot).single(); if (data) saveJson(data.data, `PSS_backup_${at.slice(0, 10)}.json`) }
  return <div className="card">
    <div className="row"><Download size={22} color="var(--navy)" /><div className="grow"><b>Αντίγραφα ασφαλείας</b><div className="muted">Αυτόματο αντίγραφο όλων των δεδομένων κάθε Κυριακή (κρατούνται οι 8 τελευταίες εβδομάδες). Κατέβασε και φύλαξε ένα σε υπολογιστή/USB κάθε μήνα.</div></div>
      <button className="btn ghost" disabled={busy} onClick={now}>{busy ? '…' : 'Αντίγραφο τώρα'}</button></div>
    <div className="list" style={{ marginTop: 8 }}>{list.map((b) => <div key={b.slot} className="item" style={{ padding: '8px 0' }}><span className="grow">{new Date(b.created_at).toLocaleString('el-GR')}</span><button className="btn ghost sm" onClick={() => dl(b.slot, b.created_at)}><Download size={14} />Λήψη</button></div>)}</div>
  </div>
}

export async function exportPlayerData(pid: string, name: string) {
  const { data, error } = await sb.rpc('player_data_export', { pid })
  if (error) throw error
  saveJson(data, `GDPR_${name}.json`)
}

// ===== Ιστορικό αλλαγών =====
const TBL: Record<string, string> = { households: 'Οικογένεια', guardians: 'Γονέας', player_households: 'Σύνδεση παιδιού-οικογένειας', players: 'Αθλητής', charges: 'Χρέωση', payments: 'Πληρωμή', recurring_fees: 'Πάγια χρέωση', club_settings: 'Ρυθμίσεις', profiles: 'Χρήστης', teams: 'Ομάδα', coach_teams: 'Ανάθεση ομάδας', consents: 'Συγκατάθεση', guardian_invites: 'Πρόσκληση γονέα' }
const OP: Record<string, [string, string]> = { INSERT: ['Δημιουργία', 'b-ok'], UPDATE: ['Αλλαγή', 'b-info'], DELETE: ['Διαγραφή', 'b-bad'] }
const LABEL: Record<string, string> = { amount: 'Ποσό', description: 'Περιγραφή', first_name: 'Όνομα', last_name: 'Επώνυμο', email: 'Email', phone: 'Τηλέφωνο', name: 'Όνομα', team_id: 'Ομάδα', active: 'Ενεργός', discount_pct: 'Έκπτωση %', monthly_override: 'Ειδική τιμή', share_pct: 'Ποσοστό', role: 'Ρόλος', method: 'Τρόπος', paid_at: 'Ημ/νία πληρωμής', due_date: 'Λήξη', medical_expiry: 'Ιατρική έως', discount_category: 'Κατηγορία έκπτωσης', kind: 'Είδος', granted: 'Συγκατάθεση', household_id: 'Οικογένεια' }
type Audit = { id: number; at: string; actor_email: string | null; tbl: string; op: string; row_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null }
const show = (v: unknown) => v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Ναι' : 'Όχι') : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60)
const summary = (a: Audit) => {
  const d = a.new_data || a.old_data || {}
  const who = [d.first_name, d.last_name].filter(Boolean).join(' ') || (d.name as string) || (d.description as string) || ''
  if (a.op === 'UPDATE') return Object.keys(a.new_data || {}).filter((k) => !['id', 'breakdown'].includes(k)).slice(0, 4).map((k) => `${LABEL[k] || k}: ${show(a.old_data?.[k])} → ${show(a.new_data?.[k])}`).join(' · ')
  return [who, d.amount != null ? Number(d.amount).toFixed(2) + ' €' : ''].filter(Boolean).join(' · ')
}
export function AuditLog() {
  const [rows, setRows] = useState<Audit[]>([])
  const [tbl, setTbl] = useState('')
  const [who, setWho] = useState('')
  const [limit, setLimit] = useState(100)
  useEffect(() => {
    let q = sb.from('audit_log').select('*').order('at', { ascending: false }).limit(limit)
    if (tbl) q = q.eq('tbl', tbl)
    if (who === 'system') q = q.is('actor', null); else if (who) q = q.eq('actor_email', who)
    q.then(({ data }) => setRows((data || []) as Audit[]))
  }, [tbl, who, limit])
  const people = [...new Set(rows.map((r) => r.actor_email).filter(Boolean))] as string[]
  return <div className="card flush" style={{ marginTop: 14 }}>
    <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}><h2><History size={17} style={{ verticalAlign: -3 }} /> Ιστορικό αλλαγών</h2>
      <div className="row"><select value={tbl} onChange={(e) => setTbl(e.target.value)} style={{ width: 'auto' }}><option value="">Όλα</option>{Object.entries(TBL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={who} onChange={(e) => setWho(e.target.value)} style={{ width: 'auto' }}><option value="">Όλοι οι χρήστες</option><option value="system">Αυτόματα (σύστημα)</option>{people.map((p) => <option key={p}>{p}</option>)}</select></div></div>
    {rows.length ? <div className="scroll"><table><thead><tr><th>Πότε</th><th>Ποιος</th><th>Τι</th><th>Λεπτομέρειες</th></tr></thead><tbody>
      {rows.map((a) => <tr key={a.id}><td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(a.at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{a.actor_email || <span className="muted">Σύστημα</span>}</td>
        <td style={{ whiteSpace: 'nowrap' }}><span className={'badge ' + (OP[a.op]?.[1] || '')}>{OP[a.op]?.[0] || a.op}</span> {TBL[a.tbl] || a.tbl}</td>
        <td style={{ fontSize: 13 }}>{summary(a)}</td></tr>)}
    </tbody></table></div> : <div className="empty">Δεν υπάρχουν καταγραφές ακόμα</div>}
    {rows.length >= limit && <div className="item"><button className="btn ghost sm" onClick={() => setLimit(limit + 200)}>Περισσότερα</button></div>}
    <div className="item muted">Καταγράφεται αυτόματα κάθε δημιουργία, αλλαγή και διαγραφή σε αθλητές, οικογένειες, γονείς, χρεώσεις, πληρωμές, ρυθμίσεις, ρόλους χρηστών και συγκαταθέσεις. Δεν μπορεί να τροποποιηθεί από κανέναν.</div>
  </div>
}
