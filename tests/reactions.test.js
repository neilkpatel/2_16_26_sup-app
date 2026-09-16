import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf-8')

describe('Reactions — Schema', () => {
  it('sup_reactions table exists with correct columns', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toContain('create table sup.sup_reactions')
    expect(schema).toContain('session_id uuid references sup.sup_sessions(id)')
    expect(schema).toContain('user_id uuid references sup.users(id)')
    expect(schema).toContain("reaction text not null check (reaction in ('im_in', 'cant_tonight', 'maybe_later'))")
    expect(schema).toContain('constraint unique_reaction unique (session_id, user_id)')
  })

  it('sup_reactions has RLS enabled', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toContain('alter table sup.sup_reactions enable row level security')
  })

  it('sup_reactions has proper RLS policies', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toContain('reactions_select')
    expect(schema).toContain('reactions_insert')
    expect(schema).toContain('reactions_update')
    expect(schema).toContain('reactions_delete')
  })

  it('sup_reactions select policy scoped to squad visibility', () => {
    const schema = read('supabase/schema.sql')
    // The select policy should check session ownership + friendship
    expect(schema).toContain('reactions_select')
    expect(schema).toMatch(/reactions_select.*sup_sessions/s)
    expect(schema).toMatch(/reactions_select.*friendships/s)
  })

  it('sup_reactions granted to authenticated', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toContain('grant select, insert, update, delete on all tables in schema sup to authenticated')
  })

  it('sup_reactions has realtime enabled', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toContain('alter publication supabase_realtime add table sup.sup_reactions')
  })

  it('sup_reactions cascades on session delete', () => {
    const schema = read('supabase/schema.sql')
    expect(schema).toMatch(/session_id uuid references sup\.sup_sessions\(id\) on delete cascade/)
  })
})

describe('Reactions — Hook', () => {
  it('useReactions hook exports correct interface', () => {
    const content = read('src/hooks/useReactions.js')
    expect(content).toContain('export function useReactions')
    expect(content).toContain('reactions')
    expect(content).toContain('myReactions')
    expect(content).toContain('sendReaction')
    expect(content).toContain('getReactionsForSession')
  })

  it('useReactions uses upsert with onConflict for one-per-user', () => {
    const content = read('src/hooks/useReactions.js')
    expect(content).toContain('.upsert(')
    expect(content).toContain("onConflict: 'session_id,user_id'")
  })

  it('useReactions toggles off when same reaction tapped', () => {
    const content = read('src/hooks/useReactions.js')
    // Should delete when currentReaction === reaction (toggle off)
    expect(content).toContain('currentReaction === reaction')
    expect(content).toContain('.delete()')
  })

  it('useReactions has realtime subscription', () => {
    const content = read('src/hooks/useReactions.js')
    expect(content).toContain('.channel(')
    expect(content).toContain('postgres_changes')
    expect(content).toContain("table: 'sup_reactions'")
  })

  it('useReactions has 5s polling fallback', () => {
    const content = read('src/hooks/useReactions.js')
    expect(content).toContain('setInterval')
    expect(content).toContain('5000')
  })

  it('useReactions stabilizes sessionIds to prevent re-renders', () => {
    const content = read('src/hooks/useReactions.js')
    expect(content).toContain('JSON.stringify(sessionIds)')
    expect(content).toContain('useMemo')
  })

  it('useReactions cleans up subscriptions', () => {
    const content = read('src/hooks/useReactions.js')
    expect(content).toContain('.unsubscribe()')
    expect(content).toContain('clearInterval')
  })

  it('useReactions uses .catch() for fire-and-forget in realtime callback', () => {
    const content = read('src/hooks/useReactions.js')
    expect(content).toContain("fetchReactions().catch(() => {})")
  })
})

describe('Reactions — Components', () => {
  it('ReactionButtons renders 3 reaction types', () => {
    const content = read('src/components/ReactionButtons.jsx')
    expect(content).toContain("i'm in")
    expect(content).toContain("can't tonight")
    expect(content).toContain('maybe later')
  })

  it('ReactionButtons uses correct colors', () => {
    const content = read('src/components/ReactionButtons.jsx')
    expect(content).toContain('#22c55e') // green for i'm in
    expect(content).toContain('#ef4444') // red for can't tonight
    expect(content).toContain('#f59e0b') // amber for maybe later
  })

  it('ReactionButtons highlights active reaction', () => {
    const content = read('src/components/ReactionButtons.jsx')
    expect(content).toContain('reaction-pill-active')
    expect(content).toContain('currentReaction === key')
  })

  it('ReactionsSummary displays user reactions', () => {
    const content = read('src/components/ReactionsSummary.jsx')
    expect(content).toContain('reactions-summary')
    expect(content).toContain('reaction-badge')
    expect(content).toContain('is in')
    expect(content).toContain("can't tonight")
    expect(content).toContain('maybe later')
  })

  it('ReactionsSummary returns null for empty reactions', () => {
    const content = read('src/components/ReactionsSummary.jsx')
    expect(content).toContain('reactions.length === 0')
    expect(content).toContain('return null')
  })
})

describe('Reactions — Home Integration', () => {
  it('Home.jsx imports useReactions', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain("import { useReactions } from '../hooks/useReactions'")
  })

  it('Home.jsx imports ReactionButtons and ReactionsSummary', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain("import ReactionButtons from '../components/ReactionButtons'")
    expect(content).toContain("import ReactionsSummary from '../components/ReactionsSummary'")
  })

  it('Home.jsx shows ReactionButtons in active-friends banner', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('<ReactionButtons')
    expect(content).toContain('sendReaction')
    expect(content).toContain('myReactions')
  })

  it('Home.jsx shows ReactionsSummary in sup-active-info', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('<ReactionsSummary')
    expect(content).toContain('mySessionReactions')
  })

  it('Home.jsx watches correct session IDs for reactions', () => {
    const content = read('src/pages/Home.jsx')
    // When Sup'd, should watch own session; when not, friend sessions
    expect(content).toContain('reactionSessionIds')
    expect(content).toContain('mySession.id')
    expect(content).toContain("friendSessions.map(s => s.id)")
  })
})
