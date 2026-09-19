export const STICKER_SETTING_KEY = 'nickname_sticker'

export const presetStickers = Array.from({ length: 50 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  return {
    id: `sticker-${number}`,
    src: `/stickers/sticker-${number}.jpg`,
    label: `Стикер ${index + 1}`,
  }
})

export type PresetSticker = (typeof presetStickers)[number]

export function getPresetSticker(settings: Record<string, unknown> | undefined) {
  const selectedId = settings?.[STICKER_SETTING_KEY]
  if (typeof selectedId !== 'string') return undefined
  return presetStickers.find((sticker) => sticker.id === selectedId)
}
