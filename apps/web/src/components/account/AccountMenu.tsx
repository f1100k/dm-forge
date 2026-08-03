// The header's account dropdown, ported from the canonical claude.ai/design
// project (section "header-d"). It is the only place the app offers an explicit
// way out of a session (Spec Story 4 cenário 1).

import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSignOut } from '../../auth/use-sign-out.js'
import { ChevronDown } from '../dmf/icons.js'
import { Avatar } from '../dmf/index.js'
import { initialsOf } from './SettingsShell.js'

const ITEM_STYLE = {
  display: 'block',
  padding: '9px 10px',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  color: 'var(--text)',
  textDecoration: 'none',
} as const

export function AccountMenu({ userName }: { userName: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { signOut, status } = useSignOut()
  const container = useRef<HTMLDivElement>(null)

  // A dropdown that outlived a click elsewhere would sit on top of the app.
  // Escape and outside-click are the two dismissals a menu is expected to
  // honour, keyboard included (Spec NFR-006).
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={container} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px 4px 4px',
          borderRadius: 999,
          background: open ? 'var(--surface-hi)' : 'transparent',
          border: `1px solid ${open ? 'var(--border-hi)' : 'transparent'}`,
          color: 'var(--text)',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <Avatar size={26} initials={initialsOf(userName)} />
        {userName}
        <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
          <ChevronDown size={12} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('account.menu.label')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 232,
            padding: 6,
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border-hi)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 10,
          }}
        >
          <Link
            to="/account/profile"
            role="menuitem"
            style={ITEM_STYLE}
            onClick={() => setOpen(false)}
          >
            {t('account.menu.settings')}
          </Link>

          <span aria-hidden="true" style={{ height: 1, background: 'var(--border)', margin: 4 }} />

          <button
            type="button"
            role="menuitem"
            disabled={status === 'pending'}
            onClick={() => void signOut()}
            style={{
              ...ITEM_STYLE,
              background: 'transparent',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: status === 'pending' ? 'progress' : 'pointer',
              color: 'var(--danger)',
            }}
          >
            {status === 'pending' ? t('account.menu.signingOut') : t('account.menu.signOut')}
          </button>

          {status === 'error' && (
            <span
              role="alert"
              style={{
                padding: '6px 10px 4px',
                fontSize: 12,
                color: 'var(--danger)',
                lineHeight: 1.5,
              }}
            >
              {t('account.menu.signOutError')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
