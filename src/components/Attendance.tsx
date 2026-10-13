import { useEffect, useState } from 'react'
import { ShieldAlert, WifiOff, Star } from 'lucide-react'
import { sb, fullName, EVTYPE, eligibility, openInjuries, type EventRow, type Player, type Stat } from '../lib/supabase'
import { cacheGet, cacheSet, queueStats } from '../lib/offline'
import { useApp, Modal } from '../ui'

const POS = ['ΤΦ', 'ΑΜ', 'ΜΕ', 'ΕΠ']
// Παρουσιολόγιο (προπόνηση: παρουσία + RPE) / φύλλο αγώνα (βασικοί, θέση, λεπτά, γκολ, κάρτες). Δουλεύει και χωρίς σήμα.
export default function Attendance({ ev, onClose }: { ev: EventRow; onClose: () => void }) {
  const { toast } = useApp()
  const [players, setPlayers] = useState<Player[]>([])
  const [rows, setRows] = useState<Record<string, Stat>>({})
  const [inj, setInj] = useState<Set<string>>(new Set())
  const [offline, setOffline] = useState(!navigator.onLine)
  const match = ev.type === 'match'
  const dur = ev.end_at ? Math.round((new Date(ev.end_at).getTime() - new Date(ev.starts_at).getTime()) / 6e4) : match ? 70 : 90
  useEffect(() => {
    (async () => {
      try {
        if (!navigator.onLine) throw new Error('offline')
        const [p, s, i] = await Promise.all([sb.from('players').select('*').eq('team_id', ev.team_id).eq('active', true).order('last_name'), sb.from('player_stats').select('*').eq('event_id', ev.id), openInjuries()])
        if (p.error) throw p.error
        const ex = Object.fromEntries((s.data || []).map((x) => [x.player_id, x]))
        const r = Object.fromEntries((p.data || []).map((pl) => [pl.id, ex[pl.id] || { event_id: ev.id, player_id: pl.id, present: !i.has(pl.id), minutes: match ? 0 : dur, goals: 0, assists: 0, yellow: 0, red: 0, rating: null, rpe: null, starter: false, position: null }]))
        setPlayers(p.data || []); setRows(r); setInj(i)
        cacheSet('att_' + ev.id, { players: p.data, rows: r, inj: [...i] })
      } catch {
        const c = cacheGet<{ players: Player[]; rows: Record<string, Stat>; inj: string[] }>('att_' + ev.id) || cacheGet<{ players: Player[]; rows: Record<string, Stat>; inj: string[] }>('team_' + ev.team_id)
        setOffline(true)
        if (c) { setPlayers(c.players); setInj(new Set(c.inj)); setRows(Object.fromEntries(c.players.map((pl) => [pl.id, c.rows[pl.id] ? { ...c.rows[pl.id], event_id: ev.id } : { event_id: ev.id, player_id: pl.id, present: true, minutes: match ? 0 : dur, goals: 0, assists: 0, yellow: 0, red: 0, rating: null }]))) }
      }
    })()
  }, [ev])
  useEffect(() => { if (players.length) cacheSet('team_' + ev.team_id, { players, rows, inj: [...inj] }) }, [players])
  const upd = (pid: string, patch: Partial<Stat>) => setRows({ ...rows, [pid]: { ...rows[pid], ...patch } })
  async function save() {
    const data = Object.values(rows)
    if (!navigator.onLine) { queueStats(data as never); toast('Χωρίς σύνδεση – αποθηκεύτηκε στη συσκευή και θα συγχρονιστεί αυτόματα'); return onClose() }
    const r = await sb.from('player_stats').upsert(data)
    if (r.error) { queueStats(data as never); toast('Δεν συνδέθηκε – θα συγχρονιστεί αυτόματα'); return onClose() }
    toast('Αποθηκεύτηκε ✓'); onClose()
  }
  const N = (pid: string, k: keyof Stat, w = 56) => <td><input className="cell" style={{ width: w }} type="number" min={0} value={Number(rows[pid]?.[k] ?? 0)} onChange={(e) => upd(pid, { [k]: +e.target.value })} /></td>
  const present = Object.values(rows).filter((r) => r.present).length, starters = Object.values(rows).filter((r) => r.starter).length
  return <Modal wide title={`${match ? 'Φύλλο αγώνα' : 'Παρουσιολόγιο'} · ${EVTYPE[ev.type]}${ev.opponent ? ' vs ' + ev.opponent : ''} · ${new Date(ev.starts_at).toLocaleDateString('el-GR')}`} onClose={onClose}
    foot={<><span className="muted grow">Παρόντες <b>{present}</b>/{players.length}{match && <> · Βασικοί <b>{starters}</b></>}</span>
      <button className="btn ghost sm" onClick={() => setRows(Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, { ...r, present: !inj.has(k) }])))}>Όλοι παρόντες</button>
      <button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    {offline && <div className="note warn row" style={{ marginBottom: 10 }}><WifiOff size={16} />Χωρίς σύνδεση: δουλεύεις με το αποθηκευμένο ρόστερ· οι αλλαγές θα σταλούν μόλις επανέλθει το σήμα.</div>}
    {!match && <div className="muted" style={{ marginBottom: 8 }}>RPE = πόσο κουραστική ήταν η προπόνηση για τον αθλητή (1 πολύ εύκολη – 10 εξαντλητική). Χρησιμοποιείται για τον υπολογισμό φόρτου.</div>}
    <div className="scroll"><table className="entry"><thead><tr><th className="sticky">Παίκτης</th><th>Παρών</th>
      {match ? <><th>Βασικός</th><th>Θέση</th><th>Λεπτά</th><th>Γκολ</th><th>Ασίστ</th><th>Κίτρ.</th><th>Κόκκ.</th></> : <><th>Λεπτά</th><th>RPE</th></>}</tr></thead><tbody>
      {players.map((p) => { const el = eligibility(p, inj.has(p.id)); const r = rows[p.id]; return <tr key={p.id} style={!r?.present ? { opacity: .55 } : undefined}>
        <td className="sticky"><b>{fullName(p)}</b>{p.jersey_number != null && <span className="muted"> #{p.jersey_number}</span>}{!el.ok && <div><span className="badge b-bad"><ShieldAlert size={11} />{el.issues[0]}</span></div>}</td>
        <td><input type="checkbox" style={{ width: 22, height: 22 }} checked={!!r?.present} onChange={(e) => upd(p.id, { present: e.target.checked })} /></td>
        {match ? <>
          <td><button className={'pill' + (r?.starter ? ' on' : '')} style={{ padding: '5px 9px' }} disabled={!el.ok && !r?.starter} onClick={() => upd(p.id, { starter: !r?.starter, present: true, minutes: !r?.starter && !r?.minutes ? dur : r?.minutes })}><Star size={13} /></button></td>
          <td><select style={{ width: 70, padding: 6 }} value={r?.position || ''} onChange={(e) => upd(p.id, { position: e.target.value || null })}><option value="">—</option>{POS.map((x) => <option key={x}>{x}</option>)}</select></td>
          {N(p.id, 'minutes')}{N(p.id, 'goals', 48)}{N(p.id, 'assists', 48)}{N(p.id, 'yellow', 44)}{N(p.id, 'red', 44)}
        </> : <>{N(p.id, 'minutes')}
          <td><select style={{ width: 72, padding: 6 }} value={r?.rpe ?? ''} onChange={(e) => upd(p.id, { rpe: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{Array.from({ length: 10 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></td></>}
      </tr> })}
    </tbody></table></div>
    {!players.length && <div className="empty">Η ομάδα δεν έχει αθλητές</div>}
  </Modal>
}
