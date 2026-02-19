import './SupButton.css'

export function SupButton({ isActive, loading, onClick, activeCount = 0 }) {
  const label = loading ? '...' : isActive ? 'End Sup' : 'Sup'

  return (
    <button
      className={`sup-fab ${isActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
      onClick={onClick}
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
