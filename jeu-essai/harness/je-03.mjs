// JE-03 — Un VIEWER peut rejoindre/lire mais pas émettre.
// B est VIEWER. On vérifie :
//  1) B peut rejoindre la room (note:join ack ok) et REÇOIT les note:live d'un EDITOR ;
//  2) note:update de B est refusé (ack FORBIDDEN), aucune écriture en base ;
//  3) note:live de B n'est PAS rebroadcasté (A ne le reçoit pas).
import { setupSharedNote, getNote, connect, emitAck, sleep, writeReport } from './lib.mjs'

const liveDoc = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

async function main() {
  const { a, b, note } = await setupSharedNote({
    memberRole: 'VIEWER',
    seedText: 'contenu initial JE-03',
  })
  const before = await getNote(a.accessToken, note.id)

  const sa = await connect(a.accessToken) // OWNER (peut émettre)
  const sb = await connect(b.accessToken) // VIEWER

  let aReceivedLive = 0
  let bReceivedLive = 0
  let bLastText = null
  sa.on('note:live', () => {
    aReceivedLive += 1
  })
  sb.on('note:live', (m) => {
    bReceivedLive += 1
    bLastText = m?.content?.content?.[0]?.content?.[0]?.text ?? null
  })

  const joinA = await emitAck(sa, 'note:join', { noteId: note.id })
  const joinB = await emitAck(sb, 'note:join', { noteId: note.id })
  await sleep(150)

  // (1) Lecture : A (OWNER) émet, B (VIEWER) doit recevoir.
  sa.emit('note:live', { noteId: note.id, content: liveDoc('delta emis par A owner') })
  await sleep(300)

  // (3) B (VIEWER) tente d'émettre note:live → ne doit PAS être rebroadcasté à A.
  const aBefore = aReceivedLive
  sb.emit('note:live', { noteId: note.id, content: liveDoc('delta interdit du viewer') })
  await sleep(300)
  const viewerLiveBroadcast = aReceivedLive > aBefore

  // (2) B (VIEWER) tente note:update (persistant) → ack FORBIDDEN attendu.
  const updateAck = await emitAck(sb, 'note:update', {
    noteId: note.id,
    content: liveDoc('ecriture interdite du viewer'),
  })

  await sleep(150)
  const after = await getNote(a.accessToken, note.id)

  sa.close()
  sb.close()

  const report = {
    scenario: 'JE-03',
    api: process.env.JE_API ?? 'http://localhost:3100',
    noteId: note.id,
    viewerJoinAck: joinB,
    ownerJoinAck: joinA,
    viewerReceivedOwnerLive: bReceivedLive,
    viewerLastTextReceived: bLastText,
    viewerUpdateAck: updateAck,
    viewerLiveRebroadcastToOwner: viewerLiveBroadcast,
    persistence: {
      contentTextBefore: before.contentText,
      contentTextAfter: after.contentText,
      updatedAtBefore: before.updatedAt,
      updatedAtAfter: after.updatedAt,
      unchanged: before.contentText === after.contentText && before.updatedAt === after.updatedAt,
    },
    measuredAt: new Date().toISOString(),
  }
  const path = writeReport('je-03', report)
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[JE-03] note.id = ${note.id}`)
  console.log(`[JE-03] report -> ${path}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('JE-03 FAIL:', e?.message, e?.body ?? '')
  process.exit(1)
})
