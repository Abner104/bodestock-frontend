// src/config/functions.js
/**
 * URLs de Firebase Cloud Functions desplegadas
 */

const FIREBASE_REGION = 'us-central1';
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gestor-gastos-407c1';

export const FUNCTIONS_BASE_URL = `https://${FIREBASE_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;

const VPS_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.bodestock.cl';

export const FUNCTIONS_ENDPOINTS = {
  SET_CUSTOM_CLAIMS: `${FUNCTIONS_BASE_URL}/setCustomClaims`,
  LIST_USERS: `${FUNCTIONS_BASE_URL}/listUsers`,
  DELETE_USER: `${FUNCTIONS_BASE_URL}/deleteUser`,
  SEND_WELCOME_EMAIL: `${FUNCTIONS_BASE_URL}/sendWelcomeEmail`,
  SEND_PASSWORD_RESET: `${FUNCTIONS_BASE_URL}/sendPasswordReset`,
  SIMPLE_FACTURA_EMITIR: `${VPS_BASE_URL}/api/dte/emitir`,
  SIMPLE_FACTURA_PDF: `${VPS_BASE_URL}/api/dte/pdf`,
  SEND_REFERRAL_EMAIL: `${FUNCTIONS_BASE_URL}/sendReferralEmail`,
  REGISTER_COMPANY: `${FUNCTIONS_BASE_URL}/registerCompany`,
  UPDATE_USER_EMAIL: `${FUNCTIONS_BASE_URL}/updateUserEmail`,
  IMPERSONATE_USER: `${FUNCTIONS_BASE_URL}/impersonateUser`,
  SIMPLE_FACTURA_FOLIOS: `${VPS_BASE_URL}/api/dte/folios`,
  GET_DEEPGRAM_TOKEN: `${FUNCTIONS_BASE_URL}/getDeepgramToken`,
  SEARCH_NEARBY_BUSINESSES: `${FUNCTIONS_BASE_URL}/searchNearbyBusinesses`,
  GET_AI_RECOMMENDATION: `${FUNCTIONS_BASE_URL}/getAIRecommendation`,
  AGENT_CHAT: `${FUNCTIONS_BASE_URL}/agentChat`,
  CREATE_STORE_ORDER_PREFERENCE: `${FUNCTIONS_BASE_URL}/createStoreOrderPreference`,
  SAVE_MERCADOPAGO_TOKEN: `${FUNCTIONS_BASE_URL}/saveMercadoPagoToken`,
  ANALYZE_FACTURA_RECEIPT: `${FUNCTIONS_BASE_URL}/analyzeFacturaReceipt`,
  TEXT_TO_SPEECH: `${FUNCTIONS_BASE_URL}/textToSpeech`
};

/**
 * Helper para llamar a las functions con manejo de errores
 */
export async function callFunction(endpoint, method = 'POST', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Error en la función');
    }

    return data;
  } catch (error) {
    console.error('Error llamando a function:', error);
    throw error;
  }
}
