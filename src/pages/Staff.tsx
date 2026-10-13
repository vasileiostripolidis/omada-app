import { useEffect, useState } from 'react'
import { Plus, Pencil, Upload, FileText, Clock, CheckCircle2, Zap, ShieldAlert } from 'lucide-react'
import { sb, eur, dt, daysTo, type Staff } from '../lib/supabase'
import { useApp, Modal, PageHead, Empty } from '../ui'

type Hours = { id: string; staff_id: string; work_date: string; hours: number; description: string | null; event_id: string | null; amount: number | null; paid: boolean; paid_at: string | null }
const DOCS: [keyof Staff, string][] = [['license_expiry', 'Δίπλωμα προπονητή'], ['criminal_record_expiry', 'Ποινικό μητρώο'], ['first_aid_expiry', 'Πρώτες βοήθειες'], ['medical_expiry', 'Ιατρική βεβαίωση']]

export function staffAlerts(s: Staff) {
  return DOCS.map(([k, l]) => { const d = daysTo(s[k] as string | null); return d == null ? { l, level: 'missing' as const, d } : d < 0 ? { l, level: 'expired' as const, d } : d <= 30 ? { l, level: 'soon' as const, d } : null }).filter(Boolean) as { l: string; level: 'missing' | 'expired' | 'soon'; d: number | null }[]
}

export default function StaffPage() {
  const [rows, setRows] = useState<Staff[]>([])
  const [hours, setHours] = useState<Hours[]>([])
  const [tab, setTab] = useState('people')
  const [edit, setEdit] = useState<Partial<Staff> | null>(null)
  const [open, setOpen] = useState<Staff | null>(null)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const load = async () => {
    const [a, b] = await Promise.all([sb.from('staff').select('*').order('active', { ascending: false }).order('full_name'), sb.from('staff_hours').select('*').order('work_date', { ascending: false })])
    setRows(a.data || []); setHours(b.data || [])
  }
  useEffect(() => { load() }, [])
  const inMonth = hours.filter((h) => h.work_date.startsWith(month))
  return <>
    <PageHead eyebrow="Διοίκηση" title="Προπονητές & Προσωπικό" sub="Διπλώματα, πιστοποιητικά με ειδοποίηση λήξης, ώρες και αμοιβές.">
      <button className="btn red" onClick={() => setEdit({ role_title: 'Προπονητής', active: true })}><Plus size={18} />Νέο μέλος</button></PageHead>
    <div className="tabs"><button className={'tab' + (tab === 'people' ? ' on' : '')} onClick={() => setTab('people')}>Προσωπικό</button><button className={'tab' + (tab === 'pay' ? ' on' : '')} onClick={() => setTab('pay')}>Ώρες & αμοιβές</button></div>
    {tab === 'people' && (rows.length ? <div className="grid-2">{rows.map((s) => { const al = staffAlerts(s)
      return <div key={s.id} className="card" style={{ cursor: 'pointer', opacity: s.active ? 1 : .6 }} onClick={() => setOpen(s)}>
        <div className="row"><div className="avatar" style={{ background: 'var(--navy-3)' }}>{s.full_name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
          <div className="grow"><b style={{ fontSize: 16 }}>{s.full_name}</b><div className="muted">{s.role_title}{s.license ? ` · ${s.license}` : ''}</div></div>
          {s.hourly_rate != null && <span className="badge">{eur(s.hourly_rate)}/ώρα</span>}</div>
        <div className="chips" style={{ marginTop: 10 }}>{DOCS.map(([k, l]) => { const d = daysTo(s[k] as string | null)
          return <span key={k} className={'badge ' + (d == null ? 'b-warn' : d < 0 ? 'b-bad' : d <= 30 ? 'b-warn' : 'b-ok')}>{l}{d == null ? ': λείπει' : d < 0 ? ': έληξε' : d <= 30 ? `: λήγει σε ${d} ημ.` : ' ✓'}</span> })}</div>
        {al.some((a) => a.level === 'expired') && <div className="note warn" style={{ marginTop: 10 }}><ShieldAlert size={14} /> Ληγμένα έγγραφα — ενημέρωσε πριν την επόμενη προπόνηση.</div>}
      </div> })}</div> : <div className="card"><Empty title="Δεν έχει καταχωρηθεί προσωπικό" text="Πρόσθεσε προπονητές, γυμναστές, φυσιοθεραπευτές…" /></div>)}
    {tab === 'pay' && <PayTab rows={rows} hours={inMonth} month={month} setMonth={setMonth} reload={load} />}
    {edit && <StaffForm s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    {open && <StaffCard s={open} hours={hours.filter((h) => h.staff_id === open.id)} onEdit={() => { setEdit(open); setOpen(null) }} onClose={() => { setOpen(null); load() }} />}
  </>
}

function PayTab({ rows, hours, month, setMonth, reload }: { rows: Staff[]; hours: Hours[]; month: string; setMonth: (m: string) => void; reload: () => void }) {
  const { toast } = useApp()
  const [add, setAdd] = useState(false)
  async function fromSchedule() {
    const [y, m] = month.split('-').map(Number)
    const from = new Date(y, m - 1, 1).toISOString(), to = new Date(y, m, 1).toISOString()
    const linked = rows.filter((s) => s.profile_id && s.active)
    if (!linked.length) return toast('Σύνδεσε πρώτα το προσωπικό με τον λογαριασμό του (π.χ. προπονητή) στην καρτέλα του')
    const { data: ct } = await sb.from('coach_teams').select('*').in('profile_id', linked.map((s) => s.profile_id!))
    const { data: evs } = await sb.from('events').select('*').gte('starts_at', from).lt('starts_at', to).lte('starts_at', new Date().toISOString())
    const have = new Set(hours.filter((h) => h.event_id).map((h) => h.staff_id + '|' + h.event_id))
    const ins: Partial<Hours>[] = []
    for (const s of linked) for (const e of (evs || []).filter((x) => (ct || []).some((c) => c.profile_id === s.profile_id && c.team_id === x.team_id))) {
      if (have.has(s.id + '|' + e.id)) continue
      const h = e.end_at ? Math.round(((new Date(e.end_at).getTime() - new Date(e.starts_at).getTime()) / 36e5) * 4) / 4 : 1.5
      ins.push({ staff_id: s.id, work_date: e.starts_at.slice(0, 10), hours: h, description: e.type === 'match' ? 'Αγώνας' : 'Προπόνηση', event_id: e.id, amount: s.hourly_rate != null ? Math.round(h * Number(s.hourly_rate) * 100) / 100 : null })
    }
    if (ins.length) { const r = await sb.from('staff_hours').insert(ins); if (r.error) return toast(r.error.message) }
    toast(ins.length ? `Προστέθηκαν ${ins.length} καταγραφές από το πρόγραμμα ✓` : 'Δεν βρέθηκαν νέες προπονήσεις/αγώνες'); reload()
  }
  async function payAll(sid: string) { await sb.from('staff_hours').update({ paid: true, paid_at: new Date().toISOString().slice(0, 10) }).eq('staff_id', sid).eq('paid', false).gte('work_date', month + '-01').lt('work_date', month + '-32'); toast('Σημειώθηκαν ως πληρωμένες ✓'); reload() }
  return <div className="stack">
    <div className="row"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 170 }} /><button className="btn ghost" onClick={fromSchedule}><Zap size={15} />Ώρες από το πρόγραμμα</button><button className="btn red" onClick={() => setAdd(true)}><Clock size={15} />Καταχώριση ωρών</button></div>
    <div className="card flush"><div className="scroll"><table><thead><tr><th>Μέλος</th><th className="r">Ώρες</th><th className="r">Ωριαία</th><th className="r">Μηνιαία</th><th className="r">Σύνολο</th><th className="r">Απλήρωτα</th><th></th></tr></thead><tbody>
      {rows.filter((s) => s.active).map((s) => { const hs = hours.filter((h) => h.staff_id === s.id); const amt = hs.reduce((a, h) => a + Number(h.amount || 0), 0) + Number(s.monthly_salary || 0); const unpaid = hs.filter((h) => !h.paid).reduce((a, h) => a + Number(h.amount || 0), 0)
        return <tr key={s.id}><td><b>{s.full_name}</b><div className="muted">{s.role_title}</div></td><td className="r num">{hs.reduce((a, h) => a + Number(h.hours), 0)}</td><td className="r num">{s.hourly_rate != null ? eur(s.hourly_rate) : '—'}</td><td className="r num">{s.monthly_salary ? eur(s.monthly_salary) : '—'}</td>
          <td className="r num"><b>{eur(amt)}</b></td><td className="r num">{unpaid > 0 ? <span className="badge b-warn">{eur(unpaid)}</span> : <span className="badge b-ok">—</span>}</td>
          <td className="r">{unpaid > 0 && <button className="btn ok sm" onClick={() => payAll(s.id)}><CheckCircle2 size={14} />Πληρώθηκε</button>}</td></tr> })}
    </tbody></table></div></div>
    <div className="card flush"><div className="card-head"><h2>Καταγραφές μήνα</h2></div>{hours.length ? <div className="scroll"><table><thead><tr><th>Ημ/νία</th><th>Μέλος</th><th>Περιγραφή</th><th className="r">Ώρες</th><th className="r">Ποσό</th><th></th></tr></thead><tbody>
      {hours.map((h) => <tr key={h.id}><td>{dt(h.work_date)}</td><td>{rows.find((s) => s.id === h.staff_id)?.full_name}</td><td>{h.description}</td><td className="r num">{h.hours}</td><td className="r num">{h.amount != null ? eur(h.amount) : '—'}</td>
        <td className="r">{h.paid ? <span className="badge b-ok">Πληρώθηκε</span> : <button className="iconbtn" title="Διαγραφή" onClick={async () => { await sb.from('staff_hours').delete().eq('id', h.id); reload() }}>×</button>}</td></tr>)}
    </tbody></table></div> : <Empty title="Καμία καταγραφή" />}</div>
    {add && <AddHours staff={rows.filter((s) => s.active)} onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload() }} />}
  </div>
}

function AddHours({ staff, onClose, onDone }: { staff: Staff[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState({ staff_id: staff[0]?.id || '', work_date: new Date().toISOString().slice(0, 10), hours: '1.5', description: 'Προπόνηση' })
  async function save() {
    const s = staff.find((x) => x.id === f.staff_id); const h = Number(f.hours)
    const r = await sb.from('staff_hours').insert({ ...f, hours: h, amount: s?.hourly_rate != null ? Math.round(h * Number(s.hourly_rate) * 100) / 100 : null })
    if (r.error) return toast(r.error.message); onDone()
  }
  return <Modal title="Καταχώριση ωρών" onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    <div className="form">
      <label className="f">Μέλος<select value={f.staff_id} onChange={(e) => setF({ ...f, staff_id: e.target.value })}>{staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>
      <label className="f">Ημερομηνία<input type="date" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} /></label>
      <label className="f">Ώρες<input type="number" step="0.25" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
      <label className="f">Περιγραφή<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
    </div></Modal>
}

function StaffForm({ s, onClose, onSaved }: { s: Partial<Staff>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp()
  const [f, setF] = useState<Partial<Staff>>(s)
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string }[]>([])
  useEffect(() => { sb.from('profiles').select('id, full_name, email').in('role', ['admin', 'secretary', 'coach']).then(({ data }) => setUsers(data || [])) }, [])
  const set = (k: keyof Staff) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? (e.target.value === '' ? null : +e.target.value) : e.target.value || null })
  async function save() {
    if (!f.full_name) return toast('Συμπλήρωσε ονοματεπώνυμο')
    const { id, ...rest } = f
    const r = id ? await sb.from('staff').update(rest).eq('id', id) : await sb.from('staff').insert(rest)
    if (r.error) return toast(r.error.message); toast('Αποθηκεύτηκε ✓'); onSaved()
  }
  const I = (k: keyof Staff, l: string, type = 'text') => <label className="f">{l}<input type={type} value={(f[k] as string) ?? ''} onChange={set(k)} /></label>
  return <Modal wide title={f.id ? 'Επεξεργασία μέλους' : 'Νέο μέλος προσωπικού'} onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Άκυρο</button><button className="btn red" onClick={save}>Αποθήκευση</button></>}>
    <div className="form">
      {I('full_name', 'Ονοματεπώνυμο *')}
      <label className="f">Ρόλος<input list="roles" value={f.role_title || ''} onChange={set('role_title')} /><datalist id="roles">{['Τεχνικός διευθυντής', 'Προπονητής', 'Βοηθός προπονητή', 'Προπονητής τερματοφυλάκων', 'Γυμναστής', 'Φυσιοθεραπευτής', 'Γραμματεία'].map((x) => <option key={x} value={x} />)}</datalist></label>
      {I('phone', 'Κινητό', 'tel')}{I('email', 'Email', 'email')}
      <label className="f">Λογαριασμός εφαρμογής<select value={f.profile_id || ''} onChange={set('profile_id')}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}</select></label>
      <div className="section-t">Διπλώματα & πιστοποιητικά</div>
      <label className="f">Δίπλωμα<select value={f.license || ''} onChange={set('license')}><option value="">—</option>{['UEFA Pro', 'UEFA A', 'UEFA B', 'UEFA C', 'Grassroots C', 'ΓΓΑ / ΤΕΦΑΑ', 'Άλλο'].map((x) => <option key={x}>{x}</option>)}</select></label>
      {I('license_expiry', 'Λήξη διπλώματος', 'date')}{I('criminal_record_expiry', 'Ποινικό μητρώο – ισχύς έως', 'date')}{I('first_aid_expiry', 'Πρώτες βοήθειες – έως', 'date')}{I('medical_expiry', 'Ιατρική βεβαίωση – έως', 'date')}
      <div className="section-t">Αμοιβή</div>
      {I('hourly_rate', 'Ωριαία αποζημίωση €', 'number')}{I('monthly_salary', 'Σταθερή μηνιαία €', 'number')}
      <label className="f full">Σημειώσεις<textarea rows={2} value={f.notes || ''} onChange={set('notes')} /></label>
      <label className="check full"><input type="checkbox" checked={f.active !== false} onChange={set('active')} />Ενεργό μέλος</label>
    </div></Modal>
}

function StaffCard({ s, hours, onEdit, onClose }: { s: Staff; hours: Hours[]; onEdit: () => void; onClose: () => void }) {
  const { toast } = useApp()
  const [docs, setDocs] = useState<{ id: string; name: string; path: string; kind: string; uploaded_at: string }[]>([])
  const load = () => sb.from('staff_documents').select('*').eq('staff_id', s.id).order('uploaded_at', { ascending: false }).then(({ data }) => setDocs(data || []))
  useEffect(() => { load() }, [s.id])
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    for (const file of Array.from(e.target.files || [])) {
      const path = `${s.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const u = await sb.storage.from('staff-files').upload(path, file); if (u.error) { toast(u.error.message); continue }
      await sb.from('staff_documents').insert({ staff_id: s.id, name: file.name, path })
    }
    toast('Ανέβηκαν ✓'); load()
  }
  async function openDoc(p: string) { const { data } = await sb.storage.from('staff-files').createSignedUrl(p, 3600); if (data) window.open(data.signedUrl, '_blank') }
  return <Modal wide title={s.full_name} onClose={onClose} foot={<button className="btn" onClick={onEdit}><Pencil size={14} />Επεξεργασία</button>}>
    <div className="stack">
      <div className="muted">{[s.role_title, s.license, s.phone, s.email].filter(Boolean).join(' · ')}</div>
      <div className="grid">{DOCS.map(([k, l]) => { const d = daysTo(s[k] as string | null)
        return <div key={k} className="card" style={{ padding: 12 }}><div className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{l}</div><div className="row between" style={{ marginTop: 4 }}><b>{s[k] ? dt(s[k] as string) : '—'}</b>
          <span className={'badge ' + (d == null ? 'b-warn' : d < 0 ? 'b-bad' : d <= 30 ? 'b-warn' : 'b-ok')}>{d == null ? 'Λείπει' : d < 0 ? 'Έληξε' : d <= 30 ? `${d} ημ.` : 'OK'}</span></div></div> })}</div>
      <div className="card flush"><div className="card-head"><h2>Έγγραφα</h2><label className="btn red sm" style={{ cursor: 'pointer' }}><Upload size={14} />Ανέβασμα<input type="file" multiple hidden onChange={upload} /></label></div>
        {docs.length ? <div className="list">{docs.map((d) => <button key={d.id} className="item click" style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', width: '100%', textAlign: 'left' }} onClick={() => openDoc(d.path)}><FileText size={18} /><span className="grow">{d.name}</span><span className="muted">{dt(d.uploaded_at)}</span></button>)}</div> : <div className="empty" style={{ padding: 18 }}>Δίπλωμα, ποινικό μητρώο, πιστοποιητικά…</div>}</div>
      <div className="muted">Συνολικές ώρες: <b>{hours.reduce((a, h) => a + Number(h.hours), 0)}</b> · Απλήρωτα: <b>{eur(hours.filter((h) => !h.paid).reduce((a, h) => a + Number(h.amount || 0), 0))}</b></div>
    </div>
  </Modal>
}
