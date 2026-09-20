export interface VkAudioWork {
  key: string
  title: string
  performer: string
  streamUrl: string
  mediaType: 'audio'
  sourceName: 'VK'
  bytes: number
  durationSeconds?: number
  playbackStatus: 'playable' | 'missing' | 'corrupt'
  verifiedAt: string
}

export interface VkAudioComposerWorks {
  availableCount: number
  works: Record<string, VkAudioWork>
}

export interface VkAudioCatalog {
  generatedAt: string
  playbackMode: 'local-vk-audio'
  availableCount: number
  artists: Record<string, VkAudioComposerWorks>
}

const EMPTY_VK_AUDIO_CATALOG: VkAudioCatalog = {
  generatedAt: '',
  playbackMode: 'local-vk-audio',
  availableCount: 0,
  artists: {},
}

export async function loadVkAudioCatalog() {
  const response = await fetch('/classical/catalog/vk-audio.json')
  if (response.status === 404) return EMPTY_VK_AUDIO_CATALOG
  if (!response.ok) throw new Error(`VK audio catalog ${response.status}`)
  return response.json() as Promise<VkAudioCatalog>
}

export function isVerifiedVkPlayable(work: VkAudioWork | undefined) {
  return Boolean(
    work
    && work.playbackStatus === 'playable'
    && work.mediaType === 'audio'
    && work.streamUrl.startsWith('/classical/audio/vk/')
    && work.streamUrl.toLocaleLowerCase().endsWith('.mp3'),
  )
}

function normalizeTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .trim()
}

export function findDownloadedBotAudio(catalog: VkAudioCatalog | null, artistId: string, title: string) {
  const expected = normalizeTitle(title)
  return Object.values(catalog?.artists[artistId]?.works ?? {}).find((work) => {
    if (!isVerifiedVkPlayable(work)) return false
    const candidate = normalizeTitle(work.title)
    return candidate === expected || candidate.startsWith(`${expected} `) || expected.startsWith(`${candidate} `)
  })
}
