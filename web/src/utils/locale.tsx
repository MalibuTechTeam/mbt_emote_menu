import { createContext, useContext } from 'react'

export type LocaleStrings = Record<string, string>

const LocaleContext = createContext<LocaleStrings>({})

export function LocaleProvider({
  strings,
  children,
}: {
  strings: LocaleStrings
  children: React.ReactNode
}) {
  return (
    <LocaleContext.Provider value={strings}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}

/**
 * Get a translated string by key, with fallback to the key itself.
 */
export function useT(key: string): string {
  const strings = useContext(LocaleContext)
  return strings[key] || key
}

/**
 * Substitute %s/%d positional placeholders in a locale template.
 * Mirrors Lua's string.format for the only two specifiers we use.
 *
 *   tFormat('Added to "%s"', list.name)
 *   tFormat('Assigned %s to NUM%s', emote.label, slot)
 */
export function tFormat(template: string, ...args: (string | number)[]): string {
  let i = 0
  return template.replace(/%[sd]/g, () => {
    const v = args[i++]
    return v == null ? '' : String(v)
  })
}