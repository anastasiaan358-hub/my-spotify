export interface AncientPlaybackWork {
  workId: string
  title: string
  sourceType: 'youtube' | 'external-audio'
  youtubeUrl?: string
  youtubeTitle?: string
  channel?: string
  streamUrl?: string
  provider?: string
  mediaType?: 'audio' | 'midi'
  durationSeconds?: number | null
  playbackStatus: 'playable'
  interpretation: 'notation-performance' | 'modern-interpretation'
  verification: string
}

export interface AncientPlaybackCatalog {
  generatedAt: string
  method: string
  totalWorks: number
  availableCount: number
  youtubeCount: number
  externalAudioCount: number
  missingCount: number
  works: Record<string, AncientPlaybackWork>
  missing: Array<{
    workId: string
    title: string
    reason: string
  }>
}
