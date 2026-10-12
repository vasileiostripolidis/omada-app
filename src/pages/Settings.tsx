import { useEffect, useState } from 'react'
import { sb, type Settings } from '../lib/supabase'
import { useApp } from '../App'

type Profile = { id: string; email: string; full_name: string; role: string }

export default function SettingsPage() {
  const { settings, reloadSettings, toast, role, email } = useApp()
  const [f, setF] = useState<Settings | null>(settings)
  const [users, setUsers] = useState<Profile[]>([])
  const admin = role === 'admin'
  useEffect(() => { setF(settings) }, [settings])
  const loadUsers = () => sb.from('profiles').select('*').order('created_at').then(({ data }) => setUsers(data || []))
  useEffect(() => { loadUsers() }, [])
  if (!f) return null

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const r = await sb.from('club_settings').update(f!).eq('id', 1)
    if (r.error) return toast(r.error.message)
    reloadSettings(); toast('Αποθηκεύτηκε ✓')
  }
  async function logo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const path = `logo-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const up = await sb.storage.from('club').upload(path, file)
    if (up.error) return toast(up.error.message)
    const url = sb.storage.from('club').getPublicUrl(path).data.publicUrl
    setF({ ...f!, logo_url: url })
  }
  async function setRole(u: Profile, r: string) { await sb.from('profiles').update({ role: r }).eq('id', u.id); loadUsers() }

  return (
    <>
      <h1>Ρυθμίσεις</h1>
      <form className="card" onSubmit={save} style={{ marginBottom: 14 }}>
        <h2>Σύλλογος</h2>
        <fieldset disabled={!admin} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form">
            <label>Όνομα συλλόγου<input value={f.club_name} onChange={set('club_name')} /></label>
            <label>Τηλέφωνο<input value={f.phone || ''} onChange={set('phone')} /></label>
            <label>Email<input value={f.email || ''} onChange={set('email')} /></label>
            <label>Διεύθυνση<input value={f.address || ''} onChange={set('address')} /></label>
            <label>IBAN (εμφανίζεται στα PDF)<input value={f.iban || ''} onChange={set('iban')} /></label>
            <label>Χρώμα συλλόγου<input type="color" value={f.primary_color || '#0f7a3d'} onChange={set('primary_color')} style={{ height: 44 }} /></label>
            <label>Λογότυπο<input type="file" accept="image/*" onChange={logo} /></label>
            {f.logo_url && <img src={f.logo_url} style={{ height: 60, objectFit: 'contain' }} />}
          </div>
          <h2 style={{ marginTop: 18 }}>Χρεώσεις</h2>
          <div className="form">
            <label>Μηνιαία συνδρομή € (προεπιλογή)<input type="number" step="0.01" value={f.default_monthly_fee} onChange={set('default_monthly_fee')} /></label>
            <label>Έκπτωση αδερφών %<input type="number" value={f.sibling_discount_pct} onChange={set('sibling_discount_pct')} /></label>
            <label>Ημέρα αυτόματης χρέωσης (1-28)<input type="number" min={1} max={28} value={f.charge_day} onChange={set('charge_day')} /></label>
            <label>Προθεσμία πληρωμής (ημέρες)<input type="number" value={f.due_days} onChange={set('due_days')} /></label>
          </div>
          <label className="row" style={{ gap: 6, marginTop: 12 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.auto_charges} onChange={set('auto_charges')} />Αυτόματη δημιουργία μηνιαίων χρεώσεων</label>
          <label style={{ marginTop: 12 }}>Υποσέλιδο email / PDF<textarea rows={2} value={f.email_footer || ''} onChange={set('email_footer')} /></label>
          {admin && <button className="btn" style={{ marginTop: 14 }}>Αποθήκευση</button>}
        </fieldset>
      </form>

      <div className="card">
        <h2>Χρήστες</h2>
        <p className="muted">Όποιος θέλει πρόσβαση (π.χ. προπονητές) φτιάχνει λογαριασμό από τη σελίδα σύνδεσης και τον εγκρίνεις εδώ.</p>
        <div className="list">{users.map((u) => <div className="item" key={u.id}>
          <div className="grow"><b>{u.full_name}</b><div className="muted">{u.email}{u.email === email ? ' (εσύ)' : ''}</div></div>
          {admin && u.email !== email ? <select style={{ width: 'auto' }} value={u.role} onChange={(e) => setRole(u, e.target.value)}>
            <option value="pending">Σε αναμονή</option><option value="coach">Προπονητής</option><option value="admin">Διαχειριστής</option></select>
            : <span className="badge">{({ admin: 'Διαχειριστής', coach: 'Προπονητής', pending: 'Σε αναμονή' } as Record<string, string>)[u.role]}</span>}
        </div>)}</div>
      </div>
    </>
  )
}
