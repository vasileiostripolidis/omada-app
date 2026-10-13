import { useEffect, useState } from 'react'
import { Plus, ArrowUp, ArrowDown, Trash2, Printer, Search } from 'lucide-react'
import { sb, EVTYPE, DRILL_CATS, type EventRow, type Drill } from '../lib/supabase'
import { useApp, Modal } from '../ui'

type Item = { id?: string; drill_id: string; minutes: number | null; notes: string | null; sort: number }
// Πλάνο προπόνησης: στόχος + ασκήσεις από τη βιβλιοθήκη με σειρά & διάρκεια, εκτυπώσιμο
export default function SessionPlan({ ev, teamName, onClose }: { ev: EventRow; teamName: string; onClose: () => void }) {
  const { toast } = useApp()
  const [drills, setDrills] = useState<Drill[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [objective, setObjective] = useState(ev.objective || '')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    sb.from('drills').select('*').order('category').order('title').then(({ data }) => setDrills(data || []))
    sb.from('event_drills').select('*').eq('event_id', ev.id).order('sort').then(({ data }) => setItems(data || []))
  }, [ev.id])
  const add = (d: Drill) => setItems([...items, { drill_id: d.id, minutes: d.duration, notes: null, sort: items.length }])
  const move = (i: number, dir: number) => { const a = [...items]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setItems(a.map((x, k) => ({ ...x, sort: k }))) }
  async function save() {
    await sb.from('events').update({ objective: objective || null }).eq('id', ev.id)
    await sb.from('event_drills').delete().eq('event_id', ev.id)
    if (items.length) { const r = await sb.from('event_drills').insert(items.map((x, k) => ({ event_id: ev.id, drill_id: x.drill_id, minutes: x.minutes, notes: x.notes, sort: k }))); if (r.error) return toast(r.error.message) }
    toast('Το πλάνο αποθηκεύτηκε ✓'); onClose()
  }
  const total = items.reduce((a, x) => a + (x.minutes || 0), 0)
  const d = (id: string) => drills.find((x) => x.id === id)
  if (printing) return <PrintView ev={ev} teamName={teamName} objective={objective} items={items.map((x) => ({ ...x, d: d(x.drill_id) }))} onBack={() => setPrinting(false)} />
  return <Modal wide title={`Πλάνο προπόνησης · ${new Date(ev.starts_at).toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}`} onClose={onClose}
    foot={<><span className="muted grow">Συνολική διάρκεια: <b>{total}'</b></span><button className="btn ghost" onClick={() => setPrinting(true)} disabled={!items.length}><Printer size={15} />Εκτύπωση</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    <div className="stack">
      <label className="f">Στόχος προπόνησης<input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="π.χ. Κυκλοφορία μπάλας & πίεση μετά το χάσιμο" /></label>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card flush"><div className="card-head"><h2>Πλάνο ({items.length})</h2></div>
          {items.length ? <div className="list">{items.map((x, i) => { const dr = d(x.drill_id); return <div className="item" key={i} style={{ alignItems: 'flex-start' }}>
            <span className="head" style={{ fontSize: 20, fontWeight: 800, width: 22, color: 'var(--red)' }}>{i + 1}</span>
            <div className="grow"><b>{dr?.title}</b><div className="muted">{dr?.category}</div>
              <input placeholder="Σημείωση (π.χ. 3 σετ των 4')" value={x.notes || ''} onChange={(e) => setItems(items.map((y, k) => k === i ? { ...y, notes: e.target.value } : y))} style={{ marginTop: 6, padding: 7, fontSize: 13 }} /></div>
            <input className="cell" type="number" value={x.minutes ?? ''} onChange={(e) => setItems(items.map((y, k) => k === i ? { ...y, minutes: e.target.value ? +e.target.value : null } : y))} style={{ width: 58 }} title="λεπτά" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><button className="iconbtn" style={{ width: 28, height: 26 }} onClick={() => move(i, -1)}><ArrowUp size={13} /></button><button className="iconbtn" style={{ width: 28, height: 26 }} onClick={() => move(i, 1)}><ArrowDown size={13} /></button></div>
            <button className="iconbtn" onClick={() => setItems(items.filter((_, k) => k !== i))}><Trash2 size={13} /></button></div> })}</div>
            : <div className="empty" style={{ padding: 22 }}>Πρόσθεσε ασκήσεις από τη βιβλιοθήκη</div>}</div>
        <div className="card flush"><div className="card-head"><h2>Βιβλιοθήκη</h2></div>
          <div style={{ padding: '10px 14px' }} className="stack"><div className="search"><Search size={16} /><input placeholder="Αναζήτηση άσκησης…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="chips"><button className={'pill' + (!cat ? ' on' : '')} onClick={() => setCat('')}>Όλες</button>{DRILL_CATS.map((c) => <button key={c} className={'pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div></div>
          <div className="list" style={{ maxHeight: 360, overflow: 'auto' }}>{drills.filter((x) => (!cat || x.category === cat) && x.title.toLowerCase().includes(q.toLowerCase())).map((x) =>
            <button key={x.id} className="item click" style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', width: '100%', textAlign: 'left' }} onClick={() => add(x)}>
              <div className="grow"><b>{x.title}</b><div className="muted">{x.category}{x.duration ? ` · ${x.duration}'` : ''}</div></div><Plus size={16} color="var(--red)" /></button>)}</div></div>
      </div>
    </div>
  </Modal>
}

function PrintView({ ev, teamName, objective, items, onBack }: { ev: EventRow; teamName: string; objective: string; items: (Item & { d?: Drill })[]; onBack: () => void }) {
  return <div className="print-sheet">
    <div className="no-print row" style={{ marginBottom: 14 }}><button className="btn ghost" onClick={onBack}>← Πίσω</button><button className="btn red" onClick={() => window.print()}><Printer size={15} />Εκτύπωση</button></div>
    <div className="row" style={{ borderBottom: '3px solid var(--red)', paddingBottom: 10 }}><img src="./brand/pss-logo-small.png" alt="" style={{ height: 60 }} />
      <div className="grow"><div className="eyebrow">Πλάνο προπόνησης</div><h1>{teamName}</h1><div className="muted">{EVTYPE[ev.type]} · {new Date(ev.starts_at).toLocaleString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{ev.location ? ` · ${ev.location}` : ''}</div></div>
      <div className="head" style={{ fontSize: 28, fontWeight: 800 }}>{items.reduce((a, x) => a + (x.minutes || 0), 0)}'</div></div>
    {objective && <p style={{ fontSize: 16 }}><b>Στόχος:</b> {objective}</p>}
    {items.map((x, i) => <div key={i} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0', breakInside: 'avoid' }}>
      <div className="row between"><h3 style={{ margin: 0 }}>{i + 1}. {x.d?.title} <span className="muted" style={{ fontWeight: 500 }}>· {x.d?.category}</span></h3><b>{x.minutes ? `${x.minutes}'` : ''}</b></div>
      {x.notes && <div><b>{x.notes}</b></div>}
      {x.d?.description && <div style={{ marginTop: 4 }}>{x.d.description}</div>}
      {x.d?.coaching_points && <div className="muted" style={{ marginTop: 4 }}>Σημεία καθοδήγησης: {x.d.coaching_points}</div>}
      {(x.d?.equipment || x.d?.players) && <div className="muted" style={{ marginTop: 2 }}>{[x.d?.players && `Παίκτες: ${x.d.players}`, x.d?.equipment && `Υλικά: ${x.d.equipment}`].filter(Boolean).join(' · ')}</div>}
      {x.d?.image_url && <img src={x.d.image_url} alt="" style={{ maxHeight: 180, marginTop: 6 }} />}
    </div>)}
  </div>
}
