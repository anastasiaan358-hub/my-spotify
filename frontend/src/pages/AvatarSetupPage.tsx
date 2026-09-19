import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile, updateProfile } from '../features/auth/api/authApi'
import { AVATAR_SETTING_KEY, getPresetAvatar, presetAvatars } from '../features/profile/model/avatars'
import { ApiError, getApiErrorMessage } from '../shared/api/client'
import { Brand } from '../shared/ui/Brand'

export function AvatarSetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const [selectedOverride, setSelectedOverride] = useState<string>()
  const selectedId = selectedOverride ?? getPresetAvatar(profile.data?.profile?.settings)?.id ?? ''

  const mutation = useMutation({
    mutationFn: () => updateProfile({
      settings: {
        ...(profile.data?.profile?.settings ?? {}),
        [AVATAR_SETTING_KEY]: selectedId,
      },
    }),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data)
      navigate('/profile', { replace: true })
    },
  })

  const errorMessage = mutation.error instanceof ApiError
    ? getApiErrorMessage(mutation.error.payload)
    : 'Не удалось сохранить аватар.'

  return (
    <main className="profile-setup-page">
      <header className="profile-setup-header">
        <Brand />
        <Link className="auth-page__back auth-page__back--static" to="/"><ArrowLeft size={18} /> На главную</Link>
      </header>
      <section className="avatar-setup" aria-labelledby="avatar-setup-heading">
        <div className="avatar-setup__intro">
          <span className="eyebrow">Шаг 03 / 03</span>
          <h1 id="avatar-setup-heading">Выберите аватар</h1>
          <p>{profile.data?.profile?.display_name ? `${profile.data.profile.display_name}, профиль почти готов.` : 'Профиль почти готов.'} Выберите изображение — его можно будет поменять позже.</p>
        </div>

        <div className="avatar-grid" role="group" aria-label="Доступные аватары">
          {presetAvatars.map((avatar, index) => {
            const isSelected = selectedId === avatar.id
            return (
              <button
                className={`avatar-option${isSelected ? ' avatar-option--selected' : ''}`}
                key={avatar.id}
                type="button"
                aria-label={`Выбрать ${avatar.label.toLowerCase()}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedOverride(avatar.id)}
              >
                <img src={avatar.src} alt="" />
                <span>{String(index + 1).padStart(2, '0')}</span>
                {isSelected ? <i aria-hidden="true"><Check size={18} /></i> : null}
              </button>
            )
          })}
        </div>

        {profile.isError ? <p className="form-error" role="alert">Не удалось загрузить профиль.</p> : null}
        {mutation.isError ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        <button className="primary-button avatar-setup__submit" type="button" disabled={!selectedId || mutation.isPending || profile.isLoading} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <LoaderCircle className="spin" size={19} /> : null}
          Сохранить профиль <ArrowRight size={17} />
        </button>
      </section>
    </main>
  )
}
