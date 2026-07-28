import { randomBytes } from 'node:crypto'
import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { InvitationStatus, PermissionLevel, WorkspaceRole, type Prisma } from '@prisma/client'
import { prisma } from '../src/lib/prisma.js'
import { hashPassword } from '../src/lib/password.js'
import { sanitizeTiptapContent } from '../src/lib/tiptap-sanitize.js'
import { extractText } from '../src/lib/tiptap.js'
import { storage } from '../src/lib/storage.js'
import { gradientPng, PALETTES, type PaletteKey } from './seed/png.js'
import {
  COVER_PLACEHOLDER,
  DEMO_PASSWORD,
  MAIN_USER,
  USERS,
  WORKSPACES,
  type SeedFolder,
  type SeedNote,
  type SeedWorkspace,
} from './seed/catalog.js'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? '/app/uploads'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const counts = {
  users: 0,
  workspaces: 0,
  folders: 0,
  notes: 0,
  trashed: 0,
  invitations: 0,
  attachments: 0,
  permissions: 0,
}

type Ctx = { firstFolderId: string | null; firstNoteId: string | null }

const genId = () => 'c' + randomBytes(16).toString('hex')

const usedSlugs = new Set<string>()
function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'espace'
  let slug = base
  let n = 1
  while (usedSlugs.has(slug)) slug = `${base}-${++n}`
  usedSlugs.add(slug)
  return slug
}

const fileSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image'

/** Vide entièrement la base (TRUNCATE … CASCADE : robuste face aux FK auto-référencées) et les uploads. */
async function wipe() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Permission","Attachment","Invitation","Note","Folder","WorkspaceMember","Workspace","User" RESTART IDENTITY CASCADE',
  )
  try {
    for (const f of await readdir(UPLOADS_DIR)) {
      if (f === '.gitkeep') continue
      await unlink(join(UPLOADS_DIR, f)).catch(() => {})
    }
  } catch {
    /* dossier d'uploads absent : rien à nettoyer */
  }
}

async function createUsers(): Promise<Map<string, string>> {
  const password = await hashPassword(DEMO_PASSWORD)
  const map = new Map<string, string>()
  for (const su of USERS) {
    const user = await prisma.user.create({ data: { name: su.name, email: su.email, password } })
    map.set(su.key, user.id)
    counts.users++
  }
  return map
}

async function makeAttachment(
  noteId: string,
  uploaderId: string,
  palette: PaletteKey,
  label: string,
  id?: string,
) {
  const [from, to] = PALETTES[palette]
  const { storedName, size } = await storage.save(gradientPng(800, 450, from, to), `${label}.png`)
  const data: Prisma.AttachmentUncheckedCreateInput = {
    ...(id ? { id } : {}),
    noteId,
    uploadedById: uploaderId,
    filename: `${label}.png`,
    storedName,
    mimeType: 'image/png',
    size,
  }
  await prisma.attachment.create({ data })
  counts.attachments++
}

async function createNote(
  note: SeedNote,
  folderId: string,
  ownerId: string,
  users: Map<string, string>,
  folderTrashed: boolean,
): Promise<string> {
  const authorId = (note.author && users.get(note.author)) || ownerId
  const coverId = note.cover ? genId() : null
  let body: unknown = note.body
  if (coverId) {
    const url = `/api/attachments/${coverId}/file`
    body = JSON.parse(JSON.stringify(note.body).replaceAll(COVER_PLACEHOLDER, url))
  }
  const content = sanitizeTiptapContent(body)
  const trashed = Boolean(note.trashed || folderTrashed)
  const created = await prisma.note.create({
    data: {
      title: note.title,
      content,
      contentText: extractText(content),
      folderId,
      createdById: authorId,
      ...(trashed ? { deletedAt: new Date() } : {}),
    },
  })
  counts.notes++
  if (trashed) counts.trashed++
  if (note.cover && coverId)
    await makeAttachment(created.id, authorId, note.cover, fileSlug(note.title), coverId)
  for (const g of note.gallery ?? [])
    await makeAttachment(created.id, authorId, g, `${fileSlug(note.title)}-${g}`)
  return created.id
}

async function createFolder(
  f: SeedFolder,
  workspaceId: string,
  parentId: string | null,
  ownerId: string,
  users: Map<string, string>,
  inheritedTrash: boolean,
  ctx: Ctx,
) {
  const trashed = Boolean(f.trashed || inheritedTrash)
  const folder = await prisma.folder.create({
    data: { name: f.name, workspaceId, parentId, ...(trashed ? { deletedAt: new Date() } : {}) },
  })
  counts.folders++
  if (!ctx.firstFolderId && !trashed) ctx.firstFolderId = folder.id
  for (const note of f.notes ?? []) {
    const id = await createNote(note, folder.id, ownerId, users, trashed)
    if (!ctx.firstNoteId && !trashed && !note.trashed) ctx.firstNoteId = id
  }
  for (const child of f.children ?? [])
    await createFolder(child, workspaceId, folder.id, ownerId, users, trashed, ctx)
}

async function seedPermissions(
  ws: SeedWorkspace,
  memberIdByUser: Map<string, string>,
  ownerId: string,
  ctx: Ctx,
) {
  const members = ws.members ?? []
  if (!members.length) return
  const grants: { user: string; level: PermissionLevel; noteId?: string; folderId?: string }[] = []
  if (ctx.firstNoteId)
    grants.push({ user: members[0].user, level: 'WRITE', noteId: ctx.firstNoteId })
  if (ctx.firstFolderId && members[1])
    grants.push({ user: members[1].user, level: 'ADMIN', folderId: ctx.firstFolderId })
  for (const g of grants) {
    const memberId = memberIdByUser.get(g.user)
    if (!memberId) continue
    await prisma.permission.create({
      data: {
        memberId,
        level: g.level,
        grantedById: ownerId,
        noteId: g.noteId ?? null,
        folderId: g.folderId ?? null,
      },
    })
    counts.permissions++
  }
}

async function createWorkspace(ws: SeedWorkspace, users: Map<string, string>) {
  const ownerId = users.get(ws.owner)
  if (!ownerId) throw new Error(`Owner inconnu : ${ws.owner}`)
  const workspace = await prisma.workspace.create({
    data: {
      name: ws.name,
      slug: slugify(ws.name),
      description: ws.description ?? null,
      icon: ws.icon,
      ownerId,
    },
  })
  counts.workspaces++

  const memberIdByUser = new Map<string, string>()
  const owner = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: ownerId, role: WorkspaceRole.OWNER },
  })
  memberIdByUser.set(ws.owner, owner.id)
  for (const m of ws.members ?? []) {
    const userId = users.get(m.user)
    if (!userId) throw new Error(`Membre inconnu : ${m.user}`)
    const wm = await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: m.role as WorkspaceRole },
    })
    memberIdByUser.set(m.user, wm.id)
  }

  for (const inv of ws.invites ?? []) {
    await prisma.invitation.create({
      data: {
        workspaceId: workspace.id,
        email: inv.email.toLowerCase(),
        role: inv.role as WorkspaceRole,
        token: randomBytes(32).toString('base64url'),
        invitedById: ownerId,
        expiresAt: new Date(Date.now() + WEEK_MS),
        status: InvitationStatus.PENDING,
      },
    })
    counts.invitations++
  }

  const ctx: Ctx = { firstFolderId: null, firstNoteId: null }
  for (const folder of ws.folders)
    await createFolder(folder, workspace.id, null, ownerId, users, false, ctx)
  await seedPermissions(ws, memberIdByUser, ownerId, ctx)
}

async function main() {
  console.log('🌱 Réinitialisation de la base…')
  await wipe()
  const users = await createUsers()
  for (const ws of WORKSPACES) await createWorkspace(ws, users)

  const owner = USERS.find((u) => u.key === MAIN_USER)
  console.log('✅ Seed terminé :', counts)
  console.log(`\n🔑 Compte de connexion principal :`)
  console.log(`   e-mail   : ${owner?.email}`)
  console.log(`   mot de passe : ${DEMO_PASSWORD}`)
  console.log(`   (tous les comptes de démo partagent ce mot de passe)\n`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Échec du seed :', err)
    await prisma.$disconnect()
    process.exit(1)
  })
