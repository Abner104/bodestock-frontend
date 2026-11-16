// src/config/gasto-tipos.js
/**
 * Tipos de gasto operativo compartidos entre:
 * - SuperAdminGestion.jsx (carga manual del consultor)
 * - MiConsultor.jsx (carga manual del cliente)
 * - accountingAgent.js lee el campo `tipo` de companies/{id}/gestion_gastos,
 *   que debe ser uno de los `id` definidos acá.
 */
export const GASTO_TIPOS = [
  { id: 'arriendo', label: 'Arriendo', icon: '🏪' },
  { id: 'sueldos', label: 'Sueldos', icon: '👷' },
  { id: 'imposiciones', label: 'Imposiciones (AFP/Salud)', icon: '🏥' },
  { id: 'servicios', label: 'Servicios (luz/agua/internet)', icon: '💡' },
  { id: 'transporte', label: 'Transporte', icon: '🚗' },
  { id: 'credito_bancario', label: 'Crédito bancario', icon: '🏦' },
  { id: 'software', label: 'Software/Suscripciones', icon: '💻' },
  { id: 'honorarios', label: 'Honorarios', icon: '📊' },
  { id: 'impuestos', label: 'Impuestos/Tributario', icon: '🏛️' },
  { id: 'comision_vendedor', label: 'Comisión vendedor', icon: '🤝' },
  { id: 'otro', label: 'Otro', icon: '📋' },
];
