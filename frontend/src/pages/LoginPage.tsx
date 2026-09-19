import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../features/auth/api/authApi'
import { useSessionStore } from '../features/auth/model/sessionStore'
import { ApiError, getApiErrorMessage } from '../shared/api/client'
import { Brand } from '../shared/ui/Brand'

function getDeviceFingerprint() {
  const key = 'my-spotify-device-id'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const value = crypto.randomUUID()
  window.localStorage.setItem(key, value)
  return value
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setTokens = useSessionStore((state) => state.setTokens)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const routeState = location.state as { from?: string; verified?: boolean } | null

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (tokens) => {
      setTokens(tokens)
      const destination = routeState?.from || '/'
      navigate(destination, { replace: true })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      email,
      password,
      device: {
        fingerprint: getDeviceFingerprint(),
        kind: 'web',
        name: navigator.platform || 'Web browser',
        app_version: '0.1.0',
      },
    })
  }

  const errorMessage = mutation.error instanceof ApiError
    ? getApiErrorMessage(mutation.error.payload)
    : 'Не удалось связаться с сервером.'

  return (
    <main className="auth-page">
      <Link className="auth-page__back" to="/"><ArrowLeft size={18} /> На главную</Link>
      <div className="auth-card">
        <Brand />
        <div className="auth-card__heading">
          <span className="eyebrow">С возвращением</span>
          <h1>Войдите в аккаунт</h1>
          <p>{routeState?.verified ? 'Почта подтверждена. Войдите, чтобы выбрать аватар.' : 'Ваша музыка продолжится с того же места.'}</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
          <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" required /></label>
          {mutation.isError && <p className="form-error" role="alert">{errorMessage}</p>}
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="spin" size={19} /> : null} Войти
          </button>
        </form>
        <p className="auth-card__footer">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
      </div>
    </main>
  )
}
