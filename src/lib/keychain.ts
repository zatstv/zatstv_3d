import type opentype from 'opentype.js'
import type { CrossSection, Manifold } from 'manifold-3d'
import type { FontId } from './fonts'
import type { ManifoldToplevel } from './manifold'
import { textToContours, type SimplePolygon, type Vec2 } from './text'

/** Cama de impresión de la Bambu Lab A1 (mm). */
export const BED_SIZE = 256

export type ShapeId = 'rect' | 'circle' | 'hexagon' | 'heart' | 'textFit'
export type TextMode = 'relief' | 'engrave' | 'flush'
export type HolePosition = 'left' | 'right' | 'top'

export interface KeychainParams {
  shape: ShapeId
  width: number
  height: number
  cornerRadius: number
  thickness: number
  /** Margen alrededor de las letras cuando la forma es "Contorno del texto". */
  outlinePadding: number

  text: string
  font: FontId
  textSize: number
  lineSpacing: number
  textMode: TextMode
  /** Altura del relieve o profundidad del grabado. */
  textDepth: number
  textOffsetX: number
  textOffsetY: number

  /** Borde elevado alrededor de la figura (0 = sin borde). Solo en modo relieve. */
  rimWidth: number

  holeEnabled: boolean
  holePosition: HolePosition
  holeDiameter: number
  holeWall: number
  /** Cuánto se mete la argolla hacia dentro de la figura. */
  holeInset: number
}

export const DEFAULT_PARAMS: KeychainParams = {
  shape: 'textFit',
  width: 60,
  height: 25,
  cornerRadius: 5,
  thickness: 3,
  outlinePadding: 3,

  text: 'Zats',
  font: 'pacifico',
  textSize: 12,
  lineSpacing: 1.4,
  textMode: 'relief',
  textDepth: 1.2,
  textOffsetX: 0,
  textOffsetY: 0,

  rimWidth: 0,

  holeEnabled: true,
  holePosition: 'left',
  holeDiameter: 4.5,
  holeWall: 2.5,
  holeInset: 0,
}

export interface MeshData {
  positions: Float32Array
  indices: Uint32Array
}

export interface KeychainResult {
  /** Cuerpo del llavero (color principal). */
  base: MeshData
  /** Texto y borde (segundo color). Null si no hay. */
  detail: MeshData | null
  /** Base y detalle unidos en una sola pieza sólida (impresión a un color). */
  combined: MeshData
  size: [number, number, number]
  warnings: string[]
}

/** Genera la geometría del llavero en mm, con Z hacia arriba (como la espera el slicer). */
export function buildKeychain(
  wasm: ManifoldToplevel,
  font: opentype.Font,
  p: KeychainParams,
): KeychainResult {
  const { CrossSection } = wasm
  const warnings: string[] = []

  // Todo objeto de manifold vive en memoria WASM: se registran y se liberan al final.
  const trash: { delete(): void }[] = []
  const keep = <T extends { delete(): void }>(obj: T): T => {
    trash.push(obj)
    return obj
  }

  try {
    let text2d = buildText(wasm, font, p, keep)
    let base2d = buildBase(wasm, p, text2d, keep, warnings)

    if (p.holeEnabled) {
      const b = base2d.bounds()
      const cx = (b.min[0] + b.max[0]) / 2
      const cy = (b.min[1] + b.max[1]) / 2
      const center: Vec2 =
        p.holePosition === 'left'
          ? [b.min[0] + p.holeInset, cy]
          : p.holePosition === 'right'
            ? [b.max[0] - p.holeInset, cy]
            : [cx, b.max[1] - p.holeInset]
      const outerRadius = p.holeDiameter / 2 + p.holeWall
      const ring = keep(CrossSection.circle(outerRadius, 64).translate(center))
      const hole = keep(CrossSection.circle(p.holeDiameter / 2, 64).translate(center))
      base2d = keep(keep(base2d.add(ring)).subtract(hole))
      if (text2d) {
        const clearance = keep(hole.offset(0.8, 'Round', 2, 64))
        text2d = keep(text2d.subtract(clearance))
      }
    }

    const pieces = base2d.decompose()
    pieces.forEach(keep)
    if (pieces.length > 1) {
      warnings.push(
        `La figura quedó en ${pieces.length} piezas separadas. Sube el margen, acerca las letras o mueve la argolla.`,
      )
    }

    if (text2d && p.shape !== 'textFit') {
      const outside = keep(text2d.subtract(base2d))
      if (outside.area() > 0.01) {
        warnings.push('El texto se sale de la figura: hazlo más pequeño o agranda la figura.')
      }
    }

    const T = p.thickness
    let base3d = keep(base2d.extrude(T))
    let detail3d: Manifold | null = null

    const insideText = text2d ? keep(text2d.intersect(base2d)) : null
    if (insideText && !insideText.isEmpty()) {
      if (p.textMode === 'relief') {
        detail3d = keep(keep(insideText.extrude(p.textDepth)).translate(0, 0, T))
      } else {
        const maxDepth = T - 0.6
        const depth = Math.min(p.textDepth, maxDepth)
        if (p.textDepth > maxDepth) {
          warnings.push(
            `El grabado se limitó a ${maxDepth.toFixed(1)} mm para que el fondo no quede demasiado delgado.`,
          )
        }
        const cavity = keep(keep(insideText.extrude(depth)).translate(0, 0, T - depth))
        base3d = keep(base3d.subtract(cavity))
        if (p.textMode === 'flush') detail3d = cavity
      }
    }

    if (p.textMode === 'relief' && p.rimWidth > 0) {
      const inner = keep(base2d.offset(-p.rimWidth, 'Round', 2, 48))
      const rim2d = keep(base2d.subtract(inner))
      const rim3d = keep(keep(rim2d.extrude(p.textDepth)).translate(0, 0, T))
      detail3d = detail3d ? keep(detail3d.add(rim3d)) : rim3d
    }

    const box = base3d.boundingBox()
    if (detail3d) {
      const d = detail3d.boundingBox()
      for (let i = 0; i < 3; i++) {
        box.min[i] = Math.min(box.min[i], d.min[i])
        box.max[i] = Math.max(box.max[i], d.max[i])
      }
    }
    const size: [number, number, number] = [
      box.max[0] - box.min[0],
      box.max[1] - box.min[1],
      box.max[2] - box.min[2],
    ]

    if (size[0] > BED_SIZE || size[1] > BED_SIZE) {
      warnings.push(`El modelo mide más de ${BED_SIZE} mm y no cabe en la cama de la A1.`)
    }
    if (text2d && p.textSize < 5) {
      warnings.push('Texto menor a 5 mm: los detalles finos pueden no salir bien con boquilla de 0.4.')
    }
    if (p.holeEnabled && p.holeWall < 1.5) {
      warnings.push('La pared de la argolla es muy delgada (< 1.5 mm) y se puede romper.')
    }

    const hasDetail = detail3d !== null && !detail3d.isEmpty()
    return {
      base: toMeshData(base3d),
      detail: hasDetail ? toMeshData(detail3d!) : null,
      combined: toMeshData(hasDetail ? keep(base3d.add(detail3d!)) : base3d),
      size,
      warnings,
    }
  } finally {
    for (const obj of trash) obj.delete()
  }
}

type Keep = <T extends { delete(): void }>(obj: T) => T

function buildText(
  wasm: ManifoldToplevel,
  font: opentype.Font,
  p: KeychainParams,
  keep: Keep,
): CrossSection | null {
  const { CrossSection } = wasm
  const lines = p.text.split('\n')
  const lineGap = p.textSize * p.lineSpacing
  const sections: CrossSection[] = []

  lines.forEach((line, i) => {
    if (!line.trim()) return
    const cs = keep(new CrossSection(textToContours(font, line, p.textSize), 'NonZero'))
    if (cs.isEmpty()) return
    const b = cs.bounds()
    sections.push(keep(cs.translate(-(b.min[0] + b.max[0]) / 2, -i * lineGap)))
  })
  if (sections.length === 0) return null

  // Centra verticalmente usando la caja de las mayúsculas, no los rasgos descendentes.
  const centerY = (p.textSize - (lines.length - 1) * lineGap) / 2
  // El corazón es más ancho en su parte alta, así que el texto se sube un poco.
  const shapeOffsetY = p.shape === 'heart' ? p.height * 0.12 : 0
  const all = keep(CrossSection.union(sections))
  return keep(all.translate(p.textOffsetX, p.textOffsetY + shapeOffsetY - centerY))
}

function buildBase(
  wasm: ManifoldToplevel,
  p: KeychainParams,
  text2d: CrossSection | null,
  keep: Keep,
  warnings: string[],
): CrossSection {
  const { CrossSection } = wasm
  const w = p.width
  const h = p.height

  switch (p.shape) {
    case 'rect': {
      const r = Math.max(0, Math.min(p.cornerRadius, Math.min(w, h) / 2 - 0.01))
      const core = keep(CrossSection.square([w - 2 * r, h - 2 * r], true))
      return r > 0 ? keep(core.offset(r, 'Round', 2, 64)) : core
    }
    case 'circle':
      return keep(keep(CrossSection.circle(0.5, 128)).scale([w, h]))
    case 'hexagon':
      return keep(new CrossSection(fitToBox(regularPolygon(6), w, h), 'NonZero'))
    case 'heart':
      return keep(new CrossSection(fitToBox(heartContour(), w, h), 'NonZero'))
    case 'textFit': {
      if (!text2d) {
        warnings.push('Escribe un texto para usar la forma "Contorno del texto".')
        return keep(CrossSection.square([w, h], true))
      }
      const grown = keep(text2d.offset(p.outlinePadding, 'Round', 2, 48))
      // Se quedan solo los contornos exteriores para rellenar los huecos de letras como "o" o "a".
      const outers = grown.toPolygons().filter((poly) => signedArea(poly) > 0)
      return keep(new CrossSection(outers, 'NonZero'))
    }
  }
}

function heartContour(): SimplePolygon {
  const points: SimplePolygon = []
  const steps = 160
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    points.push([
      16 * Math.sin(t) ** 3,
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
    ])
  }
  return points
}

function regularPolygon(sides: number): SimplePolygon {
  const points: SimplePolygon = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2
    points.push([Math.cos(a), Math.sin(a)])
  }
  return points
}

function fitToBox(poly: SimplePolygon, w: number, h: number): SimplePolygon {
  const xs = poly.map((v) => v[0])
  const ys = poly.map((v) => v[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return poly.map(([x, y]) => [
    ((x - minX) / (maxX - minX) - 0.5) * w,
    ((y - minY) / (maxY - minY) - 0.5) * h,
  ])
}

function signedArea(poly: SimplePolygon): number {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

function toMeshData(m: Manifold): MeshData {
  const mesh = m.getMesh()
  const { numProp, vertProperties, triVerts } = mesh
  const positions = new Float32Array((vertProperties.length / numProp) * 3)
  for (let v = 0; v < positions.length / 3; v++) {
    positions[v * 3] = vertProperties[v * numProp]
    positions[v * 3 + 1] = vertProperties[v * numProp + 1]
    positions[v * 3 + 2] = vertProperties[v * numProp + 2]
  }
  return { positions, indices: new Uint32Array(triVerts) }
}
