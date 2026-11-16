// src/config/app-config.js
// Configuración de la aplicación para diferentes entornos

export const getAppConfig = () => {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  // Configuración para desarrollo local
  if (isLocal) {
    return {
      baseUrl: window.location.origin,
      environment: 'development'
    };
  }

  // Configuración para producción (Firebase Hosting)
  // Firebase Hosting siempre usa el dominio actual
  return {
    baseUrl: window.location.origin,
    environment: 'production'
  };
};

// Función para obtener la URL base correcta para los QR codes
export const getQRBaseUrl = () => {
  const config = getAppConfig();
  return config.baseUrl;
};