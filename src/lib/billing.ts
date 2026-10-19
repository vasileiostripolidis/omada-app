import { sb } from './supabase'
import { saveBase64 } from './native'

type Res = { pdf?: string; emailed?: boolean; error?: string; sent?: number; skipped?: number; total?: number; errors?: string[] }

async function call(body: Record<string, unknown>): Promise<Res> {
  const { data, error } = await sb.functions.invoke('billing', { body })
  if (error) {
    let msg = error.message
    try { msg = (await (error as { context?: Response }).context?.json())?.error || msg } catch { /* */ }
    throw new Error(msg)
  }
  return data as Res
}

export function downloadPdf(b64: string, filename: string) { return saveBase64(b64, filename) }

export const statement = (household_id: string, send: boolean, reminder = false) => call({ action: 'statement', household_id, send, reminder })
export const receipt = (payment_id: string, send: boolean) => call({ action: 'receipt', payment_id, send })
export const reminders = () => call({ action: 'reminders' })
export const announce = (to: string[], subject: string, html: string) => call({ action: 'email', to, subject, html })
