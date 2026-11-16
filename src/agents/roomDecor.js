// src/agents/roomDecor.js
// Decoración arrastrable de cada oficina en la Sala de Agentes: el Super
// Admin sube imágenes (SVG/PNG) sueltas -- cajas, plantas, muebles -- y las
// posiciona con drag/resize sobre el mapa. Un documento por agente en la
// colección raíz room_decor/{agentId}, con una lista de objetos. No vive
// bajo companies/{companyId} porque la Sala no pertenece a ninguna empresa
// cliente -- es la vista propia del consultor (Super Admin).

import { db, storage } from '../firebase/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const ROOM_DOC_PATH = 'room_decor';

/**
 * Trae la decoración guardada para un agente (oficina): los objetos sueltos
 * (cajas, plantas), la textura de piso, y dónde quedó el botón de "tareas
 * de hoy" (null = usa la posición por defecto de OFFICE_LAYOUT).
 * @param {string} agentId - 'pricing' | 'finance' | 'inventory' | 'marketing'
 * @returns {Promise<{items: Array<{id, url, x, y, width, height, rotation}>, floorUrl: string|null, taskButtonPos: {x,y}|null}>}
 */
export async function fetchRoomDecor(agentId) {
  if (!agentId) return { items: [], floorUrl: null, taskButtonPos: null };
  const snap = await getDoc(doc(db, ROOM_DOC_PATH, agentId));
  if (!snap.exists()) return { items: [], floorUrl: null, taskButtonPos: null };
  const data = snap.data();
  return { items: data.items || [], floorUrl: data.floorUrl || null, taskButtonPos: data.taskButtonPos || null };
}

/**
 * Guarda el estado completo de una oficina (reemplaza el documento entero
 * -- la lista de objetos siempre es corta, y piso/botón son un par de
 * campos, así que no vale la pena una subcolección con doc por ítem).
 * @param {string} agentId
 * @param {{items: Array, floorUrl?: string|null, taskButtonPos?: {x,y}|null}} state
 */
export async function saveRoomDecor(agentId, state) {
  if (!agentId) return;
  await setDoc(doc(db, ROOM_DOC_PATH, agentId), {
    items: state.items || [],
    floorUrl: state.floorUrl ?? null,
    taskButtonPos: state.taskButtonPos ?? null,
    updatedAt: serverTimestamp()
  });
}

/**
 * Sube un archivo de imagen (SVG/PNG) a Storage bajo room-decor/{agentId}/
 * y devuelve su URL pública de descarga.
 * @param {string} agentId
 * @param {File} file
 * @returns {Promise<string>} downloadURL
 */
export async function uploadRoomDecorAsset(agentId, file) {
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const fileRef = ref(storage, `room-decor/${agentId}/${safeName}`);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

/**
 * Borra un archivo de Storage por su URL de descarga (best-effort: si ya no
 * existe o la URL no es de este bucket, no revienta el flujo de borrado).
 * @param {string} url
 */
export async function deleteRoomDecorAsset(url) {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (e) {
    console.warn('No se pudo borrar el asset de Storage (puede que ya no exista):', e.message);
  }
}

/** Crea un objeto decorativo nuevo con valores por defecto razonables. */
export function createDecorItem(url) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    x: 150,
    y: 150,
    width: 60,
    height: 60,
    rotation: 0
  };
}
