// src/hooks/useAgentRealStatus.js
// Estado y resumen REAL de los agentes (Pricing, Finanzas, Inventario,
// Marketing, Contabilidad) para una empresa -- misma fuente de datos que ya
// usaba SuperAdminAgentRoom.jsx (Bodestock HQ, el mundo 3D) para su panel
// lateral, extraída acá para que Bodestock World (el mapa 2D) pueda
// mostrar lo mismo sin duplicar la lógica de negocio ni recalcularla dos
// veces con criterios distintos.
//
// "status" es un mapeo de esos números reales a AGENT_STATUS (ver
// data/agents.js) -- son umbrales de producto, no un dato que devuelva
// ningún agente: alguien tiene que decidir qué cuenta como ALERT vs
// WORKING, y ese criterio vive acá, en un solo lugar.
import { useEffect, useState } from 'react';
import { analyzeProductMargins } from '../agents/pricingAgent';
import { analyzeCashFlow } from '../agents/financeAgent';
import { analyzeInventoryHealth } from '../agents/inventoryAgent';
import { fetchSavedProspects } from '../agents/marketingAgent';
import { auditAccounting } from '../agents/accountingAgent';
import { AGENT_STATUS } from '../data/agents';

function formatCompactCLP(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`;
  return `$${abs.toLocaleString('es-CL')}`;
}

export function useAgentRealStatus(companyId) {
  const [data, setData] = useState({}); // { pricing: { status, summary }, finance: {...}, ... }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [pricing, finance, inventory, marketing, accounting] = await Promise.allSettled([
        analyzeProductMargins({ companyId }),
        analyzeCashFlow({ companyId, monthsBack: 6 }),
        analyzeInventoryHealth({ companyId }),
        fetchSavedProspects(companyId),
        auditAccounting({ companyId }),
      ]);
      if (cancelled) return;

      const next = {};

      // "Sin datos todavía" (empresa nueva, nada cargado) es un caso
      // distinto de "todo anda bien" -- sin esto, un agente con cero
      // productos mostraba "Márgenes saludables", que es engañoso: no hay
      // nada saludable, no hay nada que evaluar. Se lee como OFFLINE
      // (semi-transparente en el mapa) con un mensaje explícito.
      if (pricing.status === 'fulfilled') {
        const { total, lossCount, lowCount } = pricing.value.summary;
        next.pricing = total === 0
          ? { status: AGENT_STATUS.OFFLINE, summary: 'Sin productos cargados todavía' }
          : {
              status: lossCount > 0 ? AGENT_STATUS.ALERT : lowCount > 0 ? AGENT_STATUS.THINKING : AGENT_STATUS.WORKING,
              summary: lossCount > 0
                ? `${lossCount} en pérdida · ${lowCount} margen bajo`
                : lowCount > 0 ? `${lowCount} con margen bajo` : 'Márgenes saludables',
            };
      }

      if (finance.status === 'fulfilled') {
        next.finance = !finance.value.latestMonth
          ? { status: AGENT_STATUS.OFFLINE, summary: 'Sin movimientos registrados todavía' }
          : {
              status: finance.value.latestMonth.net < 0 ? AGENT_STATUS.ALERT : AGENT_STATUS.WORKING,
              summary: `Flujo neto: ${finance.value.latestMonth.net >= 0 ? '+' : '-'}${formatCompactCLP(finance.value.latestMonth.net)}`,
            };
      }

      if (inventory.status === 'fulfilled') {
        const { totalProducts, outOfStockCount, deadStockCount } = inventory.value.summary;
        next.inventory = totalProducts === 0
          ? { status: AGENT_STATUS.OFFLINE, summary: 'Sin productos cargados todavía' }
          : {
              status: outOfStockCount > 0 ? AGENT_STATUS.ALERT : deadStockCount > 0 ? AGENT_STATUS.THINKING : AGENT_STATUS.WORKING,
              summary: outOfStockCount > 0
                ? `${outOfStockCount} sin stock · ${deadStockCount} sin rotación`
                : deadStockCount > 0 ? `${deadStockCount} sin rotación` : 'Stock saludable',
            };
      }

      if (marketing.status === 'fulfilled') {
        const prospects = marketing.value || [];
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const newThisWeek = prospects.filter((p) => {
          const created = p.createdAt?.toDate?.();
          return created && created.getTime() >= weekAgo;
        }).length;
        next.marketing = prospects.length === 0
          ? { status: AGENT_STATUS.OFFLINE, summary: 'Sin prospectos guardados todavía' }
          : {
              status: newThisWeek > 0 ? AGENT_STATUS.WORKING : AGENT_STATUS.WAITING,
              summary: `${prospects.length} prospectos · ${newThisWeek} nuevos`,
            };
      }

      if (accounting.status === 'fulfilled') {
        const { total, warnings } = accounting.value.summary;
        next.accounting = total === 0
          ? { status: AGENT_STATUS.WORKING, summary: 'Sin hallazgos este mes' }
          : {
              status: warnings > 0 ? AGENT_STATUS.ALERT : AGENT_STATUS.THINKING,
              summary: `${total} hallazgo${total === 1 ? '' : 's'} este mes`,
            };
      }

      setData(next);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [companyId]);

  return { data, loading };
}
