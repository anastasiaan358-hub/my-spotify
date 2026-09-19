export const AVATAR_SETTING_KEY = 'avatar_preset'

export const presetAvatars = Array.from({ length: 20 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  return {
    id: `avatar-${number}`,
    src: `/avatars/avatar-${number}.jpg`,
    label: `Аватар ${index + 1}`,
  }
})

export type PresetAvatar = (typeof presetAvatars)[number]

export function getPresetAvatar(settings: Record<string, unknown> | undefined) {
  const selectedId = settings?.[AVATAR_SETTING_KEY]
  if (typeof selectedId !== 'string') return undefined
  return presetAvatars.find((avatar) => avatar.id === selectedId)
}
