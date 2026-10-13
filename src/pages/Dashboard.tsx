import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, HeartHandshake, Wallet, TrendingUp, Stethoscope, CalendarDays, Activity } from 'lucide-react'
import { sb, eur, dt, fullName, EVTYPE, BRAND, type Player, type EventRow, type Household, type Sponsor } from '../lib/supabase'
import { useApp, TeamChip, Empty } from '../ui'
import { eligibility } from '../lib/supabase'

export default function Dashboard() {
  const { isCoach } = useApp()
  return isCoach ? <CoachDashboard /> : <OfficeDashboard />
}

function OfficeDashboard() {
  const { settings, teams } = useApp()
  const [k, setK] = useState({ players: 0, families: 0, owed: 0, monthPaid: 0, monthCharged: 0, overdue: 0 })
  const [debtors, setDebtors] = useState<(Household & { balance: number })[]>([])
  const [medical, setMedical] = useState<Player[]>([])
  const [next, setNext] = useState<EventRow[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [perTeam, setPerTeam] = useState<Record<string, number>>({})

  useEffect(() => {
    (async () => {
      const m = new Date(); const first = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().slice(0, 10)
      const [p, h, b, pay, ch, ev, sp] = await Promise.all([
        sb.from('players').select('*').eq('active', true),
        sb.from('households').select('*').eq('active', true),
        sb.from('household_balances').select('*'),
        sb.from('payments').select('amount').gte('paid_at', first),
        sb.from('charges').select('amount,status').gte('period', first).neq('status', 'cancelled'),
        sb.from('events').select('*').gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
        sb.from('sponsors').select('*').order('sort'),
      ])
      const players = (p.data || []) as Player[]
      const hh = (h.data || []) as Household[]
      const bal = new Map((b.data || []).map((x) => [x.household_id, x]))
      setK({
        players: players.length, families: hh.length,
        owed: hh.reduce((a, x) => a + Math.max(0, Number(bal.get(x.id)?.balance || 0)), 0),
        monthPaid: (pay.data || []).reduce((a, x) => a + Number(x.amount), 0),
        monthCharged: (ch.data || []).reduce((a, x) => a + Number(x.amount), 0),
        overdue: hh.filter((x) => Number(bal.get(x.id)?.overdue_count || 0) > 0).length,
      })
      setDebtors(hh.map((x) => ({ ...x, balance: Number(bal.get(x.id)?.balance || 0) })).filter((x) => x.balance > 0.004).sort((a, z) => z.balance - a.balance).slice(0, 7))
      const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
      setMedical(players.filter((pl) => !pl.medical_expiry || pl.medical_expiry < soon).sort((a, z) => (a.medical_expiry || '').localeCompare(z.medical_expiry || '')).slice(0, 7))
      setNext((ev.data || []) as EventRow[])
      setSponsors((sp.data || []) as Sponsor[])
      const pt: Record<string, number> = {}; players.forEach((x) => { if (x.team_id) pt[x.team_id] = (pt[x.team_id] || 0) + 1 }); setPerTeam(pt)
    })()
  }, [])

  const pct = k.monthCharged ? Math.min(100, Math.round((k.monthPaid / k.monthCharged) * 100)) : 0

  return (
    <>
      <div className="hero">
        <img src={settings?.logo_url || BRAND + 'pss-logo.png'} alt="" />
        <div className="grow"><div className="eyebrow" style={{ color: '#ff6b80' }}>Πίνακας ελέγχου</div><h1>{settings?.club_name || 'Patras Schools Soccer'}</h1>
          <div className="sub">{new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <Link to="/players" className="card kpi"><div className="ico"><Users size={19} /></div><div className="l">Ενεργοί αθλητές</div><div className="v num">{k.players}</div><div className="s">σε {teams.length} ομάδες</div></Link>
        <Link to="/families" className="card kpi"><div className="ico"><HeartHandshake size={19} /></div><div className="l">Οικογένειες</div><div className="v num">{k.families}</div><div className="s">λογαριασμοί χρέωσης</div></Link>
        <Link to="/finance" className="card kpi red"><div className="ico"><Wallet size={19} /></div><div className="l">Ανεξόφλητα</div><div className="v num">{eur(k.owed)}</div><div className="s">{k.overdue} οικογένειες με ληξιπρόθεσμα</div></Link>
        <Link to="/finance" className="card kpi green"><div className="ico"><TrendingUp size={19} /></div><div className="l">Εισπράξεις μήνα</div><div className="v num">{eur(k.monthPaid)}</div>
          <div className="progress" style={{ marginTop: 4 }}><div style={{ width: pct + '%' }} /></div><div className="s">{pct}% των χρεώσεων του μήνα ({eur(k.monthCharged)})</div></Link>
      </div>

      <div className="grid-2">
        <div className="card flush"><div className="card-head"><h2>Οφειλές οικογενειών</h2><Link to="/finance" className="btn ghost sm">Ταμείο</Link></div>
          {debtors.length ? <div className="list">{debtors.map((d) => (
            <Link key={d.id} to={`/families/${d.id}`} className="item"><div className="grow t">{d.name}</div><b className="num" style={{ color: 'var(--red)' }}>{eur(d.balance)}</b></Link>
          ))}</div> : <div className="empty"><div className="big">Όλα εξοφλημένα</div>Καμία οικογένεια δεν έχει υπόλοιπο.</div>}
        </div>

        <div className="card flush"><div className="card-head"><h2>Ιατρικές βεβαιώσεις</h2><Stethoscope size={18} color="var(--muted)" /></div>
          {medical.length ? <div className="list">{medical.map((d) => (
            <Link key={d.id} to={`/players/${d.id}`} className="item"><div className="grow t">{fullName(d)}</div>
              <span className={'badge ' + (d.medical_expiry && d.medical_expiry >= new Date().toISOString().slice(0, 10) ? 'b-warn' : 'b-bad')}>{d.medical_expiry ? `λήγει ${dt(d.medical_expiry)}` : 'δεν έχει κατατεθεί'}</span></Link>
          ))}</div> : <div className="empty"><div className="big">Όλα σε ισχύ</div></div>}
        </div>

        <div className="card flush"><div className="card-head"><h2>Επόμενο πρόγραμμα</h2><CalendarDays size={18} color="var(--muted)" /></div>
          {next.length ? <div className="list">{next.map((e) => (
            <Link key={e.id} to="/events" className="item">
              <div style={{ textAlign: 'center', width: 46 }}><div className="head" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{new Date(e.starts_at).getDate()}</div><div className="muted" style={{ textTransform: 'uppercase', fontSize: 11 }}>{new Date(e.starts_at).toLocaleDateString('el-GR', { month: 'short' })}</div></div>
              <div className="grow"><div className="t">{EVTYPE[e.type]}{e.opponent ? ` vs ${e.opponent}` : ''}</div><div className="muted"><TeamChip team={teams.find((t) => t.id === e.team_id)} /> · {new Date(e.starts_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}</div></div>
            </Link>
          ))}</div> : <div className="empty"><div className="big">Κενό πρόγραμμα</div>Πρόσθεσε αγώνες και προπονήσεις.</div>}
        </div>

        <div className="card flush"><div className="card-head"><h2>Οι ομάδες μας</h2><Link to="/teams" className="btn ghost sm">Όλες</Link></div>
          <div className="list">{teams.map((t) => (
            <Link key={t.id} to="/teams" className="item">{t.logo_url ? <img src={t.logo_url} className="avatar sq" alt="" /> : <div className="avatar" style={{ background: t.color || 'var(--navy)' }}>{t.name[0]}</div>}
              <div className="grow"><div className="t">{t.name}</div><div className="muted">{t.age_group || t.season || ''}</div></div><span className="badge b-navy">{perTeam[t.id] || 0} αθλητές</span></Link>))}</div>
        </div>
      </div>

      {sponsors.length > 0 && <div className="card" style={{ marginTop: 16 }}>
        <div className="muted" style={{ textAlign: 'center', letterSpacing: 2, fontWeight: 700, fontSize: 11, marginBottom: 12 }}>ΜΕ ΤΗΝ ΥΠΟΣΤΗΡΙΞΗ ΤΩΝ ΧΟΡΗΓΩΝ ΜΑΣ</div>
        <div className="sponsor-strip">{sponsors.map((s) => s.logo_url ? <img key={s.id} src={s.logo_url} alt={s.name} title={s.name} /> : <b key={s.id} className="head">{s.name}</b>)}</div>
      </div>}
    </>
  )
}

function CoachDashboard() {
  const { teams, myTeams, settings } = useApp()
  const mine = teams.filter((t) => myTeams.includes(t.id))
  const [players, setPlayers] = useState<Player[]>([])
  const [next, setNext] = useState<EventRow[]>([])
  useEffect(() => {
    (async () => {
      const [p, e] = await Promise.all([sb.from('players').select('*').eq('active', true).order('last_name'),
        sb.from('events').select('*').gte('starts_at', new Date(Date.now() - 3 * 3600e3).toISOString()).order('starts_at').limit(8)])
      setPlayers((p.data || []) as Player[]); setNext((e.data || []) as EventRow[])
    })()
  }, [])
  const blocked = players.filter((p) => !eligibility(p).ok)
  return <>
    <div className="hero"><img src={settings?.logo_url || BRAND + 'pss-logo.png'} alt="" />
      <div className="grow"><div className="eyebrow" style={{ color: '#ff6b80' }}>Προπονητής</div><h1>Οι ομάδες μου</h1>
        <div className="sub">{new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div></div>
    {!mine.length && <div className="card"><Empty title="Δεν σου έχουν ανατεθεί ομάδες" text="Η γραμματεία αναθέτει ομάδες από τις Ρυθμίσεις → Χρήστες." /></div>}
    <div className="grid" style={{ marginBottom: 16 }}>{mine.map((t) => <Link key={t.id} to="/teams" className="card row">
      {t.logo_url ? <img src={t.logo_url} alt="" style={{ width: 54, height: 54, objectFit: 'contain' }} /> : <div className="avatar">{t.name[0]}</div>}
      <div><div className="head" style={{ fontSize: 19, fontWeight: 800 }}>{t.name}</div><div className="muted">{players.filter((p) => p.team_id === t.id).length} αθλητές</div></div></Link>)}</div>
    <div className="grid-2">
      <div className="card flush"><div className="card-head"><h2>Επόμενες προπονήσεις & αγώνες</h2><Link to="/events" className="btn ghost sm">Παρουσιολόγιο</Link></div>
        {next.length ? <div className="list">{next.map((e) => <Link key={e.id} to="/events" className="item">
          <div className="grow"><div className="t">{EVTYPE[e.type]}{e.opponent ? ` vs ${e.opponent}` : ''}</div><div className="muted"><TeamChip team={teams.find((t) => t.id === e.team_id)} /></div></div>
          <span className="muted">{new Date(e.starts_at).toLocaleString('el-GR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></Link>)}</div>
          : <Empty title="Κενό πρόγραμμα" text="Δημιούργησε τις προπονήσεις του μήνα από το εβδομαδιαίο πρόγραμμα." />}</div>
      <div className="card flush"><div className="card-head"><h2>Χωρίς δικαίωμα συμμετοχής</h2><Stethoscope size={18} color="var(--muted)" /></div>
        {blocked.length ? <div className="list">{blocked.map((p) => <Link key={p.id} to={`/players/${p.id}`} className="item"><div className="grow t">{fullName(p)}</div><span className="badge b-bad">{eligibility(p).issues[0]}</span></Link>)}</div>
          : <Empty title="Όλοι μπορούν να παίξουν" text="Ιατρικές βεβαιώσεις και δελτία σε ισχύ." />}</div>
    </div>
    <div className="card row" style={{ marginTop: 16 }}><Activity size={22} color="var(--red)" /><div className="grow"><b>Μηνιαίες μετρήσεις</b><div className="muted">Καταχώρισε βιομετρικά, τεστ και αξιολογήσεις για τον μήνα.</div></div><Link to="/performance" className="btn red">Επιδόσεις</Link></div>
  </>
}
