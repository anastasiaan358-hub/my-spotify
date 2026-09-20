import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronRight, Folder, GitBranch, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { composerLifetime, composerRoute, type AtlasComposer } from '../features/artists/model/atlasCatalog'

interface Country {
  name: string
  slug: string
  composerCount: number
  workPageCount: number
  composers: AtlasComposer[]
}

interface AtlasCatalog {
  generatedAt: string
  definition: string
  composerCount: number
  countryCount: number
  workPageCount: number
  countries: Country[]
}

interface InfluenceNode {
  id: string
  composerId: string
  name: string
  country: string
  years: string
  x: number
  y: number
}

interface InfluenceEdge {
  from: string
  to: string
  kind: 'teacher' | 'school' | 'style' | 'reaction'
  label: string
  summary: string
  sourceTitle: string
  sourceUrl: string
}

interface InfluenceCatalog {
  method: string
  nodes: InfluenceNode[]
  edges: InfluenceEdge[]
}

export function ComposerAtlasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [catalog, setCatalog] = useState<AtlasCatalog | null>(null)
  const [influences, setInfluences] = useState<InfluenceCatalog | null>(null)
  const [query, setQuery] = useState('')
  const periodParam = searchParams.get('period')
  const selectedPeriod = periodParam === 'Renaissance' || periodParam === 'Baroque' ? periodParam : null

  useEffect(() => {
    void Promise.all([
      fetch('/classical/catalog/renaissance-composers.json').then((response) => response.json() as Promise<AtlasCatalog>),
      fetch('/classical/catalog/influences.json').then((response) => response.json() as Promise<InfluenceCatalog>),
    ]).then(([nextCatalog, nextInfluences]) => {
      setCatalog(nextCatalog)
      setInfluences(nextInfluences)
    })
  }, [])

  const visibleCountries = useMemo(() => {
    if (!catalog) return []
    const normalized = query.trim().toLocaleLowerCase('ru')
    return catalog.countries
      .map((country) => ({
        ...country,
        composers: country.composers.filter((composer) => {
          const matchesPeriod = !selectedPeriod || composer.period === selectedPeriod
          const matchesQuery = !normalized
            || `${composer.name} ${composer.country} ${composer.period}`.toLocaleLowerCase('ru').includes(normalized)
          return matchesPeriod && matchesQuery
        }),
      }))
      .map((country) => ({
        ...country,
        workPageCount: country.composers.reduce((total, composer) => total + composer.workCount, 0),
      }))
      .filter((country) => country.composers.length > 0)
  }, [catalog, query, selectedPeriod])

  const selectPeriod = (period: 'Renaissance' | 'Baroque' | null) => {
    const nextParams = new URLSearchParams(searchParams)
    if (period) nextParams.set('period', period)
    else nextParams.delete('period')
    setSearchParams(nextParams, { replace: true })
  }

  const nodeById = useMemo(() => new Map(influences?.nodes.map((node) => [node.id, node])), [influences])
  const selectedEdges = influences?.edges ?? []

  return (
    <div className="atlas-page">
      <nav className="catalog-breadcrumbs" aria-label="Навигационная цепочка">
        <Link to="/artists"><ArrowLeft size={13} /> Композиторы</Link>
        <span>/</span>
        <span>Атлас XVI века</span>
      </nav>

      <header className="atlas-hero">
        <div>
          <span className="mono-label">// SCORE ARCHIVE / 1501—1600</span>
          <h1>АТЛАС<br />КОМПОЗИТОРОВ</h1>
        </div>
        <div className="atlas-hero__summary">
          <p>Композиторы, чья жизнь или работа пересекает XVI век и у которых в IMSLP есть хотя бы одна открытая страница с нотами.</p>
          <dl>
            <div><dt>Авторы</dt><dd>{catalog?.composerCount ?? '…'}</dd></div>
            <div><dt>Страны</dt><dd>{catalog?.countryCount ?? '…'}</dd></div>
            <div><dt>Страницы нот</dt><dd>{catalog?.workPageCount.toLocaleString('ru-RU') ?? '…'}</dd></div>
          </dl>
        </div>
      </header>

      <section className="influence-section" aria-labelledby="influence-heading">
        <header className="atlas-section-heading">
          <div>
            <span className="mono-label">01 / DOCUMENTED CONNECTIONS</span>
            <h2 id="influence-heading">ДРЕВО ВЛИЯНИЙ</h2>
          </div>
          <p>{influences?.method}</p>
        </header>

        <div className="influence-map" aria-label="Схема влияний композиторов">
          {influences ? (
            <div className="influence-map__canvas">
              <svg viewBox="0 0 1180 840" aria-label="Кликабельные связи между композиторами">
                <defs>
                  <marker id="atlas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0 0L8 4L0 8Z" />
                  </marker>
                </defs>
                {influences.edges.map((edge) => {
                  const from = nodeById.get(edge.from)
                  const to = nodeById.get(edge.to)
                  if (!from || !to) return null
                  const x1 = from.x + 172
                  const y1 = from.y + 32
                  const x2 = to.x - 8
                  const y2 = to.y + 32
                  const markerX = (x1 + x2) / 2
                  const markerY = (y1 + y2) / 2
                  const evidenceId = `influence-${edge.from}-${edge.to}`
                  return (
                    <g key={`${edge.from}-${edge.to}`}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        className={edge.kind === 'teacher' ? 'is-teacher' : 'is-influence'}
                        markerEnd="url(#atlas-arrow)"
                      />
                      <a className="influence-arrow-link" href={`#${evidenceId}`} aria-label={`Чем ${from.name} повлиял на ${to.name}`}>
                        <title>Открыть пояснение влияния</title>
                        <line className="influence-arrow-link__hit" x1={x1} y1={y1} x2={x2} y2={y2} />
                        <rect x={markerX - 10} y={markerY - 10} width="20" height="20" />
                        <text x={markerX} y={markerY + 3}>?</text>
                      </a>
                    </g>
                  )
                })}
              </svg>
              {influences.nodes.map((node) => (
                <Link
                  className="influence-node"
                  style={{ left: node.x, top: node.y }}
                  to={composerRoute(node.composerId)}
                  key={node.id}
                  aria-label={`Открыть дискографию: ${node.name}`}
                >
                  <strong>{node.name}</strong>
                  <span>{node.country} / {node.years}</span>
                </Link>
              ))}
            </div>
          ) : <p className="atlas-loading">Загрузка связей…</p>}
        </div>

        <div className="influence-legend">
          <span><i className="is-teacher" /> Обучение</span>
          <span><i className="is-influence" /> Стиль / школа / полемика</span>
          <span className="influence-legend__hint">Нажмите ? на стрелке — откроется пояснение</span>
        </div>

        <div className="influence-evidence">
          {selectedEdges.map((edge, index) => (
            <article id={`influence-${edge.from}-${edge.to}`} tabIndex={-1} key={`${edge.from}-${edge.to}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{nodeById.get(edge.from)?.name} <ChevronRight size={13} /> {nodeById.get(edge.to)?.name}</strong>
                <small>{edge.label}</small>
              </div>
              <p>{edge.summary}</p>
              <span className="influence-evidence__source">{edge.sourceTitle}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="country-tree" aria-labelledby="country-heading">
        <header className="atlas-section-heading">
          <div>
            <span className="mono-label">02 / COUNTRY FOLDERS</span>
            <h2 id="country-heading">НОТЫ ПО СТРАНАМ</h2>
          </div>
          <p>Каждая ветвь соответствует отдельной папке в каталоге проекта. Композитор открывается внутри проекта — в дискографии и прослушивании.</p>
        </header>

        <div className="atlas-period-filter" aria-label="Фильтр по эпохе">
          <span>ЭПОХА</span>
          <button type="button" className={!selectedPeriod ? 'is-active' : ''} aria-pressed={!selectedPeriod} onClick={() => selectPeriod(null)}>ВСЕ</button>
          <button type="button" className={selectedPeriod === 'Renaissance' ? 'is-active' : ''} aria-pressed={selectedPeriod === 'Renaissance'} onClick={() => selectPeriod('Renaissance')}>ВОЗРОЖДЕНИЕ</button>
          <button type="button" className={selectedPeriod === 'Baroque' ? 'is-active' : ''} aria-pressed={selectedPeriod === 'Baroque'} onClick={() => selectPeriod('Baroque')}>БАРОККО</button>
        </div>

        <label className="atlas-search">
          <Search size={17} />
          <span>Поиск в архиве</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, страна или период" />
        </label>

        <div className="country-tree__root">
          <div className="country-tree__root-label"><GitBranch size={16} /> XVI ВЕК / IMSLP</div>
          <div className="country-tree__branches">
            {visibleCountries.map((country) => (
              <details className="country-folder" key={country.slug} open={Boolean(query || selectedPeriod)}>
                <summary>
                  <Folder size={17} />
                  <strong>{country.name}</strong>
                  <span>{country.composers.length} авт. / {country.workPageCount} стр. нот</span>
                  <ChevronRight size={15} />
                </summary>
                <div className="country-folder__composers">
                  {country.composers.map((composer, index) => {
                    const body = (
                      <>
                        <span>{String(index + 1).padStart(3, '0')}</span>
                        <div><strong>{composer.name}</strong><small>{composerLifetime(composer)} / {composer.period}</small></div>
                        <em>{composer.workCount} стр. нот</em>
                        <i>Аудио ожидается</i>
                        <ArrowUpRight size={14} />
                      </>
                    )
                    return <Link className="country-composer" to={composerRoute(composer.id)} key={composer.id}>{body}</Link>
                  })}
                </div>
              </details>
            ))}
            {catalog && visibleCountries.length === 0 && <p className="atlas-loading">Ничего не найдено</p>}
          </div>
        </div>
      </section>
    </div>
  )
}
