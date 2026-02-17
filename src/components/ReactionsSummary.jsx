import './ReactionsSummary.css'

const REACTION_LABELS = {
  im_in: 'is in',
  cant_tonight: "can't tonight",
  maybe_later: 'maybe later'
}

const REACTION_COLORS = {
  im_in: '#22c55e',
  cant_tonight: '#ef4444',
  maybe_later: '#f59e0b'
}

export function ReactionsSummary({ reactions }) {
  if (!reactions || reactions.length === 0) return null

  return (
    <div className="reactions-summary">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="reaction-badge"
          style={{ color: REACTION_COLORS[r.reaction] }}
        >
          @{r.user?.username || 'someone'} {REACTION_LABELS[r.reaction]}
        </span>
      ))}
    </div>
  )
}

export default ReactionsSummary
