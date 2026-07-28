import DOMPurify from 'dompurify'

// Liste blanche alignée sur §8.1, plus <mark> pour le surlignage de recherche.
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'blockquote',
  'strong',
  'em',
  'a',
  'img',
  'code',
  'pre',
  'mark',
  'span',
]
// Ni `style` ni `class` : le style en ligne rouvrirait une injection CSS
// exfiltrante (`background:url(https://attaquant/…)`). La couleur du surlignage
// vit dans la feuille de style.
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title']

// Lié explicitement à `window` : l'instance auto-liée par défaut peut se
// dégrader en no-op si le global n'est pas prêt à l'import (cas du DOM de test).
const purifier = DOMPurify(window)

/** À passer sur tout HTML injecté via `dangerouslySetInnerHTML` (§8.1). */
export function sanitizeHtml(dirty: string): string {
  return purifier.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/)/i,
  })
}
