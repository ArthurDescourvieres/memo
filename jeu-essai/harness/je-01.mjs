// JE-01 — Propagation note:live nominale + preuve de non-persistance.
// A (OWNER) et B (EDITOR) sur la même note. A pousse des deltas note:live ;
// B les reçoit ; on mesure la latence émission→réception (perf.now, même
// process = horloge commune) ; on prouve qu'AUCUNE écriture n'a eu lieu en base
// (updatedAt + contentText inchangés avant/après la salve).
import { performance } from 'node:perf_hooks'
import { setupSharedNote, getNote, connect, emitAck, sleep, writeReport } from './lib.mjs'

const N = 20
const INTERVAL_MS = 50

function stats(xs) {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
  return {
    samples: s.length,
    minMs: +s[0].toFixed(3),
    medianMs: +q(50).toFixed(3),
    p95Ms: +q(95).toFixed(3),
    maxMs: +s[s.length - 1].toFixed(3),
    meanMs: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3),
  }
}

async function main() {
  const { a, b, note } = await setupSharedNote({
    memberRole: 'EDITOR',
    seedText: 'contenu initial',
  })
  const before = await getNote(a.accessToken, note.id)

  const sa = await connect(a.accessToken)
  const sb = await connect(b.accessToken)

  const t0 = new Map()
  const received = []
  sb.on('note:live', (msg) => {
    const seq = msg?.content?.seq
    if (typeof seq === 'number' && t0.has(seq)) {
      received.push({
        seq,
        latencyMs: performance.now() - t0.get(seq),
        text: msg?.content?.content?.[0]?.content?.[0]?.text,
      })
    }
  })

  const joinA = await emitAck(sa, 'note:join', { noteId: note.id })
  const joinB = await emitAck(sb, 'note:join', { noteId: note.id })
  await sleep(150) // laisse la présence se propager

  for (let seq = 0; seq < N; seq++) {
    t0.set(seq, performance.now())
    sa.emit('note:live', {
      noteId: note.id,
      content: {
        type: 'doc',
        seq,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: `delta frappe #${seq}` }] }],
      },
    })
    await sleep(INTERVAL_MS)
  }
  await sleep(300) // drain

  const after = await getNote(a.accessToken, note.id)

  sa.close()
  sb.close()

  const report = {
    scenario: 'JE-01',
    api: process.env.JE_API ?? 'http://localhost:3100',
    noteId: note.id,
    emitted: N,
    receivedByB: received.length,
    latency: stats(received.map((r) => r.latencyMs)),
    lastDeltaTextReceived: received.at(-1)?.text ?? null,
    joinAAck: joinA,
    joinBAck: joinB,
    persistence: {
      contentTextBefore: before.contentText,
      contentTextAfter: after.contentText,
      updatedAtBefore: before.updatedAt,
      updatedAtAfter: after.updatedAt,
      unchanged: before.contentText === after.contentText && before.updatedAt === after.updatedAt,
    },
    measuredAt: new Date().toISOString(),
  }
  const path = writeReport('je-01', report)
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[JE-01] report -> ${path}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('JE-01 FAIL:', e?.message, e?.body ?? '')
  process.exit(1)
})
