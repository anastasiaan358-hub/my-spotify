export interface YouTubeWork {
  key: string
  title: string
  youtubeUrl: string
  youtubeTitle: string
  channel: string
  confidence: string
  playbackStatus?: 'playable' | 'restricted' | 'unavailable' | 'not-embeddable' | 'no-audio' | 'transient-error' | 'not-checked'
  verifiedAt?: string | null
  durationSeconds?: number | null
  playableInEmbed?: boolean | null
  inheritedFrom?: string
}

export interface YouTubeComposerWorks {
  availableCount: number
  works: Record<string, YouTubeWork>
}

export interface YouTubeCatalog {
  generatedAt: string
  source: 'YouTube'
  playbackMode: 'visible-embed'
  totalAvailable: number
  publishedCount: number
  remainingCount: number
  playbackAudit?: {
    method: string
    uniqueVideos: number
    statuses: Record<string, number>
  }
  artists: Record<string, YouTubeComposerWorks>
}

export function isVerifiedPlayable(work: YouTubeWork | undefined) {
  return Boolean(work && (work.playbackStatus === undefined || work.playbackStatus === 'playable'))
}

export function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const videoId = hostname === 'youtu.be'
      ? pathParts[0]
      : parsed.searchParams.get('v')
        ?? (['embed', 'live', 'shorts'].includes(pathParts[0] ?? '') ? pathParts[1] : null)
    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null
  } catch {
    return null
  }
}
