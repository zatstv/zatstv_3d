import Module from 'manifold-3d'
import wasmUrl from 'manifold-3d/manifold.wasm?url'

export type ManifoldToplevel = Awaited<ReturnType<typeof Module>>

let modulePromise: Promise<ManifoldToplevel> | null = null

/** Carga el módulo WASM de manifold una sola vez. */
export function loadManifold(): Promise<ManifoldToplevel> {
  if (!modulePromise) {
    modulePromise = Module({ locateFile: () => wasmUrl }).then((wasm) => {
      wasm.setup()
      return wasm
    })
  }
  return modulePromise
}
