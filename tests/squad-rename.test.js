import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf-8')

describe('Squad rename (Friends → Squad)', () => {
  it('Home.jsx nav button says "Squad"', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('Squad ({friends.length})')
    expect(content).toContain('your squad')
  })

  it('Profile.jsx uses "Squad" not "Friends"', () => {
    const content = read('src/pages/Profile.jsx')
    expect(content).toContain('Your Squad Link')
    expect(content).toContain('in your squad')
    expect(content).not.toContain('Your Friend Link')
  })

  it('AddFriend.jsx uses "squad" language', () => {
    const content = read('src/pages/AddFriend.jsx')
    expect(content).toContain('to your squad')
    expect(content).toContain('Join Squad')
    expect(content).toContain('joined your squad')
    expect(content).toContain('Already in your squad')
    expect(content).not.toContain('Add Friend')
    expect(content).not.toContain('are now friends')
  })

  it('FriendsList.jsx uses "Squad" and link-only adding', () => {
    const content = read('src/components/FriendsList.jsx')
    expect(content).toContain('>Squad<')
    expect(content).toContain('Share your squad link')
    expect(content).toContain('No one in your squad yet')
    expect(content).not.toContain('>Friends<')
    expect(content).not.toContain('Enter username')
  })
})
