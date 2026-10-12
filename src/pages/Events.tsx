import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { sb, fullName, EVTYPE, type EventRow, type Team, type Player, type Stat } from '../lib/supabase'
import { useApp, Modal } from '../App'

export default function Events() {
  const { toast } = useApp()
  const [events, setEvents] = useState<EventRow[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [team, setTeam] = useState('')
  const [when, setWhen] = useState<'up' | 'past'>('up')
  const [edit, setEdit] = useState<Partial<EventRow> | null>(null)
  const [statsFor, setStatsFor] = useState<EventRow | null>(null)
  const [board, setBoard] = useState(false)

  const load = async () => {
    const [e, t] = await Promise.all([sb.from('events').select('*').order('starts_at'), sb.from('teams').select('*').order('name')])
    setEvents(e.data || []); setTeams(t.data || [])
  }
  useEffect(() => { load() }, [])

  const now = new Date().toISOString()
  let list = events.filter((e) => (!team || e.team_id === team) && (when === 'up' ? e.starts_at >= now : e.starts_at < now))
  if (when === 'past') list = [...list].reverse()
  const tName = (id: string | null) => teams.find((t) => t.id === id)?.name || ''

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    const { id, ...rest } = edit!
    const payload = { ...rest, starts_at: new Date(rest.starts_at as string).toISOString() }
    const r = id ? await sb.from('events').update(payload).eq('id', id) : await sb.from('events').insert(payload)
    if (r.error) return toast(r.error.message)
    setEdit(null); load(); toast('Αποθηκεύτηκε ✓')
  }
  const local = (iso?: string) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''

  return (
    <>
      <div className="row between"><h1>Αγώνες & Προπονήσεις</h1>
        <div className="row"><button className="btn ghost" onClick={() => setBoard(true)}>🏆 Κορυφαίοι</button>
          <button className="btn" onClick={() => setEdit({ type: 'match', home: true, team_id: team || teams[0]?.id })}><Plus size={18} />Νέο</button></div></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="tabs" style={{ margin: 0 }}><button className={'tab' + (when === 'up' ? ' on' : '')} onClick={() => setWhen('up')}>Επόμενα</button><button className={'tab' + (when === 'past' ? ' on' : '')} onClick={() => setWhen('past')}>Προηγούμενα</button></div>
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ width: 'auto' }}><option value="">Όλες οι ομάδες</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      <div className="card">
        {list.length ? <div className="list">{list.map((e) => (
          <div className="item" key={e.id}>
            <div style={{ textAlign: 'center', width: 52 }}><b style={{ fontSize: 20 }}>{new Date(e.starts_at).getDate()}</b><div className="muted">{new Date(e.starts_at).toLocaleDateString('el-GR', { month: 'short' })}</div></div>
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setEdit({ ...e, starts_at: local(e.starts_at) })}>
              <b>{EVTYPE[e.type]}{e.opponent ? ` vs ${e.opponent}` : ''}</b> {e.score_for != null && <span className="badge">{e.score_for}-{e.score_against}</span>}
              <div className="muted">{tName(e.team_id)} · {new Date(e.starts_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })} · {e.location || ''} {e.type === 'match' ? (e.home ? '(εντός)' : '(εκτός)') : ''}</div></div>
            <button className="btn ghost sm" onClick={() => setStatsFor(e)}>{e.type === 'match' ? 'Στατιστικά' : 'Παρουσίες'}</button>
          </div>))}</div> : <div className="empty">Τίποτα εδώ ακόμα</div>}
      </div>

      {edit && <Modal title={edit.id ? 'Επεξεργασία' : 'Νέο γεγονός'} onClose={() => setEdit(null)}>
        <form onSubmit={save}><div className="form">
          <label>Τύπος<select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{Object.entries(EVTYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Ομάδα<select required value={edit.team_id || ''} onChange={(e) => setEdit({ ...edit, team_id: e.target.value })}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Ημ/νία & ώρα<input type="datetime-local" required value={edit.starts_at || ''} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></label>
          <label>Γήπεδο<input value={edit.location || ''} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></label>
          {edit.type === 'match' && <>
            <label>Αντίπαλος<input value={edit.opponent || ''} onChange={(e) => setEdit({ ...edit, opponent: e.target.value })} /></label>
            <label>Έδρα<select value={edit.home ? '1' : '0'} onChange={(e) => setEdit({ ...edit, home: e.target.value === '1' })}><option value="1">Εντός</option><option value="0">Εκτός</option></select></label>
            <label>Γκολ μας<input type="number" value={edit.score_for ?? ''} onChange={(e) => setEdit({ ...edit, score_for: e.target.value === '' ? null : +e.target.value })} /></label>
            <label>Γκολ αντιπάλου<input type="number" value={edit.score_against ?? ''} onChange={(e) => setEdit({ ...edit, score_against: e.target.value === '' ? null : +e.target.value })} /></label>
          </>}
        </div>
          <label style={{ marginTop: 12 }}>Σημειώσεις<textarea rows={2} value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
          <div className="row" style={{ marginTop: 14 }}><button className="btn grow" style={{ justifyContent: 'center' }}>Αποθήκευση</button>
            {edit.id && <button type="button" className="btn danger" onClick={async () => { if (confirm('Διαγραφή;')) { await sb.from('events').delete().eq('id', edit.id); setEdit(null); load() } }}>Διαγραφή</button>}</div>
        </form></Modal>}
      {statsFor && <StatsModal ev={statsFor} onClose={() => setStatsFor(null)} />}
      {board && <Leaders teams={teams} onClose={() => setBoard(false)} />}
    </>
  )
}

function StatsModal({ ev, onClose }: { ev: EventRow; onClose: () => void }) {
  const { toast } = useApp()
  const [players, setPlayers] = useState<Player[]>([])
  const [rows, setRows] = useState<Record<string, Stat>>({})
  const match = ev.type === 'match'
  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([sb.from('players').select('*').eq('team_id', ev.team_id).eq('active', true).order('last_name'), sb.from('player_stats').select('*').eq('event_id', ev.id)])
      setPlayers(p.data || [])
      const ex = Object.fromEntries((s.data || []).map((x) => [x.player_id, x]))
      setRows(Object.fromEntries((p.data || []).map((pl) => [pl.id, ex[pl.id] || { event_id: ev.id, player_id: pl.id, present: !ex.length, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, rating: null }])))
    })()
  }, [ev])
  const upd = (pid: string, k: keyof Stat, v: number | boolean) => setRows({ ...rows, [pid]: { ...rows[pid], [k]: v } })
  async function save() {
    const r = await sb.from('player_stats').upsert(Object.values(rows))
    if (r.error) return toast(r.error.message)
    toast('Αποθηκεύτηκε ✓'); onClose()
  }
  const N = (pid: string, k: keyof Stat) => <td><input className="num" type="number" min={0} value={Number(rows[pid]?.[k] ?? 0)} onChange={(e) => upd(pid, k, +e.target.value)} /></td>
  return <Modal title={`${EVTYPE[ev.type]} ${ev.opponent ? 'vs ' + ev.opponent : ''} – ${new Date(ev.starts_at).toLocaleDateString('el-GR')}`} onClose={onClose}>
    <div className="scroll"><table><thead><tr><th>Παίκτης</th><th>Παρών</th>{match && <><th>Λεπτά</th><th>Γκολ</th><th>Ασίστ</th><th>🟨</th><th>🟥</th></>}</tr></thead><tbody>
      {players.map((p) => <tr key={p.id}><td>{fullName(p)}</td><td><input type="checkbox" style={{ width: 22, height: 22 }} checked={!!rows[p.id]?.present} onChange={(e) => upd(p.id, 'present', e.target.checked)} /></td>
        {match && <>{N(p.id, 'minutes')}{N(p.id, 'goals')}{N(p.id, 'assists')}{N(p.id, 'yellow')}{N(p.id, 'red')}</>}</tr>)}
    </tbody></table></div>
    {!players.length && <div className="empty">Η ομάδα δεν έχει παίκτες</div>}
    <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={save}>Αποθήκευση</button>
  </Modal>
}

function Leaders({ teams, onClose }: { teams: Team[]; onClose: () => void }) {
  const [team, setTeam] = useState('')
  const [rows, setRows] = useState<{ p: Player; goals: number; assists: number; apps: number; att: number; tot: number }[]>([])
  useEffect(() => {
    (async () => {
      const { data } = await sb.from('player_stats').select('*, players(*), events(type, team_id)')
      const m = new Map<string, { p: Player; goals: number; assists: number; apps: number; att: number; tot: number }>()
      for (const r of (data || []) as (Stat & { players: Player; events: { type: string; team_id: string } })[]) {
        if (team && r.events.team_id !== team) continue
        const x = m.get(r.player_id) || { p: r.players, goals: 0, assists: 0, apps: 0, att: 0, tot: 0 }
        x.tot++; if (r.present) x.att++
        if (r.events.type === 'match' && r.present) { x.apps++; x.goals += r.goals; x.assists += r.assists }
        m.set(r.player_id, x)
      }
      setRows([...m.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists))
    })()
  }, [team])
  return <Modal title="🏆 Κορυφαίοι" onClose={onClose}>
    <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ marginBottom: 10 }}><option value="">Όλες οι ομάδες</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
    <div className="scroll"><table><thead><tr><th>#</th><th>Παίκτης</th><th>Γκολ</th><th>Ασίστ</th><th>Συμμ.</th><th>Παρουσία</th></tr></thead><tbody>
      {rows.map((r, i) => <tr key={r.p.id}><td>{i + 1}</td><td>{fullName(r.p)}</td><td><b>{r.goals}</b></td><td>{r.assists}</td><td>{r.apps}</td><td>{r.tot ? Math.round((r.att / r.tot) * 100) : 0}%</td></tr>)}
    </tbody></table></div>
    {!rows.length && <div className="empty">Δεν υπάρχουν στατιστικά ακόμα</div>}
  </Modal>
}
