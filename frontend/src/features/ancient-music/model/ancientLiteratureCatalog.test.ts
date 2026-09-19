import { describe, expect, it } from 'vitest'
import { ancientLiteratureByWorkId, ancientLiteratureRecords } from './ancientLiteratureCatalog'
import { ancientRecordedWorkIds, ancientTraditions, ancientWorkCount } from './ancientMusic'

describe('ancient literature catalog', () => {
  it('содержит литературную историю для каждого древнего музыкального памятника', () => {
    const workIds = ancientTraditions.flatMap((tradition) => tradition.works.map((work) => work.id))

    expect(ancientLiteratureRecords).toHaveLength(ancientWorkCount)
    expect(new Set(ancientLiteratureRecords.map((record) => record.workId))).toEqual(new Set(workIds))
    expect(workIds.every((workId) => ancientLiteratureByWorkId.has(workId))).toBe(true)
  })

  it('публикует только памятники с нотацией или доступной записью', () => {
    const works = ancientTraditions.flatMap((tradition) => tradition.works)

    expect(works).toHaveLength(20)
    expect(works.every((work) =>
      work.evidence === 'notation' || ancientRecordedWorkIds.has(work.id),
    )).toBe(true)
  })

  it('даёт для каждой страницы историю, темы и проверяемые источники', () => {
    for (const record of ancientLiteratureRecords) {
      expect(record.history.length, record.workId).toBeGreaterThanOrEqual(3)
      expect(record.themes.length, record.workId).toBeGreaterThanOrEqual(4)
      expect(record.sources.length, record.workId).toBeGreaterThanOrEqual(2)
      expect(record.sources.every((source) => source.url.startsWith('https://')), record.workId).toBe(true)
    }
  })
})
