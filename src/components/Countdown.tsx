import { formatDuration } from '../lib/format'
import { useRemaining, useWakeLock } from '../lib/hooks'

const WINDOW_MS = 10 * 60 * 1000
const WARN_AT_MS = 2 * 60 * 1000

interface CountdownProps {
  /** ISO timestamp the pickup window closes at. */
  expiresAt: string
  /** Database clock minus device clock, so a wrong phone clock does not matter. */
  offsetMs?: number
  /** Hold the screen awake while this counts down. */
  keepAwake?: boolean
}

export function Countdown({ expiresAt, offsetMs = 0, keepAwake = false }: CountdownProps) {
  const remaining = useRemaining(expiresAt, offsetMs)
  const over = remaining <= 0
  const warn = !over && remaining <= WARN_AT_MS

  useWakeLock(keepAwake && !over)

  const pct = Math.max(0, Math.min(100, (remaining / WINDOW_MS) * 100))
  const tone = over ? 'countdown--over' : warn ? 'countdown--warn' : ''

  return (
    <div className={`countdown ${tone}`}>
      <div
        className="countdown__time"
        role="timer"
        aria-live={warn ? 'polite' : 'off'}
        aria-label={over ? 'Pickup window expired' : `${formatDuration(remaining)} left to pick up`}
      >
        {over ? '0:00' : formatDuration(remaining)}
      </div>
      <div className="countdown__bar">
        <div className="countdown__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
