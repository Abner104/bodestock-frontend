// src/mapDesigner/mapModel.js
// Modelo de datos del mapa -- versión serializable, pensada desde el
// principio para que un futuro renderer de Phaser pueda leerla tal cual
// (mismo x/y/scale/rotation "world space" que Phaser usa, sin nada
// específico de React/Konva mezclado adentro). El editor (Konva) es sólo
// una vista sobre este modelo, no la fuente de verdad.

import { getAsset, getDefaultLayer } from './assetCatalog';

export const MAP_MODEL_VERSION = 1;

export const DEVICE_PRESETS = {
  desktop: { label: 'Escritorio', width: 1920, height: 1080 },
  tablet:  { label: 'Tablet',     width: 768,  height: 1024 },
  mobile:  { label: 'Celular',    width: 390,  height: 844 },
};

export function createEmptyWorld() {
  return {
    version: MAP_MODEL_VERSION,
    world: {
      width: 3000,
      height: 2000,
      orientation: 'top-down',
    },
    viewport: {
      // Cámara guardada junto con el mapa -- al reabrir/importar, el editor
      // arranca centrado donde quedó, no siempre en (0,0).
      x: 1500,
      y: 1000,
      zoom: 1,
    },
    objects: [],
    metadata: {
      name: 'Untitled map',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

let idCounter = 0;
function nextId(assetId) {
  idCounter += 1;
  return `${assetId}-${Date.now().toString(36)}-${idCounter}`;
}

// Crea un objeto de mapa a partir de un asset del catálogo + una posición
// en coordenadas del MUNDO (no de pantalla -- eso lo resuelve EditorCanvas
// antes de llamar a esto, convirtiendo con la cámara actual).
export function createMapObject(assetId, x, y, overrides = {}) {
  const asset = getAsset(assetId);
  if (!asset) throw new Error(`Unknown asset: ${assetId}`);
  return {
    id: nextId(assetId),
    type: asset.category === 'agents' ? 'agent' : asset.category === 'roads' ? 'road' : 'object',
    asset: assetId,
    name: asset.name,
    x,
    y,
    width: asset.width,
    height: asset.height,
    scale: 1,
    rotation: 0,
    layer: getDefaultLayer(asset.category),
    zIndex: 0,
    visible: true,
    locked: false,
    ...overrides,
  };
}

export function snapToGrid(value, gridSize) {
  if (!gridSize) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function serializeMap(state) {
  const payload = {
    version: MAP_MODEL_VERSION,
    world: state.world,
    viewport: state.viewport,
    objects: state.objects,
    metadata: {
      ...state.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(payload, null, 2);
}

export function deserializeMap(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || typeof data !== 'object') throw new Error('Invalid map file');
  if (!Array.isArray(data.objects)) throw new Error('Map file has no objects array');
  // Defaults defensivos -- un JSON de una versión futura/parcial no debe
  // tirar la app entera, solo perder los campos que no reconoce.
  return {
    version: data.version || MAP_MODEL_VERSION,
    world: { width: 3000, height: 2000, orientation: 'top-down', ...data.world },
    viewport: { x: 1500, y: 1000, zoom: 1, ...data.viewport },
    objects: data.objects.map((o) => ({
      id: o.id || nextId(o.asset || 'object'),
      type: o.type || 'object',
      asset: o.asset,
      name: o.name || o.asset || 'Object',
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width ?? 64,
      height: o.height ?? 64,
      scale: o.scale ?? 1,
      rotation: o.rotation ?? 0,
      layer: o.layer || 'objects',
      zIndex: o.zIndex ?? 0,
      visible: o.visible ?? true,
      locked: o.locked ?? false,
    })),
    metadata: { name: 'Untitled map', ...data.metadata },
  };
}

export function downloadJson(filename, jsonString) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
