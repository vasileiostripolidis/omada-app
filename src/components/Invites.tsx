import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, MessageSquare, Printer, CheckCircle2, Smartphone, RefreshCw } from 'lucide-react'
import { sb, BRAND, type Guardian } from '../lib/supabase'
import { useApp, Modal } from '../ui'

const APP = 'https://vasileiostripolidis.github.io/omada-app/'
export const inviteUrl = (token: string) => `${APP}#/join/${token}`
type G = Guardian & { profile_id?: string | null }

// Υπάρχουσα ενεργή πρόσκληση ή νέα
export async function getInvite(guardianId: string, fresh = false): Promise<string> {
  if (!fresh) {
    const { data } = await sb.from('guardian_invites').select('token').eq('guardian_id', guardianId).is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1)
    if (data?.[0]) return data[0].token
  }
  const { data, error } = await sb.from('guardian_invites').insert({ guardian_id: guardianId }).select('token').single()
  if (error) throw error
  return data.token
}

const message = (g: G, club: string, link: string) =>
  `Γεια σας ${g.first_name}! Η ${club} σας προσκαλεί στην εφαρμογή γονέων: πρόγραμμα, ανακοινώσεις, επιδόσεις και οικονομικά του παιδιού σας. Πατήστε για να φτιάξετε λογαριασμό: ${link}`

export function InviteModal({ guardian, onClose }: { guardian: G; onClose: () => void }) {
  const { settings, toast } = useApp()
  const [token, setToken] = useState('')
  const [qr, setQr] = useState('')
  const club = settings?.club_name || 'Patras Schools Soccer'
  const load = async (fresh = false) => { try { const t = await getInvite(guardian.id, fresh); setToken(t); setQr(await QRCode.toDataURL(inviteUrl(t), { width: 520, margin: 1, color: { dark: '#021534' } })) } catch (e) { toast((e as Error).message) } }
  useEffect(() => { if (!guardian.profile_id) load() }, [guardian.id])
  const link = token ? inviteUrl(token) : ''
  const msg = message(guardian, club, link)
  const phone = (guardian.phone || '').replace(/[^\d+]/g, '')
  const intl = phone.startsWith('+') ? phone.slice(1) : phone.length === 10 ? '30' + phone : phone
  const ios = /iPhone|iPad/.test(navigator.userAgent)
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast('Αντιγράφηκε ✓') }
  return <Modal title={`Πρόσβαση στην εφαρμογή · ${guardian.first_name} ${guardian.last_name}`} onClose={onClose}>
    {guardian.profile_id ? <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: 10 }}><CheckCircle2 size={44} color="var(--ok)" /><b>Ο γονέας έχει ήδη λογαριασμό και βλέπει τα παιδιά του στην εφαρμογή.</b></div>
      : <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="muted">Ο γονέας ανοίγει τον σύνδεσμο ή σκανάρει το QR, φτιάχνει κωδικό και συνδέεται αυτόματα με την οικογένειά του. Ο σύνδεσμος ισχύει 60 ημέρες και χρησιμοποιείται μία φορά.</div>
        {qr ? <img src={qr} alt="QR" style={{ width: 220, height: 220 }} /> : <div style={{ height: 220 }} />}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', width: '100%' }}>
          <a className="btn red" href={`viber://forward?text=${encodeURIComponent(msg)}`}><Smartphone size={16} />Viber</a>
          {intl && <a className="btn ghost" href={`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
          {phone && <a className="btn ghost" href={`sms:${phone}${ios ? '&' : '?'}body=${encodeURIComponent(msg)}`}><MessageSquare size={16} />SMS</a>}
          <button className="btn ghost" onClick={() => copy(msg)}><Copy size={16} />Αντιγραφή μηνύματος</button>
          <button className="btn ghost" onClick={() => copy(link)}><Copy size={16} />Αντιγραφή συνδέσμου</button>
          <button className="btn ghost" onClick={() => printSheet([{ g: guardian, link, qr }], club)}><Printer size={16} />Εκτύπωση</button>
        </div>
        <button className="btn ghost sm" onClick={() => load(true)}><RefreshCw size={14} />Νέος σύνδεσμος</button>
      </div>}
  </Modal>
}

function printSheet(items: { g: G; link: string; qr: string; kids?: string }[], club: string) {
  const w = window.open('', '_blank'); if (!w) return
  const card = (x: { g: G; link: string; qr: string; kids?: string }) => `<div class="c"><img class="logo" src="${BRAND}pss-logo-small.png"/><h2>${club}</h2><p>Πρόσκληση στην εφαρμογή γονέων</p>
    <h3>${x.g.first_name} ${x.g.last_name}</h3>${x.kids ? `<p class="k">${x.kids}</p>` : ''}<img class="qr" src="${x.qr}"/><p class="s">Σκανάρετε με την κάμερα του κινητού<br/>και φτιάξτε κωδικό πρόσβασης.</p></div>`
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Προσκλήσεις γονέων</title><style>
    body{font-family:Inter,Arial,sans-serif;margin:0;color:#021534}.w{display:grid;grid-template-columns:1fr 1fr;gap:0}
    .c{border:1px dashed #bbb;padding:18px;text-align:center;page-break-inside:avoid;height:128mm;box-sizing:border-box}
    .logo{height:46px}h2{margin:6px 0 0;font-size:16px;text-transform:uppercase}h3{margin:10px 0 2px;font-size:19px}p{margin:2px 0;font-size:12px}.k{color:#c8102e;font-weight:700}
    .qr{width:58mm;height:58mm;margin:8px 0}.s{color:#555}@page{margin:8mm}</style></head><body><div class="w">${items.map(card).join('')}</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`)
  w.document.close()
}

// Μαζικές προσκλήσεις: όλοι οι γονείς χωρίς λογαριασμό
export function BulkInvites({ onClose }: { onClose: () => void }) {
  const { settings, toast } = useApp()
  const [rows, setRows] = useState<{ g: G; kids: string; hasEmail: boolean }[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [one, setOne] = useState<G | null>(null)
  useEffect(() => {
    (async () => {
      const [g, l] = await Promise.all([sb.from('guardians').select('*').is('profile_id', null).order('last_name'), sb.from('player_households').select('household_id, players(first_name, active)')])
      const kids = new Map<string, string[]>()
      for (const x of (l.data || []) as unknown as { household_id: string; players: { first_name: string; active: boolean } | null }[]) if (x.players?.active) kids.set(x.household_id, [...(kids.get(x.household_id) || []), x.players.first_name])
      const r = ((g.data || []) as G[]).filter((x) => kids.has(x.household_id)).map((x) => ({ g: x, kids: (kids.get(x.household_id) || []).join(', '), hasEmail: !!x.email }))
      setRows(r); setSel(new Set(r.map((x) => x.g.id)))
    })()
  }, [])
  async function print() {
    setBusy(true)
    try {
      const items = []
      for (const r of rows.filter((x) => sel.has(x.g.id))) { const t = await getInvite(r.g.id); const link = inviteUrl(t); items.push({ g: r.g, link, kids: r.kids, qr: await QRCode.toDataURL(link, { width: 420, margin: 1, color: { dark: '#021534' } }) }) }
      printSheet(items, settings?.club_name || 'Patras Schools Soccer')
    } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }
  return <Modal wide title="Προσκλήσεις γονέων στην εφαρμογή" onClose={onClose} foot={<><span className="muted grow">{sel.size} επιλεγμένοι</span><button className="btn red" disabled={busy || !sel.size} onClick={print}><Printer size={16} />{busy ? '…' : 'Εκτύπωση καρτών QR'}</button></>}>
    <div className="stack">
      <div className="note">Εδώ φαίνονται οι γονείς που <b>δεν έχουν ακόμα λογαριασμό</b>. Τύπωσε κάρτες με QR (4 ανά σελίδα) να τις μοιράσεις στην προπόνηση, ή στείλε τον σύνδεσμο ξεχωριστά με Viber/SMS πατώντας το όνομα.</div>
      {rows.length ? <div className="list">{rows.map((r) => <div key={r.g.id} className="item" style={{ padding: '8px 0' }}>
        <input type="checkbox" checked={sel.has(r.g.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(r.g.id); else n.delete(r.g.id); setSel(n) }} />
        <button className="grow" style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => setOne(r.g)}><b>{r.g.last_name} {r.g.first_name}</b><div className="muted">{r.g.relation} · παιδιά: {r.kids}{r.g.phone ? ` · ${r.g.phone}` : ''}</div></button>
        <button className="btn ghost sm" onClick={() => setOne(r.g)}><Smartphone size={14} />Αποστολή</button></div>)}</div>
        : <div className="empty"><div className="big">Δεν υπάρχουν γονείς χωρίς λογαριασμό</div></div>}
    </div>
    {one && <InviteModal guardian={one} onClose={() => setOne(null)} />}
  </Modal>
}
