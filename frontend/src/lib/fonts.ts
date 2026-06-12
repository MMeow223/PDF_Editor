import type { FontFamily } from '../api/types'

/** Loads bundled replacement fonts from the backend so the live edit
 * preview renders with the exact font that will be written into the PDF. */

const loaded = new Set<string>()
let familiesPromise: Promise<FontFamily[]> | null = null

export function listFamilies(): Promise<FontFamily[]> {
  familiesPromise ??= fetch('/api/fonts').then(r => r.json())
  return familiesPromise
}

export function cssFamilyName(family: string): string {
  return `pdfed-${family}` // weight/style selected via font-weight/font-style
}

const VARIANTS: Array<[string, string, string]> = [
  ['Regular', 'normal', 'normal'],
  ['Bold', 'bold', 'normal'],
  ['Italic', 'normal', 'italic'],
  ['BoldItalic', 'bold', 'italic'],
]

/** Idempotent; registers all four variants of a family as one CSS family. */
export async function ensureFontLoaded(family: string): Promise<void> {
  if (loaded.has(family)) return
  loaded.add(family)
  await Promise.all(VARIANTS.map(async ([variant, weight, style]) => {
    try {
      const face = new FontFace(
        `pdfed-${family}`,
        `url(/api/fonts/${family}/${variant}.ttf)`,
        { weight, style },
      )
      await face.load()
      document.fonts.add(face)
    } catch {
      /* missing variant — css fallback covers it */
    }
  }))
}
