import { BookOpenText } from 'lucide-react'
import { Link } from 'react-router-dom'

interface LiteratureBadgeProps {
  workId: string
  title: string
}

export function LiteratureBadge({ workId, title }: LiteratureBadgeProps) {
  const label = `В литературе: открыть историю текста «${title}»`

  return (
    <Link className="literature-badge" to={`/literature/${workId}`} aria-label={label} title={label}>
      <BookOpenText size={13} strokeWidth={1.7} />
      <span>В ЛИТЕРАТУРЕ</span>
    </Link>
  )
}
