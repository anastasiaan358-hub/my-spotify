export interface AtlasComposer {
  id: string
  name: string
  country: string
  born: string | null
  died: string | null
  period: string
  workCount: number
  scoresUrl: string
}

export const localArtistIds: Record<string, string> = {
  'allegri-gregorio': 'allegri',
  'arbeau-thoinot': 'arbeau',
  'dowland-john': 'dowland',
  'galilei-vincenzo': 'galilei',
  'gastoldi-giovanni-giacomo': 'gastoldi',
  'gesualdo-carlo': 'gesualdo',
  'gibbons-orlando': 'gibbons',
  'janequin-clement': 'janequin',
  'japart-johannes': 'japart',
  'lassus-orlande-de': 'lassus',
  'marenzio-luca': 'marenzio',
  'milan-luis-de': 'milan',
  'monte-philippe-de': 'philippe-de-monte',
  'des-prez-josquin': 'josquin',
  'scheidemann-heinrich': 'scheidemann',
  'tallis-thomas': 'tallis',
  'victoria-tomas-luis-de': 'victoria',
  'monteverdi-claudio': 'monteverdi',
  'frescobaldi-girolamo': 'frescobaldi',
  'praetorius-michael': 'praetorius',
}

export function composerRoute(composerId: string) {
  const localId = localArtistIds[composerId]
  return localId ? `/artists/${localId}` : `/artists/archive/${composerId}`
}

export function composerLifetime(composer: AtlasComposer) {
  if (composer.born && composer.died) return `${composer.born} — ${composer.died}`
  return composer.born ?? composer.died ?? 'Даты не установлены'
}

export function composerMonogram(name: string) {
  const words = name.split(/\s+/).filter(Boolean)
  return `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toLocaleUpperCase()
}
