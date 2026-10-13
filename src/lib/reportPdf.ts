// Κάρτα αξιολόγησης αθλητή (PDF) – δημιουργείται στη συσκευή
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CATEGORIES, MONTHS, type MetricDef, type Player, type Settings } from './supabase'

const NAVY = '#021534', RED = '#c8102e', GREY = '#5b6475'
const up = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
let fonts: { r: string; b: string; logo: string } | null = null
async function b64(url: string) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer()); let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

export type ReportData = {
  player: Player; teamName: string; age: number | null; settings: Settings | null
  defs: MetricDef[]; periods: string[]; values: Record<string, Record<number, number>>; teamAvg: Record<string, Record<number, number>>
  attendance: { present: number; total: number }; matches: { apps: number; goals: number; assists: number }
  comments: { period: string; comment: string }[]
}

export async function evaluationPdf(d: ReportData) {
  if (!fonts) fonts = { r: await b64('./brand/fonts/LS-Regular.ttf'), b: await b64('./brand/fonts/LS-Bold.ttf'), logo: 'data:image/png;base64,' + await b64('./brand/pss-logo-small.png') }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.addFileToVFS('R.ttf', fonts.r); doc.addFont('R.ttf', 'LS', 'normal'); doc.addFileToVFS('B.ttf', fonts.b); doc.addFont('B.ttf', 'LS', 'bold'); doc.setFont('LS', 'normal')
  const club = d.settings?.club_name || 'Patras Schools Soccer'
  const pl = (p: string) => { const x = new Date(p); return `${MONTHS[x.getMonth()]} ${String(x.getFullYear()).slice(2)}` }
  const last = d.periods[d.periods.length - 1]
  // κεφαλίδα
  doc.setFillColor(NAVY); doc.rect(0, 0, 210, 38, 'F'); doc.setFillColor(RED); doc.rect(0, 38, 210, 1.6, 'F')
  doc.addImage(fonts.logo, 'PNG', 12, 4, 26, 30)
  doc.setTextColor('#fff'); doc.setFont('LS', 'bold'); doc.setFontSize(19); doc.text(up(club), 44, 17)
  doc.setFontSize(11); doc.text('ΑΞΙΟΛΟΓΗΣΗ ΑΘΛΗΤΗ', 44, 31)
  doc.setFont('LS', 'normal'); doc.setFontSize(9); doc.text(d.periods.length ? `Περίοδος: ${pl(d.periods[0])} – ${pl(last)}` : '', 198, 14, { align: 'right' })
  doc.text(`Έκδοση: ${new Date().toLocaleDateString('el-GR')}`, 198, 20, { align: 'right' })
  // στοιχεία αθλητή
  doc.setTextColor('#111'); doc.setFont('LS', 'bold'); doc.setFontSize(18)
  doc.text(`${d.player.last_name} ${d.player.first_name}`, 14, 52)
  doc.setFont('LS', 'normal'); doc.setFontSize(10); doc.setTextColor(GREY)
  doc.text([d.teamName, d.player.position, d.age != null ? `${d.age} ετών` : null, d.player.jersey_number != null ? `#${d.player.jersey_number}` : null].filter(Boolean).join('  ·  '), 14, 59)
  // KPI
  const kpis: [string, string][] = [
    ['Παρουσία', d.attendance.total ? Math.round((d.attendance.present / d.attendance.total) * 100) + '%' : '—'],
    ['Συμμετοχές', String(d.matches.apps)], ['Γκολ', String(d.matches.goals)], ['Ασίστ', String(d.matches.assists)]]
  kpis.forEach(([l, v], i) => {
    const x = 14 + i * 46
    doc.setFillColor('#eef1f6'); doc.roundedRect(x, 65, 42, 18, 2, 2, 'F')
    doc.setFontSize(7.5); doc.setTextColor(GREY); doc.text(up(l), x + 4, 71)
    doc.setFont('LS', 'bold'); doc.setFontSize(15); doc.setTextColor(NAVY); doc.text(v, x + 4, 79.5); doc.setFont('LS', 'normal')
  })
  let y = 92
  const fmt = (v: number | undefined, dec: number) => (v == null ? '—' : v.toLocaleString('el-GR', { maximumFractionDigits: dec }))
  for (const [cat, label] of Object.entries(CATEGORIES)) {
    const defs = d.defs.filter((m) => m.category === cat && d.periods.some((p) => d.values[p]?.[m.id] != null))
    if (!defs.length) continue
    if (y > 240) { doc.addPage(); y = 20 }
    doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.setTextColor(NAVY); doc.text(up(label), 14, y); y += 2
    const tone: (string | null)[] = []
    const firstWith = (m: MetricDef) => d.periods.find((p) => d.values[p]?.[m.id] != null)
    const lastWith = (m: MetricDef) => [...d.periods].reverse().find((p) => d.values[p]?.[m.id] != null)
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      head: [['Μέτρηση', 'Αρχή περιόδου', 'Τελευταία', 'Μεταβολή', 'Μ.Ο. ομάδας']],
      body: defs.map((m) => {
        const a = firstWith(m), b = lastWith(m)
        const va = a ? d.values[a][m.id] : undefined, vb = b ? d.values[b][m.id] : undefined
        const ch = va != null && vb != null && a !== b ? vb - va : null
        const good = ch != null && (m.higher_better ? ch > 0 : ch < 0)
        tone.push(ch == null || ch === 0 ? null : good ? '#138a4a' : '#a35a00')
        return [`${m.name}${m.unit ? ` (${m.unit})` : ''}`, fmt(va, m.decimals), fmt(vb, m.decimals),
          ch == null || ch === 0 ? '—' : `${ch > 0 ? '+' : ''}${fmt(ch, m.decimals)}`, fmt(b ? d.teamAvg[b]?.[m.id] : undefined, m.decimals)]
      }),
      styles: { font: 'LS', fontSize: 9, cellPadding: 2.2 },
      headStyles: { font: 'LS', fontStyle: 'bold', fillColor: NAVY, textColor: '#fff' },
      alternateRowStyles: { fillColor: '#f6f8fb' },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
      didParseCell: (h) => { if (h.section === 'body' && h.column.index === 3 && tone[h.row.index]) { h.cell.styles.textColor = tone[h.row.index]!; h.cell.styles.fontStyle = 'bold' } },
    })
    // @ts-expect-error plugin field
    y = doc.lastAutoTable.finalY + 8
  }
  // μίνι γραφήματα για τις μετρήσεις με ≥2 τιμές
  const charted = d.defs.filter((m) => d.periods.filter((p) => d.values[p]?.[m.id] != null).length >= 2).slice(0, 6)
  if (charted.length) {
    if (y > 215) { doc.addPage(); y = 20 }
    doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.setTextColor(NAVY); doc.text('ΕΞΕΛΙΞΗ', 14, y); y += 4
    charted.forEach((m, i) => {
      const cx = 14 + (i % 3) * 62, cy = y + Math.floor(i / 3) * 40, w = 58, h = 32
      if (cy + h > 280) return
      doc.setDrawColor('#d9dee8'); doc.roundedRect(cx, cy, w, h, 2, 2, 'S')
      doc.setFont('LS', 'bold'); doc.setFontSize(7.5); doc.setTextColor(GREY); doc.text(`${m.name}${m.unit ? ` (${m.unit})` : ''}`, cx + 3, cy + 5)
      const pts = d.periods.map((p, k) => ({ k, v: d.values[p]?.[m.id] })).filter((p) => p.v != null) as { k: number; v: number }[]
      const vs = pts.map((p) => p.v); let lo = Math.min(...vs), hi = Math.max(...vs); if (lo === hi) { lo -= 1; hi += 1 }
      const X = (k: number) => cx + 4 + (k / Math.max(1, d.periods.length - 1)) * (w - 8)
      const Y = (v: number) => cy + 9 + (1 - (v - lo) / (hi - lo)) * (h - 14)
      doc.setDrawColor(NAVY); doc.setLineWidth(0.6)
      for (let j = 1; j < pts.length; j++) doc.line(X(pts[j - 1].k), Y(pts[j - 1].v), X(pts[j].k), Y(pts[j].v))
      doc.setFillColor(NAVY); pts.forEach((p) => doc.circle(X(p.k), Y(p.v), 0.9, 'F'))
      doc.setFont('LS', 'normal'); doc.setFontSize(6.5); doc.text(pl(d.periods[0]), cx + 3, cy + h - 1.5); doc.text(pl(last), cx + w - 3, cy + h - 1.5, { align: 'right' })
      doc.setLineWidth(0.2)
    })
    y += Math.ceil(charted.length / 3) * 40 + 4
  }
  // σχόλια προπονητή
  const cm = d.comments.filter((c) => c.comment?.trim()).slice(-4)
  if (cm.length) {
    if (y > 245) { doc.addPage(); y = 20 }
    doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.setTextColor(NAVY); doc.text('ΣΧΟΛΙΑ ΠΡΟΠΟΝΗΤΗ', 14, y); y += 6
    doc.setFont('LS', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#111')
    for (const c of cm) {
      const lines = doc.splitTextToSize(c.comment, 160)
      doc.setFont('LS', 'bold'); doc.text(pl(c.period), 14, y); doc.setFont('LS', 'normal'); doc.text(lines, 34, y)
      y += lines.length * 4.6 + 3
    }
  }
  if (y > 262) { doc.addPage(); y = 20 }
  y = Math.max(y + 8, 262)
  doc.setDrawColor('#9aa3b5'); doc.line(130, y, 196, y); doc.setFontSize(8.5); doc.setTextColor(GREY); doc.text('Ο προπονητής', 163, y + 5, { align: 'center' })
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFillColor(NAVY); doc.rect(0, 287, 210, 10, 'F'); doc.setFontSize(7.5); doc.setTextColor('#fff'); doc.text(club, 14, 293); doc.text(`Σελίδα ${i}/${pages}`, 196, 293, { align: 'right' }) }
  doc.save(`Axiologisi_${d.player.last_name}_${d.player.first_name}.pdf`)
}
