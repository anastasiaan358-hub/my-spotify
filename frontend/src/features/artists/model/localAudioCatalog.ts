export interface LocalAudioWork {
  key: string
  title: string
  streamUrl: string
  mediaType: 'audio' | 'midi'
  sourceName: string
  sourceUrl: string
  license: string
  bytes: number
  sha256: string
  featuredAsset?: boolean
  inheritedFrom?: string
  playbackStatus?: 'playable' | 'missing' | 'corrupt'
  verifiedAt?: string
}

export interface LocalAudioComposerWorks {
  availableCount: number
  works: Record<string, LocalAudioWork>
}

export interface LocalAudioCatalog {
  generatedAt: string
  playbackMode: 'local-audio'
  totalEntries: number
  importedCount: number
  remainingCount: number
  artists: Record<string, LocalAudioComposerWorks>
}

export function isVerifiedLocalPlayable(work: LocalAudioWork | undefined) {
  return Boolean(work && (work.playbackStatus === undefined || work.playbackStatus === 'playable'))
}
