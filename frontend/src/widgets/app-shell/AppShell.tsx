import { useQuery } from '@tanstack/react-query'
import { Bell, History, Home, Library, Search, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { getProfile } from '../../features/auth/api/authApi'
import { useSessionStore } from '../../features/auth/model/sessionStore'
import { VkDownloadProgress } from '../../features/downloads/ui/VkDownloadProgress'
import { PlayerBar } from '../../features/player/ui/PlayerBar'
import { getPresetAvatar } from '../../features/profile/model/avatars'
import { Brand } from '../../shared/ui/Brand'

const navigation = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/search', label: 'Поиск', icon: Search },
  { to: '/ancient-music', label: 'Древняя музыка', icon: History },
  { to: '/library', label: 'Моя медиатека', icon: Library },
]

export function AppShell() {
  const isAuthenticated = useSessionStore((state) => Boolean(state.accessToken))
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile, enabled: isAuthenticated })
  const avatar = getPresetAvatar(profile.data?.profile?.settings)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="main-nav" aria-label="Основная навигация">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
            >
              <Icon size={21} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__playlist">
          <span className="eyebrow">Плейлисты</span>
          <p>Здесь появятся ваши подборки после подключения API плейлистов.</p>
        </div>
      </aside>

      <div className="app-view">
        <header className="topbar">
          <div className="topbar__brand"><Brand /></div>
          <div className="topbar__actions">
            <button className="icon-button" type="button" aria-label="Уведомления"><Bell size={20} /></button>
            <NavLink
              className="account-link"
              to={isAuthenticated ? '/profile' : '/register'}
              aria-label={isAuthenticated ? 'Открыть профиль' : 'Создать аккаунт'}
            >
              {avatar ? <img className="account-link__avatar" src={avatar.src} alt="" /> : <UserRound size={18} />}
              <span>{isAuthenticated ? (profile.data?.profile?.display_name ?? 'Профиль') : 'Регистрация'}</span>
            </NavLink>
          </div>
        </header>
        <VkDownloadProgress />
        <main className="page"><Outlet /></main>
      </div>

      <PlayerBar />
    </div>
  )
}
