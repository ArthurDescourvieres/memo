import { describe, expect, it } from 'vitest'
import { canDropOn } from './moveTarget'
import type { Folder } from '../../lib/types'
import type { DragItem } from './dragItem'

const f = (id: string, parentId: string | null): Folder => ({
  id,
  name: id,
  workspaceId: 'w',
  parentId,
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
})

// a ─ b ─ d
// c
const folders = [f('a', null), f('b', 'a'), f('d', 'b'), f('c', null)]

const folder = (id: string, parentId: string | null): DragItem => ({
  kind: 'folder',
  id,
  name: id,
  parentId,
})
const note = (id: string, parentId: string): DragItem => ({ kind: 'note', id, name: id, parentId })

describe('canDropOn — note', () => {
  it('accepte un autre dossier', () => {
    expect(canDropOn(note('n', 'a'), { kind: 'folder', id: 'b' }, folders)).toBe(true)
  })

  it('refuse son dossier actuel (dépôt sans effet)', () => {
    expect(canDropOn(note('n', 'a'), { kind: 'folder', id: 'a' }, folders)).toBe(false)
  })

  it('refuse la racine : une note vit toujours dans un dossier', () => {
    expect(canDropOn(note('n', 'a'), { kind: 'root' }, folders)).toBe(false)
  })
})

describe('canDropOn — dossier', () => {
  it('accepte un dossier extérieur à son sous-arbre', () => {
    expect(canDropOn(folder('b', 'a'), { kind: 'folder', id: 'c' }, folders)).toBe(true)
  })

  it('refuse son parent actuel (dépôt sans effet)', () => {
    expect(canDropOn(folder('b', 'a'), { kind: 'folder', id: 'a' }, folders)).toBe(false)
  })

  it('refuse lui-même', () => {
    expect(canDropOn(folder('b', 'a'), { kind: 'folder', id: 'b' }, folders)).toBe(false)
  })

  it('refuse un de ses descendants (cycle)', () => {
    expect(canDropOn(folder('a', null), { kind: 'folder', id: 'd' }, folders)).toBe(false)
  })

  it('accepte la racine depuis un sous-dossier', () => {
    expect(canDropOn(folder('b', 'a'), { kind: 'root' }, folders)).toBe(true)
  })

  it('refuse la racine s’il y est déjà', () => {
    expect(canDropOn(folder('a', null), { kind: 'root' }, folders)).toBe(false)
  })
})
