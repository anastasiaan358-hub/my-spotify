import { Search } from 'lucide-react'

export function SearchPage() {
  return (
    <section className="simple-page">
      <span className="eyebrow">Каталог</span>
      <h1>Поиск</h1>
      <label className="search-field">
        <Search size={21} />
        <input type="search" placeholder="Треки, исполнители или альбомы" aria-label="Поиск музыки" />
      </label>
      <div className="empty-panel">
        <Search size={30} />
        <h2>Начните с любимого исполнителя</h2>
        <p>Результаты появятся здесь после подключения поискового API.</p>
      </div>
    </section>
  )
}
