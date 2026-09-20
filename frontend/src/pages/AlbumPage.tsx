import { ArrowLeft, ArrowUpRight, Disc3, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAlbum, getArtist, type TrackData } from '../features/artists/model/artists'
import type { VkAudioCatalog } from '../features/artists/model/vkAudioCatalog'
import { findDownloadedBotAudio, loadVkAudioCatalog } from '../features/artists/model/vkAudioCatalog'
import { usePlayerStore } from '../features/player/model/playerStore'

export function AlbumPage() {
  const { artistId, albumId } = useParams()
  const artist = getArtist(artistId)
  const album = getAlbum(artist, albumId)
  const [audioCatalog, setAudioCatalog] = useState<VkAudioCatalog | null>(null)
  const setTrack = usePlayerStore((state) => state.setTrack)

  useEffect(() => {
    let cancelled = false
    void loadVkAudioCatalog()
      .then((catalog) => { if (!cancelled) setAudioCatalog(catalog) })
      .catch(() => { if (!cancelled) setAudioCatalog(null) })
    return () => { cancelled = true }
  }, [])

  if (!artist || !album) {
    return (
      <section className="simple-page catalog-missing">
        <span className="eyebrow">404 / ALBUM</span>
        <h1>Сборник не найден</h1>
        <Link className="secondary-button" to="/artists"><ArrowLeft size={16} /> К композиторам</Link>
      </section>
    )
  }

  const playTrack = (track: TrackData) => {
    const downloaded = findDownloadedBotAudio(audioCatalog, artist.id, track.title)
    if (!downloaded) return
    setTrack({
      id: downloaded.key,
      title: downloaded.title,
      artist: artist.name,
      sourceLabel: 'СКАЧАННЫЙ MP3',
      streamUrl: downloaded.streamUrl,
      mediaType: downloaded.mediaType,
      durationMs: downloaded.durationSeconds ? downloaded.durationSeconds * 1000 : undefined,
    })
  }

  return (
    <div className="catalog-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to={`/artists/${artist.id}`}><ArrowLeft size={14} /> {artist.name}</Link>
        <span>/</span>
        <span>{album.title}</span>
      </nav>

      <section className="album-profile" aria-labelledby="album-name">
        <div className={`album-card__cover album-card__cover--${album.variant} album-profile__cover`}>
          <span>{album.type.toUpperCase()} / {album.year}</span>
          <Disc3 size={104} strokeWidth={1} />
          <strong>{artist.monogram}</strong>
        </div>
        <div className="album-profile__copy">
          <span className="mono-label">// {album.type} / {album.year}</span>
          <h1 id="album-name">{album.title}</h1>
          <Link className="album-profile__artist" to={`/artists/${artist.id}`}>{artist.name} <ArrowUpRight size={15} /></Link>
          <div className="album-profile__stats">
            <span>{album.tracks.length} WORKS</span>
            <span>{artist.genre}</span>
            <span>{album.tracks[0].qualityLabel}</span>
          </div>
          <button className="track-listen-button" type="button" disabled={!findDownloadedBotAudio(audioCatalog, artist.id, album.tracks[0].title)} onClick={() => playTrack(album.tracks[0])}><Play size={16} fill="currentColor" /> {findDownloadedBotAudio(audioCatalog, artist.id, album.tracks[0].title) ? 'Слушать скачанный MP3' : 'MP3 ещё не скачан'}</button>
        </div>
      </section>

      <section className="album-tracklist" aria-labelledby="album-tracks-heading">
        <header className="catalog-section-heading">
          <div><span className="mono-label">// WORK INDEX</span><h2 id="album-tracks-heading">Произведения</h2></div>
          <span>{String(album.tracks.length).padStart(2, '0')} ПОЗИЦИЙ</span>
        </header>
        <div className="album-tracklist__rows">
          {album.tracks.map((track) => (
            <div className="album-track-entry" key={track.id}>
              <Link className="album-track" to={`/artists/${artist.id}/albums/${album.id}/tracks/${track.id}`} aria-label={`Открыть трек ${track.title}`}>
                <span>{String(track.number).padStart(2, '0')}.</span>
                <strong>{track.title}</strong>
                <span>{track.key}</span>
                <span>{track.bpm} BPM</span>
                <span>({track.duration})</span>
                <ArrowUpRight size={18} />
              </Link>
              <button className="album-track__play" type="button" disabled={!findDownloadedBotAudio(audioCatalog, artist.id, track.title)} onClick={() => playTrack(track)} aria-label={`Воспроизвести ${track.title}`} title={findDownloadedBotAudio(audioCatalog, artist.id, track.title) ? 'Воспроизвести скачанный ботом MP3' : 'Файл ещё не скачан ботом'}>
                <Play size={17} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
