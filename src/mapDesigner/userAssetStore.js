// src/mapDesigner/userAssetStore.js
// Sprites que el propio usuario sube (sus kits de Kenney, el spritesheet de
// oficina, etc.) -- se guardan en IndexedDB de este navegador, no en el
// catálogo de código (assetCatalog.js), porque son archivos binarios
// potencialmente grandes y personales al que está editando, no algo que
// deba viajar en el bundle de la app para todos los usuarios.
//
// Un asset subido se comporta exactamente como uno del catálogo base una
// vez agregado: mismo shape de objeto ({id, category, name, color, shape,
// emoji, width, height}), más "src" con una URL de blob local que
// EditorCanvas usa para dibujar la imagen real en vez del placeholder de
// formas. Ese "src" es solo un puntero de esta sesión de navegador -- no
// es parte de lo que se exporta al JSON del mapa (ver mapModel.js: los
// objetos del mapa guardan "asset": "<id>", y quien reabra ese JSON debe
// tener el mismo sprite subido en su propio navegador para verlo).
import { CATEGORIES } from './assetCatalog';

const DB_NAME = 'bodestock-map-designer';
const DB_VERSION = 1;
const STORE = 'user-sprites';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

let idCounter = 0;
function nextId(category) {
  idCounter += 1;
  return `user-${category}-${Date.now().toString(36)}-${idCounter}`;
}

// Guarda un PNG/JPG subido por el usuario como un asset nuevo del catálogo
// "de usuario", dentro de la categoría elegida. dataUrl (no Blob) porque
// IndexedDB structured-clone soporta strings sin fricción y así el mismo
// valor sirve directo como src de <img>/Konva.Image sin volver a leerlo.
export async function saveUserAsset({ file, category, name }) {
  const dataUrl = await fileToDataUrl(file);
  const dims = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 64, height: 64 });
    img.src = dataUrl;
  });
  // El mundo trabaja con proporciones cómodas de editar (no el pixel size
  // real del PNG, que puede ser gigante) -- se limita el lado mayor a 96
  // world units y se escala el otro lado en proporción.
  const maxSide = 96;
  const scale = Math.min(1, maxSide / Math.max(dims.width, dims.height));
  const asset = {
    id: nextId(category),
    category,
    name: name || file.name.replace(/\.[^.]+$/, ''),
    color: '#9aa5b8',
    shape: 'sprite',
    emoji: '',
    width: Math.round(dims.width * scale) || 48,
    height: Math.round(dims.height * scale) || 48,
    src: dataUrl,
    isUserAsset: true,
  };
  await withStore('readwrite', (store) => store.put(asset));
  return asset;
}

export async function listUserAssets() {
  try {
    return await withStore('readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  } catch (e) {
    console.error('No se pudieron cargar los sprites subidos:', e.message);
    return [];
  }
}

export async function deleteUserAsset(id) {
  await withStore('readwrite', (store) => store.delete(id));
}

export function isValidCategory(categoryId) {
  return CATEGORIES.some((c) => c.id === categoryId);
}
