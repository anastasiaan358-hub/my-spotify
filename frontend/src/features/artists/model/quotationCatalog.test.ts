import { describe, expect, it } from 'vitest'
import { quotationRecords, quotationRecordsForArtist, quotationRecordsForWork, quotationRoleForWork } from './quotationCatalog'

describe('quotationCatalog', () => {
  it('связывает модель и производное произведение с одним исследованием', () => {
    const model = quotationRecordsForWork('tallis', '1322495')
    const reuse = quotationRecordsForWork('tallis', '1322430')

    expect(model).toHaveLength(1)
    expect(reuse).toHaveLength(1)
    expect(model[0].id).toBe('tallis-salve-intemerata')
    expect(reuse[0].id).toBe(model[0].id)
    expect(quotationRoleForWork(model[0], 'tallis', '1322495')).toBe('ИСТОЧНИК')
    expect(quotationRoleForWork(reuse[0], 'tallis', '1322430')).toBe('ЦИТАТА')
  })

  it('хранит источники и явно отмечает спорные атрибуции', () => {
    expect(quotationRecords).toHaveLength(24)
    expect(quotationRecords.every((record) => record.sources.length >= 2)).toBe(true)
    expect(quotationRecords.filter((record) => record.certainty === 'disputed').map((record) => record.id)).toEqual([
      'quando-lieta-sperai-network',
      'marenzio-iniquos-odio-habui',
      'janequin-la-bataille',
    ])
  })

  it('находит связи композитора для быстрого перехода над каталогом', () => {
    expect(quotationRecordsForArtist('monteverdi').map((record) => record.id)).toEqual(['monteverdi-in-illo-tempore'])
    expect(quotationRecordsForArtist('victoria')).toHaveLength(7)
  })
})
