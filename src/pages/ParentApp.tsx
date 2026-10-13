import { useEffect, useState } from 'react'
import { LogOut, Download, Pin } from 'lucide-react'
import { statement, receipt, downloadPdf } from '../lib/billing'
import { sb, BRAND, eur, dt, age, fullName, initials, EVTYPE, WEEKDAYS, MONTHS, CATEGORIES, METHOD, eligibility, type Player, type Charge, type Payment, type EventRow, type MetricDef, type Slot, type Household } from '../lib/supabase'
import { useApp, TeamChip, StatusBadge, Empty } from '../ui'
import LineChart from '../components/LineChart'
import PlayerGoals from '../components/PlayerGoals'
import PlayerHealth from '../components/PlayerHealth'
import { useLang } from '../lib/i18n'
import PushToggle from '../components/PushToggle'
import type { Announcement } from '../lib/supabase'

export default function ParentApp() {
  const { email, teams, settings, toast } = useApp()
  const [kids, setKids] = useState<Player[]>([])
  const [hh, setHh] = useState<(Household & { balance: number })[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [kid, setKid] = useState('')
  const [tab, setTab] = useState('overview')
  const { lang, setLang, t } = useLang()
  useEffect(() => {
    (async () => {
      const [h, b, l, c, p] = await Promise.all([sb.from('households').select('*'), sb.from('household_balances').select('*'), sb.from('player_households').select('players(*)'),
        sb.from('charges').select('*').neq('status', 'cancelled').order('due_date', { ascending: false }), sb.from('payments').select('*').order('paid_at', { ascending: false })])
      const bal = new Map((b.data || []).map((x) => [x.household_id, Number(x.balance)]))
      setHh((h.data || []).map((x) => ({ ...x, balance: bal.get(x.id) || 0 })))
      const ks = [...new Map(((l.data || []) as unknown as { players: Player }[]).filter((x) => x.players).map((x) => [x.players.id, x.players])).values()]
      setKids(ks); if (ks.length) setKid(ks[0].id)
      setCharges(c.data || []); setPayments(p.data || [])
    })()
  }, [])
  const balance = hh.reduce((a, x) => a + x.balance, 0)
  const k = kids.find((x) => x.id === kid)
  return (
    <div className="public">
      <header className="topbar" style={{ display: 'flex' }}><img src={BRAND + 'pss-logo.png'} alt="" /><div className="t1 grow">{settings?.club_name || 'Patras Schools Soccer'}</div>
        <div className="lang" style={{ marginRight: 8 }}><button className={lang === 'el' ? 'on' : ''} onClick={() => setLang('el')}>ΕΛ</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button></div>
        <button className="iconbtn" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }} onClick={() => sb.auth.signOut()} title={t('p_logout')}><LogOut size={16} /></button></header>
      <div className="public-body" style={{ maxWidth: 1000 }}>
        <div className="eyebrow">{lang === 'en' ? 'Parent portal' : 'Πύλη γονέων'}</div><h1 style={{ marginBottom: 4 }}>{t('p_hello')}</h1><div className="muted" style={{ marginBottom: 16 }}>{email}</div>
        <PushToggle compact lang={lang} toast={toast} />
        {!kids.length ? <div className="card"><Empty title="Δεν βρέθηκαν αθλητές" text="Η γραμματεία πρέπει να συνδέσει το email σας με τον λογαριασμό της οικογένειας." /></div> : <>
          <div className="pills" style={{ marginBottom: 14 }}>{kids.map((x) => <button key={x.id} className={'pill' + (kid === x.id ? ' on' : '')} onClick={() => setKid(x.id)}>{x.first_name}</button>)}</div>
          <div className="tabs">{[['overview', t('p_overview')], ['perf', t('p_perf')], ['goals', t('p_goals')], ['health', t('p_health')], ['news', t('p_news')], ['photos', t('p_photos')], ['money', `${t('p_finance')}${balance > 0.004 ? ` (${eur(balance)})` : ''}`]].map(([key, l]) =>
            <button key={key} className={'tab' + (tab === key ? ' on' : '')} onClick={() => setTab(key)}>{l}</button>)}</div>
          {k && tab === 'overview' && <KidOverview k={k} teamName={teams.find((t) => t.id === k.team_id)} />}
          {k && tab === 'perf' && <KidPerf k={k} />}
          {k && tab === 'goals' && <PlayerGoals playerId={k.id} readOnly />}
          {k && tab === 'health' && <PlayerHealth playerId={k.id} readOnly />}
          {tab === 'news' && <ParentNews />}
          {tab === 'photos' && <ParentPhotos />}
          {tab === 'money' && <div className="stack">
            <div className="card kpi"><div className="l">{t('p_balance')}</div><div className="v num" style={{ color: balance > 0.004 ? 'var(--red)' : 'var(--ok)' }}>{eur(Math.max(0, balance))}</div>
              {settings?.iban && balance > 0.004 && <div className="s">{lang === 'en' ? 'Pay by bank transfer to IBAN' : 'Πληρωμή με κατάθεση στο IBAN'} <b>{settings.iban}</b>{lang === 'en' ? ' or at the office.' : ' ή στη γραμματεία.'}</div>}
              <div className="row" style={{ marginTop: 8 }}>{hh.map((h) => <button key={h.id} className="btn ghost sm" onClick={async () => { const r = await statement(h.id, false); if (r.pdf) downloadPdf(r.pdf, 'Katastasi.pdf') }}><Download size={14} />{t('p_statement')}</button>)}</div></div>
            <div className="card flush"><div className="card-head"><h2>{t('p_charges')}</h2></div>{charges.length ? <div className="scroll"><table><thead><tr><th>Περιγραφή</th><th>Λήξη</th><th className="r">Ποσό</th><th>Κατάσταση</th></tr></thead><tbody>
              {charges.map((c) => <tr key={c.id}><td>{c.description}</td><td>{dt(c.due_date)}</td><td className="r num">{eur(c.amount)}</td><td><StatusBadge status={c.status} due={c.due_date} /></td></tr>)}</tbody></table></div> : <Empty title="Καμία χρέωση" />}</div>
            <div className="card flush"><div className="card-head"><h2>{t('p_payments')}</h2></div>{payments.length ? <div className="scroll"><table><thead><tr><th>Ημ/νία</th><th>Απόδειξη</th><th>Τρόπος</th><th className="r">Ποσό</th><th></th></tr></thead><tbody>
              {payments.map((p) => <tr key={p.id}><td>{dt(p.paid_at)}</td><td>#{p.receipt_no}</td><td>{METHOD[p.method]}</td><td className="r num"><b>{eur(p.amount)}</b></td><td className="r"><button className="iconbtn" title="Απόδειξη PDF" onClick={async () => { const r = await receipt(p.id, false); if (r.pdf) downloadPdf(r.pdf, `Apodeixi_${p.receipt_no}.pdf`) }}><Download size={14} /></button></td></tr>)}</tbody></table></div> : <Empty title="Καμία πληρωμή" />}</div>
          </div>}
        </>}
      </div>
    </div>
  )
}

function KidOverview({ k, teamName }: { k: Player; teamName?: ReturnType<typeof useApp>['teams'][number] }) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [att, setAtt] = useState({ p: 0, t: 0, goals: 0, apps: 0 })
  useEffect(() => {
    (async () => {
      const [e, s, st] = await Promise.all([
        k.team_id ? sb.from('events').select('*').eq('team_id', k.team_id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(8) : Promise.resolve({ data: [] }),
        k.team_id ? sb.from('training_slots').select('*').eq('team_id', k.team_id).order('weekday') : Promise.resolve({ data: [] }),
        sb.from('player_stats').select('*, events(type)').eq('player_id', k.id)])
      setEvents((e.data || []) as EventRow[]); setSlots((s.data || []) as Slot[])
      const rows = (st.data || []) as { present: boolean; goals: number; events: { type: string } }[]
      const m = rows.filter((r) => r.events?.type === 'match' && r.present)
      setAtt({ p: rows.filter((r) => r.present).length, t: rows.length, goals: m.reduce((a, r) => a + (r.goals || 0), 0), apps: m.length })
    })()
  }, [k.id])
  const el = eligibility(k)
  return <div className="stack">
    <div className="card row" style={{ gap: 16 }}><div className="avatar lg">{initials(k)}</div>
      <div className="grow"><h1>{fullName(k)}</h1><div className="row" style={{ marginTop: 6 }}><TeamChip team={teamName} />{age(k.birth_date) != null && <span className="badge">{age(k.birth_date)} ετών</span>}
        {el.ok ? <span className="badge b-ok">Ιατρική σε ισχύ</span> : <span className="badge b-bad">{el.issues[0]}</span>}</div></div></div>
    <div className="grid">
      <div className="card kpi"><div className="l">Παρουσία</div><div className="v num">{att.t ? Math.round((att.p / att.t) * 100) + '%' : '—'}</div><div className="s">{att.p} από {att.t}</div></div>
      <div className="card kpi"><div className="l">Συμμετοχές σε αγώνες</div><div className="v num">{att.apps}</div></div>
      <div className="card kpi"><div className="l">Γκολ</div><div className="v num">{att.goals}</div></div>
    </div>
    <div className="grid-2">
      <div className="card flush"><div className="card-head"><h2>Εβδομαδιαίο πρόγραμμα</h2></div>
        {slots.length ? <div className="list">{slots.map((s) => <div className="item" key={s.id}><b style={{ width: 100 }}>{WEEKDAYS[s.weekday]}</b><span className="grow">{s.start_time.slice(0, 5)}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}</span><span className="muted">{s.location}</span></div>)}</div> : <Empty title="—" />}</div>
      <div className="card flush"><div className="card-head"><h2>Επόμενα</h2></div>
        {events.length ? <div className="list">{events.map((e) => <div className="item" key={e.id}><div className="grow"><div className="t">{EVTYPE[e.type]}{e.opponent ? ` vs ${e.opponent}` : ''}</div><div className="muted">{e.location}</div></div>
          <span className="muted">{new Date(e.starts_at).toLocaleString('el-GR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>)}</div> : <Empty title="Κενό πρόγραμμα" />}</div>
    </div>
  </div>
}

function KidPerf({ k }: { k: Player }) {
  const [defs, setDefs] = useState<MetricDef[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [mv, setMv] = useState<Record<string, Record<number, number>>>({})
  const [evals, setEvals] = useState<{ period: string; comment: string | null }[]>([])
  const [cat, setCat] = useState('body')
  useEffect(() => {
    (async () => {
      const [d, m, e] = await Promise.all([sb.from('metric_defs').select('*').eq('active', true).order('sort'), sb.from('player_metrics').select('*').eq('player_id', k.id).order('period'), sb.from('player_evaluations').select('*').eq('player_id', k.id).order('period')])
      setDefs(d.data || []); setEvals(e.data || [])
      const v: Record<string, Record<number, number>> = {}; for (const r of m.data || []) (v[r.period] ||= {})[r.metric_id] = Number(r.value)
      setMv(v); setPeriods(Object.keys(v).sort().slice(-12))
    })()
  }, [k.id])
  if (!periods.length) return <div className="card"><Empty title="Δεν υπάρχουν μετρήσεις ακόμα" text="Οι προπονητές καταγράφουν τις επιδόσεις κάθε μήνα." /></div>
  return <div className="stack">
    <div className="pills">{Object.entries(CATEGORIES).map(([key, l]) => <button key={key} className={'pill' + (cat === key ? ' on' : '')} onClick={() => setCat(key)}>{l}</button>)}</div>
    <div className="grid-charts">{defs.filter((d) => d.category === cat).map((d) => <LineChart key={d.id} title={d.name} unit={d.unit} decimals={d.decimals} higherBetter={d.higher_better}
      points={periods.map((x) => ({ x: new Date(x).toLocaleDateString('el-GR', { month: 'long', year: 'numeric' }), label: MONTHS[new Date(x).getMonth()], v: mv[x]?.[d.id] ?? null }))} />)}</div>
    {evals.some((e) => e.comment) && <div className="card"><h2>Σχόλια προπονητή</h2>{[...evals].reverse().filter((e) => e.comment).map((e) => <p key={e.period}><b>{MONTHS[new Date(e.period).getMonth()]} {new Date(e.period).getFullYear()}:</b> {e.comment}</p>)}</div>}
  </div>
}

function ParentNews() {
  const { teams } = useApp()
  const { t } = useLang()
  const [rows, setRows] = useState<Announcement[]>([])
  useEffect(() => { sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50).then(({ data }) => setRows(data || [])) }, [])
  if (!rows.length) return <div className="card"><Empty title={t('p_no_news')} /></div>
  return <div className="stack">{rows.map((a) => <div key={a.id} className="card">
    <div className="row"><b className="grow" style={{ fontSize: 17 }}>{a.pinned && <Pin size={14} color="var(--red)" />} {a.title}</b><span className="muted">{dt(a.created_at)}</span></div>
    {a.team_id && <div style={{ marginTop: 4 }}><TeamChip team={teams.find((x) => x.id === a.team_id)} /></div>}
    {a.image_url && <img src={a.image_url} alt="" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />}
    {a.body && <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{a.body}</p>}
  </div>)}</div>
}

function ParentPhotos() {
  const { t } = useLang()
  const [rows, setRows] = useState<{ id: string; album: string; caption: string | null; path: string; url?: string }[]>([])
  const [big, setBig] = useState<string | null>(null)
  useEffect(() => {
    (async () => {
      const { data } = await sb.from('photos').select('id, album, caption, path').order('created_at', { ascending: false }).limit(200)
      const list = data || []
      if (list.length) { const { data: u } = await sb.storage.from('gallery').createSignedUrls(list.map((x) => x.path), 3600); list.forEach((x, i) => ((x as { url?: string }).url = u?.[i]?.signedUrl || undefined)) }
      setRows(list)
    })()
  }, [])
  if (!rows.length) return <div className="card"><Empty title={t('p_no_photos')} /></div>
  const albums = [...new Set(rows.map((r) => r.album))]
  return <div className="stack">{albums.map((al) => <div key={al} className="card"><h2>{al}</h2>
    <div className="gallery">{rows.filter((r) => r.album === al && r.url).map((r) => <div className="ph" key={r.id} title={r.caption || ''} onClick={() => setBig(r.url!)}><img src={r.url} alt={r.caption || ''} loading="lazy" /></div>)}</div></div>)}
    {big && <div onClick={() => setBig(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 16 }}><img src={big} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} /></div>}
  </div>
}
