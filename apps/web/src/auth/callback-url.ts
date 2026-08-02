// Better Auth redirects to `callbackURL` verbatim — both the email-verification
// route and the OAuth callback end in `ctx.redirect(ctx.query.callbackURL)`.
// A relative value therefore resolves against the *API* origin, not the app's:
// in dev that is :3000, which serves only /api/* and /health and answers 404 on
// everything else. Building an absolute URL on the web origin keeps the user in
// the app after verifying an address or returning from Google.
//
// The API accepts the absolute form because WEB_ORIGIN is registered in
// `trustedOrigins` (apps/api/src/auth/better-auth.ts), which is what Better
// Auth's `originCheck` on the callbackURL query param validates against.
export function appCallbackUrl(path = '/', origin: string = window.location.origin): string {
  return new URL(path, origin).toString()
}
