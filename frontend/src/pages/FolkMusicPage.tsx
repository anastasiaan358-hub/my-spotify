import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BookOpenText, Headphones, Play, Search, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { YouTubeWork } from '../features/artists/model/youtubeCatalog'
import { YouTubePlayerPanel } from '../features/artists/ui/YouTubePlayerPanel'
import {
  folkRegionCount,
  folkRegionLabels,
  folkRoutes,
  folkSources,
  folkTraditions,
} from '../features/folk-music/model/folkMusic'
import type { FolkRegion } from '../features/folk-music/model/folkMusic'

type RegionFilter = 'all' | FolkRegion

interface FolkListeningEntry {
  title: string
  youtubeUrl: string
  youtubeTitle: string
  channel: string
  durationSeconds?: number | null
  playbackStatus: 'playable'
  playableInEmbed: true
  verifiedAt: string
}

interface FolkListeningCatalog {
  traditions: Record<string, FolkListeningEntry | null>
}

const regionFilters = Object.entries(folkRegionLabels) as Array<[FolkRegion, string]>
const traditionById = new Map(folkTraditions.map((tradition) => [tradition.id, tradition]))
const karelian = folkTraditions.find((tradition) => tradition.id === 'karelian-runosong')!

export function FolkMusicPage() {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<RegionFilter>('all')
  const [listeningCatalog, setListeningCatalog] = useState<FolkListeningCatalog>({ traditions: {} })
  const [selectedVideo, setSelectedVideo] = useState<YouTubeWork | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')

  useEffect(() => {
    let cancelled = false
    void fetch('/classical/catalog/folk-listening.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Folk listening catalog ${response.status}`)
        return response.json() as Promise<FolkListeningCatalog>
      })
      .then((catalog) => { if (!cancelled) setListeningCatalog(catalog) })
      .catch(() => { if (!cancelled) setListeningCatalog({ traditions: {} }) })
    return () => { cancelled = true }
  }, [])

  const openListening = (traditionId: string, title: string) => {
    const catalogEntry = listeningCatalog.traditions[traditionId]
    if (!catalogEntry) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} traditional music`)}`, '_blank', 'noopener,noreferrer')
      return
    }
    setSelectedVideo({ ...catalogEntry, key: traditionId, confidence: 'editorial-search' })
  }
  const visibleTraditions = folkTraditions.filter((tradition) => {
    const belongsToRegion = region === 'all' || tradition.region === region
    const haystack = [
      tradition.title,
      tradition.localName,
      tradition.place,
      tradition.timeframe,
      tradition.description,
      ...tradition.forms,
      ...tradition.instruments,
    ].join(' ').toLocaleLowerCase('ru')
    return belongsToRegion && (!normalizedQuery || haystack.includes(normalizedQuery))
  })

  return (
    <div className="folk-page">
      <header className="folk-hero">
        <div className="folk-hero__copy">
          <Link className="history-back" to="/music-history"><ArrowLeft size={14} /> К хронологии</Link>
          <span className="mono-label">// LIVING TRADITIONS / FIELD ARCHIVES</span>
          <h1 aria-label="НАРОДНАЯ МУЗЫКА">НАРОДНАЯ<br />МУЗЫКА</h1>
          <p>Карта устных, инструментальных и обрядовых традиций. Здесь регион, исполнительская практика и контекст важнее единой линейной хронологии.</p>
        </div>
        <dl className="folk-hero__stats">
          <div><dt>Традиции</dt><dd>{folkTraditions.length}</dd></div>
          <div><dt>Регионы</dt><dd>{folkRegionCount}</dd></div>
          <div><dt>Маршруты</dt><dd>{folkRoutes.length}</dd></div>
          <div><dt>Тип</dt><dd>LIVE</dd></div>
        </dl>
      </header>

      <section className="folk-focus" aria-labelledby="folk-focus-heading">
        <div className="folk-focus__mark"><Waves size={54} strokeWidth={1} /><span>FOCUS / 01</span></div>
        <div className="folk-focus__body">
          <span className="mono-label">КАРЕЛИЯ / ИНГРИЯ / ФИНЛЯНДИЯ</span>
          <h2 id="folk-focus-heading">{karelian.title}</h2>
          <p>{karelian.description}</p>
          <div className="folk-tags">
            {[...karelian.forms, ...karelian.instruments].map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <aside>
          <strong>8613</strong>
          <span>оцифрованных мелодий</span>
          <p>Ноты, тональность, метр, место записи, текст и сведения о собирателе объединены в исследовательской базе.</p>
          <a href={karelian.sourceUrl} target="_blank" rel="noreferrer">Открыть карельский архив <ArrowUpRight size={15} /></a>
        </aside>
      </section>

      <section className="folk-catalog" aria-labelledby="folk-catalog-heading">
        <header className="history-section-heading">
          <div>
            <span className="mono-label">01 / REGIONAL INDEX</span>
            <h2 id="folk-catalog-heading">КАРТОЧКИ ТРАДИЦИЙ</h2>
          </div>
          <p>{visibleTraditions.length} из {folkTraditions.length} традиций показано. Поиск работает по месту, форме, инструменту и локальному названию.</p>
        </header>

        <div className="folk-controls">
          <label className="history-search">
            <Search size={16} />
            <span>Поиск</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например: Карелия, эпос, кантеле, полифония" />
          </label>
          <div className="history-streams" aria-label="Фильтр по региону">
            <button type="button" className={region === 'all' ? 'is-active' : ''} aria-pressed={region === 'all'} onClick={() => setRegion('all')}>Все регионы</button>
            {regionFilters.map(([value, label]) => (
              <button type="button" key={value} className={region === value ? 'is-active' : ''} aria-pressed={region === value} onClick={() => setRegion(value)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="folk-grid">
          {visibleTraditions.map((tradition, index) => (
            <article className={`folk-card${tradition.featured ? ' folk-card--featured' : ''}`} key={tradition.id}>
              <header><span>{String(index + 1).padStart(2, '0')}</span><i>{folkRegionLabels[tradition.region]}</i></header>
              <div className="folk-card__identity">
                <small>{tradition.place}</small>
                <h3>{tradition.title}</h3>
                <em>{tradition.localName}</em>
                <time>{tradition.timeframe}</time>
              </div>
              <p>{tradition.description}</p>
              <dl>
                <div><dt>Формы</dt><dd>{tradition.forms.join(' / ')}</dd></div>
                <div><dt>Инструменты</dt><dd>{tradition.instruments.join(' / ')}</dd></div>
              </dl>
              <div className="folk-card__actions">
                <button type="button" onClick={() => openListening(tradition.id, tradition.title)} aria-label={`Слушать: ${tradition.title}`}><Play size={13} fill="currentColor" /> Слушать</button>
                <a href={tradition.sourceUrl} target="_blank" rel="noreferrer"><span>{tradition.sourceLabel}</span><ArrowUpRight size={14} /></a>
              </div>
            </article>
          ))}
          {visibleTraditions.length === 0 && <p className="history-empty">По этому запросу традиция не найдена.</p>}
        </div>
      </section>

      <section className="folk-routes" aria-labelledby="folk-routes-heading">
        <header className="history-section-heading">
          <div><span className="mono-label">02 / LISTENING ROUTES</span><h2 id="folk-routes-heading">МАРШРУТЫ</h2></div>
          <p>Подборки сопоставляют традиции по исполнительскому принципу: голосу, памяти, ритуалу, бурдону и миграции.</p>
        </header>
        <div className="folk-route-grid">
          {folkRoutes.map((route) => (
            <article key={route.id}>
              <header><span>{route.number}</span><Headphones size={16} /></header>
              <small>{route.caption}</small>
              <h3>{route.title}</h3>
              <ol>
                {route.traditionIds.map((traditionId, index) => {
                  const tradition = traditionById.get(traditionId)!
                  return <li key={traditionId}><span>{String(index + 1).padStart(2, '0')}</span><button type="button" onClick={() => { setRegion(tradition.region); setQuery(tradition.title); document.getElementById('folk-catalog-heading')?.scrollIntoView({ behavior: 'smooth' }) }}>{tradition.title}</button><small>{tradition.place}</small></li>
                })}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="folk-sources" aria-labelledby="folk-sources-heading">
        <header className="history-section-heading">
          <div><span className="mono-label">03 / ARCHIVES</span><h2 id="folk-sources-heading">ПОЛЕВЫЕ АРХИВЫ</h2></div>
          <p>Карточки опираются на каталоги, где традиция описана вместе с местом, носителями и обстоятельствами записи.</p>
        </header>
        <div>
          {folkSources.map((source, index) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
              <span>{String(index + 1).padStart(2, '0')}</span><BookOpenText size={19} />
              <div><strong>{source.label}</strong><small>{source.institution}</small><p>{source.note}</p></div>
              <ArrowUpRight size={16} />
            </a>
          ))}
        </div>
      </section>
      {selectedVideo && <YouTubePlayerPanel work={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  )
}
