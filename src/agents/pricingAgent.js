// src/agents/pricingAgent.js
// Agente de Pricing/Márgenes: detecta productos sin ganancia o con margen bajo.
// Es lógica pura (sin JSX, sin voz) para poder reutilizarse desde el dashboard,
// desde el asistente por voz, o desde un reporte automático más adelante.
//
// Bodestock tiene DOS fuentes posibles de productos con costo/precio:
// 1. companies/{id}/inventories/{invId}/products — el inventario real que usan
//    día a día (costo = ppp, precio = salePrice o precioVenta). La mayoría de
//    las empresas vive acá.
// 2. companies/{id}/productos_terminados — productos pasados por el wizard de
//    costeo (costoFinal/costoTotal, precioVenta/precioSugerido).
// Se combinan ambas para no perder productos según cómo trabaje cada empresa.

import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';

export const MARGIN_STATUS = {
  LOSS: 'LOSS',       // precio <= costo
  LOW: 'LOW',         // margen positivo pero bajo el umbral
  HEALTHY: 'HEALTHY'  // margen saludable
};

const DEFAULT_LOW_MARGIN_THRESHOLD = 15; // %
export const UNCATEGORIZED = 'Sin categoría';

/**
 * Normaliza el nombre de una categoría a una clave canónica para AGRUPAR
 * (no para mostrar): minúsculas, sin tildes, sin espacios extra, y quita una
 * 's' final simple para juntar singular/plural (ej. "Abarrotes" y "abarrote"
 * caen en la misma clave). Nunca se escribe de vuelta a Firestore — es solo
 * una ayuda para que el agente no trate "Aseo" y "aseo " como cosas distintas.
 */
export function normalizeCategoryKey(category) {
  if (!category) return UNCATEGORIZED;
  let key = category
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // quita tildes
  if (key.length > 3 && key.endsWith('s')) key = key.slice(0, -1); // plural simple
  return key || UNCATEGORIZED;
}

/**
 * Resuelve qué umbral usar para un producto según su categoría (normalizada).
 * @param {string} category
 * @param {number|Object<string, number>} thresholds - número global, o mapa { claveNormalizada: umbral }
 */
function resolveThreshold(category, thresholds) {
  if (typeof thresholds === 'number') return thresholds;
  const key = normalizeCategoryKey(category);
  return thresholds?.[key] ?? thresholds?.default ?? DEFAULT_LOW_MARGIN_THRESHOLD;
}

/**
 * Calcula el estado de margen de un producto ya normalizado
 * (espera { cost, price } numéricos). `lowThreshold` puede ser un número
 * (umbral global) o un mapa { categoria: umbral } — en ese caso se resuelve
 * usando product.category.
 */
export function evaluateProductMargin(product, lowThreshold = DEFAULT_LOW_MARGIN_THRESHOLD) {
  const cost = Number(product.cost) || 0;
  const price = Number(product.price) || 0;
  const effectiveThreshold = resolveThreshold(product.category, lowThreshold);

  const profit = price - cost;
  const marginPct = price > 0 ? (profit / price) * 100 : (cost > 0 ? -100 : 0);

  let status = MARGIN_STATUS.HEALTHY;
  if (price <= cost) {
    status = MARGIN_STATUS.LOSS;
  } else if (marginPct < effectiveThreshold) {
    status = MARGIN_STATUS.LOW;
  }

  // Precio sugerido para alcanzar el margen objetivo (usa el umbral bajo como piso)
  const suggestedPrice = cost > 0 ? cost / (1 - effectiveThreshold / 100) : price;

  return {
    ...product,
    category: product.category || UNCATEGORIZED,
    cost,
    price,
    profit,
    marginPct: Number(marginPct.toFixed(1)),
    status,
    effectiveThreshold,
    suggestedPrice: Math.round(suggestedPrice)
  };
}

/**
 * Trae los productos del inventario real de la empresa (todas sus bodegas),
 * usando ppp como costo y salePrice/precioVenta como precio de venta.
 * Solo incluye productos que efectivamente tienen un precio de venta cargado,
 * porque sin precio no se puede evaluar margen.
 */
async function fetchInventoryProducts(companyId) {
  const inventoriesSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
  const results = [];

  await Promise.all(inventoriesSnap.docs.map(async (invDoc) => {
    const productsSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`));
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      const price = data.salePrice ?? data.precioVenta ?? null;
      if (price === null || price === undefined || price === '') return; // sin precio no hay margen que evaluar

      results.push({
        id: doc.id,
        source: 'inventory',
        inventoryId: invDoc.id,
        nombre: data.name || 'Sin nombre',
        sku: data.sku || '',
        category: data.category || null,
        cost: Number(data.ppp) || 0,
        price: Number(price) || 0,
        stock: Number(data.stock) || 0,
        activo: true
      });
    });
  }));

  return results;
}

/**
 * Trae los productos pasados por el wizard de costeo (productos_terminados).
 */
async function fetchCostingWizardProducts(companyId) {
  try {
    const q = query(
      collection(db, `companies/${companyId}/productos_terminados`),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        source: 'costing_wizard',
        nombre: data.nombre || 'Sin nombre',
        sku: data.sku || '',
        category: data.category || null,
        cost: data.costoFinal || data.costoTotal || 0,
        price: data.precioVenta || data.precioSugerido || 0,
        activo: data.activo !== false
      };
    });
  } catch {
    return [];
  }
}

/**
 * Trae todos los productos con precio de venta de la empresa (inventario real +
 * wizard de costeo) y los evalúa.
 * @param {object} options
 * @param {number} options.lowThreshold - % bajo el cual se considera margen bajo (default 15)
 * @param {string} options.companyId - opcional, si ya se tiene resuelto
 */
export async function analyzeProductMargins({ lowThreshold = DEFAULT_LOW_MARGIN_THRESHOLD, companyId } = {}) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) {
    throw new Error('No se pudo identificar la empresa del usuario');
  }

  const [inventoryProducts, wizardProducts] = await Promise.all([
    fetchInventoryProducts(resolvedCompanyId),
    fetchCostingWizardProducts(resolvedCompanyId)
  ]);

  const products = [...inventoryProducts, ...wizardProducts]
    .map(p => evaluateProductMargin({ ...p, companyId: resolvedCompanyId }, lowThreshold));

  const loss = products.filter(p => p.status === MARGIN_STATUS.LOSS);
  const low = products.filter(p => p.status === MARGIN_STATUS.LOW);
  const healthy = products.filter(p => p.status === MARGIN_STATUS.HEALTHY);

  return {
    products,
    summary: {
      total: products.length,
      lossCount: loss.length,
      lowCount: low.length,
      healthyCount: healthy.length,
      totalLossExposure: loss.reduce((sum, p) => sum + Math.abs(p.profit), 0)
    },
    loss,
    low,
    healthy
  };
}

/**
 * Distancia de Levenshtein: cantidad mínima de ediciones (agregar, borrar o
 * cambiar un caracter) para convertir un string en otro. Se usa para
 * detectar categorías que son el mismo texto con un typo (ej. "Abarrote" /
 * "Abarreto" difieren en 1 edición), muy común cuando la categoría se
 * escribe a mano producto por producto en vez de elegirse de una lista.
 */
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Umbral relativo: cuántas ediciones de diferencia todavía se consideran
// "el mismo texto con un typo" -- proporcional al largo, así "Aseo"/"Asel"
// (4 letras, 1 edición) se junta pero categorías cortas y realmente
// distintas ("Ropa"/"Sopa") no se mezclan por casualidad.
function isLikelyTypo(a, b) {
  if (!a || !b) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 4) return a === b; // strings muy cortos: exigir igualdad exacta
  const distance = levenshteinDistance(a, b);
  return distance <= Math.max(1, Math.floor(maxLen * 0.2));
}

/**
 * Agrupa las categorías presentes en una lista de productos, uniendo variantes
 * que solo difieren en mayúsculas, tildes, espacios, singular/plural, o un
 * typo chico (ej. "Abarrotes", "abarrote", "Abarreto" quedan en un solo
 * grupo). Primero agrupa por clave normalizada exacta, y después fusiona
 * los grupos resultantes entre sí por similitud de texto (Levenshtein) --
 * así una categoría cargada con error de tipeo no queda como un grupo
 * fantasma de 1 solo producto.
 * Devuelve un grupo por cada categoría real, con:
 *  - key: clave normalizada del nombre más frecuente (usar como identificador)
 *  - label: nombre más frecuente del grupo, para mostrar en la UI
 *  - count: cuántos productos caen en ese grupo
 * Ordenado por cantidad de productos (de mayor a menor).
 */
export function getCategoriesFromProducts(products) {
  const groups = new Map(); // key -> { labels: Map<string,count>, count }

  products.forEach(p => {
    const original = p.category || UNCATEGORIZED;
    const key = normalizeCategoryKey(original);
    if (!groups.has(key)) groups.set(key, { labels: new Map(), count: 0 });
    const group = groups.get(key);
    group.count += 1;
    group.labels.set(original, (group.labels.get(original) || 0) + 1);
  });

  // Fusiona grupos cuya clave normalizada es un typo chico de otra ya
  // vista -- empezando por los grupos más grandes, para que un typo
  // suelto se absorba en la categoría real y no al revés.
  const entries = [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  const merged = []; // [{ key, labels: Map, count }]
  entries.forEach(([key, group]) => {
    const target = merged.find((m) => isLikelyTypo(m.key, key));
    if (target) {
      target.count += group.count;
      group.labels.forEach((count, label) => {
        target.labels.set(label, (target.labels.get(label) || 0) + count);
      });
    } else {
      merged.push({ key, labels: new Map(group.labels), count: group.count });
    }
  });

  return merged
    .map(({ key, labels, count }) => {
      const label = [...labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { key, label, count };
    })
    .sort((a, b) => b.count - a.count);
}

// Umbrales de rotación (unidades vendidas del mes ÷ stock actual) que
// definen los 3 niveles de margen sugerido por categoría, y el margen
// objetivo de cada nivel -- pensado para distribuidora/almacén: lo que
// rota rápido (bebidas, lácteos) compite por precio y tolera margen bajo;
// lo que rota lento necesita margen más alto para compensar el capital
// parado. Ver conversación con el usuario.
const ROTATION_TIERS = [
  { id: 'HIGH', label: 'Rotación alta', minRotation: 0.5, suggestedMarginPct: 12 },
  { id: 'MEDIUM', label: 'Rotación media', minRotation: 0.15, suggestedMarginPct: 20 },
  { id: 'LOW', label: 'Rotación baja', minRotation: 0, suggestedMarginPct: 35 },
];

function resolveRotationTier(rotationRatio) {
  return ROTATION_TIERS.find((tier) => rotationRatio >= tier.minRotation) || ROTATION_TIERS[ROTATION_TIERS.length - 1];
}

/**
 * Unidades vendidas por producto en el último mes (inventory_exits, reason
 * SALE, no canceladas) -- usado para calcular la rotación de cada
 * categoría. Mismo criterio de "vendido en el período" que ya usa
 * inventoryAgent.js para stock sin movimiento, pero acá se necesita la
 * CANTIDAD exacta por producto, no solo si se vendió o no.
 */
async function fetchUnitsSoldByProduct(companyId) {
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
 * Sugerencia de precio PRODUCTO POR PRODUCTO -- no agrupa por categoría
 * porque en la práctica la categoría suele estar mal cargada/con typos, lo
 * que hace que agrupar no tenga sentido de negocio. Usa
 * el mismo criterio de 3 niveles según rotación individual del producto
 * (unidades vendidas este mes ÷ su propio stock).
 * @param {object} options
 * @param {string} [options.companyId]
 * @param {number} [options.lowThreshold]
 */
export async function analyzeProductPricingSuggestions({ companyId, lowThreshold = DEFAULT_LOW_MARGIN_THRESHOLD } = {}) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) throw new Error('No se pudo identificar la empresa del usuario');

  const [analysis, unitsByProductId] = await Promise.all([
    analyzeProductMargins({ companyId: resolvedCompanyId, lowThreshold }),
    fetchUnitsSoldByProduct(resolvedCompanyId),
  ]);

  // Solo productos de inventario tienen stock real para calcular rotación
  // -- los del wizard de costeo no entran acá (mismo criterio que
  // analyzeCategoryMargins).
  const inventoryProducts = analysis.products.filter((p) => p.source === 'inventory');

  const products = inventoryProducts.map((p) => {
    const unitsSoldThisMonth = unitsByProductId[p.id] || 0;
    const stock = Number(p.stock) || 0;
    const rotationRatio = stock > 0 ? unitsSoldThisMonth / stock : (unitsSoldThisMonth > 0 ? 1 : 0);
    const tier = resolveRotationTier(rotationRatio);

    const suggestedPrice = p.cost > 0 ? Math.round(p.cost / (1 - tier.suggestedMarginPct / 100)) : p.price;
    const needsAdjustment = p.marginPct < tier.suggestedMarginPct - 3;

    const currentMonthlyProfit = unitsSoldThisMonth * p.profit;
    const suggestedMonthlyProfit = p.cost > 0 ? unitsSoldThisMonth * (suggestedPrice - p.cost) : currentMonthlyProfit;

    return {
      ...p,
      unitsSoldThisMonth,
      rotationRatio: Number(rotationRatio.toFixed(3)),
      rotationTier: tier.id,
      rotationTierLabel: tier.label,
      suggestedMarginPct: tier.suggestedMarginPct,
      suggestedPrice,
      needsAdjustment,
      currentMonthlyProfit: Math.round(currentMonthlyProfit),
      suggestedMonthlyProfit: Math.round(suggestedMonthlyProfit),
      profitDelta: Math.round(suggestedMonthlyProfit - currentMonthlyProfit),
    };
  }).sort((a, b) => b.profitDelta - a.profitDelta);

  const totalProfitDelta = products.reduce((sum, p) => sum + (p.needsAdjustment ? p.profitDelta : 0), 0);
  const adjustCount = products.filter((p) => p.needsAdjustment).length;

  const now = new Date();
  return {
    periodKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    products,
    summary: { total: products.length, adjustCount, totalProfitDelta: Math.round(totalProfitDelta) },
  };
}

/**
 * Aplica el margen sugerido de una categoría a TODOS sus productos, uno por
 * uno (mismo mecanismo que applySuggestedPrice, pero en lote). Recalcula el
 * precio de cada producto para alcanzar el margen objetivo de la categoría
 * (no el umbral bajo general) antes de escribir.
 * @param {object} category - una entrada de analyzeCategoryMargins().categories
 */
export async function applyCategorySuggestedMargin(category) {
  const results = await Promise.allSettled(
    category.products.map((product) => {
      const suggestedPrice = product.cost > 0
        ? Math.round(product.cost / (1 - category.suggestedMarginPct / 100))
        : product.price;
      return applySuggestedPrice({ ...product, suggestedPrice });
    })
  );
  const applied = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - applied;
  return { applied, failed };
}

/**
 * Analiza márgenes de TODAS las empresas (uso exclusivo Super Admin).
 * Recibe la lista de empresas ya cargada (id + name) para no volver a consultarlas.
 * @param {Array<{id: string, name: string}>} companies
 * @param {number} lowThreshold
 */
export async function analyzeAllCompaniesMargins(companies, lowThreshold = DEFAULT_LOW_MARGIN_THRESHOLD) {
  const results = await Promise.all(
    companies.map(async (company) => {
      try {
        const analysis = await analyzeProductMargins({ companyId: company.id, lowThreshold });
        return {
          companyId: company.id,
          companyName: company.name,
          ...analysis
        };
      } catch (error) {
        return {
          companyId: company.id,
          companyName: company.name,
          error: error.message,
          products: [],
          summary: { total: 0, lossCount: 0, lowCount: 0, healthyCount: 0, totalLossExposure: 0 },
          loss: [],
          low: [],
          healthy: []
        };
      }
    })
  );

  const sorted = results.sort((a, b) => b.summary.lossCount - a.summary.lossCount);

  return {
    companies: sorted,
    globalSummary: {
      companiesWithLoss: sorted.filter(c => c.summary.lossCount > 0).length,
      totalProductsInLoss: sorted.reduce((sum, c) => sum + c.summary.lossCount, 0),
      totalLossExposure: sorted.reduce((sum, c) => sum + c.summary.totalLossExposure, 0)
    }
  };
}

/**
 * Aplica el precio sugerido de un producto directamente en Firestore.
 * Escribe en la colección correcta según de dónde vino el producto
 * (inventario real o wizard de costeo).
 * @param {object} product - un producto ya evaluado por evaluateProductMargin
 *   (debe traer companyId, source, id y, si es de inventario, inventoryId)
 */
export async function applySuggestedPrice(product) {
  const { companyId, source, id, inventoryId, suggestedPrice } = product;
  if (!companyId || !source || !id) {
    throw new Error('Producto incompleto: falta companyId, source o id');
  }

  if (source === 'inventory') {
    if (!inventoryId) throw new Error('Falta inventoryId para actualizar el producto de inventario');
    const ref = doc(db, `companies/${companyId}/inventories/${inventoryId}/products/${id}`);
    await updateDoc(ref, { salePrice: suggestedPrice });
  } else if (source === 'costing_wizard') {
    const ref = doc(db, `companies/${companyId}/productos_terminados/${id}`);
    await updateDoc(ref, { precioVenta: suggestedPrice });
  } else {
    throw new Error(`Fuente de producto desconocida: ${source}`);
  }
}
