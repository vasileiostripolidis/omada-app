// Δημιουργία PDF (κατάσταση λογαριασμού & απόδειξη) με την ταυτότητα του συλλόγου
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export type Assets = { regular: string; bold: string; logo?: string; sponsors: { name: string; img?: string; fmt?: string }[] }
export type Club = { club_name: string; address?: string | null; phone?: string | null; email?: string | null; website?: string | null; iban?: string | null; afm?: string | null; email_footer?: string | null; primary_color?: string | null; accent_color?: string | null }
export type ChargeRow = { description: string; period: string | null; due_date: string | null; amount: number; paid_amount: number; status: string }
export type PaymentRow = { paid_at: string; amount: number; method: string; receipt_no: number; payer?: string | null }

const NAVY = '#021534', RED = '#c8102e', GREY = '#5b6475', LIGHT = '#eef1f6'
export const up = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const money = (n: number) => (Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const d = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('el-GR', { timeZone: 'Europe/Athens' }) : '—')
const METHOD: Record<string, string> = { cash: 'Μετρητά', bank: 'Τραπεζική κατάθεση', card: 'Κάρτα', other: 'Άλλο' }

function setup(a: Assets) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.addFileToVFS('LS-R.ttf', a.regular); doc.addFont('LS-R.ttf', 'LS', 'normal')
  doc.addFileToVFS('LS-B.ttf', a.bold); doc.addFont('LS-B.ttf', 'LS', 'bold')
  doc.setFont('LS', 'normal')
  return doc
}

function header(doc: jsPDF, a: Assets, c: Club, title: string, right: string[]) {
  const navy = c.primary_color || NAVY, red = c.accent_color || RED
  doc.setFillColor(navy); doc.rect(0, 0, 210, 38, 'F')
  doc.setFillColor(red); doc.rect(0, 38, 210, 1.6, 'F')
  if (a.logo) doc.addImage(a.logo, 'PNG', 12, 4, 26, 30)
  doc.setTextColor('#ffffff'); doc.setFont('LS', 'bold'); doc.setFontSize(19)
  doc.text(up(c.club_name), 44, 17)
  doc.setFont('LS', 'normal'); doc.setFontSize(8.5)
  doc.text([c.address, c.phone, c.email, c.website].filter(Boolean).join('  ·  '), 44, 24)
  doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.setTextColor('#ffffff')
  doc.text(up(title), 44, 32)
  doc.setFont('LS', 'normal'); doc.setFontSize(9)
  doc.text(right, 198, 14, { align: 'right', lineHeightFactor: 1.5 })
  doc.setTextColor('#111111')
}

function footer(doc: jsPDF, a: Assets, c: Club) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    let y = 268
    const sp = a.sponsors.filter((s) => s.img)
    if (sp.length) {
      doc.setDrawColor('#d9dee8'); doc.line(14, y - 6, 196, y - 6)
      doc.setFontSize(7.5); doc.setTextColor(GREY); doc.text('ΜΕ ΤΗΝ ΥΠΟΣΤΗΡΙΞΗ ΤΩΝ ΧΟΡΗΓΩΝ ΜΑΣ', 105, y - 2, { align: 'center' })
      const w = 22, gap = 6, n = Math.min(sp.length, 7)
      let x = 105 - (n * w + (n - 1) * gap) / 2
      for (const s of sp.slice(0, 7)) {
        try { doc.addImage(s.img!, s.fmt || 'PNG', x, y + 1, w, 11, undefined, 'FAST') } catch { /* εικόνα που δεν διαβάζεται */ }
        x += w + gap
      }
      y += 16
    }
    doc.setFillColor(c.primary_color || NAVY); doc.rect(0, 287, 210, 10, 'F')
    doc.setFontSize(7.5); doc.setTextColor('#ffffff')
    doc.text(`${c.club_name}${c.afm ? ' · ΑΦΜ ' + c.afm : ''}`, 14, 293)
    doc.text(`Σελίδα ${i}/${pages}`, 196, 293, { align: 'right' })
  }
}

function infoBox(doc: jsPDF, y: number, label: string, lines: string[], x = 14, w = 88) {
  doc.setFillColor(LIGHT); doc.roundedRect(x, y, w, 8 + lines.length * 5.2, 2, 2, 'F')
  doc.setFont('LS', 'bold'); doc.setFontSize(7.5); doc.setTextColor(GREY); doc.text(up(label), x + 4, y + 5.5)
  doc.setFont('LS', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#111111')
  lines.forEach((l, i) => doc.text(l, x + 4, y + 11 + i * 5.2))
  return y + 8 + lines.length * 5.2
}

export function statementPdf(a: Assets, c: Club, o: {
  household: string; guardians: string[]; children: string[]; charges: ChargeRow[]; payments: PaymentRow[]; balance: number; reminder?: boolean
}) {
  const doc = setup(a)
  const today = new Date().toLocaleDateString('el-GR', { timeZone: 'Europe/Athens' })
  header(doc, a, c, o.reminder ? 'Υπενθύμιση οφειλής' : 'Κατάσταση λογαριασμού', [`Ημερομηνία: ${today}`])
  let y = 48
  const y1 = infoBox(doc, y, 'Προς', [o.household, ...o.guardians.slice(0, 3)])
  const y2 = infoBox(doc, y, 'Αθλητές', o.children.length ? o.children.slice(0, 4) : ['—'], 108, 88)
  y = Math.max(y1, y2) + 8

  const open = o.charges.filter((x) => x.status === 'pending' || x.status === 'partial')
  doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.setTextColor(c.primary_color || NAVY)
  doc.text('Ανεξόφλητες χρεώσεις', 14, y); y += 3
  autoTable(doc, {
    startY: y,
    head: [['Περιγραφή', 'Λήξη', 'Ποσό', 'Πληρώθηκε', 'Υπόλοιπο']],
    body: open.length ? open.map((x) => [x.description, d(x.due_date), money(x.amount), money(x.paid_amount), money(x.amount - x.paid_amount)]) : [['Δεν υπάρχουν ανεξόφλητες χρεώσεις', '', '', '', '']],
    styles: { font: 'LS', fontSize: 9, cellPadding: 2.4, textColor: '#111111' },
    headStyles: { font: 'LS', fontStyle: 'bold', fillColor: c.primary_color || NAVY, textColor: '#ffffff' },
    alternateRowStyles: { fillColor: '#f6f8fb' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })
  // @ts-ignore plugin field
  y = doc.lastAutoTable.finalY + 8

  if (o.payments.length) {
    doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.setTextColor(c.primary_color || NAVY)
    doc.text('Τελευταίες πληρωμές', 14, y); y += 3
    autoTable(doc, {
      startY: y,
      head: [['Ημερομηνία', 'Απόδειξη', 'Πλήρωσε', 'Τρόπος', 'Ποσό']],
      body: o.payments.slice(0, 6).map((p) => [d(p.paid_at), `#${p.receipt_no}`, p.payer || '—', METHOD[p.method] || p.method, money(p.amount)]),
      styles: { font: 'LS', fontSize: 8.5, cellPadding: 2 },
      headStyles: { font: 'LS', fontStyle: 'bold', fillColor: '#e3e8f0', textColor: '#021534' },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    })
    // @ts-ignore plugin field
    y = doc.lastAutoTable.finalY + 8
  }

  const owe = o.balance > 0.004
  doc.setFillColor(owe ? (c.accent_color || RED) : '#1f8a4c'); doc.roundedRect(118, y, 78, 20, 2, 2, 'F')
  doc.setTextColor('#ffffff'); doc.setFont('LS', 'normal'); doc.setFontSize(8.5)
  doc.text(owe ? 'ΣΥΝΟΛΙΚΟ ΥΠΟΛΟΙΠΟ' : 'ΚΑΤΑΣΤΑΣΗ', 122, y + 7)
  doc.setFont('LS', 'bold'); doc.setFontSize(16)
  doc.text(owe ? money(o.balance) : 'Εξοφλημένος', 192, y + 15.5, { align: 'right' })
  doc.setTextColor('#111111')

  doc.setFont('LS', 'normal'); doc.setFontSize(9)
  const lines: string[] = []
  if (owe) {
    if (c.iban) lines.push(`Κατάθεση στο IBAN: ${c.iban}`, `Αιτιολογία: ${o.children[0] || o.household}`)
    lines.push('Πληρωμή και με μετρητά στη γραμματεία του συλλόγου.')
  }
  if (c.email_footer) lines.push('', c.email_footer)
  doc.text(lines, 14, y + 5, { maxWidth: 98, lineHeightFactor: 1.45 })
  footer(doc, a, c)
  return doc
}

export function receiptPdf(a: Assets, c: Club, o: {
  receipt_no: number; paid_at: string; amount: number; method: string; payer: string; household: string; children: string[]; note?: string | null; covered: string[]; balance: number
}) {
  const doc = setup(a)
  header(doc, a, c, 'Απόδειξη είσπραξης', [`Αρ. απόδειξης: ${o.receipt_no}`, `Ημερομηνία: ${d(o.paid_at)}`])
  let y = 50
  infoBox(doc, y, 'Λάβαμε από', [o.payer, o.household])
  infoBox(doc, y, 'Αθλητές', o.children.length ? o.children.slice(0, 3) : ['—'], 108, 88)
  y += 32
  doc.setFillColor(c.primary_color || NAVY); doc.roundedRect(14, y, 182, 26, 3, 3, 'F')
  doc.setTextColor('#ffffff'); doc.setFont('LS', 'normal'); doc.setFontSize(9)
  doc.text('ΠΟΣΟ ΠΛΗΡΩΜΗΣ', 20, y + 9)
  doc.text(`Τρόπος: ${METHOD[o.method] || o.method}`, 20, y + 19)
  doc.setFont('LS', 'bold'); doc.setFontSize(24)
  doc.text(money(o.amount), 190, y + 17, { align: 'right' })
  y += 36
  doc.setTextColor('#111111'); doc.setFont('LS', 'bold'); doc.setFontSize(10.5)
  doc.text('Έναντι', 14, y); y += 6
  doc.setFont('LS', 'normal'); doc.setFontSize(9.5)
  const cov = o.covered.length ? o.covered : ['Συνδρομές / χρεώσεις λογαριασμού']
  cov.slice(0, 8).forEach((l) => { doc.text('•  ' + l, 16, y); y += 5.5 })
  if (o.note) { y += 2; doc.text(`Σημείωση: ${o.note}`, 14, y); y += 6 }
  y += 6
  const owe = o.balance > 0.004
  doc.setFillColor(owe ? '#fff4e5' : '#e6f5ec'); doc.roundedRect(14, y, 182, 18, 2, 2, 'F')
  doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.setTextColor(owe ? '#8a4b00' : '#11663a')
  doc.text(owe ? `Υπόλοιπο που εκκρεμεί: ${money(o.balance)}` : 'Ο λογαριασμός σας είναι πλήρως εξοφλημένος. Ευχαριστούμε!', 20, y + 11)
  doc.setTextColor('#111111'); y += 30
  doc.setFont('LS', 'normal'); doc.setFontSize(9)
  doc.text('Για τον σύλλογο', 150, y, { align: 'center' })
  doc.setFont('LS', 'bold'); doc.text(c.club_name, 150, y + 6, { align: 'center' })
  footer(doc, a, c)
  return doc
}

export const toBase64 = (doc: jsPDF) => doc.output('datauristring').split(',')[1]
