import { describe, it, expect } from 'vitest'
import { calculateMidpoint, calculateDistance, formatDistance } from '../../src/lib/geo'

describe('calculateMidpoint', () => {
  it('returns null for empty array', () => {
    expect(calculateMidpoint([])).toBeNull()
  })

  it('returns null for null/undefined input', () => {
    expect(calculateMidpoint(null)).toBeNull()
    expect(calculateMidpoint(undefined)).toBeNull()
  })

  it('returns the same point for single coordinate', () => {
    const point = { lat: 40.7128, lng: -74.006 }
    const result = calculateMidpoint([point])
    expect(result.lat).toBeCloseTo(point.lat, 5)
    expect(result.lng).toBeCloseTo(point.lng, 5)
  })

  it('calculates midpoint of two points', () => {
    const points = [
      { lat: 40.7128, lng: -74.006 },  // NYC
      { lat: 34.0522, lng: -118.2437 } // LA
    ]
    const result = calculateMidpoint(points)

    // Midpoint should be roughly between the two cities
    expect(result.lat).toBeGreaterThan(34)
    expect(result.lat).toBeLessThan(41)
    expect(result.lng).toBeGreaterThan(-118)
    expect(result.lng).toBeLessThan(-74)
  })

  it('calculates midpoint of three points', () => {
    const points = [
      { lat: 40.7128, lng: -74.006 },   // NYC
      { lat: 34.0522, lng: -118.2437 }, // LA
      { lat: 41.8781, lng: -87.6298 }   // Chicago
    ]
    const result = calculateMidpoint(points)

    expect(result).toHaveProperty('lat')
    expect(result).toHaveProperty('lng')
    expect(typeof result.lat).toBe('number')
    expect(typeof result.lng).toBe('number')
  })

  it('handles points at same location', () => {
    const point = { lat: 40.7128, lng: -74.006 }
    const points = [point, point, point]
    const result = calculateMidpoint(points)

    expect(result.lat).toBeCloseTo(point.lat, 5)
    expect(result.lng).toBeCloseTo(point.lng, 5)
  })

  it('handles points across prime meridian', () => {
    const points = [
      { lat: 51.5074, lng: -0.1278 }, // London
      { lat: 48.8566, lng: 2.3522 }   // Paris
    ]
    const result = calculateMidpoint(points)

    // Should be between London and Paris
    expect(result.lat).toBeGreaterThan(48)
    expect(result.lat).toBeLessThan(52)
  })
})

describe('calculateDistance', () => {
  it('returns 0 for same point', () => {
    const point = { lat: 40.7128, lng: -74.006 }
    expect(calculateDistance(point, point)).toBe(0)
  })

  it('calculates distance between NYC and LA', () => {
    const nyc = { lat: 40.7128, lng: -74.006 }
    const la = { lat: 34.0522, lng: -118.2437 }
    const distance = calculateDistance(nyc, la)

    // NYC to LA is approximately 3940 km
    expect(distance).toBeGreaterThan(3900)
    expect(distance).toBeLessThan(4000)
  })

  it('calculates distance between London and Paris', () => {
    const london = { lat: 51.5074, lng: -0.1278 }
    const paris = { lat: 48.8566, lng: 2.3522 }
    const distance = calculateDistance(london, paris)

    // London to Paris is approximately 340 km
    expect(distance).toBeGreaterThan(330)
    expect(distance).toBeLessThan(360)
  })
})

describe('formatDistance', () => {
  it('formats distance in meters for < 1km', () => {
    expect(formatDistance(0.5)).toBe('500 m')
    expect(formatDistance(0.1)).toBe('100 m')
    expect(formatDistance(0.05)).toBe('50 m')
  })

  it('formats distance in km for >= 1km', () => {
    expect(formatDistance(1)).toBe('1.0 km')
    expect(formatDistance(2.5)).toBe('2.5 km')
    expect(formatDistance(10.123)).toBe('10.1 km')
  })
})
