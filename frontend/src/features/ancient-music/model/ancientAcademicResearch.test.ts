import { describe, expect, it } from 'vitest'
import { academicSources, additionalAncientDocuments } from './ancientAcademicResearch'

describe('ancient academic research', () => {
  it('keeps a unique register of additional notated documents', () => {
    expect(additionalAncientDocuments).toHaveLength(23)
    expect(new Set(additionalAncientDocuments.map((document) => document.id)).size).toBe(23)
    expect(new Set(additionalAncientDocuments.map((document) => document.dagm)).size).toBe(23)
    expect(additionalAncientDocuments.every((document) => document.sourceUrl.startsWith('https://'))).toBe(true)
  })

  it('covers Russian higher education and international scholarship', () => {
    expect(academicSources.some((source) => source.language === 'RU' && source.kind === 'Учебник для музыкальных вузов')).toBe(true)
    expect(academicSources.some((source) => source.language === 'EN' && source.kind === 'Критическое издание')).toBe(true)
    expect(academicSources.some((source) => source.kind === 'Цифровой корпус')).toBe(true)
  })
})
