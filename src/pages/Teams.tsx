import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Mail } from 'lucide-react'
import { sb, eur, fullName, type Team, type Player } from '../lib/supabase'
import { sendEmail } from '../lib/email'
import { useApp, Modal } from '../App'

export default function Teams() {
  const { toast, settings } = useApp()
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [edit, setEdit] = useState<Partial<Team> | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [mail, setMail] = useState<Team | null>(null)

  const load = async () => {
    const [t, p] = await Promise.all([sb.from('teams').select('*').order('name'), sb.from('players').select('*').eq('active', true).order('last_name')])
    setTeams(t.data || []); setPlayers(p.data || [])
  }
  useEffect(() => { load() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const { id, ...rest } = edit!
    const r = id ? await sb.from('teams').update(rest).eq('id', id) : await sb.from('teams').insert(rest)
    if (r.error) return toast(r.error.message)
    setEdit(null); load(); toast('Αποθηκεύτηκε ✓')
  }
  async function del(t: Team) { if (confirm(`Διαγραφή ομάδας «${t.name}»; Οι παίκτες θα μείνουν χωρίς ομάδα.`)) { await sb.from('teams').delete().eq('id', t.id); setEdit(null); load() } }
  async function assign(pid: string, tid: string) { await sb.from('players').update({ team_id: tid || null }).eq('id', pid); load() }

  const unassigned = players.filter((p) => !p.team_id)
  const set = (k: keyof Team) => (e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, [k]: e.target.value || null })

  return (
    <>
      <div className="row between"><h1>Ομάδες</h1><button className="btn" onClick={() => setEdit({ color: settings?.primary_color || '#0f7a3d' })}><Plus size={18} />Νέα ομάδα</button></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' }}>
        {teams.map((t) => {
          const roster = players.filter((p) => p.team_id === t.id)
          return <div className="card" key={t.id} style={{ borderTop: `5px solid ${t.color || 'var(--brand)'}` }}>
            <div className="row between"><h2 style={{ margin: 0 }}>{t.name}</h2>
              <div className="row"><button className="btn ghost sm" title="Email σε γονείς" onClick={() => setMail(t)}><Mail size={15} /></button><button className="btn ghost sm" onClick={() => setEdit(t)}><Pencil size={15} /></button></div></div>
            <div className="muted">{[t.age_group, t.season, t.coach_name && `Προπ.: ${t.coach_name}`, t.monthly_fee && eur(t.monthly_fee) + '/μήνα'].filter(Boolean).join(' · ')}</div>
            {t.training_schedule && <div className="muted">🕒 {t.training_schedule}</div>}
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setOpen(open === t.id ? null : t.id)}>{roster.length} παίκτες {open === t.id ? '▲' : '▼'}</button>
            {open === t.id && <div className="list">{roster.map((p) => <Link to={`/players/${p.id}`} className="item" key={p.id}>
              <span className="muted" style={{ width: 24 }}>{p.jersey_number ?? ''}</span><div className="grow">{fullName(p)}</div><span className="muted">{p.position}</span></Link>)}</div>}
          </div>
        })}
      </div>
      {!teams.length && <div className="card empty">Φτιάξε την πρώτη ομάδα (π.χ. «Κ12», «Παμπαίδες»).</div>}
      {unassigned.length > 0 && teams.length > 0 && <div className="card" style={{ marginTop: 14 }}><h2>Παίκτες χωρίς ομάδα ({unassigned.length})</h2>
        <div className="list">{unassigned.map((p) => <div className="item" key={p.id}><div className="grow">{fullName(p)}</div>
          <select style={{ width: 'auto' }} value="" onChange={(e) => assign(p.id, e.target.value)}><option value="">Ανάθεση σε…</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>)}</div></div>}

      {edit && <Modal title={edit.id ? 'Επεξεργασία ομάδας' : 'Νέα ομάδα'} onClose={() => setEdit(null)}>
        <form onSubmit={save}><div className="form">
          <label>Όνομα *<input required value={edit.name || ''} onChange={set('name')} /></label>
          <label>Ηλικιακή κατηγορία<input placeholder="π.χ. 2014-2015" value={edit.age_group || ''} onChange={set('age_group')} /></label>
          <label>Σεζόν<input placeholder="2026-27" value={edit.season || ''} onChange={set('season')} /></label>
          <label>Προπονητής<input value={edit.coach_name || ''} onChange={set('coach_name')} /></label>
          <label>Πρόγραμμα προπονήσεων<input placeholder="Τρ-Πε 18:00" value={edit.training_schedule || ''} onChange={set('training_schedule')} /></label>
          <label>Μηνιαία συνδρομή € (προαιρ.)<input type="number" value={edit.monthly_fee ?? ''} onChange={set('monthly_fee')} /></label>
          <label>Χρώμα<input type="color" value={edit.color || '#0f7a3d'} onChange={set('color')} style={{ height: 44 }} /></label>
        </div>
          <div className="row" style={{ marginTop: 14 }}><button className="btn grow" style={{ justifyContent: 'center' }}>Αποθήκευση</button>
            {edit.id && <button type="button" className="btn danger" onClick={() => del(edit as Team)}>Διαγραφή</button>}</div>
        </form></Modal>}
      {mail && <MailTeam team={mail} players={players.filter((p) => p.team_id === mail.id)} onClose={() => setMail(null)} />}
    </>
  )

  function MailTeam({ team, players, onClose }: { team: Team; players: Player[]; onClose: () => void }) {
    const [subject, setSubject] = useState(`${team.name}: Ενημέρωση`)
    const [body, setBody] = useState('')
    const [busy, setBusy] = useState(false)
    const to = [...new Set(players.map((p) => p.guardian_email).filter(Boolean))] as string[]
    async function send() {
      setBusy(true); let ok = 0
      for (const t of to) { try { await sendEmail({ to: t, subject, kind: 'team', html: body.split('\n').map((l) => `<p>${l}</p>`).join('') + `<p>${settings?.club_name || ''}</p>` }); ok++ } catch { /* logged */ } }
      setBusy(false); toast(`Στάλθηκαν ${ok}/${to.length}`); onClose()
    }
    return <Modal title={`Email σε γονείς – ${team.name}`} onClose={onClose}><div style={{ display: 'grid', gap: 12 }}>
      <div className="muted">{to.length} παραλήπτες</div>
      <label>Θέμα<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label>Μήνυμα<textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <button className="btn" disabled={busy || !to.length || !body} onClick={send} style={{ justifyContent: 'center' }}>{busy ? 'Αποστολή…' : 'Αποστολή'}</button>
    </div></Modal>
  }
}
