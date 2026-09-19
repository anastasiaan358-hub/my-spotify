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
  return Boolean(work && work.playbackStatus === 'playable' && work.streamUrl)
}
