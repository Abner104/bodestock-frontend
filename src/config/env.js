// src/config/env.js
/**
 * Configuración centralizada de variables de entorno
 * Todas las variables de entorno deben ser accedidas a través de este archivo
 */

// Firebase Configuration
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// OpenAI Configuration
export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Backend API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5188';

// Super Admin Configuration
export const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || '';

// MercadoPago Configuration
export const MERCADOPAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;

// Google Maps / Places Configuration (autocompletado de dirección en tienda online)
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// Application Settings
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
export const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === 'true';

// Domain Configuration
export const PRODUCTION_URL = 'https://bodestock.cl';
export const COMPANY_EMAIL = 'info@bodestock.cl';
export const SUPPORT_EMAIL = 'soporte@bodestock.cl';
export const SALES_EMAIL = 'ventas@bodestock.cl';

// Helper para validar configuración crítica
export const validateEnvConfig = () => {
  const errors = [];

  if (!FIREBASE_CONFIG.apiKey) {
    errors.push('VITE_FIREBASE_API_KEY is required');
  }
  if (!FIREBASE_CONFIG.projectId) {
    errors.push('VITE_FIREBASE_PROJECT_ID is required');
  }
  if (!SUPER_ADMIN_EMAIL) {
    errors.push('VITE_SUPER_ADMIN_EMAIL is required');
  }
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ VITE_OPENAI_API_KEY not set - AI Assistant will not work');
  }

  if (errors.length > 0) {
    console.error('❌ Missing required environment variables:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Missing required environment variables. Check .env file.');
  }

  if (DEBUG_MODE) {
    console.log('✅ Environment configuration validated');
  }
};
