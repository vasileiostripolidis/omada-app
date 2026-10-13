import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react'
import { sb, fullName, type Team, type Player } from '../lib/supabase'
import { useApp, Empty } from '../ui'

// Χρόνος συμμετοχής: λεπτά/βασικός ανά παίκτη στη σεζόν, με επισήμανση όσων παίζουν λίγο (ισορροπία στις ακαδημίες)
export function PlayingTime({ teams }: { teams: Team[] }) {
  const { settings } = useApp()
  const [team, setTeam] = useState(teams[0]?.id || '')
  const [rows, setRows] = useState<{ p: Player; mins: number; starts: number; apps: number; called: number }[]>([])
  const [matches, setMatches] = useState(0)
  useEffect(() => { if (!team && teams.length) setTeam(teams[0].id) }, [teams.length])
  useEffect(() => {
    if (!team) return
    (async () => {
      const y = Number((settings?.current_season || '').slice(0, 4)) || new Date().getFullYear()
      const from = new Date(y, 6, 1).toISOString()
      const [p, e] = await Promise.all([sb.from('players').select('*').eq('team_id', team).eq('active', true).order('last_name'),
        sb.from('events').select('id').eq('team_id', team).eq('type', 'match').gte('starts_at', from).lte('starts_at', new Date().toISOString())])
      const ids = (e.data || []).map((x) => x.id); setMatches(ids.length)
      const { data: st } = ids.length ? await sb.from('player_stats').select('*').in('event_id', ids) : { data: [] }
      setRows(((p.data || []) as Player[]).map((pl) => { const s = (st || []).filter((x) => x.player_id === pl.id)
        return { p: pl, mins: s.reduce((a, x) => a + (x.minutes || 0), 0), starts: s.filter((x) => x.starter).length, apps: s.filter((x) => x.present && (x.minutes || 0) > 0).length, called: s.filter((x) => x.present).length } }).sort((a, b) => b.mins - a.mins))
    })()
  }, [team, settings?.current_season])
  const avg = rows.length ? rows.reduce((a, r) => a + r.mins, 0) / rows.length : 0, max = Math.max(1, ...rows.map((r) => r.mins))
  return <div className="stack">
    <div className="pills">{teams.map((t) => <button key={t.id} className={'pill' + (team === t.id ? ' on' : '')} onClick={() => setTeam(t.id)}>{t.name}</button>)}</div>
    <div className="card flush"><div className="card-head"><h2>Χρόνος συμμετοχής · σεζόν {settings?.current_season}</h2><span className="muted">{matches} αγώνες · Μ.Ο. {Math.round(avg)}'</span></div>
      {rows.length ? <div className="scroll"><table><thead><tr><th>Αθλητής</th><th style={{ width: '40%' }}>Λεπτά</th><th className="r">Βασικός</th><th className="r">Συμμετοχές</th><th className="r">% του Μ.Ο.</th></tr></thead><tbody>
        {rows.map((r) => { const pct = avg ? Math.round((r.mins / avg) * 100) : 0; const low = matches >= 3 && pct < 50
          return <tr key={r.p.id}><td><b>{fullName(r.p)}</b>{low && <div><span className="badge b-warn"><AlertTriangle size={11} />Λίγος χρόνος</span></div>}</td>
            <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="progress grow"><div style={{ width: (r.mins / max) * 100 + '%', background: low ? 'var(--warn)' : 'var(--navy)' }} /></div><b className="num" style={{ width: 52, textAlign: 'right' }}>{r.mins}'</b></div></td>
            <td className="r num">{r.starts}</td><td className="r num">{r.apps}</td><td className="r num">{pct}%</td></tr> })}
      </tbody></table></div> : <Empty title="Χωρίς δεδομένα" text="Συμπλήρωσε το φύλλο αγώνα (βασικοί & λεπτά) μετά από κάθε αγώνα." />}
      <div className="item muted">Στις ακαδημίες προτείνεται κάθε παιδί να παίζει τουλάχιστον το 50% του μέσου χρόνου της ομάδας. Επισημαίνονται όσοι είναι κάτω από αυτό (μετά από 3+ αγώνες).</div>
    </div>
  </div>
}

type Row = { id?: string; team_id: string; competition: string | null; season: string | null; club: string; is_us: boolean; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; sort: number }
// Βαθμολογία πρωταθλήματος (χειροκίνητη ενημέρωση από την ΕΠΣ)
export function Standings({ teams }: { teams: Team[] }) {
  const { toast, settings } = useApp()
  const [team, setTeam] = useState(teams[0]?.id || '')
  const [rows, setRows] = useState<Row[]>([])
  const [comp, setComp] = useState('')
  useEffect(() => { if (!team && teams.length) setTeam(teams[0].id) }, [teams.length])
  const load = () => team && sb.from('standings').select('*').eq('team_id', team).order('points', { ascending: false }).then(({ data }) => { setRows(data || []); setComp(data?.[0]?.competition || '') })
  useEffect(() => { load() }, [team])
  const t = teams.find((x) => x.id === team)
  const blank = (): Row => ({ team_id: team, competition: comp, season: settings?.current_season || null, club: '', is_us: false, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, sort: rows.length })
  const set = (i: number, k: keyof Row, v: string | number | boolean) => setRows(rows.map((r, j) => {
    if (j !== i) return r; const n = { ...r, [k]: v } as Row
    if (['won', 'drawn', 'lost'].includes(k as string)) { n.played = n.won + n.drawn + n.lost; n.points = n.won * 3 + n.drawn }
    return n }))
  async function save() {
    const data = rows.filter((r) => r.club.trim()).map((r) => ({ ...r, competition: comp || null, updated_at: new Date().toISOString() }))
    const r = await sb.from('standings').upsert(data); if (r.error) return toast(r.error.message)
    toast('Η βαθμολογία αποθηκεύτηκε ✓'); load()
  }
  async function del(i: number) { const r = rows[i]; if (r.id) await sb.from('standings').delete().eq('id', r.id); setRows(rows.filter((_, j) => j !== i)) }
  const sorted = [...rows].map((r, i) => ({ r, i })).sort((a, b) => b.r.points - a.r.points || (b.r.gf - b.r.ga) - (a.r.gf - a.r.ga) || b.r.gf - a.r.gf)
  const C = (i: number, k: keyof Row) => <td><input className="cell" style={{ width: 52 }} type="number" min={0} value={Number(rows[i][k])} onChange={(e) => set(i, k, +e.target.value)} /></td>
  return <div className="stack">
    <div className="pills">{teams.map((x) => <button key={x.id} className={'pill' + (team === x.id ? ' on' : '')} onClick={() => setTeam(x.id)}>{x.name}</button>)}</div>
    <div className="card flush"><div className="card-head" style={{ flexWrap: 'wrap' }}><input value={comp} onChange={(e) => setComp(e.target.value)} placeholder="Διοργάνωση (π.χ. Πρωτάθλημα Κ12 ΕΠΣ Αχαΐας)" style={{ maxWidth: 380 }} />
      <div className="row"><button className="btn ghost sm" onClick={() => setRows([...rows, rows.some((r) => r.is_us) ? blank() : { ...blank(), club: t?.name || '', is_us: true }])}><Plus size={14} />Ομάδα</button><button className="btn red sm" onClick={save}><Save size={14} />Αποθήκευση</button></div></div>
      {rows.length ? <div className="scroll"><table className="entry"><thead><tr><th>#</th><th>Ομάδα</th><th>Αγ.</th><th>Ν</th><th>Ι</th><th>Η</th><th>Γκολ +</th><th>Γκολ −</th><th>Δ</th><th>Βαθμοί</th><th></th></tr></thead><tbody>
        {sorted.map(({ r, i }, pos) => <tr key={i} style={r.is_us ? { background: 'var(--info-bg)' } : undefined}><td><b>{pos + 1}</b></td>
          <td><input value={r.club} onChange={(e) => set(i, 'club', e.target.value)} style={{ minWidth: 170, fontWeight: r.is_us ? 700 : 400 }} /></td>
          <td className="num" style={{ textAlign: 'center' }}>{r.played}</td>{C(i, 'won')}{C(i, 'drawn')}{C(i, 'lost')}{C(i, 'gf')}{C(i, 'ga')}
          <td className="num" style={{ textAlign: 'center' }}>{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td><input className="cell" style={{ width: 58, fontWeight: 700 }} type="number" value={r.points} onChange={(e) => set(i, 'points', +e.target.value)} /></td>
          <td><button className="iconbtn" onClick={() => del(i)}><Trash2 size={13} /></button></td></tr>)}
      </tbody></table></div> : <Empty title="Χωρίς βαθμολογία" text="Πρόσθεσε τις ομάδες του ομίλου και ενημέρωνε νίκες/ισοπαλίες/ήττες — οι βαθμοί υπολογίζονται αυτόματα." />}
    </div>
  </div>
}
