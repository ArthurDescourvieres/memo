import { afterEach, describe, expect, it } from 'vitest'
import { clearLastLocation, readLastLocation, writeLastLocation } from './lastLocation'

afterEach(() => {
  window.localStorage.clear()
})

describe('lastLocation', () => {
  it('écrit puis relit la position d’un utilisateur', () => {
    writeLastLocation('u1', { workspaceId: 'w1', folderId: 'f1', noteId: 'n1' })
    expect(readLastLocation('u1')).toEqual({ workspaceId: 'w1', folderId: 'f1', noteId: 'n1' })
  })

  it('cloisonne le stockage par utilisateur', () => {
    writeLastLocation('u1', { workspaceId: 'w1', folderId: null, noteId: null })
    expect(readLastLocation('u2')).toBeNull()
  })

  it('ignore une entrée sans workspace (rien à restaurer)', () => {
    writeLastLocation('u1', { workspaceId: null, folderId: null, noteId: 'n1' })
    expect(readLastLocation('u1')).toBeNull()
  })

  it('ignore une entrée corrompue au lieu de lever', () => {
    window.localStorage.setItem('memo:last-location:u1', '{pas du json')
    expect(readLastLocation('u1')).toBeNull()
  })

  it('normalise les champs non conformes en null', () => {
    window.localStorage.setItem(
      'memo:last-location:u1',
      JSON.stringify({ workspaceId: 'w1', folderId: 42, noteId: '' }),
    )
    expect(readLastLocation('u1')).toEqual({ workspaceId: 'w1', folderId: null, noteId: null })
  })

  it('efface la position mémorisée', () => {
    writeLastLocation('u1', { workspaceId: 'w1', folderId: 'f1', noteId: 'n1' })
    clearLastLocation('u1')
    expect(readLastLocation('u1')).toBeNull()
  })

  it('ne fait rien sans utilisateur', () => {
    writeLastLocation(null, { workspaceId: 'w1', folderId: null, noteId: null })
    expect(readLastLocation(null)).toBeNull()
    expect(window.localStorage.length).toBe(0)
  })
})
