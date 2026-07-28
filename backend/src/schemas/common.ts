import { z } from 'zod'

/**
 * Champ texte « métier » (titre de note, nom de workspace…). Le `normalize`
 * fusionne les variantes Unicode — « é » composé et « e » + accent combinant se
 * stockent pareil (§7.3).
 *
 * Jamais pour un secret : un mot de passe ne se trim ni ne se normalise, sa
 * valeur exacte fait foi.
 */
export function normalizedText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((s) => s.normalize('NFC'))
}
