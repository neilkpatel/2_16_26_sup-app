import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf-8')

describe('Heading There — Schema', () => {
  it('sup_sessions has destination_name column', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toContain('destination_name text')
  })

  it('sup_sessions has destination_location column', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toContain('destination_location extensions.geography(point, 4326)')
  })
})

describe('Heading There — useSupStatus', () => {
  it('exports setDestination action', () => {
    const content = read('src/hooks/useSupStatus.js')
    expect(content).toContain('setDestination')
    expect(content).toMatch(/return\s*\{[\s\S]*setDestination/)
  })

  it('setDestination updates session with bar name and location', () => {
    const content = read('src/hooks/useSupStatus.js')
    expect(content).toContain('destination_name: bar.name')
    expect(content).toContain('destination_location:')
    expect(content).toContain('bar.location.lng')
    expect(content).toContain('bar.location.lat')
  })

  it('setDestination clears destination when bar is null', () => {
    const content = read('src/hooks/useSupStatus.js')
    expect(content).toContain('destination_name: null')
    expect(content).toContain('destination_location: null')
  })

  it('setDestination does optimistic update', () => {
    const content = read('src/hooks/useSupStatus.js')
    expect(content).toContain('setMySession(prev =>')
  })

  it('exposes myDestination derived value', () => {
    const content = read('src/hooks/useSupStatus.js')
    expect(content).toContain('myDestination')
    expect(content).toMatch(/return\s*\{[\s\S]*myDestination/)
  })

  it('parses destination_location from friend sessions', () => {
    const content = read('src/hooks/useSupStatus.js')
    expect(content).toContain('parsedDestination: parseLocation(session.destination_location)')
  })

  it('setDestination requires active session', () => {
    const content = read('src/hooks/useSupStatus.js')
    expect(content).toContain('if (!mySession) return')
  })
})

describe('Heading There — BarSuggestions', () => {
  it('accepts selectedBarId and onSelectBar props', () => {
    const content = read('src/components/BarSuggestions.jsx')
    expect(content).toContain('selectedBarId')
    expect(content).toContain('onSelectBar')
  })

  it('bar cards are clickable', () => {
    const content = read('src/components/BarSuggestions.jsx')
    expect(content).toContain('onClick={() => onSelectBar?.(bar)')
  })

  it('shows bar-card-selected class for selected bar', () => {
    const content = read('src/components/BarSuggestions.jsx')
    expect(content).toContain('bar-card-selected')
    expect(content).toContain('selectedBarId === bar.id')
  })

  it('shows "Heading here" badge on selected bar', () => {
    const content = read('src/components/BarSuggestions.jsx')
    expect(content).toContain('Heading here')
    expect(content).toContain('bar-heading-badge')
  })

  it('directions link stops propagation (does not toggle selection)', () => {
    const content = read('src/components/BarSuggestions.jsx')
    expect(content).toContain('e.stopPropagation()')
  })

  it('selected card has sky blue border style', () => {
    const css = read('src/components/BarSuggestions.css')
    expect(css).toContain('.bar-card-selected')
    expect(css).toContain('#0ea5e9')
  })
})

describe('Heading There — Home Integration', () => {
  it('Home.jsx tracks selectedBarId state', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('selectedBarId')
    expect(content).toContain('setSelectedBarId')
  })

  it('Home.jsx has handleSelectBar that toggles', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('handleSelectBar')
    // Deselect same bar
    expect(content).toContain('selectedBarId === bar.id')
    expect(content).toContain('setDestination(null)')
    // Select new bar
    expect(content).toContain('setDestination(bar)')
  })

  it('Home.jsx clears selectedBarId when Sup ends', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('if (!isSupActive)')
    expect(content).toContain('setSelectedBarId(null)')
  })

  it('Home.jsx passes selectedBarId and onSelectBar to BarSuggestions', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('selectedBarId={selectedBarId}')
    expect(content).toContain('onSelectBar={handleSelectBar}')
  })

  it('Home.jsx passes myDestination to Map', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('myDestination={myDestination}')
  })

  it('Home.jsx shows friend destination status', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('friend-destination-status')
    expect(content).toContain('is heading to')
    expect(content).toContain('f.destination_name')
  })
})
