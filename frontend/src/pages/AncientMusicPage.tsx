import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ExternalLink, FileText, GitBranch, Landmark, Music2, Play, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AncientPlaybackCatalog, AncientPlaybackWork } from '../features/ancient-music/model/ancientPlayback'
import { pendingAncientDocumentCount } from '../features/ancient-music/model/ancientAcademicResearch'
import {
  ancientTraditions,
  ancientWorkCount,
  evidenceLabels,
  notatedWorkCount,
} from '../features/ancient-music/model/ancientMusic'
import type { YouTubeWork } from '../features/artists/model/youtubeCatalog'
import { YouTubePlayerPanel } from '../features/artists/ui/YouTubePlayerPanel'
import { QuotationBadge } from '../features/artists/ui/QuotationBadge'
import { LiteratureBadge } from '../features/ancient-music/ui/LiteratureBadge'
import { usePlayerStore } from '../features/player/model/playerStore'

function youtubeWork(playback: AncientPlaybackWork): YouTubeWork | null {
  if (playback.sourceType !== 'youtube' || !playback.youtubeUrl) return null
  return {
    key: `ancient|${playback.workId}`,
    title: playback.title,
    youtubeUrl: playback.youtubeUrl,
    youtubeTitle: playback.youtubeTitle ?? playback.title,
    channel: playback.channel ?? 'YouTube',
    confidence: 'curated',
    playbackStatus: 'playable',
    playableInEmbed: true,
    durationSeconds: playback.durationSeconds,
  }
}

export function AncientMusicPage() {
  const [query, setQuery] = useState('')
  const [playbackCatalog, setPlaybackCatalog] = useState<AncientPlaybackCatalog | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<YouTubeWork | null>(null)
  const setTrack = usePlayerStore((state) => state.setTrack)
  const setPlaying = usePlayerStore((state) => state.setPlaying)

  useEffect(() => {
    let cancelled = false
    void fetch('/classical/catalog/ancient-playback.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Ancient playback catalog ${response.status}`)
        return response.json() as Promise<AncientPlaybackCatalog>
      })
      .then((catalog) => {
        if (!cancelled) setPlaybackCatalog(catalog)
      })
      .catch(() => {
        if (!cancelled) setPlaybackCatalog(null)
      })
    return () => { cancelled = true }
  }, [])

  const playRecording = (playback: AncientPlaybackWork) => {
    const video = youtubeWork(playback)
    if (video) {
      setPlaying(false)
      setSelectedVideo(video)
      return
    }
    if (!playback.streamUrl) return
    setSelectedVideo(null)
    setTrack({
      id: `ancient-${playback.workId}`,
      title: playback.title,
      artist: 'Архив древней музыки',
      sourceLabel: `${playback.mediaType === 'midi' ? 'MIDI' : 'MP3'} · ${playback.provider ?? 'OPEN ARCHIVE'}`,
      streamUrl: playback.streamUrl,
      mediaType: playback.mediaType ?? 'audio',
      durationMs: playback.durationSeconds ? playback.durationSeconds * 1000 : undefined,
    })
  }

  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const visibleTraditions = useMemo(() => ancientTraditions
    .map((tradition) => ({
      ...tradition,
      works: normalizedQuery
        ? tradition.works.filter((work) =>
          `${work.title} ${work.originalTitle ?? ''} ${work.author} ${work.date} ${tradition.name}`
            .toLocaleLowerCase('ru')
            .includes(normalizedQuery),
        )
        : tradition.works,
    }))
    .filter((tradition) => tradition.works.length > 0), [normalizedQuery])

  return (
    <div className="ancient-page">
      <header className="ancient-hero">
        <div className="ancient-hero__title">
          <span className="mono-label">// ORIGINS ARCHIVE / 2600 BCE—400 CE</span>
          <h1 aria-label="ДРЕВНЯЯ МУЗЫКА">ДРЕВНЯЯ<br />МУЗЫКА</h1>
        </div>
        <div className="ancient-hero__summary">
          <p>Первые известные названия песен и гимнов: от шумерских храмовых текстов до греческих памятников с читаемой нотацией.</p>
          <dl>
            <div><dt>Памятники</dt><dd>{ancientWorkCount}</dd></div>
            <div><dt>Традиции</dt><dd>{ancientTraditions.length}</dd></div>
            <div><dt>С нотацией</dt><dd>{notatedWorkCount}</dd></div>
            <div><dt>С записями</dt><dd>{playbackCatalog?.availableCount ?? '…'}</dd></div>
          </dl>
        </div>
      </header>

      <section className="ancient-method" aria-labelledby="ancient-method-heading">
        <div>
          <span className="mono-label">00 / КАК ЧИТАТЬ КАТАЛОГ</span>
          <h2 id="ancient-method-heading">ЧТО ИМЕННО СОХРАНИЛОСЬ</h2>
        </div>
        <div className="ancient-method__research">
          <div className="ancient-method__legend">
            <span><Music2 size={15} /> <b>Сохранилась нотация</b> — есть древние музыкальные знаки или инструкции.</span>
            <span><FileText size={15} /> <b>Текст / мелодия утрачена</b> — сохранились слова песни или гимна, но не музыка.</span>
            <span><Play size={15} /> <b>Запись найдена</b> — подлинная нотация исполнена, либо современная интерпретация помечена отдельно.</span>
          </div>
          <Link className="ancient-research-link" to="/ancient-music/research">
            <BookOpen size={16} /> Академический обзор и другие памятники <span>{pendingAncientDocumentCount}</span>
          </Link>
        </div>
      </section>

      <section className="ancient-catalog" aria-labelledby="ancient-catalog-heading">
        <header className="ancient-section-heading">
          <div>
            <span className="mono-label">01 / CHRONOLOGICAL BRANCHES</span>
            <h2 id="ancient-catalog-heading">ВЕТВИ ИСТОКОВ</h2>
          </div>
          <p>Список расположен по ранней датировке каждой традиции. Автор отмечен только там, где атрибуцию позволяет источник.</p>
        </header>

        <label className="ancient-search">
          <Search size={17} />
          <span>Поиск</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, автор, культура или дата" />
        </label>

        <div className="ancient-tree">
          <div className="ancient-tree__root"><GitBranch size={17} /> ИСТОКИ МУЗЫКИ</div>
          <div className="ancient-tree__branches">
            {visibleTraditions.map((tradition, traditionIndex) => (
              <section className="ancient-branch" key={tradition.id}>
                <header className="ancient-branch__header">
                  <span>{String(traditionIndex + 1).padStart(2, '0')}</span>
                  <Landmark size={19} />
                  <div>
                    <h3>{tradition.name}</h3>
                    <p>{tradition.place} / {tradition.range}</p>
                  </div>
                  <small>{tradition.works.length} поз.</small>
                </header>
                <p className="ancient-branch__note">{tradition.note}</p>
                <ol className="ancient-work-list">
                  {tradition.works.map((work, workIndex) => {
                    const EvidenceIcon = work.evidence === 'notation' ? Music2 : FileText
                    const playback = playbackCatalog?.works[work.id]
                    const playbackKind = playback?.interpretation === 'notation-performance'
                      ? 'ИСПОЛНЕНИЕ НОТАЦИИ'
                      : playback
                        ? 'СОВРЕМЕННАЯ ИНТЕРПРЕТАЦИЯ'
                        : 'ЗАПИСЬ НЕ НАЙДЕНА'
                    return (
                      <li className="ancient-work" key={work.id}>
                        <span className="ancient-work__index">{String(workIndex + 1).padStart(2, '0')}</span>
                        <div className="ancient-work__identity">
                          <div className="ancient-work__title-row">
                            <h4>{work.title}</h4>
                            <QuotationBadge artistId="ancient" workId={work.id} labelOverride="ЦИТАТА" />
                            <LiteratureBadge workId={work.id} title={work.title} />
                          </div>
                          {work.originalTitle && <p>{work.originalTitle}</p>}
                          <small className={playback ? 'is-available' : ''}>
                            {playback
                              ? `${playback.sourceType === 'youtube' ? 'YOUTUBE' : playback.provider ?? 'AUDIO'} · ${playbackKind}`
                              : playbackKind}
                          </small>
                        </div>
                        <div className="ancient-work__author">
                          <span>Автор / атрибуция</span>
                          <strong>{work.author}</strong>
                        </div>
                        <time>{work.date}</time>
                        <span className={`ancient-work__evidence ancient-work__evidence--${work.evidence}`}>
                          <EvidenceIcon size={13} /> {evidenceLabels[work.evidence]}
                        </span>
                        <div className="ancient-work__actions">
                          <button
                            type="button"
                            disabled={!playback}
                            onClick={() => playback && playRecording(playback)}
                            aria-label={playback ? `Воспроизвести ${work.title}` : `Запись ${work.title} пока не найдена`}
                            title={playback ? `${playbackKind} · ${playback.sourceType === 'youtube' ? 'YouTube' : playback.provider}` : 'YouTube и открытые MP3-архивы проверены — запись пока не найдена'}
                          >
                            <Play size={14} fill="currentColor" />
                          </button>
                          <a className="ancient-work__source" href={work.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Источник: ${work.sourceTitle}`}>
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
            {visibleTraditions.length === 0 && <p className="ancient-empty">По этому запросу памятников пока нет.</p>}
          </div>
        </div>
      </section>
      {selectedVideo && <YouTubePlayerPanel work={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  )
}
