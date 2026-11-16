// src/agents/payrollAgent.js
// Agente de Sueldos: calcula el sueldo mensual de cada trabajador como
// sueldo base + comisión sobre sus propias ventas del período. Lógica
// pura (sin JSX), mismo estilo que financeAgent.js/pricingAgent.js.
//
// Alcance deliberado (ver conversación con el usuario): esto NO es una
// liquidación de sueldo legal -- no calcula cotizaciones previsionales
// (AFP/salud/cesantía) ni impuesto único, que requieren tablas oficiales
// que cambian todos los años y tienen implicancias legales reales si se
// calculan mal. Es el monto BRUTO a pagar (sueldo base + comisión), útil
// para que el dueño sepa cuánto le corresponde a cada persona antes de
// que eso se procese formalmente (con un contador, o un servicio de
// remuneraciones, cuando el trabajador esté formalizado con contrato).
//
// Fuentes de datos reales (Bodestock):
// 1. companies/{id}/workers — baseSalary (CLP, opcional) y
//    commissionPercent (%, opcional) por trabajador.
// 2. companies/{id}/inventory_exits (reason: 'SALE', workerId: <id>) —
//    ventas de esa persona en el período. Campo de monto: totalValue.
//    La comisión se aplica sobre el monto SIN IVA (totalValue / 1.19),
//    mismo criterio ya usado en WorkersManagement.jsx para no comisionar
//    sobre el IVA que hay que devolver al Estado.
import { db } from '../firebase/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

const IVA_FACTOR = 1.19;

function toPeriodRange(monthsBack) {
  const since = new Date();
  since.setDate(1);
  since.setMonth(since.getMonth() - (monthsBack - 1));
  since.setHours(0, 0, 0, 0);
  return since;
}

/**
 * Ventas netas (sin IVA) por trabajador en los últimos `monthsBack` meses
 * (o todo el historial si no se pasa). Solo cuenta ventas completadas
 * (reason SALE, no canceladas) que tengan workerId.
 */
async function fetchNetSalesByWorker(companyId, monthsBack = null) {
  const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
  const clauses = [where('reason', '==', 'SALE')];
  if (monthsBack) {
    clauses.push(where('createdAt', '>=', Timestamp.fromDate(toPeriodRange(monthsBack))));
  }
  const snapshot = await getDocs(query(exitsRef, ...clauses));

  const byWorker = {}; // { workerId: { netSales, saleCount } }
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'cancelled') return;
    if (!data.workerId) return;

    const net = (Number(data.totalValue) || 0) / IVA_FACTOR;
    if (!byWorker[data.workerId]) byWorker[data.workerId] = { netSales: 0, saleCount: 0 };
    byWorker[data.workerId].netSales += net;
    byWorker[data.workerId].saleCount += 1;
  });
  return byWorker;
}

/**
 * Calcula el sueldo bruto (base + comisión) de cada trabajador de la
 * empresa para el período pedido.
 * @param {object} params
 * @param {string} params.companyId
 * @param {number} [params.monthsBack] - si se pasa, acota las ventas a
 *   los últimos N meses (ej. 1 para "este mes"); sin esto, todo el
 *   historial de ventas de cada trabajador.
 * @returns {Promise<{ workers: Array, summary: object }>}
 */
export async function calculatePayroll({ companyId, monthsBack = 1 }) {
  const [workersSnap, netSalesByWorker] = await Promise.all([
    getDocs(collection(db, `companies/${companyId}/workers`)),
    fetchNetSalesByWorker(companyId, monthsBack),
  ]);

  const workers = workersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((w) => w.isActive !== false)
    .map((w) => {
      const baseSalary = Number(w.baseSalary) || 0;
      const commissionPercent = Number(w.commissionPercent) || 0;
      const sales = netSalesByWorker[w.id] || { netSales: 0, saleCount: 0 };
      const commissionAmount = sales.netSales * (commissionPercent / 100);
      return {
        id: w.id,
        name: w.name,
        role: w.role,
        baseSalary,
        commissionPercent,
        netSales: sales.netSales,
        saleCount: sales.saleCount,
        commissionAmount,
        totalPay: baseSalary + commissionAmount,
      };
    })
    // Solo trabajadores con algo configurado (sueldo base o comisión) --
    // alguien sin ninguno de los dos no tiene un sueldo que calcular acá.
    .filter((w) => w.baseSalary > 0 || w.commissionPercent > 0);

  const summary = {
    workerCount: workers.length,
    totalBaseSalaries: workers.reduce((sum, w) => sum + w.baseSalary, 0),
    totalCommissions: workers.reduce((sum, w) => sum + w.commissionAmount, 0),
    totalPayroll: workers.reduce((sum, w) => sum + w.totalPay, 0),
  };

  return { workers: workers.sort((a, b) => b.totalPay - a.totalPay), summary };
}
