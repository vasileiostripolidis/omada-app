import { sb } from './supabase'
import { isNative, platform } from './native'

// Ειδοποιήσεις: στην εφαρμογή iPhone/iPad μέσω Apple (APNs), στο web μέσω Web Push.
// Android: θα ενεργοποιηθεί με το Firebase όταν ετοιμαστεί η έκδοση Play Store.
const nativePush = () => isNative() && platform() === 'ios'
export const pushSupported = () => nativePush() || (!isNative() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const TOKEN_KEY = 'pss_push_token'
const getTok = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
const setTok = (t: string | null) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* */ } }

function b64ToBytes(s: string) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function callPush<T = { recipients: number; delivered: number }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke('push', { body })
  if (error) { let m = error.message; try { m = (await (error as { context?: Response }).context?.json())?.error || m } catch { /* */ } throw new Error(m) }
  return data as T
}

export async function pushStatus(): Promise<'unsupported' | 'ios-install' | 'denied' | 'on' | 'off'> {
  if (nativePush()) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const p = await PushNotifications.checkPermissions()
    if (p.receive === 'denied') return 'denied'
    return p.receive === 'granted' && getTok() ? 'on' : 'off'
  }
  if (isNative()) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'ios-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

async function nativeRegister(): Promise<string> {
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let p = await PushNotifications.checkPermissions()
  if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') p = await PushNotifications.requestPermissions()
  if (p.receive !== 'granted') throw new Error('Δεν δόθηκε άδεια για ειδοποιήσεις')
  return new Promise<string>((resolve, reject) => {
    let done = false
    PushNotifications.addListener('registration', (t) => { if (!done) { done = true; resolve(t.value) } })
    PushNotifications.addListener('registrationError', (e) => { if (!done) { done = true; reject(new Error(e.error)) } })
    PushNotifications.register()
    setTimeout(() => { if (!done) { done = true; reject(new Error('Η εγγραφή στις ειδοποιήσεις δεν ολοκληρώθηκε')) } }, 15000)
  })
}

export async function enablePush() {
  const { data: u } = await sb.auth.getUser()
  if (nativePush()) {
    const token = await nativeRegister()
    const r = await sb.from('push_subscriptions').upsert({ endpoint: token, platform: platform(), p256dh: null, auth: null, profile_id: u.user!.id, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' })
    if (r.error) throw r.error
    setTok(token); return
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Δεν δόθηκε άδεια για ειδοποιήσεις')
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('./sw.js'))
  await navigator.serviceWorker.ready
  const { key } = await callPush<{ key: string }>({ action: 'public_key' })
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }))
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const r = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, platform: 'web', p256dh: j.keys.p256dh, auth: j.keys.auth, profile_id: u.user!.id, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' })
  if (r.error) throw r.error
}

export async function disablePush() {
  if (nativePush()) {
    const t = getTok(); if (t) await sb.from('push_subscriptions').delete().eq('endpoint', t)
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.unregister().catch(() => {}); setTok(null); return
  }
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe() }
}

// Στην εφαρμογή: πάτημα ειδοποίησης → άνοιγμα της σωστής οθόνης. Ανανέωση token σε κάθε εκκίνηση.
export async function initNativePush() {
  if (!nativePush()) return
  const { PushNotifications } = await import('@capacitor/push-notifications')
  PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const url = (a.notification.data as { url?: string })?.url || ''
    const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '#/'
    window.location.hash = hash
  })
  if (getTok() && (await PushNotifications.checkPermissions()).receive === 'granted') {
    try {
      const token = await nativeRegister()
      if (token !== getTok()) {
        const { data: u } = await sb.auth.getUser(); if (!u.user) return
        await sb.from('push_subscriptions').upsert({ endpoint: token, platform: platform(), profile_id: u.user.id, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' })
        setTok(token)
      }
    } catch { /* */ }
  }
}

export const sendPush = (p: { title: string; body?: string; audience?: 'parents' | 'staff' | 'all'; team_id?: string | null; household_ids?: string[]; path?: string; tag?: string }) =>
  callPush({ action: 'send', ...p })
