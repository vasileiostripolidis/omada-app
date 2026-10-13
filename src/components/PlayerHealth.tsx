import { useEffect, useState } from 'react'
import { Plus, HeartPulse, CheckCircle2, AlertTriangle } from 'lucide-react'
import { sb, dt, today, type Injury } from '../lib/supabase'
import { useApp, Modal, Empty } from '../ui'

const SEV = ['Ελαφρύς', 'Μέτριος', 'Σοβαρός']
const PARTS = ['Αστράγαλος', 'Γόνατο', 'Μηριαίος', 'Οπίσθιος μηριαίος', 'Προσαγωγοί', 'Γάμπα', 'Πέλμα', 'Μέση', 'Ώμος', 'Χέρι / καρπός', 'Κεφάλι', 'Άλλο']

// εβδομαδιαίος φόρτος = Σ(RPE × λεπτά). Λόγος οξέος/χρόνιου > 1,5 = αυξημένος κίνδυνος τραυματισμού
export async function weeklyLoads(playerId: string, weeks = 8) {
  const since = new Date(Date.now() - weeks * 7 * 864e5)
  const { data } = await sb.from('player_stats').select('rpe, minutes, present, events(starts_at)').eq('player_id', playerId).not('rpe', 'is', null)
  const rows = ((data || []) as unknown as { rpe: number; minutes: number; present: boolean; events: { starts_at: string } | null }[]).filter((r) => r.present && r.events && new Date(r.events.starts_at) >= since)
  const out = Array.from({ length: weeks }, (_, i) => ({ week: i, load: 0 }))
  for (const r of rows) { const w = weeks - 1 - Math.floor((Date.now() - new Date(r.events!.starts_at).getTime()) / (7 * 864e5)); if (w >= 0 && w < weeks) out[w].load += (r.rpe || 0) * (r.minutes || 60) }
  const acute = out[weeks - 1].load, chronic = out.slice(weeks - 4).reduce((a, x) => a + x.load, 0) / 4
  return { weeks: out, acute, chronic, ratio: chronic > 0 ? acute / chronic : null }
}

export default function PlayerHealth({ playerId, readOnly = false, onChange }: { playerId: string; readOnly?: boolean; onChange?: () => void }) {
  const { toast } = useApp()
  const [list, setList] = useState<Injury[]>([])
  const [edit, setEdit] = useState<Partial<Injury> | null>(null)
  const [load, setLoad] = useState<Awaited<ReturnType<typeof weeklyLoads>> | null>(null)
  const reload = async () => {
    const { data } = await sb.from('injuries').select('*').eq('player_id', playerId).order('injury_date', { ascending: false }); setList(data || [])
    setLoad(await weeklyLoads(playerId))
  }
  useEffect(() => { reload() }, [playerId])
  async function save() {
    const { id, ...rest } = edit!
    const r = id ? await sb.from('injuries').update(rest).eq('id', id) : await sb.from('injuries').insert({ ...rest, player_id: playerId })
    if (r.error) return toast(r.error.message); setEdit(null); reload(); onChange?.()
  }
  async function back(i: Injury) { await sb.from('injuries').update({ returned_at: today() }).eq('id', i.id); toast('Επέστρεψε στη δράση ✓'); reload(); onChange?.() }
  const open = list.filter((i) => !i.returned_at)
  const max = Math.max(1, ...(load?.weeks.map((w) => w.load) || [1]))
  const risk = load?.ratio != null && load.ratio > 1.5
  return <div className="stack">
    {open.map((i) => <div key={i.id} className="note warn row"><HeartPulse size={18} /><div className="grow"><b>Τραυματίας από {dt(i.injury_date)}</b> · {i.body_part} {i.type && `(${i.type})`} · {i.severity}{i.expected_return && ` · Αναμενόμενη επιστροφή ${dt(i.expected_return)}`}</div>
      {!readOnly && <button className="btn ok sm" onClick={() => back(i)}><CheckCircle2 size={14} />Επέστρεψε</button>}</div>)}
    <div className="card">
      <div className="row between"><h2 style={{ margin: 0 }}>Προπονητικός φόρτος (8 εβδομάδες)</h2>
        {load?.ratio != null && <span className={'badge ' + (risk ? 'b-bad' : load.ratio < 0.8 ? 'b-warn' : 'b-ok')}>{risk && <AlertTriangle size={12} />}Οξύς/χρόνιος: {load.ratio.toFixed(2)}</span>}</div>
      {load && load.weeks.some((w) => w.load > 0) ? <>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginTop: 14 }}>{load.weeks.map((w, i) =>
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${w.load} μονάδες`}>
            <span className="muted" style={{ fontSize: 10.5 }}>{w.load || ''}</span>
            <div style={{ width: '100%', height: Math.max(2, (w.load / max) * 90), background: i === 7 ? (risk ? 'var(--red)' : 'var(--navy)') : '#9aa8c2', borderRadius: '4px 4px 0 0' }} /></div>)}</div>
        <div className="row between muted" style={{ fontSize: 11 }}><span>πριν 8 εβδ.</span><span>αυτή η εβδομάδα</span></div>
        <p className="muted" style={{ marginBottom: 0 }}>Φόρτος = RPE (κούραση 1–10 που δηλώνει ο αθλητής) × λεπτά. Λόγος πάνω από 1,5 σημαίνει απότομη αύξηση και αυξημένο κίνδυνο τραυματισμού.</p>
      </> : <div className="muted" style={{ marginTop: 8 }}>Δεν υπάρχουν καταγραφές RPE. Συμπλήρωσέ τες στο παρουσιολόγιο κάθε προπόνησης.</div>}
    </div>
    <div className="card flush"><div className="card-head"><h2>Ιστορικό τραυματισμών</h2>{!readOnly && <button className="btn red sm" onClick={() => setEdit({ injury_date: today(), severity: 'Ελαφρύς', body_part: 'Αστράγαλος' })}><Plus size={14} />Νέος τραυματισμός</button>}</div>
      {list.length ? <div className="scroll"><table><thead><tr><th>Ημ/νία</th><th>Σημείο</th><th>Τύπος</th><th>Σοβαρότητα</th><th>Επιστροφή</th><th>Απουσία</th></tr></thead><tbody>
        {list.map((i) => <tr key={i.id} className={readOnly ? '' : 'click'} onClick={() => !readOnly && setEdit(i)}><td>{dt(i.injury_date)}</td><td>{i.body_part}</td><td>{i.type || '—'}</td><td>{i.severity}</td>
          <td>{i.returned_at ? dt(i.returned_at) : <span className="badge b-bad">Ενεργός</span>}</td>
          <td className="num">{Math.round(((i.returned_at ? new Date(i.returned_at) : new Date()).getTime() - new Date(i.injury_date).getTime()) / 864e5)} ημ.</td></tr>)}</tbody></table></div>
        : <Empty title="Κανένας τραυματισμός" />}
    </div>
    {edit && <Modal title={edit.id ? 'Τραυματισμός' : 'Νέος τραυματισμός'} onClose={() => setEdit(null)} foot={<><button className="btn ghost" onClick={() => setEdit(null)}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
      <div className="form">
        <label className="f">Ημερομηνία<input type="date" value={edit.injury_date || ''} onChange={(e) => setEdit({ ...edit, injury_date: e.target.value })} /></label>
        <label className="f">Σημείο<select value={edit.body_part || ''} onChange={(e) => setEdit({ ...edit, body_part: e.target.value })}>{PARTS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f">Τύπος<input value={edit.type || ''} onChange={(e) => setEdit({ ...edit, type: e.target.value })} placeholder="π.χ. διάστρεμμα, θλάση" /></label>
        <label className="f">Σοβαρότητα<select value={edit.severity || ''} onChange={(e) => setEdit({ ...edit, severity: e.target.value })}>{SEV.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="f">Αναμενόμενη επιστροφή<input type="date" value={edit.expected_return || ''} onChange={(e) => setEdit({ ...edit, expected_return: e.target.value || null })} /></label>
        <label className="f">Επέστρεψε στις<input type="date" value={edit.returned_at || ''} onChange={(e) => setEdit({ ...edit, returned_at: e.target.value || null })} /></label>
        <label className="f full">Περιγραφή / οδηγίες γιατρού<textarea rows={3} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
      </div></Modal>}
  </div>
}
