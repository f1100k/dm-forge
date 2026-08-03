// Truncates a client IP to the network prefix stored on a ConsentRecord
// (Tech Design §4.2/§14.2). LGPD treats a full IP as personal data once it can
// be combined with other identifiers, and a consent record already names the
// person — so the evidence kept is the network the acceptance came from, never
// the address that would single out a device.
//
// IPv4 keeps the first three octets (/24), IPv6 the first three hextets (/48).

export function toIpPrefix(ip: string): string | null {
  const value = ip.trim()
  if (!value) return null

  // IPv4-mapped IPv6 (::ffff:203.0.113.7) is an IPv4 address wearing a costume;
  // truncate what it actually is.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value)
  if (mapped?.[1]) return toIpv4Prefix(mapped[1])

  if (value.includes(':')) return toIpv6Prefix(value)
  return toIpv4Prefix(value)
}

function toIpv4Prefix(ip: string): string | null {
  const octets = ip.split('.')
  if (octets.length !== 4) return null
  if (!octets.every(isOctet)) return null
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`
}

function isOctet(part: string): boolean {
  if (!/^\d{1,3}$/.test(part)) return false
  return Number(part) <= 255
}

function toIpv6Prefix(ip: string): string | null {
  // Zone index (fe80::1%eth0) is local routing information, not part of the
  // address.
  const address = ip.split('%')[0] ?? ''
  if (!/^[0-9a-f:]+$/i.test(address)) return null

  const hextets = expand(address)
  if (!hextets) return null

  const prefix = hextets.slice(0, 3).map(normaliseHextet)
  if (prefix.some((hextet) => hextet === null)) return null
  return `${prefix.join(':')}::/48`
}

// Restores the eight hextets a "::" collapsed. The run of zeros it stands for
// can sit anywhere, so the address has to be expanded before the first three
// hextets mean anything — in `fe80::1` the "1" is the *last* hextet, not the
// third.
function expand(address: string): string[] | null {
  const sides = address.split('::')
  // More than one "::" is ambiguous, and therefore not an address.
  if (sides.length > 2) return null

  const head = sides[0] ? sides[0].split(':') : []
  if (sides.length === 1) return head.length === 8 ? head : null

  const tail = sides[1] ? sides[1].split(':') : []
  const zeros = 8 - head.length - tail.length
  if (zeros < 1) return null
  return [...head, ...Array<string>(zeros).fill('0'), ...tail]
}

// One network, one spelling: leading zeros are dropped and the digits
// lower-cased, so `2001:0db8:…` and `2001:DB8:…` do not become two different
// records of the same place.
function normaliseHextet(value: string | undefined): string | null {
  if (value === undefined || value === '') return '0'
  if (!/^[0-9a-f]{1,4}$/i.test(value)) return null
  return value.toLowerCase().replace(/^0+(?=.)/, '')
}
