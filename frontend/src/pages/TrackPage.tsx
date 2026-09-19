import { ArrowLeft, Disc3, Download, ExternalLink, Music2, Play } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { start as startAudioContext } from 'tone'
import { getAlbum, getArtist, getTrack } from '../features/artists/model/artists'
import { usePlayerStore } from '../features/player/model/playerStore'

type TrackTab = 'notes' | 'biography'

export function TrackPage() {
  const { artistId, albumId, trackId } = useParams()
  const artist = getArtist(artistId)
  const album = getAlbum(artist, albumId)
  const track = getTrack(album, trackId)
  const [activeTab, setActiveTab] = useState<TrackTab>('notes')
  const setTrack = usePlayerStore((state) => state.setTrack)

  if (!artist || !album || !track) {
    return (
      <section className="simple-page catalog-missing">
        <span className="eyebrow">404 / TRACK</span>
        <h1>Трек не найден</h1>
        <Link className="secondary-button" to="/artists"><ArrowLeft size={16} /> К музыкантам</Link>
      </section>
    )
  }

  const playTrack = async () => {
    if (track.mediaType === 'midi') await startAudioContext()
    const [minutes, seconds] = track.duration.split(':').map(Number)
    setTrack({
      id: track.id,
      title: track.title,
      artist: artist.name,
      streamUrl: track.mediaUrl,
      mediaType: track.mediaType,
      durationMs: (minutes * 60 + seconds) * 1000,
    })
  }

  const catalogQuery = encodeURIComponent(`${track.title} ${artist.name}`)

  return (
    <div className="catalog-page track-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to={`/artists/${artist.id}/albums/${album.id}`}><ArrowLeft size={14} /> {album.title}</Link>
        <span>/</span>
        <span>{track.title}</span>
      </nav>

      <header className="track-profile">
        <div className="track-profile__number"><span>TRACK</span><strong>{String(track.number).padStart(2, '0')}</strong></div>
        <div className="track-profile__copy">
          <span className="mono-label">// {artist.name} / {album.title}</span>
          <h1>{track.title}</h1>
          <div className="track-profile__meta">
            <span>{track.duration}</span><span>{track.key}</span><span>{track.bpm} BPM</span><span>{album.year}</span><span>{track.qualityLabel}</span>
          </div>
          <button className="track-listen-button" type="button" onClick={playTrack}><Play size={16} fill="currentColor" /> Слушать произведение</button>
        </div>
        <Disc3 className="track-profile__disc" size={96} strokeWidth={.8} />
      </header>

      <section className="track-information">
        <div className="track-tabs" role="tablist" aria-label="Информация о треке">
          <button className={activeTab === 'notes' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeTab === 'notes'} onClick={() => setActiveTab('notes')}><Music2 size={16} /> Ноты</button>
          <button className={activeTab === 'biography' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeTab === 'biography'} onClick={() => setActiveTab('biography')}>Биография композитора</button>
        </div>

        {activeTab === 'notes' ? (
          <div className="notation-panel" role="tabpanel" aria-label="Ноты">
            <div className="notation-panel__meta"><span>ТОНАЛЬНОСТЬ <strong>{track.key}</strong></span><span>ТЕМП <strong>{track.bpm} BPM</strong></span><span>РАЗМЕР <strong>{track.meter}</strong></span></div>
            <div className="score-toolbar">
              <div>
                <span className="mono-label">// ORIGINAL SCORE</span>
                <p>{track.sourceName} / {track.license}</p>
              </div>
              <div className="score-toolbar__actions">
                <a href={track.scoreUrl} download><Download size={15} /> Скачать PDF</a>
                <a href={track.sourceUrl} target="_blank" rel="noreferrer">Файл и лицензия <ExternalLink size={15} /></a>
                <a href={`https://imslp.org/index.php?search=${catalogQuery}`} target="_blank" rel="noreferrer">IMSLP <ExternalLink size={15} /></a>
                <a href={`https://rism.online/search?mode=sources&q=${catalogQuery}`} target="_blank" rel="noreferrer">RISM <ExternalLink size={15} /></a>
                <a href={`https://rusneb.ru/search/?q=${catalogQuery}`} target="_blank" rel="noreferrer">НЭБ <ExternalLink size={15} /></a>
              </div>
            </div>
            <a className="score-preview" href={track.scoreUrl} target="_blank" rel="noreferrer" title={`Партитура ${track.title}`}>
              <img src={`/classical/previews/${artist.id}.png`} alt={`Первая страница партитуры ${track.title}`} />
            </a>
          </div>
        ) : (
          <article className="biography-panel" role="tabpanel" aria-label="Биография композитора">
            <div className={`biography-panel__mark artist-card__portrait artist-card__portrait--${artist.variant}`}><strong>{artist.monogram}</strong><i aria-hidden="true" /></div>
            <div>
              <span className="mono-label">// COMPOSER BIOGRAPHY</span>
              <h2>{artist.name}</h2>
              {artist.biography.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <dl><div><dt>Школа</dt><dd>{artist.genre}</dd></div><div><dt>Место</dt><dd>{artist.origin}</dd></div><div><dt>Годы</dt><dd>{artist.year}</dd></div></dl>
            </div>
          </article>
        )}
      </section>
    </div>
  )
}
