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