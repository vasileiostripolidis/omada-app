import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Phone, Mail, Download, Send, CheckCircle2, Merge, UserPlus, Receipt, ArrowRightLeft, BellOff, Smartphone } from 'lucide-react'
import { InviteModal } from '../components/Invites'
import { sb, eur, dt, fullName, initials, monthlyAmount, today, METHOD, RELATIONS, DISCOUNT_CATS, type Household, type Guardian, type Charge, type Payment, type Player } from '../lib/supabase'
import { statement, receipt, downloadPdf } from '../lib/billing'
import { useApp, Modal, Empty, StatusBadge } from '../ui'

type Kid = { player_id: string; share_pct: number; players: Player }

export default function FamilyDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toast, settings, teams } = useApp()
  const [h, setH] = useState<Household | null>(null)
  const [guards, setGuards] = useState<Guardian[]>([])
  const [kids, setKids] = useState<Kid[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [balance, setBalance] = useState(0)
  const [inv, setInv] = useState<Guardian | null>(null)
  const [editG, setEditG] = useState<Partial<Guardian> | null>(null)
  const [moveG, setMoveG] = useState<Guardian | null>(null)
  const [addKid, setAddKid] = useState(false)
  const [pay, setPay] = useState(false)
  const [newCharge, setNewCharge] = useState(false)
  const [merge, setMerge] = useState(false)
  const [editName, setEditName] = useState(false)
  const [busy, setBusy] = useState('')

  const load = async () => {
    const [a, g, k, c, p, b] = await Promise.all([
      sb.from('households').select('*').eq('id', id).single(),
      sb.from('guardians').select('*').eq('household_id', id).order('created_at'),
      sb.from('player_households').select('player_id, share_pct, players(*)').eq('household_id', id),
      sb.from('charges').select('*').eq('household_id', id).order('due_date', { ascending: false }),
      sb.from('payments').select('*').eq('household_id', id).order('created_at', { ascending: false }),
      sb.from('household_balances').select('*').eq('household_id', id).single(),
    ])
    setH(a.data); setGuards(g.data || []); setKids((k.data || []) as unknown as Kid[]); setCharges(c.data || []); setPayments(p.data || [])
    setBalance(Number(b.data?.balance || 0))
  }
  useEffect(() => { load() }, [id])
  if (!h) return null

  const kl = kids.map((k) => ({ share_pct: Number(k.share_pct), active: k.players.active, team_id: k.players.team_id, birth_date: k.players.birth_date, created_at: k.players.created_at }))
  const monthly = monthlyAmount(settings, h, kl, teams)
  const activeKids = kids.filter((k) => k.players.active && Number(k.share_pct) > 0).length
  const policy = monthlyAmount(settings, { ...h, monthly_override: null, discount_pct: 0 }, kl, teams)
  const recipients = guards.filter((g) => g.receives_emails && g.email)

  async function updateH(patch: Partial<Household>) { const r = await sb.from('households').update(patch).eq('id', id); if (r.error) toast(r.error.message); else { toast('Αποθηκεύτηκε ✓'); load() } }
  async function delGuardian(g: Guardian) { if (confirm(`Διαγραφή γονέα ${g.first_name} ${g.last_name};`)) { await sb.from('guardians').delete().eq('id', g.id); load() } }
  async function removeKid(k: Kid) { if (confirm(`Αφαίρεση του/της ${fullName(k.players)} από την οικογένεια;`)) { await sb.from('player_households').delete().eq('player_id', k.player_id).eq('household_id', id); load() } }
  async function shareKid(k: Kid, v: number) { await sb.from('player_households').update({ share_pct: v }).eq('player_id', k.player_id).eq('household_id', id); load() }
  async function cancelCharge(c: Charge) { if (confirm(`Ακύρωση χρέωσης «${c.description}»;`)) { await sb.from('charges').update({ status: 'cancelled' }).eq('id', c.id); load() } }
  async function delPayment(p: Payment) { if (confirm(`Διαγραφή πληρωμής ${eur(p.amount)} (απόδειξη #${p.receipt_no});`)) { await sb.from('payments').delete().eq('id', p.id); toast('Η πληρωμή διαγράφηκε'); load() } }
  async function removeFamily() {
    if (!confirm('Διαγραφή οικογένειας; Θα σβηστούν και οι χρεώσεις/πληρωμές της. Οι αθλητές μένουν.')) return
    await sb.from('households').delete().eq('id', id); nav('/families')
  }
  async function pdf(send: boolean, reminder = false) {
    setBusy(send ? 'send' : 'pdf')
    try {
      const r = await statement(h!.id, send, reminder)
      if (!send && r.pdf) downloadPdf(r.pdf, `Katastasi_${h!.name}.pdf`)
      if (send) toast(r.emailed ? `Στάλθηκε σε ${recipients.map((g) => g.email).join(', ')} ✓` : 'Δεν στάλθηκε: ' + (r.error || ''))
    } catch (e) { toast((e as Error).message) } finally { setBusy('') }
  }
  async function receiptPdf(p: Payment, send: boolean) {
    setBusy(p.id)
    try {
      const r = await receipt(p.id, send)
      if (!send && r.pdf) downloadPdf(r.pdf, `Apodeixi_${p.receipt_no}.pdf`)
      if (send) toast(r.emailed ? 'Η απόδειξη στάλθηκε ✓' : 'Δεν στάλθηκε: ' + (r.error || ''))
      load()
    } catch (e) { toast((e as Error).message) } finally { setBusy('') }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={() => nav(-1)} style={{ marginBottom: 12 }}><ArrowLeft size={16} />Πίσω</button>
      <div className="card row" style={{ marginBottom: 16, gap: 18, alignItems: 'stretch' }}>
        <div className="grow">
          <div className="eyebrow">Λογαριασμός οικογένειας</div>
          {editName ? <form className="row" onSubmit={(e) => { e.preventDefault(); updateH({ name: (e.currentTarget.elements.namedItem('n') as HTMLInputElement).value }); setEditName(false) }}>
            <input name="n" defaultValue={h.name} style={{ maxWidth: 360 }} autoFocus /><button className="btn sm">OK</button></form>
            : <h1 onClick={() => setEditName(true)} style={{ cursor: 'pointer' }}>{h.name} <Pencil size={16} color="var(--muted)" /></h1>}
          <div className="row" style={{ marginTop: 10 }}>
            <span className="badge b-navy">{activeKids} {activeKids === 1 ? 'παιδί' : 'παιδιά'}</span>
            <span className="badge">Μηνιαία: {eur(monthly)}</span>
            {!h.active && <span className="badge b-warn">Ανενεργή</span>}
            {!recipients.length && <span className="badge b-warn"><BellOff size={12} />Χωρίς email ειδοποιήσεων</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 190 }}>
          <div className="muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>Υπόλοιπο</div>
          <div className="head num" style={{ fontSize: 38, fontWeight: 800, color: balance > 0.004 ? 'var(--red)' : 'var(--ok)', lineHeight: 1.1 }}>{eur(Math.abs(balance))}</div>
          <div className="muted">{balance > 0.004 ? 'οφειλή' : balance < -0.004 ? 'πίστωση' : 'εξοφλημένος'}</div>
          <button className="btn ok" style={{ marginTop: 10 }} onClick={() => setPay(true)}><CheckCircle2 size={17} />Πλήρωσε</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card flush">
          <div className="card-head"><h2>Γονείς / Κηδεμόνες</h2><button className="btn ghost sm" onClick={() => setEditG({ household_id: h.id, relation: guards.length ? 'Μητέρα' : 'Πατέρας', receives_emails: true, last_name: guards[0]?.last_name })}><UserPlus size={15} />Προσθήκη</button></div>
          {guards.length ? <div className="list">{guards.map((g) => <div className="item" key={g.id}>
            <div className="avatar" style={{ background: 'var(--navy-3)' }}>{initials(g)}</div>
            <div className="grow"><div className="t">{g.first_name} {g.last_name}</div>
              <div className="muted">{g.relation}{g.phone ? ` · ${g.phone}` : ''}{g.email ? ` · ${g.email}` : ''}</div>
              {!g.receives_emails && <span className="badge" style={{ marginTop: 4 }}><BellOff size={11} />χωρίς ειδοποιήσεις</span>}
              {(g as Guardian & { profile_id?: string }).profile_id && <span className="badge b-ok" style={{ marginTop: 4 }}><Smartphone size={11} />στην εφαρμογή</span>}</div>
            <button className="iconbtn" title="Πρόσβαση στην εφαρμογή (σύνδεσμος / QR)" onClick={() => setInv(g)}><Smartphone size={15} /></button>
            {g.phone && <a className="iconbtn" href={`tel:${g.phone}`}><Phone size={15} /></a>}
            {g.email && <a className="iconbtn" href={`mailto:${g.email}`}><Mail size={15} /></a>}
            <button className="iconbtn" title="Επεξεργασία" onClick={() => setEditG(g)}><Pencil size={15} /></button>
            <button className="iconbtn" title="Μεταφορά σε άλλη οικογένεια" onClick={() => setMoveG(g)}><ArrowRightLeft size={15} /></button>
            <button className="iconbtn" title="Διαγραφή" onClick={() => delGuardian(g)}><Trash2 size={15} /></button>
          </div>)}</div> : <Empty title="Χωρίς γονείς" />}
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Αθλητές</h2><button className="btn ghost sm" onClick={() => setAddKid(true)}><Plus size={15} />Προσθήκη παιδιού</button></div>
          {kids.length ? <div className="list">{kids.map((k) => <div className="item" key={k.player_id}>
            <div className="avatar">{initials(k.players)}</div>
            <Link to={`/players/${k.player_id}`} className="grow"><div className="t">{fullName(k.players)}</div><div className="muted">{k.players.active ? 'Ενεργός' : 'Ανενεργός – δεν χρεώνεται'}</div></Link>
            <select title="Ποσοστό χρέωσης" style={{ width: 92 }} value={Number(k.share_pct)} onChange={(e) => shareKid(k, Number(e.target.value))}>{[100, 75, 50, 25, 0].map((v) => <option key={v} value={v}>{v}%</option>)}</select>
            <button className="iconbtn" title="Αφαίρεση" onClick={() => removeKid(k)}><Trash2 size={15} /></button>
          </div>)}</div> : <Empty title="Χωρίς αθλητές" text="Πρόσθεσε τα παιδιά της οικογένειας." />}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between"><h2 style={{ margin: 0 }}>Μηνιαία συνδρομή</h2><span className="muted">Ανανεώνεται αυτόματα κάθε {settings?.charge_day || 1}η του μήνα</span></div>
        <div className="form" style={{ marginTop: 12 }}>
          <div><div className="muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Βάσει πολιτικής</div>
            <div className="head" style={{ fontSize: 24, fontWeight: 800 }}>{eur(policy)}</div><div className="muted">για {activeKids} {activeKids === 1 ? 'παιδί' : 'παιδιά'}{kids.some((k) => Number(k.share_pct) < 100) ? ' · με ποσοστά κατανομής' : ''}</div></div>
          <label className="f">Ειδική μηνιαία τιμή €<input type="number" step="0.01" placeholder="Αυτόματα" defaultValue={h.monthly_override ?? ''} key={'o' + h.monthly_override}
            onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== h.monthly_override) updateH({ monthly_override: v }) }} /></label>
          <label className="f">Έκπτωση %<input type="number" step="1" defaultValue={h.discount_pct || 0} key={'d' + h.discount_pct}
            onBlur={(e) => { const v = Number(e.target.value || 0); if (v !== Number(h.discount_pct)) updateH({ discount_pct: v }) }} /></label>
          <label className="f">Κατηγορία έκπτωσης / υποτροφία<select value={h.discount_category || ''} onChange={(e) => updateH({ discount_category: e.target.value || null })}><option value="">— Καμία —</option>{DISCOUNT_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="f">Αιτιολογία / δικαιολογητικό<input defaultValue={h.discount_reason || ''} key={'r' + h.discount_reason} placeholder="π.χ. Πάσο πολυτέκνων έως 6/2027"
            onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (h.discount_reason || null)) updateH({ discount_reason: v }) }} /></label>
          <div><div className="muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Τελική χρέωση / μήνα</div><div className="head" style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>{eur(monthly)}</div>
            <label className="check" style={{ marginTop: 6 }}><input type="checkbox" checked={h.active} onChange={(e) => updateH({ active: e.target.checked })} />Ενεργός λογαριασμός</label></div>
        </div>
      </div>

      <div className="card flush" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ flexWrap: 'wrap' }}><h2>Χρεώσεις</h2>
          <div className="row">
            <button className="btn ghost sm" onClick={() => setNewCharge(true)}><Plus size={15} />Έκτακτη χρέωση</button>
            <button className="btn ghost sm" disabled={!!busy} onClick={() => pdf(false)}><Download size={15} />{busy === 'pdf' ? '…' : 'PDF κατάστασης'}</button>
            <button className="btn sm" disabled={!!busy || !recipients.length} onClick={() => pdf(true, balance > 0.004)}><Send size={15} />{busy === 'send' ? 'Αποστολή…' : 'Αποστολή στους γονείς'}</button>
          </div></div>
        {charges.length ? <div className="scroll"><table><thead><tr><th>Περιγραφή</th><th>Λήξη</th><th className="r">Ποσό</th><th className="r">Πληρώθηκε</th><th>Κατάσταση</th><th></th></tr></thead><tbody>
          {charges.map((c) => <tr key={c.id}><td><b>{c.description}</b>{c.breakdown && <div className="muted">{c.breakdown.map((b) => b.name + (b.share < 100 ? ` (${b.share}%)` : '')).join(', ')}</div>}</td>
            <td>{dt(c.due_date)}</td><td className="r num">{eur(c.amount)}</td><td className="r num">{eur(c.paid_amount)}</td>
            <td><StatusBadge status={c.status} due={c.due_date} />{c.emailed_at && <div className="muted">✉ {dt(c.emailed_at)}</div>}</td>
            <td className="r">{c.status !== 'cancelled' && c.status !== 'paid' && <button className="iconbtn" title="Ακύρωση" onClick={() => cancelCharge(c)}><Trash2 size={14} /></button>}</td></tr>)}
        </tbody></table></div> : <Empty title="Καμία χρέωση" text="Οι μηνιαίες χρεώσεις δημιουργούνται αυτόματα την 1η κάθε μήνα." />}
      </div>

      <div className="card flush" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Πληρωμές & αποδείξεις</h2><button className="btn ok sm" onClick={() => setPay(true)}><CheckCircle2 size={15} />Νέα πληρωμή</button></div>
        {payments.length ? <div className="scroll"><table><thead><tr><th>Ημ/νία</th><th>Απόδειξη</th><th>Πλήρωσε</th><th>Τρόπος</th><th className="r">Ποσό</th><th></th></tr></thead><tbody>
          {payments.map((p) => { const g = guards.find((x) => x.id === p.payer_guardian_id)
            return <tr key={p.id}><td>{dt(p.paid_at)}</td><td>#{p.receipt_no}{p.receipt_sent_at && <span className="badge b-ok" style={{ marginLeft: 6 }}>✉ στάλθηκε</span>}</td>
              <td>{g ? `${g.first_name} ${g.last_name}` : '—'}</td><td>{METHOD[p.method]}</td><td className="r num"><b>{eur(p.amount)}</b></td>
              <td className="r"><div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                <button className="iconbtn" title="Λήψη απόδειξης" disabled={busy === p.id} onClick={() => receiptPdf(p, false)}><Receipt size={14} /></button>
                <button className="iconbtn" title="Αποστολή απόδειξης" disabled={busy === p.id || !recipients.length} onClick={() => receiptPdf(p, true)}><Send size={14} /></button>
                <button className="iconbtn" title="Διαγραφή" onClick={() => delPayment(p)}><Trash2 size={14} /></button></div></td></tr> })}
        </tbody></table></div> : <Empty title="Καμία πληρωμή" />}
      </div>

      <div className="row">
        <button className="btn ghost" onClick={() => setMerge(true)}><Merge size={16} />Ένωση με άλλη οικογένεια</button>
        <button className="btn danger" onClick={removeFamily}><Trash2 size={16} />Διαγραφή οικογένειας</button>
      </div>

      {inv && <InviteModal guardian={inv} onClose={() => { setInv(null); load() }} />}
      {editG && <GuardianForm g={editG} onClose={() => setEditG(null)} onSaved={() => { setEditG(null); load() }} />}
      {moveG && <MoveGuardian g={moveG} onClose={() => setMoveG(null)} onDone={() => { setMoveG(null); load() }} />}
      {addKid && <AddKid householdId={h.id} exclude={kids.map((k) => k.player_id)} onClose={() => setAddKid(false)} onDone={() => { setAddKid(false); load() }} />}
      {pay && <PayForm household={h} guardians={guards} balance={balance} canEmail={recipients.length > 0} onClose={() => setPay(false)} onSaved={() => { setPay(false); load() }} />}
      {newCharge && <ChargeForm householdId={h.id} onClose={() => setNewCharge(false)} onSaved={() => { setNewCharge(false); load() }} />}
      {merge && <MergeFamily current={h} onClose={() => setMerge(false)} onDone={() => { setMerge(false); load() }} />}
    </>
  )
}

function GuardianForm({ g, onClose, onSaved }: { g: Partial<Guardian>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<Partial<Guardian>>(g)
  async function save() {
    if (!f.first_name || !f.last_name) return toast('Συμπλήρωσε όνομα και επώνυμο')
    const { id, ...rest } = f
    const payload = { ...rest, email: rest.email || null, phone: rest.phone || null }
    const r = id ? await sb.from('guardians').update(payload).eq('id', id) : await sb.from('guardians').insert(payload)
    if (r.error) return toast(r.error.message)
    toast('Αποθηκεύτηκε ✓'); onSaved()
  }
  const I = (k: keyof Guardian, l: string, type = 'text') => <label className="f">{l}<input type={type} value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  return <Modal title={f.id ? 'Επεξεργασία γονέα' : 'Νέος γονέας'} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    <div className="form">
      {I('first_name', 'Όνομα *')}{I('last_name', 'Επώνυμο *')}
      <label className="f">Σχέση<select value={f.relation || ''} onChange={(e) => setF({ ...f, relation: e.target.value })}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
      {I('phone', 'Κινητό', 'tel')}{I('email', 'Email', 'email')}{I('afm', 'ΑΦΜ (για αποδείξεις)')}
      <label className="check full"><input type="checkbox" checked={f.receives_emails !== false} onChange={(e) => setF({ ...f, receives_emails: e.target.checked })} />Λαμβάνει email για πληρωμές (αποδείξεις, υπενθυμίσεις)</label>
    </div>
  </Modal>
}

function MoveGuardian({ g, onClose, onDone }: { g: Guardian; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [hh, setHh] = useState<{ id: string; name: string }[]>([])
  useEffect(() => { sb.from('households').select('id,name').eq('active', true).neq('id', g.household_id).order('name').then(({ data }) => setHh(data || [])) }, [])
  async function move(hid: string | null) {
    let target = hid
    if (!target) { const n = await sb.from('households').insert({ name: `Οικογένεια ${g.last_name} (${g.first_name})` }).select('id').single(); if (n.error) return toast(n.error.message); target = n.data.id }
    await sb.from('guardians').update({ household_id: target }).eq('id', g.id)
    toast('Ο γονέας μεταφέρθηκε ✓'); onDone()
  }
  return <Modal title={`Μεταφορά: ${g.first_name} ${g.last_name}`} onClose={onClose}>
    <p className="muted" style={{ marginTop: 0 }}>Για χωρισμένους γονείς: μετέφερε τον γονέα σε δικό του λογαριασμό και σύνδεσε το παιδί και στις δύο οικογένειες με ποσοστό (π.χ. 50%-50%).</p>
    <button className="btn red block" onClick={() => move(null)}>Νέος ξεχωριστός λογαριασμός</button>
    <div className="list" style={{ marginTop: 10 }}>{hh.map((x) => <button key={x.id} className="item click" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', padding: '12px 6px' }} onClick={() => move(x.id)}><b>{x.name}</b></button>)}</div>
  </Modal>
}

function AddKid({ householdId, exclude, onClose, onDone }: { householdId: string; exclude: string[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [ps, setPs] = useState<Player[]>([])
  const [q, setQ] = useState('')
  const [share, setShare] = useState(100)
  useEffect(() => { sb.from('players').select('*').order('last_name').then(({ data }) => setPs((data || []).filter((p) => !exclude.includes(p.id)))) }, [])
  async function pick(p: Player) {
    const r = await sb.from('player_households').insert({ player_id: p.id, household_id: householdId, share_pct: share })
    if (r.error) return toast(r.error.message)
    toast(`${fullName(p)} προστέθηκε ✓`); onDone()
  }
  return <Modal title="Προσθήκη παιδιού" onClose={onClose}>
    <div className="row" style={{ marginBottom: 10 }}><input autoFocus placeholder="Αναζήτηση αθλητή…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, width: 'auto' }} />
      <select style={{ width: 110 }} value={share} onChange={(e) => setShare(Number(e.target.value))}>{[100, 75, 50, 25].map((v) => <option key={v} value={v}>{v}%</option>)}</select></div>
    <div className="list">{ps.filter((p) => fullName(p).toLowerCase().includes(q.toLowerCase())).slice(0, 40).map((p) =>
      <button key={p.id} className="item click" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', padding: '10px 6px' }} onClick={() => pick(p)}><div className="avatar">{initials(p)}</div><b>{fullName(p)}</b></button>)}</div>
    {!ps.length && <Empty title="Δεν υπάρχουν αθλητές" text="Πρόσθεσε πρώτα τον αθλητή από τη σελίδα «Αθλητές»." />}
  </Modal>
}

export function PayForm({ household, guardians, balance, canEmail, onClose, onSaved }: { household: Household; guardians: Guardian[]; balance: number; canEmail: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast, settings } = useApp()
  const [f, setF] = useState({ amount: balance > 0 ? balance.toFixed(2) : '', method: 'cash', paid_at: today(), note: '', payer: guardians[0]?.id || '' })
  const [send, setSend] = useState(canEmail && (settings?.auto_receipts ?? true))
  const [busy, setBusy] = useState(false)
  async function save() {
    const amount = Number(f.amount)
    if (!(amount > 0)) return toast('Συμπλήρωσε ποσό')
    setBusy(true)
    const r = await sb.from('payments').insert({ household_id: household.id, payer_guardian_id: f.payer || null, amount, method: f.method, paid_at: f.paid_at, note: f.note || null }).select('id').single()
    if (r.error) { setBusy(false); return toast(r.error.message) }
    const rest = balance - amount
    if (send) {
      try { const x = await receipt(r.data.id, true); toast(x.emailed ? `Καταχωρήθηκε ✓ Στάλθηκε απόδειξη${rest > 0.004 ? ` (υπόλοιπο ${eur(rest)})` : ''}` : 'Καταχωρήθηκε ✓ – η απόδειξη δεν στάλθηκε: ' + (x.error || '')) }
      catch (e) { toast('Καταχωρήθηκε ✓ – απόδειξη: ' + (e as Error).message) }
    } else toast('Η πληρωμή καταχωρήθηκε ✓')
    setBusy(false); onSaved()
  }
  const amt = Number(f.amount) || 0
  return <Modal title={`Πληρωμή – ${household.name}`} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn ok" disabled={busy} onClick={save}><CheckCircle2 size={17} />{busy ? 'Καταχώρηση…' : 'Πλήρωσε'}</button></>}>
    <div className="stack">
      <div><div className="muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>Ποιος πλήρωσε</div>
        <div className="pills">{guardians.map((g) => <button key={g.id} type="button" className={'pill' + (f.payer === g.id ? ' on' : '')} onClick={() => setF({ ...f, payer: g.id })}>{g.first_name} {g.last_name} · {g.relation}</button>)}</div></div>
      <div className="form">
        <label className="f">Ποσό €<input type="number" step="0.01" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="f">Ημερομηνία<input type="date" value={f.paid_at} onChange={(e) => setF({ ...f, paid_at: e.target.value })} /></label>
      </div>
      <div className="pills">{Object.entries(METHOD).map(([k, l]) => <button type="button" key={k} className={'pill' + (f.method === k ? ' on' : '')} onClick={() => setF({ ...f, method: k })}>{l}</button>)}</div>
      <label className="f">Σημείωση<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <div className={'note' + (balance - amt > 0.004 ? ' warn' : '')}>Υπόλοιπο πριν: <b>{eur(balance)}</b> → μετά την πληρωμή: <b>{eur(balance - amt)}</b>{balance - amt > 0.004 ? ' (θα εκκρεμεί)' : balance - amt < -0.004 ? ' (πίστωση για επόμενους μήνες)' : ' – εξόφληση'}</div>
      <label className="check"><input type="checkbox" checked={send} disabled={!canEmail} onChange={(e) => setSend(e.target.checked)} />Αποστολή απόδειξης με email στους γονείς{!canEmail && ' (δεν υπάρχει email)'}</label>
    </div>
  </Modal>
}

function ChargeForm({ householdId, onClose, onSaved }: { householdId: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState({ description: '', amount: '', due_date: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) })
  async function save() {
    if (!f.description || !(Number(f.amount) > 0)) return toast('Συμπλήρωσε περιγραφή και ποσό')
    const r = await sb.from('charges').insert({ household_id: householdId, description: f.description, amount: Number(f.amount), due_date: f.due_date })
    if (r.error) return toast(r.error.message)
    toast('Η χρέωση προστέθηκε ✓'); onSaved()
  }
  return <Modal title="Έκτακτη χρέωση" onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={save}>Προσθήκη</button></>}>
    <div className="form">
      <label className="f full">Περιγραφή<input list="desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <datalist id="desc">{['Εγγραφή', 'Αθλητική εμφάνιση', 'Φόρμα / τσάντα', 'Τουρνουά', 'Καλοκαιρινό camp', 'Ασφάλιση', 'Εκδρομή'].map((x) => <option key={x} value={x} />)}</datalist></label>
      <label className="f">Ποσό €<input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label className="f">Λήξη<input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>
    </div>
  </Modal>
}

function MergeFamily({ current, onClose, onDone }: { current: Household; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [hh, setHh] = useState<Household[]>([])
  const [q, setQ] = useState('')
  useEffect(() => { sb.from('households').select('*').eq('active', true).neq('id', current.id).order('name').then(({ data }) => setHh(data || [])) }, [])
  async function merge(other: Household) {
    if (!confirm(`Ένωση: η «${other.name}» (γονείς, παιδιά, χρεώσεις, πληρωμές) θα μεταφερθεί στην «${current.name}». Συνέχεια;`)) return
    const r = await sb.rpc('merge_households', { src: other.id, dst: current.id })
    if (r.error) return toast(r.error.message)
    await sb.from('households').delete().eq('id', other.id)
    toast('Οι οικογένειες ενώθηκαν ✓'); onDone()
  }
  return <Modal title="Ένωση οικογενειών" onClose={onClose}>
    <p className="muted" style={{ marginTop: 0 }}>Χρήσιμο όταν τα αδέρφια γράφτηκαν από διαφορετικό γονέα: μετά την ένωση χρεώνονται μαζί, με την πολιτική για 2, 3+ παιδιά.</p>
    <input autoFocus placeholder="Αναζήτηση οικογένειας…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
    <div className="list">{hh.filter((h) => h.name.toLowerCase().includes(q.toLowerCase())).map((h) =>
      <button key={h.id} className="item click" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', padding: '12px 6px' }} onClick={() => merge(h)}><Merge size={17} color="var(--red)" /><b>{h.name}</b></button>)}</div>
  </Modal>
}
