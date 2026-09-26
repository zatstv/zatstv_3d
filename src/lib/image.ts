import type { Vec2 } from './text'

/** Resolución máxima a la que se procesa la imagen (px del lado más largo). */
const MAX_SIDE = 360

export interface ImageField {
  width: number
  height: number
  /** "Tinta" por píxel, de 0 (fondo) a 1 (figura). */
  ink: Float32Array
  /** True si la silueta sale de la transparencia del PNG y no de lo oscuro/claro. */
  fromAlpha: boolean
  /** Imagen reducida, para guardarla y volver a cargarla. */
  dataUrl: string
}

export interface TracedImage {
  width: number
  height: number
  /** Contornos en píxeles (Y hacia abajo). Se rellenan con la regla par-impar. */
  contours: Vec2[][]
}

/** Carga una imagen (URL de objeto o data URL) y calcula su mapa de "tinta". */
export async function loadImageField(src: string): Promise<ImageField> {
  const img = new Image()
  img.src = src
  await img.decode()

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)

  // Si una parte apreciable es transparente, la silueta es lo opaco.
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 200) transparent++
  const fromAlpha = transparent > width * height * 0.02

  const raw = new Float32Array(width * height)
  for (let i = 0; i < raw.length; i++) {
    const a = data[i * 4 + 3] / 255
    if (fromAlpha) {
      raw[i] = a
    } else {
      const lum = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255
      raw[i] = (1 - lum) * a
    }
  }

  return { width, height, ink: blur(raw, width, height), fromAlpha, dataUrl: canvas.toDataURL('image/png') }
}

/** Desenfoque 3×3 para que el contorno no salga con escalones de píxel. */
function blur(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx >= 0 && xx < w && yy >= 0 && yy < h) {
            sum += src[yy * w + xx]
            n++
          }
        }
      }
      out[y * w + x] = sum / n
    }
  }
  return out
}

/**
 * Traza los contornos de la zona con tinta >= threshold usando marching squares.
 * Cada punto de cruce de una arista pertenece exactamente a dos segmentos, así que
 * los segmentos se encadenan en lazos cerrados sin necesidad de orientarlos.
 */
export function traceImage(field: ImageField, threshold: number, invert: boolean): TracedImage {
  // Se agrega un marco vacío de 1 px para que todos los contornos cierren.
  const W = field.width + 2
  const H = field.height + 2
  const v = new Float32Array(W * H)
  for (let y = 0; y < field.height; y++) {
    for (let x = 0; x < field.width; x++) {
      const ink = field.ink[y * field.width + x]
      v[(y + 1) * W + x + 1] = invert ? 1 - ink : ink
    }
  }

  const V_BASE = W * H
  const points = new Map<number, Vec2>()
  const adjacency = new Map<number, number[]>()

  const crossing = (id: number, ax: number, ay: number, bx: number, by: number) => {
    if (!points.has(id)) {
      const a = v[ay * W + ax]
      const b = v[by * W + bx]
      const t = (threshold - a) / (b - a)
      points.set(id, [ax + (bx - ax) * t - 1, ay + (by - ay) * t - 1])
    }
    return id
  }
  const link = (a: number, b: number) => {
    const na = adjacency.get(a)
    if (na) na.push(b)
    else adjacency.set(a, [b])
    const nb = adjacency.get(b)
    if (nb) nb.push(a)
    else adjacency.set(b, [a])
  }

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = v[y * W + x]
      const tr = v[y * W + x + 1]
      const br = v[(y + 1) * W + x + 1]
      const bl = v[(y + 1) * W + x]
      const index =
        (tl >= threshold ? 8 : 0) | (tr >= threshold ? 4 : 0) | (br >= threshold ? 2 : 0) | (bl >= threshold ? 1 : 0)
      if (index === 0 || index === 15) continue

      const top = () => crossing(y * W + x, x, y, x + 1, y)
      const bottom = () => crossing((y + 1) * W + x, x, y + 1, x + 1, y + 1)
      const left = () => crossing(V_BASE + y * W + x, x, y, x, y + 1)
      const right = () => crossing(V_BASE + y * W + x + 1, x + 1, y, x + 1, y + 1)
      const centerInside = (tl + tr + br + bl) / 4 >= threshold

      switch (index) {
        case 1:
        case 14:
          link(left(), bottom())
          break
        case 2:
        case 13:
          link(bottom(), right())
          break
        case 3:
        case 12:
          link(left(), right())
          break
        case 4:
        case 11:
          link(top(), right())
          break
        case 6:
        case 9:
          link(top(), bottom())
          break
        case 7:
        case 8:
          link(left(), top())
          break
        case 5:
          if (centerInside) {
            link(left(), top())
            link(bottom(), right())
          } else {
            link(left(), bottom())
            link(top(), right())
          }
          break
        case 10:
          if (centerInside) {
            link(top(), right())
            link(left(), bottom())
          } else {
            link(left(), top())
            link(bottom(), right())
          }
          break
      }
    }
  }

  const contours: Vec2[][] = []
  const visited = new Set<number>()
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue
    const loop: Vec2[] = []
    let prev = -1
    let current = start
    while (!visited.has(current)) {
      visited.add(current)
      loop.push(points.get(current)!)
      const [n1, n2] = adjacency.get(current)!
      const next = n1 !== prev ? n1 : n2
      prev = current
      current = next
    }
    if (loop.length >= 3) contours.push(loop)
  }

  return { width: field.width, height: field.height, contours }
}
