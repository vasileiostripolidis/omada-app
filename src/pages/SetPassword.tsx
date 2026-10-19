import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { sb, BRAND } from '../lib/supabase'

// Ορισμός νέου κωδικού μετά από σύνδεσμο «Ξέχασα τον κωδικό»
export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState(''), [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    if (pw.length < 6) return setMsg('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.')
    if (pw !== pw2) return setMsg('Οι δύο κωδικοί δεν ταιριάζουν.')
    setBusy(true); const { error } = await sb.auth.updateUser({ password: pw }); setBusy(false)
    if (error) return setMsg(error.message)
    onDone()
  }
  return <div className="login"><div className="art"><div><img src={BRAND + 'pss-logo.png'} alt="Patras Schools Soccer" /></div></div>
    <form onSubmit={go}>
      <div><div className="eyebrow">Ασφάλεια</div><h1><KeyRound size={26} style={{ verticalAlign: -3 }} /> Νέος κωδικός</h1></div>
      <label className="f">Νέος κωδικός<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} /></label>
      <label className="f">Επανάληψη κωδικού<input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={6} /></label>
      {msg && <div className="note warn">{msg}</div>}
      <button className="btn red block" disabled={busy} style={{ padding: 13 }}>{busy ? '…' : 'Αποθήκευση κωδικού'}</button>
    </form></div>
}
