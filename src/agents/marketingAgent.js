// src/agents/marketingAgent.js
// Agente de Marketing: encuentra negocios cercanos (minimarkets, almacenes)
// para prospección de clientes nuevos, vía Google Places API (New).
// La API key vive solo en el servidor (functions/index.js:searchNearbyBusinesses),
// nunca en el frontend.

import { db, auth } from '../firebase/firebase';
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import { getAIRecommendation } from './aiAnalysis';

export const PROSPECT_STATUS = {
  NEW: 'NEW',               // recién encontrado, sin gestionar
  TO_VISIT: 'TO_VISIT',     // marcado para visitar
  VISITED: 'VISITED',       // ya se visitó
  INTERESTED: 'INTERESTED', // mostró interés
  CLIENT: 'CLIENT',         // se convirtió en cliente
  NOT_INTERESTED: 'NOT_INTERESTED'
};

const BUSINESS_TYPE_OPTIONS = [
  { value: 'convenience_store', label: 'Almacén / minimarket' },
  { value: 'grocery_store', label: 'Abarrotería' },
  // En Chile Google clasifica casi todas las cadenas grandes (Líder, Jumbo,
  // Tottus...) bajo "supermarket" — marcarlo tiende a ahogar los resultados
  // independientes aunque se filtren cadenas conocidas después.
  { value: 'supermarket', label: 'Supermercado', warning: 'Suele traer sobre todo cadenas grandes en Chile' },
  { value: 'liquor_store', label: 'Botillería' }
];

export function getBusinessTypeOptions() {
  return BUSINESS_TYPE_OPTIONS;
}

/**
 * Busca negocios cercanos vía la Cloud Function (que a su vez llama a
 * Google Places API con la key protegida server-side).
 * @param {object} params
 * @param {string} [params.locationText] - comuna o dirección en texto
 * @param {number} [params.latitude] - coordenada, si ya se tiene (ej. GPS)
 * @param {number} [params.longitude]
 * @param {number} [params.radiusMeters]
 * @param {string[]} [params.businessTypes]
 * @param {boolean} [params.excludeChains] - default true: descarta cadenas
 *   grandes (Jumbo, Líder, etc.) porque no son clientes típicos de una
 *   distribuidora chica.
 */
export async function searchNearbyBusinesses({ locationText, latitude, longitude, radiusMeters, businessTypes, excludeChains } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para buscar negocios.');

  const idToken = await user.getIdToken();
  const response = await fetch(FUNCTIONS_ENDPOINTS.SEARCH_NEARBY_BUSINESSES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      locationText,
      latitude,
      longitude,
      radiusMeters,
      includedTypes: businessTypes,
      excludeChains
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo buscar negocios cercanos.');
  }
  return data; // { places, resolvedLocation }
}

/**
 * Trae los prospectos ya guardados de la empresa (companies/{id}/prospects),
 * ordenados por fecha de creación descendente.
 */
export async function fetchSavedProspects(companyId) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) throw new Error('No se pudo identificar la empresa del usuario');

  const q = query(collection(db, `companies/${resolvedCompanyId}/prospects`), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Guarda un negocio encontrado como prospecto. Usa el `place.id` de Google
 * como id del documento para no duplicar si se busca la misma zona dos veces.
 */
export async function saveProspect(place, companyId) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) throw new Error('No se pudo identificar la empresa del usuario');

  const ref = doc(db, `companies/${resolvedCompanyId}/prospects/${place.id}`);
  await setDoc(ref, {
    name: place.name,
    address: place.address,
    phone: place.phone || null,
    rating: place.rating ?? null,
    ratingCount: place.ratingCount ?? 0,
    location: place.location || null,
    status: PROSPECT_STATUS.TO_VISIT,
    notes: '',
    lastVisitAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Guarda varios negocios encontrados de una sola vez -- usado por la
 * búsqueda automática en terreno (ver TerrenoProspeccion.jsx), para no
 * hacer N escrituras sueltas. Mismo criterio que saveProspect: usa
 * place.id como id del documento, así una zona ya buscada no duplica.
 * También etiqueta cada uno con el radio/zona en que se encontró, para
 * poder ampliar el radio en la siguiente tanda automática.
 */
export async function saveProspectsBatch(places, companyId, meta = {}) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) throw new Error('No se pudo identificar la empresa del usuario');
  if (!places?.length) return { saved: 0 };

  const batch = writeBatch(db);
  places.forEach((place) => {
    const ref = doc(db, `companies/${resolvedCompanyId}/prospects/${place.id}`);
    batch.set(ref, {
      name: place.name,
      address: place.address,
      phone: place.phone || null,
      rating: place.rating ?? null,
      ratingCount: place.ratingCount ?? 0,
      location: place.location || null,
      status: PROSPECT_STATUS.TO_VISIT,
      notes: '',
      lastVisitAt: null,
      foundBy: meta.foundBy || null,
      searchOrigin: meta.searchOrigin || null,
      radiusMeters: meta.radiusMeters || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
  return { saved: places.length };
}

/**
 * Marca "visitado ahora" — actualiza lastVisitAt al momento actual y,
 * si el prospecto seguía en TO_VISIT, lo pasa a VISITED.
 */
export async function markVisitedNow(prospectId, currentStatus, companyId) {
  const updates = { lastVisitAt: serverTimestamp() };
  if (currentStatus === PROSPECT_STATUS.TO_VISIT || currentStatus === PROSPECT_STATUS.NEW) {
    updates.status = PROSPECT_STATUS.VISITED;
  }
  await updateProspect(prospectId, updates, companyId);
}

/**
 * Actualiza el estado y/o notas de un prospecto ya guardado.
 */
export async function updateProspect(prospectId, updates, companyId) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) throw new Error('No se pudo identificar la empresa del usuario');

  const ref = doc(db, `companies/${resolvedCompanyId}/prospects/${prospectId}`);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

/**
 * Elimina un prospecto guardado.
 */
export async function deleteProspect(prospectId, companyId) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) throw new Error('No se pudo identificar la empresa del usuario');

  await deleteDoc(doc(db, `companies/${resolvedCompanyId}/prospects/${prospectId}`));
}

/**
 * Pide a la IA un análisis razonado del embudo de prospección, usando SOLO
 * el conteo de prospectos por estado (nunca datos crudos de Firestore).
 *
 * @param {object} prospectsSummary - conteo por estado, ej.
 *   { TO_VISIT: 5, VISITED: 3, INTERESTED: 2, CLIENT: 1, NOT_INTERESTED: 1, total: 12 }
 * @param {string} companyName
 */
export async function getMarketingAIAnalysis(prospectsSummary, companyName) {
  const {
    TO_VISIT = 0,
    VISITED = 0,
    INTERESTED = 0,
    CLIENT = 0,
    NOT_INTERESTED = 0,
    total = 0
  } = prospectsSummary || {};

  const userPrompt = `Analiza el embudo de prospección de "${companyName}", una distribuidora/almacén en Chile que busca nuevos negocios clientes (minimarkets, almacenes) para vender.

ESTADO ACTUAL DE LOS PROSPECTOS GUARDADOS (total: ${total}):
- Por visitar: ${TO_VISIT}
- Visitados: ${VISITED}
- Interesados: ${INTERESTED}
- Convertidos en clientes: ${CLIENT}
- No interesados: ${NOT_INTERESTED}

Da una evaluación breve (3-4 oraciones) en español de Chile, directa y accionable: opina si la tasa de conversión (de visitado a cliente) es saludable, qué etapa del embudo está estancada, y qué debería priorizar el equipo la próxima semana. No repitas los números tal cual — interprétalos.`;

  return getAIRecommendation({
    systemPrompt: 'Eres un consultor de negocios pragmático que asesora a pequeñas distribuidoras en Chile sobre cómo conseguir nuevos clientes. Hablas claro, sin jerga innecesaria, y siempre das una opinión concreta, no solo describes los datos.',
    userPrompt
  });
}
