import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://hcdrskfzznsrwedcstsx.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_vqTscZ3b7pfNHlDd82RWfQ_0goRDkTx'
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
export const BRAND = './brand/'

export type Team = { id: string; name: string; short_name: string | null; age_group: string | null; season: string | null; coach_name: string | null; color: string | null; training_schedule: string | null; monthly_fee: number | null; logo_url: string | null; fee_1: number | null; fee_2: number | null; fee_3: number | null; fee_extra: number | null; next_team_id?: string | null; birth_year_from?: number | null; birth_year_to?: number | null }
export type Player = {
  id: string; first_name: string; last_name: string; birth_date: string | null; photo_path: string | null
  team_id: string | null; jersey_number: number | null; position: string | null
  address: string | null; amka: string | null; medical_expiry: string | null; medical_notes: string | null
  card_number: string | null; card_expiry: string | null; email: string | null; phone: string | null
  active: boolean; notes: string | null; joined_at: string | null; created_at?: string
}
export type Household = { id: string; name: string; monthly_override: number | null; discount_pct: number; active: boolean; notes: string | null; created_at: string; discount_category?: string | null; discount_reason?: string | null }
export type Guardian = { id: string; household_id: string; first_name: string; last_name: string; relation: string | null; email: string | null; phone: string | null; afm: string | null; receives_emails: boolean; notes: string | null }
export type Link = { player_id: string; household_id: string; share_pct: number }
export type Charge = { id: string; household_id: string | null; period: string | null; description: string; amount: number; due_date: string | null; status: 'pending' | 'paid' | 'partial' | 'cancelled'; paid_amount: number; auto: boolean; emailed_at: string | null; created_at: string; breakdown: { name: string; share: number }[] | null }
export type Payment = { id: string; household_id: string | null; payer_guardian_id: string | null; amount: number; method: string; paid_at: string; note: string | null; receipt_no: number; receipt_sent_at: string | null; created_at: string }
export type EventRow = { id: string; team_id: string | null; type: string; starts_at: string; end_at?: string | null; field_id?: string | null; objective?: string | null; opponent: string | null; location: string | null; home: boolean; score_for: number | null; score_against: number | null; notes: string | null }
export type Stat = { event_id: string; player_id: string; present: boolean; minutes: number; goals: number; assists: number; yellow: number; red: number; rating: number | null; rpe?: number | null; starter?: boolean; position?: string | null }
export type Sponsor = { id: string; name: string; logo_url: string | null; website: string | null; tier: string; contact_name: string | null; email: string | null; phone: string | null; amount: number | null; start_date: string | null; end_date: string | null; show_on_documents: boolean; notes: string | null; sort: number }
export type Settings = {
  club_name: string; logo_url: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; iban: string | null; afm: string | null
  fee_1: number; fee_2: number; fee_3: number; fee_extra: number; charge_day: number; due_days: number
  reminder_day_1: number; reminder_day_2: number; auto_family_charges: boolean; auto_reminders: boolean; auto_receipts: boolean
  email_footer: string | null; primary_color: string | null; accent_color: string | null; month_pct: Record<string, number>; current_season: string
}

export const eur = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })
export const dt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('el-GR') : '—')
export const fullName = (p: { first_name: string; last_name: string }) => `${p.last_name} ${p.first_name}`
export const age = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 31557600000) : null)
export const isAdult = (p: Pick<Player, 'birth_date'>) => (age(p.birth_date) ?? 0) >= 18
export const initials = (p: { first_name: string; last_name: string }) => (p.first_name[0] || '') + (p.last_name[0] || '')
export const today = () => new Date().toISOString().slice(0, 10)

type Fees = { fee_1: number | null; fee_2: number | null; fee_3: number | null; fee_extra: number | null }
export function policyTotal(s: Fees, n: number, t?: Partial<Fees> | null) {
  const f = (k: keyof Fees) => Number(t?.[k] ?? s[k] ?? 0)
  if (n <= 0) return 0
  if (n === 1) return f('fee_1')
  if (n === 2) return f('fee_2')
  if (n === 3) return f('fee_3')
  return f('fee_3') + (n - 3) * f('fee_extra')
}
export type KidLink = { share_pct: number; active: boolean; team_id: string | null; birth_date: string | null; created_at?: string }
// ίδιος υπολογισμός με τη βάση (household_amount): κάθε παιδί πληρώνει την οριακή τιμή της θέσης του με την πολιτική της ομάδας του
export function monthlyAmount(s: Settings | null, h: Household, kids: KidLink[], teams: Team[], period = new Date()) {
  if (!s) return 0
  const pct = Number(s.month_pct?.[String(period.getMonth() + 1)] ?? 100)
  if (h.monthly_override != null) return Math.round(Number(h.monthly_override) * pct) / 100
  const team = (id: string | null) => teams.find((t) => t.id === id) || null
  const act = kids.filter((k) => k.active && Number(k.share_pct) > 0).sort((a, b) =>
    Number(team(b.team_id)?.fee_1 ?? s.fee_1) - Number(team(a.team_id)?.fee_1 ?? s.fee_1) || (a.birth_date || '9').localeCompare(b.birth_date || '9') || (a.created_at || '').localeCompare(b.created_at || ''))
  let total = 0
  act.forEach((k, i) => { const t = team(k.team_id); total += (policyTotal(s, i + 1, t) - policyTotal(s, i, t)) * Number(k.share_pct) / 100 })
  return Math.round(total * (1 - Number(h.discount_pct || 0) / 100) * pct) / 100
}
export const MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ']
export const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const firstOfMonth = (ym: string) => ym + '-01'
// δικαίωμα συμμετοχής: ιατρική & δελτίο σε ισχύ
export function eligibility(p: Pick<Player, 'medical_expiry' | 'card_expiry'>, injured = false) {
  const t = new Date().toISOString().slice(0, 10)
  const issues: string[] = []
  if (injured) issues.push('Τραυματίας')
  if (!p.medical_expiry) issues.push('Χωρίς ιατρική βεβαίωση')
  else if (p.medical_expiry < t) issues.push('Έληξε η ιατρική')
  if (p.card_expiry && p.card_expiry < t) issues.push('Έληξε το δελτίο')
  return { ok: issues.length === 0, issues }
}

export type Role = 'admin' | 'secretary' | 'coach' | 'parent' | 'pending'
export const ROLES: Record<string, string> = { admin: 'Διαχειριστής', secretary: 'Γραμματεία', coach: 'Προπονητής', parent: 'Γονέας', pending: 'Σε αναμονή' }
export type MetricDef = { id: number; name: string; unit: string | null; category: 'body' | 'physical' | 'technical' | 'behavior'; higher_better: boolean; decimals: number; min_value: number | null; max_value: number | null; sort: number; active: boolean }
export type PlayerMetric = { player_id: string; period: string; metric_id: number; value: number }
export type Evaluation = { player_id: string; period: string; comment: string | null }
export const CATEGORIES: Record<string, string> = { body: 'Σωματομετρικά', physical: 'Φυσική κατάσταση', technical: 'Τεχνική', behavior: 'Συμπεριφορά' }
export type Slot = { id: string; team_id: string; weekday: number; start_time: string; end_time: string | null; location: string | null; field_id?: string | null }
export const WEEKDAYS = ['', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή']
export type RecurringFee = { id: string; name: string; amount: number; per_child: boolean; months: number[] | null; team_id: string | null; active: boolean }
export type Registration = { id: string; created_at: string; status: string; child: Record<string, string>; guardians: Record<string, string>[]; consents: Record<string, boolean | string>; signature_path: string | null; files: { name: string; path: string; kind: string }[] | null; notes: string | null; player_id: string | null }
export const CONSENTS: { key: string; label: string; required: boolean }[] = [
  { key: 'data', label: 'Συγκατάθεση για την επεξεργασία των προσωπικών δεδομένων του αθλητή και των κηδεμόνων για τη λειτουργία της ακαδημίας (εγγραφή, επικοινωνία, οικονομικά).', required: true },
  { key: 'health', label: 'Συγκατάθεση για την τήρηση δεδομένων υγείας (ιατρική βεβαίωση, αλλεργίες, σημειώσεις υγείας).', required: true },
  { key: 'biometrics', label: 'Συγκατάθεση για την καταγραφή σωματομετρικών στοιχείων και αθλητικών επιδόσεων (ύψος, βάρος, τεστ φυσικής κατάστασης, αξιολογήσεις).', required: false },
  { key: 'media', label: 'Συγκατάθεση για τη λήψη και δημοσίευση φωτογραφιών/βίντεο από προπονήσεις και αγώνες στα μέσα του συλλόγου.', required: false },
]
export type EquipmentItem = { id: string; name: string; category: string | null; size: string | null; quantity: number; min_quantity: number; price: number | null; notes: string | null }
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

export async function openInjuries() {
  const { data } = await sb.from('injuries').select('player_id').is('returned_at', null)
  return new Set((data || []).map((x) => x.player_id as string))
}
export type Goal = { id: string; player_id: string; title: string; theme: string; description: string | null; target_date: string | null; progress: number; status: 'active' | 'achieved' | 'dropped'; created_at: string }
export const GOAL_THEMES = ['Τεχνική', 'Τακτική', 'Φυσική κατάσταση', 'Ψυχολογία / συμπεριφορά', 'Τερματοφύλακας']
export type Injury = { id: string; player_id: string; injury_date: string; type: string | null; body_part: string | null; severity: string | null; description: string | null; expected_return: string | null; returned_at: string | null }
export type Drill = { id: string; title: string; category: string; age_group: string | null; duration: number | null; players: string | null; equipment: string | null; description: string | null; coaching_points: string | null; media_url: string | null; image_url: string | null }
export const DRILL_CATS = ['Ζέσταμα', 'Τεχνική', 'Τακτική', 'Τελείωμα', 'Φυσική κατάσταση', 'Τερματοφύλακες', 'Παιχνίδι', 'Αποθεραπεία']
export type Field = { id: string; name: string; address: string | null; surface: string | null; notes: string | null; active: boolean }
export type Staff = { id: string; profile_id: string | null; full_name: string; role_title: string | null; phone: string | null; email: string | null; license: string | null; license_expiry: string | null; criminal_record_expiry: string | null; first_aid_expiry: string | null; medical_expiry: string | null; hourly_rate: number | null; monthly_salary: number | null; notes: string | null; active: boolean }
export type Announcement = { id: string; title: string; body: string | null; team_id: string | null; pinned: boolean; image_url: string | null; created_at: string }
export const DISCOUNT_CATS = ['Πολύτεκνοι', 'Τρίτεκνοι', 'Κοινωνικό τιμολόγιο', 'Αθλητική υποτροφία', 'Παιδί προσωπικού', 'Χορηγός', 'Άλλο']
export const daysTo = (d: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 864e5) : null)

// σύγκρουση γηπέδου: άλλη δραστηριότητα στο ίδιο γήπεδο που επικαλύπτεται χρονικά
export async function fieldConflicts(fieldId: string | null | undefined, startIso: string, endIso: string, excludeId?: string) {
  if (!fieldId) return [] as EventRow[]
  const dayStart = new Date(new Date(startIso).getTime() - 6 * 3600e3).toISOString(), dayEnd = new Date(new Date(endIso).getTime() + 6 * 3600e3).toISOString()
  const { data } = await sb.from('events').select('*').eq('field_id', fieldId).gte('starts_at', dayStart).lte('starts_at', dayEnd)
  const s = new Date(startIso).getTime(), e = new Date(endIso).getTime()
  return ((data || []) as EventRow[]).filter((x) => x.id !== excludeId && new Date(x.starts_at).getTime() < e && (x.end_at ? new Date(x.end_at).getTime() : new Date(x.starts_at).getTime() + 90 * 6e4) > s)
}
