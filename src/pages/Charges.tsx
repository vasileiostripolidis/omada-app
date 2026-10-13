import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Mail } from 'lucide-react'
import { sb, eur, dt, fullName, STATUS, type Charge, type Player } from '../lib/supabase'
import { sendEmail } from '../lib/email'
import { useApp, Modal } from '../App'
import { PayForm } from './PlayerDetail'

type Row = Charge & { players: Player }

export default function Charges() {
  const { toast, settings } = useApp()
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState('open')
  const [q, setQ] = useState('')
  const [pay, setPay] = useState<Charge | null>(null)
  const [gen, setGen] = useState(false)
  const [busy, setBusy] = useState('')

  const load = async () => {
    const { data } = await sb.from('charges').select('*, players(*)').order('due_date', { ascending: false }).limit(1000)
    setRows((data || []) as Row[])
  }
  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const list = rows.filter((r) => {
    const open = r.status === 'pending' || r.status === 'partial'
    if (filter === 'open' && !open) return false
    if (filter === 'overdue' && !(open && r.due_date && r.due_date < today)) return false
    if (filter === 'paid' && r.status !== 'paid') return false
    return (fullName(r.players) + r.description).toLowerCase().includes(q.toLowerCase())
  })
  const totalOpen = list.filter((r) => r.status === 'pending' || r.status === 'partial').reduce((a, r) => a + r.amount - r.paid_amount, 0)

  async function remindAll() {
    if (!settings) return
    const byPlayer = new Map<string, Row[]>()
    list.filter((r) => r.status === 'pending' || r.status === 'partial').forEach((r) => byPlayer.set(r.player_id, [...(byPlayer.get(r.player_id) || []), r]))
    if (!confirm(`Αποστολή υπενθύμισης με PDF σε ${byPlayer.size} οικογένειες;`)) return
    let ok = 0, n = 0
    for (const [, cs] of byPlayer) {
      const p = cs[0].players; n++
      setBusy(`Αποστολή ${n}/${byPlayer.size}…`)
      if (!p.guardian_email) continue
      try {
        const { chargesPdf, pdfBase64 } = await import('../lib/pdf')
      const doc = await chargesPdf(p, cs, settings)
        const bal = cs.reduce((a, c) => a + c.amount - c.paid_amount, 0)
        await sendEmail({ to: p.guardian_email, player_id: p.id, kind: 'reminder', subject: `${settings.club_name} – Υπενθύμιση οφειλής ${fullName(p)}`,
          html: `<p>Αγαπητέ/ή ${p.guardian_name || 'γονέα'},</p><p>Υπενθυμίζουμε ότι το υπόλοιπο για τον/την <b>${fullName(p)}</b> είναι <b>${eur(bal)}</b>. Επισυνάπτεται αναλυτική κατάσταση.</p>${settings.iban ? `<p>IBAN: ${settings.iban}</p>` : ''}<p>${settings.email_footer || ''}</p>`,
          attachments: [{ filename: `Xrewseis_${p.last_name}.pdf`, content: pdfBase64(doc) }] })
        await sb.from('charges').update({ emailed_at: new Date().toISOString() }).in('id', cs.map((c) => c.id))
        ok++
      } catch { /* συνέχεια */ }
    }
    setBusy(''); toast(`Στάλθηκαν ${ok} email`); load()
  }

  return (
    <>
      <div className="row between"><h1>Χρεώσεις</h1>
        <div className="row"><button className="btn" onClick={() => setGen(true)}><Zap size={18} />Μηνιαίες χρεώσεις</button>
          <button className="btn ghost" disabled={!!busy} onClick={remindAll}><Mail size={18} />{busy || 'Υπενθυμίσεις'}</button></div></div>
      <div className="tabs">{[['open', 'Ανοιχτές'], ['overdue', 'Ληξιπρόθεσμες'], ['paid', 'Εξοφλημένες'], ['all', 'Όλες']].map(([k, l]) =>
        <button key={k} className={'tab' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <input placeholder="Αναζήτηση" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}><span className="muted">{list.length} χρεώσεις</span><b>Υπόλοιπο: {eur(totalOpen)}</b></div>
        <div className="scroll"><table><thead><tr><th>Παίκτης</th><th>Περιγραφή</th><th>Λήξη</th><th>Ποσό</th><th>Κατάσταση</th><th></th></tr></thead><tbody>
          {list.map((r) => {
            const over = (r.status === 'pending' || r.status === 'partial') && r.due_date && r.due_date < today
            return <tr key={r.id}><td><Link to={`/players/${r.player_id}`}><b>{fullName(r.players)}</b></Link></td><td>{r.description}{r.emailed_at && <span title={`Email ${dt(r.emailed_at)}`}> ✉️</span>}</td>
              <td>{dt(r.due_date)}</td><td>{eur(r.amount - (r.status === 'partial' ? r.paid_amount : 0))}</td>
              <td><span className={`badge ${over ? 'b-over' : 'b-' + r.status}`}>{over ? 'Ληξιπρόθεσμη' : STATUS[r.status]}</span></td>
              <td>{(r.status === 'pending' || r.status === 'partial') && <button className="btn sm" onClick={() => setPay(r)}>✓ Πληρώθηκε</button>}</td></tr>
          })}
        </tbody></table></div>
        {!list.length && <div className="empty">Δεν υπάρχουν χρεώσεις εδώ</div>}
      </div>
      {pay && <PayForm charge={pay} onClose={() => setPay(null)} onSaved={() => { setPay(null); load() }} />}
      {gen && <GenModal onClose={() => setGen(false)} onDone={(n) => { setGen(false); toast(`Δημιουργήθηκαν ${n} χρεώσεις`); load() }} />}
    </>
  )
}

function GenModal({ onClose, onDone }: { onClose: () => void; onDone: (n: number) => void }) {
  const { settings, toast } = useApp()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  async function run() {
    const { data, error } = await sb.rpc('generate_monthly_charges', { p_period: month + '-01' })
    if (error) return toast(error.message)
    onDone(data as number)
  }
  return <Modal title="Μηνιαίες χρεώσεις" onClose={onClose}><div style={{ display: 'grid', gap: 12 }}>
    <p className="muted" style={{ margin: 0 }}>Δημιουργεί συνδρομή για κάθε ενεργό παίκτη (μία φορά ανά μήνα — δεν διπλασιάζει). Ποσό: ειδική συνδρομή παίκτη → συνδρομή ομάδας → {eur(settings?.default_monthly_fee)} προεπιλογή, με εκπτώσεις και έκπτωση αδερφών {settings?.sibling_discount_pct}%.</p>
    {settings?.auto_charges && <p className="muted" style={{ margin: 0 }}>⚡ Γίνεται και αυτόματα κάθε {settings.charge_day} του μήνα.</p>}
    <label>Μήνας<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
    <button className="btn" onClick={run} style={{ justifyContent: 'center' }}>Δημιουργία</button>
  </div></Modal>
}
