import { useState } from 'react'
import { sb } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    const r = mode === 'in'
      ? await sb.auth.signInWithPassword({ email, password: pw })
      : await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name } } })
    setBusy(false)
    if (r.error) setErr(r.error.message === 'Invalid login credentials' ? 'Λάθος email ή κωδικός' : r.error.message)
    else if (mode === 'up' && !r.data.session) setErr('Σου στείλαμε email επιβεβαίωσης. Άνοιξέ το και μετά συνδέσου.')
  }

  return (
    <div className="login">
      <form className="card" style={{ width: 'min(400px,100%)', display: 'grid', gap: 12 }} onSubmit={submit}>
        <div style={{ fontSize: 44, textAlign: 'center' }}>⚽</div>
        <h1 style={{ textAlign: 'center', margin: 0 }}>{mode === 'in' ? 'Σύνδεση' : 'Νέος λογαριασμός'}</h1>
        {mode === 'up' && <label>Ονοματεπώνυμο<input value={name} onChange={(e) => setName(e.target.value)} required /></label>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Κωδικός<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {err && <div className="muted" style={{ color: 'var(--danger)' }}>{err}</div>}
        <button className="btn" disabled={busy} style={{ justifyContent: 'center' }}>{busy ? '...' : mode === 'in' ? 'Είσοδος' : 'Δημιουργία'}</button>
        <button type="button" className="btn ghost" style={{ justifyContent: 'center' }} onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Δεν έχω λογαριασμό' : 'Έχω ήδη λογαριασμό'}
        </button>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>Ο πρώτος λογαριασμός γίνεται αυτόματα διαχειριστής.</p>
      </form>
    </div>
  )
}
