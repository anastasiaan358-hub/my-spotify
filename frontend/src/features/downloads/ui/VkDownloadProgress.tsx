import { useQuery } from '@tanstack/react-query'
import { Check, Clock3, LoaderCircle } from 'lucide-react'

interface VkDownloadStatus {
  updatedAt: string
  state: 'starting' | 'searching' | 'running' | 'rate_limited' | 'network_wait' | 'scheduled_pause' | 'complete'
  totalCount: number
  currentIndex: number
  checkedCount: number
  retryPendingCount?: number
  downloadedCount: number
  notFoundCount: number
  errorCount: number
  currentQuery: string
  message: string
  retryAt?: string
}

async function getVkDownloadStatus() {
  const response = await fetch(
    `/classical/catalog/vk-download-status.json?t=${Date.now()}`,
    { cache: 'no-store' },
  )
  if (!response.ok) throw new Error(`VK download status ${response.status}`)
  return response.json() as Promise<VkDownloadStatus>
}

function statusLabel(status: VkDownloadStatus) {
  if (status.state === 'complete') return 'Каталог проверен'
  if (status.state === 'rate_limited') return 'Пауза VK / автоповтор'
  if (status.state === 'network_wait') return 'Нет сети / автоповтор'
  if (status.state === 'scheduled_pause') return 'Плановая пауза VK'
  if (status.state === 'starting') return 'Подготовка очереди'
  return 'Скачивание из VK'
}

export function VkDownloadProgress() {
  const status = useQuery({
    queryKey: ['vk-download-status'],
    queryFn: getVkDownloadStatus,
    refetchInterval: 5_000,
    retry: false,
  })

  if (!status.data) return null

  const data = status.data
  const progress = data.totalCount > 0
    ? Math.min(100, Math.max(0, data.currentIndex / data.totalCount * 100))
    : 0
  const retryTime = data.retryAt
    ? new Date(data.retryAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null
  const isPaused = data.state === 'rate_limited' || data.state === 'network_wait' || data.state === 'scheduled_pause'
  const Icon = data.state === 'complete' ? Check : isPaused ? Clock3 : LoaderCircle

  return (
    <section className={`vk-download-status vk-download-status--${data.state}`} aria-live="polite">
      <span className="vk-download-status__icon">
        <Icon className={data.state === 'searching' || data.state === 'running' ? 'spin' : undefined} size={17} />
      </span>
      <div className="vk-download-status__summary">
        <strong>{statusLabel(data)}</strong>
        <small>{data.downloadedCount} MP3 · {data.checkedCount} проверено · {data.retryPendingCount ?? 0} ждут повтора</small>
      </div>
      <div className="vk-download-status__current">
        <span>{data.currentQuery || data.message}</span>
        <div aria-label={`Прогресс ${progress.toFixed(1)}%`}><i style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="vk-download-status__counter">
        <strong>{String(data.currentIndex).padStart(4, '0')} / {data.totalCount}</strong>
        <small>{isPaused && retryTime ? `ПОВТОР В ${retryTime}` : `${progress.toFixed(1)}%`}</small>
      </div>
    </section>
  )
}
