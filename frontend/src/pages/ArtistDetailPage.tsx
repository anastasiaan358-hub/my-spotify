import { ArrowLeft, ArrowUpRight, ChevronDown, Disc3, Play, Quote, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getArtist, type ArtistCardData } from '../features/artists/model/artists'
import type { VkAudioComposerWorks } from '../features/artists/model/vkAudioCatalog'
import { isVerifiedVkPlayable, loadVkAudioCatalog } from '../features/artists/model/vkAudioCatalog'
import { quotationRecordsForArtist } from '../features/artists/model/quotationCatalog'
import { QuotationBadge } from '../features/artists/ui/QuotationBadge'
import { usePlayerStore } from '../features/player/model/playerStore'

interface CatalogWork {
  id: string
  title: string
  imslpUrl: string
  rismUrl: string
  printUrl?: string
  printLicense?: string
  dateSort?: number
  dateLabel?: string
  dateSource?: 'composition' | 'publication'
}

interface ComposerCatalog {
  catalogName: string
  catalogUrl: string
  verificationCatalogUrl: string
  works: CatalogWork[]
  chronology?: {
    datedCount: number
    undatedCount: number
  }
}

interface PublicCatalog {
  artists: Record<string, ComposerCatalog>
}

function OpenWorksCatalog({ artist }: { artist: ArtistCardData }) {
  const [catalog, setCatalog] = useState<ComposerCatalog | null>(null)
  const [vkAudioCatalog, setVkAudioCatalog] = useState<VkAudioComposerWorks | null>(null)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(40)
  const setTrack = usePlayerStore((state) => state.setTrack)
  const quotationResearch = useMemo(() => quotationRecordsForArtist(artist.id), [artist.id])
  const playbackSummary = useMemo(() => {
    if (!catalog) return { playable: 0, missing: 0 }
    const playableIds = new Set([
      ...Object.entries(vkAudioCatalog?.works ?? {})
        .filter(([, work]) => isVerifiedVkPlayable(work))
        .map(([workId]) => workId),
    ])
    return {
      playable: catalog.works.filter((work) => playableIds.has(work.id)).length,
      missing: catalog.works.filter((work) => !playableIds.has(work.id)).length,
    }
  }, [catalog, vkAudioCatalog])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch('/classical/catalog/imslp-works.json').then((response) => {
        if (!response.ok) throw new Error(`Catalog ${response.status}`)
        return response.json() as Promise<PublicCatalog>
      }),
      loadVkAudioCatalog(),
    ])
      .then(([payload, vkAudio]) => {
        if (cancelled) return
        setCatalog(payload.artists[artist.id] ?? null)
        setVkAudioCatalog(vkAudio.artists[artist.id] ?? null)
      })
      .catch(() => {
        if (!cancelled) setCatalog(null)
      })
    return () => { cancelled = true }
  }, [artist.id])

  const filteredWorks = useMemo(() => {
    if (!catalog) return []
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const matches = normalizedQuery
      ? catalog.works.filter((work) => work.title.toLocaleLowerCase().includes(normalizedQuery))
      : catalog.works
    return [...matches].sort((first, second) => (
      (first.dateSort ?? Number.POSITIVE_INFINITY) - (second.dateSort ?? Number.POSITIVE_INFINITY)
      || first.title.localeCompare(second.title)
    ))
  }, [catalog, query])

  return (
    <section className="open-catalog" aria-labelledby="open-catalog-heading">
      <header className="catalog-section-heading open-catalog__heading">
        <div>
          <span className="mono-label">// SHEET INDEX</span>
          <h2 id="open-catalog-heading">Полный открытый каталог</h2>
        </div>
        <span>{catalog ? `${String(catalog.works.length).padStart(3, '0')} ПОЗИЦИЙ` : 'ЗАГРУЗКА'}</span>
      </header>

      <div className="open-catalog__notice">
        <p>Список выстроен по дате сочинения, затем по исторической первой публикации; недатированные произведения идут после них. Датировано: {catalog?.chronology?.datedCount ?? 0}; дата не установлена: {catalog?.chronology?.undatedCount ?? 0}. Прослушивание проверено: доступно {playbackSummary.playable}, запись не найдена {playbackSummary.missing}. SHEET открывает ноты, знак с кавычками — исследование музыкальной цитаты.</p>
        {quotationResearch.length > 0 && (
          <div>
            {quotationResearch.map((record, index) => (
              <Link key={record.id} to={`/citations/${record.id}`} title={record.title}>
                <Quote size={13} /> Связь {String(index + 1).padStart(2, '0')}
              </Link>
            ))}
          </div>
        )}
      </div>

      <label className="catalog-search">
        <Search size={17} />
        <span>Поиск произведения</span>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(40) }} placeholder="Введите название" />
      </label>

      <div className="open-catalog__rows" aria-live="polite">
        {catalog && filteredWorks.length === 0 && <p className="open-catalog__empty">Ничего не найдено</p>}
        {filteredWorks.slice(0, visibleCount).map((work, index) => {
          const vkAudio = vkAudioCatalog?.works[work.id]
          const verifiedVkAudio = isVerifiedVkPlayable(vkAudio) ? vkAudio : undefined
          const canPlay = Boolean(verifiedVkAudio)
          return (
            <article className="catalog-work" key={work.id}>
              <span>{String(index + 1).padStart(3, '0')}</span>
              <div className="catalog-work__title">
                <div>
                  <strong>{work.title}</strong>
                  <QuotationBadge artistId={artist.id} workId={work.id} />
                </div>
                <small>{work.dateLabel ?? 'Дата не установлена'}</small>
              </div>
              <button
                  className="catalog-work__play"
                  type="button"
                  disabled={!canPlay}
                  onClick={() => {
                    if (verifiedVkAudio) {
                      setTrack({
                        id: verifiedVkAudio.key,
                        title: verifiedVkAudio.title,
                        artist: artist.name,
                        sourceLabel: 'СКАЧАННЫЙ MP3',
                        streamUrl: verifiedVkAudio.streamUrl,
                        mediaType: verifiedVkAudio.mediaType,
                        durationMs: verifiedVkAudio.durationSeconds
                          ? verifiedVkAudio.durationSeconds * 1000
                          : undefined,
                      })
                    }
                  }}
                  aria-label={canPlay ? `Воспроизвести ${work.title}` : `Аудиозапись ${work.title} пока недоступна`}
                  title={verifiedVkAudio ? 'Воспроизвести скачанный ботом MP3' : vkAudio ? 'Скачанный файл повреждён или отсутствует' : 'Файл ещё не скачан ботом'}
                >
                  <Play size={15} fill="currentColor" />
              </button>
              <div>
                {work.printUrl ? (
                  <Link to={`/scores/${artist.id}/${work.id}`}>SHEET</Link>
                ) : (
                  <span className="catalog-work__score-missing">SHEET готовится</span>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {visibleCount < filteredWorks.length && (
        <button className="catalog-load-more" type="button" onClick={() => setVisibleCount((count) => count + 40)}>
          Показать ещё 40 <ChevronDown size={16} />
        </button>
      )}
    </section>
  )
}

export function ArtistDetailPage() {
  const { artistId } = useParams()
  const artist = getArtist(artistId)

  if (!artist) {
    return (
      <section className="simple-page catalog-missing">
        <span className="eyebrow">404 / ARTIST</span>
        <h1>Композитор не найден</h1>
        <Link className="secondary-button" to="/artists"><ArrowLeft size={16} /> К композиторам</Link>
      </section>
    )
  }

  return (
    <div className="catalog-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to="/artists"><ArrowLeft size={14} /> Композиторы</Link>
        <span>/</span>
        <span>{artist.name}</span>
      </nav>

      <section className="artist-profile" aria-labelledby="artist-name">
        <div className={`artist-card__portrait artist-card__portrait--${artist.variant} artist-profile__portrait`}>
          <span>ARTIST PROFILE</span>
          <strong aria-hidden="true">{artist.monogram}</strong>
          <i aria-hidden="true" />
        </div>
        <div className="artist-profile__copy">
          <span className="mono-label">// {artist.genre} / {artist.origin}</span>
          <h1 id="artist-name">{artist.name}</h1>
          <p>{artist.biography[0]}</p>
          <div className="artist-profile__stats">
            <span><strong>{artist.albums.length}</strong> сборник</span>
            <span><strong>{artist.albums.reduce((total, album) => total + album.tracks.length, 0)}</strong> запись с нотами</span>
            <span><strong>{artist.year}</strong> годы жизни</span>
          </div>
        </div>
      </section>

      <section className="discography" aria-labelledby="discography-heading">
        <header className="catalog-section-heading">
          <div><span className="mono-label">// SCORE ARCHIVE</span><h2 id="discography-heading">Произведения</h2></div>
          <span>{String(artist.albums.length).padStart(2, '0')} СБОРНИК</span>
        </header>
        <div className="album-grid">
          {artist.albums.map((album, index) => {
            const firstTrack = album.tracks[0]
            return (
              <article className="album-card" key={album.id}>
                <Link className="album-card__main" to={`/artists/${artist.id}/albums/${album.id}`} aria-label={`Открыть альбом ${album.title}`}>
                  <div className={`album-card__cover album-card__cover--${album.variant}`}>
                    <span>ALB/{String(index + 1).padStart(2, '0')}</span>
                    <Disc3 size={72} strokeWidth={1} />
                    <strong>{artist.monogram}</strong>
                  </div>
                  <div className="album-card__copy">
                    <span>{album.type} / {album.year}</span>
                    <div><h3>{album.title}</h3><ArrowUpRight size={19} /></div>
                  </div>
                </Link>
                <Link
                  className="album-card__notes"
                  to={`/artists/${artist.id}/albums/${album.id}/tracks/${firstTrack.id}`}
                  aria-label={`Открыть ноты альбома ${album.title}`}
                  title="Открыть ноты"
                >
                  SHEET
                </Link>
                <div className="album-card__footer">
                  <span>{album.tracks.length} произведение</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <OpenWorksCatalog artist={artist} />
    </div>
  )
}
