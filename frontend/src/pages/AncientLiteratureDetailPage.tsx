import { ArrowLeft, ArrowUpRight, BookOpenText, FileText, Languages, LibraryBig, ScrollText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ancientLiteratureByWorkId } from '../features/ancient-music/model/ancientLiteratureCatalog'

export function AncientLiteratureDetailPage() {
  const { workId } = useParams()
  const record = workId ? ancientLiteratureByWorkId.get(workId) : undefined

  if (!record) {
    return (
      <section className="simple-page catalog-missing">
        <span className="eyebrow">404 / LITERATURE</span>
        <h1>История текста не найдена</h1>
        <Link className="secondary-button" to="/ancient-music"><ArrowLeft size={16} /> К древней музыке</Link>
      </section>
    )
  }

  return (
    <div className="literature-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to="/ancient-music"><ArrowLeft size={14} /> К древней музыке</Link>
        <span>/</span>
        <span>В литературе</span>
      </nav>

      <header className="literature-hero">
        <div className="literature-hero__mark" aria-hidden="true"><BookOpenText size={76} strokeWidth={1} /></div>
        <div>
          <span className="mono-label">// TEXT HISTORY / {record.genre}</span>
          <h1>{record.title}</h1>
          {record.originalTitle && <strong>{record.originalTitle}</strong>}
          <p>{record.description}</p>
        </div>
      </header>

      <section className="literature-facts" aria-label="Паспорт литературного памятника">
        <div><Languages size={18} /><span>Язык</span><strong>{record.language}</strong></div>
        <div><ScrollText size={18} /><span>Жанр</span><strong>{record.genre}</strong></div>
        <div><LibraryBig size={18} /><span>Традиция</span><strong>{record.tradition} · {record.place}</strong></div>
        <div><FileText size={18} /><span>Дата / автор</span><strong>{record.date} · {record.author}</strong></div>
      </section>

      <section className="literature-section literature-relation" aria-labelledby="literature-relation-heading">
        <header>
          <span className="mono-label">// WORDS ↔ MUSIC</span>
          <h2 id="literature-relation-heading">Как текст связан с музыкой</h2>
        </header>
        <div>
          <p>{record.relationship}</p>
          <aside>
            <span>Материальный носитель</span>
            <strong>{record.manuscript}</strong>
          </aside>
        </div>
      </section>

      <section className="literature-section" aria-labelledby="literature-survival-heading">
        <header>
          <span className="mono-label">// SURVIVAL / TRANSMISSION</span>
          <h2 id="literature-survival-heading">Что сохранилось</h2>
        </header>
        <p className="literature-section__lead">{record.survival}</p>
      </section>

      <section className="literature-section" aria-labelledby="literature-history-heading">
        <header>
          <span className="mono-label">// COMPLETE PATH</span>
          <h2 id="literature-history-heading">История текста</h2>
        </header>
        <ol className="literature-timeline">
          {record.history.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="literature-section" aria-labelledby="literature-themes-heading">
        <header>
          <span className="mono-label">// READING MAP</span>
          <h2 id="literature-themes-heading">О чём читать текст</h2>
        </header>
        <div className="literature-themes">
          {record.themes.map((theme, index) => <div key={theme}><span>{String(index + 1).padStart(2, '0')}</span><strong>{theme}</strong></div>)}
        </div>
      </section>

      <section className="literature-section literature-sources" aria-labelledby="literature-sources-heading">
        <header>
          <span className="mono-label">// TEXT / OBJECT / SCHOLARSHIP</span>
          <h2 id="literature-sources-heading">Текст и исследования</h2>
        </header>
        <div>
          {record.sources.map((source, index) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${source.label}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><small>{source.kind}</small><strong>{source.label}</strong><p>{source.reference}</p></div>
              <ArrowUpRight size={18} />
            </a>
          ))}
        </div>
      </section>

      <footer className="literature-method-note">
        <BookOpenText size={19} />
        <p>Раздел описывает подтверждённый древний текст, его носитель и передачу. Он не подменяет утраченные слова современными стихами и не выдаёт реконструированную мелодию за единственное возможное древнее звучание.</p>
      </footer>
    </div>
  )
}
