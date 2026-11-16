// src/utils/logger.js
/**
 * Sistema de logging centralizado que solo muestra logs en desarrollo
 * En producción, los logs son silenciados a menos que DEBUG_MODE esté activado
 */

import { DEBUG_MODE, APP_ENV } from '../config/env';

const isDevelopment = APP_ENV === 'development' || import.meta.env.DEV;
const isDebugEnabled = DEBUG_MODE || isDevelopment;

/**
 * Logger personalizado que respeta el entorno de ejecución
 */
export const logger = {
  log: (...args) => {
    if (isDebugEnabled) {
      console.log(...args);
    }
  },

  info: (...args) => {
    if (isDebugEnabled) {
      console.info(...args);
    }
  },

  warn: (...args) => {
    // Warnings siempre se muestran
    console.warn(...args);
  },

  error: (...args) => {
    // Errors siempre se muestran
    console.error(...args);
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  table: (...args) => {
    if (isDebugEnabled) {
      console.table(...args);
    }
  },

  group: (label) => {
    if (isDebugEnabled) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDebugEnabled) {
      console.groupEnd();
    }
  },
};

/**
 * Deshabilitar todos los console.log en producción
 * Esta función se ejecuta automáticamente al importar el módulo
 */
export const disableConsoleLogs = () => {
  if (!isDebugEnabled) {
    // Guardar referencias originales
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    // Sobrescribir métodos
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};

    // Guardar originales en objeto para debugging manual si es necesario
    console._original = {
      log: originalLog,
      info: originalInfo,
      debug: originalDebug,
    };
  }
};

// Auto-ejecutar al importar el módulo
if (!isDevelopment && !DEBUG_MODE) {
  disableConsoleLogs();
}

export default logger;
