import { describe, expect, it } from 'vitest'
import { toIpPrefix } from './ip-prefix.js'

describe('toIpPrefix', () => {
  it('keeps the first three octets of an IPv4 address', () => {
    // Arrange + Act
    const prefix = toIpPrefix('203.0.113.7')

    // Assert — Tech Design §14.2: the network, never the host.
    expect(prefix).toBe('203.0.113.0/24')
  })

  it('drops the host octet even when it is zero already', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('203.0.113.0')).toBe('203.0.113.0/24')
  })

  it('accepts the boundary octet 255', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('255.255.255.255')).toBe('255.255.255.0/24')
  })

  it('rejects an octet above 255', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('203.0.113.256')).toBeNull()
  })

  it('rejects an address with too few octets', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('203.0.113')).toBeNull()
  })

  it('keeps the first three hextets of an IPv6 address', () => {
    // Arrange + Act
    const prefix = toIpPrefix('2001:0db8:85a3:0000:0000:8a2e:0370:7334')

    // Assert — leading zeros dropped, so one network has one spelling.
    expect(prefix).toBe('2001:db8:85a3::/48')
  })

  it('rejects an address with more hextets than exist', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('1:2:3:4:5:6:7:8:9')).toBeNull()
  })

  it('rejects an address with two collapsed runs', () => {
    // Arrange + Act + Assert — ambiguous, and therefore not an address.
    expect(toIpPrefix('2001::db8::1')).toBeNull()
  })

  it('rejects a short address that never collapsed anything', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('2001:db8:85a3')).toBeNull()
  })

  it('treats a leading :: as three zero hextets', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('::1')).toBe('0:0:0::/48')
  })

  it('fills in the hextets a mid-address :: collapsed', () => {
    // Arrange + Act + Assert — "2001:db8::1" has only two hextets before the
    // collapse, and the third is one of the zeros it stands for.
    expect(toIpPrefix('2001:db8::1')).toBe('2001:db8:0::/48')
  })

  it('truncates an IPv4-mapped IPv6 address as the IPv4 it is', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('::ffff:203.0.113.7')).toBe('203.0.113.0/24')
  })

  it('ignores the zone index', () => {
    // Arrange + Act + Assert — routing detail, not part of the address.
    expect(toIpPrefix('fe80::1%eth0')).toBe('fe80:0:0::/48')
  })

  it('lower-cases the hextets so one network has one representation', () => {
    // Arrange + Act + Assert
    expect(toIpPrefix('2001:DB8:85A3::1')).toBe('2001:db8:85a3::/48')
  })

  it('returns null for an empty value', () => {
    // Arrange + Act + Assert — the caller stores null rather than a fake
    // network when the request carried no usable address.
    expect(toIpPrefix('   ')).toBeNull()
  })

  it('returns null for the unknown-client placeholder', () => {
    // Arrange + Act + Assert — resolveClientIp answers 'unknown' behind a proxy
    // that forwarded nothing; that is not an address to truncate.
    expect(toIpPrefix('unknown')).toBeNull()
  })
})
