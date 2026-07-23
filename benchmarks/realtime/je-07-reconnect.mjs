// JE-07 — reconnexion : réabonnement + resynchronisation du contenu.
//
// Scénario du jeu d'essai « édition collaborative temps réel ». Deux utilisateurs
// distincts sur la même note : A (OWNER, créateur) et B (EDITOR, ajouté au
// workspace). B se déconnecte brutalement pendant que A continue de persister des
// `note:update`, puis se reconnecte. On prouve que :
//   1. avant coupure, B reçoit bien les événements de A (il est abonné) ;
//   2. pendant la coupure, B ne reçoit RIEN (socket serveur détruit, hors room) ;
//   3. à la reconnexion, B rejoue `note:join` et est ré-abonné ;
//   4. B resynchronise le dernier contenu via GET /api/notes/:id (la durabilité
//      passe par HTTP, PAS par le socket — `note:join` ne renvoie que la présence) ;
//   5. après reconnexion, B reçoit de nouveau les `note:live` de A.
//
// On exerce exactement la même pile que l'app : handshake JWT, canAccessNote au
// join, garde EDITOR sur note:update/live, LWW en base. Rien n'est simulé côté
// serveur ; le harness ne fait que piloter deux vrais clients socket.io + fetch.
//
// Pré-requis : stack démarrée + `npm install` dans benchmarks/.
// Lancement :
//   node benchmarks/realtime/je-07-reconnect.mjs
//   BASE_URL=http://localhost:3000 node benchmarks/realtime/je-07-reconnect.mjs
import { io } from 'socket.io-client'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const UPDATES = Number(process.env.UPDATES || 5) // note:update persistés pendant la coupure
const GAP_MS = Number(process.env.GAP_MS || 400) // espacement des écritures (durée de coupure ≈ UPDATES×GAP)
const PASS = 'a-strong-passphrase-123'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const doc = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

async function api(path, { token, method = 'POST', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

function connect(token) {
  return io(BASE, { auth: { token }, transports: ['websocket'], forceNew: true })
}
const joinRoom = (socket, noteId) =>
  new Promise((resolve) => socket.emit('note:join', { noteId }, (ack) => resolve(ack)))
const onceConnect = (socket) => new Promise((resolve) => socket.once('connect', resolve))

async function main() {
  const stamp = Date.now()
  console.log(`JE-07 — reconnexion, cible ${BASE}`)

  // 1. Deux comptes distincts.
  const a = await api('/api/auth/register', {
    body: { name: `je07a-${stamp}`, email: `je07a-${stamp}@essai.local`, password: PASS },
  })
  const b = await api('/api/auth/register', {
    body: { name: `je07b-${stamp}`, email: `je07b-${stamp}@essai.local`, password: PASS },
  })

  // 2. A crée le workspace/dossier/note, puis ajoute B comme EDITOR.
  const ws = await api('/api/workspaces', { token: a.accessToken, body: { name: `JE07 ${stamp}` } })
  const folder = await api(`/api/workspaces/${ws.id}/folders`, {
    token: a.accessToken,
    body: { name: 'JE07' },
  })
  const note = await api(`/api/workspaces/${ws.id}/folders/${folder.id}/notes`, {
    token: a.accessToken,
    body: { title: 'reconnect', content: doc('seed'), folderId: folder.id },
  })
  await api(`/api/workspaces/${ws.id}/members`, {
    token: a.accessToken,
    body: { userId: b.user.id, role: 'EDITOR' },
  })
  console.log(`Note ${note.id} prête. A=OWNER(${a.user.id}) B=EDITOR(${b.user.id}).`)

  // 3. Connexions + join. B compte tout ce qu'il reçoit (live + update).
  const socketA = connect(a.accessToken)
  const socketB = connect(b.accessToken)
  let bReceived = 0
  let lastLive = null
  socketB.on('note:live', (m) => {
    bReceived++
    lastLive = m?.content?.content?.[0]?.content?.[0]?.text ?? null
  })
  socketB.on('note:update', () => {
    bReceived++
  })
  await Promise.all([onceConnect(socketA), onceConnect(socketB)])
  const joinA = await joinRoom(socketA, note.id)
  const joinB = await joinRoom(socketB, note.id)

  // 4. Baseline : A pousse un note:live, B doit le recevoir (preuve d'abonnement).
  socketA.emit('note:live', { noteId: note.id, content: doc('live-before') })
  await sleep(500)
  const liveBeforeText = lastLive // figé ici : lastLive sera écrasé par le live post-reconnexion
  const liveBeforeReceived = bReceived >= 1 && liveBeforeText === 'live-before'

  // 5. B se déconnecte brutalement.
  socketB.disconnect()
  await sleep(500) // laisse le serveur traiter `disconnecting` (sortie de room)
  const countAtDisconnect = bReceived
  const bDisconnected = socketB.connected === false

  // 6. Pendant la coupure, A persiste des note:update (+ un live perdu).
  let lastMarker = ''
  let lastUpdatedAt = null
  for (let i = 1; i <= UPDATES; i++) {
    lastMarker = `A-update-${i}`
    const ack = await new Promise((resolve) =>
      socketA.emit('note:update', { noteId: note.id, content: doc(lastMarker) }, resolve),
    )
    if (!ack?.ok) throw new Error(`note:update ${i} refusé: ${JSON.stringify(ack)}`)
    lastUpdatedAt = ack.updatedAt
    await sleep(GAP_MS)
  }
  socketA.emit('note:live', { noteId: note.id, content: doc('live-during') }) // doit être perdu pour B
  await sleep(300)
  const receivedDuringDowntime = bReceived - countAtDisconnect

  // 7. B se reconnecte et rejoue note:join (ré-abonnement).
  socketB.connect()
  await onceConnect(socketB)
  const rejoin = await joinRoom(socketB, note.id)

  // 8. Resynchronisation du contenu : via HTTP GET (durabilité), pas via le socket.
  const fresh = await api(`/api/notes/${note.id}`, { token: b.accessToken, method: 'GET' })
  const resyncText = fresh?.contentText ?? ''
  const resyncMatchesLast = resyncText.includes(lastMarker)

  // 9. Après reconnexion, A pousse un nouveau live : B doit le recevoir de nouveau.
  const countBeforeAfterLive = bReceived
  socketA.emit('note:live', { noteId: note.id, content: doc('live-after') })
  await sleep(500)
  const liveAfterText = lastLive
  const liveAfterReceived = bReceived > countBeforeAfterLive && liveAfterText === 'live-after'

  socketA.close()
  socketB.close()

  const checks = [
    { name: 'A et B rejoignent la room', pass: joinA?.ok === true && joinB?.ok === true, detail: `A=${joinA?.ok} B=${joinB?.ok}` },
    { name: 'B reçoit le live de A avant coupure', pass: liveBeforeReceived, detail: `reçu=${liveBeforeText}` },
    { name: 'B est bien déconnecté pendant la coupure', pass: bDisconnected, detail: `connected=${socketB.connected}` },
    { name: 'B ne reçoit RIEN pendant la coupure', pass: receivedDuringDowntime === 0, detail: `deltas=${receivedDuringDowntime} (dont 1 live + ${UPDATES} update émis par A)` },
    { name: 'B rejoue note:join à la reconnexion', pass: rejoin?.ok === true, detail: `ack=${JSON.stringify(rejoin)}` },
    { name: 'B resynchronise le dernier contenu persisté (GET HTTP)', pass: resyncMatchesLast, detail: `contentText="${resyncText}" attendu⊇"${lastMarker}"` },
    { name: 'B reçoit de nouveau les live après reconnexion', pass: liveAfterReceived, detail: `reçu=${liveAfterText}` },
  ]
  const ok = checks.every((c) => c.pass)

  const report = {
    scenario: 'JE-07',
    title: 'Reconnexion — réabonnement et resynchronisation',
    base: BASE,
    roles: { A: 'OWNER (créateur)', B: 'EDITOR (ajouté au workspace)' },
    resyncMechanism: 'http-get', // note:join ne renvoie que la présence ; le contenu revient par GET /api/notes/:id
    params: { updatesDuringDowntime: UPDATES, gapMs: GAP_MS, downtimeMsApprox: UPDATES * GAP_MS },
    lastPersistedMarker: lastMarker,
    lastPersistedUpdatedAt: lastUpdatedAt,
    resyncContentText: resyncText,
    checks,
    ok,
    measuredAt: new Date().toISOString(),
  }

  console.log(JSON.stringify(report, null, 2))
  for (const c of checks) console.log(`  ${c.pass ? '✓' : '✗'} ${c.name} — ${c.detail}`)
  console.log(ok ? '\nJE-07 : CONFORME' : '\nJE-07 : ÉCHEC')

  mkdirSync(new URL('../reports/', import.meta.url), { recursive: true })
  const out = new URL(`../reports/je-07-reconnect-${stamp}.json`, import.meta.url)
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`Rapport écrit dans ${out.pathname}`)
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
