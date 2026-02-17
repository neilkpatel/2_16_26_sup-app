import { useState } from 'react'
import './EmptySquad.css'

export function EmptySquad({ profile }) {
  const [copied, setCopied] = useState(false)

  const shareLink = `${window.location.origin}/add/${profile?.username}`

  const handleShare = async () => {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          url: shareLink,
          text: 'Join my squad on Sup!\n\nAfter signing up, tap Share ⬆ then "Add to Home Screen" so you get push notifications when the squad is free.'
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy()
        }
      }
    } else {
      handleCopy()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = shareLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="empty-squad">
      <div className="empty-squad-card">
        <div className="empty-squad-emoji">👋</div>
        <h2 className="empty-squad-title">Build your squad</h2>
        <p className="empty-squad-desc">
          Share your link with friends so they can join your squad. When anyone taps Sup, the whole squad gets notified.
        </p>
        <div className="empty-squad-link">{shareLink}</div>
        <button onClick={handleShare} className="empty-squad-btn">
          {copied ? 'Link copied!' : 'Share your link'}
        </button>
      </div>
    </div>
  )
}

export default EmptySquad
