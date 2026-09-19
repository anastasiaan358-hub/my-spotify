import { ArrowLeft, ArrowUpRight, ChevronDown, Disc3, Play, Quote, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { start as startAudioContext } from 'tone'
import { getArtist, type ArtistCardData, type TrackData } from '../features/artists/model/artists'
import type { ExternalAudioCatalog, ExternalAudioComposerWorks } from '../features/artists/model/externalAudioCatalog'
import { isVerifiedExternalPlayable } from '../features/artists/model/externalAudioCatalog'
import type {
  LocalAudioCatalog,
  LocalAudioComposerWorks,
} from '../features/artists/model/localAudioCatalog'
import { isVerifiedLocalPlayable } from '../features/artists/model/localAudioCatalog'
import type { VkAudioComposerWorks } from '../features/artists/model/vkAudioCatalog'
import { isVerifiedVkPlayable, loadVkAudioCatalog } from '../features/artists/model/vkAudioCatalog'
import type {
  YouTubeCatalog,
  YouTubeComposerWorks,
  YouTubeWork,
} from '../features/artists/model/youtubeCatalog'
import { isVerifiedPlayable } from '../features/artists/model/youtubeCatalog'
import { quotationRecordsForArtist } from '../features/artists/model/quotationCatalog'
import { YouTubePlayerPanel } from '../features/artists/ui/YouTubePlayerPanel'
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

function normalizeWorkTitle(title: string) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function OpenWorksCatalog({ artist }: { artist: ArtistCardData }) {
  const [catalog, setCatalog] = useState<ComposerCatalog | null>(null)
  const [youtubeCatalog, setYoutubeCatalog] = useState<YouTubeComposerWorks | null>(null)
  const [localAudioCatalog, setLocalAudioCatalog] = useState<LocalAudioComposerWorks | null>(null)
  const [vkAudioCatalog, setVkAudioCatalog] = useState<VkAudioComposerWorks | null>(null)
  const [externalAudioCatalog, setExternalAudioCatalog] = useState<ExternalAudioComposerWorks | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<YouTubeWork | null>(null)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(40)
  const setTrack = usePlayerStore((state) => state.setTrack)
  const setPlaying = usePlayerStore((state) => state.setPlaying)
  const playableTracks = useMemo(() => artist.albums.flatMap((album) => album.tracks).map((track) => ({
    normalizedTitle: normalizeWorkTitle(track.title),
    track,
  })), [artist.albums])
  const quotationResearch = useMemo(() => quotationRecordsForArtist(artist.id), [artist.id])
  const playbackSummary = useMemo(() => {
    if (!catalog) return { playable: 0, missing: 0 }
    const playableIds = new Set([
      ...Object.entries(localAudioCatalog?.works ?? {})
        .filter(([, work]) => isVerifiedLocalPlayable(work))
        .map(([workId]) => workId),
      ...Object.entries(vkAudioCatalog?.works ?? {})
        .filter(([, work]) => isVerifiedVkPlayable(work))
        .map(([workId]) => workId),
      ...Object.entries(youtubeCatalog?.works ?? {})
        .filter(([, work]) => isVerifiedPlayable(work))
        .map(([workId]) => workId),
      ...Object.entries(externalAudioCatalog?.works ?? {})
        .filter(([, work]) => isVerifiedExternalPlayable(work))
        .map(([workId]) => workId),
    ])
    return {
      playable: catalog.works.filter((work) => playableIds.has(work.id)).length,
      missing: catalog.works.filter((work) => !playableIds.has(work.id)).length,
    }
  }, [catalog, externalAudioCatalog, localAudioCatalog, vkAudioCatalog, youtubeCatalog])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch('/classical/catalog/imslp-works.json').then((response) => {
        if (!response.ok) throw new Error(`Catalog ${response.status}`)
        return response.json() as Promise<PublicCatalog>
      }),
      fetch('/classical/catalog/youtube-works.json').then((response) => {
        if (!response.ok) throw new Error(`YouTube catalog ${response.status}`)
        return response.json() as Promise<YouTubeCatalog>
      }),
      fetch('/classical/catalog/local-audio.json').then((response) => {
        if (!response.ok) throw new Error(`Local audio catalog ${response.status}`)
        return response.json() as Promise<LocalAudioCatalog>
      }),
      loadVkAudioCatalog(),
      fetch('/classical/catalog/external-audio.json').then((response) => {
        if (!response.ok) throw new Error(`External audio catalog ${response.status}`)
        return response.json() as Promise<ExternalAudioCatalog>
      }),
    ])
      .then(([payload, youtubeWorks, localAudio, vkAudio, externalAudio]) => {
        if (cancelled) return
        setCatalog(payload.artists[artist.id] ?? null)
        setYoutubeCatalog(youtubeWorks.artists[artist.id] ?? null)
        setLocalAudioCatalog(localAudio.artists[artist.id] ?? null)
        setVkAudioCatalog(vkAudio.artists[artist.id] ?? null)
        setExternalAudioCatalog(externalAudio.artists[artist.id] ?? null)
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

  const playTrack = async (track: TrackData) => {
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

  const selectedVideoWorkId = selectedVideo?.key.split('|').pop()
  const selectedVideoScore = selectedVideoWorkId
    && catalog?.works.some((work) => work.id === selectedVideoWorkId && work.printUrl)
    ? { catalogId: artist.id, workId: selectedVideoWorkId }
    : undefined

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

      {selectedVideo && (
        <YouTubePlayerPanel
          key={selectedVideo.key}
          work={selectedVideo}
          score={selectedVideoScore}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      <label className="catalog-search">
        <Search size={17} />
        <span>Поиск произведения</span>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(40) }} placeholder="Введите название" />
      </label>

      <div className="open-catalog__rows" aria-live="polite">
        {catalog && filteredWorks.length === 0 && <p className="open-catalog__empty">Ничего не найдено</p>}
        {filteredWorks.slice(0, visibleCount).map((work, index) => {
          const normalizedWorkTitle = normalizeWorkTitle(work.title)
          const playableTrack = playableTracks.find(({ normalizedTitle }) => (
            normalizedTitle === normalizedWorkTitle
            || normalizedTitle.startsWith(`${normalizedWorkTitle} `)
            || normalizedWorkTitle.startsWith(`${normalizedTitle} `)
          ))?.track
          const localAudio = localAudioCatalog?.works[work.id]
          const verifiedLocalAudio = isVerifiedLocalPlayable(localAudio) ? localAudio : undefined
          const vkAudio = vkAudioCatalog?.works[work.id]
          const verifiedVkAudio = isVerifiedVkPlayable(vkAudio) ? vkAudio : undefined
          const youtubeWork = youtubeCatalog?.works[work.id]
          const verifiedYoutubeWork = isVerifiedPlayable(youtubeWork) ? youtubeWork : undefined
          const externalAudio = externalAudioCatalog?.works[work.id]
          const verifiedExternalAudio = isVerifiedExternalPlayable(externalAudio) ? externalAudio : undefined
          const externalFormat = verifiedExternalAudio?.mediaType === 'midi' ? 'MIDI' : 'MP3'
          const canPlay = Boolean(verifiedLocalAudio || verifiedVkAudio || playableTrack || verifiedExternalAudio || verifiedYoutubeWork)
          return (
            <article className="catalog-work" key={work.id}>
              <span>{String(index + 1).padStart(3, '0')}</span>
              <div className="catalog-work__title">
                <div>
                  <strong>{work.title}</strong>
                  <QuotationBadge artistId={artist.id} workId={work.id} />
                </div>
                <small>
                  {work.dateLabel ?? 'Дата не установлена'}
                  {verifiedExternalAudio ? ` · ${externalFormat} · ${verifiedExternalAudio.provider}` : ''}
                </small>
              </div>
              <button
                  className="catalog-work__play"
                  type="button"
                  disabled={!canPlay}
                  onClick={async () => {
                    if (verifiedLocalAudio) {
                      setSelectedVideo(null)
                      if (verifiedLocalAudio.mediaType === 'midi') await startAudioContext()
                      setTrack({
                        id: verifiedLocalAudio.key,
                        title: verifiedLocalAudio.title,
                        artist: artist.name,
                        sourceLabel: verifiedLocalAudio.sourceName,
                        streamUrl: verifiedLocalAudio.streamUrl,
                        mediaType: verifiedLocalAudio.mediaType,
                      })
                    } else if (verifiedVkAudio) {
                      setSelectedVideo(null)
                      setTrack({
                        id: verifiedVkAudio.key,
                        title: verifiedVkAudio.title,
                        artist: artist.name,
                        sourceLabel: 'MP3 · VK',
                        streamUrl: verifiedVkAudio.streamUrl,
                        mediaType: verifiedVkAudio.mediaType,
                        durationMs: verifiedVkAudio.durationSeconds
                          ? verifiedVkAudio.durationSeconds * 1000
                          : undefined,
                      })
                    } else if (playableTrack) {
                      setSelectedVideo(null)
                      void playTrack(playableTrack)
                    } else if (verifiedExternalAudio) {
                      setSelectedVideo(null)
                      const mediaType = verifiedExternalAudio.mediaType ?? 'audio'
                      if (mediaType === 'midi') await startAudioContext()
                      setTrack({
                        id: verifiedExternalAudio.key,
                        title: verifiedExternalAudio.title,
                        artist: artist.name,
                        sourceLabel: `${externalFormat} · ${verifiedExternalAudio.provider}`,
                        streamUrl: verifiedExternalAudio.streamUrl,
                        mediaType,
                        durationMs: verifiedExternalAudio.durationSeconds
                          ? verifiedExternalAudio.durationSeconds * 1000
                          : undefined,
                      })
                    } else if (verifiedYoutubeWork) {
                      setPlaying(false)
                      setSelectedVideo(verifiedYoutubeWork)
                    }
                  }}
                  aria-label={canPlay ? `Воспроизвести ${work.title}` : `Аудиозапись ${work.title} пока недоступна`}
                  title={verifiedLocalAudio?.mediaType === 'midi' ? 'Воспроизвести нотный MIDI без ограничений' : verifiedLocalAudio || verifiedVkAudio || playableTrack ? 'Воспроизвести локальную запись' : verifiedExternalAudio ? `Воспроизвести через ${verifiedExternalAudio.provider} · поток проверен` : verifiedYoutubeWork ? 'Воспроизвести через YouTube · поток проверен' : localAudio || vkAudio ? 'Локальный аудиофайл повреждён или отсутствует' : youtubeWork ? 'Назначенная запись недоступна после проверки' : 'Запись пока не найдена'}
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
