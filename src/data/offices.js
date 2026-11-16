// src/data/offices.js
// Zonas clickeables invisibles sobre el edificio del FONDO donde "vive"
// cada agente en el dibujo -- el edificio en sí es parte del SVG fijo (no
// tiene ids/estructura propia, ver bodestock-city.svg), así que esto no
// dibuja nada: es solo un área sensible al click posicionada encima del
// edificio real, que dispara la misma info que clickear el agente
// (agentId la vincula a agents.js). Mismas coordenadas normalizadas (0..1)
// que agents.js.
//
// Posiciones ajustadas a mano en modo "Editar" de Bodestock World, calzadas
// sobre el edificio real de cada agente en el dibujo.
export const offices = [
  { id: 'office-pricing', agentId: 'pricing', x: 0.483, y: 0.397, width: 0.09, height: 0.09 },
  { id: 'office-inventory', agentId: 'inventory', x: 0.704, y: 0.179, width: 0.09, height: 0.09 },
  { id: 'office-finance', agentId: 'finance', x: 0.256, y: 0.609, width: 0.09, height: 0.09 },
  { id: 'office-marketing', agentId: 'marketing', x: 0.793, y: 0.636, width: 0.09, height: 0.09 },
];
