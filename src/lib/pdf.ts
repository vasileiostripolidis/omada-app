import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Charge, Player, Settings } from './supabase'
import { dt, fullName } from './supabase'

// Γραμματοσειρά με ελληνικούς χαρακτήρες (Roboto από CDN, φορτώνεται μία φορά)
let fontB64: string | null = null
async function loadFont(doc: jsPDF) {
  if (!fontB64) {
    const r = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf')
    const buf = new Uint8Array(await r.arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    fontB64 = btoa(s)
  }
  doc.addFileToVFS('Roboto.ttf', fontB64)
  doc.addFont('Roboto.ttf', 'Roboto', 'normal')
  doc.setFont('Roboto')
}

const money = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',') + ' €'

export async function chargesPdf(player: Player, charges: Charge[], s: Settings) {
  const doc = new jsPDF()
  await loadFont(doc)
  const color = s.primary_color || '#0f7a3d'
  doc.setFillColor(color)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor('#ffffff')
  doc.setFontSize(18)
  doc.text(s.club_name, 14, 17)
  doc.setFontSize(9)
  doc.text([s.address, s.phone, s.email].filter(Boolean).join(' · '), 14, 23)
  doc.setTextColor('#111111')
  doc.setFontSize(14)
  doc.text('Κατάσταση χρεώσεων', 14, 40)
  doc.setFontSize(10)
  doc.text(`Αθλητής: ${fullName(player)}`, 14, 48)
  if (player.guardian_name) doc.text(`Κηδεμόνας: ${player.guardian_name}`, 14, 54)
  doc.text(`Ημερομηνία: ${new Date().toLocaleDateString('el-GR')}`, 140, 48)

  const open = charges.filter((c) => c.status !== 'cancelled')
  autoTable(doc, {
    startY: 60,
    head: [['Περιγραφή', 'Λήξη', 'Ποσό', 'Πληρώθηκε', 'Υπόλοιπο']],
    body: open.map((c) => [c.description, dt(c.due_date), money(c.amount), money(c.paid_amount), money(c.amount - c.paid_amount)]),
    styles: { font: 'Roboto', fontSize: 9 },
    headStyles: { fillColor: color, font: 'Roboto' },
  })
  const total = open.reduce((a, c) => a + (c.amount - c.paid_amount), 0)
  // @ts-expect-error lastAutoTable added by plugin
  let y = doc.lastAutoTable.finalY + 10
  doc.setFontSize(12)
  doc.text(`Συνολικό υπόλοιπο: ${money(total)}`, 14, y)
  y += 10
  doc.setFontSize(9)
  if (s.iban) { doc.text(`Πληρωμή με κατάθεση στο IBAN: ${s.iban}`, 14, y); y += 6; doc.text(`Αιτιολογία: ${fullName(player)}`, 14, y); y += 8 }
  if (s.email_footer) doc.text(s.email_footer, 14, y)
  return doc
}

export async function receiptPdf(player: Player, amount: number, desc: string, method: string, s: Settings) {
  const doc = new jsPDF({ format: 'a5' })
  await loadFont(doc)
  doc.setFontSize(16)
  doc.text(s.club_name, 12, 16)
  doc.setFontSize(12)
  doc.text('Απόδειξη είσπραξης', 12, 28)
  doc.setFontSize(10)
  doc.text([`Αθλητής: ${fullName(player)}`, `Για: ${desc}`, `Ποσό: ${money(amount)}`, `Τρόπος: ${method}`, `Ημερομηνία: ${new Date().toLocaleDateString('el-GR')}`], 12, 40, { lineHeightFactor: 1.8 })
  return doc
}

export const pdfBase64 = (doc: jsPDF) => doc.output('datauristring').split(',')[1]
