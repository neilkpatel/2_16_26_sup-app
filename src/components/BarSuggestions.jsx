import { useState, useEffect, useMemo } from 'react'
import { searchNearbyPlaces, formatPriceLevel } from '../lib/places'
import './BarSuggestions.css'

export function BarSuggestions({ location, selectedBarId, onSelectBar, friendDestinations = [], placeType = 'bar' }) {
  const [bars, setBars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isCafe = placeType === 'cafe'
  const label = isCafe ? 'coffee spot' : 'bar'

  useEffect(() => {
    async function fetchPlaces() {
      if (!location) return

      setLoading(true)
      setError('')

      try {
        const results = await searchNearbyPlaces(location, 1500, placeType)
        setBars(results)
      } catch (err) {
        console.error(`Error fetching ${label}s:`, err)
        setError(`Could not load ${label} suggestions`)
      } finally {
        setLoading(false)
      }
    }

    fetchPlaces()
  }, [location?.lat, location?.lng, placeType])

  // Tag bars that friends are heading to (keep in natural order)
  const displayBars = useMemo(() => {
    if (!friendDestinations.length) return bars

    const destMap = {}
    friendDestinations.forEach(fd => {
      if (!destMap[fd.name]) {
        destMap[fd.name] = fd.usernames
      }
    })

    const tagged = bars.map(bar => {
      const headingUsers = destMap[bar.name]
      return headingUsers ? { ...bar, _pinnedBy: headingUsers } : bar
    })

    // Find the bar with the most people heading there
    let maxCount = 0
    let topBarName = null
    tagged.forEach(bar => {
      const count = bar._pinnedBy ? bar._pinnedBy.length : 0
      if (count > maxCount) {
        maxCount = count
        topBarName = bar.name
      }
    })

    // Mark the top pick (even with 1 person heading there)
    if (topBarName && maxCount >= 1) {
      tagged.forEach(bar => {
        if (bar.name === topBarName) bar._isTopPick = true
      })
    }

    // Sort: bars with people heading there first
    tagged.sort((a, b) => {
      const aCount = a._pinnedBy ? a._pinnedBy.length : 0
      const bCount = b._pinnedBy ? b._pinnedBy.length : 0
      return bCount - aCount
    })

    return tagged
  }, [bars, friendDestinations])

  if (loading) {
    return (
      <div className="bar-suggestions">
        <h3>Finding nearby {isCafe ? 'coffee spots' : 'spots'}...</h3>
        <div className="bars-loading">
          <div className="bar-skeleton"></div>
          <div className="bar-skeleton"></div>
          <div className="bar-skeleton"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bar-suggestions">
        <p className="bars-error">{error}</p>
      </div>
    )
  }

  if (displayBars.length === 0 && bars.length === 0) {
    return (
      <div className="bar-suggestions">
        <p className="bars-empty">No {label}s found nearby</p>
      </div>
    )
  }

  return (
    <div className={`bar-suggestions ${isCafe ? 'bar-suggestions-cafe' : ''}`}>
      <h3>{isCafe ? 'Where to grab coffee?' : 'Where to meet up?'}</h3>
      <div className="bars-list">
        {displayBars.map((bar, index) => (
          <div
            key={bar.id}
            className={`bar-card ${bar._pinnedBy ? 'bar-card-pinned' : ''} ${isCafe ? 'bar-card-cafe' : ''} ${selectedBarId === bar.id ? 'bar-card-selected' : ''}`}
            onClick={() => onSelectBar?.(bar)}
            style={{ cursor: onSelectBar ? 'pointer' : 'default' }}
          >
            <div className={`bar-rank ${bar._pinnedBy ? 'bar-rank-pinned' : ''} ${isCafe ? 'bar-rank-cafe' : ''}`}>
              {index + 1}
            </div>
            <div className="bar-info">
              <h4 className="bar-name">{bar.name}{bar._isTopPick && <span className="bar-trophy"> 🏆</span>}</h4>
              {bar._pinnedBy && (
                <span className="bar-pinned-badge">
                  {selectedBarId === bar.id
                    ? `You + @${bar._pinnedBy.join(', @')} heading here`
                    : `@${bar._pinnedBy.join(', @')} heading here — tap to join`}
                </span>
              )}
              {selectedBarId === bar.id && !bar._pinnedBy && (
                <span className="bar-heading-badge">You're heading here</span>
              )}
              {bar.address && <p className="bar-address">{bar.address}</p>}
              <div className="bar-meta">
                {bar.walkMinutes != null && (
                  <span className="bar-walk">
                    {bar.walkMinutes <= 1 ? '1 min walk' : `${bar.walkMinutes} min walk`}
                  </span>
                )}
                {bar.rating && (
                  <span className="bar-rating">
                    <span className="star">&#9733;</span>
                    {bar.rating}
                  </span>
                )}
                {bar.priceLevel !== null && (
                  <span className="bar-price">
                    {formatPriceLevel(bar.priceLevel)}
                  </span>
                )}
                {bar.isOpen !== null && (
                  <span className={`bar-open ${bar.isOpen ? 'open' : 'closed'}`}>
                    {bar.isOpen ? 'Open' : 'Closed'}
                  </span>
                )}
              </div>
            </div>
            {bar.location && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${bar.location.lat},${bar.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bar-directions"
                onClick={(e) => e.stopPropagation()}
              >
                Directions
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default BarSuggestions
