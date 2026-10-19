// Ενιαίος τρόπος για λήψεις, άνοιγμα αρχείων και εκτυπώσεις σε web, iPhone/iPad και Android.
// Στο web: κανονική λήψη / νέα καρτέλα / εκτύπωση browser.
// Στην εφαρμογή: αποθήκευση σε προσωρινό αρχείο και άνοιγμα του μενού κοινοποίησης (Αποθήκευση στα Αρχεία, Εκτύπωση, AirDrop, Viber…).
import { Capacitor } from '@capacitor/core'

export const isNative = () => Capacitor.isNativePlatform()
export const platform = () => Capacitor.getPlatform() as 'web' | 'ios' | 'android'
// Σταθερή διεύθυνση του web app (για συνδέσμους σε email, προσκλήσεις κ.λπ.)
export const WEB_APP = 'https://vasileiostripolidis.github.io/omada-app/'

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(b) })
}
const safeName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_')

export async function saveFile(blob: Blob, filename: string, title?: string) {
  if (!isNative()) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  const path = `${Date.now()}_${safeName(filename)}`
  const w = await Filesystem.writeFile({ path, data: await blobToBase64(blob), directory: Directory.Cache })
  await Share.share({ title: title || filename, url: w.uri, dialogTitle: title || filename }).catch(() => { /* ο χρήστης έκλεισε το μενού */ })
}

export const saveBase64 = (b64: string, filename: string, mime = 'application/pdf') => {
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return saveFile(new Blob([u], { type: mime }), filename)
}

export async function openUrl(url: string) {
  if (!isNative()) { window.open(url, '_blank', 'noopener'); return }
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#021534' })
}

// Μετατροπή στοιχείου της σελίδας σε PDF Α4 (για εκτύπωση/κοινοποίηση μέσα στην εφαρμογή)
export async function elementToPdf(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 820, ignoreElements: (n) => n.classList?.contains('no-print') })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = 210, ph = 297, m = 8, iw = pw - m * 2
  const pxPerMm = canvas.width / iw, pageH = Math.floor((ph - m * 2) * pxPerMm)
  for (let y = 0, i = 0; y < canvas.height; y += pageH, i++) {
    const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = Math.min(pageH, canvas.height - y)
    slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height)
    if (i) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, iw, slice.height / pxPerMm)
  }
  return pdf.output('blob')
}

// Εκτύπωση: στο web ο διάλογος εκτύπωσης, στην εφαρμογή PDF → μενού κοινοποίησης (περιέχει «Εκτύπωση»)
export async function printElement(el: HTMLElement, filename: string, webPrint: () => void = () => window.print()) {
  if (!isNative()) { webPrint(); return }
  await saveFile(await elementToPdf(el), filename.endsWith('.pdf') ? filename : filename + '.pdf')
}

// Εκτύπωση αυτόνομου HTML (π.χ. κάρτες QR): web → νέο παράθυρο, εφαρμογή → PDF
export async function printHtml(html: string, filename: string) {
  if (!isNative()) {
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(html); w.document.close(); return
  }
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff'
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script').forEach((s) => s.remove())
  host.innerHTML = Array.from(doc.head.querySelectorAll('style')).map((s) => s.outerHTML).join('') + doc.body.innerHTML
  document.body.appendChild(host)
  await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r })))
  try { await saveFile(await elementToPdf(host), filename) } finally { host.remove() }
}
