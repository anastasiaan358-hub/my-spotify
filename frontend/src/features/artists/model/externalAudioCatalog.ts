export interface ExternalAudioWork {
  key: string
  title: string
  provider: 'Internet Archive' | 'Wikimedia Commons' | 'Mutopia Project' | 'Musopen' | 'Openverse' | 'Gallica'
  sourceType: 'internet-archive' | 'wikimedia-commons' | 'mutopia-midi' | 'musopen' | 'openverse' | 'gallica'
  streamUrl: string
  sourceUrl: string
  sourceTitle: string
  trackTitle: string
  performer: string
  license: string
  durationSeconds?: number | null
  confidence: number
  playbackStatus: 'playable'
  mediaType?: 'audio' | 'midi'
}

export interface ExternalAudioComposerWorks {
  availableCount: number
  works: Record<string, ExternalAudioWork>
}

export interface ExternalAudioCatalog {
  generatedAt: string
  playbackMode: 'remote-audio'
  searchedUniqueWorks: number
  availableUniqueWorks: number
  artists: Record<string, ExternalAudioComposerWorks>
}

export function isVerifiedExternalPlayable(work: ExternalAudioWork | undefined) {
  return Boolean(work?.streamUrl && work.playbackStatus === 'playable')
}
