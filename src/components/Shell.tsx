import type { ReactNode } from 'react'

/** The fixed neon canvas plus the single centred column every screen lives in. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="canvas" aria-hidden="true">
        <div className="canvas__bloom canvas__bloom--a" />
        <div className="canvas__bloom canvas__bloom--b" />
      </div>
      <div className="shell">{children}</div>
    </>
  )
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="notice notice--error" role="alert">
      <span>{children}</span>
    </div>
  )
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="notice notice--info">
      <span>{children}</span>
    </div>
  )
}
