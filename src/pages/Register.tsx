import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Eraser, ArrowLeft, ArrowRight, Upload } from 'lucide-react'
import { sb, BRAND, CONSENTS, RELATIONS } from '../lib/supabase'
import { useLang, REL_EN, POS_EN } from '../lib/i18n'

type G = { first_name: string; last_name: string; relation: string; phone: string; email: string }
const emptyG = (relation: string): G => ({ first_name: '', last_name: '', relation, phone: '', email: '' })

export default function Register() {
  const [step, setStep] = useState(0)
  const { lang, setLang, t } = useLang()
  const tr = (m: Record<string, string>, v: string) => lang === 'en' ? m[v] || v : v
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [child, setChild] = useState({ first_name: '', last_name: '', birth_date: '', amka: '', address: '', team: '', position: '', medical_expiry: '', medical_notes: '', previous_club: '' })
  const [g1, setG1] = useState<G>(emptyG('Πατέρας'))
  const [g2, setG2] = useState<G>(emptyG('Μητέρα'))
  const [consents, setConsents] = useState<Record<string, boolean>>({})
  const [signer, setSigner] = useState('')
  const [medical, setMedical] = useState<File | null>(null)
  const [hp, setHp] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [signed, setSigned] = useState(false)

  useEffect(() => { sb.from('teams').select('id,name').order('name').then(({ data }) => setTeams(data || [])) }, [])
  useEffect(() => {
    const c = canvas.current; if (!c || step !== 2) return
    const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2
    const ctx = c.getContext('2d')!; ctx.scale(2, 2); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#021534'
  }, [step])
  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const down = (e: React.PointerEvent) => { drawing.current = true; const ctx = canvas.current!.getContext('2d')!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y) }
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const ctx = canvas.current!.getContext('2d')!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setSigned(true) }
  const clear = () => { const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setSigned(false) }

  function next() {
    setErr('')
    if (step === 0 && (!child.first_name || !child.last_name || !child.birth_date)) return setErr(t('e_child'))
    if (step === 1 && (!g1.first_name || !g1.last_name || !g1.phone || !g1.email)) return setErr(t('e_g1'))
    if (step === 1 && !/^\S+@\S+\.\S+$/.test(g1.email)) return setErr(t('e_email'))
    setStep(step + 1); window.scrollTo(0, 0)
  }
  async function submit() {
    setErr('')
    const missing = CONSENTS.filter((c) => c.required && !consents[c.key])
    if (missing.length) return setErr(t('e_consent'))
    if (!signer.trim()) return setErr(t('e_signer'))
    if (!signed) return setErr(t('e_sign'))
    if (hp) { setDone(true); return }
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      const blob: Blob = await new Promise((res) => canvas.current!.toBlob((b) => res(b!), 'image/png'))
      const sig = `${id}/signature.png`
      const u1 = await sb.storage.from('registrations').upload(sig, blob, { contentType: 'image/png' }); if (u1.error) throw u1.error
      const files: { name: string; path: string; kind: string }[] = []
      if (medical) {
        const path = `${id}/${Date.now()}-${medical.name.replace(/[^\w.-]/g, '_')}`
        const u2 = await sb.storage.from('registrations').upload(path, medical); if (u2.error) throw u2.error
        files.push({ name: medical.name, path, kind: 'medical' })
      }
      const r = await sb.from('registrations').insert({
        id, child, guardians: [g1, ...(g2.first_name ? [g2] : [])],
        consents: { ...Object.fromEntries(CONSENTS.map((c) => [c.key, !!consents[c.key]])), signer, signed_at: new Date().toISOString(), lang },
        signature_path: sig, files,
      })
      if (r.error) throw r.error
      setDone(true); window.scrollTo(0, 0)
    } catch (e) { setErr(t('e_generic') + (e as Error).message) } finally { setBusy(false) }
  }

  const F = <T extends Record<string, string>>(o: T, set: (v: T) => void, k: keyof T & string, label: string, type = 'text', req = false) =>
    <label className="f">{label}{req && ' *'}<input type={type} value={o[k]} required={req} onChange={(e) => set({ ...o, [k]: e.target.value })} /></label>
  const GF = (g: G, set: (v: G) => void, req: boolean) => <div className="form">
    {F(g, set, 'first_name', t('first'), 'text', req)}{F(g, set, 'last_name', t('last'), 'text', req)}
    <label className="f">{t('relation')}<select value={g.relation} onChange={(e) => set({ ...g, relation: e.target.value })}>{RELATIONS.slice(0, 4).map((r) => <option key={r} value={r}>{tr(REL_EN, r)}</option>)}</select></label>
    {F(g, set, 'phone', t('mobile'), 'tel', req)}{F(g, set, 'email', 'Email', 'email', req)}
  </div>

  return (
    <div className="public">
      <div className="public-head"><img src={BRAND + 'pss-logo.png'} alt="Patras Schools Soccer" />
        <div className="head" style={{ fontSize: 24, fontWeight: 800, textTransform: 'uppercase', marginTop: 6 }}>Patras Schools Soccer</div>
        <div style={{ color: '#ff8a9b', letterSpacing: 3, fontWeight: 700, fontSize: 12 }}>{t('reg_title')}</div>
        <div className="lang" style={{ marginTop: 10 }}><button className={lang === 'el' ? 'on' : ''} onClick={() => setLang('el')}>ΕΛ</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button></div></div>
      <div className="public-body">
        {done ? <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          <CheckCircle2 size={56} color="var(--ok)" />
          <h1 style={{ marginTop: 10 }}>{t('sent')}</h1>
          <p style={{ fontSize: 16 }}>{t('sent_text')}</p>
        </div> : <>
          <div className="steps">{[0, 1, 2].map((i) => <div key={i} className={i <= step ? 'on' : ''} />)}</div>
          <div className="card">
            {step === 0 && <>
              <div className="eyebrow">{t('step')} 1 {t('of')} 3</div><h1 style={{ marginBottom: 14 }}>{t('athlete')}</h1>
              <div className="form">
                {F(child, setChild, 'first_name', t('first'), 'text', true)}{F(child, setChild, 'last_name', t('last'), 'text', true)}
                {F(child, setChild, 'birth_date', t('birth'), 'date', true)}{F(child, setChild, 'amka', t('amka'))}
                {F(child, setChild, 'address', t('address'))}
                <label className="f">{t('team')}<select value={child.team} onChange={(e) => setChild({ ...child, team: e.target.value })}><option value="">{t('team_unknown')}</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                <label className="f">{t('position')}<select value={child.position} onChange={(e) => setChild({ ...child, position: e.target.value })}><option value="">—</option>{['Τερματοφύλακας', 'Αμυντικός', 'Μέσος', 'Επιθετικός'].map((x) => <option key={x} value={x}>{tr(POS_EN, x)}</option>)}</select></label>
                {F(child, setChild, 'previous_club', t('prev_club'))}
                <div className="section-t">{t('health')}</div>
                {F(child, setChild, 'medical_expiry', t('med_until'), 'date')}
                <label className="f">{t('med_file')}<label className="btn ghost" style={{ cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}><Upload size={16} />{medical ? medical.name : t('choose_file')}<input type="file" hidden accept="image/*,application/pdf" onChange={(e) => setMedical(e.target.files?.[0] || null)} /></label></label>
                <label className="f full">{t('allergies')}<textarea rows={2} value={child.medical_notes} onChange={(e) => setChild({ ...child, medical_notes: e.target.value })} /></label>
              </div>
            </>}
            {step === 1 && <>
              <div className="eyebrow">{t('step')} 2 {t('of')} 3</div><h1 style={{ marginBottom: 6 }}>{t('parents')}</h1>
              <p className="muted" style={{ marginTop: 0 }}>{t('parents_note')}</p>
              <div className="section-t" style={{ marginTop: 6 }}>{t('guardian1')}</div>{GF(g1, setG1, true)}
              <div className="section-t">{t('guardian2')}</div>{GF(g2, setG2, false)}
            </>}
            {step === 2 && <>
              <div className="eyebrow">{t('step')} 3 {t('of')} 3</div><h1 style={{ marginBottom: 6 }}>{t('consents_t')}</h1>
              <p className="muted" style={{ marginTop: 0 }}>{t('gdpr_note')} <a href="#/privacy" target="_blank" rel="noreferrer">{t('read_privacy')}</a>.</p>
              <div className="stack">{CONSENTS.map((c) => <label key={c.key} className="check" style={{ alignItems: 'flex-start', padding: 12, borderRadius: 10, background: 'var(--soft)' }}>
                <input type="checkbox" checked={!!consents[c.key]} onChange={(e) => setConsents({ ...consents, [c.key]: e.target.checked })} style={{ marginTop: 2 }} />
                <span>{t(('c_' + c.key) as 'c_data')} {c.required ? <b style={{ color: 'var(--red)' }}>{t('required')}</b> : <span className="muted">{t('optional')}</span>}</span></label>)}</div>
              <div className="form" style={{ marginTop: 16 }}><label className="f full">{t('signer')} *<input value={signer} onChange={(e) => setSigner(e.target.value)} /></label></div>
              <div className="row between" style={{ margin: '14px 0 6px' }}><b>{t('signature')}</b><button type="button" className="btn ghost sm" onClick={clear}><Eraser size={14} />{t('clear')}</button></div>
              <canvas ref={canvas} className="sig" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)} />
              <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} aria-hidden="true" />
            </>}
            {err && <div className="note warn" style={{ marginTop: 14 }}>{err}</div>}
            <div className="row between" style={{ marginTop: 18 }}>
              {step > 0 ? <button className="btn ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} />{t('back')}</button> : <span />}
              {step < 2 ? <button className="btn red" onClick={next}>{t('next')}<ArrowRight size={16} /></button>
                : <button className="btn red" disabled={busy} onClick={submit}>{busy ? t('sending') : t('finish')}</button>}
            </div>
          </div>
        </>}
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}><a href="#/privacy">{t('privacy')}</a> · <a href="#/terms">{t('terms')}</a></div>
      </div>
    </div>
  )
}
