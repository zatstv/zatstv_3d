import type opentype from 'opentype.js'

export type Vec2 = [number, number]
export type SimplePolygon = Vec2[]

const QUAD_STEPS = 8
const CUBIC_STEPS = 12

/**
 * Convierte una línea de texto en contornos 2D (en mm, eje Y hacia arriba).
 * `capHeightMm` es la altura que tendrán las letras mayúsculas.
 */
export function textToContours(
  font: opentype.Font,
  line: string,
  capHeightMm: number,
): SimplePolygon[] {
  const capHeight = font.tables.os2?.sCapHeight || font.unitsPerEm * 0.7
  const fontSize = (capHeightMm * font.unitsPerEm) / capHeight
  const path = font.getPath(line, 0, 0, fontSize)

  const contours: SimplePolygon[] = []
  let current: Vec2[] = []
  let x = 0
  let y = 0

  const close = () => {
    if (current.length > 2) contours.push(current)
    current = []
  }

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        close()
        x = cmd.x
        y = cmd.y
        current.push([x, -y])
        break
      case 'L':
        x = cmd.x
        y = cmd.y
        current.push([x, -y])
        break
      case 'Q':
        for (let i = 1; i <= QUAD_STEPS; i++) {
          const t = i / QUAD_STEPS
          const u = 1 - t
          current.push([
            u * u * x + 2 * u * t * cmd.x1 + t * t * cmd.x,
            -(u * u * y + 2 * u * t * cmd.y1 + t * t * cmd.y),
          ])
        }
        x = cmd.x
        y = cmd.y
        break
      case 'C':
        for (let i = 1; i <= CUBIC_STEPS; i++) {
          const t = i / CUBIC_STEPS
          const u = 1 - t
          current.push([
            u * u * u * x + 3 * u * u * t * cmd.x1 + 3 * u * t * t * cmd.x2 + t * t * t * cmd.x,
            -(u * u * u * y + 3 * u * u * t * cmd.y1 + 3 * u * t * t * cmd.y2 + t * t * t * cmd.y),
          ])
        }
        x = cmd.x
        y = cmd.y
        break
      case 'Z':
        close()
        break
    }
  }
  close()
  return contours
}
