// JE-04 — Handshake sans JWT / token invalide → connexion rejetée au handshake.
// Le middleware io.use rejette avec Error('UNAUTHENTICATED') ; le client reçoit
// alors connect_error et ne se connecte jamais.
import { connect, writeReport } from './lib.mjs'

/** JWT-shaped token with invalid signature (runtime-built to avoid gitleaks false positives). */
function fakeMalformedJwt() {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'hacker' })}.zzzzINVALIDSIGzzzz`
}

async function attempt(label, token) {
  try {
    const s = await connect(token, { timeoutMs: 4000 })
    s.close()
    return { label, connected: true, error: null }
  } catch (e) {
    return { label, connected: false, error: e?.message ?? String(e) }
  }
}

async function main() {
  const noToken = await attempt('sans token (handshake.auth vide)', undefined)
  const badToken = await attempt('token invalide ("not-a-jwt")', 'not-a-jwt')
  const malformed = await attempt('token JWT bidon signé inconnu', fakeMalformedJwt())

  const report = {
    scenario: 'JE-04',
    api: process.env.JE_API ?? 'http://localhost:3100',
    attempts: [noToken, badToken, malformed],
    allRejected: [noToken, badToken, malformed].every((a) => a.connected === false),
    measuredAt: new Date().toISOString(),
  }
  const path = writeReport('je-04', report)
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[JE-04] report -> ${path}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('JE-04 FAIL:', e?.message, e?.body ?? '')
  process.exit(1)
})
