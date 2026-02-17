import { useState, useEffect, useRef } from 'react'
import './SupButton.css'

export function SupButton({ isActive, loading, onClick, activeCount = 0 }) {
  const [confirming, setConfirming] = useState(false)
  const confirmTimer = useRef(null)

  // Reset confirm state when isActive changes
  useEffect(() => {
    setConfirming(false)
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current)
      confirmTimer.current = null
    }
  }, [isActive])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  const handleClick = () => {
    if (loading) return

    if (!isActive) {
      // Inactive: go Sup directly
      onClick()
    } else if (!confirming) {
      // Active, first tap: enter confirm mode
      setConfirming(true)
      confirmTimer.current = setTimeout(() => {
        setConfirming(false)
        confirmTimer.current = null
      }, 3000)
    } else {
      // Active, second tap: actually cancel
      setConfirming(false)
      if (confirmTimer.current) {
        clearTimeout(confirmTimer.current)
        confirmTimer.current = null
      }
      onClick()
    }
  }

  const label = loading ? '...' : confirming ? 'Sure?' : isActive ? 'Done' : 'Sup'

  return (
    <button
      className={`sup-fab ${isActive ? 'active' : ''} ${confirming ? 'confirming' : ''} ${loading ? 'loading' : ''}`}
      onClick={handleClick}
      disabled={loading}
    >
      <span className="sup-fab-text">{label}</span>
      {isActive && activeCount > 0 && (
        <span className="sup-fab-badge">{activeCount}</span>
      )}
      <div className="sup-fab-ring"></div>
    </button>
  )
}

export default SupButton
