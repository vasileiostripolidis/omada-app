// Παρουσιολόγιο χωρίς σήμα: οι καταχωρίσεις μπαίνουν σε ουρά και συγχρονίζονται όταν επανέλθει η σύνδεση
import { sb } from './supabase'

const Q = 'pss_pending_stats'
type Row = Record<string, unknown>
const read = (): Row[][] => { try { return JSON.parse(localStorage.getItem(Q) || '[]') } catch { return [] } }
const write = (v: Row[][]) => { try { localStorage.setItem(Q, JSON.stringify(v)) } catch { /* */ } }

export const pendingCount = () => read().length
export function queueStats(rows: Row[]) { write([...read(), rows]); window.dispatchEvent(new Event('pss-pending')) }
export async function syncPending() {
  const q = read(); if (!q.length || !navigator.onLine) return 0
  const left: Row[][] = []; let ok = 0
  for (const rows of q) { const r = await sb.from('player_stats').upsert(rows); if (r.error) left.push(rows); else ok++ }
  write(left); window.dispatchEvent(new Event('pss-pending'))
  return ok
}
export function cacheSet(key: string, v: unknown) { try { localStorage.setItem('pss_c_' + key, JSON.stringify(v)) } catch { /* */ } }
export function cacheGet<T>(key: string): T | null { try { const v = localStorage.getItem('pss_c_' + key); return v ? JSON.parse(v) : null } catch { return null } }
