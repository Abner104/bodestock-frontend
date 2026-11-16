// src/agents/accountingAgent.js
// Agente de Contabilidad — Fase 1 (Auditor). Lógica pura (sin JSX), mismo
// estilo que financeAgent.js/pricingAgent.js/inventoryAgent.js.
//
// Alcance deliberado (ver conversación con el usuario): esto NO declara
// impuestos, NO calcula IVA/renta, NO reemplaza a un contador. Es un
// auditor que revisa datos que YA existen en el sistema y señala cosas
// concretas que un contador humano marcaría al mirar los números una vez
// al mes -- pero corriendo todos los días, no una vez al mes con retraso.
// Cada regla usa datos que el dueño ya cargó (nunca inventa ni proyecta
// sobre algo que no esté en Firestore).
//
// Deliberadamente NO duplica lo que ya calculan otros agentes: el fiado
// (ventas a crédito) es dueño de Finanzas (financeAgent.js), y los
// productos vendiéndose con pérdida son dueños de Pricing
// (pricingAgent.js) -- Contabilidad no repite esos hallazgos, cada dato
// vive en un solo agente. Si en algún momento se quiere un resumen
// cruzado, debe leer el resultado de esos agentes, no recalcularlo.
//
// Fuentes de datos reales (Bodestock):
// 1. companies/{id}/facturas_proveedores — facturas subidas (url, monto,
//    periodo 'YYYY-MM', estado 'pendiente'|'confirmado').
// 2. companies/{id}/gestion_gastos — gastos operativos por tipo (uno de
//    GASTO_TIPOS en SuperAdminGestion.jsx, incluye 'sueldos') y periodo.
// 3. companies/{id}/inventory_exits (reason 'SALE') — ventas del mes.
// 4. payrollAgent.js (calculatePayroll) — sueldo base + comisión que
//    Bodestock calcula que corresponde pagar este mes.
import { db } from '../firebase/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { calculatePayroll } from './payrollAgent';

function currentPeriodKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatCLP(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value || 0);
}

// ---- Regla 1 y 2: facturas sin monto / sin confirmar ----
async function checkInvoices(companyId, periodKey) {
  const snap = await getDocs(collection(db, `companies/${companyId}/facturas_proveedores`));
  const findings = [];

  const missingAmount = snap.docs.filter((d) => d.data().periodo === periodKey && (Number(d.data().monto) || 0) === 0);
  if (missingAmount.length > 0) {
    findings.push({
      id: 'invoices-missing-amount',
      severity: 'warning',
      title: 'Facturas sin monto cargado',
      detail: `Tienes ${missingAmount.length} factura${missingAmount.length === 1 ? '' : 's'} de este mes sin el monto cargado — no están contando en tus gastos reales todavía.`,
      count: missingAmount.length,
    });
  }

  const pending = snap.docs.filter((d) => d.data().periodo === periodKey && d.data().estado === 'pendiente');
  if (pending.length > 0) {
    findings.push({
      id: 'invoices-pending',
      severity: 'info',
      title: 'Facturas pendientes de confirmar',
      detail: `Tienes ${pending.length} factura${pending.length === 1 ? '' : 's'} de este mes que subiste pero nunca confirmaste — revísalas antes de cerrar el mes.`,
      count: pending.length,
    });
  }

  return findings;
}

// ---- Regla 3: gasto de "sueldos" vs. lo que Bodestock calcula ----
async function checkPayrollMismatch(companyId, periodKey) {
  const [gastosSnap, payroll] = await Promise.all([
    getDocs(query(collection(db, `companies/${companyId}/gestion_gastos`), where('periodo', '==', periodKey))),
    calculatePayroll({ companyId, monthsBack: 1 }).catch(() => null),
  ]);
  if (!payroll || payroll.summary.totalPayroll === 0) return [];

  const declaredSalaries = gastosSnap.docs
    .filter((d) => d.data().tipo === 'sueldos')
    .reduce((sum, d) => sum + (Number(d.data().monto) || 0), 0);

  const expected = payroll.summary.totalPayroll;
  const diff = Math.abs(declaredSalaries - expected);
  // Tolerancia del 5% -- evita ruido por redondeos o pagos parciales
  // menores, y solo avisa cuando la diferencia es significativa.
  if (diff / Math.max(expected, 1) < 0.05) return [];

  return [{
    id: 'payroll-mismatch',
    severity: 'warning',
    title: 'El gasto de sueldos no coincide con lo calculado',
    detail: `Cargaste ${formatCLP(declaredSalaries)} en gastos de sueldos este mes, pero según los sueldos base y comisiones configurados en Trabajadores debería ser ${formatCLP(expected)} — revisa si falta cargar algo o si alguien no tiene su sueldo bien configurado.`,
    declaredSalaries,
    expected,
  }];
}

// ---- Regla 5: mes con ventas pero sin ningún gasto cargado ----
async function checkMonthWithoutExpenses(companyId, periodKey) {
  const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [salesSnap, gastosSnap] = await Promise.all([
    getDocs(query(exitsRef, where('reason', '==', 'SALE'), where('createdAt', '>=', Timestamp.fromDate(since)))),
    getDocs(query(collection(db, `companies/${companyId}/gestion_gastos`), where('periodo', '==', periodKey))),
  ]);

  const salesTotal = salesSnap.docs.reduce((sum, d) => {
    const data = d.data();
    if (data.status === 'cancelled') return sum;
    return sum + (Number(data.totalValue) || 0);
  }, 0);

  if (salesTotal === 0 || gastosSnap.size > 0) return [];
  return [{
    id: 'month-without-expenses',
    severity: 'warning',
    title: 'Mes sin gastos operativos cargados',
    detail: `Este mes vendiste ${formatCLP(salesTotal)} pero no cargaste ningún gasto operativo (arriendo, sueldos, servicios, etc.) en Control de Gestión — el flujo de caja no está descontando eso, así que no representa la ganancia real. Esto es aparte de las compras de mercadería, que ya se están contando.`,
    salesTotal,
  }];
}

// IVA Chile: 19%. Los montos guardados (ventas y facturas) incluyen IVA,
// así que para sacar el neto se divide por 1.19 -- mismo criterio que
// payrollAgent.js usa para la comisión sobre ventas netas.
const IVA_RATE = 0.19;
const IVA_DIVISOR = 1.19;

/**
 * Inversión en mercadería del período: suma el totalPrice de cada compra
 * registrada en el `history` embebido de cada producto (companies/{id}/
 * inventories/{invId}/products/{prodId}.history), en TODOS los inventarios
 * de la empresa. Es la misma fuente y el mismo criterio de filtrado que ya
 * usa SuperAdminGestion.jsx ("Invertido en mercadería") -- se replica acá
 * en vez de depender de companies/{id}/purchases (colección nueva, solo
 * tiene compras registradas desde que se agregó ese registro, sin
 * historial retroactivo).
 */
async function computeInventoryPurchasesTotal(companyId, periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);

  const invSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
  const productSnaps = await Promise.all(
    invSnap.docs.map((invDoc) => getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`)))
  );

  let total = 0;
  productSnaps.forEach((prodSnap) => {
    prodSnap.docs.forEach((prodDoc) => {
      const history = prodDoc.data().history || [];
      history.forEach((h) => {
        if (h.type === 'shrinkage' || h.type === 'exit') return;
        if (h.reason === 'SALE' || h.reason === 'sale') return;
        if (!h.totalPrice || h.totalPrice <= 0) return;
        const fecha = h.date ? new Date(h.date) : null;
        if (!fecha || isNaN(fecha.getTime())) return;
        if (fecha < startOfMonth || fecha > endOfMonth) return;
        total += h.totalPrice;
      });
    });
  });
  return total;
}

/**
 * Estima el IVA a pagar del mes: débito fiscal (19% de las ventas netas)
 * menos crédito fiscal (19% de las compras netas, solo facturas
 * confirmadas del período). Es una ESTIMACIÓN para que el dueño no se
 * sorprenda -- nunca se declara ni se envía al SII, eso lo hace el
 * contador con los datos reales y la documentación completa.
 * @param {object} params
 * @param {string} params.companyId
 */
export async function estimateMonthlyVAT({ companyId }) {
  const periodKey = currentPeriodKey();
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [salesSnap, invoicesSnap, inventoryPurchasesTotalWithVat] = await Promise.all([
    getDocs(query(
      collection(db, `companies/${companyId}/inventory_exits`),
      where('reason', '==', 'SALE'),
      where('createdAt', '>=', Timestamp.fromDate(since))
    )),
    getDocs(collection(db, `companies/${companyId}/facturas_proveedores`)),
    computeInventoryPurchasesTotal(companyId, periodKey),
  ]);

  const salesTotalWithVat = salesSnap.docs.reduce((sum, d) => {
    const data = d.data();
    if (data.status === 'cancelled') return sum;
    return sum + (Number(data.totalValue) || 0);
  }, 0);

  // Crédito fiscal: suma las facturas de proveedores confirmadas (subidas
  // a mano en Mi Consultor) MÁS la inversión en mercadería del mes
  // (history de cada producto, ver computeInventoryPurchasesTotal) -- son
  // dos fuentes distintas que en la práctica no se solapan: la dueña carga
  // el stock en "Compra" y las facturas (fotos) todavía no siempre se
  // suben aparte.
  const invoicesTotalWithVat = invoicesSnap.docs
    .filter((d) => d.data().periodo === periodKey && d.data().estado === 'confirmado')
    .reduce((sum, d) => sum + (Number(d.data().monto) || 0), 0);

  const purchasesTotalWithVat = invoicesTotalWithVat + inventoryPurchasesTotalWithVat;

  const salesNet = salesTotalWithVat / IVA_DIVISOR;
  const purchasesNet = purchasesTotalWithVat / IVA_DIVISOR;
  const debitoFiscal = salesNet * IVA_RATE;
  const creditoFiscal = purchasesNet * IVA_RATE;
  const estimatedVAT = Math.max(debitoFiscal - creditoFiscal, 0);
  const favorableBalance = creditoFiscal > debitoFiscal ? creditoFiscal - debitoFiscal : 0;

  return {
    periodKey,
    salesTotalWithVat,
    purchasesTotalWithVat,
    invoicesTotalWithVat,
    inventoryPurchasesTotalWithVat,
    salesNet,
    purchasesNet,
    debitoFiscal,
    creditoFiscal,
    estimatedVAT,
    favorableBalance,
  };
}

/**
 * Corre las 4 reglas de auditoría contable para una empresa y devuelve los
 * hallazgos encontrados (array vacío si no hay nada que señalar). Cada
 * regla se resuelve por separado con Promise.allSettled: si una falla
 * (ej. sin datos todavía), las demás igual se evalúan.
 * @param {object} params
 * @param {string} params.companyId
 */
export async function auditAccounting({ companyId }) {
  const periodKey = currentPeriodKey();

  const results = await Promise.allSettled([
    checkInvoices(companyId, periodKey),
    checkPayrollMismatch(companyId, periodKey),
    checkMonthWithoutExpenses(companyId, periodKey),
  ]);

  const findings = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  return {
    periodKey,
    findings,
    summary: {
      total: findings.length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    },
  };
}

/**
 * Cierre de mes: un solo resumen con ventas, gastos (por tipo), sueldos,
 * IVA estimado y los hallazgos de auditoría del período -- para que el
 * dueño revise todo junto antes de pasárselo a su contador. No inventa ni
 * recalcula nada nuevo: junta lo que ya calculan auditAccounting,
 * estimateMonthlyVAT y calculatePayroll, y agrega el desglose de gastos
 * por tipo (el único dato que ninguna de esas tres exponía todavía).
 * @param {object} params
 * @param {string} params.companyId
 */
export async function getMonthClose({ companyId }) {
  const periodKey = currentPeriodKey();

  const [audit, vat, payroll, gastosSnap] = await Promise.all([
    auditAccounting({ companyId }),
    estimateMonthlyVAT({ companyId }).catch(() => null),
    calculatePayroll({ companyId, monthsBack: 1 }).catch(() => null),
    getDocs(query(collection(db, `companies/${companyId}/gestion_gastos`), where('periodo', '==', periodKey))),
  ]);

  const expensesByType = {};
  let operatingExpenses = 0;
  gastosSnap.docs.forEach((d) => {
    const data = d.data();
    const monto = Number(data.monto) || 0;
    expensesByType[data.tipo] = (expensesByType[data.tipo] || 0) + monto;
    operatingExpenses += monto;
  });

  // Inversión en mercadería (lo que costó reponer stock, ver
  // estimateMonthlyVAT/computeInventoryPurchasesTotal) -- sin esto el
  // resultado del mes queda inflado, porque nunca se descuenta lo que se
  // gastó en comprar lo que después se vendió. Mismo criterio que
  // "Resultado operacional" en SuperAdminGestion.jsx (Control de Gestión).
  const merchandiseInvestment = vat?.purchasesTotalWithVat || 0;
  const totalExpenses = operatingExpenses + merchandiseInvestment;

  const salesTotal = vat?.salesTotalWithVat || 0;
  const netResult = salesTotal - totalExpenses;

  return {
    periodKey,
    salesTotal,
    totalExpenses,
    operatingExpenses,
    merchandiseInvestment,
    expensesByType,
    netResult,
    payroll: payroll ? { totalPayroll: payroll.summary.totalPayroll, workers: payroll.workers } : null,
    vat,
    findings: audit.findings,
  };
}

/**
 * Libro de compras y ventas del período: un renglón por cada venta y por
 * cada factura de proveedor confirmada, con fecha, folio, RUT (cuando el
 * sistema los tiene), monto neto e IVA -- para que el contador arme el
 * libro oficial con esto como base, no lo reemplaza (no es lo que se
 * declara al SII, ver conversación con el usuario sobre alcance).
 *
 * Folio y RUT de VENTAS ya existen en el sistema cuando se emitió
 * documento tributario vía SimpleFactura (inventory_exits.boleta.folio y
 * .customerRut, ver InventoryExit.jsx) -- se leen tal cual, nunca se
 * inventan. Folio y RUT de COMPRAS los carga el consultor a mano al
 * revisar cada factura subida (ver SuperAdminGestion.jsx:
 * guardarFolioYRutFactura) -- pueden venir vacíos si todavía no se
 * cargaron.
 * @param {object} params
 * @param {string} params.companyId
 */
export async function getPurchaseSalesBook({ companyId }) {
  const periodKey = currentPeriodKey();
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [salesSnap, invoicesSnap] = await Promise.all([
    getDocs(query(
      collection(db, `companies/${companyId}/inventory_exits`),
      where('reason', '==', 'SALE'),
      where('createdAt', '>=', Timestamp.fromDate(since))
    )),
    getDocs(collection(db, `companies/${companyId}/facturas_proveedores`)),
  ]);

  const sales = salesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.status !== 'cancelled')
    .map((s) => {
      const totalWithVat = Number(s.totalValue) || 0;
      const net = totalWithVat / IVA_DIVISOR;
      return {
        id: s.id,
        date: s.createdAt?.toDate ? s.createdAt.toDate() : null,
        folio: s.boleta?.folio || null,
        customerName: s.customerName || null,
        customerRut: s.customerRut || null,
        netAmount: Math.round(net),
        vatAmount: Math.round(totalWithVat - net),
        totalAmount: Math.round(totalWithVat),
      };
    })
    .sort((a, b) => (a.date && b.date ? a.date - b.date : 0));

  const purchases = invoicesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((f) => f.periodo === periodKey && f.estado === 'confirmado')
    .map((f) => {
      const totalWithVat = Number(f.monto) || 0;
      const net = totalWithVat / IVA_DIVISOR;
      return {
        id: f.id,
        date: f.creadoAt?.toDate ? f.creadoAt.toDate() : null,
        folio: f.folio || null,
        supplierRut: f.rut || null,
        fileName: f.fileName || null,
        netAmount: Math.round(net),
        vatAmount: Math.round(totalWithVat - net),
        totalAmount: Math.round(totalWithVat),
      };
    })
    .sort((a, b) => (a.date && b.date ? a.date - b.date : 0));

  return {
    periodKey,
    sales,
    purchases,
    summary: {
      salesCount: sales.length,
      salesTotal: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      purchasesCount: purchases.length,
      purchasesTotal: purchases.reduce((sum, p) => sum + p.totalAmount, 0),
      missingFolioSalesCount: sales.filter((s) => !s.folio).length,
      missingFolioPurchasesCount: purchases.filter((p) => !p.folio).length,
    },
  };
}
