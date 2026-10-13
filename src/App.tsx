import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, HeartHandshake, Shield, Wallet, CalendarDays, Award, Settings as Cog, LogOut, Menu } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { sb, BRAND, type Settings, type Team } from './lib/supabase'
import { AppCtx, Modal } from './ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import Families from './pages/Families'
import FamilyDetail from './pages/FamilyDetail'
import Finance from './pages/Finance'
import Teams from './pages/Teams'
import Events from './pages/Events'
import Sponsors from './pages/Sponsors'
import SettingsPage from './pages/Settings'

const NAV = [
  { sec: 'Γενικά', to: '/', icon: LayoutDashboard, label: 'Πίνακας ελέγχου', short: 'Αρχική' },
  { to: '/players', icon: Users, label: 'Αθλητές', short: 'Αθλητές' },
  { to: '/families', icon: HeartHandshake, label: 'Γονείς & Οικογένειες', short: 'Γονείς' },
  { to: '/teams', icon: Shield, label: 'Ομάδες', short: 'Ομάδες' },
  { sec: 'Οικονομικά', to: '/finance', icon: Wallet, label: 'Πληρωμές & Χρεώσεις', short: 'Ταμείο' },
  { to: '/sponsors', icon: Award, label: 'Χορηγοί', short: 'Χορηγοί' },
  { sec: 'Αγωνιστικά', to: '/events', icon: CalendarDays, label: 'Αγώνες & Προπονήσεις', short: 'Αγώνες' },
  { sec: 'Διαχείριση', to: '/settings', icon: Cog, label: 'Ρυθμίσεις', short: 'Ρυθμίσεις' },
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
  const [teams, setTeams] = useState<Team[]>([])
  const [role, setRole] = useState('')
  const [msg, setMsg] = useState('')
  const reloadSettings = () => { sb.from('club_settings').select('*').single().then(({ data }) => setSettings(data)) }
  const reloadTeams = () => { sb.from('teams').select('*').order('name').then(({ data }) => setTeams(data || [])) }
  useEffect(() => {
    sb.from('profiles').select('role').eq('id', uid).single().then(({ data }) => setRole(data?.role || 'pending'))
    reloadSettings(); reloadTeams()
  }, [uid])
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3200) }

  if (!role) return null
  if (role === 'pending') return (
    <div className="login"><div className="art"><div><img src={BRAND + 'pss-logo.png'} alt="" /></div></div>
      <div style={{ alignSelf: 'center', justifySelf: 'center', maxWidth: 420, padding: 24 }}>
        <h1>Αναμονή έγκρισης</h1>
        <p className="muted" style={{ fontSize: 15 }}>Ο λογαριασμός {email} δημιουργήθηκε. Ο διαχειριστής του συλλόγου πρέπει να σε εγκρίνει από τις Ρυθμίσεις.</p>
        <button className="btn ghost" onClick={() => sb.auth.signOut()}>Αποσύνδεση</button>
      </div></div>
  )

  return (
    <AppCtx.Provider value={{ settings, reloadSettings, toast, role, email, teams, reloadTeams }}>
      <HashRouter>
        <Layout email={email} />
        {msg && <div className="toast">{msg}</div>}
      </HashRouter>
    </AppCtx.Provider>
  )
}

function Layout({ email }: { email: string }) {
  const [more, setMore] = useState(false)
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0); setMore(false) }, [loc.pathname])
  const mobile = ['/', '/players', '/families', '/finance']
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><img src={BRAND + 'pss-logo.png'} alt="" /><div><div className="t1">Patras</div><div className="t2">Schools Soccer</div></div></div>
        {NAV.map((n) => <div key={n.to}>{n.sec && <div className="navsec">{n.sec}</div>}
          <NavLink to={n.to} end={n.to === '/'} className="nav"><n.icon size={19} />{n.label}</NavLink></div>)}
        <div className="user">
          <div style={{ padding: '0 12px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
          <button className="nav" onClick={() => sb.auth.signOut()}><LogOut size={18} />Αποσύνδεση</button>
        </div>
      </aside>
      <header className="topbar"><img src={BRAND + 'pss-logo.png'} alt="" /><div className="t1 grow">Patras Schools Soccer</div></header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/families" element={<Families />} />
          <Route path="/families/:id" element={<FamilyDetail />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/events" element={<Events />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="bottom">
        {NAV.filter((n) => mobile.includes(n.to)).map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav"><n.icon size={21} />{n.short}</NavLink>)}
        <button className="nav" onClick={() => setMore(true)}><Menu size={21} />Περισσότερα</button>
      </nav>
      {more && <Modal title="Μενού" onClose={() => setMore(false)}>
        <div className="list">{NAV.filter((n) => !mobile.includes(n.to)).map((n) =>
          <NavLink key={n.to} to={n.to} className="item" style={{ padding: '14px 4px' }}><n.icon size={20} /><b>{n.label}</b></NavLink>)}
          <button className="item" style={{ border: 0, background: 'none', padding: '14px 4px', fontSize: 15 }} onClick={() => sb.auth.signOut()}><LogOut size={20} /><b>Αποσύνδεση</b></button>
        </div>
      </Modal>}
    </div>
  )
}
