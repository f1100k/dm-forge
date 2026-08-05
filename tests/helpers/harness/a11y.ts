import axe from 'axe-core'

// WCAG 2.1 level AA — the bar NFR-006 sets for the auth/account screens.
// Restricting the run to these tags keeps the suite on the standard the Spec
// commits to, instead of axe's wider "best-practice" catalogue.
const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

// happy-dom parses CSS but does not lay out or paint, so axe cannot resolve the
// design-system custom properties (`var(--text)`, `color-mix(...)`) into the
// pixels the contrast ratio is computed from. The rule would report every node
// as "incomplete" noise rather than signal, so contrast stays a design-review
// item — the other three halves of NFR-006 (focus order, tab order, associated
// labels) are structural and do run here.
const NEEDS_A_RENDERER = ['color-contrast']

/**
 * Runs axe over a rendered tree and returns one line per violated rule.
 *
 * Returning strings rather than axe's nested result objects is what makes a CI
 * failure legible: `expect(await a11yViolations(container)).toEqual([])` prints
 * the offending rule, its impact, the selector of every node, and the URL of
 * the rule's documentation — the "relatório objetivo" the card asks for.
 */
export async function a11yViolations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: WCAG_21_AA },
    rules: Object.fromEntries(NEEDS_A_RENDERER.map((id) => [id, { enabled: false }])),
  })

  return results.violations.map((violation) => {
    const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ')
    return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} [${targets}] — ${violation.helpUrl}`
  })
}
