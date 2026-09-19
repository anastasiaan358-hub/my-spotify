import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { artists } from '../features/artists/model/artists'

export function ArtistsPage() {
  return (
    <div className="artists-page">
      <section className="artists-catalog" aria-labelledby="artists-heading">
        <div className="artists-catalog__meta">
          <span>ARCHIVE 1500 / COMPOSER INDEX</span>
          <span>{artists.length} КОМПОЗИТОРОВ</span>
        </div>

        <header className="artists-catalog__header">
          <div>
            <span className="mono-label">// НАЧАЛО СЕССИИ</span>
            <h1 id="artists-heading" aria-label="ВЫБЕРИТЕ КОМПОЗИТОРА">ВЫБЕРИТЕ<br />КОМПОЗИТОРА</h1>
          </div>
          <div className="artists-catalog__intro">
            <p>Двадцать авторов эпохи Возрождения.<br />Музыка и партитуры из открытых архивов.</p>
            <Link className="mono-action artists-atlas-link" to="/artists/atlas">Открыть атлас XVI века <ArrowUpRight size={16} /></Link>
            <Link className="mono-link" to="/"><ArrowLeft size={15} /> На главную</Link>
          </div>
        </header>

        <div className="artist-grid">
          {artists.map((artist, index) => (
            <article className="artist-card" key={artist.id} aria-label={`Композитор: ${artist.name}`}>
              <Link className="artist-card__link" to={`/artists/${artist.id}`} aria-label={`Открыть композитора ${artist.name}`}>
                <div className={`artist-card__portrait artist-card__portrait--${artist.variant}`}>
                  <span>ART/{String(index + 1).padStart(2, '0')}</span>
                  <strong aria-hidden="true">{artist.monogram}</strong>
                  <i aria-hidden="true" />
                </div>
                <div className="artist-card__body">
                  <span>{artist.genre}</span>
                  <div className="artist-card__title">
                    <h2>{artist.name}</h2>
                    <ArrowUpRight size={18} />
                  </div>
                  <p>{artist.origin} / {artist.year}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
