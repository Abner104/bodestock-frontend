// src/data/agents.js
// Agentes del prototipo de Bodestock World. x/y son coordenadas
// NORMALIZADAS (0..1) sobre el background, nunca píxeles -- así el mapa es
// responsive: WorldCanvas convierte a píxeles reales en cada render
// (x * canvasWidth, y * canvasHeight), no al guardar.
//
// role/status acá son solo el valor inicial del prototipo -- una vez
// conectado a datos reales, status debería reflejar el estado real del
// agente (ver src/agents/*.js: analyzeProductMargins, analyzeCashFlow, etc).

export const AGENT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  WORKING: 'WORKING',
  THINKING: 'THINKING',
  WAITING: 'WAITING',
  ALERT: 'ALERT',
  OFFLINE: 'OFFLINE',
};

// color: mismo acento de marca por agente que ya usaba el Map Designer/
// assetCatalog.js -- fuente única de verdad para que el tooltip, el halo
// de estado y cualquier otra UI del agente usen siempre el mismo tono.
// route: su página completa de tablas/gráficos (ya existía antes del mapa,
// ver App.jsx) -- la ficha del mapa enlaza ahí con "Ver panel completo".
export const agents = [
  {
    id: 'pricing',
    name: 'Precios',
    role: 'Optimización de precios',
    description: 'Reviso tus productos uno por uno: cuáles están en pérdida, cuáles dejan poca ganancia, y según qué tan rápido se venden, te sugiero un precio distinto y cuánto ganarías más si lo cambias. Vos decidís si aplicarlo.',
    image: '/assets/world/agents/pricing.png',
    color: '#34d399',
    // Sin página propia -- igual que Contabilidad, todo vive en el panel
    // del mapa ("Ver tareas"), incluidas las sugerencias de precio por
    // producto (ver ProductPricingSuggestions.jsx en SuperAdminAgentRoom.jsx).
    x: 0.485,
    y: 0.387,
    status: AGENT_STATUS.WORKING,
  },
  {
    id: 'inventory',
    name: 'Inventario',
    role: 'Control de stock',
    description: 'Reviso tu stock todos los días: qué productos ya se agotaron, cuáles están por acabarse, y cuánto te conviene reponer de cada uno según lo que vendiste este mes. También te aviso qué productos no rotan hace tiempo para que decidas liquidarlos.',
    image: '/assets/world/agents/inventory.png',
    color: '#fb923c',
    // Sin página propia -- igual que Precios y Contabilidad, todo vive en
    // el panel del mapa (ver InventorySuggestions.jsx en SuperAdminAgentRoom.jsx).
    x: 0.659,
    y: 0.252,
    status: AGENT_STATUS.THINKING,
  },
  {
    id: 'finance',
    name: 'Finanzas',
    role: 'Flujo de caja',
    description: 'Te muestro cuánto entra y cuánto sale de tu negocio cada mes, cuánto tienes fiado sin cobrar, y cuánto vale tu mercadería hoy. Si estás pensando en pedir un préstamo, te digo en cuántos meses lo recuperarías y cuánto necesitas vender para pagarlo.',
    image: '/assets/world/agents/finance.png',
    color: '#60a5fa',
    // Sin página propia -- igual que Precios/Inventario/Contabilidad, todo
    // vive en el panel del mapa (ver FinanceSuggestions.jsx en SuperAdminAgentRoom.jsx).
    x: 0.321,
    y: 0.619,
    status: AGENT_STATUS.AVAILABLE,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    role: 'Prospección y campañas',
    description: 'Busco negocios cerca de donde estás parado para ofrecerles tus productos, y te armo una lista de visitas que podés marcar a medida que las hacés. También te digo qué productos conviene promocionar según cuánto dejan de ganancia y cuánto se venden.',
    image: '/assets/world/agents/marketing.png',
    color: '#c084fc',
    // Sin página propia -- igual que Precios/Inventario/Finanzas/Contabilidad,
    // todo vive en el panel del mapa (ver MarketingSuggestions.jsx en
    // SuperAdminAgentRoom.jsx).
    x: 0.78,
    y: 0.6,
    status: AGENT_STATUS.WAITING,
  },
  {
    // Sin oficina/edificio dedicada todavía (a diferencia de los otros 4)
    // -- pedido explícito del usuario: "sin edificio bro solo el agente".
    // image: una variante ya generada y pagada del mismo lote de Marketing
    // (Spriteship siempre entrega 4 variantes por el precio de 1; las otras
    // 3 de cada agente nunca se usaron) -- mismo estilo top-down que el
    // resto, reusada en vez de gastar créditos nuevos en un diseño
    // específico de contabilidad.
    // route: sin página propia todavía -- ver el botón "Ver panel completo"
    // en AgentTooltip.jsx, que ya maneja route ausente sin romper nada.
    id: 'accounting',
    name: 'Contabilidad',
    role: 'Auditoría de facturas, fiado y sueldos',
    description: 'Reviso tus facturas, sueldos y gastos para avisarte si algo no cuadra, te estimo cuánto IVA te tocaría pagar este mes, y te armo un resumen y un libro de compra-venta para tu contador. No declaro ni envío nada al SII por mi cuenta — vos y tu contador siempre aprueban antes.',
    image: '/assets/world/agents/accounting.png',
    emoji: '🧾',
    color: '#eab308',
    x: 0.55,
    y: 0.78,
    status: AGENT_STATUS.AVAILABLE,
  },
];
