// Chrome for the authenticated account screens, ported from the canonical
// claude.ai/design project (sections "profile" / "security" / "privacy"). The
// structural switch between the 1280px and 390px layouts lives in index.css
// (.dmf-settings*), everything else mirrors the prototype's inline tokens like
// the rest of components/dmf.

import { Link } from '@tanstack/react-router'
import type { CSSProperties, ReactNode } from 'react'
import { Avatar, Display, Eyebrow, Logo, OrnDivider } from '../dmf/index.js'

// One entry per settings section. Only the sections whose route exists are
// navigable — the remaining two ship with the slices that build them (US5
// privacy, and the password/provider surface of FR-008) and are rendered
// inert rather than omitted, so the shell keeps the information architecture
// the design defines.
export type SettingsSection = {
  id: string
  label: string
  sub: string
  to?: string
}

export function AppHeader({ userName, right }: { userName: string; right?: ReactNode }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px',
        borderBottom: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        zIndex: 2,
        gap: 16,
      }}
    >
      <Link to="/" style={{ textDecoration: 'none' }}>
        <Logo size={18} />
      </Link>
      {/* The design's campaign nav (Codex / Arcos / Sessões) and the account
          dropdown belong to Specs that have not shipped: the nav to the
          campaign Specs, the dropdown with its "Sair" item to card S4.1. Only
          the identity chip is rendered here. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {right}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={26} initials={initialsOf(userName)} />
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{userName}</span>
        </span>
      </div>
    </header>
  )
}

export function SettingsShell({
  userName,
  eyebrow,
  sections,
  activeSection,
  headerRight,
  children,
}: {
  userName: string
  eyebrow: string
  sections: SettingsSection[]
  activeSection: string
  headerRight?: ReactNode
  children: ReactNode
}) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', fontFamily: 'var(--font-body)' }}>
      <AppHeader userName={userName} right={headerRight} />
      <div className="dmf-settings">
        <nav className="dmf-settings-nav" aria-label={eyebrow}>
          <div style={{ padding: '0 12px 16px' }}>
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
          {sections.map((section) => (
            <SettingsNavItem
              key={section.id}
              section={section}
              active={section.id === activeSection}
            />
          ))}
        </nav>
        <main className="dmf-settings-main">{children}</main>
      </div>
    </div>
  )
}

function SettingsNavItem({ section, active }: { section: SettingsSection; active: boolean }) {
  const style: CSSProperties = {
    padding: '12px 14px',
    borderRadius: 6,
    background: active ? 'var(--surface-hi)' : 'transparent',
    border: `1px solid ${active ? 'var(--border-hi)' : 'transparent'}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    textDecoration: 'none',
    opacity: section.to ? 1 : 0.45,
  }
  const body = (
    <>
      <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: active ? 500 : 400 }}>
        {section.label}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{section.sub}</span>
    </>
  )

  if (!section.to) {
    return (
      <span aria-disabled="true" style={style}>
        {body}
      </span>
    )
  }

  return (
    <Link to={section.to} style={style} aria-current={active ? 'page' : undefined}>
      {body}
    </Link>
  )
}

export function SectionHeader({
  title,
  sub,
  right,
}: {
  title: string
  sub?: string
  right?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 32,
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
        <Display size={36} italic>
          {title}
        </Display>
        <OrnDivider />
        {sub && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  )
}

export function RowGroup({
  title,
  sub,
  children,
}: {
  title?: string
  sub?: string
  children: ReactNode
}) {
  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {title && (
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
            {title}
          </h2>
          {sub && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 12.5,
                color: 'var(--text-muted)',
                lineHeight: 1.55,
              }}
            >
              {sub}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export function Row({
  label,
  sub,
  htmlFor,
  divider = true,
  children,
}: {
  label: string
  sub?: string
  htmlFor?: string
  divider?: boolean
  children: ReactNode
}) {
  const Label = htmlFor ? 'label' : 'span'
  return (
    <div className="dmf-row" style={{ borderTop: divider ? '1px solid var(--border)' : 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 440 }}>
        <Label
          htmlFor={htmlFor}
          style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500, display: 'block' }}
        >
          {label}
        </Label>
        {sub && (
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {sub}
          </span>
        )}
      </div>
      <div
        className="dmf-row-control"
        style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}
      >
        {children}
      </div>
    </div>
  )
}

// "KA" from "Kael Aranha" — first letter of the first and last word, matching
// the placeholder the design uses for the avatar.
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]
  if (!first) return '·'
  const last = words.length > 1 ? words[words.length - 1] : undefined
  return (first[0] + (last?.[0] ?? '')).toUpperCase()
}
