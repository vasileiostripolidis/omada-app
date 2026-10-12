import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://hcdrskfzznsrwedcstsx.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_vqTscZ3b7pfNHlDd82RWfQ_0goRDkTx'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

export type Team = { id: string; name: string; age_group: string | null; season: string | null; coach_name: string | null; color: string | null; training_schedule: string | null; monthly_fee: number | null }
export type Player = {
  id: string; first_name: string; last_name: string; birth_date: string | null; photo_path: string | null
  team_id: string | null; jersey_number: number | null; position: string | null
  guardian_name: string | null; guardian_email: string | null; guardian_phone: string | null
  guardian2_name: string | null; guardian2_phone: string | null; address: string | null; amka: string | null
  medical_expiry: string | null; medical_notes: string | null; family_code: string | null
  monthly_fee: number | null; discount_pct: number | null; active: boolean; notes: string | null
}
export type Charge = { id: string; player_id: string; period: string | null; description: string; amount: number; due_date: string | null; status: 'pending' | 'paid' | 'partial' | 'cancelled'; paid_amount: number; auto: boolean; emailed_at: string | null; created_at: string }
export type Payment = { id: string; charge_id: string | null; player_id: string; amount: number; method: string; paid_at: string; note: string | null }
export type EventRow = { id: string; team_id: string | null; type: string; starts_at: string; opponent: string | null; location: string | null; home: boolean; score_for: number | null; score_against: number | null; notes: string | null }
export type Stat = { event_id: string; player_id: string; present: boolean; minutes: number; goals: number; assists: number; yellow: number; red: number; rating: number | null }
export type Settings = { club_name: string; logo_url: string | null; address: string | null; phone: string | null; email: string | null; iban: string | null; default_monthly_fee: number; sibling_discount_pct: number; charge_day: number; due_days: number; auto_charges: boolean; auto_email_charges: boolean; email_footer: string | null; primary_color: string | null }

export const eur = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })
export const dt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('el-GR') : '—')
export const fullName = (p: Pick<Player, 'first_name' | 'last_name'>) => `${p.last_name} ${p.first_name}`
export const age = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 31557600000) : null)

export async function signedUrl(path: string) {
  const { data } = await sb.storage.from('player-files').createSignedUrl(path, 3600)
  return data?.signedUrl
}

export const STATUS: Record<string, string> = { pending: 'Εκκρεμεί', paid: 'Εξοφλήθηκε', partial: 'Μερική', cancelled: 'Ακυρώθηκε' }
export const METHOD: Record<string, string> = { cash: 'Μετρητά', bank: 'Τράπεζα', card: 'Κάρτα', other: 'Άλλο' }
export const EVTYPE: Record<string, string> = { match: 'Αγώνας', training: 'Προπόνηση', tournament: 'Τουρνουά', other: 'Άλλο' }
