// src/agents/agentChat.js
// Helper cliente para el chat con UN agente específico del mapa de
// Bodestock World (pricing/inventory/finance/marketing/accounting) --
// llama a la Cloud Function agentChat (functions/index.js), que arma el
// contexto real de ese agente del lado servidor y responde con Claude.
// Mismo patrón que aiAnalysis.js (getAIRecommendation).
import { auth } from '../firebase/firebase';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';

/**
 * @param {object} params
 * @param {string} params.agentId - 'pricing' | 'inventory' | 'finance' | 'marketing' | 'accounting'
 * @param {string} params.companyId
 * @param {string} params.message
 * @param {Array<{role: 'user'|'assistant', content: string}>} [params.history]
 * @returns {Promise<string>} respuesta del agente
 */
export async function chatWithAgent({ agentId, companyId, message, history = [] }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para hablar con el agente.');

  const idToken = await user.getIdToken();
  const response = await fetch(FUNCTIONS_ENDPOINTS.AGENT_CHAT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ agentId, companyId, message, history }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo obtener respuesta del agente.');
  }
  return data.text;
}
