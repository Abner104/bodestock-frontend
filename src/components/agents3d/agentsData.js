// src/components/agents3d/agentsData.js
// Fuente única de verdad para Bodestock HQ (la vista 3D de la Sala de
// Agentes): quién existe, dónde vive su isla, y cómo se ve. Ningún
// componente de agents3d/ debe hardcodear posiciones o colores -- todo
// sale de acá, así agregar un agente nuevo es una entrada más en este
// archivo, no una modificación en media docena de componentes.
//
// Layout tipo "ciudad" (referencia: AI Office / Agents Office): cada
// agente es su propia isla/plataforma flotante en el suelo, conectada por
// una línea punteada a un núcleo central ("Bodestock HQ"). Reemplaza el
// modelo anterior de "edificio con pisos apilados" -- ese layout se sentía
// como un edificio de oficinas genérico; este se lee de un vistazo, como
// un mapa de departamentos.

/** Posición del núcleo central (donde convergen todas las líneas). */
export const CORE_POSITION = { x: 0, z: 0 };

// position: coordenadas ABSOLUTAS en el suelo (ya no relativas a un piso).
// islandRotationY: rotación de la plataforma en radianes, para que las 4
// no se vean todas alineadas igual (variación visual, como la referencia).
// theme: qué contenido dibuja la isla (ver islandThemes.js) -- "office"
// (el default, mobiliario + agente clickeable) o un tema decorativo como
// "forest" (sin lógica de agente, solo ambientación). Las islas
// decorativas no necesitan status/route/department -- son ambientación,
// no un puesto de trabajo.
export const AGENTS_3D = [
  {
    id: 'pricing',
    name: 'Agente de Precios',
    department: 'Gestión',
    role: 'Vigila márgenes y precios',
    status: 'available', // available | working | thinking | waiting | alert | offline
    color: '#34d399',
    position: { x: -5, z: -4.5 },
    islandRotationY: -0.12,
    theme: 'office',
    route: '/super-admin/agentes/precios',
  },
  {
    id: 'finance',
    name: 'Agente de Finanzas',
    department: 'Gestión',
    role: 'Flujo de caja y proyecciones',
    status: 'available', // ya es un producto real (/super-admin/agentes/finanzas) -- antes quedaba marcado "offline" solo en la vista 3D
    color: '#60a5fa',
    position: { x: 5, z: -4.5 },
    islandRotationY: 0.12,
    theme: 'office',
    route: '/super-admin/agentes/finanzas',
  },
  {
    id: 'inventory',
    name: 'Agente de Inventario',
    department: 'Operaciones',
    role: 'Qué reponer y cuándo',
    status: 'available',
    color: '#fb923c',
    position: { x: -5, z: 4.5 },
    islandRotationY: 0.12,
    theme: 'office',
    route: '/super-admin/agentes/inventario',
  },
  {
    id: 'marketing',
    name: 'Agente de Marketing',
    department: 'Crecimiento',
    role: 'Qué promocionar y a quién',
    status: 'available',
    color: '#c084fc',
    position: { x: 5, z: 4.5 },
    islandRotationY: -0.12,
    theme: 'office',
    route: '/super-admin/agentes/marketing',
  },
];

/** Metadata visual por estado -- un solo lugar para cambiar qué significa cada uno. */
export const STATUS_META = {
  available: { label: 'Disponible', dot: '#34d399', pulse: true },
  working: { label: 'Analizando', dot: '#34d399', pulse: true },
  thinking: { label: 'Pensando', dot: '#60a5fa', pulse: true },
  waiting: { label: 'En espera', dot: '#9297a3', pulse: false },
  alert: { label: 'Alerta', dot: '#ef4444', pulse: true },
  offline: { label: 'Próximamente', dot: '#565b66', pulse: false },
};

/**
 * Posición mundial del escritorio de un agente -- la usa CameraRig para
 * saber hacia dónde animar al hacer clic. Con islas ya no hay que sumar
 * altura de piso (todas están a nivel del suelo), pero se mantiene esta
 * función para no tener que tocar CameraRig al cambiar de modelo de datos.
 */
export function getAgentWorldPosition(agent) {
  return [agent.position.x, 0.9, agent.position.z];
}
