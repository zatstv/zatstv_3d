import { useEffect, useState } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { Viewer } from './components/Viewer'
import { loadFont } from './lib/fonts'
import { buildKeychain, DEFAULT_PARAMS, type KeychainParams, type KeychainResult } from './lib/keychain'
import { loadManifold } from './lib/manifold'

const STORAGE_KEY = 'zatstv-3d:keychain'

function loadSavedParams(): KeychainParams {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULT_PARAMS, ...JSON.parse(saved) }
  } catch {
    // Si no hay diseño guardado o está dañado, se usa el diseño por defecto.
  }
  return DEFAULT_PARAMS
}

export default function App() {
  const [params, setParams] = useState<KeychainParams>(loadSavedParams)
  const [result, setResult] = useState<KeychainResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Parámetros del último cálculo terminado: si no son los actuales, se está recalculando.
  const [builtFor, setBuiltFor] = useState<KeychainParams | null>(null)
  const [baseColor, setBaseColor] = useState('#f2f2f2')
  const [detailColor, setDetailColor] = useState('#e0356b')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params))
    } catch {
      // Guardar es solo una comodidad; si falla, la app sigue funcionando.
    }
  }, [params])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadManifold(), loadFont(params.font)])
      .then(([wasm, font]) => {
        if (cancelled) return
        setResult(buildKeychain(wasm, font, params))
        setError(null)
        setBuiltFor(params)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error(err)
        setError('No se pudo generar el modelo con estos valores. Prueba a cambiar alguna medida.')
        setBuiltFor(params)
      })
    return () => {
      cancelled = true
    }
  }, [params])

  return (
    <div className="app">
      <ControlPanel
        params={params}
        onChange={(patch) => setParams((prev) => ({ ...prev, ...patch }))}
        onReset={() => setParams(DEFAULT_PARAMS)}
        result={result}
        error={error}
        busy={builtFor !== params}
        baseColor={baseColor}
        detailColor={detailColor}
        onBaseColor={setBaseColor}
        onDetailColor={setDetailColor}
      />
      <main className="preview">
        <Viewer result={result} baseColor={baseColor} detailColor={detailColor} />
        <p className="preview-help">Arrastra para girar · rueda para acercar · clic derecho para mover</p>
      </main>
    </div>
  )
}
