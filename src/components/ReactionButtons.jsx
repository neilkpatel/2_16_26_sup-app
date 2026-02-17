import './ReactionButtons.css'

const REACTIONS = [
  { key: 'im_in', label: "i'm in", color: '#22c55e' },
  { key: 'cant_tonight', label: "can't tonight", color: '#ef4444' },
  { key: 'maybe_later', label: 'maybe later', color: '#f59e0b' }
]

export function ReactionButtons({ sessionId, sessionIds, currentReaction, onReact }) {
  const ids = sessionIds || (sessionId ? [sessionId] : [])

  const handleReact = (reaction) => {
    ids.forEach(id => onReact(id, reaction))
  }

  return (
    <div className="reaction-buttons">
      {REACTIONS.map(({ key, label, color }) => (
        <button
          key={key}
          className={`reaction-pill ${currentReaction === key ? 'reaction-pill-active' : ''}`}
          style={currentReaction === key ? { background: color, borderColor: color } : {}}
          onClick={() => handleReact(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default ReactionButtons
