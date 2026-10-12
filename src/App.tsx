import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Home, Users, Shield, Receipt, CalendarDays, Settings as Cog, LogOut } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { sb, type Settings } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import Teams from './pages/Teams'
import Charges from './pages/Charges'
import Events from './pages/Events'
import SettingsPage from './pages/Settings'

type Ctx = { settings: Settings | null; reloadSettings: () => void; toast: (m: string) => void; role: string; email: string }
const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

const NAV = [
  { to: '/', icon: Home, label: 'Αρχική' },
  { to: '/players', icon: Users, label: 'Παίκτες' },
  { to: '/teams', icon: Shield, label: 'Ομάδες' },
  { to: '/charges', icon: Receipt, label: 'Χρεώσεις' },
  { to: '/events', icon: CalendarDays, label: 'Αγώνες' },
  { to: '/settings', icon: Cog, label: 'Ρυθμίσεις' },
]

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return null
  if (!session) return <Login />
  return <Shell email={session.user.email || ''} uid={session.user.id} />
}

function Shell({ email, uid }: { email: string; uid: string }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [role, setRole] = useState<string>('')
  const [msg, setMsg] = useState('')
  const reloadSettings = () => sb.from('club_settings').select('*').single().then(({ data }) => {
    setSettings(data)
    if (data?.primary_color) document.documentElement.style.setProperty('--brand', data.primary_color)
  })
  useEffect(() => {
    sb.from('profiles').select('role').eq('id', uid).single().then(({ data }) => setRole(data?.role || 'pending'))
    reloadSettings()
  }, [uid])
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2600) }

  if (!role) return null
  if (role === 'pending') return (
    <div className="login"><div className="card" style={{ maxWidth: 420 }}>
      <h2>Αναμονή έγκρισης</h2>
      <p className="muted">Ο λογαριασμός {email} δημιουργήθηκε. Ο διαχειριστής του συλλόγου πρέπει να σε εγκρίνει από τις Ρυθμίσεις.</p>
      <button className="btn ghost" onClick={() => sb.auth.signOut()}>Αποσύνδεση</button>
    </div></div>
  )

  return (
    <AppCtx.Provider value={{ settings, reloadSettings, toast, role, email }}>
      <HashRouter>
        <div className="app">
          <aside className="side">
            <div className="logo">
              {settings?.logo_url ? <img src={settings.logo_url} className="avatar" style={{ width: 34, height: 34 }} /> : '⚽'}
              <span>{settings?.club_name || 'Ομάδα'}</span>
            </div>
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end className="nav"><n.icon size={19} />{n.label}</NavLink>)}
            <div style={{ flex: 1 }} />
            <button className="nav" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => sb.auth.signOut()}><LogOut size={19} />Αποσύνδεση</button>
          </aside>
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/players" element={<Players />} />
              <Route path="/players/:id" element={<PlayerDetail />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/charges" element={<Charges />} />
              <Route path="/events" element={<Events />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <nav className="bottom">
            {NAV.slice(0, 5).map((n) => <NavLink key={n.to} to={n.to} end className="nav"><n.icon size={21} />{n.label}</NavLink>)}
            <NavLink to="/settings" className="nav"><Cog size={21} />Ρυθμ.</NavLink>
          </nav>
        </div>
        {msg && <div className="toast">{msg}</div>}
      </HashRouter>
    </AppCtx.Provider>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>{title}</h2><button className="btn ghost sm" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  )
}
