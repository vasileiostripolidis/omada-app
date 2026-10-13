import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Mail, Upload, Trash2 } from 'lucide-react'
import { sb, fullName, initials, isAdult, uploadPublic, type Team, type Player } from '../lib/supabase'
import { announce } from '../lib/billing'
import { useApp, Modal, PageHead, Empty } from '../ui'

export default function Teams() {
  const { toast, teams, reloadTeams } = useApp()
  const [players, setPlayers] = useState<Player[]>([])
  const [edit, setEdit] = useState<Partial<Team> | null>(null)
  const [mail, setMail] = useState<Team | null>(null)
  const load = () => sb.from('players').select('*').eq('active', true).order('last_name').then(({ data }) => setPlayers(data || []))
  useEffect(() => { load() }, [])
  const unassigned = players.filter((p) => !p.team_id)
  async function assign(pid: string, tid: string) { await sb.from('players').update({ team_id: tid || null }).eq('id', pid); load(); toast('Ανατέθηκε ✓') }

  return (
    <>
      <PageHead eyebrow="Ακαδημία" title="Ομάδες" sub="Οι ομάδες της ακαδημίας και τα ρόστερ τους.">
        <button className="btn red" onClick={() => setEdit({ color: '#021534' })}><Plus size={18} />Νέα ομάδα</button>
      </PageHead>
      <div className="grid-2">
        {teams.map((t) => {
          const roster = players.filter((p) => p.team_id === t.id)
          return <div className="card flush" key={t.id} style={{ borderTop: `5px solid ${t.color || 'var(--navy)'}` }}>
            <div className="row" style={{ padding: 18, gap: 16 }}>
              {t.logo_url ? <img src={t.logo_url} alt="" style={{ width: 84, height: 84, objectFit: 'contain' }} /> : <div className="avatar lg" style={{ background: t.color || 'var(--navy)' }}>{t.name[0]}</div>}
              <div className="grow"><h2 style={{ margin: 0, fontSize: 22 }}>{t.name}</h2>
                <div className="muted">{[t.age_group, t.season, t.coach_name && `Προπονητής: ${t.coach_name}`].filter(Boolean).join(' · ') || '—'}</div>
                {t.training_schedule && <div className="muted">Προπονήσεις: {t.training_schedule}</div>}
                <div className="row" style={{ marginTop: 8 }}><span className="badge b-navy">{roster.length} αθλητές</span></div></div>
              <div className="row" style={{ flexDirection: 'column' }}>
                <button className="iconbtn" title="Επεξεργασία" onClick={() => setEdit(t)}><Pencil size={15} /></button>
                <button className="iconbtn" title="Email σε ενήλικες αθλητές" onClick={() => setMail(t)}><Mail size={15} /></button></div>
            </div>
            <div className="list" style={{ borderTop: '1px solid var(--line)', maxHeight: 340, overflow: 'auto' }}>{roster.map((p) => <Link to={`/players/${p.id}`} className="item" key={p.id}>
              <span className="head" style={{ width: 26, fontWeight: 800, color: 'var(--muted)' }}>{p.jersey_number ?? ''}</span><div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{initials(p)}</div>
              <div className="grow">{fullName(p)}</div><span className="muted">{p.position}</span></Link>)}
              {!roster.length && <div className="empty" style={{ padding: 20 }}>Χωρίς αθλητές ακόμα</div>}</div>
          </div>
        })}
      </div>
      {!teams.length && <div className="card"><Empty title="Καμία ομάδα" /></div>}
      {unassigned.length > 0 && teams.length > 0 && <div className="card flush" style={{ marginTop: 16 }}><div className="card-head"><h2>Αθλητές χωρίς ομάδα ({unassigned.length})</h2></div>
        <div className="list">{unassigned.map((p) => <div className="item" key={p.id}><div className="grow t">{fullName(p)}</div>
          <select style={{ width: 'auto' }} value="" onChange={(e) => assign(p.id, e.target.value)}><option value="">Ανάθεση σε…</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>)}</div></div>}
      {edit && <TeamForm t={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reloadTeams() }} />}
      {mail && <MailTeam team={mail} players={players.filter((p) => p.team_id === mail.id)} onClose={() => setMail(null)} />}
    </>
  )
}

function TeamForm({ t, onClose, onSaved }: { t: Partial<Team>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<Partial<Team>>(t)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Team) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value || null })
  async function logo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true); try { setF({ ...f, logo_url: await uploadPublic(file, 'teams') }) } catch (err) { toast((err as Error).message) } finally { setBusy(false) }
  }
  async function save() {
    if (!f.name) return toast('Συμπλήρωσε όνομα')
    const { id, ...rest } = f
    const r = id ? await sb.from('teams').update(rest).eq('id', id) : await sb.from('teams').insert(rest)
    if (r.error) return toast(r.error.message)
    toast('Αποθηκεύτηκε ✓'); onSaved()
  }
  async function del() { if (confirm(`Διαγραφή ομάδας «${f.name}»; Οι αθλητές μένουν χωρίς ομάδα.`)) { await sb.from('teams').delete().eq('id', f.id); onSaved() } }
  const I = (k: keyof Team, l: string, ph = '') => <label className="f">{l}<input placeholder={ph} value={(f[k] as string) ?? ''} onChange={set(k)} /></label>
  return <Modal title={f.id ? 'Επεξεργασία ομάδας' : 'Νέα ομάδα'} onClose={onClose}
    foot={<>{f.id && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={del}><Trash2 size={15} />Διαγραφή</button>}<button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" disabled={busy} onClick={save}>Αποθήκευση</button></>}>
    <div className="form">
      <div className="full row">{f.logo_url && <img src={f.logo_url} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />}
        <label className="btn ghost" style={{ cursor: 'pointer' }}><Upload size={16} />{busy ? 'Ανέβασμα…' : 'Λογότυπο ομάδας'}<input type="file" accept="image/*" hidden onChange={logo} /></label></div>
      {I('name', 'Όνομα *')}{I('short_name', 'Σύντομο όνομα', 'π.χ. ΚΕΡ')}{I('age_group', 'Κατηγορία', 'π.χ. Κ12 / 2014-15')}{I('season', 'Σεζόν', '2026-27')}
      {I('coach_name', 'Προπονητής')}{I('training_schedule', 'Πρόγραμμα προπονήσεων', 'Τρ-Πε 18:00')}
      <label className="f">Χρώμα<input type="color" value={f.color || '#021534'} onChange={set('color')} style={{ height: 44, padding: 4 }} /></label>
    </div>
  </Modal>
}

function MailTeam({ team, players, onClose }: { team: Team; players: Player[]; onClose: () => void }) {
  const { toast } = useApp()
  const [subject, setSubject] = useState(`${team.name}: Ενημέρωση`)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const to = [...new Set(players.filter((p) => isAdult(p) && p.email).map((p) => p.email!))]
  async function send() {
    setBusy(true)
    try { const r = await announce(to, subject, body.split('\n').map((l) => `<p>${l.replace(/</g, '&lt;')}</p>`).join('')); toast(r.sent ? `Στάλθηκαν ${r.sent}/${r.total}` : 'Δεν στάλθηκε: ' + (r.error || '')) }
    catch (e) { toast((e as Error).message) } finally { setBusy(false); onClose() }
  }
  return <Modal title={`Ενημέρωση – ${team.name}`} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" disabled={busy || !to.length || !body} onClick={send}>{busy ? 'Αποστολή…' : `Αποστολή σε ${to.length}`}</button></>}>
    <div className="stack">
      <div className="note">Σύμφωνα με την πολιτική του συλλόγου, οι γονείς λαμβάνουν μόνο ειδοποιήσεις πληρωμών. Οι ενημερώσεις αυτές πηγαίνουν μόνο σε <b>ενήλικες αθλητές</b> με email ({to.length}).</div>
      <label className="f">Θέμα<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label className="f">Μήνυμα<textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} /></label>
    </div>
  </Modal>
}
