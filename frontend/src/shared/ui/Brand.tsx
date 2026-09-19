import { AudioLines } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="My Spotify — на главную">
      <span className="brand__mark"><AudioLines size={22} strokeWidth={2.5} /></span>
      <span>My Spotify</span>
    </Link>
  )
}
