import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, CheckCircle2, XCircle, FileText, ExternalLink } from 'lucide-react'
import { sb, dt, age, CONSENTS, type Registration } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty } from '../ui'

const LINK = 'https://vasileiostripolidis.github.io/omada-app/#/register'

export default function Registrations() {
  const { toast } = useApp()
  const [rows, setRows] = useState<Registration[]>([])
  const [tab, setTab] = useState('new')
  const [open, setOpen] = useState<Registration | null>(null)
  const load = () => sb.from('registrations').select('*').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  const list = rows.filter((r) => r.status === tab)
  return (
    <>
      <PageHead eyebrow="Γραμματεία" title="Ηλεκτρονικές εγγραφές" sub="Οι γονείς συμπληρώνουν τη φόρμα με συγκαταθέσεις GDPR και υπογραφή· εδώ τις εγκρίνεις με ένα πάτημα." />
      <div className="card row" style={{ marginBottom: 16 }}>
        <div className="grow"><b>Σύνδεσμος εγγραφής για γονείς</b><div className="muted" style={{ wordBreak: 'break-all' }}>{LINK}</div></div>
        <button className="btn ghost" onClick={() => { navigator.clipboard.writeText(LINK); toast('Ο σύνδεσμος αντιγράφηκε ✓') }}><Copy size={16} />Αντιγραφή</button>
        <a className="btn ghost" href={LINK} target="_blank" rel="noreferrer"><ExternalLink size={16} />Προβολή</a>
      </div>
      <div className="tabs">{[['new', 'Νέες'], ['approved', 'Εγκεκριμένες'], ['rejected', 'Απορριφθείσες']].map(([k, l]) =>
        <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l} ({rows.filter((r) => r.status === k).length})</button>)}</div>
      <div className="card flush">
        {list.length ? <div className="list">{list.map((r) => <button key={r.id} className="item click" style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', width: '100%', textAlign: 'left' }} onClick={() => setOpen(r)}>
          <div className="avatar">{(r.child.first_name || '?')[0]}{(r.child.last_name || '')[0]}</div>
          <div className="grow"><div className="t">{r.child.last_name} {r.child.first_name}</div>
            <div className="muted">{age(r.child.birth_date) ?? '—'} ετών · Γονέας: {r.guardians[0]?.first_name} {r.guardians[0]?.last_name} · {r.guardians[0]?.phone}</div></div>
          <span className="muted">{dt(r.created_at)}</span>
          {r.player_id && <Link to={`/players/${r.player_id}`} className="btn ghost sm" onClick={(e) => e.stopPropagation()}>Αθλητής</Link>}
        </button>)}</div> : <Empty title="Καμία εγγραφή" text="Στείλε τον σύνδεσμο στους γονείς (π.χ. σε Viber/email ή σε QR στη γραμματεία)." />}
      </div>
      {open && <Review r={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load() }} />}
    </>
  )
}

function Review({ r, onClose, onDone }: { r: Registration; onClose: () => void; onDone: () => void }) {
  const { toast, teams, uid } = useApp()
  const [sig, setSig] = useState<string>()
  const [team, setTeam] = useState(r.child.team || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (r.signature_path) sb.storage.from('registrations').createSignedUrl(r.signature_path, 3600).then(({ data }) => setSig(data?.signedUrl)) }, [r])
  async function openFile(path: string) { const { data } = await sb.storage.from('registrations').createSignedUrl(path, 3600); if (data) window.open(data.signedUrl, '_blank') }

  async function approve() {
    setBusy(true)
    try {
      const c = r.child
      const p = await sb.from('players').insert({ first_name: c.first_name, last_name: c.last_name, birth_date: c.birth_date || null, amka: c.amka || null, address: c.address || null,
        team_id: team || null, position: c.position || null, medical_expiry: c.medical_expiry || null, medical_notes: c.medical_notes || null,
        notes: c.previous_club ? `Προηγούμενος σύλλογος: ${c.previous_club}` : null, active: true }).select('id').single()
      if (p.error) throw p.error
      const pid = p.data.id as string
      // υπάρχει ήδη οικογένεια με αυτό το email; (αδέρφια)
      const emails = r.guardians.map((g) => g.email?.toLowerCase()).filter(Boolean)
      const { data: ex } = emails.length ? await sb.from('guardians').select('household_id, email').in('email', emails) : { data: [] }
      let hid = (ex || [])[0]?.household_id as string | undefined
      if (!hid) {
        const h = await sb.from('households').insert({ name: `Οικογένεια ${r.guardians[0].last_name || c.last_name}` }).select('id').single(); if (h.error) throw h.error
        hid = h.data.id
        await sb.from('guardians').insert(r.guardians.map((g) => ({ household_id: hid, first_name: g.first_name, last_name: g.last_name || c.last_name, relation: g.relation, phone: g.phone || null, email: g.email || null })))
      }
      await sb.from('player_households').insert({ player_id: pid, household_id: hid, share_pct: 100 })
      await sb.from('consents').insert(CONSENTS.map((k) => ({ player_id: pid, kind: k.key, granted: !!r.consents[k.key], signed_by: String(r.consents.signer || ''), signed_at: String(r.consents.signed_at || r.created_at), signature_path: r.signature_path })))
      for (const f of r.files || []) {
        const d = await sb.storage.from('registrations').download(f.path)
        if (d.data) {
          const path = `${pid}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`
          const u = await sb.storage.from('player-files').upload(path, d.data)
          if (!u.error) await sb.from('player_files').insert({ player_id: pid, name: f.name, path, size: d.data.size, mime: d.data.type, kind: 'other', doc_type: f.kind })
        }
      }
      await sb.from('registrations').update({ status: 'approved', player_id: pid, handled_by: uid, handled_at: new Date().toISOString() }).eq('id', r.id)
      toast(ex?.length ? 'Εγκρίθηκε ✓ – προστέθηκε στην υπάρχουσα οικογένεια (αδέρφια)' : 'Εγκρίθηκε ✓ – δημιουργήθηκαν αθλητής και οικογένεια'); onDone()
    } catch (e) { toast('Σφάλμα: ' + (e as Error).message) } finally { setBusy(false) }
  }
  async function reject() {
    const note = prompt('Αιτία απόρριψης (προαιρετικά):') ?? ''
    await sb.from('registrations').update({ status: 'rejected', notes: note || null, handled_by: uid, handled_at: new Date().toISOString() }).eq('id', r.id)
    toast('Η αίτηση απορρίφθηκε'); onDone()
  }
  const c = r.child
  return <Modal wide title={`Αίτηση: ${c.last_name} ${c.first_name}`} onClose={onClose}
    foot={r.status === 'new' ? <><button className="btn danger" onClick={reject}><XCircle size={16} />Απόρριψη</button><button className="btn ok" disabled={busy} onClick={approve}><CheckCircle2 size={16} />{busy ? 'Έγκριση…' : 'Έγκριση εγγραφής'}</button></> : undefined}>
    <div className="stack">
      <div className="form">
        {[['Ημ. γέννησης', dt(c.birth_date)], ['Ηλικία', age(c.birth_date) ?? '—'], ['ΑΜΚΑ', c.amka], ['Διεύθυνση', c.address], ['Θέση', c.position], ['Προηγ. σύλλογος', c.previous_club], ['Ιατρική έως', dt(c.medical_expiry)], ['Υγεία', c.medical_notes]]
          .map(([l, v]) => <div key={String(l)}><div className="muted" style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{l}</div><div>{v || '—'}</div></div>)}
        {r.status === 'new' && <label className="f">Ομάδα<select value={team} onChange={(e) => setTeam(e.target.value)}><option value="">—</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      </div>
      <div className="section-t">Γονείς</div>
      {r.guardians.map((g, i) => <div key={i}><b>{g.first_name} {g.last_name}</b> <span className="muted">· {g.relation} · {g.phone} · {g.email}</span></div>)}
      <div className="section-t">Συγκαταθέσεις</div>
      {CONSENTS.map((k) => <div key={k.key} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><span className={'badge ' + (r.consents[k.key] ? 'b-ok' : 'b-bad')}>{r.consents[k.key] ? 'Ναι' : 'Όχι'}</span><span style={{ fontSize: 13.5 }}>{k.label}</span></div>)}
      <div className="muted">Υπογραφή: <b>{String(r.consents.signer || '')}</b> · {dt(String(r.consents.signed_at || r.created_at))}</div>
      {sig && <img src={sig} alt="Υπογραφή" style={{ maxWidth: 320, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }} />}
      {!!r.files?.length && <><div className="section-t">Έγγραφα</div>{r.files.map((f) => <button key={f.path} className="btn ghost sm" onClick={() => openFile(f.path)}><FileText size={14} />{f.name}</button>)}</>}
      {r.notes && <div className="note warn">{r.notes}</div>}
    </div>
  </Modal>
}
