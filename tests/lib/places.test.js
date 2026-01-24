import { describe, it, expect } from 'vitest'
import { parsePlacesResponse, formatPriceLevel } from '../../src/lib/places'

describe('parsePlacesResponse', () => {
  it('parses empty results', () => {
    expect(parsePlacesResponse([])).toEqual([])
  })

  it('parses a single place correctly', () => {
    const mockResults = [
      {
        place_id: 'abc123',
        name: 'Test Bar',
        vicinity: '123 Main St',
        geometry: {
          location: { lat: 40.7128, lng: -74.006 }
        },
        rating: 4.5,
        price_level: 2,
        user_ratings_total: 100,
        opening_hours: { open_now: true },
        photos: [{ photo_reference: 'photo123' }]
      }
    ]

    const result = parsePlacesResponse(mockResults)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'abc123',
      name: 'Test Bar',
      address: '123 Main St',
      location: { lat: 40.7128, lng: -74.006 },
      rating: 4.5,
      priceLevel: 2,
      totalRatings: 100,
      isOpen: true,
      photo: 'photo123'
    })
  })

  it('handles missing optional fields', () => {
    const mockResults = [
      {
        place_id: 'xyz789',
        name: 'Simple Bar',
        vicinity: '456 Oak Ave',
        geometry: {
          location: { lat: 34.0522, lng: -118.2437 }
        }
      }
    ]

    const result = parsePlacesResponse(mockResults)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'xyz789',
      name: 'Simple Bar',
      address: '456 Oak Ave',
      location: { lat: 34.0522, lng: -118.2437 },
      rating: null,
      priceLevel: null,
      totalRatings: 0,
      isOpen: null,
      photo: null
    })
  })

  it('parses multiple places', () => {
    const mockResults = [
      {
        place_id: 'bar1',
        name: 'Bar One',
        vicinity: 'Address 1',
        geometry: { location: { lat: 40, lng: -74 } }
      },
      {
        place_id: 'bar2',
        name: 'Bar Two',
        vicinity: 'Address 2',
        geometry: { location: { lat: 41, lng: -75 } }
      }
    ]

    const result = parsePlacesResponse(mockResults)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('bar1')
    expect(result[1].id).toBe('bar2')
  })
})

describe('formatPriceLevel', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatPriceLevel(null)).toBe('')
    expect(formatPriceLevel(undefined)).toBe('')
  })

  it('formats price level 0 as $', () => {
    expect(formatPriceLevel(0)).toBe('$')
  })

  it('formats price level 1 as $$', () => {
    expect(formatPriceLevel(1)).toBe('$$')
  })

  it('formats price level 2 as $$$', () => {
    expect(formatPriceLevel(2)).toBe('$$$')
  })

  it('formats price level 3 as $$$$', () => {
    expect(formatPriceLevel(3)).toBe('$$$$')
  })
})
