import { useEffect, useState } from 'react'
import { Plus, Search, Clock, Users, PlayCircle, Pencil, Trash2, Upload } from 'lucide-react'
import { sb, DRILL_CATS, uploadPublic, type Drill } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty } from '../ui'

// Βιβλιοθήκη ασκήσεων του συλλόγου
export default function Drills() {
  const [rows, setRows] = useState<Drill[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState<Drill | null>(null)
  const [edit, setEdit] = useState<Partial<Drill> | null>(null)
  const load = () => sb.from('drills').select('*').order('category').order('title').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  const list = rows.filter((d) => (!cat || d.category === cat) && (d.title + ' ' + (d.description || '')).toLowerCase().includes(q.toLowerCase()))
  return <>
    <PageHead eyebrow="Προπονητικό τμήμα" title="Βιβλιοθήκη ασκήσεων" sub="Κοινές ασκήσεις για όλους τους προπονητές. Τις προσθέτεις στο πλάνο κάθε προπόνησης από το «Πρόγραμμα».">
      <button className="btn red" onClick={() => setEdit({ category: 'Τεχνική' })}><Plus size={18} />Νέα άσκηση</button></PageHead>
    <div className="row" style={{ marginBottom: 12 }}><div className="search" style={{ maxWidth: 380 }}><Search size={17} /><input placeholder="Αναζήτηση…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="pills"><button className={'pill' + (!cat ? ' on' : '')} onClick={() => setCat('')}>Όλες ({rows.length})</button>{DRILL_CATS.filter((c) => rows.some((d) => d.category === c)).map((c) => <button key={c} className={'pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div></div>
    {list.length ? <div className="grid">{list.map((d) => <div key={d.id} className="card" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }} onClick={() => setOpen(d)}>
      {d.image_url && <img src={d.image_url} alt="" style={{ height: 130, objectFit: 'cover', borderRadius: 10 }} />}
      <span className="badge b-navy" style={{ alignSelf: 'flex-start' }}>{d.category}</span>
      <b style={{ fontSize: 16 }}>{d.title}</b>
      <div className="muted" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.description}</div>
      <div className="row muted" style={{ marginTop: 'auto', fontSize: 12.5 }}>{d.duration && <span><Clock size={12} /> {d.duration}'</span>}{d.players && <span><Users size={12} /> {d.players}</span>}{d.age_group && <span>{d.age_group}</span>}{d.media_url && <PlayCircle size={14} />}</div>
    </div>)}</div> : <div className="card"><Empty title="Καμία άσκηση" /></div>}
    {open && <Modal wide title={open.title} onClose={() => setOpen(null)} foot={<><button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { if (confirm('Διαγραφή άσκησης;')) { await sb.from('drills').delete().eq('id', open.id); setOpen(null); load() } }}><Trash2 size={14} />Διαγραφή</button><button className="btn" onClick={() => { setEdit(open); setOpen(null) }}><Pencil size={14} />Επεξεργασία</button></>}>
      <div className="stack">
        <div className="row"><span className="badge b-navy">{open.category}</span>{open.duration && <span className="badge">{open.duration}'</span>}{open.age_group && <span className="badge">{open.age_group}</span>}{open.players && <span className="badge">{open.players}</span>}</div>
        {open.image_url && <img src={open.image_url} alt="" style={{ maxHeight: 340, objectFit: 'contain', borderRadius: 10 }} />}
        {open.description && <div><b>Περιγραφή</b><p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{open.description}</p></div>}
        {open.coaching_points && <div><b>Σημεία καθοδήγησης</b><p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{open.coaching_points}</p></div>}
        {open.equipment && <div className="muted">Υλικά: {open.equipment}</div>}
        {open.media_url && <a className="btn ghost" href={open.media_url} target="_blank" rel="noreferrer"><PlayCircle size={16} />Βίντεο άσκησης</a>}
      </div></Modal>}
    {edit && <DrillForm d={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
  </>
}

function DrillForm({ d, onClose, onSaved }: { d: Partial<Drill>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<Partial<Drill>>(d)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Drill) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: k === 'duration' ? (e.target.value ? +e.target.value : null) : e.target.value || null })
  async function save() {
    if (!f.title) return toast('Συμπλήρωσε τίτλο')
    const { id, ...rest } = f
    const r = id ? await sb.from('drills').update(rest).eq('id', id) : await sb.from('drills').insert(rest)
    if (r.error) return toast(r.error.message); toast('Αποθηκεύτηκε ✓'); onSaved()
  }
  async function img(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; setBusy(true); try { setF({ ...f, image_url: await uploadPublic(file, 'drills') }) } catch (er) { toast((er as Error).message) } finally { setBusy(false) } }
  return <Modal wide title={f.id ? 'Επεξεργασία άσκησης' : 'Νέα άσκηση'} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" disabled={busy} onClick={save}>Αποθήκευση</button></>}>
    <div className="form">
      <label className="f full">Τίτλος *<input value={f.title || ''} onChange={set('title')} /></label>
      <label className="f">Κατηγορία<select value={f.category} onChange={set('category')}>{DRILL_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="f">Ηλικίες<input value={f.age_group || ''} onChange={set('age_group')} placeholder="π.χ. Κ10+" /></label>
      <label className="f">Διάρκεια (λεπτά)<input type="number" value={f.duration ?? ''} onChange={set('duration')} /></label>
      <label className="f">Παίκτες<input value={f.players || ''} onChange={set('players')} placeholder="π.χ. 8–12" /></label>
      <label className="f full">Υλικά<input value={f.equipment || ''} onChange={set('equipment')} /></label>
      <label className="f full">Περιγραφή / οργάνωση<textarea rows={4} value={f.description || ''} onChange={set('description')} /></label>
      <label className="f full">Σημεία καθοδήγησης<textarea rows={3} value={f.coaching_points || ''} onChange={set('coaching_points')} /></label>
      <label className="f full">Σύνδεσμος βίντεο (YouTube)<input value={f.media_url || ''} onChange={set('media_url')} /></label>
      <div className="full row">{f.image_url && <img src={f.image_url} alt="" style={{ height: 70, borderRadius: 8 }} />}<label className="btn ghost" style={{ cursor: 'pointer' }}><Upload size={15} />{busy ? 'Ανέβασμα…' : 'Σχεδιάγραμμα / φωτογραφία'}<input type="file" accept="image/*" hidden onChange={img} /></label></div>
    </div>
  </Modal>
}
