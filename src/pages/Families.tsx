import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { sb, eur, fullName, monthlyAmount, RELATIONS, type Household, type Guardian } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty } from '../ui'
import { BulkInvites } from '../components/Invites'

type Kid = { name: string; share: number; active: boolean; team_id: string | null; birth_date: string | null }
type Row = Household & { guardians: Guardian[]; kids: Kid[]; balance: number; overdue: number }

export default function Families() {
  const { settings, teams } = useApp()
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [invites, setInvites] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const [h, g, l, b] = await Promise.all([
      sb.from('households').select('*').order('name'),
      sb.from('guardians').select('*').order('created_at'),
      sb.from('player_households').select('household_id, share_pct, players(first_name,last_name,active,team_id,birth_date)'),
      sb.from('household_balances').select('*'),
    ])
    const bal = new Map((b.data || []).map((x) => [x.household_id, x]))
    const links = (l.data || []) as unknown as { household_id: string; share_pct: number; players: { first_name: string; last_name: string; active: boolean; team_id: string | null; birth_date: string | null } }[]
    setRows(((h.data || []) as Household[]).map((x) => ({
      ...x, guardians: (g.data || []).filter((y) => y.household_id === x.id),
      kids: links.filter((y) => y.household_id === x.id && y.players).map((y) => ({ name: fullName(y.players), share: Number(y.share_pct), active: y.players.active, team_id: y.players.team_id, birth_date: y.players.birth_date })),
      balance: Number(bal.get(x.id)?.balance || 0), overdue: Number(bal.get(x.id)?.overdue_count || 0),
    })))
  }
  useEffect(() => { load() }, [])

  const list = rows.filter((r) => (filter === 'all' ? r.active : filter === 'debt' ? r.balance > 0.004 : filter === 'nokids' ? !r.kids.length : !r.active)
    && [r.name, ...r.guardians.map((g) => `${g.first_name} ${g.last_name} ${g.phone || ''} ${g.email || ''}`), ...r.kids.map((k) => k.name)].join(' ').toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHead eyebrow="Λογαριασμοί χρέωσης" title="Γονείς & Οικογένειες" sub="Κάθε οικογένεια χρεώνεται μία φορά τον μήνα, σύμφωνα με την πολιτική για 1, 2, 3+ παιδιά.">
        <button className="btn ghost" onClick={() => setInvites(true)}>Προσκλήσεις γονέων</button>
        <button className="btn red" onClick={() => setAdding(true)}><Plus size={18} />Νέα οικογένεια</button>
      </PageHead>
      {invites && <BulkInvites onClose={() => setInvites(false)} />}
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="search"><Search size={17} /><input placeholder="Αναζήτηση γονέα, τηλεφώνου, παιδιού…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="pills">{[['all', 'Ενεργές'], ['debt', 'Με οφειλή'], ['nokids', 'Χωρίς παιδιά'], ['inactive', 'Ανενεργές']].map(([k, l]) =>
          <button key={k} className={'pill' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}</div>
      </div>
      <div className="card flush">
        {list.length ? <div className="scroll"><table>
          <thead><tr><th>Οικογένεια</th><th>Γονείς</th><th>Αθλητές</th><th className="r">Μηνιαία</th><th className="r">Υπόλοιπο</th></tr></thead>
          <tbody>{list.map((r) => <tr key={r.id} className="click" onClick={() => nav(`/families/${r.id}`)}>
            <td><b>{r.name}</b>{r.monthly_override != null && <div className="muted">ειδική τιμή</div>}</td>
            <td>{r.guardians.map((g) => <div key={g.id}>{g.first_name} {g.last_name} <span className="muted">· {g.relation}</span></div>)}{!r.guardians.length && <span className="badge b-warn">Χωρίς γονέα</span>}</td>
            <td>{r.kids.map((k) => <div key={k.name}>{k.name}{k.share < 100 && <span className="muted"> ({k.share}%)</span>}</div>)}{!r.kids.length && <span className="muted">—</span>}</td>
            <td className="r num">{eur(monthlyAmount(settings, r, r.kids.map((k) => ({ share_pct: k.share, active: k.active, team_id: k.team_id, birth_date: k.birth_date })), teams))}</td>
            <td className="r num">{r.balance > 0.004 ? <span className={'badge ' + (r.overdue ? 'b-bad' : 'b-warn')}>{eur(r.balance)}</span> : <span className="badge b-ok">{r.balance < -0.004 ? `Πίστωση ${eur(-r.balance)}` : 'Εξοφλημένη'}</span>}</td>
          </tr>)}</tbody></table></div>
          : <Empty title="Δεν βρέθηκαν οικογένειες" text="Οι οικογένειες δημιουργούνται και αυτόματα όταν προσθέτεις αθλητή με τους γονείς του." />}
      </div>
      <button className="btn red fab" onClick={() => setAdding(true)} aria-label="Νέα οικογένεια"><Plus size={26} /></button>
      {adding && <NewFamily onClose={() => setAdding(false)} onSaved={(id) => nav(`/families/${id}`)} />}
    </>
  )
}

function NewFamily({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { toast } = useApp()
  const [g, setG] = useState({ first_name: '', last_name: '', relation: 'Πατέρας', phone: '', email: '' })
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!g.first_name || !g.last_name) return toast('Συμπλήρωσε όνομα και επώνυμο γονέα')
    setBusy(true)
    const h = await sb.from('households').insert({ name: `Οικογένεια ${g.last_name}` }).select('id').single()
    if (h.error) { setBusy(false); return toast(h.error.message) }
    await sb.from('guardians').insert({ ...g, phone: g.phone || null, email: g.email || null, household_id: h.data.id })
    toast('Η οικογένεια δημιουργήθηκε ✓'); onSaved(h.data.id)
  }
  return <Modal title="Νέα οικογένεια" onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" disabled={busy} onClick={save}>Δημιουργία</button></>}>
    <div className="form">
      <label className="f">Όνομα γονέα *<input value={g.first_name} onChange={(e) => setG({ ...g, first_name: e.target.value })} /></label>
      <label className="f">Επώνυμο *<input value={g.last_name} onChange={(e) => setG({ ...g, last_name: e.target.value })} /></label>
      <label className="f">Σχέση<select value={g.relation} onChange={(e) => setG({ ...g, relation: e.target.value })}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="f">Κινητό<input type="tel" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} /></label>
      <label className="f full">Email (για αποδείξεις & υπενθυμίσεις)<input type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} /></label>
    </div>
    <p className="muted">Στην επόμενη οθόνη προσθέτεις 2ο γονέα και τα παιδιά.</p>
  </Modal>
}
