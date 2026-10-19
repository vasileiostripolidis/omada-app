import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { isNative, platform } from './lib/native'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

if (isNative()) {
  // Εφαρμογή iPhone/iPad/Android
  document.documentElement.classList.add('native', platform())
  ;(async () => {
    const [{ StatusBar, Style }, { SplashScreen }, { App: CapApp }] = await Promise.all([import('@capacitor/status-bar'), import('@capacitor/splash-screen'), import('@capacitor/app')])
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    setTimeout(() => SplashScreen.hide().catch(() => {}), 300)
    // Android: το κουμπί «πίσω» πηγαίνει στην προηγούμενη οθόνη αντί να κλείνει την εφαρμογή
    CapApp.addListener('backButton', ({ canGoBack }) => { if (canGoBack) window.history.back(); else CapApp.minimizeApp() })
  })()
} else if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js')
