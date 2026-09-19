import { Midi } from '@tonejs/midi'
import {
  Heart,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getTransport, Part, PolySynth, start as startAudioContext } from 'tone'
import { usePlayerStore } from '../model/playerStore'

interface MidiEvent {
  time: number
  name: string
  duration: number
  velocity: number
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const rounded = Math.floor(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

export function PlayerBar() {
  const { currentTrack, isPlaying, togglePlayback, setPlaying, volume, setVolume } = usePlayerStore()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const midiPartRef = useRef<Part<MidiEvent> | null>(null)
  const synthRef = useRef<PolySynth | null>(null)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  useEffect(() => {
    let cancelled = false

    if (!currentTrack?.streamUrl) return

    const transport = getTransport()
    transport.stop()
    transport.cancel()
    transport.seconds = 0
    midiPartRef.current?.dispose()
    midiPartRef.current = null
    synthRef.current?.dispose()
    synthRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    queueMicrotask(() => {
      if (!cancelled) {
        setPosition(0)
        setDuration((currentTrack.durationMs ?? 0) / 1000)
        setIsLoading(currentTrack.mediaType === 'midi')
      }
    })

    if (currentTrack.mediaType === 'midi') {
      void fetch(currentTrack.streamUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`MIDI ${response.status}`)
          return response.arrayBuffer()
        })
        .then((buffer) => {
          if (cancelled) return
          const midi = new Midi(buffer)
          const events: MidiEvent[] = midi.tracks.flatMap((track) => track.notes.map((note) => ({
            time: note.time,
            name: note.name,
            duration: Math.max(.04, note.duration),
            velocity: Math.max(.08, note.velocity * .42),
          })))
          const synth = new PolySynth({ maxPolyphony: 48 }).toDestination()
          synth.volume.value = -22 + usePlayerStore.getState().volume * 12
          const part = new Part<MidiEvent>((time, note) => {
            synth.triggerAttackRelease(note.name, note.duration, time, note.velocity)
          }, events).start(0)
          synthRef.current = synth
          midiPartRef.current = part
          setDuration(midi.duration)
          setIsLoading(false)
          if (usePlayerStore.getState().isPlaying) transport.start()
        })
        .catch(() => {
          if (!cancelled) {
            setIsLoading(false)
            setPlaying(false)
          }
        })
    } else {
      const audio = new Audio(currentTrack.streamUrl)
      audio.preload = 'metadata'
      audio.volume = usePlayerStore.getState().volume
      audio.addEventListener('loadedmetadata', () => {
        if (!cancelled) setDuration(audio.duration)
      })
      audio.addEventListener('ended', () => setPlaying(false))
      audioRef.current = audio
      if (usePlayerStore.getState().isPlaying) void audio.play().catch(() => setPlaying(false))
    }

    return () => {
      cancelled = true
      audioRef.current?.pause()
      transport.stop()
      transport.cancel()
      midiPartRef.current?.dispose()
      synthRef.current?.dispose()
    }
  }, [currentTrack?.id, currentTrack?.durationMs, currentTrack?.mediaType, currentTrack?.streamUrl, setPlaying])

  useEffect(() => {
    const transport = getTransport()
    if (currentTrack?.mediaType === 'midi') {
      if (isPlaying && midiPartRef.current) transport.start()
      if (!isPlaying) {
        transport.pause()
        synthRef.current?.releaseAll()
      }
    } else if (audioRef.current) {
      if (isPlaying) void audioRef.current.play().catch(() => setPlaying(false))
      else audioRef.current.pause()
    }
  }, [currentTrack?.mediaType, isPlaying, setPlaying])

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setInterval(() => {
      const nextPosition = currentTrack?.mediaType === 'midi'
        ? getTransport().seconds
        : (audioRef.current?.currentTime ?? 0)
      setPosition(nextPosition)
      if (duration > 0 && nextPosition >= duration) {
        getTransport().stop()
        setPlaying(false)
      }
    }, 200)
    return () => window.clearInterval(timer)
  }, [currentTrack?.mediaType, duration, isPlaying, setPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    if (synthRef.current) synthRef.current.volume.value = -22 + volume * 12
  }, [volume])

  const handlePlayback = async () => {
    if (currentTrack?.mediaType === 'midi') await startAudioContext()
    togglePlayback()
  }

  return (
    <footer className="player" aria-label="Музыкальный плеер">
      <div className="player__track">
        <div className="player__cover">{currentTrack ? currentTrack.title.slice(0, 1) : '♪'}</div>
        <div className="player__track-copy">
          <strong>{currentTrack?.title ?? 'Выберите произведение'}</strong>
          <span>
            {currentTrack?.artist ?? 'Архив музыки Возрождения готов'}
            {currentTrack?.sourceLabel ? ` · ${currentTrack.sourceLabel}` : ''}
          </span>
        </div>
        <button className="icon-button icon-button--quiet" type="button" aria-label="Добавить в любимое" disabled={!currentTrack}><Heart size={18} /></button>
      </div>
      <div className="player__controls">
        <div className="player__buttons">
          <button className="icon-button icon-button--quiet" type="button" aria-label="Перемешать" disabled={!currentTrack}><Shuffle size={17} /></button>
          <button className="icon-button icon-button--quiet" type="button" aria-label="Предыдущее произведение" disabled={!currentTrack}><SkipBack size={19} fill="currentColor" /></button>
          <button className="play-button" type="button" aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'} onClick={handlePlayback} disabled={!currentTrack?.streamUrl || isLoading}>
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="icon-button icon-button--quiet" type="button" aria-label="Следующее произведение" disabled={!currentTrack}><SkipForward size={19} fill="currentColor" /></button>
          <button className="icon-button icon-button--quiet" type="button" aria-label="Повтор" disabled={!currentTrack}><Repeat2 size={17} /></button>
        </div>
        <div className="player__timeline">
          <span>{formatTime(position)}</span>
          <div className="range-track"><i style={{ width: `${progress}%` }} /></div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <div className="player__extras">
        <ListMusic size={18} />
        <Volume2 size={18} />
        <input aria-label="Громкость" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
        <Maximize2 size={17} />
      </div>
    </footer>
  )
}
