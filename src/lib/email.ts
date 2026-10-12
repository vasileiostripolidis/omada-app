import { sb } from './supabase'

export type Attachment = { filename: string; content: string }

// Αποστολή μέσω της edge function "send-email" (Resend)
export async function sendEmail(opts: { to: string; subject: string; html: string; attachments?: Attachment[]; player_id?: string; kind?: string }) {
  const { data, error } = await sb.functions.invoke('send-email', { body: opts })
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Αποτυχία αποστολής')
  return data
}
