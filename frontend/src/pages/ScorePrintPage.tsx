import { ArrowLeft, Download, LoaderCircle, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getArtist } from '../features/artists/model/artists'

interface PrintableWork {
  id: string
  title: string
  printUrl?: string
  printLicense?: string
}

interface PublicWorksCatalog {
  artists: Record<string, { works: PrintableWork[] }>
}

function PrintableScoreViewer({ url, title }: { url: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState('Загружаем PDF')
  const [error, setError] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let destroyLoadingTask: (() => Promise<void>) | undefined

    void import('pdfjs-dist')
      .then(async ({ GlobalWorkerOptions, getDocument }) => {
        if (cancelled) return
        GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const loadingTask = getDocument({ url })
        destroyLoadingTask = () => loadingTask.destroy()
        const pdf = await loadingTask.promise
        setProgress(`0 / ${pdf.numPages}`)
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return
          const page = await pdf.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })
          const availableWidth = Math.min(Math.max(container.clientWidth - 24, 260), 1100)
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
          sheet.className = 'score-print-sheet'
          const label = document.createElement('span')
          label.textContent = `${String(pageNumber).padStart(2, '0')} / ${String(pdf.numPages).padStart(2, '0')}`
          sheet.append(canvas, label)
          container.append(sheet)
          setProgress(`${pageNumber} / ${pdf.numPages}`)
        }
        setProgress('')
      })
      .catch((renderError: unknown) => {
        if (!cancelled) {
          console.error('Printable score rendering failed', renderError)
          setProgress('')
          setError(true)
        }
      })

    return () => {
      cancelled = true
      container.replaceChildren()
      void destroyLoadingTask?.()
    }
  }, [url])

  return (
    <section className="score-print-viewer" aria-label={`SHEET ${title}`}>
      {!error && progress && <div className="score-print-progress"><LoaderCircle className="spin" size={15} /> Рендер страниц: {progress}</div>}
      {error && <p className="score-print-error">Не удалось загрузить PDF. Повторите попытку позже.</p>}
      <div className="score-print-pages" ref={containerRef} tabIndex={0} aria-label="Страницы партитуры" />
    </section>
  )
}

export function ScorePrintPage() {
  const { catalogId, workId } = useParams()
  const [work, setWork] = useState<PrintableWork | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void fetch('/classical/catalog/imslp-works.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Scores ${response.status}`)
        return response.json() as Promise<PublicWorksCatalog>
      })
      .then((payload) => {
        if (cancelled) return
        const found = catalogId && workId
          ? payload.artists[catalogId]?.works.find((item) => item.id === workId && item.printUrl) ?? null
          : null
        setWork(found)
      })
      .catch(() => {
        if (!cancelled) setWork(null)
      })
    return () => { cancelled = true }
  }, [catalogId, workId])

  const backRoute = catalogId && getArtist(catalogId)
    ? `/artists/${catalogId}`
    : `/artists/archive/${catalogId ?? ''}`

  if (work === undefined) {
    return <section className="simple-page catalog-missing"><span className="eyebrow">LOADING / SCORE</span><h1>Загружаем ноты</h1></section>
  }

  if (!work?.printUrl) {
    return (
      <section className="simple-page catalog-missing">
        <span className="eyebrow">404 / SCORE</span>
        <h1>SHEET пока недоступен</h1>
        <Link className="secondary-button" to={backRoute}><ArrowLeft size={16} /> К произведениям</Link>
      </section>
    )
  }

  const scoreUrl = `/api/v1/scores/${catalogId}/${work.id}`

  return (
    <div className="score-print-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to={backRoute}><ArrowLeft size={14} /> К произведениям</Link>
        <span>/</span>
        <span>{work.title}</span>
      </nav>

      <header className="score-print-header">
        <div>
          <span className="mono-label">// SHEET / PDF</span>
          <h1>{work.title}</h1>
          {work.printLicense && <p>{work.printLicense.replace(/\{\{.*?\}\}/g, '').trim()}</p>}
        </div>
        <div className="score-print-actions">
          <button type="button" onClick={() => window.print()}><Printer size={15} /> Печать</button>
          <a href={`${scoreUrl}?download=1`}><Download size={15} /> Скачать PDF</a>
        </div>
      </header>

      <PrintableScoreViewer url={scoreUrl} title={work.title} />
    </div>
  )
}
