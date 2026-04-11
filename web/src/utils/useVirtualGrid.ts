import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

interface UseVirtualGridOptions {
  totalItems: number
  rowHeight: number      // height of one card row in px (including gap)
  columns: number        // grid columns
  overscan?: number      // extra rows to render above/below viewport
}

interface UseVirtualGridResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  totalHeight: number    // total scrollable height in px
  startIndex: number     // first visible item index
  endIndex: number       // last visible item index (exclusive)
  offsetY: number        // translateY for the visible slice
}

export function useVirtualGrid({
  totalItems,
  rowHeight,
  columns,
  overscan = 4,
}: UseVirtualGridOptions): UseVirtualGridResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const rafRef = useRef(0)

  const totalRows = Math.ceil(totalItems / columns)
  const totalHeight = totalRows * rowHeight

  // Throttled scroll handler via rAF
  const handleScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const el = containerRef.current
      if (el) {
        setScrollTop(el.scrollTop)
        setViewportHeight(el.clientHeight)
      }
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setViewportHeight(el.clientHeight)
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Reset scroll position when totalItems changes (e.g. search/filter)
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = 0
    setScrollTop(0)
  }, [totalItems])

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const firstVisibleRow = Math.floor(scrollTop / rowHeight)
    const visibleRows = Math.ceil(viewportHeight / rowHeight)

    const startRow = Math.max(0, firstVisibleRow - overscan)
    const endRow = Math.min(totalRows, firstVisibleRow + visibleRows + overscan)

    return {
      startIndex: startRow * columns,
      endIndex: Math.min(endRow * columns, totalItems),
      offsetY: startRow * rowHeight,
    }
  }, [scrollTop, viewportHeight, rowHeight, columns, overscan, totalRows, totalItems])

  return { containerRef, totalHeight, startIndex, endIndex, offsetY }
}
