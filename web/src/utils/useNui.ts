/**
 * Send a NUI callback to the Lua client.
 * In development (browser), returns a mock response.
 * Includes a 10s timeout to prevent hanging promises if Lua doesn't respond.
 */
export async function useNui<T = unknown>(
  event: string,
  data?: unknown,
  timeoutMs = 10000
): Promise<T> {
  const resourceName = (window as any).GetParentResourceName?.() ?? 'mbt_emote_menu'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const resp = await fetch(`https://${resourceName}/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? {}),
      signal: controller.signal,
    })

    clearTimeout(timer)
    return await resp.json()
  } catch (e) {
    // Dev mode fallback or timeout
    if ((e as Error).name === 'AbortError') {
      console.warn(`[MBT NUI] Timeout on ${event} after ${timeoutMs}ms`)
    } else {
      console.warn(`[MBT NUI] Failed to send ${event}:`, e)
    }
    return {} as T
  }
}