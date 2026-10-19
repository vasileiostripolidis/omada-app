import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { sb, BRAND } from '../lib/supabase'
import { useLang } from '../lib/i18n'
import { WEB_APP } from '../lib/native'

export const INVITE_KEY = 'pss_invite'
export const pendingInvite = () => { try { return localStorage.getItem(INVITE_KEY) } catch { return null } }
export async function claimPending() {
  const t = pendingInvite(); if (!t) return false
  const { data } = await sb.rpc('claim_invite', { t })
  if (data?.ok || ['used', 'expired', 'not_found'].includes(data?.reason)) { try { localStorage.removeItem(INVITE_KEY) } catch { /* */ } }
  return !!data?.ok
}

type Info = { valid: boolean; reason?: string; guardian?: string; email?: string | null; kids?: string[] | null }

// Σελίδα πρόσκλησης γονέα: #/join/<token>
export default function Join() {
  const token = window.location.hash.split('/')[2] || ''
  const { lang, setLang } = useLang(); const en = lang === 'en'
  const [info, setInfo] = useState<Info | null>(null)
  const [hasSession, setHasSession] = useState(false)
  const [mode, setMode] = useState<'up' | 'in'>('up')
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    try { localStorage.setItem(INVITE_KEY, token) } catch { /* */ }
    sb.rpc('invite_info', { t: token }).then(({ data }) => { setInfo(data); if (data?.email) setEmail(data.email); if (data?.guardian) setName(data.guardian) })
    sb.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [token])
  const enter = () => { window.location.hash = '#/'; window.location.reload() }
  async function claimNow() { setBusy(true); const ok = await claimPending(); setBusy(false); if (ok) enter(); else setMsg({ t: en ? 'The invitation could not be used.' : 'Η πρόσκληση δεν μπόρεσε να χρησιμοποιηθεί.' }) }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const r = mode === 'up'
      ? await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name }, emailRedirectTo: WEB_APP } })
      : await sb.auth.signInWithPassword({ email, password: pw })
    setBusy(false)
    if (r.error) return setMsg({ t: r.error.message.includes('already') ? (en ? 'This email already has an account – choose “I have an account”.' : 'Αυτό το email έχει ήδη λογαριασμό – επίλεξε «Έχω λογαριασμό».') : r.error.message })
    if (r.data.session) { await claimPending(); enter() }
    else setMsg({ ok: true, t: en ? 'We sent you a confirmation email. Open it, then sign in – your children will appear automatically.' : 'Σας στείλαμε email επιβεβαίωσης. Ανοίξτε το και μετά συνδεθείτε – τα παιδιά σας θα εμφανιστούν αυτόματα.' })
  }
  const bad = info && !info.valid
  return <div className="public">
    <div className="public-head"><img src={BRAND + 'pss-logo.png'} alt="Patras Schools Soccer" />
      <div className="head" style={{ fontSize: 24, fontWeight: 800, textTransform: 'uppercase', marginTop: 6 }}>Patras Schools Soccer</div>
      <div style={{ color: '#ff8a9b', letterSpacing: 3, fontWeight: 700, fontSize: 12 }}>{en ? 'PARENT APP' : 'ΕΦΑΡΜΟΓΗ ΓΟΝΕΩΝ'}</div>
      <div className="lang" style={{ marginTop: 10 }}><button className={lang === 'el' ? 'on' : ''} onClick={() => setLang('el')}>ΕΛ</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button></div></div>
    <div className="public-body" style={{ maxWidth: 460 }}>
      <div className="card">
        {!info ? <div className="muted">…</div> : bad ? <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}><AlertTriangle size={40} color="var(--warn)" />
          <h1>{info.reason === 'used' ? (en ? 'Invitation already used' : 'Η πρόσκληση έχει ήδη χρησιμοποιηθεί') : info.reason === 'expired' ? (en ? 'Invitation expired' : 'Η πρόσκληση έληξε') : (en ? 'Invalid invitation' : 'Μη έγκυρη πρόσκληση')}</h1>
          <p className="muted">{en ? 'If you already created an account, just sign in. Otherwise ask the academy office for a new link.' : 'Αν έχετε ήδη φτιάξει λογαριασμό, απλώς συνδεθείτε. Αλλιώς ζητήστε νέο σύνδεσμο από τη γραμματεία.'}</p>
          <a className="btn red" href="#/">{en ? 'Sign in' : 'Σύνδεση'}</a></div>
        : <>
          <h1 style={{ marginBottom: 4 }}>{en ? 'Welcome' : 'Καλώς ήρθατε'}{info.guardian ? `, ${info.guardian}` : ''}!</h1>
          {info.kids?.length ? <p className="muted" style={{ marginTop: 0 }}>{en ? 'Access for' : 'Πρόσβαση για'}: <b style={{ color: 'var(--red)' }}>{info.kids.join(', ')}</b></p> : null}
          <p style={{ fontSize: 14 }}>{en ? 'See schedule, announcements, performance and payments for your child.' : 'Δείτε πρόγραμμα, ανακοινώσεις, επιδόσεις και οικονομικά του παιδιού σας.'}</p>
          {hasSession ? <div className="stack"><button className="btn red block" disabled={busy} onClick={claimNow}><CheckCircle2 size={16} />{en ? 'Continue with this account' : 'Συνέχεια με αυτόν τον λογαριασμό'}</button>
            <button className="btn ghost block" onClick={async () => { await sb.auth.signOut(); setHasSession(false) }}>{en ? 'Use another account' : 'Άλλος λογαριασμός'}</button></div>
          : <form onSubmit={submit} className="stack">
            <div className="pills"><button type="button" className={'pill' + (mode === 'up' ? ' on' : '')} onClick={() => setMode('up')}>{en ? 'New account' : 'Νέος λογαριασμός'}</button><button type="button" className={'pill' + (mode === 'in' ? ' on' : '')} onClick={() => setMode('in')}>{en ? 'I have an account' : 'Έχω λογαριασμό'}</button></div>
            {mode === 'up' && <label className="f">{en ? 'Full name' : 'Ονοματεπώνυμο'}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>}
            <label className="f">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
            <label className="f">{en ? 'Password (min. 6 characters)' : 'Κωδικός (τουλάχιστον 6 χαρακτήρες)'}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></label>
            {msg && <div className={'note' + (msg.ok ? '' : ' warn')}>{msg.t}</div>}
            <button className="btn red block" disabled={busy} style={{ padding: 13 }}>{busy ? '…' : mode === 'up' ? (en ? 'Create account' : 'Δημιουργία λογαριασμού') : (en ? 'Sign in' : 'Είσοδος')}</button>
          </form>}
        </>}
      </div>
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}><a href="#/privacy">{en ? 'Privacy Policy' : 'Πολιτική Απορρήτου'}</a></div>
    </div>
  </div>
}
