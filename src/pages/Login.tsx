import { useState } from 'react'
import { sb, BRAND } from '../lib/supabase'
import { WEB_APP } from '../lib/native'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true)
    const redirect = WEB_APP
    if (mode === 'reset') {
      const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect })
      setBusy(false)
      return setMsg(r.error ? { t: r.error.message } : { t: 'Σου στείλαμε email για αλλαγή κωδικού.', ok: true })
    }
    const r = mode === 'in'
      ? await sb.auth.signInWithPassword({ email, password: pw })
      : await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name }, emailRedirectTo: redirect } })
    setBusy(false)
    if (r.error) setMsg({ t: r.error.message === 'Invalid login credentials' ? 'Λάθος email ή κωδικός' : r.error.message })
    else if (mode === 'up' && !r.data.session) setMsg({ t: 'Σου στείλαμε email επιβεβαίωσης. Άνοιξέ το και μετά συνδέσου.', ok: true })
  }

  return (
    <div className="login">
      <div className="art"><div><img src={BRAND + 'pss-logo.png'} alt="Patras Schools Soccer" /><div className="t">Patras Schools Soccer</div><div className="s">Ακαδημία Ποδοσφαίρου</div></div></div>
      <form onSubmit={submit}>
        <div><div className="eyebrow">Διαχείριση συλλόγου</div>
          <h1>{mode === 'in' ? 'Σύνδεση' : mode === 'up' ? 'Νέος λογαριασμός' : 'Ξέχασα τον κωδικό'}</h1></div>
        {mode === 'up' && <label className="f">Ονοματεπώνυμο<input value={name} onChange={(e) => setName(e.target.value)} required /></label>}
        <label className="f">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        {mode !== 'reset' && <label className="f">Κωδικός<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>}
        {msg && <div className={'note' + (msg.ok ? '' : ' warn')}>{msg.t}</div>}
        <button className="btn red block" disabled={busy} style={{ padding: 13 }}>{busy ? '…' : mode === 'in' ? 'Είσοδος' : mode === 'up' ? 'Δημιουργία λογαριασμού' : 'Αποστολή συνδέσμου'}</button>
        <div className="row between">
          <button type="button" className="btn ghost sm" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Δημιουργία λογαριασμού' : 'Έχω λογαριασμό'}</button>
          {mode === 'in' && <button type="button" className="btn ghost sm" onClick={() => setMode('reset')}>Ξέχασα τον κωδικό</button>}
        </div>
        <div className="muted" style={{ textAlign: 'center', fontSize: 12.5 }}><a href="#/register">Ηλεκτρονική εγγραφή αθλητή</a> · <a href="#/privacy">Πολιτική απορρήτου</a> · <a href="#/terms">Όροι</a></div>
      </form>
    </div>
  )
}
