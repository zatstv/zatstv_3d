import { useEffect, useMemo, useState } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { Viewer } from './components/Viewer'
import { loadFont } from './lib/fonts'
import { loadImageField, traceImage, type ImageField, type TracedImage } from './lib/image'
import { buildKeychain, DEFAULT_PARAMS, type KeychainParams, type KeychainResult } from './lib/keychain'
import { loadManifold } from './lib/manifold'

const STORAGE_KEY = 'zatstv-3d:keychain'
const IMAGE_KEY = 'zatstv-3d:image'

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Guardar es solo una comodidad; si falla, la app sigue funcionando.
  }
}

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
  const [imageField, setImageField] = useState<ImageField | null>(null)
  // Entradas del último cálculo terminado: si no son las actuales, se está recalculando.
  const [builtFor, setBuiltFor] = useState<{ params: KeychainParams; traced: TracedImage | null } | null>(null)
  const [baseColor, setBaseColor] = useState('#f2f2f2')
  const [detailColor, setDetailColor] = useState('#e0356b')

  const traced = useMemo(
    () => (imageField ? traceImage(imageField, params.imageThreshold, params.imageInvert) : null),
    [imageField, params.imageThreshold, params.imageInvert],
  )

  useEffect(() => save(STORAGE_KEY, JSON.stringify(params)), [params])

  // Recupera la imagen del último diseño.
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(IMAGE_KEY)
    } catch {
      // Sin acceso al almacenamiento no hay imagen que recuperar.
    }
    if (saved) loadImageField(saved).then(setImageField, () => save(IMAGE_KEY, null))
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadManifold(), loadFont(params.font)])
      .then(([wasm, font]) => {
        if (cancelled) return
        setResult(buildKeychain(wasm, font, params, traced))
        setError(null)
        setBuiltFor({ params, traced })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error(err)
        setError('No se pudo generar el modelo con estos valores. Prueba a cambiar alguna medida.')
        setBuiltFor({ params, traced })
      })
    return () => {
      cancelled = true
    }
  }, [params, traced])

  const handleImageFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    try {
      const field = await loadImageField(url)
      setImageField(field)
      save(IMAGE_KEY, field.dataUrl)
      setParams((prev) => ({ ...prev, imageInvert: false, imageOffsetX: 0, imageOffsetY: 0 }))
    } catch {
      setError('No se pudo leer esa imagen. Prueba con un PNG o JPG.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const handleRemoveImage = () => {
    setImageField(null)
    save(IMAGE_KEY, null)
  }

  return (
    <div className="app">
      <ControlPanel
        params={params}
        onChange={(patch) => setParams((prev) => ({ ...prev, ...patch }))}
        onReset={() => setParams(DEFAULT_PARAMS)}
        result={result}
        error={error}
        busy={builtFor?.params !== params || builtFor.traced !== traced}
        imageField={imageField}
        onImageFile={handleImageFile}
        onRemoveImage={handleRemoveImage}
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
