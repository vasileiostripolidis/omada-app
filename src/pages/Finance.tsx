import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, BellRing, CheckCircle2, Search, CalendarClock } from 'lucide-react'
import { sb, eur, dt, METHOD, type Charge, type Payment, type Household, type Guardian } from '../lib/supabase'
import { reminders } from '../lib/billing'
import { useApp, Modal, PageHead, Empty, StatusBadge } from '../ui'
import { PayForm } from './FamilyDetail'

type HRow = Household & { balance: number; overdue: number; charged: number; paid: number }

export default function Finance() {
  const { toast, settings } = useApp()
  const [tab, setTab] = useState('debts')
  const [hh, setHh] = useState<HRow[]>([])
  const [charges, setCharges] = useState<(Charge & { households: { name: string } | null })[]>([])
  const [payments, setPayments] = useState<(Payment & { households: { name: string } | null; guardians: { first_name: string; last_name: string } | null })[]>([])
  const [q, setQ] = useState('')
  const [gen, setGen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pay, setPay] = useState<{ h: HRow; g: Guardian[]; canEmail: boolean } | null>(null)

  const load = async () => {
    const [h, b, c, p] = await Promise.all([
      sb.from('households').select('*').order('name'),
      sb.from('household_balances').select('*'),
      sb.from('charges').select('*, households(name)').order('due_date', { ascending: false }).limit(500),
      sb.from('payments').select('*, households(name), guardians(first_name,last_name)').order('created_at', { ascending: false }).limit(500),
    ])
    const bal = new Map((b.data || []).map((x) => [x.household_id, x]))
    setHh(((h.data || []) as Household[]).map((x) => ({ ...x, balance: Number(bal.get(x.id)?.balance || 0), overdue: Number(bal.get(x.id)?.overdue_count || 0), charged: Number(bal.get(x.id)?.total_charged || 0), paid: Number(bal.get(x.id)?.total_paid || 0) })))
    setCharges((c.data || []) as never); setPayments((p.data || []) as never)
  }
  useEffect(() => { load() }, [])

  const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const monthCharged = charges.filter((c) => c.status !== 'cancelled' && (c.period || c.created_at.slice(0, 10)) >= first).reduce((a, c) => a + Number(c.amount), 0)
  const monthPaid = payments.filter((p) => p.paid_at >= first).reduce((a, p) => a + Number(p.amount), 0)
  const owed = hh.reduce((a, x) => a + Math.max(0, x.balance), 0)
  const debtors = hh.filter((x) => x.balance > 0.004 && x.name.toLowerCase().includes(q.toLowerCase())).sort((a, z) => z.overdue - a.overdue || z.balance - a.balance)

  async function openPay(h: HRow) {
    const { data } = await sb.from('guardians').select('*').eq('household_id', h.id).order('created_at')
    const g = (data || []) as Guardian[]
    setPay({ h, g, canEmail: g.some((x) => x.receives_emails && x.email) })
  }
  async function sendReminders() {
    if (!confirm(`Αποστολή υπενθύμισης με PDF σε ${hh.filter((x) => x.balance > 0.004 && x.active).length} οικογένειες με οφειλή;`)) return
    setBusy(true)
    try { const r = await reminders(); toast(`Στάλθηκαν ${r.sent || 0} υπενθυμίσεις${r.skipped ? ` · ${r.skipped} χωρίς αποστολή` : ''}${r.errors?.length ? ' – ' + r.errors[0] : ''}`); load() }
    catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHead eyebrow="Ταμείο" title="Πληρωμές & Χρεώσεις">
        <button className="btn ghost" onClick={() => setGen(true)}><Zap size={17} />Χρεώσεις μήνα</button>
        <button className="btn red" disabled={busy} onClick={sendReminders}><BellRing size={17} />{busy ? 'Αποστολή…' : 'Υπενθυμίσεις τώρα'}</button>
      </PageHead>

      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card kpi red"><div className="l">Συνολικές οφειλές</div><div className="v num">{eur(owed)}</div><div className="s">{hh.filter((x) => x.balance > 0.004).length} οικογένειες</div></div>
        <div className="card kpi"><div className="l">Χρεώσεις μήνα</div><div className="v num">{eur(monthCharged)}</div></div>
        <div className="card kpi green"><div className="l">Εισπράξεις μήνα</div><div className="v num">{eur(monthPaid)}</div></div>
        <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CalendarClock size={22} color="var(--red)" style={{ flex: 'none' }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}><b>Αυτοματισμοί</b><br />
            {settings?.auto_family_charges ? `✓ Χρεώσεις κάθε ${settings.charge_day}η του μήνα` : '✗ Αυτόματες χρεώσεις κλειστές'}<br />
            {settings?.auto_reminders ? `✓ Υπενθυμίσεις στις ${settings.reminder_day_1} & ${settings.reminder_day_2}` : '✗ Υπενθυμίσεις κλειστές'}<br />
            {settings?.auto_receipts ? '✓ Απόδειξη με κάθε πληρωμή' : '✗ Αποδείξεις χειροκίνητα'}</div></div>
      </div>

      <div className="tabs">{[['debts', `Οφειλές (${hh.filter((x) => x.balance > 0.004).length})`], ['charges', 'Χρεώσεις'], ['payments', 'Πληρωμές']].map(([k, l]) =>
        <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="search" style={{ marginBottom: 12, maxWidth: 420 }}><Search size={17} /><input placeholder="Αναζήτηση οικογένειας…" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      {tab === 'debts' && <div className="card flush">
        {debtors.length ? <div className="scroll"><table><thead><tr><th>Οικογένεια</th><th className="r">Χρεώθηκαν</th><th className="r">Πληρώθηκαν</th><th className="r">Υπόλοιπο</th><th></th></tr></thead><tbody>
          {debtors.map((h) => <tr key={h.id}><td><Link to={`/families/${h.id}`}><b>{h.name}</b></Link>{h.overdue > 0 && <div><span className="badge b-bad">{h.overdue} ληξιπρόθεσμες</span></div>}</td>
            <td className="r num">{eur(h.charged)}</td><td className="r num">{eur(h.paid)}</td><td className="r num"><b style={{ color: 'var(--red)' }}>{eur(h.balance)}</b></td>
            <td className="r"><button className="btn ok sm" onClick={() => openPay(h)}><CheckCircle2 size={15} />Πλήρωσε</button></td></tr>)}
        </tbody></table></div> : <Empty title="Καμία οφειλή" text="Όλες οι οικογένειες είναι εξοφλημένες." />}
      </div>}

      {tab === 'charges' && <div className="card flush">
        {charges.length ? <div className="scroll"><table><thead><tr><th>Οικογένεια</th><th>Περιγραφή</th><th>Λήξη</th><th className="r">Ποσό</th><th className="r">Πληρώθηκε</th><th>Κατάσταση</th></tr></thead><tbody>
          {charges.filter((c) => (c.households?.name || '').toLowerCase().includes(q.toLowerCase())).map((c) => <tr key={c.id}>
            <td><Link to={`/families/${c.household_id}`}><b>{c.households?.name || '—'}</b></Link></td><td>{c.description}</td><td>{dt(c.due_date)}</td>
            <td className="r num">{eur(c.amount)}</td><td className="r num">{eur(c.paid_amount)}</td><td><StatusBadge status={c.status} due={c.due_date} /></td></tr>)}
        </tbody></table></div> : <Empty title="Καμία χρέωση" />}
      </div>}

      {tab === 'payments' && <div className="card flush">
        {payments.length ? <div className="scroll"><table><thead><tr><th>Ημ/νία</th><th>Απόδειξη</th><th>Οικογένεια</th><th>Πλήρωσε</th><th>Τρόπος</th><th className="r">Ποσό</th></tr></thead><tbody>
          {payments.filter((p) => (p.households?.name || '').toLowerCase().includes(q.toLowerCase())).map((p) => <tr key={p.id}>
            <td>{dt(p.paid_at)}</td><td>#{p.receipt_no}{p.receipt_sent_at && ' ✉'}</td><td><Link to={`/families/${p.household_id}`}><b>{p.households?.name || '—'}</b></Link></td>
            <td>{p.guardians ? `${p.guardians.first_name} ${p.guardians.last_name}` : '—'}</td><td>{METHOD[p.method]}</td><td className="r num"><b>{eur(p.amount)}</b></td></tr>)}
        </tbody></table></div> : <Empty title="Καμία πληρωμή" />}
      </div>}

      {gen && <GenModal onClose={() => setGen(false)} onDone={(n) => { setGen(false); toast(n ? `Δημιουργήθηκαν ${n} χρεώσεις` : 'Οι χρεώσεις του μήνα υπάρχουν ήδη'); load() }} />}
      {pay && <PayForm household={pay.h} guardians={pay.g} balance={pay.h.balance} canEmail={pay.canEmail} onClose={() => setPay(null)} onSaved={() => { setPay(null); load() }} />}
    </>
  )
}

function GenModal({ onClose, onDone }: { onClose: () => void; onDone: (n: number) => void }) {
  const { settings, toast } = useApp()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  async function run() {
    const { data, error } = await sb.rpc('generate_household_charges', { p_period: month + '-01' })
    if (error) return toast(error.message)
    onDone(data as number)
  }
  return <Modal title="Μηνιαίες χρεώσεις" onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={run}><Zap size={16} />Δημιουργία</button></>}>
    <div className="stack">
      <p style={{ margin: 0 }}>Δημιουργεί τη μηνιαία χρέωση κάθε ενεργής οικογένειας βάσει της πολιτικής (ή της ειδικής τιμής της). Δεν διπλασιάζει χρεώσεις που υπάρχουν ήδη.</p>
      {settings && <div className="note">1 παιδί: <b>{eur(settings.fee_1)}</b> · 2 παιδιά: <b>{eur(settings.fee_2)}</b> · 3 παιδιά: <b>{eur(settings.fee_3)}</b> · κάθε επιπλέον: <b>+{eur(settings.fee_extra)}</b></div>}
      <label className="f">Μήνας<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
    </div>
  </Modal>
}
