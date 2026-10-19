import { useEffect, useState } from 'react'
import { Plus, Globe, Phone, Mail, Pencil, Trash2, Upload } from 'lucide-react'
import { sb, eur, dt, uploadPublic, TIERS, type Sponsor } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty } from '../ui'
import { openUrl } from '../lib/native'

export default function Sponsors() {
  const [rows, setRows] = useState<Sponsor[]>([])
  const [edit, setEdit] = useState<Partial<Sponsor> | null>(null)
  const load = () => sb.from('sponsors').select('*').order('sort').order('name').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  const total = rows.reduce((a, s) => a + Number(s.amount || 0), 0)
  const t = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHead eyebrow="Συνεργάτες" title="Χορηγοί" sub={`${rows.length} χορηγοί · συνολική χορηγία ${eur(total)}. Τα λογότυπα εμφανίζονται στα PDF, στα email και στην αρχική.`}>
        <button className="btn red" onClick={() => setEdit({ tier: 'Χορηγός', show_on_documents: true, sort: rows.length })}><Plus size={18} />Νέος χορηγός</button>
      </PageHead>
      {TIERS.filter((tier) => rows.some((s) => s.tier === tier)).map((tier) => <div key={tier} style={{ marginBottom: 20 }}>
        <h2>{tier}</h2>
        <div className="grid">{rows.filter((s) => s.tier === tier).map((s) => {
          const expired = s.end_date && s.end_date < t
          return <div className="card sponsor" key={s.id}>
            <div className="logo">{s.logo_url ? <img src={s.logo_url} alt={s.name} /> : <span className="head" style={{ fontSize: 24, fontWeight: 800 }}>{s.name}</span>}</div>
            <div className="row between"><b style={{ fontSize: 16 }}>{s.name}</b>{s.amount != null && <span className="badge b-navy">{eur(s.amount)}</span>}</div>
            <div className="muted">{s.contact_name}{s.start_date || s.end_date ? ` · ${dt(s.start_date)} – ${dt(s.end_date)}` : ''}</div>
            <div className="row">{expired && <span className="badge b-bad">Έληξε</span>}{s.show_on_documents ? <span className="badge b-ok">Στα PDF/email</span> : <span className="badge">Κρυφός</span>}</div>
            <div className="row" style={{ marginTop: 'auto' }}>
              {s.website && <a className="iconbtn" href={s.website.startsWith('http') ? s.website : 'https://' + s.website} onClick={(e) => { e.preventDefault(); openUrl(e.currentTarget.href) }}><Globe size={15} /></a>}
              {s.phone && <a className="iconbtn" href={`tel:${s.phone}`}><Phone size={15} /></a>}
              {s.email && <a className="iconbtn" href={`mailto:${s.email}`}><Mail size={15} /></a>}
              <div className="grow" /><button className="btn ghost sm" onClick={() => setEdit(s)}><Pencil size={14} />Επεξεργασία</button>
            </div>
          </div>
        })}</div>
      </div>)}
      {!rows.length && <div className="card"><Empty title="Δεν υπάρχουν χορηγοί" text="Πρόσθεσε χορηγούς με το λογότυπό τους — θα εμφανίζονται αυτόματα στις αποδείξεις και τα email.">
        <button className="btn red" onClick={() => setEdit({ tier: 'Χορηγός', show_on_documents: true, sort: 0 })}><Plus size={18} />Νέος χορηγός</button></Empty></div>}
      <button className="btn red fab" onClick={() => setEdit({ tier: 'Χορηγός', show_on_documents: true, sort: rows.length })} aria-label="Νέος χορηγός"><Plus size={26} /></button>
      {edit && <SponsorForm s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function SponsorForm({ s, onClose, onSaved }: { s: Partial<Sponsor>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<Partial<Sponsor>>(s)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Sponsor) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value === '' ? null : e.target.value })
  async function logo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true)
    try { setF({ ...f, logo_url: await uploadPublic(file, 'sponsors') }) } catch (err) { toast((err as Error).message) } finally { setBusy(false) }
  }
  async function save() {
    if (!f.name) return toast('Συμπλήρωσε όνομα')
    const { id, ...rest } = f
    const r = id ? await sb.from('sponsors').update(rest).eq('id', id) : await sb.from('sponsors').insert(rest)
    if (r.error) return toast(r.error.message)
    toast('Αποθηκεύτηκε ✓'); onSaved()
  }
  async function del() { if (confirm(`Διαγραφή χορηγού «${f.name}»;`)) { await sb.from('sponsors').delete().eq('id', f.id); onSaved() } }
  const I = (k: keyof Sponsor, l: string, type = 'text') => <label className="f">{l}<input type={type} value={(f[k] as string) ?? ''} onChange={set(k)} /></label>
  return <Modal wide title={f.id ? 'Επεξεργασία χορηγού' : 'Νέος χορηγός'} onClose={onClose}
    foot={<>{f.id && <button className="btn danger" onClick={del} style={{ marginRight: 'auto' }}><Trash2 size={15} />Διαγραφή</button>}<button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" disabled={busy} onClick={save}>Αποθήκευση</button></>}>
    <div className="form">
      <div className="full row" style={{ gap: 16 }}>
        <div className="sponsor"><div className="logo" style={{ width: 200 }}>{f.logo_url ? <img src={f.logo_url} alt="" /> : <span className="muted">Χωρίς λογότυπο</span>}</div></div>
        <label className="btn ghost" style={{ cursor: 'pointer' }}><Upload size={16} />{busy ? 'Ανέβασμα…' : 'Ανέβασμα λογοτύπου'}<input type="file" accept="image/png,image/jpeg" hidden onChange={logo} /></label>
        <span className="muted">PNG ή JPG (ιδανικά με διάφανο φόντο)</span>
      </div>
      {I('name', 'Επωνυμία *')}
      <label className="f">Κατηγορία<select value={f.tier} onChange={set('tier')}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></label>
      {I('amount', 'Ποσό χορηγίας €', 'number')}{I('start_date', 'Από', 'date')}{I('end_date', 'Έως', 'date')}
      {I('contact_name', 'Υπεύθυνος επικοινωνίας')}{I('phone', 'Τηλέφωνο', 'tel')}{I('email', 'Email', 'email')}{I('website', 'Ιστοσελίδα')}{I('sort', 'Σειρά εμφάνισης', 'number')}
      <label className="f full">Σημειώσεις (π.χ. τι περιλαμβάνει η χορηγία)<textarea rows={2} value={f.notes || ''} onChange={set('notes')} /></label>
      <label className="check full"><input type="checkbox" checked={!!f.show_on_documents} onChange={set('show_on_documents')} />Εμφάνιση λογοτύπου σε αποδείξεις, καταστάσεις, email και αρχική</label>
    </div>
  </Modal>
}
