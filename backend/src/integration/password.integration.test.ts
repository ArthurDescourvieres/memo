import { describe, it, expect, vi, beforeEach } from 'vitest'

// L'inscription et le changement de mot de passe appellent la vraie API HIBP :
// on la neutralise pour que la suite reste déterministe et hors-ligne (sa
// logique k-anonymity a son propre test unitaire).
vi.mock('../lib/hibp.js', () => ({ isPasswordPwned: vi.fn(async () => false) }))

// Le mailer est remplacé par un espion : c'est le seul moyen d'obtenir le jeton
// de réinitialisation, qui n'apparaît jamais dans une réponse HTTP.
const mailer = vi.hoisted(() => ({ resets: [] as { to: string; token: string }[] }))
vi.mock('../lib/mailer.js', () => ({
  sendInvitationEmail: async () => true,
  sendPasswordResetEmail: async (input: { to: string; token: string }) => {
    mailer.resets.push(input)
    return true
  },
  inviteLink: (token: string) => token,
  resetLink: (token: string) => token,
}))

import { app } from '../app.js'
import { prisma } from '../lib/prisma.js'

const PASSWORD = 'initial-strong-passphrase'
const NEW_PASSWORD = 'brand-new-strong-passphrase'

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function patch(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function refreshCookie(res: Response): string {
  const list =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : ([res.headers.get('set-cookie')].filter(Boolean) as string[])
  const cookie = list.find((c) => c.startsWith('refreshToken='))
  return cookie ? cookie.split(';')[0]! : ''
}

/** Inscrit un compte et renvoie ses jetons de session. */
async function register(email = 'ada@example.com', name = 'Ada') {
  const res = await post('/api/auth/register', { name, email, password: PASSWORD })
  expect(res.status).toBe(201)
  const body = (await res.json()) as { accessToken: string }
  return { accessToken: body.accessToken, cookie: refreshCookie(res), email }
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

beforeEach(() => {
  mailer.resets.length = 0
})

describe('changement de mot de passe (compte connecté)', () => {
  it('remplace le mot de passe : l’ancien ne fonctionne plus, le nouveau oui', async () => {
    const { accessToken, cookie, email } = await register()

    const res = await patch(
      '/api/auth/password',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      { ...bearer(accessToken), cookie },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { accessToken: string }
    expect(body.accessToken).toBeTruthy()

    const withOld = await post('/api/auth/login', { identifier: email, password: PASSWORD })
    expect(withOld.status).toBe(401)

    const withNew = await post('/api/auth/login', { identifier: email, password: NEW_PASSWORD })
    expect(withNew.status).toBe(200)
  })

  it('refuse un mot de passe actuel erroné — 403, mot de passe inchangé', async () => {
    const { accessToken, cookie, email } = await register()

    const res = await patch(
      '/api/auth/password',
      { currentPassword: 'wrong-current-password', newPassword: NEW_PASSWORD },
      { ...bearer(accessToken), cookie },
    )
    expect(res.status).toBe(403)

    const login = await post('/api/auth/login', { identifier: email, password: PASSWORD })
    expect(login.status).toBe(200)
  })

  it('déconnecte les autres sessions mais garde la session courante ouverte', async () => {
    const { accessToken, cookie, email } = await register()

    // Seconde session (autre appareil), ouverte avant le changement.
    const other = await post('/api/auth/login', { identifier: email, password: PASSWORD })
    const otherCookie = refreshCookie(other)

    const res = await patch(
      '/api/auth/password',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      { ...bearer(accessToken), cookie },
    )
    expect(res.status).toBe(200)

    // L'autre appareil ne peut plus rafraîchir : tokenVersion a été incrémenté.
    const otherRefresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: otherCookie },
    })
    expect(otherRefresh.status).toBe(401)

    // La session qui a fait la demande a reçu un cookie neuf, toujours valide.
    const stillValid = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookie(res) },
    })
    expect(stillValid.status).toBe(200)
  })

  it('exige une authentification — 401 sans jeton', async () => {
    const res = await patch('/api/auth/password', {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    })
    expect(res.status).toBe(401)
  })

  it('refuse un nouveau mot de passe trop court — 400', async () => {
    const { accessToken, cookie } = await register()
    const res = await patch(
      '/api/auth/password',
      { currentPassword: PASSWORD, newPassword: 'too-short' },
      { ...bearer(accessToken), cookie },
    )
    expect(res.status).toBe(400)
  })
})

describe('mot de passe oublié — demande du lien', () => {
  it('répond à l’identique pour une adresse connue et une adresse inconnue', async () => {
    await register()

    const known = await post('/api/auth/forgot-password', { email: 'ada@example.com' })
    const unknown = await post('/api/auth/forgot-password', { email: 'nobody@example.com' })

    expect(known.status).toBe(202)
    expect(unknown.status).toBe(202)
    expect(await known.json()).toEqual(await unknown.json())

    // Un seul e-mail est réellement parti : celui du compte existant.
    expect(mailer.resets).toHaveLength(1)
    expect(mailer.resets[0]!.to).toBe('ada@example.com')
  })

  it('n’envoie rien pour un compte désactivé (suppression RGPD en cours)', async () => {
    await register()
    await prisma.user.update({
      where: { email: 'ada@example.com' },
      data: { deactivatedAt: new Date() },
    })

    const res = await post('/api/auth/forgot-password', { email: 'ada@example.com' })
    expect(res.status).toBe(202)
    expect(mailer.resets).toHaveLength(0)
  })

  it('plafonne les envois à 3 par heure et par compte', async () => {
    await register()

    for (let i = 0; i < 5; i++) {
      const res = await post(
        '/api/auth/forgot-password',
        { email: 'ada@example.com' },
        { 'x-forwarded-for': `198.51.100.${i}` }, // contourne le rate limit par IP
      )
      expect(res.status).toBe(202)
    }

    expect(mailer.resets).toHaveLength(3)
  })

  it('limite les demandes à 5 par heure et par IP — la 6e est 429', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await post(
        '/api/auth/forgot-password',
        { email: 'nobody@example.com' },
        { 'x-forwarded-for': '203.0.113.42' },
      )
      statuses.push(res.status)
    }

    expect(statuses.slice(0, 5).every((s) => s === 202)).toBe(true)
    expect(statuses[5]).toBe(429)
  })
})

describe('mot de passe oublié — réinitialisation', () => {
  /** Déclenche la demande et renvoie le jeton capturé côté mailer. */
  async function requestToken(email = 'ada@example.com') {
    const res = await post('/api/auth/forgot-password', { email })
    expect(res.status).toBe(202)
    const token = mailer.resets.at(-1)?.token
    expect(token).toBeTruthy()
    return token!
  }

  it('applique le nouveau mot de passe et permet de se reconnecter', async () => {
    const { email } = await register()
    const token = await requestToken()

    const res = await post('/api/auth/reset-password', { token, password: NEW_PASSWORD })
    expect(res.status).toBe(200)

    const withOld = await post('/api/auth/login', { identifier: email, password: PASSWORD })
    expect(withOld.status).toBe(401)

    const withNew = await post('/api/auth/login', { identifier: email, password: NEW_PASSWORD })
    expect(withNew.status).toBe(200)
  })

  it('invalide toutes les sessions ouvertes', async () => {
    const { cookie } = await register()
    const token = await requestToken()

    await post('/api/auth/reset-password', { token, password: NEW_PASSWORD })

    const refresh = await app.request('/api/auth/refresh', { method: 'POST', headers: { cookie } })
    expect(refresh.status).toBe(401)
  })

  it('n’accepte le jeton qu’une seule fois', async () => {
    await register()
    const token = await requestToken()

    const first = await post('/api/auth/reset-password', { token, password: NEW_PASSWORD })
    expect(first.status).toBe(200)

    const second = await post('/api/auth/reset-password', {
      token,
      password: 'yet-another-strong-passphrase',
    })
    expect(second.status).toBe(400)
  })

  it('refuse un jeton inconnu ou falsifié — 400', async () => {
    await register()
    const res = await post('/api/auth/reset-password', {
      token: 'not-a-real-token',
      password: NEW_PASSWORD,
    })
    expect(res.status).toBe(400)
  })

  it('périme le lien précédent quand un nouveau est demandé', async () => {
    await register()
    const first = await requestToken()
    const second = await requestToken()
    expect(second).not.toBe(first)

    const withFirst = await post('/api/auth/reset-password', {
      token: first,
      password: NEW_PASSWORD,
    })
    expect(withFirst.status).toBe(400)

    const withSecond = await post('/api/auth/reset-password', {
      token: second,
      password: NEW_PASSWORD,
    })
    expect(withSecond.status).toBe(200)
  })

  it('rejette un mot de passe trop court sans consommer le jeton', async () => {
    await register()
    const token = await requestToken()

    const tooShort = await post('/api/auth/reset-password', { token, password: 'short' })
    expect(tooShort.status).toBe(400)

    // Le lien reste utilisable : une saisie refusée ne doit pas le brûler.
    const retry = await post('/api/auth/reset-password', { token, password: NEW_PASSWORD })
    expect(retry.status).toBe(200)
  })
})
