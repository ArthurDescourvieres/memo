// Sans React, pour rester testable isolément. Le CSS correspondant est dans
// memo/styles/tokens.css : `:root` porte le sombre, `[data-theme='light']` le clair.

export type Theme = 'light' | 'dark'

/** Doit rester synchronisé avec le script anti-flash de index.html. */
export const THEME_STORAGE_KEY = 'memo-theme'

export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** `null` tant que l'utilisateur n'a rien choisi explicitement. */
export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* mode privé : le thème reste appliqué en mémoire pour la session */
  }
}

export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

/** Lu sur <html>, où le script anti-flash de index.html l'a posé. */
export function getActiveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** `animate` ajoute brièvement `theme-transition` (tokens.css) pour fondre les couleurs. */
export function applyTheme(theme: Theme, animate = false): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 520)
  }
  root.dataset.theme = theme
}
