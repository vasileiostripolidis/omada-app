import { sb } from './supabase'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

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
  if (isIOS() && !isStandalone()) return 'ios-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

export async function enablePush() {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Δεν δόθηκε άδεια για ειδοποιήσεις')
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('./sw.js'))
  await navigator.serviceWorker.ready
  const { key } = await callPush<{ key: string }>({ action: 'public_key' })
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }))
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { data: u } = await sb.auth.getUser()
  const r = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, profile_id: u.user!.id, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' })
  if (r.error) throw r.error
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe() }
}

export const sendPush = (p: { title: string; body?: string; audience?: 'parents' | 'staff' | 'all'; team_id?: string | null; household_ids?: string[]; path?: string; tag?: string }) =>
  callPush({ action: 'send', ...p })
