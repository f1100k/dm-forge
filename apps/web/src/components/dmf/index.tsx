// DM Forge design-system primitives, ported from the canonical claude.ai/design
// project into real React components. Styling mirrors the prototype's inline
// tokens (CSS variables defined in index.css), so the auth screens render
// faithfully to the design. Default theme is Obsidian dark, editorial type.

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from 'react'
import { useEffect, useRef, useState } from 'react'
import { CheckIcon, EyeIcon, EyeOffIcon, LockIcon } from './icons.js'

// ── Logo / wordmark ──────────────────────────────────────────────
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.42,
        color: 'var(--text)',
      }}
    >
      <svg
        width={size * 1.1}
        height={size * 1.1}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <path d="M16 5 L26 22 L6 22 Z" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
        <path
          d="M16 27 L6 10 L26 10 Z"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          opacity="0.55"
        />
        <circle cx="16" cy="16" r="1.6" fill="var(--accent)" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size,
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        DM <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Forge</span>
      </span>
    </span>
  )
}

// ── Display heading (editorial serif, optional italic) ───────────
export function Display({
  size = 36,
  italic,
  children,
  style,
}: {
  size?: number
  italic?: boolean
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <h1
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 400,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: '-0.015em',
        margin: 0,
        color: 'var(--text)',
        fontStyle: italic ? 'italic' : 'normal',
        textWrap: 'balance',
        ...style,
      }}
    >
      {children}
    </h1>
  )
}

// ── Eyebrow (uppercase mono microlabel) ──────────────────────────
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Button ───────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'oauth'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_SIZES: Record<ButtonSize, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 32, px: 12, fs: 13, gap: 8 },
  md: { h: 40, px: 16, fs: 14, gap: 10 },
  lg: { h: 48, px: 20, fs: 15, gap: 12 },
}

const BUTTON_VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--accent)', color: '#0E0F12', border: '1px solid var(--accent)' },
  secondary: {
    background: 'var(--surface-alt)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid transparent' },
  outline: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border-hi)',
  },
  danger: { background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' },
  oauth: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  icon,
  iconRight,
  children,
  type = 'button',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const s = BUTTON_SIZES[size]
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        fontWeight: 500,
        fontFamily: 'var(--font-body)',
        letterSpacing: '-0.005em',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        width: full ? '100%' : 'auto',
        transition: 'all 120ms',
        ...BUTTON_VARIANTS[variant],
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
}

// ── Field + Input ────────────────────────────────────────────────
export function Field({
  label,
  hint,
  hintMeta,
  error,
  required,
  labelRight,
  htmlFor,
  children,
}: {
  label?: string
  hint?: string
  hintMeta?: string
  error?: string | null
  required?: boolean
  labelRight?: ReactNode
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span>
            {label}
            {required && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*</span>}
          </span>
          {labelRight && (
            <span
              style={{
                textTransform: 'none',
                letterSpacing: 0,
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
              }}
            >
              {labelRight}
            </span>
          )}
        </span>
      )}
      {children}
      {hint && !error && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            lineHeight: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>{hint}</span>
          {hintMeta && (
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {hintMeta}
            </span>
          )}
        </span>
      )}
      {error && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--danger)',
            lineHeight: 1.5,
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
            <path
              d="M6 3.5v3M6 8v0.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {error}
        </span>
      )}
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode
  suffix?: ReactNode
  error?: boolean
}

export function Input({ icon, suffix, error, style, ...rest }: InputProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface)',
        border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 6,
        height: 42,
        padding: '0 12px',
        width: '100%',
        gap: 8,
      }}
    >
      {icon && <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>{icon}</span>}
      <input
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: 14,
          fontFamily: 'var(--font-body)',
          minWidth: 0,
          ...style,
        }}
        {...rest}
      />
      {suffix && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--text-dim)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  )
}

// Password field with a persistent show/hide toggle. Replaces the browser's
// native reveal control (suppressed in index.css), which is low-contrast on the
// dark theme and vanishes on blur. The toggle sits in the label colour and is
// always visible; keeping mousedown from stealing focus lets the input stay
// focused while toggling.
type PasswordInputProps = Omit<InputProps, 'icon' | 'suffix' | 'type'> & {
  labels: { show: string; hide: string }
}

export function PasswordInput({ labels, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      {...rest}
      type={visible ? 'text' : 'password'}
      icon={<LockIcon />}
      suffix={
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? labels.hide : labels.show}
          aria-pressed={visible}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  )
}

// ── Password strength meter ──────────────────────────────────────
export function PasswordStrength({ score, label }: { score: number; label: string }) {
  const colors = ['var(--danger)', '#C9882D', 'var(--accent)', 'var(--success)']
  const clamped = Math.max(0, Math.min(3, score))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: i <= clamped ? colors[clamped] : 'var(--surface-hi)',
              transition: 'all 200ms',
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          minWidth: 60,
          textAlign: 'right',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Avatar (initials placeholder) ────────────────────────────────
export function Avatar({ size = 32, initials }: { size?: number; initials: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: 'var(--surface-hi)',
        border: '1px solid var(--border)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 500,
        fontFamily: 'var(--font-body)',
        color: 'var(--accent)',
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

// ── Auto-save indicator ──────────────────────────────────────────
// The status line that replaces a save button on auto-saving screens
// (docs/coding-patterns.md). `role="status"` so a screen reader announces the
// outcome of an edit nobody explicitly submitted.
export type SaveState = 'saved' | 'saving' | 'error'

const SAVE_STATE_COLORS: Record<SaveState, { color: string; dot: string }> = {
  saved: { color: 'var(--text-dim)', dot: 'var(--success)' },
  saving: { color: 'var(--text-muted)', dot: 'var(--accent)' },
  error: { color: 'var(--danger)', dot: 'var(--danger)' },
}

export function AutoSave({ state, label }: { state: SaveState; label: string }) {
  const tone = SAVE_STATE_COLORS[state]
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: tone.color,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.02em',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: tone.dot,
          animation: state === 'saving' ? 'dmf-pulse 1.2s infinite' : 'none',
        }}
      />
      {label}
    </span>
  )
}

// ── Ornamental divider (diamond flanked by rules) ────────────────
export function OrnDivider({
  width = 72,
  align = 'flex-start',
}: {
  width?: number
  align?: CSSProperties['justifyContent']
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: align, gap: 9 }}>
      <span
        style={{
          height: 1,
          width: width / 2,
          background: 'linear-gradient(90deg, transparent, var(--border-hi))',
        }}
      />
      <span
        style={{
          width: 5,
          height: 5,
          background: 'var(--accent)',
          transform: 'rotate(45deg)',
          flexShrink: 0,
          opacity: 0.85,
        }}
      />
      <span
        style={{
          height: 1,
          width: width / 2,
          background: 'linear-gradient(90deg, var(--border-hi), transparent)',
        }}
      />
    </div>
  )
}

// ── Divider with centered caption ("OU COM E-MAIL") ──────────────
export function LabeledDivider({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)',
          letterSpacing: '0.14em',
        }}
      >
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ── Language chip (reflects current UI language) ─────────────────
export function LangChip({ lang }: { lang: 'pt' | 'en' }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid var(--border)',
        borderRadius: 4,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          padding: '3px 7px',
          background: lang === 'pt' ? 'var(--surface-hi)' : 'transparent',
          color: lang === 'pt' ? 'var(--text)' : 'var(--text-dim)',
        }}
      >
        PT
      </span>
      <span
        style={{
          padding: '3px 7px',
          background: lang === 'en' ? 'var(--surface-hi)' : 'transparent',
          color: lang === 'en' ? 'var(--text)' : 'var(--text-dim)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        EN
      </span>
    </div>
  )
}

// ── Consent checkbox row (accessible custom checkbox) ────────────
export function CheckRow({
  id,
  checked,
  onChange,
  children,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        fontSize: 13,
        color: 'var(--text)',
        lineHeight: 1.5,
        cursor: 'pointer',
      }}
    >
      <input
        id={id}
        type="checkbox"
        className="dmf-check-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, margin: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          marginTop: 1,
          flexShrink: 0,
          background: checked ? 'var(--accent)' : 'transparent',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-hi)'}`,
          color: '#0E0F12',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <CheckIcon size={11} />}
      </span>
      <span>{children}</span>
    </label>
  )
}

// ── Switch (on/off preference) ───────────────────────────────────
// A native checkbox wearing the design's track-and-knob: the role, the state
// and the keyboard behaviour come free and correct, which no div can claim
// (Spec NFR-006). The input is visually hidden behind the styled track, the
// same technique CheckRow uses.
export function Switch({
  id,
  checked,
  onChange,
  disabled,
  label,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="dmf-check-input"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, margin: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          padding: 2,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          background: checked ? 'var(--accent)' : 'var(--surface-hi)',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-hi)'}`,
          transition: 'all 140ms',
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: checked ? '#0E0F12' : 'var(--text-muted)',
            display: 'block',
          }}
        />
      </span>
    </label>
  )
}

// ── Modal dialog ─────────────────────────────────────────────────
// Used by the destructive flows, where the design deliberately takes the screen
// away to make the decision deliberate. Escape closes it, the backdrop closes
// it, and focus moves into the panel on open so a keyboard user is not left
// behind on the page underneath (Spec NFR-006).
//
// `dismissible: false` drops both dismissals, for the one dialog the user has
// to answer rather than escape (the terms re-acceptance gate, FR-016). Tab is
// kept inside the panel either way: `aria-modal` promises the rest of the page
// is unreachable, and without the containment below a keyboard user could tab
// straight into the nav underneath.
export function Dialog({
  open,
  onClose,
  labelledBy,
  dismissible = true,
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  dismissible?: boolean
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panel.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, dismissible])

  if (!open) return null

  return (
    <div
      // The backdrop is a click target, not a control: the same dismissal is
      // on Escape and on the dialog's own cancel button, so it needs no role.
      // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard dismissal is handled by the Escape listener above
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(6, 7, 9, 0.72)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={(event) => keepTabInside(event, panel.current)}
        style={{
          width: 520,
          maxWidth: '100%',
          maxHeight: '90dvh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border-hi)',
          borderRadius: 10,
          padding: 28,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          outline: 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Cycles Tab between the first and the last control of the open dialog. The
// panel itself is the fallback anchor, since focus starts there on open.
function keepTabInside(event: ReactKeyboardEvent<HTMLElement>, panel: HTMLElement | null) {
  if (event.key !== 'Tab' || !panel) return

  const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  // A dialog with nothing focusable in it: hold the focus on the panel rather
  // than hand it to the page behind.
  if (!first || !last) {
    event.preventDefault()
    return
  }

  const active = document.activeElement
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

// ── Atmosphere (subtle grain + vignette) ─────────────────────────
const GRAIN_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

function Atmosphere() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 60%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(130% 120% at 50% 38%, transparent 55%, rgba(0,0,0,0.45))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${GRAIN_URI}")`,
          backgroundSize: '140px 140px',
          opacity: 0.035,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  )
}

// ── Auth top bar + full-screen shell ─────────────────────────────
export function AuthTopBar({ lang, right }: { lang: 'pt' | 'en'; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <Logo size={20} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <LangChip lang={lang} />
        {right}
      </div>
    </div>
  )
}

export function AuthShell({
  lang,
  topBarRight,
  children,
}: {
  lang: 'pt' | 'en'
  topBarRight?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-body)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Atmosphere />
      <AuthTopBar lang={lang} right={topBarRight} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '40px 24px 64px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  )
}
