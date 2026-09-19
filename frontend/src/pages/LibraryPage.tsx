import { Library } from 'lucide-react'

export function LibraryPage() {
  return (
    <section className="simple-page">
      <span className="eyebrow">Коллекция</span>
      <h1>Моя медиатека</h1>
      <div className="empty-panel">
        <Library size={30} />
        <h2>Здесь пока тихо</h2>
        <p>Любимые треки, альбомы и плейлисты появятся после подключения API библиотеки.</p>
      </div>
    </section>
  )
}
