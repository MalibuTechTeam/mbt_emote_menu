import { Search } from 'lucide-react'
import { useLocale } from '../utils/locale'
import { AnimatedNumber } from './AnimatedNumber'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  resultCount: number
  totalCount: number
  /** The editor lists scenes through this same field; without an override it
   *  would ask an admin to "search emotes". */
  placeholder?: string
}

// v7 minimal search — just the field. "New list" lives on the lens "+" tab,
// "Stop" lives in the header. See EmoteMenu.
export function SearchBar({ value, onChange, resultCount, totalCount, placeholder }: SearchBarProps) {
  const t = useLocale()

  return (
    <div className="mbt-search">
      <div className="mbt-search__input-wrapper">
        <input
          className="mbt-search__input"
          type="text"
          placeholder={placeholder || t.search_placeholder || 'Search emotes...'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <Search className="mbt-search__icon" size={14} />
        {value.trim() && (
          <span className="mbt-search__count">
            <AnimatedNumber value={resultCount} duration={250} />/{totalCount}
          </span>
        )}
      </div>
    </div>
  )
}
