import { useEffect, useState } from 'react'
import { Bell, BellOff, Share } from 'lucide-react'
import { pushStatus, enablePush, disablePush, callPush } from '../lib/push'
import { isNative } from '../lib/native'

// Ενεργοποίηση ειδοποιήσεων στο κινητό. compact: μικρό banner μόνο όταν είναι κλειστές.
export default function PushToggle({ compact = false, lang = 'el', toast }: { compact?: boolean; lang?: 'el' | 'en'; toast: (m: string) => void }) {
  const [st, setSt] = useState<Awaited<ReturnType<typeof pushStatus>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('pss_push_hide') === '1' } catch { return false } })
  const en = lang === 'en'
  useEffect(() => { pushStatus().then(setSt) }, [])
  async function on() {
    setBusy(true)
    try { await enablePush(); setSt('on'); toast(en ? 'Notifications enabled ✓' : 'Οι ειδοποιήσεις ενεργοποιήθηκαν ✓'); callPush({ action: 'test' }).catch(() => {}) }
    catch (e) { toast((e as Error).message); setSt(await pushStatus()) }
    setBusy(false)
  }
  async function off() { setBusy(true); await disablePush(); setSt('off'); setBusy(false) }
  if (!st || st === 'unsupported') return compact ? null : <div className="card row"><BellOff size={20} color="var(--muted)" /><div className="grow muted">{en ? 'Notifications are not available on this device.' : 'Οι ειδοποιήσεις δεν είναι διαθέσιμες σε αυτή τη συσκευή.'}</div></div>
  if (compact && (st === 'on' || hidden)) return null
  const hide = () => { try { localStorage.setItem('pss_push_hide', '1') } catch { /* */ } setHidden(true) }
  const text = st === 'ios-install'
    ? (en ? 'To get notifications on iPhone: tap Share ⬆ and “Add to Home Screen”, then open the app from the icon.' : 'Για ειδοποιήσεις στο iPhone: πάτα Κοινοποίηση ⬆ και «Προσθήκη στην οθόνη Αφετηρίας», μετά άνοιξε την εφαρμογή από το εικονίδιο.')
    : st === 'denied' ? (isNative() ? (en ? 'Notifications are turned off. Enable them in Settings → PSS Soccer → Notifications.' : 'Οι ειδοποιήσεις είναι κλειστές. Ενεργοποίησέ τες από Ρυθμίσεις → PSS Soccer → Ειδοποιήσεις.') : (en ? 'Notifications are blocked. Allow them in your browser/phone settings for this site.' : 'Οι ειδοποιήσεις είναι μπλοκαρισμένες. Επίτρεψέ τες από τις ρυθμίσεις του browser/κινητού για αυτή τη σελίδα.'))
    : st === 'on' ? (en ? 'Notifications are on for this device.' : 'Οι ειδοποιήσεις είναι ενεργές σε αυτή τη συσκευή.')
    : (en ? 'Get a notification on your phone for announcements, schedule changes and payments.' : 'Λάβε ειδοποίηση στο κινητό για ανακοινώσεις, αλλαγές προγράμματος και πληρωμές.')
  return <div className="card row" style={compact ? { marginBottom: 14, background: 'var(--info-bg)' } : undefined}>
    {st === 'ios-install' ? <Share size={20} color="var(--navy)" /> : st === 'on' ? <Bell size={20} color="var(--ok)" /> : <Bell size={20} color="var(--navy)" />}
    <div className="grow">{!compact && <b>{en ? 'Phone notifications' : 'Ειδοποιήσεις στο κινητό'}</b>}<div className={compact ? '' : 'muted'}>{text}</div></div>
    {st === 'off' && <button className="btn red sm" disabled={busy} onClick={on}>{en ? 'Enable' : 'Ενεργοποίηση'}</button>}
    {st === 'on' && !compact && <button className="btn ghost sm" disabled={busy} onClick={off}>{en ? 'Turn off' : 'Απενεργοποίηση'}</button>}
    {compact && <button className="btn ghost sm" onClick={hide}>{en ? 'Later' : 'Αργότερα'}</button>}
  </div>
}
