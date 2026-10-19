import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Upload, FileText, Trash2, Phone, Mail, Link2, Unlink, Camera, HeartHandshake, FileDown, ShieldCheck, ShieldAlert } from 'lucide-react'
import { sb, eur, dt, age, fullName, initials, isAdult, signedUrl, today, eligibility, CATEGORIES, CONSENTS, MONTHS, DOC_TYPES, type Player, type Household, type Guardian, type MetricDef } from '../lib/supabase'
import LineChart from '../components/LineChart'
import PlayerGoals from '../components/PlayerGoals'
import PlayerHealth from '../components/PlayerHealth'
import { useApp, Modal, TeamChip, Empty } from '../ui'
import { PlayerForm } from './Players'
import { exportPlayerData } from '../components/Admin'
import { openUrl } from '../lib/native'

type FileRow = { id: string; name: string; path: string; mime: string | null; size: number | null; kind: string; doc_type: string | null; uploaded_at: string }
type LinkRow = { household_id: string; share_pct: number; households: Household }

export default function PlayerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toast, teams, isOffice, settings } = useApp()
  const [p, setP] = useState<Player | null>(null)
  const [files, setFiles] = useState<FileRow[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])
  const [guards, setGuards] = useState<Guardian[]>([])
  const [bal, setBal] = useState<Record<string, number>>({})
  const [stats, setStats] = useState({ apps: 0, goals: 0, assists: 0, minutes: 0, yellow: 0, red: 0, att: 0, total: 0 })
  const [photo, setPhoto] = useState<string>()
  const [tab, setTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [docType, setDocType] = useState('medical')
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(false)
  const [defs, setDefs] = useState<MetricDef[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [mv, setMv] = useState<Record<string, Record<number, number>>>({})
  const [tavg, setTavg] = useState<Record<string, Record<number, number>>>({})
  const [evals, setEvals] = useState<{ period: string; comment: string }[]>([])
  const [consEdit, setConsEdit] = useState<Record<string, boolean> | null>(null)
  const [consBy, setConsBy] = useState('')
  const [consents, setConsents] = useState<{ kind: string; granted: boolean; signed_by: string | null; signed_at: string }[]>([])
  const [pcat, setPcat] = useState('body')
  const [injured, setInjured] = useState(false)
  const checkInj = () => sb.from('injuries').select('id').eq('player_id', id).is('returned_at', null).then(({ data }) => setInjured(!!data?.length))
  useEffect(() => { checkInj() }, [id])

  const load = async () => {
    const [a, f, l, s] = await Promise.all([
      sb.from('players').select('*').eq('id', id).single(),
      sb.from('player_files').select('*').eq('player_id', id).order('uploaded_at', { ascending: false }),
      sb.from('player_households').select('household_id, share_pct, households(*)').eq('player_id', id),
      sb.from('player_stats').select('*, events(type)').eq('player_id', id),
    ])
    setP(a.data); setFiles(f.data || [])
    const ls = (l.data || []) as unknown as LinkRow[]; setLinks(ls)
    const hids = ls.map((x) => x.household_id)
    if (hids.length) {
      const [g, b] = await Promise.all([sb.from('guardians').select('*').in('household_id', hids), sb.from('household_balances').select('*').in('household_id', hids)])
      setGuards(g.data || []); setBal(Object.fromEntries((b.data || []).map((x) => [x.household_id, Number(x.balance)])))
    } else { setGuards([]); setBal({}) }
    const rows = (s.data || []) as { present: boolean; minutes: number; goals: number; assists: number; yellow: number; red: number; events: { type: string } }[]
    const m = rows.filter((r) => r.events?.type === 'match' && r.present)
    const sum = (k: 'goals' | 'assists' | 'minutes' | 'yellow' | 'red') => m.reduce((x, r) => x + (Number(r[k]) || 0), 0)
    setStats({ apps: m.length, goals: sum('goals'), assists: sum('assists'), minutes: sum('minutes'), yellow: sum('yellow'), red: sum('red'), att: rows.filter((r) => r.present).length, total: rows.length })
    setPhoto(a.data?.photo_path ? await signedUrl(a.data.photo_path) : undefined)
    // επιδόσεις τελευταίων 12 μηνών + μέσος όρος ομάδας
    const from = new Date(); from.setMonth(from.getMonth() - 11); const fromP = new Date(from.getFullYear(), from.getMonth(), 1)
    const ps: string[] = []; for (let i = 0; i < 12; i++) { const x = new Date(fromP.getFullYear(), fromP.getMonth() + i, 1); ps.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`) }
    const [md, pm, ev, cs] = await Promise.all([
      sb.from('metric_defs').select('*').eq('active', true).order('sort'),
      sb.from('player_metrics').select('*').eq('player_id', id).gte('period', ps[0]),
      sb.from('player_evaluations').select('*').eq('player_id', id).order('period'),
      sb.from('consents').select('*').eq('player_id', id).order('signed_at', { ascending: false }),
    ])
    setDefs(md.data || []); setEvals((ev.data || []) as { period: string; comment: string }[]); setConsents(cs.data || [])
    const v: Record<string, Record<number, number>> = {}
    for (const r of pm.data || []) (v[r.period] ||= {})[r.metric_id] = Number(r.value)
    const used = ps.filter((x) => v[x]); const firstIdx = used.length ? ps.indexOf(used[0]) : ps.length - 1
    setPeriods(ps.slice(Math.min(firstIdx, ps.length - 3))); setMv(v)
    if (a.data?.team_id) {
      const { data: mates } = await sb.from('players').select('id').eq('team_id', a.data.team_id)
      const { data: tm } = await sb.from('player_metrics').select('period, metric_id, value').in('player_id', (mates || []).map((x) => x.id)).gte('period', ps[0])
      const acc: Record<string, Record<number, number[]>> = {}
      for (const r of tm || []) ((acc[r.period] ||= {})[r.metric_id] ||= []).push(Number(r.value))
      setTavg(Object.fromEntries(Object.entries(acc).map(([k, o]) => [k, Object.fromEntries(Object.entries(o).map(([m, xs]) => [m, xs.reduce((a2, b2) => a2 + b2, 0) / xs.length]))])))
    }
  }
  async function report() {
    const { evaluationPdf } = await import('../lib/reportPdf')
    const { data: st } = await sb.from('player_stats').select('*, events(type)').eq('player_id', id)
    const rows = (st || []) as { present: boolean; goals: number; assists: number; events: { type: string } }[]
    const m = rows.filter((r) => r.events?.type === 'match' && r.present)
    const { data: goals } = await sb.from('player_goals').select('title, theme, progress, status').eq('player_id', id)
    await evaluationPdf({ goals: goals || [], player: p!, teamName: teams.find((x) => x.id === p!.team_id)?.name || '', age: age(p!.birth_date), settings, defs, periods: periods.filter((x) => mv[x]), values: mv, teamAvg: tavg,
      attendance: { present: rows.filter((r) => r.present).length, total: rows.length }, matches: { apps: m.length, goals: m.reduce((a2, r) => a2 + (r.goals || 0), 0), assists: m.reduce((a2, r) => a2 + (r.assists || 0), 0) }, comments: evals })
  }
  useEffect(() => { load() }, [id])
  if (!p) return null
  const t = today()

  async function upload(e: React.ChangeEvent<HTMLInputElement>, asPhoto = false) {
    const list = Array.from(e.target.files || []); if (!list.length) return
    setBusy(true)
    for (const file of list) {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const up = await sb.storage.from('player-files').upload(path, file)
      if (up.error) { toast('Σφάλμα: ' + up.error.message); continue }
      if (asPhoto) await sb.from('players').update({ photo_path: path }).eq('id', id)
      else await sb.from('player_files').insert({ player_id: id, name: file.name, path, mime: file.type, size: file.size, kind: 'other', doc_type: docType })
    }
    setBusy(false); toast(asPhoto ? 'Η φωτογραφία ενημερώθηκε ✓' : 'Τα έγγραφα ανέβηκαν ✓'); e.target.value = ''; load()
  }
  async function openFile(f: FileRow) { const u = await signedUrl(f.path); if (u) openUrl(u) }
  async function delFile(f: FileRow) {
    if (!confirm(`Διαγραφή «${f.name}»;`)) return
    await sb.storage.from('player-files').remove([f.path]); await sb.from('player_files').delete().eq('id', f.id); load()
  }
  async function unlink(hid: string) { if (confirm('Αποσύνδεση του αθλητή από αυτή την οικογένεια;')) { await sb.from('player_households').delete().eq('player_id', id).eq('household_id', hid); load() } }
  async function setShare(hid: string, v: number) { await sb.from('player_households').update({ share_pct: v }).eq('player_id', id).eq('household_id', hid); toast('Το ποσοστό ενημερώθηκε ✓'); load() }
  async function selfPay() {
    const h = await sb.from('households').insert({ name: `${p!.last_name} ${p!.first_name} (ενήλικας)` }).select('id').single()
    if (h.error) return toast(h.error.message)
    await sb.from('guardians').insert({ household_id: h.data.id, first_name: p!.first_name, last_name: p!.last_name, relation: 'Ο ίδιος (ενήλικας)', email: p!.email, phone: p!.phone })
    await sb.from('player_households').insert({ player_id: id, household_id: h.data.id, share_pct: 100 })
    toast('Δημιουργήθηκε λογαριασμός στο όνομα του αθλητή ✓'); load()
  }
  async function saveConsents() {
    if (!consEdit) return
    if (!consBy.trim()) return toast('Γράψε ποιος γονέας δίνει/ανακαλεί τη συγκατάθεση')
    const changed = CONSENTS.filter((c) => { const x = consents.find((y) => y.kind === c.key); return !x || x.granted !== !!consEdit[c.key] })
    if (!changed.length) { setConsEdit(null); return }
    const r = await sb.from('consents').insert(changed.map((c) => ({ player_id: id, kind: c.key, granted: !!consEdit[c.key], signed_by: consBy.trim(), source: 'office' })))
    if (r.error) return toast(r.error.message)
    setConsEdit(null); toast('Οι συγκαταθέσεις ενημερώθηκαν ✓'); load()
  }
  async function gdprExport() { try { await exportPlayerData(id!, `${p!.last_name}_${p!.first_name}`) } catch (e) { toast((e as Error).message) } }
  async function anonymize() {
    if (!confirm('Ανωνυμοποίηση: διαγράφονται ονοματεπώνυμο, ΑΜΚΑ, στοιχεία επικοινωνίας, σημειώσεις υγείας και όλα τα έγγραφα. Τα στατιστικά και τα οικονομικά μένουν ανώνυμα για το ιστορικό. Δεν αναιρείται. Συνέχεια;')) return
    const fl = await sb.from('player_files').select('id, path').eq('player_id', id)
    if (fl.data?.length) { await sb.storage.from('player-files').remove(fl.data.map((f) => f.path)); await sb.from('player_files').delete().eq('player_id', id) }
    const code = id!.slice(0, 6).toUpperCase()
    const r = await sb.from('players').update({ first_name: 'Ανώνυμος', last_name: 'Αθλητής ' + code, amka: null, address: null, phone: null, email: null, medical_notes: null, notes: null, photo_path: null, card_number: null,
      guardian_name: null, guardian_email: null, guardian_phone: null, guardian2_name: null, guardian2_phone: null, birth_date: p!.birth_date ? p!.birth_date.slice(0, 4) + '-01-01' : null, active: false }).eq('id', id)
    if (r.error) return toast(r.error.message)
    toast('Ο αθλητής ανωνυμοποιήθηκε'); load()
  }
  async function remove() { if (confirm('Οριστική διαγραφή αθλητή και όλων των εγγράφων του;')) { await sb.from('players').delete().eq('id', id); nav('/players') } }

  const docBadge = (k: string, label: string, exp: string | null) => {
    const has = files.some((f) => (f.doc_type || f.kind) === k)
    const ok = exp ? exp >= t : has
    return <div className="card" style={{ padding: 14 }}><div className="muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: .6 }}>{label}</div>
      <div className="row between" style={{ marginTop: 6 }}><b>{exp ? `έως ${dt(exp)}` : has ? 'Κατατέθηκε' : 'Λείπει'}</b><span className={'badge ' + (ok ? 'b-ok' : 'b-bad')}>{ok ? 'OK' : exp ? 'Έληξε' : 'Λείπει'}</span></div></div>
  }

  return (
    <>
      <button className="btn ghost sm" onClick={() => nav(-1)} style={{ marginBottom: 12 }}><ArrowLeft size={16} />Πίσω</button>
      <div className="card row" style={{ marginBottom: 16, gap: 18 }}>
        <label style={{ cursor: 'pointer', position: 'relative' }} title="Αλλαγή φωτογραφίας">
          {photo ? <img src={photo} className="avatar lg" alt="" /> : <div className="avatar lg">{initials(p)}</div>}
          <span className="iconbtn" style={{ position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: 99 }}><Camera size={15} /></span>
          <input type="file" accept="image/*" hidden onChange={(e) => upload(e, true)} />
        </label>
        <div className="grow">
          <div className="eyebrow">{p.position || 'Αθλητής'}{p.jersey_number != null ? ` · #${p.jersey_number}` : ''}</div>
          <h1>{fullName(p)}</h1>
          <div className="row" style={{ marginTop: 8 }}><TeamChip team={teams.find((x) => x.id === p.team_id)} />
            {age(p.birth_date) != null && <span className="badge">{age(p.birth_date)} ετών</span>}
            {isAdult(p) && <span className="badge b-info">Ενήλικας</span>}
            {!p.active && <span className="badge">Ανενεργός</span>}
            {(() => { const e = eligibility(p, injured); return e.ok ? <span className="badge b-ok"><ShieldCheck size={12} />Δικαίωμα συμμετοχής</span> : <span className="badge b-bad" title={e.issues.join(', ')}><ShieldAlert size={12} />{e.issues[0]}</span> })()}</div>
        </div>
        <div className="row"><button className="btn ghost" onClick={report}><FileDown size={16} />PDF αξιολόγησης</button>
        <button className="btn" onClick={() => setEditing(true)}><Pencil size={16} />Επεξεργασία</button></div>
      </div>

      <div className="tabs">{[['info', 'Στοιχεία'], ['goals', 'Στόχοι'], ['perf', 'Επιδόσεις'], ['health', `Υγεία & φόρτος${injured ? ' ⚠' : ''}`], ['family', isOffice ? `Γονείς & Πληρωμές (${links.length})` : 'Επαφές γονέων'], ['docs', `Έγγραφα (${files.length})`], ['stats', 'Αγωνιστικά']].map(([k, l]) =>
        <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'info' && <div className="stack">
        <div className="grid">{docBadge('medical', 'Ιατρική βεβαίωση', p.medical_expiry)}{docBadge('card', 'Δελτίο αθλητή', p.card_expiry)}</div>
        <div className="card"><div className="form">
          {[['Ημ. γέννησης', dt(p.birth_date)], ['ΑΜΚΑ', p.amka], ['Αρ. δελτίου', p.card_number], ['Διεύθυνση', p.address], ['Κινητό', p.phone], ['Email', p.email],
            ['Εγγραφή', dt(p.joined_at)], ['Ιατρικές σημειώσεις', p.medical_notes], ['Σημειώσεις', p.notes]]
            .map(([l, v]) => <div key={l}><div className="muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: .6 }}>{l}</div><div style={{ marginTop: 3 }}>{v || '—'}</div></div>)}
        </div></div>
        <div className="card"><h2>Συγκαταθέσεις GDPR</h2>
          {consents.length ? <div className="list">{CONSENTS.map((c) => { const x = consents.find((y) => y.kind === c.key)
            return <div className="item" key={c.key} style={{ padding: '10px 0' }}><span className={'badge ' + (x?.granted ? 'b-ok' : x ? 'b-bad' : 'b-warn')}>{x?.granted ? 'Ναι' : x ? 'Όχι' : 'Εκκρεμεί'}</span><div className="grow" style={{ fontSize: 13.5 }}>{c.label}</div>{x && <span className="muted">{x.signed_by} · {dt(x.signed_at)}</span>}</div> })}</div>
            : <div className="note warn">Δεν έχουν καταγραφεί συγκαταθέσεις. Στείλε στον γονέα τη φόρμα ηλεκτρονικής εγγραφής ή κατέγραψέ τες από την ενότητα «Εγγραφές».</div>}
          {isOffice && <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={() => { setConsBy(''); setConsEdit(Object.fromEntries(CONSENTS.map((c) => [c.key, !!consents.find((y) => y.kind === c.key)?.granted]))) }}><Pencil size={14} />Καταγραφή / ανάκληση</button>
            <button className="btn ghost sm" onClick={gdprExport}><FileDown size={14} />Εξαγωγή δεδομένων (GDPR)</button>
            <button className="btn ghost sm" onClick={anonymize}>Ανωνυμοποίηση</button></div>}
        </div>
        {isOffice && <div className="row"><button className="btn ghost sm" onClick={async () => { await sb.from('players').update({ active: !p.active }).eq('id', id); load() }}>{p.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}</button>
          <button className="btn danger sm" onClick={remove}><Trash2 size={15} />Διαγραφή αθλητή</button></div>}
      </div>}

      {consEdit && <Modal title="Συγκαταθέσεις GDPR" onClose={() => setConsEdit(null)} foot={<><button className="btn ghost" onClick={() => setConsEdit(null)}>Άκυρο</button><button className="btn red" onClick={saveConsents}>Αποθήκευση</button></>}>
        <div className="stack">
          <div className="note">Κάθε αλλαγή καταγράφεται με ημερομηνία και όνομα — το ιστορικό δεν σβήνεται (απαίτηση GDPR).</div>
          {CONSENTS.map((c) => <label key={c.key} className="check" style={{ alignItems: 'flex-start', padding: 10, borderRadius: 10, background: 'var(--soft)' }}><input type="checkbox" checked={!!consEdit[c.key]} onChange={(e) => setConsEdit({ ...consEdit, [c.key]: e.target.checked })} style={{ marginTop: 2 }} /><span>{c.label}</span></label>)}
          <label className="f">Γονέας που δίνει / ανακαλεί *<input value={consBy} onChange={(e) => setConsBy(e.target.value)} placeholder="Ονοματεπώνυμο" /></label>
        </div></Modal>}
      {tab === 'goals' && <PlayerGoals playerId={p.id} />}
      {tab === 'health' && <PlayerHealth playerId={p.id} onChange={checkInj} />}
      {tab === 'perf' && <div className="stack">
        {!consents.find((c) => c.kind === 'biometrics' && c.granted) && <div className="note warn">Δεν υπάρχει καταγεγραμμένη συγκατάθεση γονέα για βιομετρικά/επιδόσεις.</div>}
        <div className="pills">{Object.entries(CATEGORIES).map(([k, l]) => <button key={k} className={'pill' + (pcat === k ? ' on' : '')} onClick={() => setPcat(k)}>{l}</button>)}</div>
        <div className="grid-charts">{defs.filter((d) => d.category === pcat).map((d) => {
          const pts = periods.map((x) => ({ x: new Date(x).toLocaleDateString('el-GR', { month: 'long', year: 'numeric' }), label: MONTHS[new Date(x).getMonth()], v: mv[x]?.[d.id] ?? null }))
          return <LineChart key={d.id} title={d.name} unit={d.unit} decimals={d.decimals} higherBetter={d.higher_better} points={pts} avg={periods.map((x) => tavg[x]?.[d.id] ?? null)} />
        })}</div>
        {pcat === 'body' && (() => { const hId = defs.find((d) => d.name === 'Ύψος')?.id, wId = defs.find((d) => d.name === 'Βάρος')?.id
          const pts = periods.map((x) => { const h = hId ? mv[x]?.[hId] : undefined, w = wId ? mv[x]?.[wId] : undefined; return { x: new Date(x).toLocaleDateString('el-GR', { month: 'long', year: 'numeric' }), label: MONTHS[new Date(x).getMonth()], v: h && w ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null } })
          return <div className="grid-charts"><LineChart title="BMI" unit="kg/m²" points={pts} /></div> })()}
        {evals.some((e) => e.comment) && <div className="card"><h2>Σχόλια προπονητή</h2><div className="list">{[...evals].reverse().filter((e) => e.comment).map((e) =>
          <div className="item" key={e.period} style={{ padding: '10px 0' }}><span className="badge b-navy">{MONTHS[new Date(e.period).getMonth()]} {new Date(e.period).getFullYear()}</span><div className="grow">{e.comment}</div></div>)}</div></div>}
      </div>}

      {tab === 'family' && <div className="stack">
        {links.length === 0 && isOffice && <div className="card"><Empty title="Χωρίς γονείς" text="Σύνδεσε τον αθλητή με την οικογένειά του για να χρεώνεται αυτόματα.">
          <div className="row" style={{ justifyContent: 'center' }}><button className="btn red" onClick={() => setLinking(true)}><Link2 size={16} />Σύνδεση με οικογένεια</button>
            {isAdult(p) && <button className="btn ghost" onClick={selfPay}>Πληρώνει ο ίδιος</button>}</div></Empty></div>}
        {links.map((l) => <div className="card flush" key={l.household_id}>
          <div className="card-head"><Link to={`/families/${l.household_id}`} className="row"><HeartHandshake size={18} color="var(--red)" /><h2>{l.households?.name || 'Οικογένεια'}</h2></Link>
            {isOffice && <div className="row"><span className={'badge ' + ((bal[l.household_id] || 0) > 0.004 ? 'b-bad' : 'b-ok')}>{(bal[l.household_id] || 0) > 0.004 ? `Οφειλή ${eur(bal[l.household_id])}` : 'Εξοφλημένοι'}</span>
              <button className="iconbtn" title="Αποσύνδεση" onClick={() => unlink(l.household_id)}><Unlink size={15} /></button></div>}</div>
          <div className="list">{guards.filter((g) => g.household_id === l.household_id).map((g) => <div className="item" key={g.id}>
            <div className="avatar" style={{ background: 'var(--navy-3)' }}>{initials(g)}</div>
            <div className="grow"><div className="t">{g.first_name} {g.last_name}</div><div className="muted">{g.relation}{g.receives_emails ? '' : ' · χωρίς ειδοποιήσεις'}</div></div>
            {g.phone && <a className="iconbtn" href={`tel:${g.phone}`} title={g.phone}><Phone size={15} /></a>}
            {g.email && <a className="iconbtn" href={`mailto:${g.email}`} title={g.email}><Mail size={15} /></a>}
          </div>)}</div>
          {isOffice && <div className="item" style={{ background: 'var(--soft)' }}><div className="grow muted">Ποσοστό χρέωσης του αθλητή σε αυτή την οικογένεια (π.χ. 50% αν πληρώνουν χωριστά οι γονείς)</div>
            <select style={{ width: 110 }} value={Number(l.share_pct)} onChange={(e) => setShare(l.household_id, Number(e.target.value))}>{[100, 75, 50, 25, 0].map((v) => <option key={v} value={v}>{v}%</option>)}</select></div>}
        </div>)}
        {links.length > 0 && isOffice && <div className="row"><button className="btn ghost" onClick={() => setLinking(true)}><Link2 size={16} />Σύνδεση και με άλλη οικογένεια (χωριστοί γονείς)</button></div>}
      </div>}

      {tab === 'docs' && <div className="card flush">
        <div className="card-head" style={{ flexWrap: 'wrap' }}><h2>Έγγραφα αθλητή</h2>
          <div className="row"><select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ width: 'auto' }}>{Object.entries(DOC_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <label className="btn red sm" style={{ cursor: 'pointer' }}><Upload size={15} />{busy ? 'Ανέβασμα…' : 'Ανέβασμα'}<input type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx" onChange={(e) => upload(e)} /></label></div></div>
        {files.length ? <div className="list">{files.map((f) => (
          <div className="item" key={f.id}><div className="avatar sq" style={{ display: 'grid', placeItems: 'center' }}><FileText size={20} color="var(--navy)" /></div>
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => openFile(f)}><div className="t">{f.name}</div><div className="muted">{DOC_TYPES[f.doc_type || f.kind] || 'Άλλο'} · {dt(f.uploaded_at)} · {((f.size || 0) / 1024).toFixed(0)} KB</div></div>
            <button className="iconbtn" onClick={() => delFile(f)} title="Διαγραφή"><Trash2 size={15} /></button></div>
        ))}</div> : <Empty title="Κανένα έγγραφο" text="Ανέβασε ιατρική βεβαίωση, δελτίο, ταυτότητα, υπεύθυνη δήλωση…" />}
      </div>}

      {tab === 'stats' && <div className="grid">
        {[['Συμμετοχές', stats.apps], ['Γκολ', stats.goals], ['Ασίστ', stats.assists], ['Λεπτά', stats.minutes], ['Κίτρινες', stats.yellow], ['Κόκκινες', stats.red],
          ['Παρουσία', stats.total ? Math.round((stats.att / stats.total) * 100) + '%' : '—']].map(([l, v]) =>
          <div className="card kpi" key={l as string}><div className="l">{l}</div><div className="v num">{v}</div></div>)}
      </div>}

      {editing && <PlayerForm player={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load() }} />}
      {linking && <LinkFamily playerId={p.id} exclude={links.map((l) => l.household_id)} onClose={() => setLinking(false)} onDone={() => { setLinking(false); load() }} />}
    </>
  )
}

function LinkFamily({ playerId, exclude, onClose, onDone }: { playerId: string; exclude: string[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [hh, setHh] = useState<Household[]>([])
  const [q, setQ] = useState('')
  const [share, setShare] = useState(exclude.length ? 50 : 100)
  useEffect(() => { sb.from('households').select('*').eq('active', true).order('name').then(({ data }) => setHh((data || []).filter((h) => !exclude.includes(h.id)))) }, [])
  async function pick(h: Household) {
    const r = await sb.from('player_households').insert({ player_id: playerId, household_id: h.id, share_pct: share })
    if (r.error) return toast(r.error.message)
    toast(`Συνδέθηκε με «${h.name}» ✓`); onDone()
  }
  return <Modal title="Σύνδεση με οικογένεια" onClose={onClose}>
    <div className="row" style={{ marginBottom: 12 }}><input placeholder="Αναζήτηση οικογένειας…" value={q} onChange={(e) => setQ(e.target.value)} className="grow" style={{ width: 'auto', flex: 1 }} />
      <select style={{ width: 120 }} value={share} onChange={(e) => setShare(Number(e.target.value))}>{[100, 75, 50, 25].map((v) => <option key={v} value={v}>{v}%</option>)}</select></div>
    <div className="list">{hh.filter((h) => h.name.toLowerCase().includes(q.toLowerCase())).map((h) => <button key={h.id} className="item click" style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', padding: '12px 6px' }} onClick={() => pick(h)}><HeartHandshake size={18} color="var(--red)" /><b className="grow">{h.name}</b></button>)}</div>
    {!hh.length && <Empty title="Δεν υπάρχουν οικογένειες" text="Δημιούργησε οικογένεια από τη σελίδα «Γονείς & Οικογένειες»." />}
  </Modal>
}
