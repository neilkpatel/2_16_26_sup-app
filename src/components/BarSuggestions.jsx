import { useState, useEffect } from 'react'
import { searchNearbyBars, formatPriceLevel } from '../lib/places'
import './BarSuggestions.css'

export function BarSuggestions({ location }) {
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

  if (bars.length === 0) {
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
        {bars.map((bar, index) => (
          <div key={bar.id} className={`bar-card ${bar.id === 'ChIJL0D4jJNZwokRWQTfTBLjlvw' ? 'bar-card-featured' : ''}`}>
            <div className="bar-rank">{index + 1}</div>
            <div className="bar-info">
              <h4 className="bar-name">{bar.name}</h4>
              <p className="bar-address">{bar.address}</p>
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
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${bar.location.lat},${bar.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bar-directions"
            >
              Directions
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BarSuggestions
