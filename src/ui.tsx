import { createContext, useContext, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Settings, Team } from './lib/supabase'
import { STATUS } from './lib/supabase'

export type Ctx = { settings: Settings | null; reloadSettings: () => void; toast: (m: string) => void; role: string; email: string; uid: string; teams: Team[]; reloadTeams: () => void; myTeams: string[]; isOffice: boolean; isCoach: boolean; isAdmin: boolean }
export const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

export function Modal({ title, onClose, children, foot, wide }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className={'modal' + (wide ? ' wide' : '')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="iconbtn" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export function PageHead({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return <div className="empty"><div className="big">{title}</div>{text && <div>{text}</div>}{children && <div style={{ marginTop: 14 }}>{children}</div>}</div>
}

export function TeamChip({ team }: { team?: Team | null }) {
  if (!team) return <span className="muted">Χωρίς ομάδα</span>
  return <span className="team-chip">{team.logo_url ? <img src={team.logo_url} alt="" /> : <span className="dot" style={{ background: team.color || 'var(--navy)' }} />}{team.name}</span>
}

export function StatusBadge({ status, due }: { status: string; due?: string | null }) {
  const over = (status === 'pending' || status === 'partial') && due && due < new Date().toISOString().slice(0, 10)
  return <span className={`badge ${over ? 'b-over' : 'b-' + status}`}>{over ? 'Ληξιπρόθεσμη' : STATUS[status]}</span>
}
