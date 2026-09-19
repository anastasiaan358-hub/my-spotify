import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>Страница не найдена</h1>
      <p>Похоже, эта композиция закончилась раньше времени.</p>
      <Link className="primary-button" to="/">Вернуться на главную</Link>
    </main>
  )
}
