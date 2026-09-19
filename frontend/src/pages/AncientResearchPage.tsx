import { ArrowLeft, BookOpen, CheckCircle2, Database, ExternalLink, FileMusic, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  academicSources,
  pendingAncientDocumentCount,
  pendingSubstantialDocuments,
  researchAxes,
  researchUpdatedAt,
  shortAncientDocuments,
} from '../features/ancient-music/model/ancientAcademicResearch'
import type { AdditionalAncientDocument } from '../features/ancient-music/model/ancientAcademicResearch'
import { ancientWorkCount } from '../features/ancient-music/model/ancientMusic'

function DocumentRegister({ documents }: { documents: AdditionalAncientDocument[] }) {
  return (
    <div className="ancient-document-register" role="list">
      {documents.map((document, index) => (
        <article key={document.id} role="listitem" className="ancient-document-row">
          <span className="ancient-document-row__index">{String(index + 1).padStart(2, '0')}</span>
          <div className="ancient-document-row__identity">
            <h3>{document.title}</h3>
            <p>{document.carrier}</p>
          </div>
          <div className="ancient-document-row__meta">
            <span>{document.date}</span>
            <strong>{document.genre}</strong>
          </div>
          <b>{document.dagm}</b>
          <span className={`ancient-document-status ${document.status === 'Готов к карточке' ? 'is-ready' : ''}`}>
            {document.status === 'Готов к карточке' ? <CheckCircle2 size={13} /> : <TriangleAlert size={13} />}
            {document.status}
          </span>
          <p className="ancient-document-row__note">{document.note}</p>
          <a href={document.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Открыть академический указатель для ${document.title}`}>
            <ExternalLink size={14} />
          </a>
        </article>
      ))}
    </div>
  )
}

export function AncientResearchPage() {
  const readyCount = pendingSubstantialDocuments.filter((document) => document.status === 'Готов к карточке').length
  const openAccessCount = academicSources.filter((source) => source.access === 'Открытый доступ').length

  return (
    <div className="ancient-page ancient-research-page">
      <header className="ancient-research-hero">
        <div>
          <Link className="ancient-research-back" to="/ancient-music">
            <ArrowLeft size={14} /> Назад к каталогу
          </Link>
          <span className="mono-label">// RESEARCH DOSSIER / VERSION 01</span>
          <h1 aria-label="АКАДЕМИЧЕСКИЙ ОБЗОР">АКАДЕМИЧЕСКИЙ<br />ОБЗОР</h1>
        </div>
        <div className="ancient-research-hero__summary">
          <p>
            Проверяем каталог по критическим изданиям, цифровым корпусам, археомузыкологии и учебной литературе для музыкальных вузов. Отдельно фиксируем памятники, которые ещё не перенесены в карточки.
          </p>
          <dl>
            <div><dt>В каталоге</dt><dd>{ancientWorkCount}</dd></div>
            <div><dt>Найдено ещё</dt><dd>{pendingAncientDocumentCount}</dd></div>
            <div><dt>Источники</dt><dd>{academicSources.length}</dd></div>
            <div><dt>Open access</dt><dd>{openAccessCount}</dd></div>
          </dl>
          <small>Обновлено: {researchUpdatedAt}</small>
        </div>
      </header>

      <section className="ancient-research-method" aria-labelledby="research-method-heading">
        <div className="ancient-research-method__mark"><BookOpen size={30} /></div>
        <div>
          <span className="mono-label">00 / ГРАНИЦЫ ИССЛЕДОВАНИЯ</span>
          <h2 id="research-method-heading">КАК СОБРАН ОБЗОР</h2>
          <p>
            Это систематический и обновляемый обзор, а не заявление о прочтении всей когда-либо опубликованной литературы. За основу взяты стандартное издание DAGM, база dDAGM, реестр мелодий Стефана Хагеля и профильные исследования отдельных традиций. Закрытые публикации отмечены как библиографические записи: их наличие не означает, что полный текст свободно доступен.
          </p>
        </div>
        <div className="ancient-research-method__rules">
          <span><CheckCircle2 size={14} /> Памятник отделён от современной реконструкции.</span>
          <span><CheckCircle2 size={14} /> Неуверенные жанры и атрибуции сохраняют знак вопроса.</span>
          <span><CheckCircle2 size={14} /> Номер DAGM не превращается в вымышленное название пьесы.</span>
        </div>
      </section>

      <section className="ancient-research-section" aria-labelledby="research-axes-heading">
        <header className="ancient-section-heading">
          <div>
            <span className="mono-label">01 / EVIDENCE MAP</span>
            <h2 id="research-axes-heading">ЧТО МОЖНО УТВЕРЖДАТЬ</h2>
          </div>
          <p>Одинаковая кнопка воспроизведения не означает одинаковую степень исторической достоверности звука.</p>
        </header>
        <div className="ancient-research-axes">
          {researchAxes.map((axis, index) => (
            <article key={axis.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{axis.title}</h3>
              <dl>
                <div><dt>Корпус</dt><dd>{axis.corpus}</dd></div>
                <div><dt>Вывод</dt><dd>{axis.conclusion}</dd></div>
                <div><dt>Правило каталога</dt><dd>{axis.catalogRule}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="ancient-research-section" aria-labelledby="additional-documents-heading">
        <header className="ancient-section-heading">
          <div>
            <span className="mono-label">02 / DAGM GAP REGISTER</span>
            <h2 id="additional-documents-heading">ДРУГИЕ ПАМЯТНИКИ</h2>
          </div>
          <p>
            {pendingSubstantialDocuments.length} достаточно протяжённых нотированных позиций пока отсутствуют в основном каталоге. {readyCount} из них уже имеет устойчивое название и атрибуцию; остальные должны оставаться карточками фрагментов.
          </p>
        </header>
        <DocumentRegister documents={pendingSubstantialDocuments} />
      </section>

      <section className="ancient-research-section" aria-labelledby="short-documents-heading">
        <header className="ancient-section-heading">
          <div>
            <span className="mono-label">03 / COMPLETE DAGM PASS</span>
            <h2 id="short-documents-heading">КОРОТКИЕ ДОКУМЕНТЫ</h2>
          </div>
          <p>
            Ещё {shortAncientDocuments.length} позиций найдены при проверке полного содержания стандартного издания DAGM. Сюда входят единичные сигналы, малые папирусные обрывки, косвенно засвидетельствованные установки и учебные мелодии.
          </p>
        </header>
        <DocumentRegister documents={shortAncientDocuments} />
      </section>

      <section className="ancient-research-section" aria-labelledby="bibliography-heading">
        <header className="ancient-section-heading">
          <div>
            <span className="mono-label">04 / WORKING BIBLIOGRAPHY</span>
            <h2 id="bibliography-heading">ТЕОРИЯ И ИЗДАНИЯ</h2>
          </div>
          <p>Русская вузовская теория сопоставлена с международными критическими изданиями, цифровыми данными и исследованиями конкретных носителей.</p>
        </header>
        <div className="ancient-bibliography">
          {academicSources.map((source, index) => (
            <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
              <span className="ancient-bibliography__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="ancient-bibliography__icon">
                {source.kind === 'Цифровой корпус' ? <Database size={17} /> : <FileMusic size={17} />}
              </span>
              <span className="ancient-bibliography__identity">
                <strong>{source.title}</strong>
                <small>{source.authors} / {source.year}</small>
                <p>{source.scope}</p>
              </span>
              <span className="ancient-bibliography__tags">
                <i>{source.language}</i>
                <i>{source.kind}</i>
                <i>{source.access}</i>
              </span>
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
