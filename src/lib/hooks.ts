import { useEffect, useRef, useState } from 'react'

/**
 * Calls `fn` every `intervalMs`, but only while the page is actually being
 * looked at. A phone in someone's pocket should not keep the radio busy, and
 * coming back to the app should show fresh state immediately rather than after
 * the next tick -- so returning to visibility fires `fn` at once and restarts
 * the clock.
 */
export function usePolling(fn: () => void, intervalMs: number, enabled = true): void {
  const saved = useRef(fn)
  saved.current = fn

  useEffect(() => {
    if (!enabled) return

    let timer: ReturnType<typeof setInterval> | undefined

    const start = () => {
      stop()
      timer = setInterval(() => saved.current(), intervalMs)
    }
    const stop = () => {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        saved.current()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled])
}

/**
 * Milliseconds remaining until `targetIso`, recomputed from the wall clock on
 * every tick rather than counted down. Mobile browsers freeze timers in
 * background tabs, so a decrementing counter drifts badly; deriving the value
 * each time means the number is correct the instant the screen comes back.
 *
 * `offsetMs` is (database clock - this device's clock), captured when the order
 * was fetched, so a phone with a wrong clock still sees the right countdown.
 */
export function useRemaining(targetIso: string | null, offsetMs = 0): number {
  const compute = () => (targetIso ? new Date(targetIso).getTime() - (Date.now() + offsetMs) : 0)
  const [remaining, setRemaining] = useState(compute)

  useEffect(() => {
    if (!targetIso) {
      setRemaining(0)
      return
    }
    const tick = () => setRemaining(new Date(targetIso).getTime() - (Date.now() + offsetMs))
    tick()
    const timer = setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [targetIso, offsetMs])

  return remaining
}

/**
 * Keeps the screen awake while a pickup countdown is running, so the customer
 * can walk to the meeting point without the display sleeping. Unsupported
 * browsers simply do nothing; the lock is also re-taken after the page is
 * hidden and shown again, because the browser drops it on visibility change.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.hidden) return
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Denied or not allowed in this context -- the countdown still works.
      }
    }

    const onVisibility = () => {
      if (!document.hidden) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}

/** Reads once from localStorage, then writes back on every change. */
export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      // Private mode, blocked storage, or corrupt JSON -- fall back to the default.
      return initial
    }
  })

  const update = (next: T) => {
    setValue(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Nothing to do; the value still lives in memory for this session.
    }
  }

  return [value, update]
}
