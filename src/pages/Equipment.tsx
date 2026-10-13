import { useEffect, useState } from 'react'
import { Plus, PackageMinus, Undo2, Pencil, AlertTriangle, Search } from 'lucide-react'
import { sb, eur, dt, fullName, today, type EquipmentItem, type Player } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty } from '../ui'

type Issue = { id: string; item_id: string; player_id: string | null; qty: number; issued_at: string; returned_at: string | null; charge_id: string | null; notes: string | null; players: { first_name: string; last_name: string } | null; equipment_items: { name: string; size: string | null } | null }

export default function Equipment() {
  const { toast } = useApp()
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [tab, setTab] = useState('stock')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<EquipmentItem> | null>(null)
  const [give, setGive] = useState<EquipmentItem | null>(null)
  const load = async () => {
    const [a, b] = await Promise.all([sb.from('equipment_items').select('*').order('category').order('name').order('size'),
      sb.from('equipment_issues').select('*, players(first_name,last_name), equipment_items(name,size)').order('issued_at', { ascending: false }).limit(300)])
    setItems(a.data || []); setIssues((b.data || []) as Issue[])
  }
  useEffect(() => { load() }, [])
  const low = items.filter((i) => i.quantity <= i.min_quantity)
  async function ret(i: Issue) { await sb.from('equipment_issues').update({ returned_at: today() }).eq('id', i.id); toast('Επιστράφηκε ✓'); load() }
  const cats = [...new Set(items.map((i) => i.category || 'Άλλο'))]
  const f = (s: string) => s.toLowerCase().includes(q.toLowerCase())

  return (
    <>
      <PageHead eyebrow="Υλικοτεχνική υποστήριξη" title="Αποθήκη εξοπλισμού" sub="Εμφανίσεις, φόρμες, μπάλες, κώνοι — απόθεμα και τι έχει παραδοθεί σε κάθε αθλητή.">
        <button className="btn red" onClick={() => setEdit({ category: 'Εμφάνιση', quantity: 0, min_quantity: 0 })}><Plus size={18} />Νέο είδος</button>
      </PageHead>
      {low.length > 0 && <div className="note warn row" style={{ marginBottom: 14 }}><AlertTriangle size={17} /><span>Χαμηλό απόθεμα: {low.map((i) => `${i.name}${i.size ? ` (${i.size})` : ''}: ${i.quantity}`).join(' · ')}</span></div>}
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="search" style={{ maxWidth: 380 }}><Search size={17} /><input placeholder="Αναζήτηση…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="tabs"><button className={'tab' + (tab === 'stock' ? ' on' : '')} onClick={() => setTab('stock')}>Απόθεμα</button><button className={'tab' + (tab === 'issues' ? ' on' : '')} onClick={() => setTab('issues')}>Παραδόσεις</button></div>
      {tab === 'stock' && (items.length ? cats.map((c) => <div className="card flush" key={c} style={{ marginBottom: 14 }}>
        <div className="card-head"><h2>{c}</h2></div>
        <div className="scroll"><table><thead><tr><th>Είδος</th><th>Μέγεθος</th><th className="r">Απόθεμα</th><th className="r">Τιμή</th><th></th></tr></thead><tbody>
          {items.filter((i) => (i.category || 'Άλλο') === c && f(i.name + ' ' + (i.size || ''))).map((i) => <tr key={i.id}>
            <td><b>{i.name}</b>{i.notes && <div className="muted">{i.notes}</div>}</td><td>{i.size || '—'}</td>
            <td className="r num">{i.quantity <= i.min_quantity ? <span className="badge b-bad">{i.quantity}</span> : <b>{i.quantity}</b>}</td>
            <td className="r num">{i.price != null ? eur(i.price) : '—'}</td>
            <td className="r"><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
              <button className="btn sm" disabled={i.quantity <= 0} onClick={() => setGive(i)}><PackageMinus size={14} />Παράδοση</button>
              <button className="iconbtn" onClick={() => setEdit(i)}><Pencil size={14} /></button></div></td></tr>)}
        </tbody></table></div></div>) : <div className="card"><Empty title="Η αποθήκη είναι άδεια" text="Πρόσθεσε είδη με μέγεθος και απόθεμα (π.χ. «Φανέλα αγώνα» – M – 20)." /></div>)}
      {tab === 'issues' && <div className="card flush">
        {issues.length ? <div className="scroll"><table><thead><tr><th>Ημ/νία</th><th>Αθλητής</th><th>Είδος</th><th className="r">Τεμ.</th><th>Κατάσταση</th><th></th></tr></thead><tbody>
          {issues.filter((i) => f(`${i.players ? fullName(i.players) : ''} ${i.equipment_items?.name || ''}`)).map((i) => <tr key={i.id}>
            <td>{dt(i.issued_at)}</td><td><b>{i.players ? fullName(i.players) : '—'}</b></td><td>{i.equipment_items?.name}{i.equipment_items?.size ? ` (${i.equipment_items.size})` : ''}</td>
            <td className="r num">{i.qty}</td>
            <td>{i.returned_at ? <span className="badge">Επιστράφηκε {dt(i.returned_at)}</span> : <span className="badge b-info">Στον αθλητή</span>}{i.charge_id && <span className="badge b-warn" style={{ marginLeft: 4 }}>Χρεώθηκε</span>}</td>
            <td className="r">{!i.returned_at && <button className="btn ghost sm" onClick={() => ret(i)}><Undo2 size={14} />Επιστροφή</button>}</td></tr>)}
        </tbody></table></div> : <Empty title="Καμία παράδοση" />}
      </div>}
      {edit && <ItemForm item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      {give && <GiveForm item={give} onClose={() => setGive(null)} onSaved={() => { setGive(null); load() }} />}
    </>
  )
}

function ItemForm({ item, onClose, onSaved }: { item: Partial<EquipmentItem>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<Partial<EquipmentItem>>(item)
  const set = (k: keyof EquipmentItem) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value || null })
  async function save() {
    if (!f.name) return toast('Συμπλήρωσε όνομα')
    const { id, ...rest } = f
    const r = id ? await sb.from('equipment_items').update(rest).eq('id', id) : await sb.from('equipment_items').insert(rest)
    if (r.error) return toast(r.error.message); toast('Αποθηκεύτηκε ✓'); onSaved()
  }
  return <Modal title={f.id ? 'Επεξεργασία είδους' : 'Νέο είδος'} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    <div className="form">
      <label className="f">Είδος *<input value={f.name || ''} onChange={set('name')} placeholder="π.χ. Φανέλα αγώνα" /></label>
      <label className="f">Κατηγορία<input list="eqcat" value={f.category || ''} onChange={set('category')} /><datalist id="eqcat">{['Εμφάνιση', 'Προπόνηση', 'Αξεσουάρ', 'Υλικό γηπέδου'].map((x) => <option key={x} value={x} />)}</datalist></label>
      <label className="f">Μέγεθος<input value={f.size || ''} onChange={set('size')} placeholder="π.χ. 10-12 / M" /></label>
      <label className="f">Απόθεμα<input type="number" value={f.quantity ?? 0} onChange={set('quantity')} /></label>
      <label className="f">Ειδοποίηση κάτω από<input type="number" value={f.min_quantity ?? 0} onChange={set('min_quantity')} /></label>
      <label className="f">Τιμή χρέωσης €<input type="number" step="0.01" value={f.price ?? ''} onChange={set('price')} /></label>
      <label className="f full">Σημειώσεις<input value={f.notes || ''} onChange={set('notes')} /></label>
    </div>
  </Modal>
}

function GiveForm({ item, onClose, onSaved }: { item: EquipmentItem; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [players, setPlayers] = useState<Player[]>([])
  const [q, setQ] = useState('')
  const [pid, setPid] = useState('')
  const [qty, setQty] = useState(1)
  const [charge, setCharge] = useState(!!item.price)
  useEffect(() => { sb.from('players').select('*').eq('active', true).order('last_name').then(({ data }) => setPlayers(data || [])) }, [])
  async function save() {
    if (!pid) return toast('Επίλεξε αθλητή')
    let charge_id: string | null = null
    if (charge && item.price) {
      const { data: l } = await sb.from('player_households').select('household_id').eq('player_id', pid).order('share_pct', { ascending: false }).limit(1)
      if (!l?.length) return toast('Ο αθλητής δεν έχει οικογένεια για χρέωση')
      const c = await sb.from('charges').insert({ household_id: l[0].household_id, description: `Εξοπλισμός: ${item.name}${item.size ? ` (${item.size})` : ''}${qty > 1 ? ` ×${qty}` : ''}`, amount: Number(item.price) * qty, due_date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) }).select('id').single()
      if (c.error) return toast(c.error.message); charge_id = c.data.id
    }
    const r = await sb.from('equipment_issues').insert({ item_id: item.id, player_id: pid, qty, charge_id })
    if (r.error) return toast(r.error.message)
    toast('Η παράδοση καταχωρήθηκε ✓'); onSaved()
  }
  const p = players.find((x) => x.id === pid)
  return <Modal title={`Παράδοση: ${item.name}${item.size ? ` (${item.size})` : ''}`} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={save}>Παράδοση</button></>}>
    <div className="stack">
      {p ? <div className="row"><b className="grow">{fullName(p)}</b><button className="btn ghost sm" onClick={() => setPid('')}>Αλλαγή</button></div> : <>
        <input autoFocus placeholder="Αναζήτηση αθλητή…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="list" style={{ maxHeight: 260, overflow: 'auto' }}>{players.filter((x) => fullName(x).toLowerCase().includes(q.toLowerCase())).slice(0, 30).map((x) =>
          <button key={x.id} className="item click" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', padding: '9px 4px' }} onClick={() => setPid(x.id)}>{fullName(x)}</button>)}</div></>}
      <label className="f">Τεμάχια (διαθέσιμα {item.quantity})<input type="number" min={1} max={item.quantity} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>
      {item.price != null && <label className="check"><input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} />Χρέωση στην οικογένεια: {eur(Number(item.price) * qty)}</label>}
    </div>
  </Modal>
}
