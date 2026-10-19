import { useEffect, useState } from 'react'
import { isNative } from '../lib/native'
import { useLang } from '../lib/i18n'

// Ένδειξη όταν δεν υπάρχει σύνδεση στο ίντερνετ (σε όλες τις οθόνες)
export default function OfflineBar() {
  const [off, setOff] = useState(!navigator.onLine)
  const { lang } = useLang()
  useEffect(() => {
    const on = () => setOff(false), offF = () => setOff(true)
    window.addEventListener('online', on); window.addEventListener('offline', offF)
    let remove: (() => void) | undefined
    if (isNative()) import('@capacitor/network').then(async ({ Network }) => {
      setOff(!(await Network.getStatus()).connected)
      const h = await Network.addListener('networkStatusChange', (s) => setOff(!s.connected)); remove = () => h.remove()
    })
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', offF); remove?.() }
  }, [])
  if (!off) return null
  return <div className="offline-bar" role="status">{lang === 'en' ? 'No internet connection – changes will be shown when you are back online.' : 'Χωρίς σύνδεση στο ίντερνετ – τα στοιχεία θα ενημερωθούν μόλις επανέλθει η σύνδεση.'}</div>
}
