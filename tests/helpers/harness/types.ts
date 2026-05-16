// Shared response shapes used across integration tests. Extend as the
// project's error contract grows (see docs/resilience-observability.md).

export type ApiError = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ZodErrorResponse = {
  ok: false
  error: {
    code: 'VALIDATION_ERROR'
    message: string
    issues: Array<{
      path: Array<string | number>
      message: string
    }>
  }
}
