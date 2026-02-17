import { describe, it, expect } from 'vitest'
import { calculateMidpoint, calculateDistance, formatDistance } from '../src/lib/geo'

describe('calculateMidpoint', () => {
  it('returns null for empty array', () => {
    expect(calculateMidpoint([])).toBeNull()
  })

  it('returns the point itself for single point', () => {
    const result = calculateMidpoint([{ lat: 40, lng: -74 }])
    expect(result.lat).toBeCloseTo(40, 0)
    expect(result.lng).toBeCloseTo(-74, 0)
  })

  it('returns midpoint for two points', () => {
    const p1 = { lat: 40.7128, lng: -74.0060 }
    const p2 = { lat: 40.7580, lng: -73.9855 }
    const mid = calculateMidpoint([p1, p2])
    expect(mid).toBeTruthy()
    expect(mid.lat).toBeCloseTo(40.7354, 2)
    expect(mid.lng).toBeCloseTo(-73.9958, 2)
  })
})

describe('calculateDistance', () => {
  it('returns 0 for same point', () => {
    const p = { lat: 40.7128, lng: -74.0060 }
    expect(calculateDistance(p, p)).toBe(0)
  })

  it('calculates reasonable distance', () => {
    const nyc = { lat: 40.7128, lng: -74.0060 }
    const midtown = { lat: 40.7580, lng: -73.9855 }
    const dist = calculateDistance(nyc, midtown)
    expect(dist).toBeGreaterThan(4)
    expect(dist).toBeLessThan(7)
  })
})

describe('formatDistance', () => {
  it('formats meters for < 1km', () => {
    expect(formatDistance(0.5)).toContain('m')
  })

  it('formats km for >= 1km', () => {
    expect(formatDistance(2.5)).toContain('km')
  })
})
