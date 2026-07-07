// Helpers communs aux harnais du jeu d'essai temps réel.
// socket.io-client est importé depuis le node_modules du frontend (même version
// 4.8.x que le front) via un chemin relatif — pas de dépendance à installer.
import { io } from '../../frontend/node_modules/socket.io-client/build/esm/index.js'
import { writeFileSync } from 'node:fs'

export const API = process.env.JE_API ?? 'http://localhost:3100'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function http(path, opts = {}) {
  const res = await fetch(API + path, opts)
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) {
    const err = new Error(`${opts.method ?? 'GET'} ${path} -> ${res.status}`)
    err.status = res.status
    err.body = json
    throw err
  }
  return json
}

export function authed(token, path, opts = {}) {
  return http(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  })
}

let counter = 0
function uniqueEmail(tag) {
  counter += 1
  return `je-${tag}-${process.pid}-${counter}@test.local`
}

export async function register(tag) {
  return http('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `JE ${tag} ${process.pid}-${counter}`,
      email: uniqueEmail(tag),
      password: 'password-je-essai-123',
    }),
  })
}

const doc = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

/**
 * Monte une note partagée : A (OWNER du workspace) + éventuellement B avec le
 * rôle demandé, plus une note ensemencée. Renvoie tokens, ids et l'état initial.
 * `memberRole` = null → B n'est PAS ajouté au workspace (cas non-membre, JE-05).
 */
export async function setupSharedNote({
  memberRole = 'EDITOR',
  seedText = 'contenu initial',
} = {}) {
  const a = await register('a')
  const b = await register('b')

  const ws = await authed(a.accessToken, '/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `WS ${process.pid}-${counter}` }),
  })
  if (memberRole) {
    await authed(a.accessToken, `/api/workspaces/${ws.id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId: b.user.id, role: memberRole }),
    })
  }
  const folder = await authed(a.accessToken, `/api/workspaces/${ws.id}/folders`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Dossier' }),
  })
  const note = await authed(a.accessToken, `/api/workspaces/${ws.id}/folders/${folder.id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Note partagée', folderId: folder.id, content: doc(seedText) }),
  })
  return { a, b, ws, folder, note }
}

export function getNote(token, noteId) {
  return authed(token, `/api/notes/${noteId}`)
}

export function patchNote(token, noteId, body) {
  return authed(token, `/api/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

/** Connexion socket.io ; résout au `connect`, rejette au `connect_error`. */
export function connect(token, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(API, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('CONNECT_TIMEOUT'))
    }, timeoutMs)
    socket.on('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.on('connect_error', (err) => {
      clearTimeout(timer)
      socket.close()
      reject(err)
    })
  })
}

/** emit avec accusé de réception (callback ack). */
export function emitAck(socket, event, payload, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ACK_TIMEOUT ${event}`)), timeoutMs)
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer)
      resolve(ack)
    })
  })
}

export { doc }

export function writeReport(name, report) {
  const out = new URL(`../logs/${name}.json`, import.meta.url)
  writeFileSync(out, JSON.stringify(report, null, 2))
  return out.pathname
}
