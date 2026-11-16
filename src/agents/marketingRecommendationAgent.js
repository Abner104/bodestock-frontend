// src/agents/marketingRecommendationAgent.js
// Segunda mitad del Agente de Marketing: qué productos promocionar.
// Cruza margen real (de pricingAgent.js) con volumen de ventas real
// (de inventory_exits) para sugerir qué empujar: productos de buen margen
// que se venden poco (oportunidad de foco) y los más vendidos con buen
// margen (para llevar como "gancho" a los prospectos nuevos).

import { db } from '../firebase/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';
import { analyzeProductMargins, MARGIN_STATUS } from './pricingAgent';
import { getAIRecommendation } from './aiAnalysis';

/**
 * Suma unidades y monto vendido por producto (productId), recorriendo las
 * líneas de cada venta en inventory_exits. Últimos 90 días por defecto —
 * ventas viejas no sirven para decidir qué promocionar hoy.
 */
async function fetchSalesVolumeByProduct(companyId, daysBack = 90) {
  const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
  const q = query(exitsRef, where('reason', '==', 'SALE'));
  const snapshot = await getDocs(q);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const byProductId = {}; // { productId: { unitsSold, revenue, saleCount } }

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelled') return;

    const date = data.createdAt?.toDate?.();
    if (!date || date < cutoff) return;

    (data.products || []).forEach(line => {
      const id = line.productId;
      if (!id) return;
      if (!byProductId[id]) byProductId[id] = { unitsSold: 0, revenue: 0, saleCount: 0 };
      byProductId[id].unitsSold += Number(line.quantity) || 0;
      byProductId[id].revenue += Number(line.totalValue) || 0;
      byProductId[id].saleCount += 1;
    });
  });

  return byProductId;
}

/**
 * Analiza qué productos conviene promocionar: cruza margen (pricingAgent)
 * con volumen de venta real de los últimos `daysBack` días.
 *
 * Clasifica en:
 *  - hiddenGems: buen margen (saludable) pero pocas ventas — oportunidad de
 *    empujarlos más, ya dejan buena ganancia por unidad.
 *  - bestSellers: los más vendidos por ingreso, con su margen a la vista —
 *    útiles como "gancho" al ofrecer a un negocio nuevo (se sabe que rotan).
 *  - noSales: tienen margen saludable pero CERO ventas en el período — o son
 *    nuevos, o no se están ofreciendo, vale la pena revisar por qué.
 *
 * @param {object} options
 * @param {string} options.companyId
 * @param {number} options.daysBack - ventana de ventas a considerar (default 90)
 */
export async function analyzeProductsToPromote({ companyId, daysBack = 90 } = {}) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) throw new Error('No se pudo identificar la empresa del usuario');

  const [marginAnalysis, salesVolume] = await Promise.all([
    analyzeProductMargins({ companyId: resolvedCompanyId }),
    fetchSalesVolumeByProduct(resolvedCompanyId, daysBack)
  ]);

  // Solo productos de inventario real tienen productId que calza con las
  // ventas (los del wizard de costeo no se venden vía inventory_exits).
  const enriched = marginAnalysis.products
    .filter(p => p.source === 'inventory')
    .map(p => {
      const volume = salesVolume[p.id] || { unitsSold: 0, revenue: 0, saleCount: 0 };
      return { ...p, ...volume };
    });

  const healthy = enriched.filter(p => p.status === MARGIN_STATUS.HEALTHY);

  const hiddenGems = healthy
    .filter(p => p.unitsSold > 0)
    .sort((a, b) => b.marginPct - a.marginPct || a.unitsSold - b.unitsSold)
    .slice(0, 10);

  const bestSellers = enriched
    .filter(p => p.unitsSold > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const noSales = healthy
    .filter(p => p.unitsSold === 0)
    .sort((a, b) => b.marginPct - a.marginPct)
    .slice(0, 10);

  return {
    daysBack,
    hiddenGems,
    bestSellers,
    noSales,
    summary: {
      totalProductsAnalyzed: enriched.length,
      totalWithSales: enriched.filter(p => p.unitsSold > 0).length
    }
  };
}

/**
 * Pide a la IA una recomendación de qué 2-3 productos priorizar al ofrecer
 * a prospectos nuevos, usando SOLO los datos ya calculados por
 * analyzeProductsToPromote() (nunca datos crudos de Firestore).
 *
 * @param {object} promotionAnalysis - resultado de analyzeProductsToPromote()
 * @param {string} companyName
 */
export async function getProductPromotionAIAnalysis(promotionAnalysis, companyName) {
  const { hiddenGems, bestSellers, noSales, summary, daysBack } = promotionAnalysis;

  const listText = (products) => products
    .map(p => `${p.nombre}: margen ${p.marginPct}%, precio $${p.price?.toLocaleString('es-CL')}, ${p.unitsSold} vendidas, ingreso $${p.revenue?.toLocaleString('es-CL')}`)
    .join('\n') || 'Ninguno';

  const userPrompt = `Analiza qué productos conviene priorizar para ofrecer a prospectos nuevos de "${companyName}", una distribuidora/almacén en Chile. Datos de los últimos ${daysBack} días:

JOYAS ESCONDIDAS (buen margen, poca venta — oportunidad de empujarlos):
${listText(hiddenGems)}

MÁS VENDIDOS (buen gancho de entrada, ya se sabe que rotan):
${listText(bestSellers)}

BUEN MARGEN, CERO VENTAS (o son nuevos o no se están ofreciendo):
${listText(noSales)}

RESUMEN: ${summary.totalProductsAnalyzed} productos analizados, ${summary.totalWithSales} con ventas en el período.

Da una recomendación breve (3-4 oraciones) en español de Chile, directa y accionable: qué 2-3 productos priorizar para llevar a los próximos prospectos y por qué (considerando margen y volumen), y una sugerencia concreta de cómo usarlos en la conversación de venta. No repitas los números tal cual — interprétalos.`;

  return getAIRecommendation({
    systemPrompt: 'Eres un consultor de negocios pragmático que asesora a pequeñas distribuidoras en Chile sobre qué productos priorizar al vender. Hablas claro, sin jerga innecesaria, y siempre das una opinión concreta, no solo describes los datos.',
    userPrompt
  });
}
