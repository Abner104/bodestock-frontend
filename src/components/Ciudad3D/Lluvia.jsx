import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const N = 260

export default function Lluvia({ activa }) {
  const malla = useRef()
  const gotas = useMemo(
    () => Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 50, z: (Math.random() - 0.5) * 50, y: Math.random() * 14, v: 22 + Math.random() * 10 })),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, dt) => {
    const m = malla.current
    if (!m) return
    m.visible = activa
    if (!activa) return
    gotas.forEach((g, i) => {
      g.y -= g.v * dt
      if (g.y < 0) g.y = 14
      dummy.position.set(g.x - g.y * 0.08, g.y, g.z)
      dummy.rotation.set(0, 0, 0.08)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={malla} args={[null, null, N]} frustumCulled={false}>
      <boxGeometry args={[0.02, 0.9, 0.02]} />
      <meshBasicMaterial color="#9cc7ff" transparent opacity={0.55} toneMapped={false} />
    </instancedMesh>
  )
}
