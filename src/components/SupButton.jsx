import './SupButton.css'

export function SupButton({ isActive, loading, onClick, activeCount = 0 }) {
  return (
    <button
      className={`sup-button ${isActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={loading}
    >
      <span className="sup-button-text">
        {loading ? '...' : isActive ? 'Cancel' : 'Sup'}
      </span>
      {isActive && activeCount > 0 && (
        <span className="active-badge">{activeCount}</span>
      )}
      <div className="sup-button-ring"></div>
    </button>
  )
}

export default SupButton
