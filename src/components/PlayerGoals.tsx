import { useEffect, useState } from 'react'
import { Plus, Target, CheckCircle2, MessageSquarePlus } from 'lucide-react'
import { sb, dt, GOAL_THEMES, type Goal } from '../lib/supabase'
import { useApp, Modal, Empty } from '../ui'

type Note = { id: string; goal_id: string; note: string | null; progress: number | null; created_at: string }
// Ατομικό πλάνο ανάπτυξης: στόχοι με πρόοδο, ορατοί και στον γονέα
export default function PlayerGoals({ playerId, readOnly = false }: { playerId: string; readOnly?: boolean }) {
  const { toast } = useApp()
  const [goals, setGoals] = useState<Goal[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [edit, setEdit] = useState<Partial<Goal> | null>(null)
  const [upd, setUpd] = useState<Goal | null>(null)
  const load = async () => {
    const { data } = await sb.from('player_goals').select('*').eq('player_id', playerId).order('status').order('created_at', { ascending: false })
    setGoals(data || [])
    const ids = (data || []).map((g) => g.id)
    if (ids.length) { const n = await sb.from('goal_notes').select('*').in('goal_id', ids).order('created_at', { ascending: false }); setNotes(n.data || []) }
  }
  useEffect(() => { load() }, [playerId])
  async function save() {
    if (!edit?.title) return toast('Συμπλήρωσε τίτλο στόχου')
    const { id, ...rest } = edit
    const r = id ? await sb.from('player_goals').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id) : await sb.from('player_goals').insert({ ...rest, player_id: playerId })
    if (r.error) return toast(r.error.message); setEdit(null); load()
  }
  const active = goals.filter((g) => g.status === 'active'), done = goals.filter((g) => g.status !== 'active')
  const Card = (g: Goal) => <div className="card" key={g.id} style={{ opacity: g.status === 'dropped' ? .6 : 1 }}>
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <div className="grow"><span className="badge b-navy">{g.theme}</span>{g.status === 'achieved' && <span className="badge b-ok" style={{ marginLeft: 6 }}><CheckCircle2 size={12} />Επιτεύχθηκε</span>}{g.status === 'dropped' && <span className="badge" style={{ marginLeft: 6 }}>Εγκαταλείφθηκε</span>}
        <h3 style={{ margin: '8px 0 4px', fontSize: 18 }}>{g.title}</h3>{g.description && <div className="muted" style={{ fontSize: 14 }}>{g.description}</div>}</div>
      {!readOnly && <div className="row" style={{ flexWrap: 'nowrap' }}><button className="btn ghost sm" onClick={() => setUpd(g)}><MessageSquarePlus size={14} />Ενημέρωση</button><button className="btn ghost sm" onClick={() => setEdit(g)}>Επεξεργασία</button></div>}
    </div>
    <div className="row" style={{ marginTop: 10 }}><div className="progress grow"><div style={{ width: g.progress + '%', background: g.progress >= 100 ? 'var(--ok)' : 'var(--navy)' }} /></div><b className="num">{g.progress}%</b></div>
    {g.target_date && <div className="muted" style={{ marginTop: 4 }}>Στόχος έως {dt(g.target_date)}</div>}
    {notes.filter((n) => n.goal_id === g.id).slice(0, 3).map((n) => <div key={n.id} style={{ marginTop: 8, fontSize: 13.5, borderLeft: '3px solid var(--line)', paddingLeft: 10 }}><span className="muted">{dt(n.created_at)}{n.progress != null ? ` · ${n.progress}%` : ''}</span><div>{n.note}</div></div>)}
  </div>
  return <div className="stack">
    {!readOnly && <div className="row between"><div className="muted">Ατομικοί στόχοι ανάπτυξης — τους βλέπει και ο γονέας στην πύλη του.</div><button className="btn red" onClick={() => setEdit({ theme: 'Τεχνική', progress: 0, status: 'active' })}><Plus size={16} />Νέος στόχος</button></div>}
    {active.length ? <div className="grid-2">{active.map(Card)}</div> : <div className="card"><Empty title="Χωρίς ενεργούς στόχους" text={readOnly ? '' : 'π.χ. «Πάσα με το αριστερό», «Κεφαλιές σε στημένα», «Αυτοπεποίθηση στο 1v1».'} /></div>}
    {done.length > 0 && <><div className="section-t">Ολοκληρωμένοι / παλαιότεροι</div><div className="grid-2">{done.map(Card)}</div></>}
    {edit && <Modal title={edit.id ? 'Επεξεργασία στόχου' : 'Νέος στόχος'} onClose={() => setEdit(null)} foot={<><button className="btn ghost" onClick={() => setEdit(null)}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
      <div className="form">
        <label className="f full">Στόχος *<input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="π.χ. Ακριβής πάσα με το αριστερό" /></label>
        <label className="f">Θεματική<select value={edit.theme} onChange={(e) => setEdit({ ...edit, theme: e.target.value })}>{GOAL_THEMES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="f">Έως<input type="date" value={edit.target_date || ''} onChange={(e) => setEdit({ ...edit, target_date: e.target.value || null })} /></label>
        <label className="f">Πρόοδος {edit.progress}%<input type="range" min={0} max={100} step={5} value={edit.progress || 0} onChange={(e) => setEdit({ ...edit, progress: Number(e.target.value) })} /></label>
        <label className="f">Κατάσταση<select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Goal['status'] })}><option value="active">Ενεργός</option><option value="achieved">Επιτεύχθηκε</option><option value="dropped">Εγκαταλείφθηκε</option></select></label>
        <label className="f full">Περιγραφή / πώς θα δουλέψουμε<textarea rows={3} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
      </div></Modal>}
    {upd && <GoalUpdate g={upd} onClose={() => setUpd(null)} onDone={() => { setUpd(null); load() }} />}
  </div>
}

function GoalUpdate({ g, onClose, onDone }: { g: Goal; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [note, setNote] = useState('')
  const [progress, setProgress] = useState(g.progress)
  async function save() {
    const r = await sb.from('goal_notes').insert({ goal_id: g.id, note: note || null, progress })
    if (r.error) return toast(r.error.message)
    await sb.from('player_goals').update({ progress, status: progress >= 100 ? 'achieved' : g.status, updated_at: new Date().toISOString() }).eq('id', g.id)
    toast('Η πρόοδος ενημερώθηκε ✓'); onDone()
  }
  return <Modal title={<><Target size={18} /> {g.title}</> as unknown as string} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    <div className="stack">
      <label className="f">Πρόοδος: {progress}%<input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></label>
      <label className="f">Σημείωση προπονητή<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Τι βελτιώθηκε, τι να δουλέψει…" /></label>
    </div>
  </Modal>
}
