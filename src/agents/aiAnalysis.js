// src/agents/aiAnalysis.js
// Helper compartido: le pide a Claude (vía la Cloud Function getAIRecommendation)
// que interprete datos YA calculados por un agente y dé una recomendación en
// lenguaje natural. Nunca manda datos crudos de Firestore — solo los números
// que el agente correspondiente ya procesó.

import { auth } from '../firebase/firebase';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';

/**
 * @param {object} params
 * @param {string} params.systemPrompt - rol/tono que debe asumir Claude
 * @param {string} params.userPrompt - los datos + la pregunta concreta
 * @returns {Promise<string>} texto de la recomendación
 */
export async function getAIRecommendation({ systemPrompt, userPrompt }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para usar el análisis con IA.');

  const idToken = await user.getIdToken();
  const response = await fetch(FUNCTIONS_ENDPOINTS.GET_AI_RECOMMENDATION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ systemPrompt, userPrompt })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar el análisis con IA.');
  }
  return data.text;
}
