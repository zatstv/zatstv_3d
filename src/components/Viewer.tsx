import { useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Grid, OrbitControls, useBounds } from '@react-three/drei'
import { BufferAttribute, BufferGeometry } from 'three'
import type { KeychainResult, MeshData } from '../lib/keychain'

interface ViewerProps {
  result: KeychainResult | null
  baseColor: string
  detailColor: string
}

export function Viewer({ result, baseColor, detailColor }: ViewerProps) {
  return (
    <Canvas camera={{ position: [0, 70, 90], fov: 40, near: 0.1, far: 2000 }} dpr={[1, 2]}>
      <color attach="background" args={['#1b1d22']} />
      <hemisphereLight args={['#ffffff', '#44474f', 1.2]} />
      <directionalLight position={[60, 120, 80]} intensity={1.8} />
      <directionalLight position={[-80, 40, -60]} intensity={0.6} />

      {result && (
        <Bounds fit observe margin={1.3}>
          <RefitOnResize size={result.size} />
          {/* El modelo está en Z-arriba (como en el slicer); Three.js usa Y-arriba. */}
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Part mesh={result.base} color={baseColor} />
            {result.detail && <Part mesh={result.detail} color={detailColor} />}
          </group>
        </Bounds>
      )}

      <Grid
        position={[0, -0.01, 0]}
        args={[256, 256]}
        cellSize={10}
        cellColor="#3a3d45"
        sectionSize={50}
        sectionColor="#5b606b"
        fadeDistance={400}
        infiniteGrid
      />
      <OrbitControls makeDefault />
    </Canvas>
  )
}

/** Reencuadra la cámara cuando el modelo cambia bastante de tamaño, no en cada ajuste pequeño. */
function RefitOnResize({ size }: { size: [number, number, number] }) {
  const bounds = useBounds()
  const lastSize = useRef(size)

  useEffect(() => {
    const prev = Math.max(lastSize.current[0], lastSize.current[1])
    const next = Math.max(size[0], size[1])
    if (Math.abs(next - prev) / prev > 0.15) {
      lastSize.current = size
      bounds.refresh().clip().fit()
    }
  }, [bounds, size])

  return null
}

function Part({ mesh, color }: { mesh: MeshData; color: string }) {
  const geometry = useMemo(() => {
    const indexed = new BufferGeometry()
    indexed.setAttribute('position', new BufferAttribute(mesh.positions, 3))
    indexed.setIndex(new BufferAttribute(mesh.indices, 1))
    // Sin índices cada cara tiene sus propias normales: bordes nítidos como en la pieza real.
    const flat = indexed.toNonIndexed()
    flat.computeVertexNormals()
    indexed.dispose()
    return flat
  }, [mesh])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  )
}
