import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Check, X, Users } from 'lucide-react'
import { useLocale } from '../utils/locale'

export interface PersonaItem {
  id: string
  name: string
  locked?: boolean
}

interface PersonaBarProps {
  personas: PersonaItem[]
  activeId: string
  max: number
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  /** Embedded inside the Quick Bind block — drops the lead icon + outer padding. */
  inline?: boolean
}

/**
 * Compact persona (loadout) switcher. A row of chips: the active one is
 * accent-green; clicking another switches to it (instant, the binds + wheel
 * swap underneath). Non-locked chips can be renamed (double-click) or deleted
 * (× → inline confirm). The "+" clones the current setup into a new persona.
 *
 * The "Default" persona is locked: it can't be renamed or deleted, so there is
 * always a safe fallback loadout.
 */
export function PersonaBar({
  personas, activeId, max, onSwitch, onCreate, onRename, onDelete, inline = false,
}: PersonaBarProps) {
  const t = useLocale()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId || creating) inputRef.current?.focus()
  }, [editingId, creating])

  const startRename = useCallback((p: PersonaItem) => {
    if (p.locked) return
    setConfirmDeleteId(null)
    setCreating(false)
    setEditingId(p.id)
    setDraft(p.name)
  }, [])

  const commitRename = useCallback(() => {
    const name = draft.trim()
    if (editingId && name) onRename(editingId, name)
    setEditingId(null)
    setDraft('')
  }, [draft, editingId, onRename])

  const startCreate = useCallback(() => {
    setEditingId(null)
    setConfirmDeleteId(null)
    setCreating(true)
    setDraft('')
  }, [])

  const commitCreate = useCallback(() => {
    const name = draft.trim()
    if (name) onCreate(name)
    setCreating(false)
    setDraft('')
  }, [draft, onCreate])

  const onKey = useCallback((e: React.KeyboardEvent, commit: () => void, cancel: () => void) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    else if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }, [])

  return (
    <div className={`mbt-personas${inline ? ' mbt-personas--inline' : ''}`}>
      {!inline && (
        <span className="mbt-personas__lead" title={t.persona_title || 'Loadouts'}>
          <Users size={13} />
        </span>
      )}

      <div className="mbt-personas__chips">
        {personas.map((p) => {
          const isActive = p.id === activeId
          const isEditing = editingId === p.id
          const isConfirming = confirmDeleteId === p.id

          if (isEditing) {
            return (
              <span key={p.id} className="mbt-persona mbt-persona--editing">
                <input
                  ref={inputRef}
                  className="mbt-persona__input"
                  value={draft}
                  maxLength={24}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => onKey(e, commitRename, () => { setEditingId(null); setDraft('') })}
                  onBlur={commitRename}
                />
              </span>
            )
          }

          if (isConfirming) {
            return (
              <span key={p.id} className="mbt-persona mbt-persona--confirm">
                <span className="mbt-persona__confirmtext">{t.persona_delete_q || 'Delete?'}</span>
                <button
                  className="mbt-persona__yes"
                  onClick={() => { onDelete(p.id); setConfirmDeleteId(null) }}
                  title={t.persona_delete || 'Delete'}
                >
                  <Check size={12} />
                </button>
                <button
                  className="mbt-persona__no"
                  onClick={() => setConfirmDeleteId(null)}
                  title={t.cancel || 'Cancel'}
                >
                  <X size={12} />
                </button>
              </span>
            )
          }

          return (
            <span
              key={p.id}
              className={`mbt-persona${isActive ? ' mbt-persona--active' : ''}`}
              onClick={() => !isActive && onSwitch(p.id)}
              onDoubleClick={() => startRename(p)}
              title={p.locked ? (t.persona_default_hint || 'Default loadout') : (t.persona_switch_hint || 'Click to switch · double-click to rename')}
            >
              <span className="mbt-persona__name">{p.name}</span>
              {!p.locked && (
                <button
                  className="mbt-persona__del"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                  title={t.persona_delete || 'Delete'}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          )
        })}

        {creating ? (
          <span className="mbt-persona mbt-persona--editing">
            <input
              ref={inputRef}
              className="mbt-persona__input"
              value={draft}
              maxLength={24}
              placeholder={t.persona_name_placeholder || 'Loadout name'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => onKey(e, commitCreate, () => { setCreating(false); setDraft('') })}
              onBlur={commitCreate}
            />
          </span>
        ) : (
          personas.length < max && (
            <button
              className="mbt-personas__add"
              onClick={startCreate}
              title={t.persona_new || 'New loadout (clones current setup)'}
            >
              <Plus size={13} />
            </button>
          )
        )}
      </div>
    </div>
  )
}
