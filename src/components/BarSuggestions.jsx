import { useState, useEffect, useMemo } from 'react'
import { searchNearbyBars, formatPriceLevel } from '../lib/places'
import './BarSuggestions.css'

export function BarSuggestions({ location, selectedBarId, onSelectBar, friendDestinations = [] }) {
  const [bars, setBars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchBars() {
      if (!location) return

      setLoading(true)
      setError('')

      try {
        const results = await searchNearbyBars(location)
        setBars(results)
      } catch (err) {
        console.error('Error fetching bars:', err)
        setError('Could not load bar suggestions')
      } finally {
        setLoading(false)
      }
    }

    fetchBars()
  }, [location?.lat, location?.lng])

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

    if (topBarName && maxCount >= 2) {
      return tagged.map(bar =>
        bar.name === topBarName ? { ...bar, _isTopPick: true } : bar
      )
    }
    return tagged
  }, [bars, friendDestinations])

  if (loading) {
    return (
      <div className="bar-suggestions">
        <h3>Finding nearby spots...</h3>
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
        <p className="bars-empty">No bars found nearby</p>
      </div>
    )
  }

  return (
    <div className="bar-suggestions">
      <h3>Suggested meetup spots</h3>
      <div className="bars-list">
        {displayBars.map((bar, index) => (
          <div
            key={bar.id}
            className={`bar-card ${bar._pinnedBy ? 'bar-card-pinned' : ''} ${bar.id === 'ChIJL0D4jJNZwokRWQTfTBLjlvw' ? 'bar-card-featured' : ''} ${selectedBarId === bar.id ? 'bar-card-selected' : ''}`}
            onClick={() => onSelectBar?.(bar)}
            style={{ cursor: onSelectBar ? 'pointer' : 'default' }}
          >
            <div className={`bar-rank ${bar._pinnedBy ? 'bar-rank-pinned' : ''}`}>
              {index + 1}
            </div>
            <div className="bar-info">
              <h4 className="bar-name">{bar.name}{bar._isTopPick && <span className="bar-trophy"> 🏆</span>}</h4>
              {bar._pinnedBy && (
                <span className="bar-pinned-badge">
                  @{bar._pinnedBy.join(', @')} heading here
                </span>
              )}
              {selectedBarId === bar.id && !bar._pinnedBy && (
                <span className="bar-heading-badge">Heading here</span>
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
