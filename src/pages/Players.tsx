import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { sb, eur, age, fullName, type Player, type Team } from '../lib/supabase'
import { useApp, Modal } from '../App'

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [bal, setBal] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [team, setTeam] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [edit, setEdit] = useState<Partial<Player> | null>(null)

  const load = async () => {
    const [p, t, b] = await Promise.all([
      sb.from('players').select('*').order('last_name'),
      sb.from('teams').select('*').order('name'),
      sb.from('player_balances').select('player_id,balance'),
    ])
    setPlayers(p.data || []); setTeams(t.data || [])
    setBal(Object.fromEntries((b.data || []).map((x) => [x.player_id, Number(x.balance)])))
  }
  useEffect(() => { load() }, [])

  const list = players.filter((p) => (showInactive || p.active) && (!team || p.team_id === team)
    && (fullName(p) + ' ' + (p.guardian_name || '')).toLowerCase().includes(q.toLowerCase()))
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name

  return (
    <>
      <div className="row between"><h1>Παίκτες</h1><button className="btn" onClick={() => setEdit({ active: true })}><Plus size={18} />Νέος παίκτης</button></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
          <input placeholder="Αναζήτηση παίκτη ή κηδεμόνα" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
        </div>
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Όλες οι ομάδες</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Ανενεργοί</label>
      </div>
      <div className="card">
        {list.length ? <div className="list">{list.map((p) => (
          <Link to={`/players/${p.id}`} key={p.id} className="item">
            <div className="avatar">{p.first_name[0]}{p.last_name[0]}</div>
            <div className="grow"><b>{fullName(p)}</b> {!p.active && <span className="badge">ανενεργός</span>}
              <div className="muted">{[teamName(p.team_id), age(p.birth_date) != null && `${age(p.birth_date)} ετών`, p.guardian_phone].filter(Boolean).join(' · ')}</div></div>
            {bal[p.id] > 0 ? <span className="badge b-over">{eur(bal[p.id])}</span> : <span className="badge b-paid">✓</span>}
          </Link>
        ))}</div> : <div className="empty">Δεν βρέθηκαν παίκτες. Πάτα «Νέος παίκτης» για να ξεκινήσεις.</div>}
      </div>
      {edit && <PlayerForm player={edit} teams={teams} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

export function PlayerForm({ player, teams, onClose, onSaved }: { player: Partial<Player>; teams: Team[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<Partial<Player>>(player)
  const set = (k: keyof Player) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value === '' ? null : e.target.value })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const { id, ...rest } = f
    const r = id ? await sb.from('players').update(rest).eq('id', id) : await sb.from('players').insert(rest)
    if (r.error) return toast('Σφάλμα: ' + r.error.message)
    toast('Αποθηκεύτηκε ✓'); onSaved()
  }
  const I = (k: keyof Player, label: string, type = 'text', req = false) =>
    <label>{label}<input type={type} value={(f[k] as string | number | null) ?? ''} onChange={set(k)} required={req} /></label>

  return (
    <Modal title={f.id ? 'Επεξεργασία παίκτη' : 'Νέος παίκτης'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form">
          {I('first_name', 'Όνομα *', 'text', true)}{I('last_name', 'Επώνυμο *', 'text', true)}
          {I('birth_date', 'Ημ. γέννησης', 'date')}
          <label>Ομάδα<select value={f.team_id || ''} onChange={set('team_id')}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          {I('jersey_number', 'Αριθμός φανέλας', 'number')}
          <label>Θέση<select value={f.position || ''} onChange={set('position')}><option value="">—</option>{['Τερματοφύλακας', 'Αμυντικός', 'Μέσος', 'Επιθετικός'].map((x) => <option key={x}>{x}</option>)}</select></label>
          {I('guardian_name', 'Κηδεμόνας')}{I('guardian_phone', 'Τηλέφωνο κηδεμόνα', 'tel')}{I('guardian_email', 'Email κηδεμόνα', 'email')}
          {I('guardian2_name', '2ος κηδεμόνας')}{I('guardian2_phone', 'Τηλ. 2ου κηδεμόνα', 'tel')}
          {I('address', 'Διεύθυνση')}{I('amka', 'ΑΜΚΑ')}{I('medical_expiry', 'Λήξη κάρτας υγείας', 'date')}
          {I('family_code', 'Κωδικός οικογένειας (αδέρφια)')}{I('monthly_fee', 'Ειδική συνδρομή €', 'number')}{I('discount_pct', 'Έκπτωση %', 'number')}
        </div>
        <label style={{ marginTop: 12 }}>Ιατρικές σημειώσεις / αλλεργίες<textarea rows={2} value={f.medical_notes || ''} onChange={set('medical_notes')} /></label>
        <label style={{ marginTop: 12 }}>Σημειώσεις<textarea rows={2} value={f.notes || ''} onChange={set('notes')} /></label>
        <label className="row" style={{ marginTop: 12, gap: 6 }}><input type="checkbox" style={{ width: 'auto' }} checked={!!f.active} onChange={set('active')} />Ενεργός (χρεώνεται μηνιαία)</label>
        <p className="muted">Αδέρφια με τον ίδιο «κωδικό οικογένειας» παίρνουν αυτόματα την έκπτωση αδερφών.</p>
        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>Αποθήκευση</button>
      </form>
    </Modal>
  )
}
