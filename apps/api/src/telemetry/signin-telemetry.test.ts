import { describe, expect, it } from 'vitest'
import { signInTelemetryFor } from './signin-telemetry.js'

// The four outcomes a finished /sign-in/email attempt can produce
// (Tech Design §5.3). Pure decision, so the whole branch table is covered here
// rather than through Better Auth.

describe('signInTelemetryFor', () => {
  it('reports the account a session was issued for', () => {
    // Arrange
    const result = { rejected: false, errorCode: null, sessionUserId: 'usr_1' }

    // Act
    const telemetry = signInTelemetryFor(result)

    // Assert
    expect(telemetry).toEqual({ event: 'account.signin.success', userId: 'usr_1' })
  })

  it('reports a rejection under the code it was rejected with', () => {
    // Arrange
    const result = {
      rejected: true,
      errorCode: 'INVALID_EMAIL_OR_PASSWORD',
      sessionUserId: undefined,
    }

    // Act
    const telemetry = signInTelemetryFor(result)

    // Assert
    expect(telemetry).toEqual({
      event: 'account.signin.failed',
      code: 'INVALID_EMAIL_OR_PASSWORD',
    })
  })

  it('still reports a rejection that carried no code', () => {
    // Arrange — the error crossed a third-party boundary; a missing code is a
    // shape we read defensively, not a reason to lose the failure.
    const result = { rejected: true, errorCode: null, sessionUserId: undefined }

    // Act
    const telemetry = signInTelemetryFor(result)

    // Assert
    expect(telemetry).toEqual({ event: 'account.signin.failed', code: null })
  })

  it('stays quiet when the session was refused after the password checked out', () => {
    // Arrange — the pending-deletion path, answered with its own account-state
    // error. Filing it as a credential failure would blame someone who produced
    // the right credential.
    const result = {
      rejected: true,
      errorCode: 'FAILED_TO_CREATE_SESSION',
      sessionUserId: undefined,
    }

    // Act
    const telemetry = signInTelemetryFor(result)

    // Assert
    expect(telemetry).toBeNull()
  })

  it('stays quiet when nothing was rejected and no session was issued', () => {
    // Arrange — a 200 that minted no cookie grants no sign-in to report.
    const result = { rejected: false, errorCode: null, sessionUserId: undefined }

    // Act
    const telemetry = signInTelemetryFor(result)

    // Assert
    expect(telemetry).toBeNull()
  })
})
