import { useEffect, useState } from 'react'
import { Plus, Pencil, AlertTriangle } from 'lucide-react'
import { sb, EVTYPE, WEEKDAYS, type Field, type EventRow, type Team, type Slot } from '../lib/supabase'
import { useApp, Modal, Empty } from '../ui'

// Γήπεδα: διαχείριση + εβδομαδιαία πληρότητα + εντοπισμός συγκρούσεων
export default function Fields({ teams }: { teams: Team[] }) {
  const { isOffice, toast } = useApp()
  const [fields, setFields] = useState<Field[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })
  const [edit, setEdit] = useState<Partial<Field> | null>(null)
  const load = async () => {
    const end = new Date(weekStart.getTime() + 7 * 864e5)
    const [f, e, s] = await Promise.all([sb.from('fields').select('*').order('name'), sb.from('events').select('*').gte('starts_at', weekStart.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'), sb.from('training_slots').select('*')])
    setFields(f.data || []); setEvents(e.data || []); setSlots(s.data || [])
  }
  useEffect(() => { load() }, [weekStart])
  async function save() {
    if (!edit?.name) return toast('Συμπλήρωσε όνομα')
    const { id, ...rest } = edit
    const r = id ? await sb.from('fields').update(rest).eq('id', id) : await sb.from('fields').insert(rest)
    if (r.error) return toast(r.error.message); setEdit(null); load()
  }
  const endOf = (e: EventRow) => e.end_at ? new Date(e.end_at).getTime() : new Date(e.starts_at).getTime() + 90 * 6e4
  const conflict = (e: EventRow) => events.some((x) => x.id !== e.id && x.field_id && x.field_id === e.field_id && new Date(x.starts_at).getTime() < endOf(e) && endOf(x) > new Date(e.starts_at).getTime())
  const slotConflicts = slots.filter((a) => a.field_id && slots.some((b) => b.id !== a.id && b.field_id === a.field_id && b.weekday === a.weekday && a.start_time < (b.end_time || '23:59') && (a.end_time || '23:59') > b.start_time))
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 864e5))
  const tn = (id: string | null) => teams.find((t) => t.id === id)
  return <div className="stack">
    {slotConflicts.length > 0 && <div className="note warn row"><AlertTriangle size={16} />Σύγκρουση στο εβδομαδιαίο πρόγραμμα: {[...new Set(slotConflicts.map((s) => `${WEEKDAYS[s.weekday]} ${s.start_time.slice(0, 5)} – ${fields.find((f) => f.id === s.field_id)?.name}`))].join(' · ')}</div>}
    <div className="row between"><div className="row"><button className="btn ghost sm" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 864e5))}>‹</button>
      <b>{weekStart.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })} – {new Date(weekStart.getTime() + 6 * 864e5).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}</b>
      <button className="btn ghost sm" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 864e5))}>›</button></div>
      {isOffice && <button className="btn red sm" onClick={() => setEdit({ active: true })}><Plus size={14} />Νέο γήπεδο</button>}</div>
    {fields.length ? fields.map((f) => <div className="card flush" key={f.id}>
      <div className="card-head"><div><h2>{f.name}</h2><div className="muted">{[f.surface, f.address].filter(Boolean).join(' · ')}</div></div>{isOffice && <button className="iconbtn" onClick={() => setEdit(f)}><Pencil size={14} /></button>}</div>
      <div className="scroll"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 1, background: 'var(--line)' }}>
        {days.map((d) => <div key={d.toISOString()} style={{ background: '#fff', padding: 8, minHeight: 90 }}>
          <div className="muted" style={{ fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase' }}>{d.toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric' })}</div>
          {events.filter((e) => e.field_id === f.id && new Date(e.starts_at).toDateString() === d.toDateString()).map((e) => { const t = tn(e.team_id); const c = conflict(e)
            return <div key={e.id} style={{ marginTop: 6, padding: '5px 7px', borderRadius: 7, fontSize: 12, background: c ? 'var(--bad-bg)' : 'var(--soft)', borderLeft: `3px solid ${c ? 'var(--red)' : t?.color || 'var(--navy)'}` }}>
              <b>{new Date(e.starts_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}</b> {t?.short_name || t?.name}<div className="muted">{EVTYPE[e.type]}{c ? ' · ΣΥΓΚΡΟΥΣΗ' : ''}</div></div> })}
        </div>)}
      </div></div></div>) : <div className="card"><Empty title="Δεν έχουν οριστεί γήπεδα" text="Πρόσθεσε τα γήπεδα που χρησιμοποιεί η ακαδημία· μετά επιλέγεις γήπεδο σε κάθε προπόνηση/αγώνα και η εφαρμογή εντοπίζει συγκρούσεις." /></div>}
    {edit && <Modal title={edit.id ? 'Γήπεδο' : 'Νέο γήπεδο'} onClose={() => setEdit(null)} foot={<><button className="btn ghost" onClick={() => setEdit(null)}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
      <div className="form">
        <label className="f">Όνομα *<input value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="π.χ. Γήπεδο Αγίου Βασιλείου" /></label>
        <label className="f">Επιφάνεια<select value={edit.surface || ''} onChange={(e) => setEdit({ ...edit, surface: e.target.value || null })}><option value="">—</option>{['Συνθετικός χλοοτάπητας', 'Φυσικός χλοοτάπητας', 'Χωμάτινο', 'Κλειστό / 5x5'].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f full">Διεύθυνση<input value={edit.address || ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></label>
        <label className="f full">Σημειώσεις<input value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
        <label className="check full"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Σε χρήση</label>
      </div></Modal>}
  </div>
}
