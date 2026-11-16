// src/agents/financeAgent.js
// Agente de Finanzas: cruza ventas reales contra gastos operativos para dar
// una vista de flujo de caja por mes. Lógica pura (sin JSX), igual que
// pricingAgent.js, para reutilizarse desde el dashboard o desde voz.
//
// Fuentes de datos reales (Bodestock):
// 1. companies/{id}/inventory_exits (reason: 'SALE') — ventas completadas.
//    Campo de monto: totalValue. Campo de fecha: createdAt (Firestore Timestamp).
// 2. companies/{id}/gestion_gastos — gastos operativos cargados manualmente
//    (arriendo, sueldos, etc). Campos: monto (number), periodo ('YYYY-MM'), tipo.
//
// No existe en el sistema ningún campo de capital inicial / préstamo — este
// agente NUNCA debe inventar o proyectar sobre un monto de inversión que no
// esté efectivamente cargado en Firestore.

import { db } from '../firebase/firebase';
import { collection, getDocs, query, where, Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';
import { analyzeProductMargins } from './pricingAgent';
import { getAIRecommendation } from './aiAnalysis';

/**
 * Convierte un Date a clave de período 'YYYY-MM'.
 */
function toPeriodKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Primer día del mes, monthsBack meses atrás de hoy, como clave 'YYYY-MM'. */
function periodKeyMonthsAgo(monthsBack) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (monthsBack - 1));
  return toPeriodKey(d);
}

/**
 * Trae las ventas completadas de la empresa (inventory_exits con reason SALE),
 * agrupadas por período (mes). También separa cuánto de esas ventas fue
 * "fiado" (paymentMethod CREDIT) — plata que cuenta como venta pero todavía
 * no entró como efectivo real. No hay forma de saber si el fiado se cobró
 * después (no existe ese campo en el sistema), así que esto es exposición
 * acumulada, no seguimiento de cobro.
 *
 * @param {string} companyId
 * @param {number|null} monthsBack - si se pasa, acota la query a los últimos
 *   N meses con un where() de Firestore (rápido: no trae todo el historial
 *   para descartarlo después en memoria). Sin este parámetro, comportamiento
 *   idéntico al de siempre -- todo el historial de ventas.
 */
async function fetchSalesByPeriod(companyId, monthsBack = null) {
  const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
  const clauses = [where('reason', '==', 'SALE')];
  if (monthsBack) {
    const since = new Date();
    since.setDate(1);
    since.setMonth(since.getMonth() - (monthsBack - 1));
    since.setHours(0, 0, 0, 0);
    clauses.push(where('createdAt', '>=', Timestamp.fromDate(since)));
  }
  const q = query(exitsRef, ...clauses);
  const snapshot = await getDocs(q);

  const byPeriod = {}; // { 'YYYY-MM': { total, count, creditTotal, creditCount } }

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelled') return; // ignorar ventas anuladas

    const date = data.createdAt?.toDate?.();
    if (!date) return;

    const period = toPeriodKey(date);
    if (!byPeriod[period]) byPeriod[period] = { total: 0, count: 0, creditTotal: 0, creditCount: 0 };

    const value = Number(data.totalValue) || 0;
    byPeriod[period].total += value;
    byPeriod[period].count += 1;

    if (data.paymentMethod === 'CREDIT') {
      byPeriod[period].creditTotal += value;
      byPeriod[period].creditCount += 1;
    }
  });

  return byPeriod;
}

/**
 * Trae los gastos operativos cargados manualmente, agrupados por período.
 * @param {string} companyId
 * @param {number|null} monthsBack - igual que en fetchSalesByPeriod. `periodo`
 *   es un string 'YYYY-MM', que ordena lexicográficamente igual que
 *   cronológicamente, así que un where >= funciona directo sobre el string.
 */
async function fetchExpensesByPeriod(companyId, monthsBack = null) {
  const gastosRef = collection(db, `companies/${companyId}/gestion_gastos`);
  const q = monthsBack
    ? query(gastosRef, where('periodo', '>=', periodKeyMonthsAgo(monthsBack)))
    : gastosRef;
  const snapshot = await getDocs(q);

  const byPeriod = {}; // { 'YYYY-MM': { total, count, byType: {} } }

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const period = data.periodo;
    if (!period) return;

    if (!byPeriod[period]) byPeriod[period] = { total: 0, count: 0, byType: {} };
    const monto = Number(data.monto) || 0;
    byPeriod[period].total += monto;
    byPeriod[period].count += 1;

    const tipo = data.tipo || 'otro';
    byPeriod[period].byType[tipo] = (byPeriod[period].byType[tipo] || 0) + monto;
  });

  return byPeriod;
}

/**
 * Calcula el valor real de la mercadería en inventario ahora mismo:
 * suma stock × ppp (costo promedio ponderado) de todos los productos en
 * todas las bodegas de la empresa. Mismo patrón de lectura que pricingAgent.js.
 */
async function fetchInventoryValue(companyId) {
  const inventoriesSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
  let totalValue = 0;
  let totalUnits = 0;
  let productCount = 0;

  await Promise.all(inventoriesSnap.docs.map(async (invDoc) => {
    const productsSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`));
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      const stock = Number(data.stock) || 0;
      const cost = Number(data.ppp) || 0;
      if (stock <= 0) return;

      totalValue += stock * cost;
      totalUnits += stock;
      productCount += 1;
    });
  }));

  return { totalValue, totalUnits, productCount };
}

/**
 * Analiza el flujo de caja de una empresa: cruza ventas reales vs gastos
 * operativos cargados, mes a mes. Solo incluye períodos donde hay al menos
 * ventas o gastos registrados (no rellena meses vacíos).
 * @param {object} options
 * @param {string} options.companyId - opcional, si ya se tiene resuelto
 * @param {number|null} options.monthsBack - opcional. Sin este parámetro,
 *   trae TODO el historial (comportamiento de siempre -- lo sigue usando la
 *   página del Agente de Finanzas para el simulador de recuperación de
 *   inversión, que quiere ver tantos meses como haya). Con monthsBack, acota
 *   la query de Firestore a los últimos N meses -- mucho más rápido, pensado
 *   para vistas de resumen como la Sala de Agentes, que solo necesitan el
 *   mes más reciente y no el historial completo.
 */
export async function analyzeCashFlow({ companyId, monthsBack = null } = {}) {
  const resolvedCompanyId = companyId || await getUserCompanyId();
  if (!resolvedCompanyId) {
    throw new Error('No se pudo identificar la empresa del usuario');
  }

  const [salesByPeriod, expensesByPeriod, inventoryValue] = await Promise.all([
    fetchSalesByPeriod(resolvedCompanyId, monthsBack),
    fetchExpensesByPeriod(resolvedCompanyId, monthsBack),
    fetchInventoryValue(resolvedCompanyId)
  ]);

  const allPeriods = [...new Set([...Object.keys(salesByPeriod), ...Object.keys(expensesByPeriod)])]
    .sort(); // 'YYYY-MM' ordena cronológicamente como string

  const months = allPeriods.map(period => {
    const sales = salesByPeriod[period] || { total: 0, count: 0, creditTotal: 0, creditCount: 0 };
    const expenses = expensesByPeriod[period] || { total: 0, count: 0, byType: {} };
    const net = sales.total - expenses.total;
    const creditPct = sales.total > 0 ? Number(((sales.creditTotal / sales.total) * 100).toFixed(1)) : 0;

    return {
      period,
      salesTotal: sales.total,
      salesCount: sales.count,
      creditTotal: sales.creditTotal,
      creditCount: sales.creditCount,
      creditPct,
      expensesTotal: expenses.total,
      expensesCount: expenses.count,
      expensesByType: expenses.byType,
      net,
      hasExpenseData: expenses.count > 0
    };
  });

  const latestMonth = months[months.length - 1] || null;
  const totalCreditExposure = months.reduce((sum, m) => sum + m.creditTotal, 0);

  return {
    months,
    totalCreditExposure,
    inventoryValue,
    latestMonth,
    summary: {
      totalMonths: months.length,
      totalSales: months.reduce((sum, m) => sum + m.salesTotal, 0),
      totalExpenses: months.reduce((sum, m) => sum + m.expensesTotal, 0),
      monthsWithoutExpenseData: months.filter(m => !m.hasExpenseData).length
    }
  };
}

/**
 * Proyecta en cuántos meses se recuperaría un monto de inversión, usando el
 * flujo de caja neto promedio de los meses ya analizados (net = ventas - gastos).
 * Es una SIMULACIÓN: el monto lo escribe la persona en la UI cada vez, nunca
 * se guarda ni se asume — no hay ningún campo de "capital inicial" en Firestore.
 *
 * @param {object} cashFlowAnalysis - resultado de analyzeCashFlow()
 * @param {number} investmentAmount - monto a simular (ej. 40000)
 * @param {number|null} estimatedExpensePct - si se pasa (ej. 15 para 15%), a
 *   los meses SIN gastos reales cargados se les aplica ventas × este % como
 *   gasto estimado, en vez de ignorarlos. Sirve mientras faltan datos reales.
 */
export function projectInvestmentRecovery(cashFlowAnalysis, investmentAmount, estimatedExpensePct = null) {
  const amount = Number(investmentAmount) || 0;
  const { months } = cashFlowAnalysis;

  if (amount <= 0) {
    return { valid: false, reason: 'Ingresa un monto de inversión mayor a 0.' };
  }

  const monthsWithExpenses = months.filter(m => m.hasExpenseData);
  const hasEstimate = Number.isFinite(estimatedExpensePct) && estimatedExpensePct > 0;

  let relevantMonths;
  let estimatedMonthsCount = 0;

  if (hasEstimate) {
    // Usa TODOS los meses: a los que tienen gasto real los deja tal cual,
    // a los que no, les aplica el % estimado sobre sus ventas.
    relevantMonths = months.map(m => {
      if (m.hasExpenseData) return m;
      estimatedMonthsCount += 1;
      const estimatedExpenses = m.salesTotal * (estimatedExpensePct / 100);
      return { ...m, net: m.salesTotal - estimatedExpenses };
    });
  } else {
    // Sin estimado: solo usa meses con dato real de gastos, si existe alguno.
    relevantMonths = monthsWithExpenses.length > 0 ? monthsWithExpenses : months;
  }

  if (relevantMonths.length === 0) {
    return { valid: false, reason: 'No hay suficientes datos de ventas para proyectar.' };
  }

  const avgNet = relevantMonths.reduce((sum, m) => sum + m.net, 0) / relevantMonths.length;

  if (avgNet <= 0) {
    return {
      valid: true,
      avgMonthlyNet: avgNet,
      monthsToRecover: null,
      warning: 'Con el flujo de caja neto actual (negativo o cero), la inversión no se recuperaría manteniendo el ritmo actual.',
      usedRealExpenseData: monthsWithExpenses.length > 0,
      usedEstimate: hasEstimate,
      estimatedMonthsCount
    };
  }

  const monthsToRecover = amount / avgNet;

  return {
    valid: true,
    avgMonthlyNet: avgNet,
    usedEstimate: hasEstimate,
    estimatedMonthsCount,
    monthsToRecover: Number(monthsToRecover.toFixed(1)),
    investmentAmount: amount,
    usedRealExpenseData: monthsWithExpenses.length > 0
  };
}

/**
 * Calcula el margen bruto promedio del negocio HOY: de cada $1 vendido,
 * cuánto queda después de descontar el costo de comprar la mercadería
 * (no incluye gastos operativos — eso es un descuento aparte).
 * Ponderado por el precio de cada producto, no un promedio simple de %,
 * para que un producto caro pese más que uno barato en el cálculo.
 *
 * Limitación real: usa el costo (ppp) ACTUAL de cada producto, no el costo
 * histórico de cada venta pasada (Bodestock no guarda ese dato por venta).
 * Es una aproximación con el margen de hoy, no un cálculo exacto retroactivo.
 *
 * @param {string} companyId
 */
export async function calculateAverageGrossMarginPct(companyId) {
  const { products } = await analyzeProductMargins({ companyId });
  const withPrice = products.filter(p => p.price > 0);

  if (withPrice.length === 0) return null;

  const totalRevenue = withPrice.reduce((sum, p) => sum + p.price, 0);
  const totalProfit = withPrice.reduce((sum, p) => sum + p.profit, 0);

  return totalRevenue > 0 ? Number(((totalProfit / totalRevenue) * 100).toFixed(1)) : null;
}

/**
 * Calcula cuánto se necesita vender por mes para cubrir el COSTO DE LA
 * MERCADERÍA vendida, MÁS los gastos operativos, MÁS la cuota de un
 * préstamo, dado un plazo objetivo. Devuelve el desglose completo paso a
 * paso para poder mostrarlo, no solo el número final.
 *
 * Cadena: de cada venta, primero se va el costo de mercadería (según el
 * margen bruto), lo que queda es "margen bruto en $"; de ahí se va el gasto
 * operativo (% sobre venta); lo que sobra es la ganancia real, y esa
 * ganancia real es la que tiene que alcanzar para pagar la cuota.
 *
 * @param {number} investmentAmount - monto del préstamo/inversión
 * @param {number} termMonths - en cuántos meses se quiere pagar
 * @param {number} expensePct - % de gasto OPERATIVO sobre ventas (0-100)
 * @param {number} grossMarginPct - % de margen BRUTO sobre ventas (0-100),
 *   es decir cuánto queda después del costo de mercadería, antes de gastos.
 */
export function calculateRequiredMonthlySales(investmentAmount, termMonths, expensePct, grossMarginPct) {
  const amount = Number(investmentAmount) || 0;
  const months = Number(termMonths) || 0;
  const expensePctNum = Number(expensePct);
  const grossMarginPctNum = Number(grossMarginPct);

  if (amount <= 0 || months <= 0) {
    return { valid: false, reason: 'Ingresa un monto y un plazo en meses mayores a 0.' };
  }
  if (!Number.isFinite(expensePctNum) || expensePctNum < 0 || expensePctNum >= 100) {
    return { valid: false, reason: 'El % de gasto operativo debe estar entre 0 y 99.' };
  }
  if (!Number.isFinite(grossMarginPctNum) || grossMarginPctNum <= 0 || grossMarginPctNum > 100) {
    return { valid: false, reason: 'No hay margen bruto válido para calcular esto — revisa que haya productos con precio y costo cargados.' };
  }

  const monthlyInstallment = amount / months;

  // De cada $1 vendido: grossMarginPct% es margen bruto, expensePct% se va en
  // gasto operativo. Lo que queda libre para pagar la cuota es esa diferencia.
  const netMarginFraction = (grossMarginPctNum / 100) - (expensePctNum / 100);

  if (netMarginFraction <= 0) {
    return {
      valid: false,
      reason: `Con un margen bruto de ${grossMarginPctNum}% y gastos operativos de ${expensePctNum}% sobre ventas, no queda nada para pagar la cuota — los gastos superan el margen. Hay que bajar costos o subir precios antes de tomar este préstamo.`
    };
  }

  const requiredMonthlySales = monthlyInstallment / netMarginFraction;
  const costOfGoodsAtTarget = requiredMonthlySales * (1 - grossMarginPctNum / 100);
  const grossProfitAtTarget = requiredMonthlySales - costOfGoodsAtTarget;
  const operatingExpensesAtTarget = requiredMonthlySales * (expensePctNum / 100);
  const realProfitAtTarget = grossProfitAtTarget - operatingExpensesAtTarget;

  return {
    valid: true,
    monthlyInstallment,
    requiredMonthlySales,
    costOfGoodsAtTarget,
    grossProfitAtTarget,
    operatingExpensesAtTarget,
    realProfitAtTarget,
    expensePct: expensePctNum,
    grossMarginPct: grossMarginPctNum
  };
}

/**
 * Analiza flujo de caja de TODAS las empresas (uso exclusivo Super Admin).
 * @param {Array<{id: string, name: string}>} companies
 */
export async function analyzeAllCompaniesCashFlow(companies) {
  const results = await Promise.all(
    companies.map(async (company) => {
      try {
        const analysis = await analyzeCashFlow({ companyId: company.id });
        return { companyId: company.id, companyName: company.name, ...analysis };
      } catch (error) {
        return {
          companyId: company.id,
          companyName: company.name,
          error: error.message,
          months: [],
          latestMonth: null,
          summary: { totalMonths: 0, totalSales: 0, totalExpenses: 0, monthsWithoutExpenseData: 0 }
        };
      }
    })
  );

  return {
    companies: results.sort((a, b) => (b.latestMonth?.net || 0) - (a.latestMonth?.net || 0))
  };
}

/**
 * Pide a la IA un análisis razonado del flujo de caja de una empresa,
 * usando SOLO los números ya calculados por este agente (nunca datos crudos
 * de Firestore). Si se pasa `loanSimulation`, lo incluye en el análisis para
 * que la recomendación considere el escenario del préstamo simulado.
 *
 * @param {object} cashFlowAnalysis - resultado de analyzeCashFlow()
 * @param {string} companyName
 * @param {object} [loanSimulation] - resultado de calculateRequiredMonthlySales(),
 *   si el usuario ya corrió esa simulación
 */
export async function getFinanceAIAnalysis(cashFlowAnalysis, companyName, loanSimulation = null) {
  const { months, summary, totalCreditExposure, inventoryValue } = cashFlowAnalysis;

  const monthsText = months
    .map(m => `${m.period}: ventas ${m.salesTotal.toLocaleString('es-CL')}, gastos ${m.hasExpenseData ? m.expensesTotal.toLocaleString('es-CL') : 'SIN DATO'}, neto ${m.net.toLocaleString('es-CL')}${m.creditPct > 0 ? `, ${m.creditPct}% fiado` : ''}`)
    .join('\n');

  let loanText = '';
  if (loanSimulation?.valid) {
    loanText = `\n\nSIMULACIÓN DE PRÉSTAMO QUE EL USUARIO ESTÁ EVALUANDO:
- Cuota mensual: $${Math.round(loanSimulation.monthlyInstallment).toLocaleString('es-CL')}
- Venta mensual necesaria para cubrirla: $${Math.round(loanSimulation.requiredMonthlySales).toLocaleString('es-CL')}
- Margen bruto usado: ${loanSimulation.grossMarginPct}%
- Gasto operativo usado: ${loanSimulation.expensePct}%
- Ganancia real proyectada tras cubrir todo: $${Math.round(loanSimulation.realProfitAtTarget).toLocaleString('es-CL')}`;
  }

  const userPrompt = `Analiza el flujo de caja de "${companyName}", una distribuidora/almacén en Chile.

FLUJO DE CAJA POR MES:
${monthsText}

RESUMEN:
- Ventas totales acumuladas: $${summary.totalSales.toLocaleString('es-CL')}
- Gastos operativos cargados: $${summary.totalExpenses.toLocaleString('es-CL')} (${summary.monthsWithoutExpenseData} de ${summary.totalMonths} meses NO tienen gasto cargado — tenlo en cuenta, esos netos están sobreestimados)
- Fiado acumulado (ventas no cobradas en efectivo): $${totalCreditExposure.toLocaleString('es-CL')}
- Mercadería en inventario hoy: $${(inventoryValue?.totalValue || 0).toLocaleString('es-CL')} (${inventoryValue?.productCount || 0} productos)${loanText}

Da un análisis breve (máximo 4-5 oraciones) en español de Chile, directo y accionable. Si hay una simulación de préstamo, opina explícitamente si el negocio está en condiciones de asumirlo con el ritmo actual, y qué riesgo concreto existe (ej. el fiado, los meses sin dato de gastos, la estacionalidad si se nota en los números). No repitas los números tal cual — interprétalos.`;

  return getAIRecommendation({
    systemPrompt: 'Eres un consultor financiero pragmático que asesora a pequeños negocios y distribuidoras en Chile. Hablas claro, sin jerga innecesaria, y siempre das una opinión concreta, no solo describes los datos.',
    userPrompt
  });
}

/**
 * Igual que getFinanceAIAnalysis, pero con caché en Firestore -- evita
 * pagar una llamada a Claude (y la espera de ~10s) cada vez que se abre el
 * panel del agente, mismo patrón que getInventoryAIAnalysisCached. Solo
 * aplica al análisis automático de "Flujo de caja" (sin simulación de
 * préstamo, que es interactivo y depende de inputs del usuario) -- se
 * reutiliza el último texto guardado si los números no cambiaron desde
 * entonces. Vive en companies/{id}/agent_ai_cache/finance.
 */
export async function getFinanceAIAnalysisCached(cashFlowAnalysis, companyName, companyId) {
  const { summary, totalCreditExposure } = cashFlowAnalysis;
  const signature = `${summary.totalSales}-${summary.totalExpenses}-${summary.monthsWithoutExpenseData}-${Math.round(totalCreditExposure)}`;

  const cacheRef = doc(db, `companies/${companyId}/agent_ai_cache/finance`);
  try {
    const cached = await getDoc(cacheRef);
    if (cached.exists() && cached.data().signature === signature && cached.data().text) {
      return cached.data().text;
    }
  } catch (e) {
    console.warn('No se pudo leer el caché de análisis financiero:', e.message);
  }

  const text = await getFinanceAIAnalysis(cashFlowAnalysis, companyName, null);

  try {
    await setDoc(cacheRef, { signature, text, updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn('No se pudo guardar el caché de análisis financiero:', e.message);
  }

  return text;
}

/**
 * Plantilla de categorías profesionales para presupuestar un préstamo antes
 * de recibirlo — pensado para alguien sin experiencia llevando caja, donde
 * la plata prestada tiende a mezclarse con la venta del día a día y se
 * pierde el rastro de en qué se gastó. Estructura tipo cuenta de resultados
 * de un negocio real (mercadería + gastos operacionales por rubro), no
 * categorías genéricas. Los % son un punto de partida editable, no una
 * regla fija — cada negocio es distinto.
 */
export const LOAN_BUDGET_CATEGORIES = [
  { key: 'mercaderia', label: 'Mercadería nueva', defaultPct: 45, description: 'Comprar stock para vender' },
  { key: 'sueldos', label: 'Sueldos', defaultPct: 15, description: 'Personal, si lo tiene' },
  { key: 'arriendo', label: 'Arriendo', defaultPct: 10, description: 'Local o bodega' },
  { key: 'serviciosBasicos', label: 'Servicios básicos', defaultPct: 5, description: 'Luz, agua, internet' },
  { key: 'insumosOperativos', label: 'Insumos operativos', defaultPct: 5, description: 'Bolsas, embalaje, combustible de reparto' },
  { key: 'deudas', label: 'Deudas / gastos atrasados', defaultPct: 10, description: 'Proveedores o pagos pendientes' },
  { key: 'cuotaPrestamo', label: 'Cuota del préstamo', defaultPct: 5, description: 'Apartada para no atrasarse desde el mes 1' },
  { key: 'imprevistos', label: 'Imprevistos', defaultPct: 5, description: 'Colchón para lo inesperado' }
];

/**
 * Divide un monto de préstamo en categorías de gasto, en pesos, a partir de
 * porcentajes editables por el usuario. Valida que sumen 100% y compara la
 * categoría "cuota mes 1" contra la cuota mensual real ya calculada (si se
 * pasa), para avisar si lo presupuestado no alcanza a cubrirla.
 *
 * @param {number} investmentAmount - monto total del préstamo
 * @param {Object<string, number>} categoryPcts - { key: porcentaje }, debe sumar 100
 * @param {number|null} monthlyInstallment - cuota mensual real, si ya se calculó
 *   con calculateRequiredMonthlySales(), para contrastar contra "cuotaMes1"
 */
export function buildLoanBudget(investmentAmount, categoryPcts, monthlyInstallment = null) {
  const amount = Number(investmentAmount) || 0;
  if (amount <= 0) {
    return { valid: false, reason: 'Ingresa un monto de préstamo mayor a 0.' };
  }

  const totalPct = LOAN_BUDGET_CATEGORIES.reduce((sum, cat) => sum + (Number(categoryPcts[cat.key]) || 0), 0);
  if (Math.round(totalPct) !== 100) {
    return { valid: false, reason: `Los porcentajes suman ${totalPct.toFixed(0)}%, deben sumar exactamente 100%.`, totalPct };
  }

  const breakdown = LOAN_BUDGET_CATEGORIES.map(cat => {
    const pct = Number(categoryPcts[cat.key]) || 0;
    return { ...cat, pct, amount: Math.round(amount * (pct / 100)) };
  });

  let cuotaWarning = null;
  const cuotaPrestamo = breakdown.find(c => c.key === 'cuotaPrestamo');
  if (monthlyInstallment && cuotaPrestamo && cuotaPrestamo.amount < monthlyInstallment) {
    cuotaWarning = `Lo presupuestado para la cuota del préstamo (${cuotaPrestamo.amount.toLocaleString('es-CL')}) no alcanza a cubrir la cuota mensual real (${Math.round(monthlyInstallment).toLocaleString('es-CL')}) — ajusta el % de esa categoría o el de otra.`;
  }

  return {
    valid: true,
    totalPct,
    breakdown,
    cuotaWarning
  };
}
