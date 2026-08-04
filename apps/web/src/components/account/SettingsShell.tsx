// Chrome for the authenticated account screens, ported from the canonical
// claude.ai/design project (sections "profile" / "security" / "privacy").
//
// The nav column is shadcn/ui's Sidebar (components/ui/sidebar.tsx) rather than
// a hand-rolled grid: it is what makes the column stay put while the content
// scrolls, and it brings the off-canvas drawer the mobile design asks for —
// which the previous layout could only answer by hiding the nav outright. The
// design's palette reaches it through the token bridge in index.css, so it
// looks like the rest of the app rather than like stock shadcn.
//
// The remaining pieces (header, section header, rows) keep the prototype's
// inline tokens, like the rest of components/dmf.

import { Link } from '@tanstack/react-router'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Display, Eyebrow, Logo, OrnDivider } from '../dmf/index.js'
import { AccountMenu } from './AccountMenu.js'
import { TermsGate } from './TermsGate.js'

// The design's nav column is 260px, four pixels wider than shadcn's default.
const SIDEBAR_WIDTH = '260px'

// One entry per settings section. Only the sections whose route exists are
// navigable — "security" ships with the password/provider surface of FR-008 and
// is rendered inert rather than omitted, so the shell keeps the information
// architecture the design defines.
export type SettingsSection = {
  id: string
  label: string
  sub: string
  to?: string
}

// The nav every settings screen shows. Shared so a screen cannot end up
// offering a different set of sections than its neighbour.
export function useSettingsSections(): SettingsSection[] {
  const { t } = useTranslation()
  return [
    {
      id: 'profile',
      label: t('account.nav.profile.label'),
      sub: t('account.nav.profile.sub'),
      to: '/account/profile',
    },
    { id: 'security', label: t('account.nav.security.label'), sub: t('account.nav.security.sub') },
    {
      id: 'privacy',
      label: t('account.nav.privacy.label'),
      sub: t('account.nav.privacy.sub'),
      to: '/account/privacy',
    },
  ]
}

// Fixed to the top across the full width, above the nav column — the design
// puts the wordmark and the account menu on one bar that spans the page, not
// inside the sidebar. The offset it occupies is `--app-header-h` (index.css),
// which is also where the sidebar starts.
export function AppHeader({
  userName,
  right,
  left,
}: {
  userName: string
  right?: ReactNode
  left?: ReactNode
}) {
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
        position: 'fixed',
        insetInline: 0,
        top: 0,
        height: 'var(--app-header-h)',
        boxSizing: 'border-box',
        zIndex: 20,
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {left}
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo size={18} />
        </Link>
      </div>
      {/* The design's campaign nav (Codex / Arcos / Sessões) belongs to Specs
          that have not shipped. The account dropdown is here, since it carries
          the only way out of a session (Spec Story 4). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {right}
        <AccountMenu userName={userName} />
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
    <SidebarProvider
      style={{ '--sidebar-width': SIDEBAR_WIDTH } as CSSProperties}
      className="bg-background pt-(--app-header-h) font-[var(--font-body)]"
    >
      {/* Fixed, so it sits outside the provider's flex row. */}
      <AppHeader
        userName={userName}
        right={headerRight}
        left={<SidebarTrigger className="md:hidden" />}
      />

      <Sidebar
        collapsible="offcanvas"
        aria-label={eyebrow}
        // Starts below the header instead of covering it, and stops at the
        // bottom of the viewport — which is what keeps it in place while the
        // content beside it scrolls.
        className="top-(--app-header-h) h-[calc(100svh-var(--app-header-h))] border-r border-sidebar-border"
      >
        <SidebarHeader className="px-3 pt-5 pb-2">
          <Eyebrow>{eyebrow}</Eyebrow>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map((section) => (
                  <SettingsNavItem
                    key={section.id}
                    section={section}
                    active={section.id === activeSection}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="bg-background">
        <main className="dmf-settings-main">{children}</main>
      </SidebarInset>

      {/* Renders nothing until the account is behind on the Terms or the
          Privacy Policy, and takes the screen away when it is (FR-016). It
          lives here so every screen wearing this chrome is gated, rather than
          each one remembering to mount it. */}
      <TermsGate />
    </SidebarProvider>
  )
}

function SettingsNavItem({ section, active }: { section: SettingsSection; active: boolean }) {
  const body = (
    <>
      <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: active ? 500 : 400 }}>
        {section.label}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{section.sub}</span>
    </>
  )

  // "security" has no route yet (it ships with FR-008's password/provider
  // surface). Rendering it dimmed and unclickable keeps the information
  // architecture the design defines, instead of a nav that grows an item later.
  if (!section.to) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          disabled
          aria-disabled="true"
          className="h-auto flex-col items-start gap-[3px] py-3 opacity-45"
        >
          {body}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size="lg"
        isActive={active}
        className="h-auto flex-col items-start gap-[3px] py-3 data-[active=true]:border data-[active=true]:border-(--border-hi)"
      >
        <Link to={section.to} aria-current={active ? 'page' : undefined}>
          {body}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
