// JE-06 — Édition simultanée. Deux EDITOR (A OWNER, B EDITOR) émettent
// note:update EN MÊME TEMPS (Promise.all, même tick) avec des contenus
// distincts. On vérifie l'absence de corruption : l'état final en base est
// EXACTEMENT l'un des deux contenus (last-writer-wins), jamais un mélange.
import { setupSharedNote, getNote, connect, emitAck, sleep, doc, writeReport } from './lib.mjs'

const ROUNDS = 5

async function main() {
  const { a, b, note } = await setupSharedNote({ memberRole: 'EDITOR', seedText: 'contenu initial JE-06' })
  const sa = await connect(a.accessToken)
  const sb = await connect(b.accessToken)
  await emitAck(sa, 'note:join', { noteId: note.id })
  await emitAck(sb, 'note:join', { noteId: note.id })
  await sleep(150)

  const rounds = []
  for (let k = 0; k < ROUNDS; k++) {
    const textA = `AAAAA-writerA-round${k}-AAAAA`
    const textB = `BBBBB-writerB-round${k}-BBBBB`
    // Émission concurrente, sans await entre les deux → vraie course serveur.
    const [ackA, ackB] = await Promise.all([
      emitAck(sa, 'note:update', { noteId: note.id, content: doc(textA) }),
      emitAck(sb, 'note:update', { noteId: note.id, content: doc(textB) }),
    ])
    await sleep(120)
    const after = await getNote(a.accessToken, note.id)
    const winner = after.contentText === textA ? 'A' : after.contentText === textB ? 'B' : 'CORRUPT/MIX'
    rounds.push({
      round: k,
      ackA,
      ackB,
      finalContentText: after.contentText,
      finalUpdatedAt: after.updatedAt,
      winner,
      coherent: after.contentText === textA || after.contentText === textB,
    })
  }

  const final = await getNote(a.accessToken, note.id)
  sa.close()
  sb.close()

  const report = {
    scenario: 'JE-06',
    api: process.env.JE_API ?? 'http://localhost:3100',
    noteId: note.id,
    rounds,
    allCoherent: rounds.every((r) => r.coherent),
    anyCorruption: rounds.some((r) => r.winner === 'CORRUPT/MIX'),
    finalContentText: final.contentText,
    measuredAt: new Date().toISOString(),
  }
  const path = writeReport('je-06', report)
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[JE-06] note.id = ${note.id}`)
  console.log(`[JE-06] report -> ${path}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('JE-06 FAIL:', e?.message, e?.body ?? '')
  process.exit(1)
})
