import { useEffect, useState } from 'react'
import { MessageSquare, Copy, Send } from 'lucide-react'
import { sb, fullName, isAdult, type EventRow, type Player } from '../lib/supabase'
import { useApp, Modal } from '../ui'

// Επείγουσα ειδοποίηση (π.χ. ακύρωση προπόνησης) με SMS / Viber προς γονείς και ενήλικες αθλητές της ομάδας
export default function Urgent({ ev, teamId, teamName, onClose }: { ev?: EventRow; teamId: string; teamName: string; onClose: () => void }) {
  const { toast, settings } = useApp()
  const when = ev ? new Date(ev.starts_at).toLocaleString('el-GR', { weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  const [msg, setMsg] = useState(ev ? `${settings?.club_name || 'PSS'}: Η ${ev.type === 'match' ? 'αγωνιστική υποχρέωση' : 'προπόνηση'} της ομάδας ${teamName} (${when}) ΑΚΥΡΩΝΕΤΑΙ λόγω καιρικών συνθηκών. Ευχαριστούμε.` : `${settings?.club_name || 'PSS'}: `)
  const [phones, setPhones] = useState<{ name: string; phone: string }[]>([])
  useEffect(() => {
    (async () => {
      const { data: ps } = await sb.from('players').select('*').eq('team_id', teamId).eq('active', true)
      const players = (ps || []) as Player[]
      const { data: links } = await sb.from('player_households').select('player_id, household_id').in('player_id', players.map((p) => p.id))
      const { data: gs } = await sb.from('guardians').select('first_name,last_name,phone,household_id').in('household_id', [...new Set((links || []).map((l) => l.household_id))])
      const out = new Map<string, string>()
      for (const g of gs || []) if (g.phone) out.set(g.phone.replace(/\s/g, ''), `${g.first_name} ${g.last_name}`)
      for (const p of players) if (isAdult(p) && p.phone) out.set(p.phone.replace(/\s/g, ''), fullName(p))
      setPhones([...out.entries()].map(([phone, name]) => ({ phone, name })))
    })()
  }, [teamId])
  const nums = phones.map((p) => p.phone)
  const ios = /iPhone|iPad/.test(navigator.userAgent)
  const smsLink = `sms:${ios ? '/open?addresses=' + nums.join(',') + '&body=' : nums.join(',') + '?body='}${encodeURIComponent(msg)}`
  const copy = (t: string, m: string) => { navigator.clipboard.writeText(t); toast(m) }
  return <Modal title={`Επείγουσα ειδοποίηση · ${teamName}`} onClose={onClose}>
    <div className="stack">
      <label className="f">Μήνυμα ({msg.length} χαρακτήρες)<textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
      <div className="muted">{phones.length} παραλήπτες (γονείς & ενήλικες αθλητές με κινητό)</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <a className="btn red" href={smsLink}><MessageSquare size={16} />Άνοιγμα SMS</a>
        <button className="btn ghost" onClick={() => copy(msg, 'Το μήνυμα αντιγράφηκε – επικόλλησέ το στο group Viber της ομάδας')}><Copy size={16} />Αντιγραφή για Viber</button>
        <button className="btn ghost" onClick={() => copy(nums.join(', '), 'Οι αριθμοί αντιγράφηκαν')}><Send size={16} />Αντιγραφή αριθμών</button>
      </div>
      <div className="note">Το «Άνοιγμα SMS» ανοίγει την εφαρμογή μηνυμάτων του κινητού με όλους τους παραλήπτες. Για μαζική αυτόματη αποστολή (χωρίς κινητό) χρειάζεται πάροχος SMS (π.χ. Apifon, Yuboto) — μπορεί να συνδεθεί αργότερα.</div>
      <details><summary className="muted" style={{ cursor: 'pointer' }}>Λίστα παραληπτών</summary><div className="list">{phones.map((p) => <div className="item" key={p.phone} style={{ padding: '6px 0' }}><span className="grow">{p.name}</span><a href={`tel:${p.phone}`}>{p.phone}</a></div>)}</div></details>
    </div>
  </Modal>
}
