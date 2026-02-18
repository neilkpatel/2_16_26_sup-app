import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf-8')

describe('Map Animations — AnimatedMarker', () => {
  it('Map.jsx has AnimatedMarker component', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('function AnimatedMarker')
  })

  it('AnimatedMarker uses requestAnimationFrame for smooth movement', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('requestAnimationFrame')
    expect(content).toContain('cancelAnimationFrame')
  })

  it('AnimatedMarker uses ease-out cubic interpolation', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('1 - Math.pow(1 - progress, 3)')
  })

  it('AnimatedMarker cleans up animation frames on unmount', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('cancelAnimationFrame(animFrame.current)')
  })

  it('AnimatedMarker handles same position (no animation needed)', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('from[0] === position[0] && from[1] === position[1]')
  })

  it('AnimatedMarker tracks previous position with ref', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('prevPosition')
    expect(content).toContain('useRef(position)')
  })

  it('AnimatedMarker has pop-in animation for new markers', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('isNew')
    expect(content).toContain('marker-appear')
  })
})

describe('Map Animations — Destination Lines', () => {
  it('Map.jsx imports Polyline from react-leaflet', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain("Polyline")
    expect(content).toMatch(/import.*Polyline.*from 'react-leaflet'/)
  })

  it('Map.jsx draws polyline from user to destination', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('myDestination?.location')
    expect(content).toContain('<Polyline')
    expect(content).toContain('destinationLineStyle')
  })

  it('Map.jsx draws polylines for friend destinations', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('session.parsedDestination')
    expect(content).toContain("key={`line-${session.id}`}")
  })

  it('destination lines have dashed styling', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain("dashArray: '8, 8'")
  })
})

describe('Map Animations — Status Colors', () => {
  it('heading markers use sky blue color (#0ea5e9)', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain("HEADING_COLOR = '#0ea5e9'")
  })

  it('user marker changes color when heading', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('myDestination ? radarBeaconHeadingIcon : radarBeaconIcon')
  })

  it('friend markers change color when heading', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('hasDestination')
    expect(content).toContain('friendHeadingIcon')
  })

  it('heading markers show destination in popup', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('Heading to')
    expect(content).toContain('myDestination.name')
    expect(content).toContain('session.destination_name')
  })
})

describe('Map Animations — CSS', () => {
  it('has marker-pop-in keyframes', () => {
    const css = read('src/components/Map.css')
    expect(css).toContain('@keyframes marker-pop-in')
    expect(css).toContain('scale(0)')
    expect(css).toContain('scale(1)')
  })

  it('has pulse ring animation', () => {
    const css = read('src/components/Map.css')
    expect(css).toContain('.marker-pulse-ring')
    expect(css).toContain('@keyframes marker-pulse')
  })

  it('heading markers have blue glow shadow', () => {
    const css = read('src/components/Map.css')
    expect(css).toContain('.marker-heading .marker-pin')
    expect(css).toContain('rgba(14, 165, 233')
  })

  it('Map.jsx accepts myDestination prop', () => {
    const content = read('src/components/Map.jsx')
    expect(content).toContain('myDestination')
    expect(content).toMatch(/export function Map\(\{[\s\S]*myDestination/)
  })
})
