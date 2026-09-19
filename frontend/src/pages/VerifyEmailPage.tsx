import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { confirmEmail } from '../features/auth/api/authApi'
import { ApiError, getApiErrorMessage } from '../shared/api/client'
import { Brand } from '../shared/ui/Brand'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const requested = useRef(false)
  const mutation = useMutation({ mutationFn: confirmEmail })

  useEffect(() => {
    if (!token || requested.current) return
    requested.current = true
    mutation.mutate(token)
  }, [token, mutation])

  const errorMessage = mutation.error instanceof ApiError
    ? getApiErrorMessage(mutation.error.payload)
    : 'Не удалось подтвердить адрес. Попробуйте открыть ссылку ещё раз.'

  return (
    <main className="auth-page">
      <Link className="auth-page__back" to="/"><ArrowLeft size={18} /> На главную</Link>
      <div className="auth-card auth-card--status">
        <Brand />
        {!token || mutation.isError ? <CircleAlert className="auth-status-icon" size={44} strokeWidth={1.4} /> : null}
        {token && mutation.isPending ? <LoaderCircle className="auth-status-icon spin" size={44} strokeWidth={1.4} /> : null}
        {mutation.isSuccess ? <CircleCheck className="auth-status-icon" size={44} strokeWidth={1.4} /> : null}

        <div className="auth-card__heading">
          <span className="eyebrow">Шаг 02 / 03</span>
          <h1>{mutation.isSuccess ? 'Почта подтверждена' : token && !mutation.isError ? 'Проверяем ссылку' : 'Ссылка не сработала'}</h1>
          <p>
            {mutation.isSuccess
              ? 'Адрес подтверждён. Войдите в аккаунт и выберите аватар для завершения профиля.'
              : token && !mutation.isError
                ? 'Это займёт несколько секунд.'
                : token ? errorMessage : 'В ссылке отсутствует токен подтверждения.'}
          </p>
        </div>

        {mutation.isSuccess ? (
          <Link className="primary-button" to="/login" state={{ from: '/profile/setup', verified: true }}>
            Войти и выбрать аватар <ArrowRight size={17} />
          </Link>
        ) : null}
        {!token || mutation.isError ? <Link className="secondary-button auth-card__action" to="/register">Вернуться к регистрации</Link> : null}
      </div>
    </main>
  )
}
