import type { Prisma } from '@prisma/client'

type TiptapMark = {
  type?: string
  attrs?: Record<string, unknown>
}

type TiptapNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

// Ce que l'éditeur peut légitimement produire (§8.1) : tout le reste tombe.
const ALLOWED_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'text',
  'image',
])

const ALLOWED_MARKS = new Set(['bold', 'italic', 'strike', 'code', 'underline', 'link'])

const EMPTY_DOC = { type: 'doc', content: [] }

function stripEventAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (/^on/i.test(key)) continue // onclick, onerror…
    clean[key] = value
  }
  return clean
}

function isSafeUrl(value: unknown, schemes: string[]): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.startsWith('/')) return true // URL interne, ex. /api/attachments/…
  try {
    return schemes.includes(new URL(trimmed).protocol.replace(':', ''))
  } catch {
    return false
  }
}

function sanitizeMarks(marks: TiptapMark[]): TiptapMark[] {
  const out: TiptapMark[] = []
  for (const mark of marks) {
    if (!mark?.type || !ALLOWED_MARKS.has(mark.type)) continue
    const clean: TiptapMark = { type: mark.type }
    if (mark.attrs) {
      const attrs = stripEventAttrs(mark.attrs)
      if (mark.type === 'link' && !isSafeUrl(attrs.href, ['http', 'https', 'mailto'])) {
        delete attrs.href
      }
      clean.attrs = attrs
    }
    out.push(clean)
  }
  return out
}

function sanitizeNode(node: TiptapNode): TiptapNode | null {
  if (!node || typeof node.type !== 'string' || !ALLOWED_NODES.has(node.type)) {
    return null
  }

  const clean: TiptapNode = { type: node.type }

  if (typeof node.text === 'string') clean.text = node.text

  if (node.attrs) {
    const attrs = stripEventAttrs(node.attrs)
    if (node.type === 'image' && !isSafeUrl(attrs.src, ['http', 'https'])) {
      return null
    }
    clean.attrs = attrs
  }

  if (Array.isArray(node.marks)) clean.marks = sanitizeMarks(node.marks)

  if (Array.isArray(node.content)) {
    clean.content = node.content
      .map(sanitizeNode)
      .filter((child): child is TiptapNode => child !== null)
  }

  return clean
}

/**
 * Assainissement serveur du JSON Tiptap (§8.1) : la base ne doit jamais stocker
 * un nœud forgé. Double barrière avec DOMPurify côté client (T-NOTE-02).
 */
export function sanitizeTiptapContent(content: unknown): Prisma.InputJsonValue {
  if (!content || typeof content !== 'object') {
    return EMPTY_DOC as Prisma.InputJsonValue
  }
  const sanitized = sanitizeNode(content as TiptapNode)
  return (sanitized ?? EMPTY_DOC) as Prisma.InputJsonValue
}
