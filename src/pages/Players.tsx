import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FileWarning } from 'lucide-react'
import { sb, age, fullName, initials, isAdult, today, RELATIONS, type Player, type Household } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty, TeamChip } from '../ui'

export default function Players() {
  const { teams } = useApp()
  const nav = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [fam, setFam] = useState<Record<string, string[]>>({})
  const [q, setQ] = useState('')
  const [team, setTeam] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const [p, l] = await Promise.all([
      sb.from('players').select('*').order('last_name'),
      sb.from('player_households').select('player_id, households(name)'),
    ])
    setPlayers(p.data || [])
    const m: Record<string, string[]> = {}
    for (const r of (l.data || []) as unknown as { player_id: string; households: { name: string } | null }[]) if (r.households) (m[r.player_id] ||= []).push(r.households.name)
    setFam(m)
  }
  useEffect(() => { load() }, [])

  const t = today()
  const list = players.filter((p) => (showInactive || p.active) && (!team || p.team_id === team)
    && (fullName(p) + ' ' + (fam[p.id] || []).join(' ')).toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHead eyebrow="Ρόστερ" title="Αθλητές" sub={`${players.filter((p) => p.active).length} ενεργοί αθλητές`}>
        <button className="btn red" onClick={() => setAdding(true)}><Plus size={18} />Νέος αθλητής</button>
      </PageHead>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="search"><Search size={17} /><input placeholder="Αναζήτηση αθλητή ή οικογένειας…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="pills">
          <button className={'pill' + (!team ? ' on' : '')} onClick={() => setTeam('')}>Όλες</button>
          {teams.map((x) => <button key={x.id} className={'pill' + (team === x.id ? ' on' : '')} onClick={() => setTeam(x.id)}>{x.short_name || x.name}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Ανενεργοί</label>
      </div>
      <div className="card flush">
        {list.length ? <div className="scroll"><table>
          <thead><tr><th>Αθλητής</th><th>Ομάδα</th><th>Ηλικία</th><th>Οικογένεια</th><th>Έγγραφα</th></tr></thead>
          <tbody>{list.map((p) => {
            const med = p.medical_expiry && p.medical_expiry >= t
            return <tr key={p.id} className="click" onClick={() => nav(`/players/${p.id}`)}>
              <td><div className="row" style={{ flexWrap: 'nowrap' }}><div className="avatar">{initials(p)}</div><div><b>{fullName(p)}</b>{p.jersey_number != null && <span className="muted"> #{p.jersey_number}</span>}
                <div className="muted">{p.position || ''}{!p.active && ' · ανενεργός'}</div></div></div></td>
              <td><TeamChip team={teams.find((x) => x.id === p.team_id)} /></td>
              <td className="num">{age(p.birth_date) ?? '—'}{isAdult(p) && <span className="badge b-info" style={{ marginLeft: 6 }}>Ενήλικας</span>}</td>
              <td>{fam[p.id]?.length ? fam[p.id].join(', ') : <span className="badge b-warn">Χωρίς γονέα</span>}</td>
              <td>{med ? <span className="badge b-ok">Ιατρική ✓</span> : <span className="badge b-bad"><FileWarning size={12} />Ιατρική</span>}</td>
            </tr>
          })}</tbody></table></div>
          : <Empty title="Δεν βρέθηκαν αθλητές" text="Πρόσθεσε τον πρώτο αθλητή της ακαδημίας."><button className="btn red" onClick={() => setAdding(true)}><Plus size={18} />Νέος αθλητής</button></Empty>}
      </div>
      <button className="btn red fab" onClick={() => setAdding(true)} aria-label="Νέος αθλητής"><Plus size={26} /></button>
      {adding && <PlayerForm player={{ active: true }} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); nav(`/players/${id}`) }} />}
    </>
  )
}

type FamMode = 'new' | 'existing' | 'self' | 'none'

export function PlayerForm({ player, onClose, onSaved }: { player: Partial<Player>; onClose: () => void; onSaved: (id: string) => void }) {
  const { toast, teams } = useApp()
  const [f, setF] = useState<Partial<Player>>(player)
  const isNew = !player.id
  const [mode, setMode] = useState<FamMode>('new')
  const [g, setG] = useState({ first_name: '', last_name: '', relation: 'Πατέρας', phone: '', email: '' })
  const [g2, setG2] = useState({ first_name: '', last_name: '', relation: 'Μητέρα', phone: '', email: '' })
  const [households, setHouseholds] = useState<Household[]>([])
  const [hid, setHid] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (isNew) sb.from('households').select('*').eq('active', true).order('name').then(({ data }) => setHouseholds(data || [])) }, [isNew])

  const set = (k: keyof Player) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value === '' ? null : e.target.value })
  const I = (k: keyof Player, label: string, type = 'text', req = false) =>
    <label className="f">{label}<input type={type} value={(f[k] as string | number | null) ?? ''} onChange={set(k)} required={req} /></label>
  const adult = isAdult({ birth_date: f.birth_date ?? null })

  async function save() {
    if (!f.first_name || !f.last_name) return toast('Συμπλήρωσε όνομα και επώνυμο')
    setBusy(true)
    try {
      const { id, ...rest } = f
      if (id) {
        const r = await sb.from('players').update(rest).eq('id', id); if (r.error) throw r.error
        toast('Αποθηκεύτηκε ✓'); return onSaved(id)
      }
      const r = await sb.from('players').insert(rest).select('id').single(); if (r.error) throw r.error
      const pid = r.data.id as string
      let household: string | null = null
      if (mode === 'existing' && hid) household = hid
      if (mode === 'new' && g.first_name) {
        const ln = g.last_name || f.last_name!
        const h = await sb.from('households').insert({ name: `Οικογένεια ${ln}` }).select('id').single(); if (h.error) throw h.error
        household = h.data.id
        const rows = [{ ...g, last_name: ln, household_id: household }]
        if (g2.first_name) rows.push({ ...g2, last_name: g2.last_name || ln, household_id: household })
        const gi = await sb.from('guardians').insert(rows.map((x) => ({ ...x, email: x.email || null, phone: x.phone || null }))); if (gi.error) throw gi.error
      }
      if (mode === 'self') {
        const h = await sb.from('households').insert({ name: `${f.last_name} ${f.first_name} (ενήλικας)` }).select('id').single(); if (h.error) throw h.error
        household = h.data.id
        await sb.from('guardians').insert({ household_id: household, first_name: f.first_name, last_name: f.last_name, relation: 'Ο ίδιος (ενήλικας)', email: f.email || null, phone: f.phone || null })
      }
      if (household) await sb.from('player_households').insert({ player_id: pid, household_id: household, share_pct: 100 })
      toast('Ο αθλητής προστέθηκε ✓'); onSaved(pid)
    } catch (e) { toast('Σφάλμα: ' + (e as Error).message) } finally { setBusy(false) }
  }

  const G = (v: typeof g, s: typeof setG, title: string) => <>
    <div className="section-t" style={{ fontSize: 12.5, marginTop: 6 }}>{title}</div>
    <label className="f">Όνομα<input value={v.first_name} onChange={(e) => s({ ...v, first_name: e.target.value })} /></label>
    <label className="f">Επώνυμο<input placeholder={f.last_name || ''} value={v.last_name} onChange={(e) => s({ ...v, last_name: e.target.value })} /></label>
    <label className="f">Σχέση<select value={v.relation} onChange={(e) => s({ ...v, relation: e.target.value })}>{RELATIONS.slice(0, 4).map((r) => <option key={r}>{r}</option>)}</select></label>
    <label className="f">Κινητό<input type="tel" value={v.phone} onChange={(e) => s({ ...v, phone: e.target.value })} /></label>
    <label className="f">Email<input type="email" value={v.email} onChange={(e) => s({ ...v, email: e.target.value })} /></label>
  </>

  return (
    <Modal wide title={isNew ? 'Νέος αθλητής' : 'Επεξεργασία αθλητή'} onClose={onClose}
      foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" disabled={busy} onClick={save}>{busy ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></>}>
      <div className="form">
        <div className="section-t" style={{ marginTop: 0 }}>Στοιχεία αθλητή</div>
        {I('first_name', 'Όνομα *', 'text', true)}{I('last_name', 'Επώνυμο *', 'text', true)}{I('birth_date', 'Ημερομηνία γέννησης', 'date')}
        <label className="f">Ομάδα<select value={f.team_id || ''} onChange={set('team_id')}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {I('jersey_number', 'Αριθμός φανέλας', 'number')}
        <label className="f">Θέση<select value={f.position || ''} onChange={set('position')}><option value="">—</option>{['Τερματοφύλακας', 'Αμυντικός', 'Μέσος', 'Επιθετικός'].map((x) => <option key={x}>{x}</option>)}</select></label>
        {I('amka', 'ΑΜΚΑ')}{I('address', 'Διεύθυνση')}
        {adult && <>{I('phone', 'Κινητό αθλητή', 'tel')}{I('email', 'Email αθλητή', 'email')}</>}
        <div className="section-t">Δελτίο & ιατρικά</div>
        {I('card_number', 'Αρ. δελτίου')}{I('card_expiry', 'Λήξη δελτίου', 'date')}{I('medical_expiry', 'Λήξη ιατρικής βεβαίωσης', 'date')}
        <label className="f full">Ιατρικές σημειώσεις / αλλεργίες<textarea rows={2} value={f.medical_notes || ''} onChange={set('medical_notes')} /></label>
        <label className="f full">Σημειώσεις<textarea rows={2} value={f.notes || ''} onChange={set('notes')} /></label>
        <label className="check full"><input type="checkbox" checked={!!f.active} onChange={set('active')} />Ενεργός αθλητής (μετράει στις μηνιαίες χρεώσεις)</label>

        {isNew && <>
          <div className="section-t">Γονείς & πληρωμή</div>
          <div className="pills full">
            <button type="button" className={'pill' + (mode === 'new' ? ' on' : '')} onClick={() => setMode('new')}>Νέοι γονείς</button>
            <button type="button" className={'pill' + (mode === 'existing' ? ' on' : '')} onClick={() => setMode('existing')}>Υπάρχουσα οικογένεια (αδέρφια)</button>
            {adult && <button type="button" className={'pill' + (mode === 'self' ? ' on' : '')} onClick={() => setMode('self')}>Πληρώνει ο ίδιος (ενήλικας)</button>}
            <button type="button" className={'pill' + (mode === 'none' ? ' on' : '')} onClick={() => setMode('none')}>Αργότερα</button>
          </div>
          {mode === 'new' && <>{G(g, setG, 'Γονέας 1')}{G(g2, setG2, 'Γονέας 2 (προαιρετικά)')}</>}
          {mode === 'existing' && <label className="f full">Οικογένεια<select value={hid} onChange={(e) => setHid(e.target.value)}><option value="">Επίλεξε…</option>{households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>}
          {mode === 'self' && <div className="note full">Θα δημιουργηθεί λογαριασμός χρέωσης στο όνομα του αθλητή· οι ειδοποιήσεις πληρωμών πάνε στο δικό του email.</div>}
        </>}
      </div>
    </Modal>
  )
}
