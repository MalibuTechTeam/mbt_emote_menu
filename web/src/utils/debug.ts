/**
 * MBT Debug Logger — mirrors Utils.MbtDebugger on the Lua side.
 * Only logs when config.debug is true (MBT.Debug in config.lua).
 * All messages are prefixed with [MBT NUI] for easy filtering in F8 console.
 */

let _enabled = false

/** Called once when config arrives from Lua */
export function setDebugEnabled(enabled: boolean) {
  _enabled = enabled
  if (_enabled) {
    console.log('%c[MBT NUI] Debug mode enabled', 'color: #00e676; font-weight: bold')
  }
}

/** Log a debug message (only when MBT.Debug = true) */
export function mbtDebug(message: string, ...args: unknown[]) {
  if (!_enabled) return
  console.log(`%c[MBT NUI]%c ${message}`, 'color: #00e676; font-weight: bold', 'color: inherit', ...args)
}
