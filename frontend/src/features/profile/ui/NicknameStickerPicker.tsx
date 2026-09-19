import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, LoaderCircle, X } from 'lucide-react'
import type { Profile } from '../../auth/api/authApi'
import { updateProfile } from '../../auth/api/authApi'
import { getPresetSticker, presetStickers, STICKER_SETTING_KEY } from '../model/stickers'

interface NicknameStickerPickerProps {
  settings: Record<string, unknown> | undefined
}

export function NicknameStickerPicker({ settings }: NicknameStickerPickerProps) {
  const queryClient = useQueryClient()
  const sticker = getPresetSticker(settings)
  const mutation = useMutation({
    mutationFn: (nextId: string) => {
      const nextSettings = { ...(settings ?? {}) }
      if (nextId) nextSettings[STICKER_SETTING_KEY] = nextId
      else delete nextSettings[STICKER_SETTING_KEY]
      return updateProfile({ settings: nextSettings })
    },
    onSuccess: (data: Profile) => queryClient.setQueryData(['profile'], data),
  })

  return (
    <div className="nickname-sticker-picker">
      <button
        className={`nickname-sticker-trigger${sticker ? '' : ' nickname-sticker-trigger--empty'}`}
        type="button"
        aria-label={sticker ? `Сменить ${sticker.label.toLowerCase()}` : 'Выбрать стикер к нику'}
        aria-haspopup="dialog"
        title={sticker ? 'Сменить стикер' : 'Выбрать стикер'}
      >
        {mutation.isPending
          ? <LoaderCircle className="spin" aria-hidden="true" />
          : sticker
            ? <img src={sticker.src} alt="" />
            : <span aria-hidden="true" />}
      </button>

      <div className="nickname-sticker-picker__popover" role="dialog" aria-label="Выбор стикера">
        <div className="nickname-sticker-picker__panel">
          <div className="nickname-sticker-picker__header">
            <span>Выберите стикер / 50</span>
            <button
              type="button"
              aria-label="Убрать стикер"
              title="Убрать стикер"
              disabled={mutation.isPending || !sticker}
              onClick={() => mutation.mutate('')}
            >
              <X size={15} />
            </button>
          </div>
          <div className="nickname-sticker-picker__grid" role="group" aria-label="Доступные стикеры">
            {presetStickers.map((option) => {
              const isSelected = sticker?.id === option.id
              return (
                <button
                  className={isSelected ? 'is-selected' : ''}
                  key={option.id}
                  type="button"
                  aria-label={`Выбрать ${option.label.toLowerCase()}`}
                  aria-pressed={isSelected}
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(option.id)}
                >
                  <img src={option.src} alt="" />
                  {isSelected ? <i aria-hidden="true"><Check size={11} /></i> : null}
                </button>
              )
            })}
          </div>
          {mutation.isError ? <span className="nickname-sticker-picker__error" role="alert">Не удалось сохранить стикер</span> : null}
        </div>
      </div>
    </div>
  )
}
