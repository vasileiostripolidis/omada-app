import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, eur, dt, fullName, EVTYPE, type Player, type EventRow } from '../lib/supabase'
import { useApp } from '../App'

export default function Dashboard() {
  const { settings } = useApp()
  const [k, setK] = useState({ players: 0, teams: 0, owed: 0, monthPaid: 0, overdue: 0 })
  const [debtors, setDebtors] = useState<(Player & { balance: number })[]>([])
  const [medical, setMedical] = useState<Player[]>([])
  const [next, setNext] = useState<EventRow[]>([])

  useEffect(() => {
    (async () => {
      const month = new Date(); month.setDate(1)
      const [p, t, b, pay, ev] = await Promise.all([
        sb.from('players').select('*').eq('active', true),
        sb.from('teams').select('id', { count: 'exact', head: true }),
        sb.from('player_balances').select('*'),
        sb.from('payments').select('amount').gte('paid_at', month.toISOString().slice(0, 10)),
        sb.from('events').select('*').gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
      ])
      const players = (p.data || []) as Player[]
      const bal = new Map((b.data || []).map((x) => [x.player_id, x]))
      setK({
        players: players.length, teams: t.count || 0,
        owed: (b.data || []).reduce((a, x) => a + Number(x.balance), 0),
        monthPaid: (pay.data || []).reduce((a, x) => a + Number(x.amount), 0),
        overdue: (b.data || []).filter((x) => x.overdue_count > 0).length,
      })
      setDebtors(players.map((pl) => ({ ...pl, balance: Number(bal.get(pl.id)?.balance || 0) })).filter((x) => x.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 6))
      const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
      setMedical(players.filter((pl) => !pl.medical_expiry || pl.medical_expiry < soon).slice(0, 6))
      setNext((ev.data || []) as EventRow[])
    })()
  }, [])

  return (
    <>
      <h1>Καλώς ήρθες{settings ? `, ${settings.club_name}` : ''} 👋</h1>
      <div className="grid" style={{ marginBottom: 14 }}>
        <Link to="/players" className="card kpi"><div className="v">{k.players}</div><div className="l">Ενεργοί παίκτες</div></Link>
        <Link to="/teams" className="card kpi"><div className="v">{k.teams}</div><div className="l">Ομάδες</div></Link>
        <Link to="/charges" className="card kpi"><div className="v" style={{ color: 'var(--danger)' }}>{eur(k.owed)}</div><div className="l">Ανεξόφλητα ({k.overdue} ληξιπρόθεσμοι)</div></Link>
        <div className="card kpi"><div className="v" style={{ color: 'var(--ok)' }}>{eur(k.monthPaid)}</div><div className="l">Εισπράξεις μήνα</div></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        <div className="card"><h2>💶 Οφειλές</h2>
          {debtors.length ? <div className="list">{debtors.map((d) => (
            <Link key={d.id} to={`/players/${d.id}`} className="item"><div className="grow">{fullName(d)}</div><b>{eur(d.balance)}</b></Link>
          ))}</div> : <div className="empty">Κανείς δεν χρωστάει 🎉</div>}
        </div>
        <div className="card"><h2>🩺 Κάρτες υγείας</h2>
          {medical.length ? <div className="list">{medical.map((d) => (
            <Link key={d.id} to={`/players/${d.id}`} className="item"><div className="grow">{fullName(d)}</div>
              <span className="badge b-over">{d.medical_expiry ? `λήγει ${dt(d.medical_expiry)}` : 'λείπει'}</span></Link>
          ))}</div> : <div className="empty">Όλες σε ισχύ ✅</div>}
        </div>
        <div className="card"><h2>📅 Επόμενα</h2>
          {next.length ? <div className="list">{next.map((e) => (
            <Link key={e.id} to="/events" className="item"><div className="grow">{EVTYPE[e.type]} {e.opponent ? `vs ${e.opponent}` : ''}<div className="muted">{e.location}</div></div>
              <span className="muted">{new Date(e.starts_at).toLocaleString('el-GR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></Link>
          ))}</div> : <div className="empty">Δεν υπάρχει προγραμματισμός</div>}
        </div>
      </div>
    </>
  )
}
