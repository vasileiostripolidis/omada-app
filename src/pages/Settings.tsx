import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { sb, eur, uploadPublic, policyTotal, type Settings } from '../lib/supabase'
import { useApp, PageHead } from '../ui'

type Profile = { id: string; email: string; full_name: string; role: string }

export default function SettingsPage() {
  const { settings, reloadSettings, toast, role, email } = useApp()
  const [f, setF] = useState<Settings | null>(settings)
  const [users, setUsers] = useState<Profile[]>([])
  const [log, setLog] = useState<{ id: string; to_email: string; subject: string; kind: string; status: string; error: string | null; sent_at: string }[]>([])
  const admin = role === 'admin'
  useEffect(() => { setF(settings) }, [settings])
  const loadUsers = () => sb.from('profiles').select('*').order('created_at').then(({ data }) => setUsers(data || []))
  useEffect(() => { loadUsers(); sb.from('email_log').select('*').order('sent_at', { ascending: false }).limit(15).then(({ data }) => setLog(data || [])) }, [])
  if (!f) return null

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })
  const I = (k: keyof Settings, l: string, type = 'text', extra: Record<string, unknown> = {}) =>
    <label className="f">{l}<input type={type} value={(f[k] as string | number) ?? ''} onChange={set(k)} {...extra} /></label>

  async function save() {
    const r = await sb.from('club_settings').update(f!).eq('id', 1)
    if (r.error) return toast(r.error.message)
    reloadSettings(); toast('Οι ρυθμίσεις αποθηκεύτηκαν ✓')
  }
  async function logo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try { setF({ ...f!, logo_url: await uploadPublic(file, 'club') }) } catch (err) { toast((err as Error).message) }
  }
  async function setRole(u: Profile, r: string) { await sb.from('profiles').update({ role: r }).eq('id', u.id); loadUsers() }

  return (
    <>
      <PageHead eyebrow="Διαχείριση" title="Ρυθμίσεις">{admin && <button className="btn red" onClick={save}>Αποθήκευση</button>}</PageHead>
      <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <div className="card">
          <h2>Πολιτική πληρωμών</h2>
          <p className="muted" style={{ marginTop: 0 }}>Μηνιαίο σύνολο ανά οικογένεια, ανάλογα με τον αριθμό των ενεργών παιδιών. Ισχύει για όλες τις οικογένειες εκτός αν τους ορίσεις ειδική τιμή.</p>
          <div className="form">
            {I('fee_1', '1 παιδί (€/μήνα)', 'number', { step: '0.01' })}{I('fee_2', '2 παιδιά – σύνολο (€/μήνα)', 'number', { step: '0.01' })}
            {I('fee_3', '3 παιδιά – σύνολο (€/μήνα)', 'number', { step: '0.01' })}{I('fee_extra', 'Κάθε επιπλέον παιδί (+€)', 'number', { step: '0.01' })}
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            Ανά παιδί: 1 → <b>{eur(policyTotal(f, 1))}</b> · 2 → <b>{eur(policyTotal(f, 2) / 2)}</b> · 3 → <b>{eur(policyTotal(f, 3) / 3)}</b> · 4 → <b>{eur(policyTotal(f, 4) / 4)}</b> (σύνολο {eur(policyTotal(f, 4))}).
            Για παιδί χωρισμένων γονιών με ποσοστό 50%-50%, κάθε λογαριασμός χρεώνεται το μισό.
          </div>
        </div>

        <div className="card">
          <h2>Αυτοματισμοί</h2>
          <div className="form">
            {I('charge_day', 'Ημέρα χρέωσης', 'number', { min: 1, max: 28 })}{I('due_days', 'Προθεσμία πληρωμής (ημέρες)', 'number')}
            {I('reminder_day_1', '1η υπενθύμιση (ημέρα μήνα)', 'number', { min: 1, max: 28 })}{I('reminder_day_2', '2η υπενθύμιση (ημέρα μήνα)', 'number', { min: 1, max: 28 })}
            <label className="check full"><input type="checkbox" checked={f.auto_family_charges} onChange={set('auto_family_charges')} />Αυτόματη δημιουργία μηνιαίων χρεώσεων (ίδιες με τον προηγούμενο μήνα, εκτός αν αλλάξει κάτι στην οικογένεια)</label>
            <label className="check full"><input type="checkbox" checked={f.auto_reminders} onChange={set('auto_reminders')} />Αυτόματο email υπενθύμισης οφειλών με PDF στις {f.reminder_day_1} και {f.reminder_day_2} του μήνα (10:00)</label>
            <label className="check full"><input type="checkbox" checked={f.auto_receipts} onChange={set('auto_receipts')} />Αυτόματη αποστολή απόδειξης όταν καταχωρείται πληρωμή</label>
          </div>
        </div>

        <div className="card">
          <h2>Σύλλογος</h2>
          <div className="form">
            <div className="full row">{f.logo_url && <img src={f.logo_url} alt="" style={{ height: 70 }} />}
              <label className="btn ghost" style={{ cursor: 'pointer' }}><Upload size={16} />Αλλαγή λογοτύπου<input type="file" accept="image/png" hidden onChange={logo} /></label></div>
            {I('club_name', 'Επωνυμία')}{I('afm', 'ΑΦΜ')}{I('phone', 'Τηλέφωνο')}{I('email', 'Email')}{I('address', 'Διεύθυνση')}{I('website', 'Ιστοσελίδα')}
            <label className="f full">IBAN (εμφανίζεται σε καταστάσεις & υπενθυμίσεις)<input value={f.iban || ''} onChange={set('iban')} /></label>
            <label className="f full">Υποσέλιδο email / PDF<textarea rows={2} value={f.email_footer || ''} onChange={set('email_footer')} /></label>
          </div>
        </div>
      </fieldset>

      <div className="card flush" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Χρήστες εφαρμογής</h2></div>
        <div className="list">{users.map((u) => <div className="item" key={u.id}>
          <div className="grow"><div className="t">{u.full_name}</div><div className="muted">{u.email}{u.email === email ? ' (εσύ)' : ''}</div></div>
          {admin && u.email !== email ? <select style={{ width: 'auto' }} value={u.role} onChange={(e) => setRole(u, e.target.value)}>
            <option value="pending">Σε αναμονή</option><option value="coach">Προπονητής</option><option value="admin">Διαχειριστής</option></select>
            : <span className="badge b-navy">{({ admin: 'Διαχειριστής', coach: 'Προπονητής', pending: 'Σε αναμονή' } as Record<string, string>)[u.role]}</span>}
        </div>)}</div>
        <div className="item muted">Νέοι χρήστες (π.χ. προπονητές) κάνουν εγγραφή από τη σελίδα σύνδεσης και τους εγκρίνεις εδώ.</div>
      </div>

      <div className="card flush" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Ιστορικό email</h2></div>
        {log.length ? <div className="scroll"><table><thead><tr><th>Ημ/νία</th><th>Θέμα</th><th>Προς</th><th>Κατάσταση</th></tr></thead><tbody>
          {log.map((l) => <tr key={l.id}><td>{new Date(l.sent_at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{l.subject}</td><td className="muted">{l.to_email}</td>
            <td>{l.status === 'sent' ? <span className="badge b-ok">Στάλθηκε</span> : <span className="badge b-bad" title={l.error || ''}>Απέτυχε</span>}</td></tr>)}
        </tbody></table></div> : <div className="empty">Δεν έχουν σταλεί email ακόμα</div>}
      </div>
    </>
  )
}
