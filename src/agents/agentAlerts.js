// src/agents/agentAlerts.js
// Helper cliente para las notificaciones persistentes de la Sala de Agentes.
// Lee/escribe companies/{companyId}/agent_alerts, generadas por la Cloud
// Function programada dailyAgentAnalysisScheduled (functions/index.js).
// Lógica pura de acceso a datos, sin JSX — igual que pricingAgent.js/financeAgent.js.

import { db } from '../firebase/firebase';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Busca empresas cuyo nombre contenga el texto dado (case-insensitive).
 * Mismo criterio "contiene" que usa la Cloud Function (TARGET_COMPANY_NAME_PATTERN)
 * para resolver la empresa objetivo sin depender de un companyId hardcodeado.
 * @param {string} namePattern - ej. "L&N"
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function findCompaniesByName(namePattern) {
  const snap = await getDocs(collection(db, 'companies'));
  const pattern = namePattern.toLowerCase();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => (c.name || '').toLowerCase().includes(pattern));
}

/**
 * Trae todas las alertas de agentes de una empresa, más nuevas primero.
 * @param {string} companyId
 */
export async function fetchAlerts(companyId) {
  if (!companyId) return [];
  const alertsRef = collection(db, `companies/${companyId}/agent_alerts`);
  const q = query(alertsRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Cuenta cuántas alertas sin leer tiene una empresa (para el badge de la campana).
 * @param {string} companyId
 */
export async function fetchUnreadAlertsCount(companyId) {
  if (!companyId) return 0;
  const alertsRef = collection(db, `companies/${companyId}/agent_alerts`);
  const q = query(alertsRef, where('read', '==', false));
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Marca una alerta como leída.
 * @param {string} companyId
 * @param {string} alertId
 */
export async function markAlertRead(companyId, alertId) {
  if (!companyId || !alertId) return;
  const ref = doc(db, `companies/${companyId}/agent_alerts/${alertId}`);
  await updateDoc(ref, { read: true, readAt: serverTimestamp() });
}

/**
 * Cuenta las alertas sin leer de una empresa, agrupadas por agente que las
 * originó (pricing/finance/inventory/marketing) — para mostrar un badge
 * independiente en cada tarjeta de la Sala de Agentes, no solo un total.
 * @param {string} companyId
 * @returns {Promise<Object<string, number>>} ej. { pricing: 2, finance: 1 }
 */
export async function fetchUnreadAlertsCountByAgent(companyId) {
  if (!companyId) return {};
  const alertsRef = collection(db, `companies/${companyId}/agent_alerts`);
  const q = query(alertsRef, where('read', '==', false));
  const snap = await getDocs(q);

  const counts = {};
  snap.forEach(doc => {
    const agentId = doc.data().agentId;
    if (!agentId) return;
    counts[agentId] = (counts[agentId] || 0) + 1;
  });
  return counts;
}

/**
 * Escribe en agent_alerts los hallazgos de una auditoría EN VIVO (ej.
 * accountingAgent.js) que todavía no tengan una alerta sin leer -- a
 * diferencia de dailyAgentAnalysisScheduled (una corrida al día, generada
 * en el backend), esto se llama cada vez que el usuario abre el panel de
 * un agente en el navegador. Sin deduplicar, cada apertura del panel
 * crearía una alerta nueva idéntica.
 *
 * Deduplica por findingId (el id fijo de cada regla, ej.
 * 'invoices-missing-amount') + mes calendario: si ya existe una alerta con
 * ese findingId creada este mes (leída o no), no se crea otra -- el
 * hallazgo sigue vigente, no hace falta repetirlo. Comparar solo contra
 * las NO LEÍDAS reabriría el mismo hallazgo apenas el usuario lo marca
 * como leído (justo lo que se quiere evitar); comparar contra todas las
 * del mes, leídas o no, es lo que de verdad evita el duplicado. Si el
 * hallazgo desaparece un mes y vuelve el siguiente, sí genera una alerta
 * nueva (es información nueva para ese período).
 *
 * @param {string} companyId
 * @param {string} agentId - ej. 'accounting'
 * @param {Array<{id: string, title: string, detail: string, severity: string}>} findings
 */
export async function syncLiveAlerts(companyId, agentId, findings) {
  if (!companyId || !agentId || !findings?.length) return;

  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const alertsRef = collection(db, `companies/${companyId}/agent_alerts`);

  const existingSnap = await getDocs(query(alertsRef, where('agentId', '==', agentId), where('periodKey', '==', periodKey)));
  const existingFindingIds = new Set(existingSnap.docs.map((d) => d.data().findingId));

  await Promise.all(
    findings
      .filter((f) => !existingFindingIds.has(f.id))
      .map((f) => addDoc(alertsRef, {
        agentId,
        findingId: f.id,
        periodKey,
        summary: `${f.title} — ${f.detail}`,
        severity: f.severity === 'warning' ? 'warning' : 'info',
        createdAt: serverTimestamp(),
        read: false,
        readAt: null,
      }))
  );
}

/**
 * Cuenta las alertas que cada agente ya despachó (marcadas como leídas) DENTRO
 * DEL MES CALENDARIO ACTUAL. No hay un contador separado en Firestore -- se
 * deriva del campo `readAt` que markAlertRead ya guarda en cada alerta, así
 * que el "reseteo mensual" es automático: en enero no cuenta nada de
 * diciembre, sin necesidad de ningún cron ni de borrar datos.
 * Pensado para la pila de papeles del ícono de tareas en la Sala de Agentes.
 * @param {Array} alerts - resultado de fetchAlerts(companyId), ya cargado
 * @returns {Object<string, number>} ej. { pricing: 4, finance: 1 }
 */
export function countReadThisMonthByAgent(alerts) {
  const now = new Date();
  const counts = {};
  (alerts || []).forEach(alert => {
    if (!alert.read || !alert.agentId) return;
    const readDate = alert.readAt?.toDate?.();
    if (!readDate) return;
    if (readDate.getFullYear() !== now.getFullYear() || readDate.getMonth() !== now.getMonth()) return;
    counts[alert.agentId] = (counts[alert.agentId] || 0) + 1;
  });
  return counts;
}
