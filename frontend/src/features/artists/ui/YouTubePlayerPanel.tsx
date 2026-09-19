import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { youtubeVideoId, type YouTubeWork } from '../model/youtubeCatalog'
import { SynchronizedScoreViewer } from './SynchronizedScoreViewer'

type PlayerStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'error'

interface YouTubePlayerPanelProps {
  work: YouTubeWork
  score?: {
    catalogId: string
    workId: string
  }
  onClose: () => void
}

export function YouTubePlayerPanel({ work, score, onClose }: YouTubePlayerPanelProps) {
  const videoId = youtubeVideoId(work.youtubeUrl)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [status, setStatus] = useState<PlayerStatus>(videoId ? 'loading' : 'error')
  const [errorMessage, setErrorMessage] = useState(videoId ? '' : 'Ссылка на запись повреждена.')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(work.durationSeconds ?? 0)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const syncTimeline = () => {
    const player = videoRef.current
    if (!player) return
    if (Number.isFinite(player.currentTime)) setCurrentTime(player.currentTime)
    if (Number.isFinite(player.duration) && player.duration > 0) setDuration(player.duration)
  }

  const togglePlayback = () => {
    const player = videoRef.current
    if (!player) return
    if (player.paused) void player.play()
    else player.pause()
  }

  const retry = () => {
    setStatus('loading')
    setErrorMessage('')
    setCurrentTime(0)
    setDuration(work.durationSeconds ?? 0)
    setReloadKey((current) => current + 1)
  }

  return (
    <section className="youtube-player-panel" role="dialog" aria-modal="true" aria-label={`Прослушивание ${work.title}`}>
      <header>
        <div>
          <span className="mono-label">// LISTENING / YOUTUBE</span>
          <strong>{work.title}</strong>
          <small>{work.channel}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть онлайн-плеер">
          <X size={17} />
        </button>
      </header>
      <div className="youtube-player-panel__frame">
        {videoId && (
          <video
            key={reloadKey}
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            src={`/api/v1/youtube/stream/${videoId}?reload=${reloadKey}`}
            onLoadedMetadata={() => {
              syncTimeline()
              setStatus('ready')
            }}
            onTimeUpdate={syncTimeline}
            onDurationChange={syncTimeline}
            onPlay={() => setStatus('playing')}
            onPause={() => setStatus((current) => current === 'error' ? current : 'paused')}
            onError={() => {
              setErrorMessage('Не удалось получить видеопоток. Попробуйте ещё раз.')
              setStatus('error')
            }}
          />
        )}
        {(status === 'loading' || status === 'error') && (
          <div className={`youtube-player-panel__overlay youtube-player-panel__overlay--${status}`}>
            {status === 'error' ? (
              <>
                <strong>{errorMessage}</strong>
                {videoId && (
                  <button type="button" onClick={retry}>
                    <RotateCcw size={15} /> Попробовать снова
                  </button>
                )}
              </>
            ) : (
              <span className="youtube-player-panel__loading">ПОДГОТАВЛИВАЕМ ВИДЕОПОТОК</span>
            )}
          </div>
        )}
      </div>
      <div className="youtube-player-panel__controls">
        {(status === 'ready' || status === 'playing' || status === 'paused') && (
          <button className="youtube-player-panel__pause" type="button" onClick={togglePlayback}>
            {status === 'playing' ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            {status === 'playing' ? 'Пауза' : 'Воспроизвести'}
          </button>
        )}
        <span>Источник: YouTube · воспроизведение внутри сайта</span>
      </div>
      {score ? (
        <SynchronizedScoreViewer
          catalogId={score.catalogId}
          workId={score.workId}
          title={work.title}
          currentTime={currentTime}
          duration={duration}
          isPlaying={status === 'playing'}
        />
      ) : (
        <p className="score-following__missing">SHEET для этого произведения пока готовится.</p>
      )}
    </section>
  )
}
