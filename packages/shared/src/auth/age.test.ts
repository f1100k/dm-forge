import { describe, expect, it } from 'vitest'
import { computeAge, isOldEnough, MINIMUM_AGE } from './age.js'

// Fixed reference instant so the boundary tests never depend on the real clock.
const NOW = new Date('2026-07-31T00:00:00.000Z')

describe('computeAge', () => {
  it('counts full years for a birthday that already passed this year', () => {
    // Arrange
    const dob = new Date('2000-01-15T00:00:00.000Z')

    // Act
    const age = computeAge(dob, NOW)

    // Assert
    expect(age).toBe(26)
  })

  it('does not count the current year when the birthday has not arrived yet', () => {
    // Arrange
    const dob = new Date('2000-12-31T00:00:00.000Z')

    // Act
    const age = computeAge(dob, NOW)

    // Assert
    expect(age).toBe(25)
  })

  it('counts the year on the exact birthday', () => {
    // Arrange
    const dob = new Date('2000-07-31T00:00:00.000Z')

    // Act
    const age = computeAge(dob, NOW)

    // Assert
    expect(age).toBe(26)
  })
})

describe('isOldEnough', () => {
  it('rejects someone one day short of the minimum age', () => {
    // Arrange — turns 13 tomorrow.
    const dob = new Date('2013-08-01T00:00:00.000Z')

    // Act + Assert
    expect(isOldEnough(dob, MINIMUM_AGE, NOW)).toBe(false)
  })

  it('accepts someone exactly at the minimum age', () => {
    // Arrange — turns 13 today.
    const dob = new Date('2013-07-31T00:00:00.000Z')

    // Act + Assert
    expect(isOldEnough(dob, MINIMUM_AGE, NOW)).toBe(true)
  })

  it('accepts someone above the minimum age', () => {
    // Arrange
    const dob = new Date('2011-07-31T00:00:00.000Z')

    // Act + Assert
    expect(isOldEnough(dob, MINIMUM_AGE, NOW)).toBe(true)
  })

  it('accepts an ISO date string, matching a JSON request body', () => {
    // Act + Assert
    expect(isOldEnough('2000-01-01', MINIMUM_AGE, NOW)).toBe(true)
  })

  it.each([
    undefined,
    null,
    '',
    'not-a-date',
    {},
    [],
  ])('fails closed for invalid input %p', (input) => {
    expect(isOldEnough(input, MINIMUM_AGE, NOW)).toBe(false)
  })

  it('fails closed for a future date of birth', () => {
    // Arrange
    const dob = new Date('2030-01-01T00:00:00.000Z')

    // Act + Assert
    expect(isOldEnough(dob, MINIMUM_AGE, NOW)).toBe(false)
  })
})
