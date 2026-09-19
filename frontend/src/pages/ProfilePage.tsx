import { useQuery } from '@tanstack/react-query'
import { LogOut, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile } from '../features/auth/api/authApi'
import { useSessionStore } from '../features/auth/model/sessionStore'
import { getPresetAvatar } from '../features/profile/model/avatars'
import { NicknameStickerPicker } from '../features/profile/ui/NicknameStickerPicker'

export function ProfilePage() {
  const navigate = useNavigate()
  const clearSession = useSessionStore((state) => state.clearSession)
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const avatar = getPresetAvatar(profile.data?.profile?.settings)

  function signOut() {
    clearSession()
    navigate('/login')
  }

  return (
    <section className="simple-page">
      <span className="eyebrow">Аккаунт</span>
      <h1>Профиль</h1>
      <div className="profile-card">
        <div className="profile-card__avatar">
          {avatar ? <img src={avatar.src} alt="Аватар профиля" /> : <UserRound size={30} />}
        </div>
        <div className="profile-card__identity">
          <div className="profile-card__name">
            <strong>{profile.data?.profile?.display_name ?? (profile.isLoading ? 'Загрузка…' : 'Пользователь')}</strong>
            {!profile.isLoading && !profile.isError ? <NicknameStickerPicker settings={profile.data?.profile?.settings} /> : null}
          </div>
          <span>{profile.data?.email ?? (profile.isError ? 'Не удалось загрузить профиль' : '')}</span>
        </div>
        <div className="profile-card__actions">
          <Link className="secondary-button" to="/profile/setup">Сменить аватар</Link>
          <button className="secondary-button" type="button" onClick={signOut}><LogOut size={17} /> Выйти</button>
        </div>
      </div>
    </section>
  )
}
