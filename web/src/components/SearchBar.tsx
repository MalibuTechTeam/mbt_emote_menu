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
        <button
          className="mbt-search__btn mbt-search__btn--add"
          onClick={onAddList}
          title={t.tooltip_new_list || 'New custom list'}
        >
          <PlusSquare size={13} strokeWidth={2.5} />
          <span>{t.btn_new || 'New'}</span>
        </button>

        <button
          className="mbt-search__btn mbt-search__btn--stop"
          onClick={onCancel}
          title={t.tooltip_stop_animation || 'Stop animation'}
        >
          <Square size={12} fill="currentColor" />
          <span>{t.btn_stop || 'Stop'}</span>
        </button>
      </div>
    </div>
  )
}
