import { useEffect, useState } from 'react'
import { Plus, CalendarPlus, Trash2, ClipboardList, Megaphone, AlertTriangle, ListChecks } from 'lucide-react'
import { sb, fullName, EVTYPE, WEEKDAYS, fieldConflicts, type EventRow, type Team, type Player, type Stat, type Slot, type Field } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty, TeamChip } from '../ui'
import Attendance from '../components/Attendance'
import SessionPlan from '../components/SessionPlan'
import Urgent from '../components/Urgent'
import Fields from '../components/Fields'
import { PlayingTime, Standings } from '../components/MatchCenter'

type View = 'list' | 'week' | 'fields' | 'time' | 'table'
export default function Events() {
  const { toast, teams: allTeams, myTeams, isCoach } = useApp()
  const teams = isCoach ? allTeams.filter((t) => myTeams.includes(t.id)) : allTeams
  const [events, setEvents] = useState<EventRow[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [team, setTeam] = useState('')
  const [view, setView] = useState<View>('list')
  const [when, setWhen] = useState<'up' | 'past'>('up')
  const [edit, setEdit] = useState<(Partial<EventRow> & { dur?: number }) | null>(null)
  const [statsFor, setStatsFor] = useState<EventRow | null>(null)
  const [planFor, setPlanFor] = useState<EventRow | null>(null)
  const [urgent, setUrgent] = useState<EventRow | null>(null)
  const [board, setBoard] = useState(false)
  const [conf, setConf] = useState<EventRow[]>([])
  const [plans, setPlans] = useState<Set<string>>(new Set())

  const load = async () => {
    const [e, f, d] = await Promise.all([sb.from('events').select('*').order('starts_at'), sb.from('fields').select('*').eq('active', true).order('name'), sb.from('event_drills').select('event_id')])
    setEvents(e.data || []); setFields(f.data || []); setPlans(new Set((d.data || []).map((x) => x.event_id)))
  }
  useEffect(() => { load() }, [])

  const now = new Date(Date.now() - 3 * 3600e3).toISOString()
  let list = events.filter((e) => (!team || e.team_id === team) && (when === 'up' ? e.starts_at >= now : e.starts_at < now))
  if (when === 'past') list = [...list].reverse()
  const local = (iso?: string | null) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''
  const durOf = (e: Partial<EventRow>) => e.end_at && e.starts_at ? Math.round((new Date(e.end_at).getTime() - new Date(e.starts_at).getTime()) / 6e4) : e.type === 'match' ? 90 : 90

  useEffect(() => {
    if (!edit?.field_id || !edit.starts_at) { setConf([]); return }
    const s = new Date(edit.starts_at).toISOString(), e = new Date(new Date(edit.starts_at).getTime() + (edit.dur || 90) * 6e4).toISOString()
    fieldConflicts(edit.field_id, s, e, edit.id).then(setConf)
  }, [edit?.field_id, edit?.starts_at, edit?.dur])

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    const { id, dur, ...rest } = edit!
    const start = new Date(rest.starts_at as string)
    const fld = fields.find((f) => f.id === rest.field_id)
    const payload = { ...rest, starts_at: start.toISOString(), end_at: new Date(start.getTime() + (dur || 90) * 6e4).toISOString(), location: rest.location || fld?.name || null }
    const r = id ? await sb.from('events').update(payload).eq('id', id) : await sb.from('events').insert(payload)
    if (r.error) return toast(r.error.message)
    setEdit(null); load(); toast('Αποθηκεύτηκε ✓')
  }
  const V = (k: View, l: string) => <button className={'tab' + (view === k ? ' on' : '')} onClick={() => setView(k)}>{l}</button>
  return (
    <>
      <PageHead eyebrow="Αγωνιστικά" title="Πρόγραμμα & Παρουσίες" sub="Προπονήσεις, αγώνες, παρουσιολόγιο, πλάνα προπόνησης και γήπεδα.">
        <button className="btn ghost" onClick={() => setBoard(true)}>Κορυφαίοι</button>
        <button className="btn red" onClick={() => setEdit({ type: 'training', home: true, team_id: team || teams[0]?.id, dur: 90 })}><Plus size={18} />Νέο</button></PageHead>
      <div className="tabs">{V('list', 'Πρόγραμμα')}{V('week', 'Εβδομαδιαίο πρόγραμμα')}{V('fields', 'Γήπεδα')}{V('time', 'Χρόνος συμμετοχής')}{V('table', 'Βαθμολογία')}</div>
      {view === 'week' && <WeeklySchedule teams={teams} fields={fields} onGenerated={load} />}
      {view === 'fields' && <Fields teams={allTeams} />}
      {view === 'time' && <PlayingTime teams={teams} />}
      {view === 'table' && <Standings teams={teams} />}
      {view === 'list' && <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="pills"><button className={'pill' + (when === 'up' ? ' on' : '')} onClick={() => setWhen('up')}>Επόμενα</button><button className={'pill' + (when === 'past' ? ' on' : '')} onClick={() => setWhen('past')}>Προηγούμενα</button></div>
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ width: 'auto' }}><option value="">Όλες οι ομάδες</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      <div className="card flush">
        {list.length ? <div className="list">{list.map((e) => (
          <div className="item" key={e.id} style={{ flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', width: 52 }}><b className="head" style={{ fontSize: 24 }}>{new Date(e.starts_at).getDate()}</b><div className="muted">{new Date(e.starts_at).toLocaleDateString('el-GR', { month: 'short' })}</div></div>
            <div className="grow" style={{ cursor: 'pointer', minWidth: 200 }} onClick={() => setEdit({ ...e, starts_at: local(e.starts_at), dur: durOf(e) })}>
              <b>{EVTYPE[e.type]}{e.opponent ? ` vs ${e.opponent}` : ''}</b> {e.score_for != null && <span className="badge">{e.score_for}-{e.score_against}</span>}
              <div className="muted"><TeamChip team={teams.find((t) => t.id === e.team_id)} /> · {new Date(e.starts_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}{e.end_at ? `–${new Date(e.end_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}` : ''} · {fields.find((f) => f.id === e.field_id)?.name || e.location || ''} {e.type === 'match' ? (e.home ? '(εντός)' : '(εκτός)') : ''}</div>
              {e.objective && <div className="muted">Στόχος: {e.objective}</div>}</div>
            <div className="row">
              {e.type !== 'match' && <button className={'btn ghost sm'} onClick={() => setPlanFor(e)}><ListChecks size={14} />{plans.has(e.id) ? 'Πλάνο ✓' : 'Πλάνο'}</button>}
              <button className="iconbtn" title="Επείγουσα ειδοποίηση" onClick={() => setUrgent(e)}><Megaphone size={15} /></button>
              <button className={'btn sm ' + (e.type === 'match' ? 'ghost' : '')} onClick={() => setStatsFor(e)}><ClipboardList size={14} />{e.type === 'match' ? 'Φύλλο αγώνα' : 'Παρουσίες'}</button></div>
          </div>))}</div> : <Empty title="Τίποτα εδώ ακόμα" text="Πρόσθεσε αγώνα ή προπόνηση, ή δημιούργησε τις προπονήσεις του μήνα από το εβδομαδιαίο πρόγραμμα." />}
      </div></>}

      {edit && <Modal title={edit.id ? 'Επεξεργασία' : 'Νέο γεγονός'} onClose={() => setEdit(null)}>
        <form onSubmit={save}><div className="form">
          <label className="f">Τύπος<select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{Object.entries(EVTYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="f">Ομάδα<select required value={edit.team_id || ''} onChange={(e) => setEdit({ ...edit, team_id: e.target.value })}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="f">Ημ/νία & ώρα<input type="datetime-local" required value={edit.starts_at || ''} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></label>
          <label className="f">Διάρκεια (λεπτά)<input type="number" value={edit.dur ?? 90} onChange={(e) => setEdit({ ...edit, dur: +e.target.value })} /></label>
          <label className="f">Γήπεδο<select value={edit.field_id || ''} onChange={(e) => setEdit({ ...edit, field_id: e.target.value || null })}><option value="">— άλλο / εκτός —</option>{fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          {!edit.field_id && <label className="f">Τοποθεσία<input value={edit.location || ''} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></label>}
          {edit.type === 'match' && <>
            <label className="f">Αντίπαλος<input value={edit.opponent || ''} onChange={(e) => setEdit({ ...edit, opponent: e.target.value })} /></label>
            <label className="f">Έδρα<select value={edit.home ? '1' : '0'} onChange={(e) => setEdit({ ...edit, home: e.target.value === '1' })}><option value="1">Εντός</option><option value="0">Εκτός</option></select></label>
            <label className="f">Γκολ μας<input type="number" value={edit.score_for ?? ''} onChange={(e) => setEdit({ ...edit, score_for: e.target.value === '' ? null : +e.target.value })} /></label>
            <label className="f">Γκολ αντιπάλου<input type="number" value={edit.score_against ?? ''} onChange={(e) => setEdit({ ...edit, score_against: e.target.value === '' ? null : +e.target.value })} /></label>
          </>}
          {edit.type !== 'match' && <label className="f full">Στόχος προπόνησης<input value={edit.objective || ''} onChange={(e) => setEdit({ ...edit, objective: e.target.value })} /></label>}
          <label className="f full">Σημειώσεις<textarea rows={2} value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
        </div>
          {conf.length > 0 && <div className="note warn row" style={{ marginTop: 12 }}><AlertTriangle size={16} />Το γήπεδο είναι ήδη πιασμένο: {conf.map((c) => `${allTeams.find((t) => t.id === c.team_id)?.name || ''} ${new Date(c.starts_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}`).join(', ')}</div>}
          <div className="row" style={{ marginTop: 14 }}><button className="btn red grow">Αποθήκευση</button>
            {edit.id && <button type="button" className="btn danger" onClick={async () => { if (confirm('Διαγραφή;')) { await sb.from('events').delete().eq('id', edit.id); setEdit(null); load() } }}>Διαγραφή</button>}</div>
        </form></Modal>}
      {statsFor && <Attendance ev={statsFor} onClose={() => setStatsFor(null)} />}
      {planFor && <SessionPlan ev={planFor} teamName={allTeams.find((t) => t.id === planFor.team_id)?.name || ''} onClose={() => { setPlanFor(null); load() }} />}
      {urgent && <Urgent ev={urgent} teamId={urgent.team_id || ''} teamName={allTeams.find((t) => t.id === urgent.team_id)?.name || ''} onClose={() => setUrgent(null)} />}
      {board && <Leaders teams={teams} onClose={() => setBoard(false)} />}
    </>
  )
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

function WeeklySchedule({ teams, fields, onGenerated }: { teams: Team[]; fields: Field[]; onGenerated: () => void }) {
  const { toast } = useApp()
  const [slots, setSlots] = useState<Slot[]>([])
  const [n, setN] = useState({ team_id: '', weekday: 2, start_time: '18:00', end_time: '19:30', location: '', field_id: '' })
  const [month, setMonth] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + (d.getDate() > 20 ? 1 : 0)); return d.toISOString().slice(0, 7) })
  const [busy, setBusy] = useState(false)
  const load = () => sb.from('training_slots').select('*').order('weekday').order('start_time').then(({ data }) => setSlots(data || []))
  useEffect(() => { load() }, [])
  useEffect(() => { if (!n.team_id && teams.length) setN((x) => ({ ...x, team_id: teams[0].id })) }, [teams.length])
  async function add() {
    if (!n.team_id) return
    const clash = slots.find((x) => n.field_id && x.field_id === n.field_id && x.weekday === n.weekday && n.start_time < (x.end_time || '23:59') && n.end_time > x.start_time)
    if (clash && !confirm(`Το γήπεδο είναι πιασμένο ${WEEKDAYS[clash.weekday]} ${clash.start_time.slice(0, 5)} από ${teams.find((t) => t.id === clash.team_id)?.name || 'άλλη ομάδα'}. Προσθήκη παρ' όλα αυτά;`)) return
    const r = await sb.from('training_slots').insert({ ...n, location: n.location || fields.find((f) => f.id === n.field_id)?.name || null, field_id: n.field_id || null }); if (r.error) return toast(r.error.message)
    toast('Προστέθηκε ✓'); load()
  }
  async function del(s: Slot) { await sb.from('training_slots').delete().eq('id', s.id); load() }
  async function generate() {
    setBusy(true)
    const [y, m] = month.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const from = new Date(y, m - 1, 1).toISOString(), to = new Date(y, m, 1).toISOString()
    const { data: ex } = await sb.from('events').select('team_id, starts_at').gte('starts_at', from).lt('starts_at', to)
    const have = new Set((ex || []).map((e) => e.team_id + '|' + new Date(e.starts_at).getTime()))
    const rows: Partial<EventRow>[] = []
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m - 1, d); const wd = ((date.getDay() + 6) % 7) + 1
      for (const s of slots.filter((x) => x.weekday === wd && teams.some((t) => t.id === x.team_id))) {
        const [hh, mm] = s.start_time.split(':').map(Number)
        const start = new Date(y, m - 1, d, hh, mm)
        if (have.has(s.team_id + '|' + start.getTime())) continue
        const [eh, em] = (s.end_time || '').split(':').map(Number)
        const end = s.end_time ? new Date(y, m - 1, d, eh, em) : new Date(start.getTime() + 90 * 6e4)
        rows.push({ team_id: s.team_id, type: 'training', starts_at: start.toISOString(), end_at: end.toISOString(), location: s.location, field_id: s.field_id || null, home: true })
      }
    }
    if (rows.length) { const r = await sb.from('events').insert(rows); if (r.error) { setBusy(false); return toast(r.error.message) } }
    setBusy(false); toast(rows.length ? `Δημιουργήθηκαν ${rows.length} προπονήσεις ✓` : 'Οι προπονήσεις του μήνα υπάρχουν ήδη'); onGenerated()
  }
  return <div className="stack">
    <div className="grid-2">{teams.map((t) => <div className="card flush" key={t.id}>
      <div className="card-head"><div className="row">{t.logo_url && <img src={t.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />}<h2>{t.name}</h2></div></div>
      <div className="list">{slots.filter((s) => s.team_id === t.id).map((s) => <div className="item" key={s.id}>
        <b style={{ width: 96 }}>{WEEKDAYS[s.weekday]}</b><span className="num grow">{s.start_time.slice(0, 5)}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ''} {s.location && <span className="muted">· {s.location}</span>}</span>
        <button className="iconbtn" onClick={() => del(s)}><Trash2 size={14} /></button></div>)}
        {!slots.some((s) => s.team_id === t.id) && <div className="empty" style={{ padding: 18 }}>Χωρίς σταθερές προπονήσεις</div>}</div>
    </div>)}</div>
    <div className="card"><h2>Νέα σταθερή προπόνηση</h2><div className="form">
      <label className="f">Ομάδα<select value={n.team_id} onChange={(e) => setN({ ...n, team_id: e.target.value })}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="f">Ημέρα<select value={n.weekday} onChange={(e) => setN({ ...n, weekday: Number(e.target.value) })}>{WEEKDAYS.slice(1).map((w, i) => <option key={w} value={i + 1}>{w}</option>)}</select></label>
      <label className="f">Έναρξη<input type="time" value={n.start_time} onChange={(e) => setN({ ...n, start_time: e.target.value })} /></label>
      <label className="f">Λήξη<input type="time" value={n.end_time} onChange={(e) => setN({ ...n, end_time: e.target.value })} /></label>
      <label className="f">Γήπεδο<select value={n.field_id} onChange={(e) => setN({ ...n, field_id: e.target.value })}><option value="">—</option>{fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      {!n.field_id && <label className="f">Τοποθεσία<input value={n.location} onChange={(e) => setN({ ...n, location: e.target.value })} /></label>}
    </div><button className="btn red" style={{ marginTop: 12 }} onClick={add}><Plus size={16} />Προσθήκη</button></div>
    <div className="card row"><div className="grow"><h2 style={{ margin: 0 }}>Προπονήσεις μήνα</h2><div className="muted">Δημιουργεί όλες τις προπονήσεις του μήνα στο πρόγραμμα, βάσει του εβδομαδιαίου προγράμματος.</div></div>
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 170 }} />
      <button className="btn" disabled={busy || !slots.length} onClick={generate}><CalendarPlus size={16} />{busy ? '…' : 'Δημιουργία'}</button></div>
  </div>
}
