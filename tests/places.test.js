import { describe, it, expect } from 'vitest'
import { formatPriceLevel } from '../src/lib/places'

describe('formatPriceLevel', () => {
  it('returns dollar signs', () => {
    const result = formatPriceLevel(2)
    expect(result).toContain('$')
    expect(result.length).toBeGreaterThan(0)
  })

  it('higher level means more dollar signs', () => {
    const low = formatPriceLevel(1)
    const high = formatPriceLevel(3)
    expect(high.length).toBeGreaterThan(low.length)
  })
})
