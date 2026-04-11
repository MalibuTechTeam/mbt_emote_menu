import { Search, Square, PlusSquare } from 'lucide-react'
import { useLocale } from '../utils/locale'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  resultCount: number
  totalCount: number
  onCancel: () => void
  onAddList: () => void
}

export function SearchBar({ value, onChange, resultCount, totalCount, onCancel, onAddList }: SearchBarProps) {
  const t = useLocale()

  return (
    <div className="mbt-search">
      <div className="mbt-search__input-wrapper">
        <input
          className="mbt-search__input"
          type="text"
          placeholder={t.search_placeholder || 'Search emotes...'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <Search className="mbt-search__icon" size={14} />
        {value.trim() && (
          <span className="mbt-search__count">
            {resultCount}/{totalCount}
          </span>
        )}
      </div>
      
      <div className="mbt-search__actions">
        <button className="mbt-search__btn mbt-search__btn--add" onClick={onAddList} title="Nuova lista custom">
          <PlusSquare size={13} strokeWidth={2.5} />
          <span>New</span>
        </button>

        <button className="mbt-search__btn mbt-search__btn--stop" onClick={onCancel} title="Ferma animazione">
          <Square size={12} fill="currentColor" />
          <span>Stop</span>
        </button>
      </div>
    </div>
  )
}
