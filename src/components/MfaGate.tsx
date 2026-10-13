import { useEffect, useState, type ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { sb, BRAND } from '../lib/supabase'

// Αν ο χρήστης έχει ενεργοποιήσει σύνδεση 2 βημάτων, ζητείται ο 6ψήφιος κωδικός πριν μπει στην εφαρμογή
export default function MfaGate({ children }: { children: ReactNode }) {
  const [need, setNeed] = useState<boolean | null>(null)
  const [factor, setFactor] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    (async () => {
      const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
      if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
        const f = await sb.auth.mfa.listFactors()
        const v = (f.data?.totp || []).find((x) => x.status === 'verified')
        if (v) { setFactor(v.id); setNeed(true); return }
      }
      setNeed(false)
    })()
  }, [])
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor, code })
    setBusy(false)
    if (error) { setErr('Λάθος ή ληγμένος κωδικός. Δοκίμασε ξανά.'); setCode(''); return }
    setNeed(false)
  }
  if (need === null) return null
  if (!need) return <>{children}</>
  return <div className="login"><div className="art"><div><img src={BRAND + 'pss-logo.png'} alt="" /></div></div>
    <form onSubmit={go} style={{ alignSelf: 'center', justifySelf: 'center', maxWidth: 380, padding: 24, display: 'grid', gap: 14 }}>
      <ShieldCheck size={36} color="var(--red)" />
      <h1 style={{ margin: 0 }}>Σύνδεση 2 βημάτων</h1>
      <p className="muted" style={{ margin: 0 }}>Άνοιξε την εφαρμογή Authenticator στο κινητό σου και γράψε τον 6ψήφιο κωδικό.</p>
      <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ textAlign: 'center', fontSize: 26, letterSpacing: 8 }} />
      {err && <div className="note warn">{err}</div>}
      <button className="btn red" disabled={busy || code.length !== 6}>{busy ? '…' : 'Είσοδος'}</button>
      <button type="button" className="btn ghost" onClick={() => sb.auth.signOut()}>Αποσύνδεση</button>
    </form></div>
}
