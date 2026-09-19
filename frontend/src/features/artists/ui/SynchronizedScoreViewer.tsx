import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface SynchronizedScoreViewerProps {
  catalogId: string
  currentTime: number
  duration: number
  isPlaying: boolean
  title: string
  workId: string
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

export function SynchronizedScoreViewer({
  catalogId,
  currentTime,
  duration,
  isPlaying,
  title,
  workId,
}: SynchronizedScoreViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<HTMLElement[]>([])
  const [pageCount, setPageCount] = useState(0)
  const [renderedPages, setRenderedPages] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let destroyLoadingTask: (() => Promise<void>) | undefined

    setError(false)
    setPageCount(0)
    setRenderedPages(0)
    pageRefs.current = []
    container.replaceChildren()

    void import('pdfjs-dist')
      .then(async ({ GlobalWorkerOptions, getDocument }) => {
        if (cancelled) return
        GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const loadingTask = getDocument({ url: `/api/v1/scores/${catalogId}/${workId}` })
        destroyLoadingTask = () => loadingTask.destroy()
        const pdf = await loadingTask.promise
        setPageCount(pdf.numPages)

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return
          const page = await pdf.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })
          const availableWidth = Math.min(Math.max(container.clientWidth - 24, 280), 920)
          const cssScale = availableWidth / baseViewport.width
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
          const viewport = page.getViewport({ scale: cssScale * pixelRatio })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`
          canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`
          canvas.setAttribute('aria-label', `Страница ${pageNumber} из ${pdf.numPages}`)
          const canvasContext = canvas.getContext('2d')
          if (!canvasContext) throw new Error('Canvas 2D is unavailable')

          await page.render({ canvas, canvasContext, viewport, background: '#fff' }).promise
          if (cancelled) return

          const sheet = document.createElement('article')
          sheet.className = 'score-following__sheet'
          const label = document.createElement('span')
          label.textContent = `${String(pageNumber).padStart(2, '0')} / ${String(pdf.numPages).padStart(2, '0')}`
          const cursor = document.createElement('div')
          cursor.className = 'score-following__cursor'
          cursor.setAttribute('aria-hidden', 'true')
          const cursorLabel = document.createElement('span')
          cursorLabel.textContent = 'СЕЙЧАС'
          cursor.append(cursorLabel)
          sheet.append(canvas, cursor, label)
          container.append(sheet)
          pageRefs.current.push(sheet)
          setRenderedPages(pageNumber)
        }
      })
      .catch((renderError: unknown) => {
        if (!cancelled) {
          console.error('Synchronized score rendering failed', renderError)
          setError(true)
        }
      })

    return () => {
      cancelled = true
      container.replaceChildren()
      pageRefs.current = []
      void destroyLoadingTask?.()
    }
  }, [catalogId, workId])

  useEffect(() => {
    if (!pageRefs.current.length) return
    const normalizedProgress = duration > 0
      ? Math.min(Math.max(currentTime / duration, 0), 0.999999)
      : 0
    const pagePosition = normalizedProgress * pageRefs.current.length
    const activePageIndex = Math.min(Math.floor(pagePosition), pageRefs.current.length - 1)
    const progressOnPage = pagePosition - activePageIndex

    pageRefs.current.forEach((page, index) => {
      page.classList.toggle('is-current', index === activePageIndex)
    })
    const activePage = pageRefs.current[activePageIndex]
    activePage.style.setProperty('--score-cursor-position', `${progressOnPage * 100}%`)

    if (isPlaying && containerRef.current) {
      const container = containerRef.current
      const desiredTop = activePage.offsetTop
        + activePage.offsetHeight * progressOnPage
        - container.clientHeight * 0.42
      container.scrollTo({ top: Math.max(0, desiredTop), behavior: 'smooth' })
    }
  }, [currentTime, duration, isPlaying, renderedPages])

  const progress = duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0

  return (
    <section className="score-following" aria-label={`Ноты ${title}`}>
      <header>
        <div>
          <span className="mono-label">// SHEET / FOLLOW PLAYBACK</span>
          <strong>Ноты следуют за музыкой</strong>
        </div>
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </header>
      <div className="score-following__meter" aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      {!error && (pageCount === 0 || renderedPages < pageCount) && (
        <div className="score-following__loading">
          <LoaderCircle className="spin" size={14} />
          Рендер страниц: {renderedPages} / {pageCount || '…'}
        </div>
      )}
      {error && <p className="score-following__error">Не удалось загрузить ноты для синхронного просмотра.</p>}
      <div
        className="score-following__pages"
        ref={containerRef}
        tabIndex={0}
        aria-label="Ноты с курсором воспроизведения"
      />
      <p className="score-following__note">
        Позиция рассчитывается по времени записи и распределяется по страницам партитуры.
      </p>
    </section>
  )
}
