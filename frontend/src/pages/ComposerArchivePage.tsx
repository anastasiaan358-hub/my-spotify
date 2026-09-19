import { ArrowLeft, ChevronDown, Play, Quote, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { start as startAudioContext } from 'tone'
import {
  composerLifetime,
  composerMonogram,
  type AtlasComposer,
} from '../features/artists/model/atlasCatalog'
import type { ExternalAudioCatalog, ExternalAudioComposerWorks } from '../features/artists/model/externalAudioCatalog'
import { isVerifiedExternalPlayable } from '../features/artists/model/externalAudioCatalog'
import { quotationRecordsForArtist } from '../features/artists/model/quotationCatalog'
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
import { YouTubePlayerPanel } from '../features/artists/ui/YouTubePlayerPanel'
import { QuotationBadge } from '../features/artists/ui/QuotationBadge'
import { usePlayerStore } from '../features/player/model/playerStore'

interface CountryCatalog {
  composers: AtlasComposer[]
}

interface AtlasCatalog {
  countries: CountryCatalog[]
}

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

interface ComposerWorks {
  catalogUrl: string
  verificationCatalogUrl: string
  works: CatalogWork[]
  chronology?: {
    datedCount: number
    undatedCount: number
  }
}

interface PublicWorksCatalog {
  artists: Record<string, ComposerWorks>
}

function portraitVariant(id: string) {
  return [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % 5 + 1
}

export function ComposerArchivePage() {
  const { composerId } = useParams()
  const [composer, setComposer] = useState<AtlasComposer | null | undefined>(undefined)
  const [worksCatalog, setWorksCatalog] = useState<ComposerWorks | null>(null)
  const [youtubeCatalog, setYoutubeCatalog] = useState<YouTubeComposerWorks | null>(null)
  const [localAudioCatalog, setLocalAudioCatalog] = useState<LocalAudioComposerWorks | null>(null)
  const [vkAudioCatalog, setVkAudioCatalog] = useState<VkAudioComposerWorks | null>(null)
  const [externalAudioCatalog, setExternalAudioCatalog] = useState<ExternalAudioComposerWorks | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<YouTubeWork | null>(null)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(40)
  const setTrack = usePlayerStore((state) => state.setTrack)
  const setPlaying = usePlayerStore((state) => state.setPlaying)
  const quotationResearch = useMemo(() => composerId ? quotationRecordsForArtist(composerId) : [], [composerId])
  const playbackSummary = useMemo(() => {
    if (!worksCatalog) return { playable: 0, missing: 0 }
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
      playable: worksCatalog.works.filter((work) => playableIds.has(work.id)).length,
      missing: worksCatalog.works.filter((work) => !playableIds.has(work.id)).length,
    }
  }, [externalAudioCatalog, localAudioCatalog, vkAudioCatalog, worksCatalog, youtubeCatalog])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetch('/classical/catalog/renaissance-composers.json').then((response) => {
        if (!response.ok) throw new Error(`Atlas ${response.status}`)
        return response.json() as Promise<AtlasCatalog>
      }),
      fetch('/classical/catalog/imslp-works.json').then((response) => {
        if (!response.ok) throw new Error(`Works ${response.status}`)
        return response.json() as Promise<PublicWorksCatalog>
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
        if (!response.ok) throw new Error(`External audio ${response.status}`)
        return response.json() as Promise<ExternalAudioCatalog>
      }),
    ])
      .then(([atlas, publicWorks, youtubeWorks, localAudio, vkAudio, externalAudio]) => {
        if (cancelled) return
        const found = atlas.countries.flatMap((country) => country.composers).find((item) => item.id === composerId) ?? null
        setComposer(found)
        setWorksCatalog(composerId ? publicWorks.artists[composerId] ?? null : null)
        setYoutubeCatalog(composerId ? youtubeWorks.artists[composerId] ?? null : null)
        setLocalAudioCatalog(composerId ? localAudio.artists[composerId] ?? null : null)
        setVkAudioCatalog(composerId ? vkAudio.artists[composerId] ?? null : null)
        setExternalAudioCatalog(composerId ? externalAudio.artists[composerId] ?? null : null)
      })
      .catch(() => {
        if (!cancelled) setComposer(null)
      })
    return () => { cancelled = true }
  }, [composerId])

  const filteredWorks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru')
    if (!worksCatalog) return []
    const matches = normalized
      ? worksCatalog.works.filter((work) => work.title.toLocaleLowerCase('ru').includes(normalized))
      : worksCatalog.works
    return [...matches].sort((first, second) => (
      (first.dateSort ?? Number.POSITIVE_INFINITY) - (second.dateSort ?? Number.POSITIVE_INFINITY)
      || first.title.localeCompare(second.title)
    ))
  }, [query, worksCatalog])

  if (composer === undefined) {
    return <section className="simple-page catalog-missing"><span className="eyebrow">LOADING / ARCHIVE</span><h1>Загружаем карточку</h1></section>
  }

  if (!composer) {
    return (
      <section className="simple-page catalog-missing">
        <span className="eyebrow">404 / ARCHIVE</span>
        <h1>Композитор не найден</h1>
        <Link className="secondary-button" to="/artists/atlas"><ArrowLeft size={16} /> К древу</Link>
      </section>
    )
  }

  const workCount = worksCatalog?.works.length ?? composer.workCount
  const selectedVideoWorkId = selectedVideo?.key.split('|').pop()
  const selectedVideoScore = selectedVideoWorkId
    && worksCatalog?.works.some((work) => work.id === selectedVideoWorkId && work.printUrl)
    ? { catalogId: composer.id, workId: selectedVideoWorkId }
    : undefined

  return (
    <div className="catalog-page archive-composer-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to="/artists/atlas"><ArrowLeft size={14} /> Древо композиторов</Link>
        <span>/</span>
        <span>{composer.name}</span>
      </nav>

      <section className="artist-profile" aria-labelledby="archive-composer-name">
        <div className={`artist-card__portrait artist-card__portrait--${portraitVariant(composer.id)} artist-profile__portrait`}>
          <span>ARCHIVE PROFILE</span>
          <strong aria-hidden="true">{composerMonogram(composer.name)}</strong>
          <i aria-hidden="true" />
        </div>
        <div className="artist-profile__copy">
          <span className="mono-label">// {composer.period} / {composer.country}</span>
          <h1 id="archive-composer-name">{composer.name}</h1>
          <p>Внутренняя карточка автора объединяет каталог произведений, ноты и проверенные записи из YouTube и открытых аудиоархивов.</p>
          <div className="artist-profile__stats">
            <span><strong>{workCount}</strong> произведений</span>
            <span><strong>{localAudioCatalog?.availableCount ?? 0}</strong> локальных записей</span>
            <span><strong>{vkAudioCatalog?.availableCount ?? 0}</strong> MP3 из VK</span>
            <span><strong>{youtubeCatalog?.availableCount ?? 0}</strong> записей онлайн</span>
            <span><strong>{externalAudioCatalog?.availableCount ?? 0}</strong> внешних аудиофайлов</span>
            <span><strong>{composerLifetime(composer)}</strong> годы жизни</span>
          </div>
        </div>
      </section>

      <section className="open-catalog archive-works" aria-labelledby="archive-works-heading">
        <header className="catalog-section-heading open-catalog__heading">
          <div>
            <span className="mono-label">// DISCOGRAPHY / LISTENING / PRINT</span>
            <h2 id="archive-works-heading">Дискография и прослушивание</h2>
          </div>
          <span>{String(workCount).padStart(3, '0')} ПОЗИЦИЙ</span>
        </header>

        <div className="archive-audio-status">
          <span><Play size={15} fill="currentColor" /></span>
          <div>
            <strong>{localAudioCatalog?.availableCount || vkAudioCatalog?.availableCount || youtubeCatalog?.availableCount || externalAudioCatalog?.availableCount ? 'Прослушивание доступно' : 'Аудио ожидается'}</strong>
            <p>{localAudioCatalog?.availableCount ?? 0} локальных · {vkAudioCatalog?.availableCount ?? 0} VK MP3 · {youtubeCatalog?.availableCount ?? 0} YouTube · {externalAudioCatalog?.availableCount ?? 0} MP3/MIDI из открытых архивов.</p>
          </div>
        </div>

        <div className="open-catalog__notice">
          <p>Список выстроен по дате сочинения, затем по исторической первой публикации; недатированные произведения идут после них. Датировано: {worksCatalog?.chronology?.datedCount ?? 0}; дата не установлена: {worksCatalog?.chronology?.undatedCount ?? 0}. Прослушивание проверено: доступно {playbackSummary.playable}, запись не найдена {playbackSummary.missing}. Значок с кавычками открывает историю музыкальной модели.</p>
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

        {worksCatalog ? (
          <>
            <label className="catalog-search">
              <Search size={17} />
              <span>Поиск произведения</span>
              <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(40) }} placeholder="Введите название" />
            </label>

            <div className="open-catalog__rows" aria-live="polite">
              {filteredWorks.length === 0 && <p className="open-catalog__empty">Ничего не найдено</p>}
              {filteredWorks.slice(0, visibleCount).map((work, index) => {
                const localAudio = localAudioCatalog?.works[work.id]
                const verifiedLocalAudio = isVerifiedLocalPlayable(localAudio) ? localAudio : undefined
                const vkAudio = vkAudioCatalog?.works[work.id]
                const verifiedVkAudio = isVerifiedVkPlayable(vkAudio) ? vkAudio : undefined
                const youtubeWork = youtubeCatalog?.works[work.id]
                const verifiedYoutubeWork = isVerifiedPlayable(youtubeWork) ? youtubeWork : undefined
                const externalAudio = externalAudioCatalog?.works[work.id]
                const verifiedExternalAudio = isVerifiedExternalPlayable(externalAudio) ? externalAudio : undefined
                const externalFormat = verifiedExternalAudio?.mediaType === 'midi' ? 'MIDI' : 'MP3'
                const canPlay = Boolean(verifiedLocalAudio || verifiedVkAudio || verifiedExternalAudio || verifiedYoutubeWork)
                return (
                  <article className="catalog-work" key={work.id}>
                    <span>{String(index + 1).padStart(3, '0')}</span>
                    <div className="catalog-work__title">
                      <div>
                        <strong>{work.title}</strong>
                        <QuotationBadge artistId={composer.id} workId={work.id} />
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
                              artist: composer.name,
                              sourceLabel: verifiedLocalAudio.sourceName,
                              streamUrl: verifiedLocalAudio.streamUrl,
                              mediaType: verifiedLocalAudio.mediaType,
                            })
                          } else if (verifiedVkAudio) {
                            setSelectedVideo(null)
                            setTrack({
                              id: verifiedVkAudio.key,
                              title: verifiedVkAudio.title,
                              artist: composer.name,
                              sourceLabel: 'MP3 · VK',
                              streamUrl: verifiedVkAudio.streamUrl,
                              mediaType: verifiedVkAudio.mediaType,
                              durationMs: verifiedVkAudio.durationSeconds
                                ? verifiedVkAudio.durationSeconds * 1000
                                : undefined,
                            })
                          } else if (verifiedExternalAudio) {
                            setSelectedVideo(null)
                            const mediaType = verifiedExternalAudio.mediaType ?? 'audio'
                            if (mediaType === 'midi') await startAudioContext()
                            setTrack({
                              id: verifiedExternalAudio.key,
                              title: verifiedExternalAudio.title,
                              artist: composer.name,
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
                        title={verifiedLocalAudio?.mediaType === 'midi' ? 'Воспроизвести нотный MIDI без ограничений' : verifiedLocalAudio || verifiedVkAudio ? 'Воспроизвести локальную запись' : verifiedExternalAudio ? `Воспроизвести через ${verifiedExternalAudio.provider} · поток проверен` : verifiedYoutubeWork ? 'Воспроизвести через YouTube · поток проверен' : localAudio || vkAudio ? 'Локальный аудиофайл повреждён или отсутствует' : youtubeWork ? 'Назначенная запись недоступна после проверки' : 'Запись пока не найдена'}
                      >
                        <Play size={15} fill="currentColor" />
                    </button>
                    <div>
                      {work.printUrl ? (
                        <Link to={`/scores/${composer.id}/${work.id}`}>SHEET</Link>
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
          </>
        ) : (
          <article className="archive-catalog-placeholder">
            <div><span>001</span><strong>Открытый каталог произведений</strong><small>{composer.workCount} страниц нот</small></div>
            <button className="catalog-work__play" type="button" disabled aria-label="Аудиозаписи пока недоступны"><Play size={15} fill="currentColor" /></button>
            <span className="catalog-work__score-missing">SHEET добавляется</span>
          </article>
        )}
      </section>
    </div>
  )
}
