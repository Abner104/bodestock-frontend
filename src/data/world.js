// src/data/world.js
// Configuración general del escenario de Bodestock World -- separado de
// agents.js porque esto describe el MUNDO (fondo, límites de cámara), no
// las entidades que viven sobre él.

export const WORLD_CONFIG = {
  background: '/assets/world/backgrounds/bodestock-city.svg',
  // Aspect ratio real de la imagen de fondo (ancho/alto) -- WorldBackground
  // lo usa para encajar la imagen sin deformarla sin importar el tamaño de
  // pantalla. Tomado del viewBox real del SVG (1024x585), no una
  // estimación -- si el archivo cambia, este valor debe actualizarse junto
  // con él.
  backgroundAspectRatio: 1024 / 585,
  camera: {
    minScale: 0.5,
    maxScale: 3,
    initialScale: 1,
  },
};
