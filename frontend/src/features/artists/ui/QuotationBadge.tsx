import { Quote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { quotationRecordsForWork, quotationRoleForWork } from '../model/quotationCatalog'

interface QuotationBadgeProps {
  artistId: string
  workId: string
  labelOverride?: string
}

export function QuotationBadge({ artistId, workId, labelOverride }: QuotationBadgeProps) {
  const records = quotationRecordsForWork(artistId, workId)
  const record = records[0]

  if (!record) return null

  const role = quotationRoleForWork(record, artistId, workId)
  const label = `${role === 'ИСТОЧНИК' ? 'Источник музыкального заимствования' : 'Музыкальное заимствование'}: открыть исследование «${record.title}»`

  return (
    <Link
      className={`quotation-badge${record.certainty === 'disputed' ? ' quotation-badge--disputed' : ''}`}
      to={`/citations/${record.id}`}
      aria-label={label}
      title={label}
    >
      <Quote size={13} strokeWidth={1.8} />
      <span>{labelOverride ?? role}</span>
    </Link>
  )
}
