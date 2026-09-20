import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BookOpenText, Clock3, Disc3, Play, Search, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { YouTubePlayerPanel } from '../features/artists/ui/YouTubePlayerPanel'
import type { YouTubeWork } from '../features/artists/model/youtubeCatalog'
import {
  historyCollections,
  musicHistoryEras,
  musicHistorySources,
  musicHistoryStreamLabels,
  uniqueMusicHistoryGenreCount,
} from '../features/music-history/model/musicHistory'
import type { MusicHistoryStream } from '../features/music-history/model/musicHistory'

type StreamFilter = 'all' | MusicHistoryStream

interface HistoryListeningEntry {
  title: string
  artist: string
  youtubeUrl: string
  youtubeTitle: string
  channel: string
  durationSeconds?: number | null
  playbackStatus: 'playable'
  playableInEmbed: true
  verifiedAt: string
}

interface HistoryListeningCatalog {
  works: Record<string, HistoryListeningEntry | null>
}

const streamFilters = Object.entries(musicHistoryStreamLabels) as Array<[MusicHistoryStream, string]>

export function MusicHistoryPage() {
  const [query, setQuery] = useState('')
  const [stream, setStream] = useState<StreamFilter>('all')
  const [listeningCatalog, setListeningCatalog] = useState<HistoryListeningCatalog>({ works: {} })
  const [selectedVideo, setSelectedVideo] = useState<YouTubeWork | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')

  useEffect(() => {
    let cancelled = false
    void fetch('/classical/catalog/history-listening.json')
      .then((response) => {
        if (!response.ok) throw new Error(`History listening catalog ${response.status}`)
        return response.json() as Promise<HistoryListeningCatalog>
      })
      .then((catalog) => { if (!cancelled) setListeningCatalog(catalog) })
      .catch(() => { if (!cancelled) setListeningCatalog({ works: {} }) })
    return () => { cancelled = true }
  }, [])

  const openListening = (artist: string, work: string) => {
    const catalogEntry = listeningCatalog.works[`${artist} — ${work}`]
    if (!catalogEntry) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${work}`)}`, '_blank', 'noopener,noreferrer')
      return
    }
    setSelectedVideo({
      ...catalogEntry,
      key: `${artist} — ${work}`,
      confidence: 'editorial-search',
    })
  }

  const visibleEras = useMemo(() => musicHistoryEras.filter((era) => {
    const belongsToStream = stream === 'all' || era.streams.includes(stream)
    const haystack = [
      era.title,
      era.englishTitle,
      era.years,
      era.description,
      era.context,
      era.landmark,
      ...era.genres,
      ...era.figures,
    ].join(' ').toLocaleLowerCase('ru')
    return belongsToStream && (!normalizedQuery || haystack.includes(normalizedQuery))
  }), [normalizedQuery, stream])

  const visibleCollections = useMemo(() => historyCollections.filter((collection) => {
    const belongsToStream = stream === 'all' || collection.stream === stream
    const haystack = [
      collection.title,
      collection.caption,
      collection.description,
      ...collection.entries.flatMap((entry) => [entry.artist, entry.work, entry.year]),
    ].join(' ').toLocaleLowerCase('ru')
    return belongsToStream && (!normalizedQuery || haystack.includes(normalizedQuery))
  }), [normalizedQuery, stream])

  return (
    <div className="history-page">
      <header className="history-hero">
        <div className="history-hero__main">
          <Link className="history-back" to="/"><ArrowLeft size={14} /> На главную</Link>
          <span className="mono-label">// GLOBAL MUSIC MAP / ORIGINS—1989</span>
          <h1 aria-label="ИСТОРИЯ МУЗЫКИ">ИСТОРИЯ<br />МУЗЫКИ</h1>
        </div>
        <div className="history-hero__summary">
          <p>Рабочая карта эпох и жанров от первых нотированных памятников до 31 декабря 1989 года. Академическая, народная, духовная и популярная музыка показаны как параллельные ветви.</p>
          <dl>
            <div><dt>Эпохи</dt><dd>{musicHistoryEras.length}</dd></div>
            <div><dt>Жанры</dt><dd>{uniqueMusicHistoryGenreCount}</dd></div>
            <div><dt>Подборки</dt><dd>{historyCollections.length}</dd></div>
            <div><dt>Граница</dt><dd>1989</dd></div>
          </dl>
        </div>
      </header>

      <section className="history-principle" aria-labelledby="history-principle-heading">
        <div className="history-principle__icon"><Disc3 size={42} strokeWidth={1} /></div>
        <div>
          <span className="mono-label">00 / ПРИНЦИП КАРТЫ</span>
          <h2 id="history-principle-heading">НЕ ОДНА ЛИНИЯ,<br />А НЕСКОЛЬКО СЦЕН</h2>
          <p>Границы эпох приблизительны и намеренно пересекаются. В XX веке концертная композиция, джаз, фольклор, клубная и массовая музыка развиваются одновременно и влияют друг на друга.</p>
        </div>
        <ol>
          <li><span>01</span> Сначала исторический контекст</li>
          <li><span>02</span> Затем жанры и ключевые фигуры</li>
          <li><span>03</span> После — короткий маршрут прослушивания</li>
        </ol>
      </section>

      <Link className="history-folk-gateway" to="/folk-music">
        <Waves size={34} strokeWidth={1} />
        <div><span className="mono-label">НОВАЯ ВЕТВЬ / LIVING TRADITIONS</span><strong>Народная музыка</strong><p>Карельская руническая песня и ещё 27 устных, эпических, обрядовых и инструментальных традиций.</p></div>
        <span>Открыть отдельный каталог <ArrowUpRight size={17} /></span>
      </Link>

      <section className="history-browser" aria-labelledby="history-browser-heading">
        <header className="history-section-heading">
          <div>
            <span className="mono-label">01 / CHRONOLOGY</span>
            <h2 id="history-browser-heading">ЭПОХИ И ЖАНРЫ</h2>
          </div>
          <p>{visibleEras.length} из {musicHistoryEras.length} эпох показано. Поиск работает по жанру, имени, произведению и историческому периоду.</p>
        </header>

        <div className="history-controls">
          <label className="history-search">
            <Search size={16} />
            <span>Поиск</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например: мотет, блюз, Шёнберг, хаус"
            />
          </label>
          <div className="history-streams" aria-label="Фильтр по музыкальной ветви">
            <button type="button" className={stream === 'all' ? 'is-active' : ''} aria-pressed={stream === 'all'} onClick={() => setStream('all')}>Все ветви</button>
            {streamFilters.map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={stream === value ? 'is-active' : ''}
                aria-pressed={stream === value}
                onClick={() => setStream(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="history-era-list">
          {visibleEras.map((era) => (
            <article className="history-era" id={era.id} key={era.id}>
              <div className="history-era__index"><i /><span>{era.number}</span></div>
              <div className="history-era__identity">
                <span>{era.englishTitle}</span>
                <time>{era.years}</time>
                <h3>{era.title}</h3>
                <p>{era.description}</p>
                <div className="history-era__genres">
                  {era.genres.map((genre) => <button type="button" key={genre} onClick={() => setQuery(genre)}>{genre}</button>)}
                </div>
              </div>
              <div className="history-era__detail">
                <p>{era.context}</p>
                <dl>
                  <div><dt>Ключевые фигуры</dt><dd>{era.figures.join(' / ')}</dd></div>
                  <div><dt>Точка перехода</dt><dd>{era.landmark}</dd></div>
                  <div><dt>Ветви</dt><dd>{era.streams.map((value) => musicHistoryStreamLabels[value]).join(' / ')}</dd></div>
                </dl>
                {era.route && <Link to={era.route}>Открыть наполненный каталог <ArrowUpRight size={15} /></Link>}
              </div>
            </article>
          ))}
          {visibleEras.length === 0 && <p className="history-empty">По этому запросу эпоха не найдена. Попробуйте название жанра или автора.</p>}
        </div>
      </section>

      <section className="history-collections" aria-labelledby="history-collections-heading">
        <header className="history-section-heading">
          <div>
            <span className="mono-label">02 / LISTENING ROUTES</span>
            <h2 id="history-collections-heading">ПОДБОРКИ</h2>
          </div>
          <p>Короткие маршруты по четырём опорным записям или сочинениям. Даты относятся к созданию либо первой публикации указанной версии.</p>
        </header>
        <div className="history-collection-grid">
          {visibleCollections.map((collection) => (
            <article className="history-collection" key={collection.id}>
              <header>
                <span>{collection.number}</span>
                <i>{musicHistoryStreamLabels[collection.stream]}</i>
              </header>
              <div className="history-collection__title">
                <small>{collection.caption}</small>
                <h3>{collection.title}</h3>
                <p>{collection.description}</p>
              </div>
              <ol className="history-collection__listening">
                {collection.entries.map((entry, index) => (
                  <li key={`${entry.artist}-${entry.work}`}>
                    <button type="button" onClick={() => openListening(entry.artist, entry.work)} aria-label={`Слушать ${entry.work} — ${entry.artist}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div><strong>{entry.work}</strong><small>{entry.artist}</small></div>
                      <time>{entry.year}</time>
                      <i><Play size={12} fill="currentColor" /></i>
                    </button>
                  </li>
                ))}
              </ol>
              {collection.route && <Link to={collection.route}>Перейти к материалам <ArrowUpRight size={14} /></Link>}
            </article>
          ))}
          {visibleCollections.length === 0 && <p className="history-empty">Для выбранного фильтра подборка пока не найдена.</p>}
        </div>
      </section>

      <section className="history-sources" aria-labelledby="history-sources-heading">
        <header className="history-section-heading">
          <div>
            <span className="mono-label">03 / RESEARCH BASE</span>
            <h2 id="history-sources-heading">ОСНОВА КАРТЫ</h2>
          </div>
          <p>Карта будет уточняться по специализированным каталогам и академической литературе. Эти ресурсы задают широкую структуру раздела.</p>
        </header>
        <div>
          {musicHistorySources.map((source, index) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <BookOpenText size={18} />
              <div><strong>{source.label}</strong><small>{source.institution}</small><p>{source.description}</p></div>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      </section>

      <footer className="history-footer">
        <Clock3 size={18} />
        <p>Верхняя граница раздела — 31 декабря 1989 года. Жанры после этой даты будут вынесены в следующий том хронологии.</p>
        <span>VOL. 001 / END 1989</span>
      </footer>
      {selectedVideo && <YouTubePlayerPanel work={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  )
}
