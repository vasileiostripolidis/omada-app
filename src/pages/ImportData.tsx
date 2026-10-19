import { useRef, useState } from 'react'
import { Download, Upload, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { sb, type Team } from '../lib/supabase'
import { useApp, PageHead } from '../ui'
import { saveFile } from '../lib/native'

// Στήλες προτύπου (μία γραμμή ανά παιδί· τα αδέρφια ενώνονται αυτόματα σε μία οικογένεια με βάση το κινητό/email του 1ου γονέα)
const COLS = [
  ['last_name', 'Επώνυμο αθλητή *', 22], ['first_name', 'Όνομα αθλητή *', 18], ['birth_date', 'Ημ. γέννησης *', 15], ['team', 'Ομάδα', 24], ['position', 'Θέση', 15], ['jersey', 'Αρ. φανέλας', 11],
  ['amka', 'ΑΜΚΑ', 14], ['address', 'Διεύθυνση', 26], ['medical_expiry', 'Ιατρική βεβαίωση έως', 15], ['card_number', 'Αρ. δελτίου', 13], ['card_expiry', 'Δελτίο έως', 13],
  ['p_phone', 'Κινητό αθλητή (αν ενήλικας)', 16], ['p_email', 'Email αθλητή (αν ενήλικας)', 22],
  ['g1_last', 'Γονέας 1 – Επώνυμο', 20], ['g1_first', 'Γονέας 1 – Όνομα', 17], ['g1_rel', 'Γονέας 1 – Σχέση', 14], ['g1_phone', 'Γονέας 1 – Κινητό', 15], ['g1_email', 'Γονέας 1 – Email', 26],
  ['g2_last', 'Γονέας 2 – Επώνυμο', 20], ['g2_first', 'Γονέας 2 – Όνομα', 17], ['g2_rel', 'Γονέας 2 – Σχέση', 14], ['g2_phone', 'Γονέας 2 – Κινητό', 15], ['g2_email', 'Γονέας 2 – Email', 26],
  ['joined_at', 'Ημ. εγγραφής', 13], ['notes', 'Σημειώσεις', 30],
] as const
type Key = typeof COLS[number][0]
type Raw = Partial<Record<Key, string>>
type Row = { n: number; raw: Raw; errors: string[]; warns: string[]; team_id: string | null; birth: string | null; med: string | null; card: string | null; joined: string | null; family: string; dup: boolean }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const phoneKey = (s?: string) => (s || '').replace(/\D/g, '').replace(/^0030|^30(?=\d{10}$)/, '')
function toDate(v: unknown): string | null | 'bad' {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(+v)) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), 12)).toISOString().slice(0, 10)
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) { let y = +m[3]; if (y < 100) y += y > 40 ? 1900 : 2000; const d = new Date(Date.UTC(y, +m[2] - 1, +m[1], 12)); return d.getUTCDate() === +m[1] ? d.toISOString().slice(0, 10) : 'bad' }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return 'bad'
}
const cellText = (v: unknown): string => {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') { const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string }; if (o.richText) return o.richText.map((x) => x.text).join(''); if (o.text) return String(o.text); if (o.result != null) return String(o.result); return '' }
  return String(v).trim()
}

export default function ImportData() {
  const { teams, toast, reloadTeams } = useApp()
  const [rows, setRows] = useState<Row[]>([])
  const exFamRef = useRef(new Map<string, string>())
  const [file, setFile] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<{ families: number; players: number; guardians: number; skipped: number; failed: string[] } | null>(null)

  async function template() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Αθλητές')
    ws.columns = COLS.map(([key, header, width]) => ({ key, header, width }))
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021534' } }; ws.getRow(1).height = 30
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.addRow({ last_name: 'Παπαδόπουλος', first_name: 'Γιώργος', birth_date: '14/03/2015', team: teams[0]?.name || '', position: 'Μέσος', g1_last: 'Παπαδόπουλος', g1_first: 'Νίκος', g1_rel: 'Πατέρας', g1_phone: '6971234567', g1_email: 'nikos@example.com', g2_last: 'Παπαδοπούλου', g2_first: 'Μαρία', g2_rel: 'Μητέρα', g2_phone: '6987654321' })
    ws.addRow({ last_name: 'Παπαδόπουλος', first_name: 'Κώστας', birth_date: '02/09/2017', team: teams[1]?.name || teams[0]?.name || '', g1_last: 'Παπαδόπουλος', g1_first: 'Νίκος', g1_rel: 'Πατέρας', g1_phone: '6971234567', notes: '← αδερφός: ίδιο κινητό γονέα = ίδια οικογένεια' })
    for (let r = 2; r <= 3; r++) ws.getRow(r).font = { italic: true, color: { argb: 'FF8A94A6' } }
    const info = wb.addWorksheet('Οδηγίες'); info.getColumn(1).width = 110
    ;['ΟΔΗΓΙΕΣ ΣΥΜΠΛΗΡΩΣΗΣ', '', '• Μία γραμμή για κάθε παιδί. Σβήσε τις 2 γραμμές-παραδείγματα (γκρι) πριν την εισαγωγή.', '• Υποχρεωτικά: Επώνυμο, Όνομα, Ημ. γέννησης (μορφή ΗΗ/ΜΜ/ΕΕΕΕ).',
      '• Αδέρφια: γράψε τον ίδιο Γονέα 1 με το ίδιο κινητό ή email — θα μπουν αυτόματα στην ίδια οικογένεια (σωστή χρέωση για 2ο/3ο παιδί).',
      `• Ομάδα: γράψε ακριβώς το όνομα της ομάδας όπως στην εφαρμογή: ${teams.map((t) => t.name).join(', ') || '(δεν υπάρχουν ακόμα ομάδες)'}.`,
      '• Σχέση: Πατέρας, Μητέρα, Κηδεμόνας, Παππούς/Γιαγιά. Για ενήλικα αθλητή χωρίς γονέα, άφησε τα στοιχεία γονέα κενά και συμπλήρωσε κινητό/email αθλητή.',
      '• Αν ένας αθλητής υπάρχει ήδη (ίδιο ονοματεπώνυμο και ημ. γέννησης) δεν θα ξαναπεραστεί.', '• Αν το κινητό/email γονέα υπάρχει ήδη σε οικογένεια της εφαρμογής, το παιδί μπαίνει σε εκείνη την οικογένεια.',
    ].forEach((t, i) => { const r = info.addRow([t]); if (i === 0) r.font = { bold: true, size: 14 } })
    const buf = await wb.xlsx.writeBuffer()
    await saveFile(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'PSS_Protypo_Eisagogis.xlsx')
  }

  async function read(f: File) {
    setDone(null); setFile(f.name)
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    try {
      if (/\.csv$/i.test(f.name)) { const text = await f.text(); const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()); const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','; const ws = wb.addWorksheet('csv'); lines.forEach((l) => ws.addRow(l.split(sep).map((x) => x.replace(/^"|"$/g, '')))) }
      else await wb.xlsx.load(await f.arrayBuffer())
    } catch { return toast('Δεν διαβάστηκε το αρχείο. Χρησιμοποίησε .xlsx (Excel) ή .csv') }
    const ws = wb.worksheets[0]
    const head = (ws.getRow(1).values as unknown[]).map((v) => norm(cellText(v)).replace(/\s*\*$/, ''))
    const idx: Partial<Record<Key, number>> = {}
    COLS.forEach(([k, h]) => { const i = head.indexOf(norm(h).replace(/\s*\*$/, '')); if (i > 0) idx[k] = i })
    if (!idx.last_name || !idx.first_name) return toast('Δεν βρέθηκαν οι στήλες «Επώνυμο αθλητή» / «Όνομα αθλητή». Κατέβασε το πρότυπο.')
    // υπάρχοντα δεδομένα για διπλοεγγραφές
    const [ps, gs] = await Promise.all([sb.from('players').select('first_name,last_name,birth_date'), sb.from('guardians').select('household_id, phone, email')])
    const existingP = new Set((ps.data || []).map((p) => `${norm(p.first_name)}|${norm(p.last_name)}|${p.birth_date}`))
    const out: Row[] = []
    ws.eachRow((r, n) => {
      if (n === 1) return
      const raw: Raw = {}
      ;(Object.keys(idx) as Key[]).forEach((k) => { const v = r.getCell(idx[k]!).value; raw[k] = v instanceof Date && /date|expiry|joined/.test(k) ? (v as unknown as string) : cellText(v) })
      if (!Object.values(raw).some((v) => v && String(v).trim())) return
      const errors: string[] = [], warns: string[] = []
      if (!raw.last_name) errors.push('Λείπει επώνυμο'); if (!raw.first_name) errors.push('Λείπει όνομα')
      const birth = toDate(raw.birth_date), med = toDate(raw.medical_expiry), card = toDate(raw.card_expiry), joined = toDate(raw.joined_at)
      if (!birth) errors.push('Λείπει ημ. γέννησης'); if (birth === 'bad') errors.push('Λάθος ημ. γέννησης')
      if (med === 'bad') warns.push('Λάθος ημ. ιατρικής – αγνοείται'); if (card === 'bad') warns.push('Λάθος ημ. δελτίου – αγνοείται')
      let team_id: string | null = null
      if (raw.team) { const t = teams.find((x: Team) => norm(x.name) === norm(raw.team!) || (x.short_name && norm(x.short_name) === norm(raw.team!))); if (t) team_id = t.id; else warns.push(`Άγνωστη ομάδα «${raw.team}» – μένει χωρίς ομάδα`) }
      const fk = phoneKey(raw.g1_phone) || norm(raw.g1_email || '') || phoneKey(raw.p_phone) || norm(raw.p_email || '')
      if (!raw.g1_first && !raw.p_phone && !raw.p_email) warns.push('Χωρίς στοιχεία γονέα')
      const dup = birth && birth !== 'bad' ? existingP.has(`${norm(raw.first_name || '')}|${norm(raw.last_name || '')}|${birth}`) : false
      if (dup) warns.push('Υπάρχει ήδη – θα παραλειφθεί')
      out.push({ n, raw, errors, warns, team_id, birth: birth === 'bad' ? null : birth, med: med === 'bad' ? null : med, card: card === 'bad' ? null : card, joined: joined === 'bad' ? null : joined, family: fk || `row${n}`, dup })
    })
    // υπάρχουσες οικογένειες (κινητό/email γονέα)
    const exFam = new Map<string, string>()
    for (const g of gs.data || []) { if (g.phone) exFam.set(phoneKey(g.phone), g.household_id); if (g.email) exFam.set(norm(g.email), g.household_id) }
    exFamRef.current = exFam
    setRows(out)
  }

  async function run() {
    const ok = rows.filter((r) => !r.errors.length && !r.dup)
    if (!ok.length) return
    if (!confirm(`Εισαγωγή ${ok.length} αθλητών; Θα δημιουργηθούν οι οικογένειες και οι γονείς τους.`)) return
    setBusy(true); setProgress(0)
    const exFam = exFamRef.current
    const famId = new Map<string, string>(); const res = { families: 0, players: 0, guardians: 0, skipped: rows.length - ok.length, failed: [] as string[] }
    let i = 0
    for (const r of ok) {
      const x = r.raw
      try {
        const p = await sb.from('players').insert({
          first_name: x.first_name!.trim(), last_name: x.last_name!.trim(), birth_date: r.birth, team_id: r.team_id, position: x.position || null, jersey_number: x.jersey && !isNaN(+x.jersey) ? +x.jersey : null,
          amka: x.amka || null, address: x.address || null, medical_expiry: r.med, card_number: x.card_number || null, card_expiry: r.card, phone: x.p_phone || null, email: x.p_email || null,
          joined_at: r.joined || new Date().toISOString().slice(0, 10), notes: x.notes || null, active: true,
        }).select('id').single()
        if (p.error) throw p.error
        res.players++
        let hid = famId.get(r.family) || exFam.get(r.family)
        const hasGuardian = !!(x.g1_first || x.g1_last)
        if (!hid && (hasGuardian || x.p_phone || x.p_email)) {
          const h = await sb.from('households').insert({ name: `Οικογένεια ${(x.g1_last || x.last_name)!.trim()}` }).select('id').single(); if (h.error) throw h.error
          hid = h.data.id; res.families++
          const gl = [] as Record<string, unknown>[]
          if (hasGuardian) gl.push({ household_id: hid, first_name: x.g1_first || '—', last_name: x.g1_last || x.last_name, relation: x.g1_rel || 'Πατέρας', phone: x.g1_phone || null, email: x.g1_email || null })
          else gl.push({ household_id: hid, first_name: x.first_name, last_name: x.last_name, relation: 'Ο ίδιος (ενήλικας)', phone: x.p_phone || null, email: x.p_email || null })
          if (x.g2_first || x.g2_last) gl.push({ household_id: hid, first_name: x.g2_first || '—', last_name: x.g2_last || x.last_name, relation: x.g2_rel || 'Μητέρα', phone: x.g2_phone || null, email: x.g2_email || null })
          const g = await sb.from('guardians').insert(gl); if (g.error) throw g.error
          res.guardians += gl.length
        }
        if (hid) { famId.set(r.family, hid); const l = await sb.from('player_households').insert({ player_id: p.data.id, household_id: hid, share_pct: 100 }); if (l.error) throw l.error }
      } catch (e) { res.failed.push(`Γραμμή ${r.n} (${x.last_name} ${x.first_name}): ${(e as Error).message}`) }
      setProgress(Math.round((++i / ok.length) * 100))
    }
    setBusy(false); setDone(res); setRows([]); reloadTeams(); toast(`Εισήχθησαν ${res.players} αθλητές ✓`)
  }

  const errs = rows.filter((r) => r.errors.length).length, dups = rows.filter((r) => r.dup).length
  const families = new Set(rows.filter((r) => !r.errors.length && !r.dup).map((r) => r.family)).size
  return <>
    <PageHead eyebrow="Διαχείριση" title="Εισαγωγή από Excel" sub="Πέρασε όλους τους αθλητές και τους γονείς τους με ένα αρχείο. Τα αδέρφια ενώνονται αυτόματα σε οικογένεια." />
    <div className="grid-2" style={{ marginBottom: 16 }}>
      <div className="card"><div className="eyebrow">Βήμα 1</div><h2>Κατέβασε το πρότυπο</h2><p className="muted">Excel με τις σωστές στήλες, παράδειγμα και οδηγίες. Μπορείς να επικολλήσεις τα στοιχεία από το δικό σου αρχείο.</p>
        <button className="btn" onClick={template}><Download size={16} />Πρότυπο Excel</button></div>
      <div className="card"><div className="eyebrow">Βήμα 2</div><h2>Ανέβασε το αρχείο</h2><p className="muted">Βλέπεις πρώτα προεπισκόπηση με ελέγχους· τίποτα δεν αποθηκεύεται πριν πατήσεις «Εισαγωγή».</p>
        <label className="btn red" style={{ cursor: 'pointer' }}><Upload size={16} />{file || 'Επιλογή .xlsx / .csv'}<input type="file" hidden accept=".xlsx,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = '' }} /></label></div>
    </div>
    {done && <div className="card" style={{ marginBottom: 16 }}><div className="row"><CheckCircle2 size={26} color="var(--ok)" /><div className="grow"><b>Ολοκληρώθηκε</b><div className="muted">{done.players} αθλητές · {done.families} νέες οικογένειες · {done.guardians} γονείς · {done.skipped} παραλείφθηκαν</div></div></div>
      {done.failed.length > 0 && <div className="note warn" style={{ marginTop: 10 }}>{done.failed.map((f) => <div key={f}>{f}</div>)}</div>}
      <div className="muted" style={{ marginTop: 10 }}>Επόμενο βήμα: στείλε στους γονείς πρόσβαση από <b>Γονείς & Οικογένειες → Προσκλήσεις γονέων</b>.</div></div>}
    {rows.length > 0 && <div className="card flush">
      <div className="card-head" style={{ flexWrap: 'wrap' }}><div><h2>Προεπισκόπηση · {rows.length} γραμμές</h2><div className="muted">{rows.length - errs - dups} προς εισαγωγή σε {families} οικογένειες · {dups} υπάρχουν ήδη · {errs} με λάθη</div></div>
        <div className="row">{busy && <div className="progress" style={{ width: 140 }}><div style={{ width: progress + '%' }} /></div>}<button className="btn ghost" onClick={() => setRows([])}>Ακύρωση</button><button className="btn red" disabled={busy || rows.length === errs + dups} onClick={run}>{busy ? `${progress}%` : 'Εισαγωγή'}</button></div></div>
      <div className="scroll"><table><thead><tr><th>#</th><th></th><th>Αθλητής</th><th>Γέννηση</th><th>Ομάδα</th><th>Γονέας</th><th>Παρατηρήσεις</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.n} style={r.errors.length ? { background: 'var(--bad-bg)' } : undefined}><td className="muted">{r.n}</td>
          <td>{r.errors.length ? <XCircle size={16} color="var(--red)" /> : r.warns.length ? <AlertTriangle size={16} color="var(--warn)" /> : <CheckCircle2 size={16} color="var(--ok)" />}</td>
          <td><b>{r.raw.last_name} {r.raw.first_name}</b></td><td>{r.birth ? r.birth.split('-').reverse().join('/') : '—'}</td><td>{teams.find((t) => t.id === r.team_id)?.name || '—'}</td>
          <td className="muted">{[r.raw.g1_first, r.raw.g1_last].filter(Boolean).join(' ') || '—'}{r.raw.g1_phone ? ` · ${r.raw.g1_phone}` : ''}</td>
          <td style={{ fontSize: 12.5 }}>{[...r.errors, ...r.warns].join(' · ')}</td></tr>)}
      </tbody></table></div></div>}
  </>
}
