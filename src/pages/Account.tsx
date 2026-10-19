import { useEffect, useState } from 'react'
import { UserRound, KeyRound, ShieldCheck, FileText, Phone, Mail, MapPin, Globe, Trash2, LogOut } from 'lucide-react'
import { sb, ROLES } from '../lib/supabase'
import { useApp, Modal } from '../ui'
import { useLang } from '../lib/i18n'
import { isNative, platform, openUrl } from '../lib/native'
import PushToggle from '../components/PushToggle'
import { TwoFactor } from '../components/Admin'

type Club = { club_name?: string; phone?: string; email?: string; address?: string; website?: string }

// «Ο λογαριασμός μου»: στοιχεία, κωδικός, ειδοποιήσεις, απόρρητο, επικοινωνία, διαγραφή λογαριασμού
export default function Account() {
  const { email, role, toast } = useApp()
  const { lang } = useLang(); const en = lang === 'en'
  const [name, setName] = useState('')
  const [club, setClub] = useState<Club>({})
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState('')
  const [del, setDel] = useState(false)
  useEffect(() => {
    sb.auth.getUser().then(({ data }) => setName((data.user?.user_metadata?.full_name as string) || ''))
    sb.rpc('public_club_info').then(({ data }) => setClub(data || {}))
  }, [])
  async function changePw(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 6) return toast(en ? 'At least 6 characters' : 'Τουλάχιστον 6 χαρακτήρες')
    if (pw !== pw2) return toast(en ? 'Passwords do not match' : 'Οι κωδικοί δεν ταιριάζουν')
    const { error } = await sb.auth.updateUser({ password: pw })
    if (error) return toast(error.message)
    setPw(''); setPw2(''); toast(en ? 'Password changed ✓' : 'Ο κωδικός άλλαξε ✓')
  }
  async function saveName() { const { error } = await sb.auth.updateUser({ data: { full_name: name } }); if (!error) await sb.from('profiles').update({ full_name: name }).eq('id', (await sb.auth.getUser()).data.user!.id); toast(error ? error.message : (en ? 'Saved ✓' : 'Αποθηκεύτηκε ✓')) }
  const web = club.website ? (club.website.startsWith('http') ? club.website : 'https://' + club.website) : ''
  return <div className="stack" style={{ maxWidth: 760 }}>
    <div className="card row" style={{ gap: 14 }}><div className="avatar lg"><UserRound size={26} /></div>
      <div className="grow"><h2 style={{ margin: 0 }}>{name || email}</h2><div className="muted">{email} · {ROLES[role] || role}</div></div>
      <button className="btn ghost" onClick={() => sb.auth.signOut()}><LogOut size={16} />{en ? 'Sign out' : 'Αποσύνδεση'}</button></div>

    <div className="card"><h2>{en ? 'My details' : 'Τα στοιχεία μου'}</h2>
      <div className="row"><label className="f grow">{en ? 'Full name' : 'Ονοματεπώνυμο'}<input value={name} onChange={(e) => setName(e.target.value)} /></label><button className="btn ghost" style={{ alignSelf: 'end' }} onClick={saveName}>{en ? 'Save' : 'Αποθήκευση'}</button></div></div>

    <form className="card" onSubmit={changePw}><h2><KeyRound size={17} style={{ verticalAlign: -3 }} /> {en ? 'Change password' : 'Αλλαγή κωδικού'}</h2>
      <div className="form"><label className="f">{en ? 'New password' : 'Νέος κωδικός'}<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="f">{en ? 'Repeat' : 'Επανάληψη'}<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label></div>
      <button className="btn" style={{ marginTop: 10 }} disabled={!pw}>{en ? 'Change' : 'Αλλαγή'}</button></form>

    <PushToggle lang={lang} toast={toast} />
    {role !== 'parent' && <TwoFactor />}

    <div className="card"><h2>{en ? 'Contact the academy' : 'Επικοινωνία με την ακαδημία'}</h2>
      <div className="list">
        <div className="item"><b className="grow">{club.club_name || 'Patras Schools Soccer'}</b></div>
        {club.phone && <a className="item" href={`tel:${club.phone}`}><Phone size={16} /><span className="grow">{club.phone}</span></a>}
        {club.email && <a className="item" href={`mailto:${club.email}`}><Mail size={16} /><span className="grow">{club.email}</span></a>}
        {club.address && <div className="item"><MapPin size={16} /><span className="grow">{club.address}</span></div>}
        {web && <a className="item" href={web} onClick={(e) => { e.preventDefault(); openUrl(web) }}><Globe size={16} /><span className="grow">{club.website}</span></a>}
      </div></div>

    <div className="card"><h2><ShieldCheck size={17} style={{ verticalAlign: -3 }} /> {en ? 'Privacy' : 'Απόρρητο'}</h2>
      <div className="row"><a className="btn ghost" href="#/privacy"><FileText size={15} />{en ? 'Privacy Policy' : 'Πολιτική Απορρήτου'}</a><a className="btn ghost" href="#/terms"><FileText size={15} />{en ? 'Terms of Participation' : 'Όροι Συμμετοχής'}</a></div>
      <p className="muted" style={{ marginBottom: 0 }}>{en ? 'You can withdraw consents or request a copy of your data at any time from the academy office.' : 'Μπορείτε να ανακαλέσετε συγκαταθέσεις ή να ζητήσετε αντίγραφο των δεδομένων σας ανά πάσα στιγμή από τη γραμματεία.'}</p></div>

    <div className="card" style={{ borderColor: 'var(--bad-bg)' }}><h2 style={{ color: 'var(--red)' }}><Trash2 size={17} style={{ verticalAlign: -3 }} /> {en ? 'Delete account' : 'Διαγραφή λογαριασμού'}</h2>
      <p className="muted">{en ? 'Permanently deletes your sign-in account and app access. The records the academy must keep by law (registration, payments) remain with the office, no longer linked to you.' : 'Διαγράφει οριστικά τον λογαριασμό σύνδεσης και την πρόσβασή σας στην εφαρμογή. Τα στοιχεία που η ακαδημία οφείλει να τηρεί από τον νόμο (εγγραφή, πληρωμές) παραμένουν στη γραμματεία, χωρίς σύνδεση με εσάς.'}</p>
      <button className="btn danger" onClick={() => setDel(true)}><Trash2 size={15} />{en ? 'Delete my account' : 'Διαγραφή του λογαριασμού μου'}</button></div>

    {isNative() && <div className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Patras Schools Soccer · {platform() === 'ios' ? 'iOS' : 'Android'}</div>}
    {del && <DeleteModal en={en} onClose={() => setDel(false)} />}
  </div>
}

function DeleteModal({ en, onClose }: { en: boolean; onClose: () => void }) {
  const { toast } = useApp()
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const word = en ? 'DELETE' : 'ΔΙΑΓΡΑΦΗ'
  async function go() {
    setBusy(true)
    const { data, error } = await sb.functions.invoke('account', { body: { action: 'delete' } })
    let msg = (data as { error?: string } | null)?.error
    if (error) { try { msg = (await (error as { context?: Response }).context?.json())?.error || error.message } catch { msg = error.message } }
    setBusy(false)
    if (msg) return toast(msg)
    await sb.auth.signOut()
    window.location.hash = '#/'
  }
  return <Modal title={en ? 'Delete account' : 'Διαγραφή λογαριασμού'} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>{en ? 'Cancel' : 'Άκυρο'}</button><button className="btn danger" disabled={busy || txt.trim().toUpperCase() !== word} onClick={go}>{busy ? '…' : (en ? 'Delete permanently' : 'Οριστική διαγραφή')}</button></>}>
    <div className="stack">
      <div className="note warn">{en ? 'This cannot be undone. You will be signed out and will need a new invitation to use the app again.' : 'Δεν αναιρείται. Θα αποσυνδεθείτε και για να ξαναχρησιμοποιήσετε την εφαρμογή θα χρειαστείτε νέα πρόσκληση.'}</div>
      <label className="f">{en ? `Type ${word} to confirm` : `Γράψτε ${word} για επιβεβαίωση`}<input value={txt} onChange={(e) => setTxt(e.target.value)} autoCapitalize="characters" /></label>
    </div></Modal>
}
