// JE-02 — Persistance via le chemin PATCH /api/notes/:id (celui que le hook
// useNoteAutosave déclenche, debounce 2 s côté UI). On tape un nouveau contenu,
// on lit l'état avant/après en base et on vérifie que contentText a été réextrait.
import { setupSharedNote, getNote, doc, API, writeReport } from './lib.mjs'

const NEW_TEXT = 'texte persistant reecrit via autosave PATCH JE-02'

async function main() {
  const { a, note } = await setupSharedNote({ seedText: 'contenu initial JE-02' })
  const before = await getNote(a.accessToken, note.id)

  // PATCH explicite pour capter le code HTTP exact renvoyé par l'autosave.
  const res = await fetch(`${API}/api/notes/${note.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.accessToken}` },
    body: JSON.stringify({ content: doc(NEW_TEXT) }),
  })
  const patchBody = await res.json()

  const after = await getNote(a.accessToken, note.id)

  const report = {
    scenario: 'JE-02',
    api: API,
    noteId: note.id,
    patchHttpStatus: res.status,
    patchResponseUpdatedAt: patchBody?.updatedAt ?? null,
    before: { contentText: before.contentText, updatedAt: before.updatedAt },
    after: { contentText: after.contentText, updatedAt: after.updatedAt },
    contentTextReextracted: after.contentText === NEW_TEXT,
    updatedAtAdvanced: new Date(after.updatedAt).getTime() > new Date(before.updatedAt).getTime(),
    measuredAt: new Date().toISOString(),
  }
  const path = writeReport('je-02', report)
  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[JE-02] note.id = ${note.id}`)
  console.log(`[JE-02] report -> ${path}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('JE-02 FAIL:', e?.message, e?.body ?? '')
  process.exit(1)
})
