import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, BellRing, CheckCircle2, Search, CalendarClock, Plus, Trash2, Save } from 'lucide-react'
import { sb, eur, dt, METHOD, MONTHS, policyTotal, type Charge, type Payment, type Household, type Guardian, type RecurringFee, type Settings, type Team } from '../lib/supabase'
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

      <div className="tabs">{[['debts', `Οφειλές (${hh.filter((x) => x.balance > 0.004).length})`], ['charges', 'Χρεώσεις'], ['payments', 'Πληρωμές'], ['setup', 'Παραμετροποίηση χρεώσεων']].map(([k, l]) =>
        <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'setup' ? <BillingSetup /> : <div className="search" style={{ marginBottom: 12, maxWidth: 420 }}><Search size={17} /><input placeholder="Αναζήτηση οικογένειας…" value={q} onChange={(e) => setQ(e.target.value)} /></div>}

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
  const { toast } = useApp()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<{ household_id: string; name: string; subscription: number; extras: number }[]>([])
  useEffect(() => { sb.rpc('preview_household_charges', { p_period: month + '-01' }).then(({ data }) => setRows(data || [])) }, [month])
  async function run() {
    const { data, error } = await sb.rpc('generate_household_charges', { p_period: month + '-01' })
    if (error) return toast(error.message)
    onDone(data as number)
  }
  const tot = rows.reduce((a, r) => a + Number(r.subscription) + Number(r.extras), 0)
  return <Modal wide title="Χρεώσεις μήνα – προεπισκόπηση" onClose={onClose} foot={<><span className="muted grow">Σύνολο: <b>{eur(tot)}</b> σε {rows.filter((r) => Number(r.subscription) + Number(r.extras) > 0).length} οικογένειες</span><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={run}><Zap size={16} />Έκδοση χρεώσεων</button></>}>
    <div className="stack">
      <div className="row"><label className="f" style={{ width: 200 }}>Μήνας<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <p className="muted grow" style={{ margin: 0 }}>Γίνεται και αυτόματα την 1η κάθε μήνα. Χρεώσεις που υπάρχουν ήδη για τον μήνα δεν διπλασιάζονται. Για αλλαγή ποσού σε μία οικογένεια, όρισε «ειδική τιμή» στην καρτέλα της.</p></div>
      <div className="card flush"><div className="scroll" style={{ maxHeight: 420 }}><table><thead><tr><th>Οικογένεια</th><th className="r">Συνδρομή</th><th className="r">Πάγιες</th><th className="r">Σύνολο</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.household_id}><td>{r.name}</td><td className="r num">{eur(r.subscription)}</td><td className="r num">{eur(r.extras)}</td><td className="r num"><b>{eur(Number(r.subscription) + Number(r.extras))}</b></td></tr>)}
      </tbody></table></div>{!rows.length && <Empty title="Καμία ενεργή οικογένεια" />}</div>
    </div>
  </Modal>
}

function BillingSetup() {
  const { settings, reloadSettings, teams, reloadTeams, toast } = useApp()
  const [s, setS] = useState<Settings | null>(settings)
  const [tf, setTf] = useState<Record<string, Partial<Team>>>({})
  const [fees, setFees] = useState<RecurringFee[]>([])
  const [nf, setNf] = useState<{ name: string; amount: string; per_child: boolean; months: number[]; team_id: string }>({ name: '', amount: '', per_child: true, months: [], team_id: '' })
  useEffect(() => { setS(settings) }, [settings])
  useEffect(() => { setTf(Object.fromEntries(teams.map((t) => [t.id, { fee_1: t.fee_1, fee_2: t.fee_2, fee_3: t.fee_3, fee_extra: t.fee_extra }]))) }, [teams])
  const loadFees = () => sb.from('recurring_fees').select('*').order('created_at').then(({ data }) => setFees(data || []))
  useEffect(() => { loadFees() }, [])
  if (!s) return null
  const pct = (m: number) => Number(s.month_pct?.[String(m)] ?? 100)
  const setPct = (m: number, v: number) => { const mp = { ...(s.month_pct || {}) }; if (v === 100) delete mp[String(m)]; else mp[String(m)] = v; setS({ ...s, month_pct: mp }) }
  async function save() {
    const r = await sb.from('club_settings').update({ fee_1: s!.fee_1, fee_2: s!.fee_2, fee_3: s!.fee_3, fee_extra: s!.fee_extra, month_pct: s!.month_pct, charge_day: s!.charge_day, due_days: s!.due_days, auto_family_charges: s!.auto_family_charges }).eq('id', 1)
    if (r.error) return toast(r.error.message)
    for (const t of teams) {
      const v = tf[t.id] || {}
      if (['fee_1', 'fee_2', 'fee_3', 'fee_extra'].some((k) => (v as Record<string, unknown>)[k] !== (t as unknown as Record<string, unknown>)[k])) await sb.from('teams').update(v).eq('id', t.id)
    }
    reloadSettings(); reloadTeams(); toast('Η πολιτική χρεώσεων αποθηκεύτηκε ✓')
  }
  async function addFee() {
    if (!nf.name || !(Number(nf.amount) > 0)) return toast('Συμπλήρωσε όνομα και ποσό')
    const r = await sb.from('recurring_fees').insert({ name: nf.name, amount: Number(nf.amount), per_child: nf.per_child, months: nf.months.length ? nf.months : null, team_id: nf.team_id || null })
    if (r.error) return toast(r.error.message)
    setNf({ name: '', amount: '', per_child: true, months: [], team_id: '' }); loadFees(); toast('Η πάγια χρέωση προστέθηκε ✓')
  }
  const num = (v: string) => (v === '' ? null : Number(v))
  const F = (k: 'fee_1' | 'fee_2' | 'fee_3' | 'fee_extra', l: string) => <label className="f">{l}<input type="number" step="0.01" value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} /></label>
  return <div className="stack">
    <div className="card"><div className="row between"><h2 style={{ margin: 0 }}>Πολιτική συλλόγου</h2><button className="btn red" onClick={save}><Save size={16} />Αποθήκευση</button></div>
      <p className="muted">Μηνιαίο σύνολο ανά οικογένεια ανάλογα με τα ενεργά παιδιά. Ισχύει για κάθε ομάδα που δεν έχει δική της τιμή.</p>
      <div className="form">{F('fee_1', '1 παιδί')}{F('fee_2', '2 παιδιά (σύνολο)')}{F('fee_3', '3 παιδιά (σύνολο)')}{F('fee_extra', 'Κάθε επιπλέον (+)')}
        <label className="f">Ημέρα έκδοσης<input type="number" min={1} max={28} value={s.charge_day} onChange={(e) => setS({ ...s, charge_day: Number(e.target.value) })} /></label>
        <label className="f">Προθεσμία (ημέρες)<input type="number" value={s.due_days} onChange={(e) => setS({ ...s, due_days: Number(e.target.value) })} /></label>
        <label className="check full"><input type="checkbox" checked={s.auto_family_charges} onChange={(e) => setS({ ...s, auto_family_charges: e.target.checked })} />Αυτόματη έκδοση κάθε μήνα</label></div>
    </div>
    <div className="card flush"><div className="card-head"><h2>Τιμή ανά ομάδα</h2><span className="muted">κενό = πολιτική συλλόγου</span></div>
      <div className="scroll"><table><thead><tr><th>Ομάδα</th><th>1 παιδί</th><th>2 παιδιά</th><th>3 παιδιά</th><th>Επιπλέον</th><th>Παράδειγμα (1 / 2 παιδιά)</th></tr></thead><tbody>
        {teams.map((t) => { const v = tf[t.id] || {}; const cell = (k: 'fee_1' | 'fee_2' | 'fee_3' | 'fee_extra') => <td><input type="number" step="0.01" style={{ width: 100 }} placeholder={String(s[k])} value={v[k] ?? ''} onChange={(e) => setTf({ ...tf, [t.id]: { ...v, [k]: num(e.target.value) } })} /></td>
          return <tr key={t.id}><td><b>{t.name}</b></td>{cell('fee_1')}{cell('fee_2')}{cell('fee_3')}{cell('fee_extra')}<td className="num muted">{eur(policyTotal(s, 1, v))} / {eur(policyTotal(s, 2, v))}</td></tr> })}
      </tbody></table></div>
      <div className="item muted">Αδέρφια σε διαφορετικές ομάδες: το 1ο παιδί πληρώνει την τιμή «1 παιδί» της ακριβότερης ομάδας και κάθε επόμενο τη διαφορά της κλίμακας της δικής του ομάδας.</div></div>
    <div className="card"><h2>Ποσοστό χρέωσης ανά μήνα</h2><p className="muted" style={{ marginTop: 0 }}>Π.χ. 0% τον Αύγουστο (χωρίς χρέωση), 50% τον Ιούλιο. Ισχύει για τη μηνιαία συνδρομή.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>{MONTHS.map((m, i) => <label key={m} className="f">{m}
        <select value={pct(i + 1)} onChange={(e) => setPct(i + 1, Number(e.target.value))} style={pct(i + 1) < 100 ? { borderColor: 'var(--red)', fontWeight: 700 } : undefined}>{[100, 75, 50, 25, 0].map((v) => <option key={v} value={v}>{v === 0 ? 'Χωρίς' : v + '%'}</option>)}</select></label>)}</div>
      <button className="btn red" style={{ marginTop: 12 }} onClick={save}><Save size={16} />Αποθήκευση</button></div>
    <div className="card flush"><div className="card-head"><h2>Επιπλέον πάγιες χρεώσεις</h2></div>
      {fees.length ? <div className="list">{fees.map((f) => <div className="item" key={f.id}>
        <div className="grow"><div className="t">{f.name} · {eur(f.amount)} {f.per_child ? 'ανά παιδί' : 'ανά οικογένεια'}</div>
          <div className="muted">{f.months?.length ? 'Μήνες: ' + f.months.map((m) => MONTHS[m - 1]).join(', ') : 'Κάθε μήνα'}{f.team_id ? ` · Μόνο ${teams.find((t) => t.id === f.team_id)?.name}` : ''}</div></div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={async (e) => { await sb.from('recurring_fees').update({ active: e.target.checked }).eq('id', f.id); loadFees() }} />Ενεργή</label>
        <button className="iconbtn" onClick={async () => { if (confirm(`Διαγραφή «${f.name}»;`)) { await sb.from('recurring_fees').delete().eq('id', f.id); loadFees() } }}><Trash2 size={14} /></button></div>)}</div>
        : <div className="empty" style={{ padding: 20 }}>Π.χ. «Ασφάλιση» 10€/παιδί τον Οκτώβριο, «Εγγραφή σεζόν» 30€/οικογένεια τον Σεπτέμβριο, «Εμφάνιση (δόση)» 20€ Οκτ-Νοε-Δεκ.</div>}
      <div style={{ padding: 18, borderTop: '1px solid var(--line)' }}><div className="form">
        <label className="f">Όνομα<input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="π.χ. Ασφάλιση" /></label>
        <label className="f">Ποσό €<input type="number" step="0.01" value={nf.amount} onChange={(e) => setNf({ ...nf, amount: e.target.value })} /></label>
        <label className="f">Χρέωση<select value={nf.per_child ? '1' : '0'} onChange={(e) => setNf({ ...nf, per_child: e.target.value === '1' })}><option value="1">Ανά παιδί</option><option value="0">Ανά οικογένεια</option></select></label>
        <label className="f">Ομάδα<select value={nf.team_id} onChange={(e) => setNf({ ...nf, team_id: e.target.value })}><option value="">Όλες</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <div className="full"><div className="muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>Μήνες (κανένας = κάθε μήνα)</div>
          <div className="pills">{MONTHS.map((m, i) => <button key={m} type="button" className={'pill' + (nf.months.includes(i + 1) ? ' on' : '')} onClick={() => setNf({ ...nf, months: nf.months.includes(i + 1) ? nf.months.filter((x) => x !== i + 1) : [...nf.months, i + 1].sort((a, b) => a - b) })}>{m}</button>)}</div></div>
      </div><button className="btn red" style={{ marginTop: 12 }} onClick={addFee}><Plus size={16} />Προσθήκη πάγιας χρέωσης</button></div>
    </div>
  </div>
}
