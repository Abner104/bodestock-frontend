import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, Html } from '@react-three/drei'
import * as THREE from 'three'

// Tamaño de la ciudad en unidades del mundo (medido en Blender, con margen).
// Con la cámara ortográfica, 1 unidad = `zoom` píxeles.
const ESCENA_W = 34
const ESCENA_H = 25
const DIR = new THREE.Vector3(1, 1, 1).normalize() // vista isométrica (igual que Blender)

// Intensidad de emisión [día, noche] por material (los materiales animados de Blender no viajan en el .glb).
const EMISION = [
  [/^glow/, 1.3, 3.4],
  [/^window$/, 0.7, 3.6],
  [/^(screen|p_screen)$/, 1.4, 3.2],
  [/^tubo_corriente$/, 2.5, 5],
  [/^esfera_cristal$/, 0.9, 2.2],
  [/^nucleo_energia$/, 1.2, 2.6],
  [/^logo_img$/, 0.7, 1.1],
]

// Corriente eléctrica dentro de los tubos: pulsos que corren por el eje + filamentos y chispas.
function crearMaterialElectrico() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main() {
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vP;
      uniform float uTime;
      uniform float uNight;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float ax = vP.y;                       // el cilindro se exporta con su eje en Y
        float a = atan(vP.z, vP.x);
        float flow = fract(ax * 0.9 - uTime * 1.2);
        float pulse = smoothstep(0.0, 0.15, flow) * smoothstep(1.0, 0.35, flow);
        float fil = smoothstep(0.62, 0.8, n(vec2(ax * 7.0 - uTime * 5.0, a * 2.0 + uTime * 1.5)));
        float arc = smoothstep(0.72, 0.92, n(vec2(ax * 13.0 + uTime * 7.0, a * 3.0)));
        float v = clamp(0.35 + pulse * 0.8 + fil * 1.2 + arc * 0.8, 0.0, 2.0);
        vec3 col = mix(vec3(0.0, 0.2, 1.0), vec3(0.7, 0.95, 1.0), clamp(v - 0.5, 0.0, 1.0));
        gl_FragColor = vec4(col * (1.2 + v * 1.5 + uNight * 1.5), 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

function buscarGrupo(obj, porGrupo) {
  let o = obj
  while (o) {
    if (porGrupo[o.name]) return o
    o = o.parent
  }
  return null
}

const lerp = (a, b, t) => a + (b - a) * t

// Mismo lenguaje de color que StatusBadge en el mapa 2D (AgentSprite.jsx) --
// un punto de estado al lado del nombre, para que se note sin abrir el
// panel cuál agente necesita atención ahora mismo.
const STATUS_COLOR = {
  ALERT: '#f87171',
  THINKING: '#a78bfa',
  WORKING: '#34d399',
  WAITING: '#f2b84b',
  AVAILABLE: '#60a5fa',
  OFFLINE: '#71717a',
}

// Aro rojo pulsante en el piso del edificio -- se ve desde la vista
// general de la ciudad, sin acercarse ni leer el chip, cuando un agente
// tiene una alerta real (mismo lenguaje de "glow" que ya usan los tubos de
// energía y el núcleo de Bodestock HQ, no un elemento de UI ajeno al mundo).
function HaloAlerta({ position }) {
  const ref = useRef(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const s = 1 + Math.sin(t * 2.2) * 0.12
    ref.current.scale.set(s, s, s)
    ref.current.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.2
  })
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.35, 1.75, 48]} />
      <meshBasicMaterial color="#f87171" transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

export default function Ciudad({ night, nv, selected, onSelect, sheet, porGrupo, unreadByAgent = {}, agentRealData = {} }) {
  const { scene, animations } = useGLTF('/bodestock_ciudad.glb')
  const { actions } = useAnimations(animations, scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const bgColor = useMemo(() => new THREE.Color(), [])

  const luzAmb = useRef()
  const luzSol = useRef()
  const luzHemi = useRef()
  const hover = useRef(null)

  // Las etiquetas <Html> (una por agente) montan 5 portales de React a la
  // vez, EXACTAMENTE en el frame en que Suspense resuelve (useGLTF termina
  // de cargar) -- en React 19 + drei esto puede perder uno de esos
  // portales por una condición de carrera real (confirmado: el array de
  // datos llega completo a React, pero document.querySelectorAll('.etiqueta')
  // devolvía 4 en vez de 5). Retrasar su montaje un frame, separado del
  // momento exacto en que Suspense resuelve, evita la carrera.
  const [etiquetasListas, setEtiquetasListas] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEtiquetasListas(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const rig = useRef({ target: new THREE.Vector3(0, 1, 0), zoom: 20, offX: 0, offY: 0 })

  // ---- preparar la escena una sola vez
  const prep = useMemo(() => {
    const emisivos = []
    const vistos = new Set()
    const electrico = crearMaterialElectrico()
    const grupos = {}
    const personajes = []
    let suelo = null
    scene.traverse((o) => {
      if (o.isCamera) o.visible = false
      if (porGrupo[o.name]) grupos[o.name] = { obj: o, y0: o.position.y, pos: new THREE.Vector3() }
      if (o.name.startsWith('Personaje_')) personajes.push({ obj: o, y0: o.position.y, fase: Math.random() * 6 })
      if (!o.isMesh) return
      const nombre = o.name
      // El culling automático de Three.js por bounding sphere puede fallar
      // con mallas chicas muy desplazadas de su pivote local (como las
      // piezas de un edificio parenteado a un Empty lejos del origen) y
      // descartarlas por error aunque sí estén dentro de cámara -- se vio
      // con el edificio de Contabilidad completo desaparecido pese a tener
      // su geometría intacta en el .glb (paredes, techo, ventanas, todo
      // presente y bien ubicado). Desactivarlo cuesta nada en una escena
      // de este tamaño y elimina la clase entera de bug.
      o.frustumCulled = false
      o.castShadow = !/^(Suelo|Cesped|nube|tubo_vidrio|HQ_esfera|HQ_Logo)/.test(nombre)
      o.receiveShadow = true
      if (nombre.startsWith('tubo_nucleo')) {
        o.material = electrico
        o.castShadow = false
        return
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach((m) => {
        if (vistos.has(m)) return
        vistos.add(m)
        const mn = m.name || ''
        for (const [re, d, nn] of EMISION) {
          if (re.test(mn)) {
            if (mn === 'logo_img' && m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(1, 1, 1) }
            emisivos.push([m, d, nn])
            break
          }
        }
        if (mn === 'tubo_vidrio') { m.transparent = true; m.opacity = 0.22; m.depthWrite = false; m.side = THREE.DoubleSide; m.roughness = 0.1 }
        if (mn === 'esfera_cristal' || mn === 'nucleo_energia') { m.transparent = true; m.depthWrite = false }
        if (mn === 'ground') suelo = { m, dia: m.color.clone(), noche: new THREE.Color(0.01, 0.02, 0.06) }
      })
    })
    scene.updateMatrixWorld(true)
    Object.values(grupos).forEach((g) => g.obj.getWorldPosition(g.pos))
    return { emisivos, electrico, grupos, personajes, suelo }
  }, [scene, porGrupo])

  useEffect(() => {
    Object.values(actions).forEach((a) => a && a.play())
  }, [actions])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    // ---- día / noche
    nv.current = THREE.MathUtils.clamp(nv.current + (night ? 1 : -1) * dt * 1.1, 0, 1)
    const n = nv.current * nv.current * (3 - 2 * nv.current)
    if (luzAmb.current) { luzAmb.current.intensity = lerp(0.5, 0.12, n); luzAmb.current.color.setRGB(lerp(1, 0.45, n), lerp(1, 0.55, n), 1) }
    if (luzHemi.current) luzHemi.current.intensity = lerp(0.85, 0.14, n)
    if (luzSol.current) { luzSol.current.intensity = lerp(1.5, 0.3, n); luzSol.current.color.setRGB(lerp(1, 0.45, n), lerp(0.96, 0.6, n), lerp(0.88, 1, n)) }
    state.scene.background = bgColor.setRGB(lerp(0.62, 0.01, n), lerp(0.72, 0.02, n), lerp(0.9, 0.06, n))
    prep.emisivos.forEach(([m, d, nn]) => { m.emissiveIntensity = lerp(d, nn, n) })
    prep.electrico.uniforms.uTime.value = t
    prep.electrico.uniforms.uNight.value = n
    if (prep.suelo) prep.suelo.m.color.copy(prep.suelo.dia).lerp(prep.suelo.noche, n)

    // ---- personajes respiran
    prep.personajes.forEach((p) => { p.obj.position.y = p.y0 + 0.012 * Math.abs(Math.sin(t * 1.9 + p.fase)) })

    // ---- los edificios se elevan al pasar el mouse / al seleccionarlos
    Object.entries(prep.grupos).forEach(([nombre, g]) => {
      const sel = porGrupo[nombre].id === selected
      const objetivo = g.y0 + (hover.current === nombre ? 0.22 : 0) + (sel ? 0.12 : 0)
      g.obj.position.y = lerp(g.obj.position.y, objetivo, 1 - Math.pow(0.001, dt))
    })

    // ---- cámara isométrica adaptativa (móvil / tablet / escritorio)
    const r = rig.current
    // en móvil vertical se ajusta al ancho de los edificios (sin el margen de árboles y nubes)
    const base = Math.min(size.width / (sheet ? 27 : ESCENA_W), size.height / ESCENA_H)
    let objetivoPos = new THREE.Vector3(0, 1, 0)
    let objetivoZoom = base
    let offX = 0
    // Margen fijo arriba para que ningún chip de agente (sobre todo
    // Finanzas y Bodestock, los más altos del mapa) quede tapado detrás de
    // la barra superior (logo, selector de empresa, Día/Lluvia) -- esa
    // barra vive en el DOM con su propio fondo, no en el mundo 3D, así que
    // la cámara reserva este aire en vez de depender de z-index.
    let offY = -size.height * (sheet ? 0.1 : 0.07)
    if (sheet) offY += size.height * 0.03
    const gSel = selected && Object.entries(prep.grupos).find(([nombre]) => porGrupo[nombre].id === selected)
    if (gSel) {
      objetivoPos = gSel[1].pos.clone().add(new THREE.Vector3(0, selected === 'bodestock' ? 3 : 1.2, 0))
      objetivoZoom = base * (sheet ? 1.7 : 1.9)
      if (sheet) offY = size.height * 0.2
      else offX = Math.min(440, size.width * 0.42) / 2
    }
    const k = 1 - Math.pow(0.002, dt)
    r.target.lerp(objetivoPos, k)
    r.zoom = lerp(r.zoom, objetivoZoom, k)
    r.offX = lerp(r.offX, offX, k)
    r.offY = lerp(r.offY, offY, k)
    camera.position.copy(r.target).addScaledVector(DIR, 80)
    camera.lookAt(r.target)
    camera.zoom = r.zoom
    camera.setViewOffset(size.width, size.height, r.offX, r.offY, size.width, size.height)
    camera.updateProjectionMatrix()
  })

  const etiquetas = useMemo(
    // Bodestock HQ no lleva chip -- ya tiene su logo dentro de la esfera
    // central del edificio, repetir el nombre arriba es redundante.
    () => Object.entries(prep.grupos)
      .filter(([nombre]) => porGrupo[nombre]?.id !== 'bodestock')
      .map(([nombre, g]) => ({ nombre, ag: porGrupo[nombre], pos: g.pos.clone() })),
    [prep, porGrupo],
  )

  return (
    <>
      <ambientLight ref={luzAmb} />
      <hemisphereLight ref={luzHemi} args={['#cfe2ff', '#d8e6c8', 0.9]} />
      <directionalLight
        ref={luzSol}
        position={[18, 30, 12]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0005}
      />
      <primitive
        object={scene}
        onPointerOver={(e) => {
          const g = buscarGrupo(e.object, porGrupo)
          if (g) { e.stopPropagation(); hover.current = g.name; document.body.style.cursor = 'pointer' }
        }}
        onPointerOut={() => { hover.current = null; document.body.style.cursor = 'auto' }}
        onClick={(e) => {
          e.stopPropagation()
          const g = buscarGrupo(e.object, porGrupo)
          onSelect(g ? porGrupo[g.name].id : null)
        }}
      />
      {etiquetasListas && etiquetas.map(({ nombre, ag, pos }) => {
        const unread = unreadByAgent[ag.id] || 0
        const status = agentRealData[ag.id]?.status
        const statusColor = STATUS_COLOR[status]
        return (
          <group key={nombre}>
            {status === 'ALERT' && <HaloAlerta position={[pos.x, pos.y + 0.05, pos.z]} />}
            <Html position={[pos.x, ag.id === 'bodestock' ? 8 : 5.2, pos.z]} center zIndexRange={[20, 0]}>
              <button
                className={'etiqueta' + (selected === ag.id ? ' activa' : '')}
                style={{ '--c': ag.color }}
                onClick={() => onSelect(selected === ag.id ? null : ag.id)}
                title={agentRealData[ag.id]?.summary}
              >
                {statusColor && <span className={'etiqueta-estado' + (status === 'ALERT' ? ' alerta' : '')} style={{ '--s': statusColor }} />}
                {ag.nombre}
                {unread > 0 && <span className="etiqueta-badge">{unread > 9 ? '9+' : unread}</span>}
              </button>
            </Html>
          </group>
        )
      })}
    </>
  )
}

useGLTF.preload('/bodestock_ciudad.glb')
