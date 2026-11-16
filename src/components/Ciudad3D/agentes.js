// `grupo` es el nombre del grupo en el .glb exportado desde Blender.
// `id` usa los mismos identificadores canónicos que el mapa 2D real
// (pricing/inventory/finance/marketing/accounting, ver data/agents.js,
// agentChat.js) -- así AgentAlertsPanel y AgentChatPanel funcionan tal cual,
// sin ningún mapeo de traducción entre las dos vistas.
// Los `kpis` de cada agente parten vacíos y los llena cargarAgentesReales()
// con las mismas fuentes de datos que ya usa el mapa 2D real
// (SuperAdminAgentRoom.jsx) -- nunca se duplica el cálculo acá.
import { analyzeInventoryHealth } from '../../agents/inventoryAgent';
import { analyzeProductMargins } from '../../agents/pricingAgent';
import { analyzeCashFlow } from '../../agents/financeAgent';
import { auditAccounting, estimateMonthlyVAT } from '../../agents/accountingAgent';
import { fetchSavedProspects, PROSPECT_STATUS } from '../../agents/marketingAgent';

const money = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

export const AGENTES_BASE = [
  {
    id: 'inventory',
    grupo: 'Agente_Inventario',
    nombre: 'Inventario',
    color: '#2f7bff',
    frase: 'La bodega al día, sin quiebres de stock.',
    que: [
      'Controla stock por producto, lote y bodega.',
      'Alerta antes de que se agote un producto de alta rotación.',
      'Sugiere reposición según ventas y tiempos de entrega.',
    ],
  },
  {
    id: 'pricing',
    grupo: 'Agente_Precios',
    nombre: 'Precios',
    color: '#ffa012',
    frase: 'Cada producto con el precio y el margen correctos.',
    que: [
      'Mantiene las listas de precios por cliente y por volumen.',
      'Detecta productos sin margen o con costo desactualizado.',
      'Propone descuentos mayoristas por tramos.',
    ],
  },
  {
    id: 'finance',
    grupo: 'Agente_Finanzas',
    nombre: 'Finanzas',
    color: '#1ccc66',
    frase: 'Cobranza ordenada y caja bajo control.',
    que: [
      'Sigue las cuentas por cobrar y la mora de cada cliente.',
      'Proyecta el flujo de caja de las próximas semanas.',
      'Avisa de pagos a proveedores que vencen pronto.',
    ],
  },
  {
    id: 'accounting',
    grupo: 'Agente_Contabilidad',
    nombre: 'Contabilidad',
    color: '#9a4dff',
    frase: 'Facturas, impuestos y órdenes de compra sin papeleo.',
    que: [
      'Emite y concilia facturas de venta y de compra.',
      'Calcula el IVA y deja listos los cierres del mes.',
      'Cruza las órdenes de compra con lo que realmente llegó.',
    ],
  },
  {
    id: 'marketing',
    grupo: 'Agente_Marketing',
    nombre: 'Marketing',
    color: '#ff3399',
    frase: 'Promociones que mueven los productos correctos.',
    que: [
      'Arma promociones por línea de producto y por cliente.',
      'Publica el catálogo y las ofertas por WhatsApp.',
      'Mide qué campañas realmente venden.',
    ],
  },
];

export const BODESTOCK_BASE = {
  id: 'bodestock',
  grupo: 'Bodestock_HQ',
  nombre: 'Bodestock',
  color: '#2f9bff',
  frase: 'La energía que conecta a todos los agentes de tu distribuidora.',
  que: [
    'Reúne los cinco agentes en una sola plataforma.',
    'Comparte los datos entre áreas: lo que vende Precios lo ve Inventario.',
    'Un solo lugar para operar toda la distribuidora.',
  ],
};

function kpisVacios() {
  return [{ label: 'Cargando…', valor: '—', delta: '' }];
}

function kpisError() {
  return [{ label: 'Sin datos', valor: '—', delta: '' }];
}

/**
 * Trae los KPIs reales de los 5 agentes para `companyId` desde Firestore,
 * usando las mismas funciones que ya alimentan /super-admin/agentes. Cada
 * agente se resuelve por separado (Promise.allSettled): si uno falla, los
 * demás igual muestran su dato real.
 */
export async function cargarAgentesReales(companyId) {
  const [inv, prec, fin, cont, iva, mkt] = await Promise.allSettled([
    analyzeInventoryHealth({ companyId }),
    analyzeProductMargins({ companyId }),
    analyzeCashFlow({ companyId }),
    auditAccounting({ companyId }),
    estimateMonthlyVAT({ companyId }),
    fetchSavedProspects(companyId),
  ]);

  const kpis = {
    inventory: inv.status === 'fulfilled'
      ? [
          { label: 'Productos', valor: String(inv.value.summary.totalProducts), delta: '' },
          { label: 'Sin stock', valor: String(inv.value.summary.outOfStockCount), delta: '' },
          { label: 'Stock crítico', valor: String(inv.value.summary.criticalStockCount), delta: '' },
        ]
      : kpisError(),

    pricing: prec.status === 'fulfilled'
      ? [
          { label: 'Productos evaluados', valor: String(prec.value.summary.total), delta: '' },
          { label: 'Con pérdida', valor: String(prec.value.summary.lossCount), delta: '' },
          { label: 'Margen bajo', valor: String(prec.value.summary.lowCount), delta: '' },
        ]
      : kpisError(),

    finance: fin.status === 'fulfilled'
      ? [
          { label: 'Ventas del mes', valor: money(fin.value.latestMonth?.salesTotal), delta: '' },
          { label: 'Por cobrar (crédito)', valor: money(fin.value.totalCreditExposure), delta: '' },
          { label: 'Flujo neto del mes', valor: money(fin.value.latestMonth?.net), delta: '' },
        ]
      : kpisError(),

    accounting: (cont.status === 'fulfilled' && iva.status === 'fulfilled')
      ? [
          { label: 'IVA estimado', valor: money(iva.value.estimatedVAT), delta: '' },
          { label: 'Hallazgos del mes', valor: String(cont.value.summary.total), delta: '' },
          { label: 'Alertas', valor: String(cont.value.summary.warnings), delta: '' },
        ]
      : kpisError(),

    marketing: mkt.status === 'fulfilled'
      ? [
          { label: 'Prospectos', valor: String(mkt.value.length), delta: '' },
          { label: 'Por visitar', valor: String(mkt.value.filter(p => p.status === PROSPECT_STATUS.TO_VISIT || p.status === PROSPECT_STATUS.NEW).length), delta: '' },
          { label: 'Clientes nuevos', valor: String(mkt.value.filter(p => p.status === PROSPECT_STATUS.CLIENT).length), delta: '' },
        ]
      : kpisError(),
  };

  const okCount = [inv, prec, fin, cont, mkt].filter(r => r.status === 'fulfilled').length;

  const agentes = AGENTES_BASE.map((a) => ({ ...a, kpis: kpis[a.id] }));
  const bodestock = {
    ...BODESTOCK_BASE,
    kpis: [
      { label: 'Agentes activos', valor: String(okCount), delta: '' },
      { label: 'Productos en bodega', valor: inv.status === 'fulfilled' ? String(inv.value.summary.totalProducts) : '—', delta: '' },
      { label: 'Ventas del mes', valor: fin.status === 'fulfilled' ? money(fin.value.latestMonth?.salesTotal) : '—', delta: '' },
    ],
  };

  return { agentes, bodestock };
}

// Estado inicial (antes de que carguen los datos reales): mismos agentes,
// KPIs en blanco para no mostrar números de ejemplo ni "parpadeo" de datos falsos.
export const AGENTES = AGENTES_BASE.map((a) => ({ ...a, kpis: kpisVacios() }));
export const BODESTOCK = { ...BODESTOCK_BASE, kpis: kpisVacios() };

export const POR_GRUPO = Object.fromEntries([...AGENTES, BODESTOCK].map((a) => [a.grupo, a]));
export const POR_ID = Object.fromEntries([...AGENTES, BODESTOCK].map((a) => [a.id, a]));
