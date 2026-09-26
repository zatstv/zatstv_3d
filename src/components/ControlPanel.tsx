import { useEffect, useRef, type ReactNode } from 'react'
import { FONTS, type FontId } from '../lib/fonts'
import type { ImageField } from '../lib/image'
import type {
  HolePosition,
  ImageRole,
  KeychainParams,
  KeychainResult,
  ShapeId,
  TextMode,
} from '../lib/keychain'
import { downloadStl } from '../lib/stl'

const SHAPES: { id: ShapeId; label: string }[] = [
  { id: 'textFit', label: 'Contorno' },
  { id: 'rect', label: 'Rectángulo' },
  { id: 'circle', label: 'Círculo / óvalo' },
  { id: 'hexagon', label: 'Hexágono' },
  { id: 'heart', label: 'Corazón' },
]

const TEXT_MODES: { id: TextMode; label: string; hint: string }[] = [
  { id: 'relief', label: 'Relieve', hint: 'Las letras sobresalen de la base.' },
  { id: 'engrave', label: 'Grabado', hint: 'Las letras se hunden en la base.' },
  { id: 'flush', label: 'A ras (2 colores)', hint: 'Las letras quedan al nivel de la base, en otro color.' },
]

const IMAGE_ROLES: { id: ImageRole; label: string }[] = [
  { id: 'base', label: 'Parte de la forma' },
  { id: 'detail', label: 'Encima, como el texto' },
]

const HOLE_POSITIONS: { id: HolePosition; label: string }[] = [
  { id: 'left', label: 'Izquierda' },
  { id: 'top', label: 'Arriba' },
  { id: 'right', label: 'Derecha' },
]

interface ControlPanelProps {
  params: KeychainParams
  onChange: (patch: Partial<KeychainParams>) => void
  onReset: () => void
  result: KeychainResult | null
  error: string | null
  busy: boolean
  baseColor: string
  detailColor: string
  onBaseColor: (color: string) => void
  onDetailColor: (color: string) => void
  imageField: ImageField | null
  onImageFile: (file: File) => void
  onRemoveImage: () => void
}

export function ControlPanel({
  params: p,
  onChange,
  onReset,
  result,
  error,
  busy,
  baseColor,
  detailColor,
  onBaseColor,
  onDetailColor,
  imageField,
  onImageFile,
  onRemoveImage,
}: ControlPanelProps) {
  const fileName = slugify(p.text) || 'llavero'

  return (
    <aside className="panel">
      <header className="panel-header">
        <h1>Diseñador de llaveros</h1>
        <button className="link" onClick={onReset}>
          Reiniciar
        </button>
      </header>

      <Section title="Forma">
        <Segmented options={SHAPES} value={p.shape} onChange={(shape) => onChange({ shape })} />
        {p.shape === 'textFit' ? (
          <NumberField
            label="Margen alrededor"
            value={p.outlinePadding}
            min={1}
            max={10}
            step={0.5}
            onChange={(outlinePadding) => onChange({ outlinePadding })}
          />
        ) : (
          <>
            <NumberField label="Ancho" value={p.width} min={15} max={150} step={1} onChange={(width) => onChange({ width })} />
            <NumberField label="Alto" value={p.height} min={10} max={150} step={1} onChange={(height) => onChange({ height })} />
          </>
        )}
        {p.shape === 'rect' && (
          <NumberField
            label="Radio de esquinas"
            value={p.cornerRadius}
            min={0}
            max={30}
            step={0.5}
            onChange={(cornerRadius) => onChange({ cornerRadius })}
          />
        )}
        <NumberField label="Grosor de la base" value={p.thickness} min={1.2} max={8} step={0.2} onChange={(thickness) => onChange({ thickness })} />
      </Section>

      <Section title="Texto">
        <label className="field">
          <span>Texto (Enter para otra línea)</span>
          <textarea rows={2} value={p.text} onChange={(e) => onChange({ text: e.target.value })} />
        </label>
        <label className="field">
          <span>Fuente</span>
          <select value={p.font} onChange={(e) => onChange({ font: e.target.value as FontId })}>
            {Object.entries(FONTS).map(([id, font]) => (
              <option key={id} value={id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Altura de letra" value={p.textSize} min={3} max={40} step={0.5} onChange={(textSize) => onChange({ textSize })} />
        {p.text.includes('\n') && (
          <NumberField
            label="Espacio entre líneas"
            value={p.lineSpacing}
            min={1}
            max={2.5}
            step={0.05}
            unit="×"
            onChange={(lineSpacing) => onChange({ lineSpacing })}
          />
        )}
        <Segmented options={TEXT_MODES} value={p.textMode} onChange={(textMode) => onChange({ textMode })} />
        <p className="hint">{TEXT_MODES.find((m) => m.id === p.textMode)?.hint}</p>
        <NumberField
          label={p.textMode === 'relief' ? 'Altura del relieve' : 'Profundidad'}
          value={p.textDepth}
          min={0.4}
          max={4}
          step={0.2}
          onChange={(textDepth) => onChange({ textDepth })}
        />
        {p.shape !== 'textFit' && (
          <>
            <NumberField label="Mover texto ↔" value={p.textOffsetX} min={-60} max={60} step={0.5} onChange={(textOffsetX) => onChange({ textOffsetX })} />
            <NumberField label="Mover texto ↕" value={p.textOffsetY} min={-60} max={60} step={0.5} onChange={(textOffsetY) => onChange({ textOffsetY })} />
          </>
        )}
        {p.textMode === 'relief' && (
          <NumberField
            label="Borde elevado (0 = sin borde)"
            value={p.rimWidth}
            min={0}
            max={5}
            step={0.5}
            onChange={(rimWidth) => onChange({ rimWidth })}
          />
        )}
      </Section>

      <Section title="Imagen de referencia">
        {imageField ? (
          <>
            <MaskPreview field={imageField} threshold={p.imageThreshold} invert={p.imageInvert} />
            <NumberField
              label="Sensibilidad"
              value={Math.round(p.imageThreshold * 100)}
              min={5}
              max={95}
              step={1}
              unit="%"
              onChange={(v) => onChange({ imageThreshold: v / 100 })}
            />
            <label className="check">
              <input type="checkbox" checked={p.imageInvert} onChange={(e) => onChange({ imageInvert: e.target.checked })} />
              <span>{imageField.fromAlpha ? 'Invertir (usar lo transparente)' : 'Invertir (usar lo claro)'}</span>
            </label>
            <Segmented options={IMAGE_ROLES} value={p.imageRole} onChange={(imageRole) => onChange({ imageRole })} />
            <NumberField label="Ancho de la silueta" value={p.imageSize} min={5} max={120} step={1} onChange={(imageSize) => onChange({ imageSize })} />
            <NumberField label="Mover imagen ↔" value={p.imageOffsetX} min={-80} max={80} step={0.5} onChange={(imageOffsetX) => onChange({ imageOffsetX })} />
            <NumberField label="Mover imagen ↕" value={p.imageOffsetY} min={-80} max={80} step={0.5} onChange={(imageOffsetY) => onChange({ imageOffsetY })} />
            <NumberField
              label="Suavizado"
              value={p.imageSmoothing}
              min={0}
              max={2}
              step={0.1}
              onChange={(imageSmoothing) => onChange({ imageSmoothing })}
            />
            <label className="check">
              <input type="checkbox" checked={p.imageFillHoles} onChange={(e) => onChange({ imageFillHoles: e.target.checked })} />
              <span>Rellenar huecos interiores</span>
            </label>
            <button className="link align-start" onClick={onRemoveImage}>
              Quitar imagen
            </button>
          </>
        ) : (
          <>
            <label className="upload">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onImageFile(file)
                  e.target.value = ''
                }}
              />
              <span>Subir imagen…</span>
            </label>
            <p className="hint">
              Se usa su silueta. Funciona mejor con logos, dibujos o PNG con fondo transparente. Para una foto (una
              mascota, por ejemplo), primero quítale el fondo: muchos celulares lo hacen al mantener presionado el sujeto.
            </p>
          </>
        )}
      </Section>

      <Section title="Argolla">
        <label className="check">
          <input type="checkbox" checked={p.holeEnabled} onChange={(e) => onChange({ holeEnabled: e.target.checked })} />
          <span>Agregar agujero para la argolla</span>
        </label>
        {p.holeEnabled && (
          <>
            <Segmented options={HOLE_POSITIONS} value={p.holePosition} onChange={(holePosition) => onChange({ holePosition })} />
            <NumberField label="Diámetro del agujero" value={p.holeDiameter} min={2} max={12} step={0.5} onChange={(holeDiameter) => onChange({ holeDiameter })} />
            <NumberField label="Pared alrededor" value={p.holeWall} min={1} max={6} step={0.5} onChange={(holeWall) => onChange({ holeWall })} />
            <NumberField label="Meter hacia dentro" value={p.holeInset} min={-5} max={20} step={0.5} onChange={(holeInset) => onChange({ holeInset })} />
          </>
        )}
      </Section>

      <Section title="Colores (solo vista previa)">
        <div className="colors">
          <label className="color">
            <input type="color" value={baseColor} onChange={(e) => onBaseColor(e.target.value)} />
            <span>Base</span>
          </label>
          <label className="color">
            <input type="color" value={detailColor} onChange={(e) => onDetailColor(e.target.value)} />
            <span>Texto / borde</span>
          </label>
        </div>
      </Section>

      <Section title="Exportar para Bambu Studio">
        {error && <p className="error">{error}</p>}
        {result && (
          <>
            <p className="size">
              Tamaño: <strong>{result.size.map((v) => v.toFixed(1)).join(' × ')} mm</strong>
              {busy && <span className="busy"> · actualizando…</span>}
            </p>
            {result.warnings.length > 0 && (
              <ul className="warnings">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <button className="primary" onClick={() => downloadStl(result.combined, `${fileName}.stl`)}>
              Descargar STL (un color)
            </button>
            {result.detail && (
              <>
                <div className="row">
                  <button onClick={() => downloadStl(result.base, `${fileName}-base.stl`)}>Base.stl</button>
                  <button onClick={() => downloadStl(result.detail!, `${fileName}-texto.stl`)}>Texto.stl</button>
                </div>
                <p className="hint">
                  Para dos colores con el AMS lite: arrastra los dos archivos juntos a Bambu Studio, acepta cargarlos
                  como un solo objeto con varias partes y asigna un filamento a cada parte.
                </p>
              </>
            )}
          </>
        )}
      </Section>
    </aside>
  )
}

/** Muestra qué partes de la imagen se van a usar con la sensibilidad actual. */
function MaskPreview({ field, threshold, invert }: { field: ImageField; threshold: number; invert: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = field.width
    canvas.height = field.height
    const ctx = canvas.getContext('2d')!
    const pixels = ctx.createImageData(field.width, field.height)
    for (let i = 0; i < field.ink.length; i++) {
      const ink = invert ? 1 - field.ink[i] : field.ink[i]
      if (ink >= threshold) {
        pixels.data[i * 4] = 224
        pixels.data[i * 4 + 1] = 53
        pixels.data[i * 4 + 2] = 107
        pixels.data[i * 4 + 3] = 255
      }
    }
    ctx.putImageData(pixels, 0, 0)
  }, [field, threshold, invert])

  return (
    <div className="mask-preview">
      <img src={field.dataUrl} alt="Imagen original" />
      <canvas ref={canvasRef} aria-label="Silueta detectada" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function NumberField({ label, value, min, max, step, unit = 'mm', onChange }: NumberFieldProps) {
  const set = (raw: string) => {
    const n = Number(raw)
    if (raw !== '' && Number.isFinite(n)) onChange(n)
  }
  return (
    <label className="field number">
      <span>{label}</span>
      <div className="number-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(e.target.value)} />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => set(e.target.value)} />
        <em>{unit}</em>
      </div>
    </label>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}
