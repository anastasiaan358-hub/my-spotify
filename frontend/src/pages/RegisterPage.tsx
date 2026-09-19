import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, LoaderCircle, MailCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { register } from '../features/auth/api/authApi'
import { ApiError, getApiErrorMessage } from '../shared/api/client'
import { Brand } from '../shared/ui/Brand'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [localError, setLocalError] = useState('')
  const mutation = useMutation({ mutationFn: register })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== passwordConfirm) {
      setLocalError('Пароли не совпадают.')
      return
    }
    setLocalError('')
    mutation.mutate({ email, password, display_name: displayName })
  }

  if (mutation.isSuccess) {
    return (
      <main className="auth-page">
        <Link className="auth-page__back" to="/"><ArrowLeft size={18} /> На главную</Link>
        <div className="auth-card auth-card--status">
          <Brand />
          <MailCheck className="auth-status-icon" size={44} strokeWidth={1.4} />
          <div className="auth-card__heading">
            <span className="eyebrow">Шаг 02 / 03</span>
            <h1>Проверьте почту</h1>
            <p>Мы отправили ссылку подтверждения на <strong>{mutation.data.email}</strong>. Перейдите по ней, чтобы продолжить создание профиля.</p>
          </div>
          <Link className="secondary-button auth-card__action" to="/login">
            Уже подтвердили? Войти <ArrowRight size={17} />
          </Link>
        </div>
      </main>
    )
  }

  const errorMessage = localError || (mutation.error instanceof ApiError
    ? getApiErrorMessage(mutation.error.payload)
    : mutation.isError ? 'Не удалось связаться с сервером.' : '')

  return (
    <main className="auth-page">
      <Link className="auth-page__back" to="/"><ArrowLeft size={18} /> На главную</Link>
      <div className="auth-card">
        <Brand />
        <div className="auth-card__heading">
          <span className="eyebrow">Шаг 01 / 03</span>
          <h1>Создайте аккаунт</h1>
          <p>Почта нужна для подтверждения, ник будет виден в вашем профиле.</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label>
            Электронная почта
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            Ник
            <input type="text" autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Как вас называть" maxLength={120} required />
          </label>
          <label>
            Придумайте пароль
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 8 символов" minLength={8} required />
          </label>
          <label>
            Повторите пароль
            <input type="password" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Введите пароль ещё раз" minLength={8} required />
          </label>
          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="spin" size={19} /> : null}
            Зарегистрироваться
          </button>
        </form>
        <p className="auth-card__footer">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </div>
    </main>
  )
}
