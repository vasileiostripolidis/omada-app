import { useEffect, useState } from 'react'
import { Plus, Pin, Trash2, Upload, Tag, EyeOff, Megaphone } from 'lucide-react'
import { sb, dt, fullName, uploadPublic, type Announcement, type Player } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty, TeamChip } from '../ui'
import Urgent from '../components/Urgent'
import { sendPush } from '../lib/push'

type Photo = { id: string; album: string; team_id: string | null; path: string; caption: string | null; taken_at: string | null; url?: string; tags: string[] }

export default function News() {
  const { teams, isCoach, myTeams } = useApp()
  const vis = isCoach ? teams.filter((t) => myTeams.includes(t.id)) : teams
  const [tab, setTab] = useState('news')
  const [urgent, setUrgent] = useState<string | null>(null)
  return <>
    <PageHead eyebrow="Επικοινωνία" title="Ανακοινώσεις & Φωτογραφίες" sub="Οι ανακοινώσεις και οι φωτογραφίες εμφανίζονται στην πύλη γονέων. Φωτογραφίες με παιδιά χωρίς συγκατάθεση κρύβονται αυτόματα.">
      <div className="row">{vis.map((t) => <button key={t.id} className="btn ghost sm" onClick={() => setUrgent(t.id)}><Megaphone size={14} />Επείγον SMS · {t.short_name || t.name}</button>)}</div>
    </PageHead>
    <div className="tabs"><button className={'tab' + (tab === 'news' ? ' on' : '')} onClick={() => setTab('news')}>Ανακοινώσεις</button><button className={'tab' + (tab === 'photos' ? ' on' : '')} onClick={() => setTab('photos')}>Φωτογραφίες</button></div>
    {tab === 'news' ? <NewsTab /> : <PhotosTab />}
    {urgent && <Urgent teamId={urgent} teamName={teams.find((t) => t.id === urgent)?.name || ''} onClose={() => setUrgent(null)} />}
  </>
}

function NewsTab() {
  const { teams, toast, isCoach, myTeams } = useApp()
  const [rows, setRows] = useState<Announcement[]>([])
  const [edit, setEdit] = useState<Partial<Announcement> | null>(null)
  const [notify, setNotify] = useState(true)
  const load = () => sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  async function save() {
    if (!edit?.title) return toast('Συμπλήρωσε τίτλο')
    if (isCoach && !edit.team_id) return toast('Επίλεξε ομάδα')
    const { id, ...rest } = edit
    const r = id ? await sb.from('announcements').update(rest).eq('id', id) : await sb.from('announcements').insert(rest)
    if (r.error) return toast(r.error.message)
    if (!id && notify) sendPush({ title: rest.title!, body: (rest.body || '').slice(0, 180), audience: 'parents', team_id: rest.team_id || null, tag: 'news' }).then((x) => toast(`Δημοσιεύτηκε ✓ · push σε ${x.delivered} συσκευές`)).catch(() => toast('Δημοσιεύτηκε ✓'))
    else toast('Δημοσιεύτηκε ✓')
    setEdit(null); load()
  }
  async function img(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) setEdit({ ...edit, image_url: await uploadPublic(f, 'news') }) }
  const opts = isCoach ? teams.filter((t) => myTeams.includes(t.id)) : teams
  return <div className="stack">
    <div><button className="btn red" onClick={() => setEdit({ team_id: isCoach ? opts[0]?.id : null, pinned: false })}><Plus size={16} />Νέα ανακοίνωση</button></div>
    {rows.length ? rows.map((a) => <div className="card" key={a.id}>
      <div className="row between" style={{ alignItems: 'flex-start' }}><div className="grow">
        <div className="row">{a.pinned && <span className="badge b-bad"><Pin size={11} />Καρφιτσωμένη</span>}{a.team_id ? <TeamChip team={teams.find((t) => t.id === a.team_id)} /> : <span className="badge b-navy">Όλη η ακαδημία</span>}<span className="muted">{dt(a.created_at)}</span></div>
        <h2 style={{ margin: '8px 0 6px', textTransform: 'none', letterSpacing: 0, fontSize: 21 }}>{a.title}</h2>
        {a.body && <div style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div>}
        {a.image_url && <img src={a.image_url} alt="" style={{ marginTop: 10, maxHeight: 280, borderRadius: 10 }} />}</div>
        <div className="row" style={{ flexWrap: 'nowrap' }}><button className="btn ghost sm" onClick={() => setEdit(a)}>Επεξεργασία</button>
          <button className="iconbtn" onClick={async () => { if (confirm('Διαγραφή ανακοίνωσης;')) { await sb.from('announcements').delete().eq('id', a.id); load() } }}><Trash2 size={14} /></button></div></div>
    </div>) : <div className="card"><Empty title="Καμία ανακοίνωση" text="π.χ. «Τουρνουά Χριστουγέννων 21/12», «Νέες εμφανίσεις διαθέσιμες στη γραμματεία»." /></div>}
    {edit && <Modal title={edit.id ? 'Επεξεργασία ανακοίνωσης' : 'Νέα ανακοίνωση'} onClose={() => setEdit(null)} foot={<><button className="btn ghost" onClick={() => setEdit(null)}>Άκυρο</button><button className="btn red" onClick={save}>Δημοσίευση</button></>}>
      <div className="form">
        <label className="f full">Τίτλος<input value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
        <label className="f">Αφορά<select value={edit.team_id || ''} onChange={(e) => setEdit({ ...edit, team_id: e.target.value || null })}>{!isCoach && <option value="">Όλη η ακαδημία</option>}{opts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!edit.pinned} onChange={(e) => setEdit({ ...edit, pinned: e.target.checked })} />Καρφίτσωμα στην κορυφή</label>
        {!edit.id && <label className="check full"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Ειδοποίηση push στα κινητά των γονέων</label>}
        <label className="f full">Κείμενο<textarea rows={6} value={edit.body || ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
        <div className="full row">{edit.image_url && <img src={edit.image_url} alt="" style={{ height: 60, borderRadius: 8 }} />}<label className="btn ghost" style={{ cursor: 'pointer' }}><Upload size={15} />Εικόνα<input type="file" accept="image/*" hidden onChange={img} /></label></div>
      </div></Modal>}
  </div>
}

function PhotosTab() {
  const { teams, toast } = useApp()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [consent, setConsent] = useState<Record<string, boolean>>({})
  const [players, setPlayers] = useState<Player[]>([])
  const [album, setAlbum] = useState('')
  const [up, setUp] = useState<{ album: string; team_id: string } | null>(null)
  const [tagFor, setTagFor] = useState<Photo | null>(null)
  const [busy, setBusy] = useState(false)
  const load = async () => {
    const [p, t, c, pl] = await Promise.all([sb.from('photos').select('*').order('taken_at', { ascending: false }).order('created_at', { ascending: false }), sb.from('photo_players').select('*'), sb.from('consents').select('player_id, kind, granted, signed_at').eq('kind', 'media').order('signed_at'), sb.from('players').select('*').eq('active', true).order('last_name')])
    const cm: Record<string, boolean> = {}; for (const r of c.data || []) cm[r.player_id] = r.granted
    setConsent(cm); setPlayers(pl.data || [])
    const list = ((p.data || []) as Photo[]).map((x) => ({ ...x, tags: (t.data || []).filter((y) => y.photo_id === x.id).map((y) => y.player_id) }))
    if (list.length) { const { data: urls } = await sb.storage.from('gallery').createSignedUrls(list.map((x) => x.path), 3600); list.forEach((x, i) => (x.url = urls?.[i]?.signedUrl || undefined)) }
    setPhotos(list)
  }
  useEffect(() => { load() }, [])
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!up) return; setBusy(true)
    for (const file of Array.from(e.target.files || [])) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${file.name.replace(/[^\w.-]/g, '_')}`
      const u = await sb.storage.from('gallery').upload(path, file); if (u.error) { toast(u.error.message); continue }
      await sb.from('photos').insert({ path, album: up.album || 'Γενικά', team_id: up.team_id || null })
    }
    setBusy(false); setUp(null); toast('Οι φωτογραφίες ανέβηκαν ✓ — πάτα σε κάθε φωτογραφία για να σημειώσεις ποια παιδιά εμφανίζονται'); load()
  }
  const albums = [...new Set(photos.map((p) => p.album))]
  const hidden = (p: Photo) => p.tags.some((t) => !consent[t])
  return <div className="stack">
    <div className="row"><button className="btn red" onClick={() => setUp({ album: '', team_id: '' })}><Upload size={16} />Ανέβασμα φωτογραφιών</button>
      <div className="pills"><button className={'pill' + (!album ? ' on' : '')} onClick={() => setAlbum('')}>Όλα</button>{albums.map((a) => <button key={a} className={'pill' + (album === a ? ' on' : '')} onClick={() => setAlbum(a)}>{a}</button>)}</div></div>
    {photos.length ? <div className="gallery">{photos.filter((p) => !album || p.album === album).map((p) => <div key={p.id} className="ph" onClick={() => setTagFor(p)}>
      {p.url && <img src={p.url} alt={p.caption || ''} loading="lazy" />}
      <div className="tag">{hidden(p) ? <span className="badge b-bad"><EyeOff size={11} />Κρυφή από γονείς</span> : p.tags.length ? <span className="badge b-ok"><Tag size={11} />{p.tags.length}</span> : <span className="badge">Χωρίς ετικέτες</span>}</div></div>)}</div>
      : <div className="card"><Empty title="Καμία φωτογραφία" text="Ανέβασε φωτογραφίες από αγώνες & προπονήσεις. Σημείωσε τα παιδιά που φαίνονται — όσα δεν έχουν συγκατάθεση κρύβουν αυτόματα τη φωτογραφία από τους γονείς." /></div>}
    {up && <Modal title="Ανέβασμα φωτογραφιών" onClose={() => setUp(null)}>
      <div className="stack"><div className="form">
        <label className="f">Άλμπουμ<input list="albums" value={up.album} onChange={(e) => setUp({ ...up, album: e.target.value })} placeholder="π.χ. Τουρνουά Χριστουγέννων 2026" /><datalist id="albums">{albums.map((a) => <option key={a} value={a} />)}</datalist></label>
        <label className="f">Ομάδα<select value={up.team_id} onChange={(e) => setUp({ ...up, team_id: e.target.value })}><option value="">Όλη η ακαδημία</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
        <label className="btn red block" style={{ cursor: 'pointer' }}><Upload size={16} />{busy ? 'Ανέβασμα…' : 'Επιλογή φωτογραφιών'}<input type="file" multiple accept="image/*" hidden onChange={upload} /></label></div></Modal>}
    {tagFor && <TagModal p={tagFor} players={players.filter((x) => !tagFor.team_id || x.team_id === tagFor.team_id)} consent={consent} onClose={() => { setTagFor(null); load() }} />}
  </div>
}

function TagModal({ p, players, consent, onClose }: { p: Photo; players: Player[]; consent: Record<string, boolean>; onClose: () => void }) {
  const [tags, setTags] = useState<string[]>(p.tags)
  const [caption, setCaption] = useState(p.caption || '')
  async function save() {
    await sb.from('photo_players').delete().eq('photo_id', p.id)
    if (tags.length) await sb.from('photo_players').insert(tags.map((t) => ({ photo_id: p.id, player_id: t })))
    await sb.from('photos').update({ caption: caption || null }).eq('id', p.id); onClose()
  }
  async function del() { if (confirm('Διαγραφή φωτογραφίας;')) { await sb.storage.from('gallery').remove([p.path]); await sb.from('photos').delete().eq('id', p.id); onClose() } }
  return <Modal wide title="Φωτογραφία" onClose={onClose} foot={<><button className="btn danger" style={{ marginRight: 'auto' }} onClick={del}><Trash2 size={14} />Διαγραφή</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    <div className="grid-2" style={{ alignItems: 'start' }}>
      {p.url && <img src={p.url} alt="" style={{ width: '100%', borderRadius: 10 }} />}
      <div className="stack"><label className="f">Λεζάντα<input value={caption} onChange={(e) => setCaption(e.target.value)} /></label>
        <b>Ποια παιδιά εμφανίζονται;</b>
        <div className="chips">{players.map((x) => <button key={x.id} className={'pill' + (tags.includes(x.id) ? ' on' : '')} onClick={() => setTags(tags.includes(x.id) ? tags.filter((t) => t !== x.id) : [...tags, x.id])}>{fullName(x)}{!consent[x.id] && ' ⚠'}</button>)}</div>
        <div className="muted">⚠ = χωρίς συγκατάθεση για φωτογραφίες — αν επιλεγεί, η φωτογραφία δεν εμφανίζεται στους γονείς.</div></div>
    </div>
  </Modal>
}
