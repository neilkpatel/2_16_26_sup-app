// End-to-end smoke test of the live Sup backend, run as real users through the anon key.
// Creates three throwaway accounts (sup-smoke-*@neilkpatel.com). No email is sent because
// mailer_autoconfirm is on. The caller deletes them afterwards via SQL (auth.users cascades).
//
//   node scripts/smoke.mjs
//
// Exits 1 if any check fails.
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const TAG = Date.now().toString(36)

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const client = () =>
  createClient(URL_, ANON, { db: { schema: 'sup' }, auth: { persistSession: false, autoRefreshToken: false } })

async function makeUser(letter) {
  const sb = client()
  const email = `sup-smoke-${letter}-${TAG}@neilkpatel.com`
  const { data, error } = await sb.auth.signUp({ email, password: `Smoke-${TAG}-${letter}-pw!` })
  check(`signup ${letter} returns a session (autoconfirm on)`, !error && !!data.session, error?.message)
  if (!data?.user) throw new Error(`signup ${letter} failed: ${error?.message}`)
  const username = `smoke_${letter}_${TAG}`
  const ins = await sb.from('users').insert({ id: data.user.id, username, phone: null })
  check(`profile row ${letter}`, !ins.error, ins.error?.message)
  return { sb, id: data.user.id, username }
}

try {
  console.log(`Smoke test against ${URL_} (tag ${TAG})`)
  const a = await makeUser('a')
  const b = await makeUser('b')
  const c = await makeUser('c')

  // Anyone can look up a username (the /add/:username page), logged out
  const anon = client()
  const look = await anon.from('users').select('id, username').eq('username', a.username)
  check('logged-out username lookup', !look.error && look.data?.length === 1, look.error?.message)
  const rest = await fetch(`${URL_}/rest/v1/users?username=eq.${a.username}&select=id,username`, {
    headers: { apikey: ANON, Accept: 'application/json', 'Accept-Profile': 'sup' },
  })
  check('raw REST lookup with Accept-Profile: sup (AddFriend page)', rest.ok && (await rest.json()).length === 1, `HTTP ${rest.status}`)
  const anonSess = await anon.from('sup_sessions').select('id')
  check('logged-out visitor sees no sessions', !anonSess.error ? anonSess.data.length === 0 : true, anonSess.error?.message)

  // A joins B's squad
  const fr = await a.sb.from('friendships').insert({ user_id: a.id, friend_id: b.id })
  check('friendship insert', !fr.error, fr.error?.message)
  const bf = await b.sb
    .from('friendships')
    .select('id, friend:users!friendships_friend_id_fkey(id, username), user:users!friendships_user_id_fkey(id, username)')
    .or(`user_id.eq.${b.id},friend_id.eq.${b.id}`)
  check('friend sees the friendship with both user joins', !bf.error && bf.data?.length === 1 && bf.data[0].user?.username === a.username, bf.error?.message)

  // B listens for A going Sup over realtime
  // SUBSCRIBED only means the channel joined. On a cold realtime tenant the Postgres listener
  // starts seconds later, and a row inserted before then is never delivered (first run 9/15/26
  // failed exactly that way), so wait for the postgres_changes "system" ack before inserting.
  let realtimeHit = false
  let pgAck = null
  const channel = b.sb
    .channel(`smoke-${TAG}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'sup', table: 'sup_sessions' }, () => { realtimeHit = true })
    .on('system', {}, payload => { if (payload?.extension === 'postgres_changes') pgAck = payload })
  await b.sb.realtime.setAuth((await b.sb.auth.getSession()).data.session.access_token)
  const subStatus = await new Promise(resolve => {
    const t = setTimeout(() => resolve('TIMEOUT'), 10000)
    channel.subscribe(s => { if (s !== 'CLOSED') { clearTimeout(t); resolve(s) } })
  })
  check('realtime channel subscribed', subStatus === 'SUBSCRIBED', subStatus)
  for (let i = 0; i < 80 && !pgAck; i++) await sleep(250)
  check('realtime Postgres listener ready', pgAck?.status === 'ok', pgAck ? `${pgAck.status}: ${pgAck.message}` : 'no ack in 20s')
  await sleep(1000)

  // A goes Sup
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const sess = await a.sb
    .from('sup_sessions')
    .insert({ user_id: a.id, location: 'POINT(-73.9937 40.7359)', started_at: new Date().toISOString(), expires_at: expires })
    .select()
    .single()
  check('go Sup (PostGIS point insert)', !sess.error && !!sess.data?.id, sess.error?.message)

  const fs = await b.sb.from('sup_sessions').select('*, user:users(id, username)').in('user_id', [a.id]).gt('expires_at', new Date().toISOString())
  const loc = fs.data?.[0]?.location
  check('friend sees the Sup with user join', !fs.error && fs.data?.length === 1 && fs.data[0].user?.username === a.username, fs.error?.message)
  check('location comes back as WKB hex the app can parse', typeof loc === 'string' && /^[0-9a-fA-F]{42,}$/.test(loc), typeof loc === 'string' ? loc.slice(0, 12) + '…' : JSON.stringify(loc))

  const cs = await c.sb.from('sup_sessions').select('id').eq('user_id', a.id)
  check('non-squad user cannot see the Sup', !cs.error && cs.data?.length === 0, cs.error?.message)

  // B reacts
  const re = await b.sb.from('sup_reactions').upsert({ session_id: sess.data.id, user_id: b.id, reaction: 'im_in' }, { onConflict: 'session_id,user_id' })
  check('reaction upsert', !re.error, re.error?.message)
  const ar = await a.sb.from('sup_reactions').select('*, user:users(id, username)').in('session_id', [sess.data.id])
  check('Sup owner sees the reaction', !ar.error && ar.data?.length === 1, ar.error?.message)

  // Duration preference (Profile page)
  const dur = await a.sb.from('users').update({ sup_duration: 30 }).eq('id', a.id)
  check('sup_duration update', !dur.error, dur.error?.message)

  // Push: B registers a well-formed but fake subscription, A broadcasts to non-Sup'd squad
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const p256dh = Buffer.from(await webcrypto.subtle.exportKey('raw', kp.publicKey)).toString('base64url')
  const auth = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('base64url')
  const fakeSub = { endpoint: `https://fcm.googleapis.com/fcm/send/sup-smoke-${TAG}`, keys: { p256dh, auth } }
  const ps = await b.sb.from('push_subscriptions').upsert({ user_id: b.id, subscription: fakeSub }, { onConflict: 'user_id,subscription' })
  check('push subscription upsert', !ps.error, ps.error?.message)

  const push = await a.sb.functions.invoke('sup-send-push', { body: { userId: a.id } })
  const pushBody = push.data
  check('sup-send-push runs (VAPID secrets + sup schema)', !push.error && pushBody && !pushBody.error, push.error?.message || JSON.stringify(pushBody))
  await sleep(1000)
  const notes = await b.sb.from('notifications').select('*, from_user:users!notifications_from_user_id_fkey(username)').eq('user_id', b.id)
  check('notification logged and readable by recipient', !notes.error && notes.data?.length === 1 && notes.data[0].from_user?.username === a.username, notes.error?.message)
  const cn = await c.sb.from('notifications').select('id')
  check('other users cannot read it', !cn.error && cn.data?.length === 0, cn.error?.message)

  // Places proxy
  const pl = await a.sb.functions.invoke('sup-nearby-places', { body: { lat: 40.7359, lng: -73.9937, radius: 1500, placeType: 'bar' } })
  const n = Array.isArray(pl.data) ? pl.data.length : 0
  check('sup-nearby-places returns real bars', !pl.error && n > 0, pl.error?.message || `${n} results${n ? `, e.g. ${pl.data[0].name}` : `: ${JSON.stringify(pl.data).slice(0, 160)}`}`)

  for (let i = 0; i < 40 && !realtimeHit; i++) await sleep(250)
  check('realtime delivered the new Sup to the friend', realtimeHit)
  await b.sb.removeChannel(channel)
} catch (err) {
  check('smoke test ran to completion', false, err.message)
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nALL CHECKS PASSED')
process.exit(failures ? 1 : 0)
