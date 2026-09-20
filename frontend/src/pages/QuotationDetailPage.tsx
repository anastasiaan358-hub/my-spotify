import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Music2, Quote } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { composerRoute } from '../features/artists/model/atlasCatalog'
import {
  quotationRecords,
  type QuotationWork,
} from '../features/artists/model/quotationCatalog'

function primaryScoreRoute(work: QuotationWork) {
  if (work.scoreRoute === null) return null
  if (work.scoreRoute) return work.scoreRoute
  const entry = work.catalogEntries?.[0]
  return entry ? `/scores/${entry.artistId}/${entry.workId}` : null
}

function internalWorkRoute(work: QuotationWork) {
  if (work.detailLink && !work.detailLink.external) return work.detailLink.url
  return composerRoute(work.composerId)
}

function WorkCard({ work, label, detail }: { work: QuotationWork; label: string; detail?: string }) {
  const scoreRoute = primaryScoreRoute(work)

  return (
    <article className="quotation-work-card">
      <span>{label}</span>
      <h2>{work.title}</h2>
      <p>{work.composer}{work.date ? ` · ${work.date}` : ''}</p>
      {detail && <small>{detail}</small>}
      <div>
        {work.detailLink?.external
          ? <span>{work.detailLink.label}</span>
          : <Link to={internalWorkRoute(work)}>{work.detailLink?.label ?? 'Композитор'} <ArrowRight size={13} /></Link>}
        {scoreRoute && <Link to={scoreRoute}>SHEET <ArrowUpRight size={13} /></Link>}
      </div>
    </article>
  )
}

export function QuotationDetailPage() {
  const { citationId } = useParams()
  const record = quotationRecords.find((item) => item.id === citationId)

  if (!record) {
    return (
      <section className="simple-page catalog-missing">
        <span className="eyebrow">404 / QUOTATION</span>
        <h1>Связь не найдена</h1>
        <Link className="secondary-button" to="/artists"><ArrowLeft size={16} /> К композиторам</Link>
      </section>
    )
  }

  return (
    <div className="quotation-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to={internalWorkRoute(record.model)}><ArrowLeft size={14} /> К произведениям</Link>
        <span>/</span>
        <span>Музыкальная цитата</span>
      </nav>

      <header className="quotation-hero">
        <div className="quotation-hero__mark" aria-hidden="true"><Quote size={74} strokeWidth={1} /></div>
        <div>
          <span className="mono-label">// QUOTATION RESEARCH / {record.type}</span>
          <h1>{record.title}</h1>
          <p>{record.summary}</p>
        </div>
      </header>

      <section className={`quotation-certainty quotation-certainty--${record.certainty}`} aria-label="Статус атрибуции">
        {record.certainty === 'disputed' ? <AlertTriangle size={19} /> : <BookOpen size={19} />}
        <div>
          <strong>{record.certainty === 'disputed' ? 'АТРИБУЦИЯ СПОРНА' : 'СВЯЗЬ ПОДТВЕРЖДЕНА'}</strong>
          <p>{record.certaintyNote}</p>
        </div>
      </section>

      <section className="quotation-section" aria-labelledby="quotation-chain-heading">
        <header>
          <span className="mono-label">// MODEL → REUSE</span>
          <h2 id="quotation-chain-heading">Цепочка материала</h2>
        </header>
        <div className="quotation-chain">
          <WorkCard work={record.model} label="01 / МОДЕЛЬ" />
          <div className="quotation-chain__arrow" aria-hidden="true"><ArrowRight size={28} /></div>
          <div className="quotation-chain__reuses">
            {record.reuses.map((reuse, index) => (
              <WorkCard
                key={`${reuse.composerId}-${reuse.title}`}
                work={reuse}
                label={`${String(index + 2).padStart(2, '0')} / ПЕРЕРАБОТКА`}
                detail={`${reuse.relation}. ${reuse.evidence}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="quotation-analysis-grid">
        <article className="quotation-section">
          <header><span className="mono-label">// TECHNIQUE</span><h2>Что именно перешло</h2></header>
          <ol>
            {record.techniques.map((technique) => <li key={technique}>{technique}</li>)}
          </ol>
        </article>
        <article className="quotation-section">
          <header><span className="mono-label">// AFTERLIFE</span><h2>Где слышно дальше</h2></header>
          <ol>
            {record.laterTrace.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </article>
      </section>

      <section className="quotation-section quotation-sources" aria-labelledby="quotation-sources-heading">
        <header>
          <span className="mono-label">// BIBLIOGRAPHY / EVIDENCE</span>
          <h2 id="quotation-sources-heading">Источники и литература</h2>
        </header>
        <div>
          {record.sources.map((source, index) => (
            <article key={source.url}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><small>{source.kind}</small><strong>{source.label}</strong><p>{source.reference}</p></div>
            </article>
          ))}
        </div>
      </section>

      <footer className="quotation-method-note">
        <Music2 size={18} />
        <p>Здесь «цитата» означает документированное использование более раннего музыкального материала: буквальную мелодию, мотив, несколько голосов, гармонизацию, реконструкцию или устройство целой модели. Степень сохранности источника и редакторского вмешательства указана отдельно.</p>
      </footer>
    </div>
  )
}
