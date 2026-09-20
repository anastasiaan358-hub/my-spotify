import { ArrowUpRight, Disc3, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ancientTraditions, ancientWorkCount } from '../features/ancient-music/model/ancientMusic'
import { musicHistoryEras, uniqueMusicHistoryGenreCount } from '../features/music-history/model/musicHistory'
import { folkTraditions } from '../features/folk-music/model/folkMusic'
import type { VkAudioWork } from '../features/artists/model/vkAudioCatalog'
import { isVerifiedVkPlayable, loadVkAudioCatalog } from '../features/artists/model/vkAudioCatalog'
import { usePlayerStore, type PlayerTrack } from '../features/player/model/playerStore'

interface AtlasCatalog {
  countries: Array<{
    composers: Array<{
      id: string
      name: string
      period: 'Renaissance' | 'Baroque'
      workCount: number
    }>
  }>
}

interface DownloadedTrack extends VkAudioWork {
  artistId: string
  artistName: string
  workId: string
}

interface EraStats {
  composers: number
  works: number
}

const collections = [
  { index: 'A/01', title: 'Священная полифония', caption: 'Рим / Англия / Испания', variant: 'grid' },
  { index: 'A/02', title: 'Мадригалы', caption: 'Италия / XVI век', variant: 'rings' },
  { index: 'A/03', title: 'Лютня и клавир', caption: 'Танцы / инструментал', variant: 'type' },
]

const initialAlternativeCount = 8

function trackDuration(seconds: number | null | undefined) {
  if (!seconds) return 'MP3'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function HomePage() {
  const [downloadedTracks, setDownloadedTracks] = useState<DownloadedTrack[]>([])
  const [showAllAlternatives, setShowAllAlternatives] = useState(false)
  const [eraStats, setEraStats] = useState<Record<'Renaissance' | 'Baroque', EraStats> | null>(null)
  const setTrack = usePlayerStore((state) => state.setTrack)
  const playTrack = (track: PlayerTrack) => setTrack(track)

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadVkAudioCatalog(),
      fetch('/classical/catalog/renaissance-composers.json').then((response) => {
        if (!response.ok) throw new Error(`Composer catalog ${response.status}`)
        return response.json() as Promise<AtlasCatalog>
      }),
    ])
      .then(([vkAudio, atlas]) => {
        if (cancelled) return

        const artistNames = new Map(atlas.countries.flatMap((country) => (
          country.composers.map((composer) => [composer.id, composer.name] as const)
        )))
        const atlasComposers = atlas.countries.flatMap((country) => country.composers)
        const statsFor = (period: 'Renaissance' | 'Baroque') => {
          const periodComposers = atlasComposers.filter((composer) => composer.period === period)
          return {
            composers: periodComposers.length,
            works: periodComposers.reduce((total, composer) => total + composer.workCount, 0),
          }
        }
        setEraStats({ Renaissance: statsFor('Renaissance'), Baroque: statsFor('Baroque') })

        const localDownloads = Object.entries(vkAudio.artists).flatMap(([artistId, artistCatalog]) => (
          Object.entries(artistCatalog.works).flatMap(([workId, work]) => (
            isVerifiedVkPlayable(work)
              ? [{ ...work, artistId, artistName: artistNames.get(artistId) ?? artistId.replaceAll('-', ' '), workId }]
              : []
          ))
        )).sort((first, second) => first.artistName.localeCompare(second.artistName, 'ru') || first.title.localeCompare(second.title, 'ru'))

        setDownloadedTracks(localDownloads)
      })
      .catch(() => {
        if (!cancelled) setDownloadedTracks([])
      })

    return () => { cancelled = true }
  }, [])

  const rotationTracks = downloadedTracks.slice(0, 5).map((track, index) => ({
    ...track,
    id: track.key,
    number: `${String(index + 1).padStart(2, '0')}.`,
    artist: track.artistName,
    duration: trackDuration(track.durationSeconds),
    code: `D${String(index + 1).padStart(3, '0')}`,
    sourceLabel: 'СКАЧАННЫЙ MP3',
    durationMs: track.durationSeconds ? track.durationSeconds * 1000 : undefined,
  }))
  const visibleAlternativeTracks = showAllAlternatives
    ? downloadedTracks
    : downloadedTracks.slice(0, initialAlternativeCount)

  const playAlternative = (track: DownloadedTrack) => playTrack({
    id: track.key,
    title: track.title,
    artist: track.artistName,
    sourceLabel: 'СКАЧАННЫЙ MP3',
    streamUrl: track.streamUrl,
    mediaType: track.mediaType,
    durationMs: track.durationSeconds ? track.durationSeconds * 1000 : undefined,
  })

  return (
    <div className="home-page">
      <section className="mono-hero" aria-labelledby="hero-heading">
        <div className="mono-hero__meta">
          <span>MY/SPOTIFY® DIGITAL AUDIO SYSTEM</span>
          <span>VOL.001 / 2026</span>
        </div>

        <div className="mono-hero__body">
          <div className="mono-hero__copy">
            <span className="mono-label">// PERSONAL FREQUENCY</span>
            <h1 id="hero-heading" aria-label="МУЗЫКА БЕЗ ГРАНИЦ.">МУЗЫКА<br />БЕЗ ГРАНИЦ<span>.</span></h1>
            <p>Музыка европейского Возрождения.<br />Оригинальные партитуры и открытый архив.</p>
            <Link className="mono-action" to="/artists">
              НАЧАТЬ СЕССИЮ <ArrowUpRight size={18} />
            </Link>
          </div>

          <div className="record-stage" aria-label="Виниловая пластинка My Spotify">
            <div className="record-stage__axis">33⅓ RPM</div>
            <div className="vinyl">
              <div className="vinyl__groove vinyl__groove--one" />
              <div className="vinyl__groove vinyl__groove--two" />
              <div className="vinyl__label">
                <Disc3 size={20} />
                <strong>MY/SP</strong>
                <small>STEREO</small>
              </div>
            </div>
            <div className="rpm-stamp"><strong>rpm</strong><span>THIS RECORD IS UNDER<br />RIGHT OF MY/SPOTIFY</span></div>
          </div>
        </div>

        <div className="mono-hero__footer">
          <span>LOCAL MUSIC ARCHIVE</span>
          <span>DOWNLOADED MP3 ONLY</span>
          <span>LISTEN / READ / STUDY</span>
        </div>
      </section>

      <section className="era-window" aria-labelledby="era-window-heading">
        <div className="era-window__meta">
          <span>CHRONOLOGY / ARCHIVE NAVIGATION</span>
          <span>{musicHistoryEras.length} PERIODS / {uniqueMusicHistoryGenreCount} GENRES / TO 1989</span>
        </div>
        <header className="era-window__header">
          <div>
            <span className="mono-label">// МУЗЫКАЛЬНАЯ ХРОНОЛОГИЯ</span>
            <h2 id="era-window-heading">МУЗЫКА<br />ПО ЭПОХАМ</h2>
          </div>
          <div className="era-window__intro">
            <p>Полная карта от первых сохранившихся памятников до хип-хопа, хауса и техно 1980-х. Ниже — три уже наполненные части архива.</p>
            <Link to="/music-history">Открыть все эпохи и подборки <ArrowUpRight size={16} /></Link>
          </div>
        </header>

        <div className="era-timeline">
          <Link className="era-card" to="/ancient-music" aria-label="Открыть подборку древней музыки">
            <div className="era-card__top"><i /><span>01 / ORIGINS</span><ArrowUpRight size={16} /></div>
            <time>2600 ДО Н. Э. — 400 Н. Э.</time>
            <h3>ДРЕВНЯЯ<br />МУЗЫКА</h3>
            <p>Шумер и Аккад, Египет, Угарит, Вавилон и античная Греция.</p>
            <small>{ancientWorkCount} памятников / {ancientTraditions.length} традиций</small>
          </Link>

          <Link className="era-card" to="/artists/atlas?period=Renaissance" aria-label="Открыть подборку музыки Возрождения">
            <div className="era-card__top"><i /><span>02 / RENAISSANCE</span><ArrowUpRight size={16} /></div>
            <time>1400 — 1600</time>
            <h3>ВОЗРОЖДЕНИЕ</h3>
            <p>Жоскен, Таллис, Лассо, Жанекен, Маренцио и европейские полифонические школы.</p>
            <small>{eraStats ? `${eraStats.Renaissance.composers.toLocaleString('ru-RU')} авторов / ${eraStats.Renaissance.works.toLocaleString('ru-RU')} произведений` : 'Загрузка каталога…'}</small>
          </Link>

          <Link className="era-card" to="/artists/atlas?period=Baroque" aria-label="Открыть подборку раннего барокко">
            <div className="era-card__top"><i /><span>03 / EARLY BAROQUE</span><ArrowUpRight size={16} /></div>
            <time>ОК. 1580 — 1650</time>
            <h3>РАННЕЕ<br />БАРОККО</h3>
            <p>Монтеверди, Фрескобальди, Аллегри, Шейдеман и переход к новому музыкальному языку.</p>
            <small>{eraStats ? `${eraStats.Baroque.composers.toLocaleString('ru-RU')} авторов / ${eraStats.Baroque.works.toLocaleString('ru-RU')} произведений` : 'Загрузка каталога…'}</small>
          </Link>

          <Link className="era-card" to="/folk-music" aria-label="Открыть подборку народной музыки">
            <div className="era-card__top"><i /><span>04 / LIVING TRADITIONS</span><ArrowUpRight size={16} /></div>
            <time>УСТНАЯ ПАМЯТЬ / ПОЛЕВЫЕ ЗАПИСИ</time>
            <h3>НАРОДНАЯ<br />МУЗЫКА</h3>
            <p>Карельская руническая песня, эпические, обрядовые, многоголосные и инструментальные традиции мира.</p>
            <small>{folkTraditions.length} традиций / 6 регионов</small>
          </Link>
        </div>
        <Link className="era-window__all" to="/music-history">
          <span>Полная музыкальная хронология</span>
          <strong>{musicHistoryEras.length} эпох / {uniqueMusicHistoryGenreCount} жанров / {String(1989)}</strong>
          <ArrowUpRight size={18} />
        </Link>
      </section>

      <section className="track-section" aria-labelledby="track-list-heading">
        <div className="section-index"><span>01</span><span>/03</span></div>
        <div className="track-section__content">
          <div className="mono-section-heading">
            <div><span className="mono-label">// TRACK LIST</span><h2 id="track-list-heading">ТЕКУЩАЯ РОТАЦИЯ</h2></div>
            <span className="mono-count">{String(rotationTracks.length).padStart(3, '0')} TRACKS<br />LOCAL MP3</span>
          </div>
          <div className="track-list">
            {rotationTracks.map((track) => (
              <button className="track-row" type="button" key={track.id} onClick={() => playTrack(track)}>
                <span className="track-row__number">{track.number}</span>
                <span className="track-row__main"><strong>{track.title}</strong><small>{track.artist}</small></span>
                <span className="track-row__code">{track.code}</span>
                <span className="track-row__duration">({track.duration})</span>
                <span className="track-row__play"><Play size={17} fill="currentColor" /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="collection-section" aria-labelledby="collections-heading">
        <div className="section-index"><span>02</span><span>/03</span></div>
        <div className="collection-section__content">
          <div className="mono-section-heading">
            <div><span className="mono-label">// SELECTED FOR YOU</span><h2 id="collections-heading">КОЛЛЕКЦИИ</h2></div>
            <button className="mono-link" type="button">СМОТРЕТЬ ВСЕ <ArrowUpRight size={16} /></button>
          </div>
          <div className="mono-card-grid">
            {collections.map((collection) => (
              <article className="mono-card" key={collection.index}>
                <div className={`mono-card__art mono-card__art--${collection.variant}`}>
                  <span>{collection.index}</span>
                  {collection.variant === 'rings' && <div className="mini-record" />}
                  {collection.variant === 'type' && <strong>Aa</strong>}
                </div>
                <div className="mono-card__copy"><span>{collection.index}</span><h3>{collection.title}</h3><p>{collection.caption}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="track-section alternative-section" aria-labelledby="alternative-tracks-heading">
        <div className="section-index"><span>03</span><span>/03</span></div>
        <div className="track-section__content">
          <div className="mono-section-heading">
            <div>
              <span className="mono-label">// DOWNLOADED AUDIO / LOCAL ONLY</span>
              <h2 id="alternative-tracks-heading">СКАЧАННЫЕ MP3</h2>
              <p className="alternative-section__lead">Только файлы, скачанные ботом и сохранённые внутри проекта. Сторонние потоки отключены.</p>
            </div>
            <span className="mono-count">{String(downloadedTracks.length).padStart(3, '0')} TRACKS<br />LOCAL FILES</span>
          </div>

          <div className="track-list">
            {visibleAlternativeTracks.map((track, index) => (
              <button className="track-row" type="button" key={track.streamUrl} onClick={() => playAlternative(track)}>
                <span className="track-row__number">{String(index + 1).padStart(2, '0')}.</span>
                <span className="track-row__main"><strong>{track.title}</strong><small>{track.artistName}</small></span>
                <span className="track-row__code">MP3</span>
                <span className="track-row__duration">({trackDuration(track.durationSeconds)})</span>
                <span className="track-row__play"><Play size={17} fill="currentColor" /></span>
              </button>
            ))}
          </div>

          <div className="alternative-section__footer">
            {downloadedTracks.length > initialAlternativeCount && (
              <button className="mono-link" type="button" onClick={() => setShowAllAlternatives((value) => !value)}>
                {showAllAlternatives ? 'СВЕРНУТЬ СПИСОК' : `ПОКАЗАТЬ ВСЕ ${downloadedTracks.length}`} <ArrowUpRight size={16} />
              </button>
            )}
            <Link className="mono-link" to="/artists/atlas">ОТКРЫТЬ КАТАЛОГ <ArrowUpRight size={16} /></Link>
          </div>
        </div>
      </section>

      <div className="mono-marquee" aria-hidden="true">
        <span>RENAISSANCE / POLYPHONY / OPEN SCORES / LOCAL AUDIO /&nbsp;</span>
        <span>RENAISSANCE / POLYPHONY / OPEN SCORES / LOCAL AUDIO /&nbsp;</span>
      </div>
    </div>
  )
}
