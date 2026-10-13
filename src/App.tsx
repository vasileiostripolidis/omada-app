import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, HeartHandshake, Shield, Wallet, CalendarDays, Award, Settings as Cog, LogOut, Menu, Activity, ClipboardList, Package } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { sb, BRAND, ROLES, type Settings, type Team } from './lib/supabase'
import { AppCtx, Modal } from './ui'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import Families from './pages/Families'
import FamilyDetail from './pages/FamilyDetail'
import Finance from './pages/Finance'
import Teams from './pages/Teams'
import Events from './pages/Events'
import Performance from './pages/Performance'
import Registrations from './pages/Registrations'
import Equipment from './pages/Equipment'
import Sponsors from './pages/Sponsors'
import SettingsPage from './pages/Settings'
import ParentApp from './pages/ParentApp'

type NavItem = { sec?: string; to: string; icon: typeof Users; label: string; short: string; roles: string[]; badge?: number }
const OFFICE = ['admin', 'secretary'], ALL = ['admin', 'secretary', 'coach']
const NAV: NavItem[] = [
  { sec: 'Γενικά', to: '/', icon: LayoutDashboard, label: 'Πίνακας ελέγχου', short: 'Αρχική', roles: ALL },
  { to: '/players', icon: Users, label: 'Αθλητές', short: 'Αθλητές', roles: ALL },
  { to: '/families', icon: HeartHandshake, label: 'Γονείς & Οικογένειες', short: 'Γονείς', roles: OFFICE },
  { to: '/registrations', icon: ClipboardList, label: 'Εγγραφές', short: 'Εγγραφές', roles: OFFICE },
  { to: '/teams', icon: Shield, label: 'Ομάδες', short: 'Ομάδες', roles: ALL },
  { sec: 'Αγωνιστικά', to: '/events', icon: CalendarDays, label: 'Πρόγραμμα & Παρουσίες', short: 'Πρόγραμμα', roles: ALL },
  { to: '/performance', icon: Activity, label: 'Επιδόσεις & Βιομετρικά', short: 'Επιδόσεις', roles: ALL },
  { sec: 'Οικονομικά', to: '/finance', icon: Wallet, label: 'Πληρωμές & Χρεώσεις', short: 'Ταμείο', roles: OFFICE },
  { to: '/sponsors', icon: Award, label: 'Χορηγοί', short: 'Χορηγοί', roles: OFFICE },
  { to: '/equipment', icon: Package, label: 'Αποθήκη εξοπλισμού', short: 'Αποθήκη', roles: OFFICE },
  { sec: 'Διαχείριση', to: '/settings', icon: Cog, label: 'Ρυθμίσεις', short: 'Ρυθμίσεις', roles: OFFICE },
]

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [isReg, setIsReg] = useState(window.location.hash.startsWith('#/register'))
  useEffect(() => { const f = () => setIsReg(window.location.hash.startsWith('#/register')); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  // Δημόσια φόρμα εγγραφής (χωρίς σύνδεση)
  if (isReg) return <Register />
  if (session === undefined) return null
  if (!session) return <Login />
  return <Shell email={session.user.email || ''} uid={session.user.id} />
}

function Shell({ email, uid }: { email: string; uid: string }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [myTeams, setMyTeams] = useState<string[]>([])
  const [role, setRole] = useState('')
  const [msg, setMsg] = useState('')
  const reloadSettings = () => { sb.from('club_settings').select('*').single().then(({ data }) => setSettings(data)) }
  const reloadTeams = () => { sb.from('teams').select('*').order('name').then(({ data }) => setTeams(data || [])) }
  useEffect(() => {
    sb.from('profiles').select('role').eq('id', uid).single().then(({ data }) => setRole(data?.role || 'pending'))
    sb.from('coach_teams').select('team_id').eq('profile_id', uid).then(({ data }) => setMyTeams((data || []).map((x) => x.team_id)))
    reloadSettings(); reloadTeams()
  }, [uid])
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3400) }

  if (!role) return null
  if (role === 'pending') return (
    <div className="login"><div className="art"><div><img src={BRAND + 'pss-logo.png'} alt="" /></div></div>
      <div style={{ alignSelf: 'center', justifySelf: 'center', maxWidth: 420, padding: 24 }}>
        <h1>Αναμονή έγκρισης</h1>
        <p className="muted" style={{ fontSize: 15 }}>Ο λογαριασμός {email} δημιουργήθηκε. Η γραμματεία του συλλόγου θα σου δώσει πρόσβαση σύντομα.</p>
        <button className="btn ghost" onClick={() => sb.auth.signOut()}>Αποσύνδεση</button>
      </div></div>
  )
  const ctx = { settings, reloadSettings, toast, role, email, uid, teams, reloadTeams, myTeams, isOffice: OFFICE.includes(role), isCoach: role === 'coach', isAdmin: role === 'admin' }
  return (
    <AppCtx.Provider value={ctx}>
      <HashRouter>
        {role === 'parent' ? <ParentApp /> : <Layout email={email} role={role} />}
        {msg && <div className="toast">{msg}</div>}
      </HashRouter>
    </AppCtx.Provider>
  )
}

function Layout({ email, role }: { email: string; role: string }) {
  const [more, setMore] = useState(false)
  const [newRegs, setNewRegs] = useState(0)
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0); setMore(false) }, [loc.pathname])
  useEffect(() => { if (OFFICE.includes(role)) sb.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'new').then(({ count }) => setNewRegs(count || 0)) }, [role, loc.pathname])
  const nav = NAV.filter((n) => n.roles.includes(role)).map((n) => n.to === '/registrations' ? { ...n, badge: newRegs } : n)
  const mobile = OFFICE.includes(role) ? ['/', '/players', '/families', '/finance'] : ['/', '/players', '/events', '/performance']
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><img src={BRAND + 'pss-logo.png'} alt="" /><div><div className="t1">Patras</div><div className="t2">Schools Soccer</div></div></div>
        {nav.map((n) => <div key={n.to}>{n.sec && <div className="navsec">{n.sec}</div>}
          <NavLink to={n.to} end={n.to === '/'} className="nav"><n.icon size={19} /><span className="grow">{n.label}</span>{!!n.badge && <span className="badge" style={{ background: 'var(--red)', color: '#fff' }}>{n.badge}</span>}</NavLink></div>)}
        <div className="user">
          <div style={{ padding: '0 12px 2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
          <div style={{ padding: '0 12px 8px', color: '#ff6b80', fontWeight: 700 }}>{ROLES[role]}</div>
          <button className="nav" onClick={() => sb.auth.signOut()}><LogOut size={18} />Αποσύνδεση</button>
        </div>
      </aside>
      <header className="topbar"><img src={BRAND + 'pss-logo.png'} alt="" /><div className="t1 grow">Patras Schools Soccer</div><span className="badge">{ROLES[role]}</span></header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/events" element={<Events />} />
          <Route path="/performance" element={<Performance />} />
          {OFFICE.includes(role) && <>
            <Route path="/families" element={<Families />} />
            <Route path="/families/:id" element={<FamilyDetail />} />
            <Route path="/registrations" element={<Registrations />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/sponsors" element={<Sponsors />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/settings" element={<SettingsPage />} />
          </>}
        </Routes>
      </main>
      <nav className="bottom">
        {nav.filter((n) => mobile.includes(n.to)).map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav"><n.icon size={21} />{n.short}</NavLink>)}
        <button className="nav" onClick={() => setMore(true)}><Menu size={21} />Περισσότερα</button>
      </nav>
      {more && <Modal title="Μενού" onClose={() => setMore(false)}>
        <div className="list">{nav.filter((n) => !mobile.includes(n.to)).map((n) =>
          <NavLink key={n.to} to={n.to} className="item" style={{ padding: '14px 4px' }}><n.icon size={20} /><b className="grow">{n.label}</b>{!!n.badge && <span className="badge b-bad">{n.badge}</span>}</NavLink>)}
          <button className="item" style={{ border: 0, background: 'none', padding: '14px 4px', fontSize: 15 }} onClick={() => sb.auth.signOut()}><LogOut size={20} /><b>Αποσύνδεση</b></button>
        </div>
      </Modal>}
    </div>
  )
}
