import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://hcdrskfzznsrwedcstsx.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_vqTscZ3b7pfNHlDd82RWfQ_0goRDkTx'
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
export const BRAND = 'https://vasileiostripolidis.github.io/omada-app/brand/'

export type Team = { id: string; name: string; short_name: string | null; age_group: string | null; season: string | null; coach_name: string | null; color: string | null; training_schedule: string | null; monthly_fee: number | null; logo_url: string | null }
export type Player = {
  id: string; first_name: string; last_name: string; birth_date: string | null; photo_path: string | null
  team_id: string | null; jersey_number: number | null; position: string | null
  address: string | null; amka: string | null; medical_expiry: string | null; medical_notes: string | null
  card_number: string | null; card_expiry: string | null; email: string | null; phone: string | null
  active: boolean; notes: string | null; joined_at: string | null
}
export type Household = { id: string; name: string; monthly_override: number | null; discount_pct: number; active: boolean; notes: string | null; created_at: string }
export type Guardian = { id: string; household_id: string; first_name: string; last_name: string; relation: string | null; email: string | null; phone: string | null; afm: string | null; receives_emails: boolean; notes: string | null }
export type Link = { player_id: string; household_id: string; share_pct: number }
export type Charge = { id: string; household_id: string | null; period: string | null; description: string; amount: number; due_date: string | null; status: 'pending' | 'paid' | 'partial' | 'cancelled'; paid_amount: number; auto: boolean; emailed_at: string | null; created_at: string; breakdown: { name: string; share: number }[] | null }
export type Payment = { id: string; household_id: string | null; payer_guardian_id: string | null; amount: number; method: string; paid_at: string; note: string | null; receipt_no: number; receipt_sent_at: string | null; created_at: string }
export type EventRow = { id: string; team_id: string | null; type: string; starts_at: string; opponent: string | null; location: string | null; home: boolean; score_for: number | null; score_against: number | null; notes: string | null }
export type Stat = { event_id: string; player_id: string; present: boolean; minutes: number; goals: number; assists: number; yellow: number; red: number; rating: number | null }
export type Sponsor = { id: string; name: string; logo_url: string | null; website: string | null; tier: string; contact_name: string | null; email: string | null; phone: string | null; amount: number | null; start_date: string | null; end_date: string | null; show_on_documents: boolean; notes: string | null; sort: number }
export type Settings = {
  club_name: string; logo_url: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; iban: string | null; afm: string | null
  fee_1: number; fee_2: number; fee_3: number; fee_extra: number; charge_day: number; due_days: number
  reminder_day_1: number; reminder_day_2: number; auto_family_charges: boolean; auto_reminders: boolean; auto_receipts: boolean
  email_footer: string | null; primary_color: string | null; accent_color: string | null
}

export const eur = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })
export const dt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('el-GR') : '—')
export const fullName = (p: { first_name: string; last_name: string }) => `${p.last_name} ${p.first_name}`
export const age = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 31557600000) : null)
export const isAdult = (p: Pick<Player, 'birth_date'>) => (age(p.birth_date) ?? 0) >= 18
export const initials = (p: { first_name: string; last_name: string }) => (p.first_name[0] || '') + (p.last_name[0] || '')
export const today = () => new Date().toISOString().slice(0, 10)

export function policyTotal(s: Pick<Settings, 'fee_1' | 'fee_2' | 'fee_3' | 'fee_extra'>, n: number) {
  if (n <= 0) return 0
  if (n === 1) return Number(s.fee_1)
  if (n === 2) return Number(s.fee_2)
  if (n === 3) return Number(s.fee_3)
  return Number(s.fee_3) + (n - 3) * Number(s.fee_extra)
}
// ίδιος υπολογισμός με τη βάση (household_monthly_amount)
export function monthlyAmount(s: Settings | null, h: Household, links: { share_pct: number; active: boolean }[]) {
  if (h.monthly_override != null) return Number(h.monthly_override)
  if (!s) return 0
  const act = links.filter((l) => l.active && Number(l.share_pct) > 0)
  if (!act.length) return 0
  const shares = act.reduce((a, l) => a + Number(l.share_pct), 0)
  const total = policyTotal(s, act.length) * (shares / 100 / act.length)
  return Math.round(total * (1 - Number(h.discount_pct || 0) / 100) * 100) / 100
}

export async function signedUrl(path: string) {
  const { data } = await sb.storage.from('player-files').createSignedUrl(path, 3600)
  return data?.signedUrl
}
export async function uploadPublic(file: File, folder: string) {
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const up = await sb.storage.from('club').upload(path, file, { upsert: true })
  if (up.error) throw up.error
  return sb.storage.from('club').getPublicUrl(path).data.publicUrl
}

export const STATUS: Record<string, string> = { pending: 'Εκκρεμεί', paid: 'Εξοφλήθηκε', partial: 'Μερική', cancelled: 'Ακυρώθηκε' }
export const METHOD: Record<string, string> = { cash: 'Μετρητά', bank: 'Τράπεζα', card: 'Κάρτα', other: 'Άλλο' }
export const EVTYPE: Record<string, string> = { match: 'Αγώνας', training: 'Προπόνηση', tournament: 'Τουρνουά', other: 'Άλλο' }
export const RELATIONS = ['Πατέρας', 'Μητέρα', 'Κηδεμόνας', 'Παππούς/Γιαγιά', 'Ο ίδιος (ενήλικας)']
export const DOC_TYPES: Record<string, string> = { medical: 'Ιατρική βεβαίωση', card: 'Δελτίο αθλητή', id: 'Ταυτότητα / Πιστοποιητικό', consent: 'Υπεύθυνη δήλωση', photo: 'Φωτογραφία', other: 'Άλλο' }
export const TIERS = ['Μέγας Χορηγός', 'Χρυσός Χορηγός', 'Αργυρός Χορηγός', 'Χορηγός', 'Υποστηρικτής']
