// src/mapDesigner/assetCatalog.js
// Catálogo de assets del Map Designer. Cada entrada describe un tipo de
// objeto que se puede arrastrar al mundo -- ninguna pieza de UI (sidebar,
// canvas placeholder, panel de propiedades) hardcodea un edificio o agente
// puntual, todos leen de acá. Agregar un asset nuevo es agregar una entrada
// a CATALOG, no tocar un componente.
//
// "src" queda vacío por ahora (Fase 1 no tiene arte final todavía, ver
// conversación sobre PIXI/sprites) -- EditorCanvas dibuja un placeholder de
// Konva (forma + color + emoji) cuando no hay src, y ya queda preparado
// para servir un sprite real el día que exista sin tocar el modelo de datos.

export const CATEGORIES = [
  { id: 'buildings',   label: 'Edificios' },
  { id: 'agents',      label: 'Agentes' },
  { id: 'roads',       label: 'Caminos' },
  { id: 'nature',      label: 'Naturaleza' },
  { id: 'vehicles',    label: 'Vehículos' },
  { id: 'furniture',   label: 'Mobiliario' },
  { id: 'decorations', label: 'Decoración' },
  { id: 'special',     label: 'Especiales' },
];

// Capas por defecto, de atrás hacia adelante. Un objeto se crea en la capa
// por defecto de su categoría (ver DEFAULT_LAYER_BY_CATEGORY) pero puede
// reasignarse desde el panel de propiedades a cualquier otra.
export const LAYERS = [
  'background',
  'ground',
  'roads',
  'buildings',
  'agents',
  'objects',
  'decorations',
  'ui',
];

// Nombre en español para mostrar en la UI -- el id en inglés (LAYERS de
// arriba) es el que se guarda en el JSON exportado, así que nunca cambia.
export const LAYER_LABELS = {
  background: 'Fondo',
  ground: 'Suelo',
  roads: 'Caminos',
  buildings: 'Edificios',
  agents: 'Agentes',
  objects: 'Objetos',
  decorations: 'Decoración',
  ui: 'Interfaz',
};

const DEFAULT_LAYER_BY_CATEGORY = {
  buildings: 'buildings',
  agents: 'agents',
  roads: 'roads',
  nature: 'decorations',
  vehicles: 'objects',
  furniture: 'objects',
  decorations: 'decorations',
  special: 'objects',
};

// world units -- el tamaño "natural" con el que un asset se suelta en el
// mundo antes de que el usuario lo escale a mano.
const CATALOG = [
  // ---- Buildings ----
  { id: 'headquarters', category: 'buildings', name: 'Casa Matriz',    color: '#f2b84b', shape: 'building', emoji: '🏢', width: 220, height: 220 },
  { id: 'accounting',   category: 'buildings', name: 'Contabilidad',   color: '#6ee7c2', shape: 'building', emoji: '🧾', width: 160, height: 160 },
  { id: 'finance',      category: 'buildings', name: 'Finanzas',       color: '#7aa2f7', shape: 'building', emoji: '💰', width: 160, height: 160 },
  { id: 'sales',        category: 'buildings', name: 'Ventas',         color: '#f27a9e', shape: 'building', emoji: '📈', width: 160, height: 160 },
  { id: 'hr',           category: 'buildings', name: 'RRHH',           color: '#c792f2', shape: 'building', emoji: '👥', width: 160, height: 160 },
  { id: 'inventory-b',  category: 'buildings', name: 'Inventario',     color: '#f2924b', shape: 'building', emoji: '📦', width: 160, height: 160 },
  { id: 'bank',         category: 'buildings', name: 'Banco',          color: '#4bd1f2', shape: 'building', emoji: '🏦', width: 180, height: 180 },
  { id: 'warehouse',    category: 'buildings', name: 'Bodega',         color: '#9aa5b8', shape: 'building', emoji: '📦', width: 200, height: 160 },

  // Edificios con sprite real (Kenney "Tiny Battle", CC0, top-down puro --
  // calza con la cámara del mundo 3D, que ya no es isométrica) en vez del
  // placeholder geométrico. Un color por agente real, para "cada agente
  // tenga su propio edificio" -- pricing (verde), finanzas (azul),
  // inventario (rojo, más cercano a su naranja real que había en el
  // pack), y gris como genérico/sin asignar.
  { id: 'building-green',  category: 'buildings', name: 'Edificio Verde',  color: '#3fae5c', shape: 'sprite', emoji: '', width: 64, height: 64, src: '/models/tinybattle/building-green.png' },
  { id: 'building-blue',   category: 'buildings', name: 'Edificio Azul',   color: '#2fa8e8', shape: 'sprite', emoji: '', width: 64, height: 64, src: '/models/tinybattle/building-blue.png' },
  { id: 'building-red',    category: 'buildings', name: 'Edificio Rojo',   color: '#e0524a', shape: 'sprite', emoji: '', width: 64, height: 64, src: '/models/tinybattle/building-red.png' },
  { id: 'building-gray',   category: 'buildings', name: 'Edificio Gris',   color: '#8b93a6', shape: 'sprite', emoji: '', width: 64, height: 64, src: '/models/tinybattle/building-gray.png' },

  // Edificios generados a medida con Spriteship (IA, ver spriteship.com) --
  // uno por agente real, con el color exacto de cada uno (agentsData.js) y
  // detalle propio (ventilación de techo, entrada, etc.), no una plantilla
  // genérica de color como los de arriba. Tamaño natural mayor (96px vs
  // 64px) porque el detalle se pierde si se achican demasiado.
  { id: 'building-pricing',   category: 'buildings', name: 'Edificio Precios',    color: '#34d399', shape: 'sprite', emoji: '', width: 96, height: 96, src: '/models/spriteship/building-pricing.png' },
  { id: 'building-finance-sp', category: 'buildings', name: 'Edificio Finanzas',   color: '#60a5fa', shape: 'sprite', emoji: '', width: 96, height: 96, src: '/models/spriteship/building-finance.png' },
  { id: 'building-inventory-sp', category: 'buildings', name: 'Edificio Inventario', color: '#fb923c', shape: 'sprite', emoji: '', width: 96, height: 96, src: '/models/spriteship/building-inventory.png' },
  { id: 'building-marketing-sp', category: 'buildings', name: 'Edificio Marketing',  color: '#c084fc', shape: 'sprite', emoji: '', width: 96, height: 96, src: '/models/spriteship/building-marketing.png' },

  // ---- Agents ----
  // pricing-agent, finance-agent, inventory-agent y marketing-agent son los
  // 4 agentes reales de Bodestock -- ver mapDesignerBridge.js, que
  // reposiciona la isla 3D real de cada uno según dónde se mueva este ícono
  // acá. Tienen sprite real (avatar top-down generado con Spriteship, ver
  // spriteship.com) en vez del emoji genérico -- así se distinguen entre sí
  // y de los agentes placeholder (CEO/Contabilidad/Ventas/RRHH, sin agente
  // real asignado todavía) que siguen con el emoji robot.
  { id: 'ceo-agent',        category: 'agents', name: 'Agente CEO',         color: '#f2b84b', shape: 'agent', emoji: '🤖', width: 64, height: 64 },
  { id: 'accounting-agent', category: 'agents', name: 'Agente de Contabilidad', color: '#6ee7c2', shape: 'agent', emoji: '🤖', width: 64, height: 64 },
  { id: 'pricing-agent',    category: 'agents', name: 'Agente de Precios',     color: '#34d399', shape: 'sprite', emoji: '', width: 72, height: 72, src: '/models/spriteship/agent-pricing.png' },
  { id: 'finance-agent',    category: 'agents', name: 'Agente de Finanzas',    color: '#7aa2f7', shape: 'sprite', emoji: '', width: 72, height: 72, src: '/models/spriteship/agent-finance.png' },
  { id: 'sales-agent',      category: 'agents', name: 'Agente de Ventas',      color: '#f27a9e', shape: 'agent', emoji: '🤖', width: 64, height: 64 },
  { id: 'marketing-agent',  category: 'agents', name: 'Agente de Marketing',   color: '#c084fc', shape: 'sprite', emoji: '', width: 72, height: 72, src: '/models/spriteship/agent-marketing.png' },
  { id: 'hr-agent',         category: 'agents', name: 'Agente de RRHH',        color: '#c792f2', shape: 'agent', emoji: '🤖', width: 64, height: 64 },
  { id: 'inventory-agent',  category: 'agents', name: 'Agente de Inventario',  color: '#fb923c', shape: 'sprite', emoji: '', width: 72, height: 72, src: '/models/spriteship/agent-inventory.png' },

  // ---- Roads ----
  // road-v-tile usa un sprite real (Kenney "Tiny Battle", CC0) en vez del
  // placeholder geométrico -- se repite pegado contra otro igual (o
  // rotado 90° para el tramo horizontal) para armar calles largas, mismo
  // criterio que un tileset real en Tiled.
  { id: 'road-h',       category: 'roads', name: 'Camino horizontal', color: '#3a4258', shape: 'road-h',     emoji: '', width: 160, height: 48 },
  { id: 'road-v',       category: 'roads', name: 'Camino vertical',   color: '#3a4258', shape: 'road-v',     emoji: '', width: 48,  height: 160 },
  { id: 'road-x',       category: 'roads', name: 'Intersección',      color: '#3a4258', shape: 'road-x',     emoji: '', width: 96,  height: 96 },
  { id: 'road-corner',  category: 'roads', name: 'Esquina',           color: '#3a4258', shape: 'road-corner', emoji: '', width: 96, height: 96 },
  { id: 'road-tile',    category: 'roads', name: 'Calle (tile)',      color: '#5a6478', shape: 'sprite',     emoji: '', width: 64,  height: 64, src: '/models/tinybattle/road-v.png' },

  // ---- Nature ----
  { id: 'tree',   category: 'nature', name: 'Árbol',  color: '#3f9e5c', shape: 'circle', emoji: '🌳', width: 48, height: 48 },
  { id: 'bush',   category: 'nature', name: 'Arbusto', color: '#4caf6e', shape: 'circle', emoji: '🌿', width: 32, height: 32 },
  { id: 'grass',  category: 'nature', name: 'Pasto',   color: '#5fb87a', shape: 'rect',   emoji: '🌱', width: 40, height: 40 },
  { id: 'flower', category: 'nature', name: 'Flor',    color: '#e88ab0', shape: 'circle', emoji: '🌸', width: 24, height: 24 },

  // ---- Vehicles ----
  { id: 'car',      category: 'vehicles', name: 'Auto',              color: '#e3e8f4', shape: 'rect', emoji: '🚗', width: 56, height: 32 },
  { id: 'van',      category: 'vehicles', name: 'Camioneta de reparto', color: '#e3e8f4', shape: 'rect', emoji: '🚐', width: 68, height: 34 },
  { id: 'forklift', category: 'vehicles', name: 'Montacargas',       color: '#f2c94c', shape: 'rect', emoji: '🏗️', width: 44, height: 32 },

  // ---- Furniture ----
  { id: 'desk',     category: 'furniture', name: 'Escritorio', color: '#8a6a4a', shape: 'rect', emoji: '🖥️', width: 48, height: 32 },
  { id: 'chair',    category: 'furniture', name: 'Silla',      color: '#6a5a4a', shape: 'rect', emoji: '🪑', width: 24, height: 24 },
  { id: 'shelf',    category: 'furniture', name: 'Estantería', color: '#9a8a6a', shape: 'rect', emoji: '📚', width: 40, height: 24 },

  // ---- Decorations ----
  { id: 'lamp',     category: 'decorations', name: 'Lámpara',  color: '#f2e08a', shape: 'circle', emoji: '💡', width: 24, height: 24 },
  { id: 'sign',     category: 'decorations', name: 'Letrero',  color: '#e3e8f4', shape: 'rect',   emoji: '🪧', width: 32, height: 40 },
  { id: 'fountain', category: 'decorations', name: 'Fuente',   color: '#7ac9e8', shape: 'circle', emoji: '⛲', width: 56, height: 56 },

  // ---- Special ----
  { id: 'poi',       category: 'special', name: 'Punto de interacción', color: '#ff5a6a', shape: 'diamond', emoji: '📍', width: 32, height: 32 },
  { id: 'zone',      category: 'special', name: 'Marcador de zona',     color: '#ffffff', shape: 'zone',    emoji: '', width: 240, height: 240 },
  { id: 'spawn',     category: 'special', name: 'Punto de aparición',   color: '#6ee7c2', shape: 'diamond', emoji: '✨', width: 32, height: 32 },
];

export const ASSETS_BY_ID = CATALOG.reduce((acc, asset) => {
  acc[asset.id] = asset;
  return acc;
}, {});

// Assets subidos por el usuario (ver userAssetStore.js) -- viven en
// IndexedDB, que es async, pero getAsset/getAssetsByCategory se llaman en
// el camino síncrono de render de EditorCanvas/AssetSidebar. Se cargan una
// vez al montar el editor (registerUserAssets) y quedan cacheados acá en
// memoria; cualquier componente que necesite reaccionar a un asset nuevo
// (el propio AssetSidebar) escucha el evento 'map-designer:user-assets'.
let userAssetsById = {};

export function registerUserAssets(assets) {
  userAssetsById = assets.reduce((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});
  window.dispatchEvent(new CustomEvent('map-designer:user-assets'));
}

export function getAsset(assetId) {
  return ASSETS_BY_ID[assetId] || userAssetsById[assetId] || null;
}

export function getAssetsByCategory(categoryId) {
  const base = CATALOG.filter((a) => a.category === categoryId);
  const user = Object.values(userAssetsById).filter((a) => a.category === categoryId);
  return [...base, ...user];
}

export function getDefaultLayer(categoryId) {
  return DEFAULT_LAYER_BY_CATEGORY[categoryId] || 'objects';
}

export default CATALOG;
