import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Upload, FileText, Mail, Download, Trash2, Phone, Plus } from 'lucide-react'
import { sb, eur, dt, age, fullName, signedUrl, STATUS, METHOD, type Player, type Team, type Charge, type Payment } from '../lib/supabase'
import { sendEmail } from '../lib/email'
import { useApp, Modal } from '../App'
import { PlayerForm } from './Players'

type FileRow = { id: string; name: string; path: string; mime: string | null; size: number | null; kind: string; uploaded_at: string }
const KIND: Record<string, string> = { medical: 'Ιατρικό', id: 'Ταυτότητα', photo: 'Φωτογραφία', consent: 'Υπεύθυνη δήλωση', other: 'Άλλο' }

export default function PlayerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toast, settings } = useApp()
  const [p, setP] = useState<Player | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [files, setFiles] = useState<FileRow[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState({ apps: 0, goals: 0, assists: 0, minutes: 0, yellow: 0, red: 0, att: 0, total: 0 })
  const [photo, setPhoto] = useState<string>()
  const [tab, setTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState('other')
  const [busy, setBusy] = useState(false)
  const [newCharge, setNewCharge] = useState(false)
  const [pay, setPay] = useState<Charge | null>(null)

  const load = async () => {
    const [a, t, f, c, pm, s] = await Promise.all([
      sb.from('players').select('*').eq('id', id).single(),
      sb.from('teams').select('*'),
      sb.from('player_files').select('*').eq('player_id', id).order('uploaded_at', { ascending: false }),
      sb.from('charges').select('*').eq('player_id', id).order('created_at', { ascending: false }),
      sb.from('payments').select('*').eq('player_id', id).order('paid_at', { ascending: false }),
      sb.from('player_stats').select('*, events(type)').eq('player_id', id),
    ])
    setP(a.data); setTeams(t.data || []); setFiles(f.data || []); setCharges(c.data || []); setPayments(pm.data || [])
    const rows = (s.data || []) as { present: boolean; minutes: number; goals: number; assists: number; yellow: number; red: number; events: { type: string } }[]
    const m = rows.filter((r) => r.events?.type === 'match' && r.present)
    setStats({ apps: m.length, goals: sum(m, 'goals'), assists: sum(m, 'assists'), minutes: sum(m, 'minutes'), yellow: sum(m, 'yellow'), red: sum(m, 'red'), att: rows.filter((r) => r.present).length, total: rows.length })
    if (a.data?.photo_path) setPhoto(await signedUrl(a.data.photo_path))
  }
  useEffect(() => { load() }, [id])
  if (!p) return null

  const balance = charges.filter((c) => c.status === 'pending' || c.status === 'partial').reduce((x, c) => x + c.amount - c.paid_amount, 0)

  async function upload(e: React.ChangeEvent<HTMLInputElement>, asPhoto = false) {
    const list = Array.from(e.target.files || []); if (!list.length) return
    setBusy(true)
    for (const file of list) {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const up = await sb.storage.from('player-files').upload(path, file)
      if (up.error) { toast('Σφάλμα: ' + up.error.message); continue }
      if (asPhoto) await sb.from('players').update({ photo_path: path }).eq('id', id)
      else await sb.from('player_files').insert({ player_id: id, name: file.name, path, mime: file.type, size: file.size, kind })
    }
    setBusy(false); toast('Ανέβηκε ✓'); e.target.value = ''; load()
  }
  async function openFile(f: FileRow) { const u = await signedUrl(f.path); if (u) window.open(u, '_blank') }
  async function delFile(f: FileRow) {
    if (!confirm(`Διαγραφή «${f.name}»;`)) return
    await sb.storage.from('player-files').remove([f.path]); await sb.from('player_files').delete().eq('id', f.id); load()
  }
  async function pdf(send: boolean) {
    if (!settings || !p) return
    setBusy(true)
    try {
      const { chargesPdf, pdfBase64 } = await import('../lib/pdf')
      const doc = await chargesPdf(p, charges.filter((c) => c.status !== 'paid'), settings)
      const fname = `Xrewseis_${p.last_name}_${p.first_name}.pdf`
      if (!send) { doc.save(fname); return }
      if (!p.guardian_email) return toast('Δεν υπάρχει email κηδεμόνα')
      await sendEmail({
        to: p.guardian_email, kind: 'charges', player_id: p.id,
        subject: `${settings.club_name} – Κατάσταση χρεώσεων ${fullName(p)}`,
        html: `<p>Αγαπητέ/ή ${p.guardian_name || 'γονέα'},</p><p>Σας επισυνάπτουμε την κατάσταση χρεώσεων για τον/την <b>${fullName(p)}</b>. Υπόλοιπο: <b>${eur(balance)}</b>.</p>${settings.iban ? `<p>IBAN: ${settings.iban}</p>` : ''}<p>${settings.email_footer || ''}</p><p>${settings.club_name}</p>`,
        attachments: [{ filename: fname, content: pdfBase64(doc) }],
      })
      toast('Στάλθηκε email ✓')
    } catch (err) { toast((err as Error).message) } finally { setBusy(false) }
  }
  async function cancelCharge(c: Charge) { if (confirm('Ακύρωση χρέωσης;')) { await sb.from('charges').update({ status: 'cancelled' }).eq('id', c.id); load() } }
  async function toggleActive() { await sb.from('players').update({ active: !p!.active }).eq('id', id); load() }
  async function remove() { if (confirm('Οριστική διαγραφή παίκτη και όλων των δεδομένων του;')) { await sb.from('players').delete().eq('id', id); nav('/players') } }

  return (
    <>
      <button className="btn ghost sm" onClick={() => nav(-1)} style={{ marginBottom: 10 }}><ArrowLeft size={16} />Πίσω</button>
      <div className="card row" style={{ marginBottom: 12 }}>
        <label style={{ cursor: 'pointer' }} title="Αλλαγή φωτογραφίας">
          {photo ? <img src={photo} className="avatar lg" /> : <div className="avatar lg">{p.first_name[0]}{p.last_name[0]}</div>}
          <input type="file" accept="image/*" hidden onChange={(e) => upload(e, true)} />
        </label>
        <div className="grow">
          <h1 style={{ margin: 0 }}>{fullName(p)} {p.jersey_number != null && <span className="muted">#{p.jersey_number}</span>}</h1>
          <div className="muted">{[teams.find((t) => t.id === p.team_id)?.name, p.position, age(p.birth_date) != null && `${age(p.birth_date)} ετών`].filter(Boolean).join(' · ')}</div>
          <div style={{ marginTop: 6 }}>{balance > 0 ? <span className="badge b-over">Οφειλή {eur(balance)}</span> : <span className="badge b-paid">Χωρίς οφειλές</span>} {!p.active && <span className="badge">Ανενεργός</span>}</div>
        </div>
        <div className="row">
          {p.guardian_phone && <a className="btn ghost sm" href={`tel:${p.guardian_phone}`}><Phone size={16} />Κλήση</a>}
          <button className="btn sm" onClick={() => setEditing(true)}><Pencil size={16} />Επεξεργασία</button>
        </div>
      </div>

      <div className="tabs">{[['info', 'Στοιχεία'], ['charges', 'Χρεώσεις'], ['files', `Αρχεία (${files.length})`], ['stats', 'Στατιστικά']].map(([k, l]) =>
        <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'info' && <div className="card"><div className="form">
        {[['Ημ. γέννησης', dt(p.birth_date)], ['Κηδεμόνας', p.guardian_name], ['Τηλέφωνο', p.guardian_phone], ['Email', p.guardian_email], ['2ος κηδεμόνας', [p.guardian2_name, p.guardian2_phone].filter(Boolean).join(' · ')],
          ['Διεύθυνση', p.address], ['ΑΜΚΑ', p.amka], ['Κάρτα υγείας έως', dt(p.medical_expiry)], ['Ιατρικά', p.medical_notes], ['Οικογένεια', p.family_code], ['Συνδρομή', p.monthly_fee ? eur(p.monthly_fee) : 'Προεπιλογή'], ['Έκπτωση', `${p.discount_pct || 0}%`], ['Σημειώσεις', p.notes]]
          .map(([l, v]) => <div key={l}><div className="muted">{l}</div><div>{v || '—'}</div></div>)}
      </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn ghost sm" onClick={toggleActive}>{p.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}</button>
          <button className="btn danger sm" onClick={remove}><Trash2 size={15} />Διαγραφή</button>
        </div>
      </div>}

      {tab === 'charges' && <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn sm" onClick={() => setNewCharge(true)}><Plus size={16} />Νέα χρέωση</button>
          <button className="btn ghost sm" disabled={busy} onClick={() => pdf(false)}><Download size={16} />PDF</button>
          <button className="btn ghost sm" disabled={busy} onClick={() => pdf(true)}><Mail size={16} />Αποστολή PDF με email</button>
        </div>
        <div className="scroll"><table><thead><tr><th>Περιγραφή</th><th>Λήξη</th><th>Ποσό</th><th>Πληρώθηκε</th><th>Κατάσταση</th><th></th></tr></thead><tbody>
          {charges.map((c) => <tr key={c.id}><td>{c.description}</td><td>{dt(c.due_date)}</td><td>{eur(c.amount)}</td><td>{eur(c.paid_amount)}</td>
            <td><span className={`badge b-${c.status}`}>{STATUS[c.status]}</span></td>
            <td className="row" style={{ flexWrap: 'nowrap' }}>{(c.status === 'pending' || c.status === 'partial') && <><button className="btn sm" onClick={() => setPay(c)}>Πληρωμή</button><button className="btn ghost sm" onClick={() => cancelCharge(c)}>✕</button></>}</td></tr>)}
        </tbody></table></div>
        {!charges.length && <div className="empty">Καμία χρέωση ακόμα</div>}
        {payments.length > 0 && <><h2 style={{ marginTop: 18 }}>Πληρωμές</h2><div className="list">{payments.map((x) =>
          <div className="item" key={x.id}><div className="grow">{dt(x.paid_at)} · {METHOD[x.method]}<div className="muted">{x.note}</div></div><b>{eur(x.amount)}</b></div>)}</div></>}
      </div>}

      {tab === 'files' && <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 'auto' }}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label className="btn sm" style={{ cursor: 'pointer' }}><Upload size={16} />{busy ? 'Ανέβασμα…' : 'Ανέβασμα αρχείων'}<input type="file" multiple hidden onChange={(e) => upload(e)} /></label>
        </div>
        {files.length ? <div className="list">{files.map((f) => (
          <div className="item" key={f.id}><FileText size={22} />
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => openFile(f)}><b>{f.name}</b><div className="muted">{KIND[f.kind]} · {dt(f.uploaded_at)} · {((f.size || 0) / 1024).toFixed(0)} KB</div></div>
            <button className="btn ghost sm" onClick={() => delFile(f)}><Trash2 size={15} /></button></div>
        ))}</div> : <div className="empty">Ανέβασε κάρτα υγείας, ταυτότητα, υπεύθυνη δήλωση, φωτογραφίες…</div>}
      </div>}

      {tab === 'stats' && <div className="grid">
        {[['Συμμετοχές', stats.apps], ['Γκολ', stats.goals], ['Ασίστ', stats.assists], ['Λεπτά', stats.minutes], ['Κίτρινες', stats.yellow], ['Κόκκινες', stats.red],
          ['Παρουσία', stats.total ? Math.round((stats.att / stats.total) * 100) + '%' : '—']].map(([l, v]) =>
          <div className="card kpi" key={l as string}><div className="v">{v}</div><div className="l">{l}</div></div>)}
      </div>}

      {editing && <PlayerForm player={p} teams={teams} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
      {newCharge && <ChargeForm playerId={p.id} onClose={() => setNewCharge(false)} onSaved={() => { setNewCharge(false); load() }} />}
      {pay && <PayForm charge={pay} onClose={() => setPay(null)} onSaved={() => { setPay(null); load() }} />}
    </>
  )
}

const sum = <T,>(a: T[], k: keyof T) => a.reduce((x, r) => x + (Number(r[k]) || 0), 0)

export function ChargeForm({ playerId, onClose, onSaved }: { playerId: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState({ description: '', amount: '', due_date: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10) })
  async function save(e: React.FormEvent) {
    e.preventDefault()
    const r = await sb.from('charges').insert({ player_id: playerId, description: f.description, amount: Number(f.amount), due_date: f.due_date })
    if (r.error) return toast(r.error.message)
    toast('Η χρέωση προστέθηκε ✓'); onSaved()
  }
  return <Modal title="Νέα χρέωση" onClose={onClose}><form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
    <label>Περιγραφή<input list="desc" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <datalist id="desc">{['Εγγραφή', 'Εμφάνιση / στολή', 'Τουρνουά', 'Καλοκαιρινό camp', 'Ασφάλιση', 'Εκδρομή'].map((x) => <option key={x} value={x} />)}</datalist></label>
    <label>Ποσό €<input type="number" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
    <label>Λήξη<input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>
    <button className="btn" style={{ justifyContent: 'center' }}>Προσθήκη</button>
  </form></Modal>
}

export function PayForm({ charge, onClose, onSaved }: { charge: Charge; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState({ amount: String((charge.amount - charge.paid_amount).toFixed(2)), method: 'cash', paid_at: new Date().toISOString().slice(0, 10), note: '' })
  async function save(e: React.FormEvent) {
    e.preventDefault()
    const r = await sb.from('payments').insert({ charge_id: charge.id, player_id: charge.player_id, amount: Number(f.amount), method: f.method, paid_at: f.paid_at, note: f.note || null })
    if (r.error) return toast(r.error.message)
    toast('Η πληρωμή καταχωρήθηκε ✓'); onSaved()
  }
  return <Modal title={`Πληρωμή: ${charge.description}`} onClose={onClose}><form onSubmit={save} style={{ display: 'grid', gap: 12 }}>
    <label>Ποσό €<input type="number" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
    <div className="row">{Object.entries(METHOD).map(([k, l]) => <button type="button" key={k} className={'tab' + (f.method === k ? ' on' : '')} onClick={() => setF({ ...f, method: k })}>{l}</button>)}</div>
    <label>Ημερομηνία<input type="date" value={f.paid_at} onChange={(e) => setF({ ...f, paid_at: e.target.value })} /></label>
    <label>Σημείωση<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
    <button className="btn" style={{ justifyContent: 'center' }}>Καταχώρηση πληρωμής</button>
  </form></Modal>
}
