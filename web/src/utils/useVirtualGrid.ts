import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

interface UseVirtualGridOptions {
  totalItems: number
  rowHeight: number      // height of one card row in px (including gap)
  columns: number        // grid columns
  overscan?: number      // extra rows to render above/below viewport
}

interface UseVirtualGridResult {
  /** Attach this to the scrolling element. It is a callback ref on purpose:
   *  the container may mount later than the hook (see the note above). */
  setContainerRef: (node: HTMLDivElement | null) => void
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
  // The element itself is state, not just a ref: a ref changing does not
  // re-run an effect, and this container can appear after mount.
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const rafRef = useRef(0)

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node
    setContainer(node)
  }, [])

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
    const el = container
    if (!el) return

    // Sync both, not just the height: the element may already carry a restored
    // scroll position by the time we see it.
    setViewportHeight(el.clientHeight)
    setScrollTop(el.scrollTop)
    el.addEventListener('scroll', handleScroll, { passive: true })

    // A height measured once goes stale when the panel is resized or the
    // layout switched, and a short viewport renders too few rows to fill it.
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => setViewportHeight(el.clientHeight))
        : null
    observer?.observe(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
      observer?.disconnect()
    }
  }, [container, handleScroll])

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

  return { setContainerRef, containerRef, totalHeight, startIndex, endIndex, offsetY }
}
