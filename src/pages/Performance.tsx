import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, Plus, Settings2 } from 'lucide-react'
import { sb, fullName, CATEGORIES, firstOfMonth, type Player, type MetricDef } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty } from '../ui'

type Key = string // player|metric
export default function Performance() {
  const { teams, myTeams, isCoach, toast } = useApp()
  const visible = isCoach ? teams.filter((t) => myTeams.includes(t.id)) : teams
  const [team, setTeam] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [cat, setCat] = useState<keyof typeof CATEGORIES>('body')
  const [players, setPlayers] = useState<Player[]>([])
  const [defs, setDefs] = useState<MetricDef[]>([])
  const [vals, setVals] = useState<Record<Key, string>>({})
  const [prev, setPrev] = useState<Record<Key, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [manage, setManage] = useState(false)
  useEffect(() => { if (!team && visible.length) setTeam(visible[0].id) }, [visible.length])

  const loadDefs = () => sb.from('metric_defs').select('*').eq('active', true).order('sort').then(({ data }) => setDefs(data || []))
  useEffect(() => { loadDefs() }, [])
  useEffect(() => {
    if (!team) return
    (async () => {
      const period = firstOfMonth(month)
      const pm = new Date(period); pm.setMonth(pm.getMonth() - 1)
      const prevPeriod = pm.toISOString().slice(0, 7) + '-01'
      const { data: ps } = await sb.from('players').select('*').eq('team_id', team).eq('active', true).order('last_name')
      const ids = (ps || []).map((p) => p.id)
      setPlayers(ps || [])
      if (!ids.length) { setVals({}); setPrev({}); setNotes({}); return }
      const [m, pv, ev] = await Promise.all([
        sb.from('player_metrics').select('*').in('player_id', ids).eq('period', period),
        sb.from('player_metrics').select('*').in('player_id', ids).eq('period', prevPeriod),
        sb.from('player_evaluations').select('*').in('player_id', ids).eq('period', period),
      ])
      setVals(Object.fromEntries((m.data || []).map((r) => [`${r.player_id}|${r.metric_id}`, String(r.value)])))
      setPrev(Object.fromEntries((pv.data || []).map((r) => [`${r.player_id}|${r.metric_id}`, Number(r.value)])))
      setNotes(Object.fromEntries((ev.data || []).map((r) => [r.player_id, r.comment || ''])))
      setDirty(new Set())
    })()
  }, [team, month])

  const cols = defs.filter((d) => d.category === cat)
  const setV = (k: Key, v: string) => { setVals({ ...vals, [k]: v.replace(',', '.') }); setDirty(new Set(dirty).add(k)) }
  const setN = (pid: string, v: string) => { setNotes({ ...notes, [pid]: v }); setDirty(new Set(dirty).add('note|' + pid)) }

  async function save() {
    setBusy(true)
    const period = firstOfMonth(month)
    const up: { player_id: string; period: string; metric_id: number; value: number }[] = []
    const del: [string, number][] = []
    const ev: { player_id: string; period: string; comment: string }[] = []
    for (const k of dirty) {
      if (k.startsWith('note|')) { const pid = k.slice(5); ev.push({ player_id: pid, period, comment: notes[pid] || '' }); continue }
      const [pid, mid] = k.split('|'); const v = vals[k]
      if (v === '' || v == null) del.push([pid, Number(mid)])
      else if (!isNaN(Number(v))) up.push({ player_id: pid, period, metric_id: Number(mid), value: Number(v) })
    }
    const errs: string[] = []
    if (up.length) { const r = await sb.from('player_metrics').upsert(up); if (r.error) errs.push(r.error.message) }
    for (const [pid, mid] of del) await sb.from('player_metrics').delete().eq('player_id', pid).eq('period', period).eq('metric_id', mid)
    if (ev.length) { const r = await sb.from('player_evaluations').upsert(ev); if (r.error) errs.push(r.error.message) }
    setBusy(false)
    if (errs.length) toast('Σφάλμα: ' + errs[0]); else { toast(`Αποθηκεύτηκαν ${up.length + ev.length} τιμές ✓`); setDirty(new Set()) }
  }

  const avg = useMemo(() => Object.fromEntries(cols.map((d) => {
    const all = players.map((p) => vals[`${p.id}|${d.id}`]).filter((x) => x !== undefined && x !== '' && !isNaN(Number(x))).map(Number)
    return [d.id, all.length ? all.reduce((a, b) => a + b, 0) / all.length : null]
  })), [cols, players, vals])

  const outOfRange = (d: MetricDef, v: string) => v !== '' && v != null && ((d.min_value != null && Number(v) < Number(d.min_value)) || (d.max_value != null && Number(v) > Number(d.max_value)))

  return (
    <>
      <PageHead eyebrow="Προπονητικό τμήμα" title="Επιδόσεις & Βιομετρικά" sub="Μηνιαία καταγραφή ανά ομάδα. Τα γραφήματα εξέλιξης φαίνονται στην καρτέλα κάθε αθλητή.">
        <button className="btn ghost" onClick={() => setManage(true)}><Settings2 size={16} />Τεστ & μετρήσεις</button>
        <button className="btn red" disabled={busy || !dirty.size} onClick={save}><Save size={17} />{busy ? 'Αποθήκευση…' : `Αποθήκευση${dirty.size ? ` (${dirty.size})` : ''}`}</button>
      </PageHead>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="pills">{visible.map((t) => <button key={t.id} className={'pill' + (team === t.id ? ' on' : '')} onClick={() => setTeam(t.id)}>{t.name}</button>)}</div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 170 }} />
      </div>
      <div className="tabs">{Object.entries(CATEGORIES).map(([k, l]) => <button key={k} className={'tab' + (cat === k ? ' on' : '')} onClick={() => setCat(k as keyof typeof CATEGORIES)}>{l}</button>)}</div>
      {!visible.length ? <div className="card"><Empty title="Δεν σου έχουν ανατεθεί ομάδες" text="Η γραμματεία αναθέτει ομάδες στους προπονητές από τις Ρυθμίσεις." /></div> :
      <div className="card flush">
        {players.length ? <div className="scroll"><table className="entry">
          <thead><tr><th className="sticky">Αθλητής</th>{cols.map((d) => <th key={d.id} style={{ textAlign: 'center' }}>{d.name}<div style={{ textTransform: 'none', fontWeight: 500 }}>{d.unit}{d.higher_better ? '' : ' ↓'}</div></th>)}
            {cat === 'body' && <th style={{ textAlign: 'center' }}>BMI</th>}{cat === 'behavior' && <th>Σχόλιο προπονητή</th>}</tr></thead>
          <tbody>{players.map((p) => {
            const h = Number(vals[`${p.id}|${defs.find((d) => d.name === 'Ύψος')?.id}`]), w = Number(vals[`${p.id}|${defs.find((d) => d.name === 'Βάρος')?.id}`])
            return <tr key={p.id}>
              <td className="sticky"><Link to={`/players/${p.id}`}><b>{fullName(p)}</b></Link></td>
              {cols.map((d) => { const k = `${p.id}|${d.id}`; const pv = prev[k]
                return <td key={d.id} style={{ textAlign: 'center' }}>
                  <input className="cell" inputMode="decimal" value={vals[k] ?? ''} placeholder={pv != null ? String(pv) : ''} title={pv != null ? `Προηγ. μήνας: ${pv}` : ''}
                    style={outOfRange(d, vals[k]) ? { borderColor: 'var(--red)', background: 'var(--bad-bg)' } : dirty.has(k) ? { borderColor: 'var(--navy-3)' } : undefined}
                    onChange={(e) => setV(k, e.target.value)} /></td> })}
              {cat === 'body' && <td style={{ textAlign: 'center' }} className="num">{h > 0 && w > 0 ? (w / ((h / 100) ** 2)).toFixed(1) : '—'}</td>}
              {cat === 'behavior' && <td style={{ minWidth: 260 }}><input value={notes[p.id] || ''} onChange={(e) => setN(p.id, e.target.value)} placeholder="Σύντομο σχόλιο για τον μήνα…" /></td>}
            </tr> })}
            <tr style={{ background: 'var(--soft)' }}><td className="sticky" style={{ background: 'var(--soft)' }}><b>Μέσος όρος</b></td>
              {cols.map((d) => <td key={d.id} style={{ textAlign: 'center' }} className="num"><b>{avg[d.id] != null ? Number(avg[d.id]).toFixed(d.decimals) : '—'}</b></td>)}
              {(cat === 'body' || cat === 'behavior') && <td />}</tr>
          </tbody></table></div>
          : <Empty title="Η ομάδα δεν έχει ενεργούς αθλητές" />}
      </div>}
      <p className="muted" style={{ marginTop: 10 }}>Το γκρι νούμερο σε κάθε κελί είναι η τιμή του προηγούμενου μήνα. ↓ = όσο μικρότερο τόσο καλύτερο (π.χ. χρόνοι). Κόκκινο = τιμή εκτός λογικών ορίων.</p>
      {manage && <ManageMetrics onClose={() => { setManage(false); loadDefs() }} />}
    </>
  )
}

function ManageMetrics({ onClose }: { onClose: () => void }) {
  const { toast } = useApp()
  const [defs, setDefs] = useState<MetricDef[]>([])
  const [n, setN] = useState({ name: '', unit: '', category: 'physical', higher_better: true, decimals: 1 })
  const load = () => sb.from('metric_defs').select('*').order('sort').then(({ data }) => setDefs(data || []))
  useEffect(() => { load() }, [])
  async function add() {
    if (!n.name) return
    const r = await sb.from('metric_defs').insert({ ...n, sort: 100 + defs.length }); if (r.error) return toast(r.error.message)
    setN({ ...n, name: '', unit: '' }); load()
  }
  async function toggle(d: MetricDef) { await sb.from('metric_defs').update({ active: !d.active }).eq('id', d.id); load() }
  return <Modal wide title="Τεστ & μετρήσεις" onClose={onClose}>
    <div className="stack">
      {Object.entries(CATEGORIES).map(([k, l]) => <div key={k}><div className="section-t" style={{ marginTop: 0 }}>{l}</div>
        <div className="chips">{defs.filter((d) => d.category === k).map((d) => <button key={d.id} className={'pill' + (d.active ? ' on' : '')} onClick={() => toggle(d)} title={d.active ? 'Ενεργό – πάτα για απόκρυψη' : 'Κρυφό – πάτα για ενεργοποίηση'}>{d.name}{d.unit ? ` (${d.unit})` : ''}</button>)}</div></div>)}
      <div className="section-t">Νέο τεστ</div>
      <div className="form">
        <label className="f">Όνομα<input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="π.χ. Ζογκλέρ" /></label>
        <label className="f">Μονάδα<input value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })} placeholder="π.χ. επαναλήψεις" /></label>
        <label className="f">Κατηγορία<select value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="f">Καλύτερο είναι<select value={n.higher_better ? '1' : '0'} onChange={(e) => setN({ ...n, higher_better: e.target.value === '1' })}><option value="1">Το μεγαλύτερο</option><option value="0">Το μικρότερο (χρόνος)</option></select></label>
      </div>
      <div><button className="btn red" onClick={add}><Plus size={16} />Προσθήκη τεστ</button></div>
    </div>
  </Modal>
}
