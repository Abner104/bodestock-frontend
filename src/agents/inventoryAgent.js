// src/agents/inventoryAgent.js
// Agente de Inventario: detecta qué reponer y cuándo, cruzando el stock actual
// de cada producto contra sus ventas recientes. Lógica pura (sin JSX), mismo
// patrón que pricingAgent.js y financeAgent.js, para reutilizarse desde el
// dashboard, la Sala de Agentes, o el asistente por voz.
//
// Fuentes de datos reales (Bodestock):
// 1. companies/{id}/inventories/{invId}/products — el inventario real de cada
//    bodega de la empresa. Mismo patrón de recorrido que fetchInventoryProducts
//    en pricingAgent.js: hay que recorrer TODAS las subcolecciones de inventario.
// 2. companies/{id}/inventory_exits (reason: 'SALE', no canceladas) — para
//    saber si un producto con stock parado en realidad se sigue vendiendo.
//
// Los umbrales usados acá son EXACTAMENTE los mismos que ya usa en producción
// SuperAdminGestion.jsx (líneas ~915-931): sin stock, stock crítico (1-5
// unidades) y sin movimiento (stock > 5 sin ventas en los últimos 500 exits).
// No se inventan números nuevos — se replica esa lógica ya probada.

import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy, where, limit as fsLimit, Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAIRecommendation } from './aiAnalysis';

// Ventana de "reciente" para considerar que un producto sigue rotando: los
// últimos 500 movimientos de salida de la empresa, igual que SuperAdminGestion.jsx.
const RECENT_EXITS_WINDOW = 500;

const STOCK_CRITICO_MAX = 5;

/**
 * Trae los productos del inventario real de la empresa (todas sus bodegas),
 * igual que fetchInventoryProducts en pricingAgent.js.
 */
async function fetchInventoryProducts(companyId) {
  const inventoriesSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
  const results = [];

  await Promise.all(inventoriesSnap.docs.map(async (invDoc) => {
    const productsSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`));
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      results.push({
        id: doc.id,
        inventoryId: invDoc.id,
        name: data.name || 'Sin nombre',
        sku: data.sku || '',
        category: data.category || null,
        productType: data.productType || null,
        byWeight: !!data.byWeight,
        stock: Number(data.stock) || 0,
        ppp: Number(data.ppp) || 0
      });
    });
  }));

  return results;
}

/**
 * Trae los últimos RECENT_EXITS_WINDOW movimientos de salida por venta
 * (reason SALE, no cancelados) y devuelve el set de productIds que aparecen
 * en ellos — para saber qué productos siguen rotando.
 */
async function fetchRecentlySoldProductIds(companyId) {
  const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
  const q = query(exitsRef, orderBy('createdAt', 'desc'), fsLimit(RECENT_EXITS_WINDOW));
  const snapshot = await getDocs(q);

  const soldIds = new Set();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.reason !== 'SALE' || data.status === 'cancelled') return;
    (data.products || []).forEach(p => {
      if (p.productId) soldIds.add(p.productId);
    });
  });

  return soldIds;
}

/**
 * Unidades vendidas por producto en el último mes -- usado para sugerir
 * cuánto reponer (no solo señalar que falta stock). Mismo criterio de
 * "ventas del mes" que ya usa pricingAgent.js:fetchUnitsSoldByProduct.
 */
async function fetchUnitsSoldThisMonthByProduct(companyId) {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
  const q = query(exitsRef, where('reason', '==', 'SALE'), where('createdAt', '>=', Timestamp.fromDate(since)));
  const snapshot = await getDocs(q);

  const unitsByProductId = {};
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.status === 'cancelled') return;
    (data.products || []).forEach((p) => {
      if (!p.productId) return;
      unitsByProductId[p.productId] = (unitsByProductId[p.productId] || 0) + (Number(p.quantity) || 0);
    });
  });
  return unitsByProductId;
}

/**
 * Analiza la salud del inventario de una empresa: sin stock, stock crítico,
 * y stock sin movimiento (capital inmovilizado). Mismos umbrales que
 * SuperAdminGestion.jsx:
 * - Sin stock: productType !== 'INSUMO' && !byWeight && stock === 0
 * - Stock crítico: mismo guard, 0 < stock <= 5
 * - Sin movimiento: mismo guard, stock > 5 y el producto no aparece en los
 *   últimos 500 exits de venta de la empresa.
 * - Valor inmovilizado: suma de stock × ppp del set "sin movimiento".
 *
 * @param {object} options
 * @param {string} options.companyId
 */
// Margen de seguridad sobre lo vendido el último mes, para que la cantidad
// sugerida no deje al producto otra vez al borde apenas repuesto.
const REORDER_SAFETY_MARGIN = 1.3;
// Sugerencia mínima cuando no hay ventas registradas este mes (producto
// nuevo, o sin rotación reciente) -- el doble del umbral de stock crítico,
// para que valga la pena reponer sin sobre-stockear a ciegas.
const MIN_REORDER_QTY = STOCK_CRITICO_MAX * 2;

function suggestReorderQty(unitsSoldThisMonth) {
  if (!unitsSoldThisMonth || unitsSoldThisMonth <= 0) return MIN_REORDER_QTY;
  return Math.max(Math.ceil(unitsSoldThisMonth * REORDER_SAFETY_MARGIN), MIN_REORDER_QTY);
}

export async function analyzeInventoryHealth({ companyId }) {
  if (!companyId) {
    throw new Error('Falta companyId para analizar el inventario');
  }

  const [products, recentlySoldIds, unitsSoldByProductId] = await Promise.all([
    fetchInventoryProducts(companyId),
    fetchRecentlySoldProductIds(companyId),
    fetchUnitsSoldThisMonthByProduct(companyId)
  ]);

  // Mismo guard que SuperAdminGestion.jsx: excluye insumos y productos por peso,
  // que no se gestionan con las mismas reglas de reposición por unidad.
  const gestionables = products.filter(p => p.productType !== 'INSUMO' && !p.byWeight);

  const outOfStock = gestionables
    .filter(p => (p.stock ?? 0) === 0)
    .map(p => ({ ...p, unitsSoldThisMonth: unitsSoldByProductId[p.id] || 0, suggestedReorderQty: suggestReorderQty(unitsSoldByProductId[p.id]) }));

  const criticalStock = gestionables
    .filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= STOCK_CRITICO_MAX)
    .map(p => ({ ...p, unitsSoldThisMonth: unitsSoldByProductId[p.id] || 0, suggestedReorderQty: suggestReorderQty(unitsSoldByProductId[p.id]) }))
    .sort((a, b) => a.stock - b.stock);

  const deadStock = gestionables
    .filter(p => (p.stock ?? 0) > STOCK_CRITICO_MAX && !recentlySoldIds.has(p.id))
    .map(p => ({ ...p, immobilizedValue: (p.stock ?? 0) * (p.ppp || 0) }))
    .sort((a, b) => b.immobilizedValue - a.immobilizedValue);

  const immobilizedValue = deadStock.reduce((sum, p) => sum + p.immobilizedValue, 0);

  // Lista de compra: sin stock + crítico juntos (todo lo que hay que
  // reponer), ordenado por rotación de mayor a menor -- lo que más se
  // vende va primero, porque es lo que más venta está perdiendo cada día
  // sin stock, sin importar si hoy está en 0 o solo "crítico". Responde
  // directo a "¿qué compro primero?" en vez de dejar que el dueño ordene
  // mentalmente dos listas separadas.
  const restockList = [...outOfStock, ...criticalStock]
    .map(p => ({ ...p, estimatedCost: p.suggestedReorderQty * (p.ppp || 0) }))
    .sort((a, b) => b.unitsSoldThisMonth - a.unitsSoldThisMonth);
  const restockTotalCost = restockList.reduce((sum, p) => sum + p.estimatedCost, 0);

  return {
    products: gestionables,
    outOfStock,
    criticalStock,
    deadStock,
    restockList,
    summary: {
      totalProducts: gestionables.length,
      outOfStockCount: outOfStock.length,
      criticalStockCount: criticalStock.length,
      deadStockCount: deadStock.length,
      immobilizedValue,
      restockTotalCost
    }
  };
}

/**
 * Analiza la salud de inventario de TODAS las empresas (uso exclusivo Super
 * Admin), mismo patrón que analyzeAllCompaniesCashFlow en financeAgent.js.
 * @param {Array<{id: string, name: string}>} companies
 */
export async function analyzeAllCompaniesInventory(companies) {
  const results = await Promise.all(
    companies.map(async (company) => {
      try {
        const analysis = await analyzeInventoryHealth({ companyId: company.id });
        return { companyId: company.id, companyName: company.name, ...analysis };
      } catch (error) {
        return {
          companyId: company.id,
          companyName: company.name,
          error: error.message,
          products: [],
          outOfStock: [],
          criticalStock: [],
          deadStock: [],
          summary: { totalProducts: 0, outOfStockCount: 0, criticalStockCount: 0, deadStockCount: 0, immobilizedValue: 0 }
        };
      }
    })
  );

  const sorted = results.sort((a, b) =>
    (b.summary.outOfStockCount + b.summary.criticalStockCount) - (a.summary.outOfStockCount + a.summary.criticalStockCount)
  );

  return {
    companies: sorted,
    globalSummary: {
      companiesWithUrgentRestock: sorted.filter(c => c.summary.outOfStockCount > 0 || c.summary.criticalStockCount > 0).length,
      totalOutOfStock: sorted.reduce((sum, c) => sum + c.summary.outOfStockCount, 0),
      totalCriticalStock: sorted.reduce((sum, c) => sum + c.summary.criticalStockCount, 0),
      totalImmobilizedValue: sorted.reduce((sum, c) => sum + c.summary.immobilizedValue, 0)
    }
  };
}

/**
 * Pide a la IA un análisis razonado del estado del inventario de una empresa,
 * usando SOLO los números ya calculados por este agente (nunca datos crudos
 * de Firestore). Prioriza qué reponer primero (sin stock antes que crítico,
 * porque sin stock ya son ventas perdidas ahora mismo) y separa el capital
 * inmovilizado en stock sin rotación, sugiriendo si conviene liquidarlo o
 * dejar de reponerlo.
 *
 * @param {object} inventoryAnalysis - resultado de analyzeInventoryHealth()
 * @param {string} companyName
 */
export async function getInventoryAIAnalysis(inventoryAnalysis, companyName) {
  const { outOfStock, criticalStock, deadStock, summary } = inventoryAnalysis;

  const outOfStockText = outOfStock.length > 0
    ? outOfStock.slice(0, 15).map(p => `${p.name}${p.sku ? ` (${p.sku})` : ''}`).join(', ')
    : 'ninguno';

  const criticalText = criticalStock.length > 0
    ? criticalStock.slice(0, 15).map(p => `${p.name} (quedan ${p.stock})`).join(', ')
    : 'ninguno';

  const deadStockText = deadStock.length > 0
    ? deadStock.slice(0, 15).map(p => `${p.name} (${p.stock} unidades, $${Math.round(p.immobilizedValue).toLocaleString('es-CL')} inmovilizados)`).join(', ')
    : 'ninguno';

  const userPrompt = `Analiza el estado del inventario de "${companyName}", una distribuidora/almacén en Chile.

PRODUCTOS SIN STOCK (0 unidades, ventas perdidas ahora mismo): ${outOfStockText}

PRODUCTOS CON STOCK CRÍTICO (1 a ${STOCK_CRITICO_MAX} unidades): ${criticalText}

PRODUCTOS SIN ROTACIÓN (stock > ${STOCK_CRITICO_MAX} unidades, sin ninguna venta en los últimos ${RECENT_EXITS_WINDOW} movimientos de salida de la empresa): ${deadStockText}

RESUMEN:
- Total productos gestionados: ${summary.totalProducts}
- Sin stock: ${summary.outOfStockCount}
- Stock crítico: ${summary.criticalStockCount}
- Sin rotación: ${summary.deadStockCount}
- Capital inmovilizado en stock sin rotación: $${Math.round(summary.immobilizedValue).toLocaleString('es-CL')}

Da un análisis breve (máximo 4-5 oraciones) en español de Chile, directo y accionable. Prioriza qué reponer primero: lo sin stock antes que lo crítico, porque lo sin stock ya son ventas perdidas hoy. Para el stock sin rotación, opina concretamente si conviene liquidarlo (rebajarlo de precio, promocionarlo) o simplemente dejar de reponerlo, según cuánto capital hay inmovilizado. No repitas los números tal cual — interprétalos y da una recomendación concreta.`;

  return getAIRecommendation({
    systemPrompt: 'Eres un consultor de inventario pragmático que asesora a pequeños negocios y distribuidoras en Chile. Hablas claro, sin jerga innecesaria, y siempre das una prioridad concreta de qué hacer primero, no solo describes los datos.',
    userPrompt
  });
}

/**
 * Igual que getInventoryAIAnalysis, pero con caché en Firestore -- evita
 * pagar una llamada a Claude cada vez que se abre el panel del agente
 * (antes se regeneraba en cada apertura, sin cachear nada). Se reutiliza
 * el último análisis guardado si los conteos no cambiaron desde entonces
 * (misma "firma": sin stock/crítico/sin rotación/capital inmovilizado);
 * si algo cambió, se regenera y se guarda el nuevo. Vive en
 * companies/{id}/agent_ai_cache/inventory.
 */
export async function getInventoryAIAnalysisCached(inventoryAnalysis, companyName, companyId) {
  const { summary } = inventoryAnalysis;
  const signature = `${summary.outOfStockCount}-${summary.criticalStockCount}-${summary.deadStockCount}-${Math.round(summary.immobilizedValue)}`;

  const cacheRef = doc(db, `companies/${companyId}/agent_ai_cache/inventory`);
  try {
    const cached = await getDoc(cacheRef);
    if (cached.exists() && cached.data().signature === signature && cached.data().text) {
      return cached.data().text;
    }
  } catch (e) {
    console.warn('No se pudo leer el caché de análisis de inventario:', e.message);
  }

  const text = await getInventoryAIAnalysis(inventoryAnalysis, companyName);

  try {
    await setDoc(cacheRef, { signature, text, updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn('No se pudo guardar el caché de análisis de inventario:', e.message);
  }

  return text;
}
