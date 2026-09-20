import { ArrowLeft, ChevronDown, Play, Quote, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  composerLifetime,
  composerMonogram,
  type AtlasComposer,
} from '../features/artists/model/atlasCatalog'
import { quotationRecordsForArtist } from '../features/artists/model/quotationCatalog'
import type { VkAudioComposerWorks } from '../features/artists/model/vkAudioCatalog'
import { isVerifiedVkPlayable, loadVkAudioCatalog } from '../features/artists/model/vkAudioCatalog'
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
  const [vkAudioCatalog, setVkAudioCatalog] = useState<VkAudioComposerWorks | null>(null)
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(40)
  const setTrack = usePlayerStore((state) => state.setTrack)
  const quotationResearch = useMemo(() => composerId ? quotationRecordsForArtist(composerId) : [], [composerId])
  const playbackSummary = useMemo(() => {
    if (!worksCatalog) return { playable: 0, missing: 0 }
    const playableIds = new Set([
      ...Object.entries(vkAudioCatalog?.works ?? {})
        .filter(([, work]) => isVerifiedVkPlayable(work))
        .map(([workId]) => workId),
    ])
    return {
      playable: worksCatalog.works.filter((work) => playableIds.has(work.id)).length,
      missing: worksCatalog.works.filter((work) => !playableIds.has(work.id)).length,
    }
  }, [vkAudioCatalog, worksCatalog])

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
      loadVkAudioCatalog(),
    ])
      .then(([atlas, publicWorks, vkAudio]) => {
        if (cancelled) return
        const found = atlas.countries.flatMap((country) => country.composers).find((item) => item.id === composerId) ?? null
        setComposer(found)
        setWorksCatalog(composerId ? publicWorks.artists[composerId] ?? null : null)
        setVkAudioCatalog(composerId ? vkAudio.artists[composerId] ?? null : null)
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
          <p>Внутренняя карточка автора объединяет каталог произведений, ноты и MP3, физически скачанные ботом в этот проект.</p>
          <div className="artist-profile__stats">
            <span><strong>{workCount}</strong> произведений</span>
            <span><strong>{vkAudioCatalog?.availableCount ?? 0}</strong> скачанных MP3</span>
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
            <strong>{vkAudioCatalog?.availableCount ? 'Прослушивание доступно' : 'Аудио ожидается'}</strong>
            <p>{vkAudioCatalog?.availableCount ?? 0} MP3 скачано ботом и хранится локально. Сторонние потоки отключены.</p>
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
                const vkAudio = vkAudioCatalog?.works[work.id]
                const verifiedVkAudio = isVerifiedVkPlayable(vkAudio) ? vkAudio : undefined
                const canPlay = Boolean(verifiedVkAudio)
                return (
                  <article className="catalog-work" key={work.id}>
                    <span>{String(index + 1).padStart(3, '0')}</span>
                    <div className="catalog-work__title">
                      <div>
                        <strong>{work.title}</strong>
                        <QuotationBadge artistId={composer.id} workId={work.id} />
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
                              artist: composer.name,
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
