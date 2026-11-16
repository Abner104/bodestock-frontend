// src/agents/bankReconciliationAgent.js
// Agente de Conciliación Bancaria -- cruza los movimientos de una cartola
// (Excel/CSV descargado de la banca en línea) contra las ventas
// (inventory_exits) y gastos (gestion_gastos) que ya existen en el
// sistema, y reporta lo que NO calza -- no reemplaza al banco ni a un
// contador, solo señala discrepancias para que el dueño las revise.
//
// No hay un formato único de cartola: cada banco chileno nombra sus
// columnas distinto ("Fecha"/"Fecha Movimiento", "Monto"/"Cargo"/"Abono").
// En vez de asumir nombres fijos, se sugiere el mapeo de columnas por
// coincidencia de palabras clave (mismo patrón que ImportExcelModal.jsx
// usa para inventario) y el usuario confirma/corrige antes de procesar --
// nunca se asume una lectura sin que alguien la confirme primero, porque
// una columna mal mapeada acá arruinaría todo el cruce en silencio.
//
// Fuentes de datos reales (Bodestock):
// 1. El archivo que sube el usuario (no persiste en Firestore -- se lee,
//    se cruza, se muestra, y se descarta; no hay necesidad de guardar la
//    cartola completa del banco).
// 2. companies/{id}/inventory_exits (reason 'SALE') -- para emparejar
//    abonos (dinero que entró).
// 3. companies/{id}/gestion_gastos -- para emparejar cargos (dinero que
//    salió).

import { db } from '../firebase/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

// Tolerancia para considerar que un movimiento del banco "es" una venta o
// gasto ya registrado -- las cartolas pueden tener comisiones/redondeos
// menores, y la fecha de abono no siempre es exactamente la del día de
// venta (ej. pagos con tarjeta que acreditan al día siguiente).
const AMOUNT_TOLERANCE_CLP = 500;
const DATE_TOLERANCE_DAYS = 2;

// ---- Detección de columnas ----
// Devuelve la clave sugerida ('date' | 'charge' | 'deposit' | 'amount' |
// 'description') para un encabezado de columna, o '' si no reconoce nada.
// 'amount' es una sola columna con signo (+/-); 'charge'/'deposit' son dos
// columnas separadas (patrón más común en bancos chilenos) -- nunca se
// asume cuál usa el archivo, se detectan ambos patrones y se decide según
// qué columnas aparecen realmente.
export function suggestColumnMapping(header) {
  const h = (header || '').toLowerCase().trim();

  if (h.includes('fecha') || h === 'date') return 'date';
  if (h.includes('cargo') || h.includes('debito') || h.includes('débito') || h === 'charge') return 'charge';
  if (h.includes('abono') || h.includes('credito') || h.includes('crédito') || h === 'deposit') return 'deposit';
  if (h.includes('monto') || h.includes('valor') || h === 'amount') return 'amount';
  if (h.includes('descripcion') || h.includes('descripción') || h.includes('detalle') || h.includes('glosa')) return 'description';

  return '';
}

function parseAmount(raw) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  // Cartolas chilenas suelen venir como "$ 1.234" o "1.234,56" -- se quita
  // separador de miles (punto) y símbolo de moneda, se normaliza la coma
  // decimal a punto.
  const cleaned = String(raw).replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return raw;
  // Excel a veces entrega un número serial de fecha en vez de texto --
  // XLSX.utils.sheet_to_json con raw:true puede devolver esto.
  if (typeof raw === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + raw * 24 * 60 * 60 * 1000);
  }
  const str = String(raw).trim();
  // dd-mm-yyyy o dd/mm/yyyy (formato chileno habitual)
  const chileanMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (chileanMatch) {
    const [, d, m, y] = chileanMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return new Date(Number(year), Number(m) - 1, Number(d));
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Convierte las filas crudas del Excel (array de arrays, primera fila =
 * encabezados) en movimientos normalizados { date, amount, type, description },
 * usando el mapeo de columnas ya confirmado por el usuario.
 * @param {Array<Array>} rows - filas de datos, SIN el encabezado
 * @param {Object} mapping - { date: 'Fecha', charge: 'Cargo', deposit: 'Abono', ... }
 *   o { date: 'Fecha', amount: 'Monto', description: 'Detalle' } si el banco
 *   usa una sola columna con signo.
 * @param {Array<string>} headers - encabezados en el mismo orden que las filas
 */
export function parseStatementRows(rows, mapping, headers) {
  const colIndex = (key) => headers.indexOf(mapping[key]);
  const dateIdx = colIndex('date');
  const chargeIdx = colIndex('charge');
  const depositIdx = colIndex('deposit');
  const amountIdx = colIndex('amount');
  const descIdx = colIndex('description');

  return rows
    .map((row) => {
      const date = dateIdx >= 0 ? parseDate(row[dateIdx]) : null;
      const description = descIdx >= 0 ? String(row[descIdx] || '').trim() : '';

      let amount = 0;
      let type = null; // 'charge' (salió plata) | 'deposit' (entró plata)

      if (chargeIdx >= 0 || depositIdx >= 0) {
        const charge = chargeIdx >= 0 ? parseAmount(row[chargeIdx]) : 0;
        const deposit = depositIdx >= 0 ? parseAmount(row[depositIdx]) : 0;
        if (charge > 0) { amount = charge; type = 'charge'; }
        else if (deposit > 0) { amount = deposit; type = 'deposit'; }
      } else if (amountIdx >= 0) {
        const raw = parseAmount(row[amountIdx]);
        amount = Math.abs(raw);
        type = raw < 0 ? 'charge' : 'deposit';
      }

      return { date, amount, type, description };
    })
    .filter((m) => m.date && m.amount > 0 && m.type);
}

async function fetchSalesInRange(companyId, minDate, maxDate) {
  const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
  const snap = await getDocs(query(
    exitsRef,
    where('reason', '==', 'SALE'),
    where('createdAt', '>=', Timestamp.fromDate(minDate)),
    where('createdAt', '<=', Timestamp.fromDate(maxDate))
  ));
  return snap.docs
    .map((d) => d.data())
    .filter((d) => d.status !== 'cancelled')
    .map((d) => ({ date: d.createdAt?.toDate?.(), amount: Number(d.totalValue) || 0 }))
    .filter((s) => s.date);
}

async function fetchExpensesInPeriods(companyId, periodKeys) {
  // Firestore limita 'in' a 10 valores -- una cartola normal (1-2 meses)
  // nunca lo alcanza, pero si alguien sube una de más de 10 meses de una
  // sola vez, se recorta a los primeros 10 en vez de fallar la consulta
  // entera; es un caso extremo que no debería bloquear el resto.
  const gastosRef = collection(db, `companies/${companyId}/gestion_gastos`);
  const snap = await getDocs(query(gastosRef, where('periodo', 'in', periodKeys.slice(0, 10))));
  return snap.docs.map((d) => ({ amount: Number(d.data().monto) || 0, tipo: d.data().tipo }));
}

function isMatch(movementDate, movementAmount, candidateDate, candidateAmount) {
  const amountDiff = Math.abs(movementAmount - candidateAmount);
  if (amountDiff > AMOUNT_TOLERANCE_CLP) return false;
  if (!candidateDate) return true; // gastos no siempre tienen fecha exacta, solo período
  const dayDiff = Math.abs(movementDate.getTime() - candidateDate.getTime()) / (24 * 60 * 60 * 1000);
  return dayDiff <= DATE_TOLERANCE_DAYS;
}

/**
 * Cruza los movimientos ya parseados de la cartola contra ventas y gastos
 * reales, y devuelve qué no calzó de cada lado.
 * @param {object} params
 * @param {string} params.companyId
 * @param {Array<{date: Date, amount: number, type: 'charge'|'deposit', description: string}>} params.movements
 */
export async function reconcileStatement({ companyId, movements }) {
  if (!movements.length) {
    return { unmatchedDeposits: [], unmatchedCharges: [], matchedCount: 0 };
  }

  const dates = movements.map((m) => m.date.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  minDate.setDate(minDate.getDate() - DATE_TOLERANCE_DAYS);
  maxDate.setDate(maxDate.getDate() + DATE_TOLERANCE_DAYS);

  const periodKeys = [...new Set(movements.map((m) => `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}`))];

  const [sales, expenses] = await Promise.all([
    fetchSalesInRange(companyId, minDate, maxDate),
    fetchExpensesInPeriods(companyId, periodKeys),
  ]);

  const usedSales = new Set();
  const usedExpenses = new Set();
  const unmatchedDeposits = [];
  const unmatchedCharges = [];
  let matchedCount = 0;

  movements.forEach((m) => {
    if (m.type === 'deposit') {
      const matchIdx = sales.findIndex((s, i) => !usedSales.has(i) && isMatch(m.date, m.amount, s.date, s.amount));
      if (matchIdx >= 0) { usedSales.add(matchIdx); matchedCount += 1; }
      else unmatchedDeposits.push(m);
    } else {
      const matchIdx = expenses.findIndex((e, i) => !usedExpenses.has(i) && isMatch(m.date, m.amount, null, e.amount));
      if (matchIdx >= 0) { usedExpenses.add(matchIdx); matchedCount += 1; }
      else unmatchedCharges.push(m);
    }
  });

  return { unmatchedDeposits, unmatchedCharges, matchedCount };
}
