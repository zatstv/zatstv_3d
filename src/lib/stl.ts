import type { MeshData } from './keychain'

/** Codifica una malla como STL binario (mm, Z hacia arriba). */
export function meshToStl(mesh: MeshData): Blob {
  const { positions, indices } = mesh
  const triangles = indices.length / 3
  const buffer = new ArrayBuffer(84 + triangles * 50)
  const view = new DataView(buffer)

  const header = 'zatstv_3d'
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i))
  view.setUint32(80, triangles, true)

  let offset = 84
  for (let t = 0; t < triangles; t++) {
    const a = indices[t * 3] * 3
    const b = indices[t * 3 + 1] * 3
    const c = indices[t * 3 + 2] * 3

    const ux = positions[b] - positions[a]
    const uy = positions[b + 1] - positions[a + 1]
    const uz = positions[b + 2] - positions[a + 2]
    const vx = positions[c] - positions[a]
    const vy = positions[c + 1] - positions[a + 1]
    const vz = positions[c + 2] - positions[a + 2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len
    ny /= len
    nz /= len

    for (const value of [nx, ny, nz]) {
      view.setFloat32(offset, value, true)
      offset += 4
    }
    for (const vertex of [a, b, c]) {
      for (let k = 0; k < 3; k++) {
        view.setFloat32(offset, positions[vertex + k], true)
        offset += 4
      }
    }
    offset += 2 // attribute byte count
  }

  return new Blob([buffer], { type: 'model/stl' })
}

export function downloadStl(mesh: MeshData, filename: string) {
  const url = URL.createObjectURL(meshToStl(mesh))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
