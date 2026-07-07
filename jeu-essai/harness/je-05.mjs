// JE-05 — Un utilisateur authentifié mais NON membre du workspace tente de
// rejoindre note:<id> → refusé par canAccessNote (ack FORBIDDEN), et n'est
// pas abonné à la room (ne reçoit aucun delta émis ensuite).
import { setupSharedNote, connect, emitAck, sleep, writeReport } from './lib.mjs'

const liveDoc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

async function main() {
  // memberRole: null → B est enregistré (token valide) mais PAS membre du workspace.
  const { a, note } = await setupSharedNote({ memberRole: null, seedText: 'contenu initial JE-05' })
  const stranger = (await setupSharedNote({ memberRole: null })).b // autre user, non-membre garanti

  const sa = await connect(a.accessToken) // OWNER légitime
  const sx = await connect(stranger.accessToken) // token valide, non-membre de CE workspace

  let strangerReceived = 0
  sx.on('note:live', () => { strangerReceived += 1 })

  await emitAck(sa, 'note:join', { noteId: note.id })
  const strangerJoin = await emitAck(sx, 'note:join', { noteId: note.id })

  await sleep(150)
  // A émet un delta : le non-membre (join refusé) ne doit rien recevoir.
  sa.emit('note:live', { noteId: note.id, content: liveDoc('delta reserve aux membres') })
  await sleep(400)

  sa.close()
  sx.close()

  const report = {
    scenario: 'JE-05',
    api: process.env.JE_API ?? 'http://localhost:3100',
    noteId: note.id,
    strangerJoinAck: strangerJoin,
    strangerReceivedLiveAfterRefusedJoin: strangerReceived,
    conform: strangerJoin?.ok === false && strangerJoin?.error === 'FORBIDDEN' && strangerReceived === 0,
    measuredAt: new Date().toISOString(),
  }
  const path = writeReport('je-05', report)
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[JE-05] report -> ${path}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('JE-05 FAIL:', e?.message, e?.body ?? '')
  process.exit(1)
})
