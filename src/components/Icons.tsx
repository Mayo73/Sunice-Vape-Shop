/* Inline, currentColor-driven icons. Nothing is fetched at runtime. */

interface IconProps {
  size?: number
  className?: string
}

export function CartIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>
  )
}

export function BackIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function PinIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export function VaporIcon({ size = 64 }: IconProps) {
  // A vape pen with three curls of vapour -- the app's only illustration.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sunice-pen" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff2d95" />
          <stop offset="1" stopColor="#00e5ff" />
        </linearGradient>
      </defs>
      <rect x="26" y="30" width="12" height="28" rx="6" stroke="url(#sunice-pen)" strokeWidth="2.4" />
      <path d="M26 40h12" stroke="url(#sunice-pen)" strokeWidth="1.6" opacity="0.7" />
      <path
        d="M32 26c0-4 4-4 4-8s-4-4-4-8"
        stroke="#b6ff3c" strokeWidth="2.2" strokeLinecap="round" opacity="0.95"
      />
      <path
        d="M23 25c0-3.2 3.2-3.2 3.2-6.4S23 15.4 23 12.2"
        stroke="#00e5ff" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"
      />
      <path
        d="M41 25c0-3.2-3.2-3.2-3.2-6.4S41 15.4 41 12.2"
        stroke="#ff2d95" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"
      />
    </svg>
  )
}

export function BoxIcon({ size = 44 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function CloseIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function TrashIcon({ size = 17 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
    </svg>
  )
}

export function PlusIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
