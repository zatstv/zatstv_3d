import opentype from 'opentype.js'
import poppinsBold from '@fontsource/poppins/files/poppins-latin-700-normal.woff?url'
import poppinsExtraBold from '@fontsource/poppins/files/poppins-latin-800-normal.woff?url'
import bebasNeue from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff?url'
import pacifico from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url'
import lobster from '@fontsource/lobster/files/lobster-latin-400-normal.woff?url'

export const FONTS = {
  'poppins-bold': { label: 'Poppins Bold', url: poppinsBold },
  'poppins-extrabold': { label: 'Poppins Extra Bold', url: poppinsExtraBold },
  'bebas-neue': { label: 'Bebas Neue', url: bebasNeue },
  pacifico: { label: 'Pacifico (cursiva)', url: pacifico },
  lobster: { label: 'Lobster (cursiva)', url: lobster },
} as const

export type FontId = keyof typeof FONTS

const cache = new Map<FontId, Promise<opentype.Font>>()

export function loadFont(id: FontId): Promise<opentype.Font> {
  let font = cache.get(id)
  if (!font) {
    font = fetch(FONTS[id].url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => opentype.parse(buffer))
    cache.set(id, font)
  }
  return font
}
