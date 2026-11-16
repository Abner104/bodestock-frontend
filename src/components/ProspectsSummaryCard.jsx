// src/components/ProspectsSummaryCard.jsx
// Sección de "Mi Consultor": resumen de avance de la prospección de
// Marketing (cuántos negocios encontró el equipo, cuántos ya se
// visitaron). La lista casa por casa -- y el marcar "visitado" -- vive en
// /terreno (TerrenoProspeccion.jsx), donde el vendedor ya está parado; acá
// el dueño solo ve el número, no gestiona la ruta.
import { useState, useEffect } from 'react';
import { fetchSavedProspects, PROSPECT_STATUS } from '../agents/marketingAgent';
import { Store, Loader2 } from 'lucide-react';

export default function ProspectsSummaryCard({ companyId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const prospects = await fetchSavedProspects(companyId);
        const toVisit = prospects.filter(p => p.status === PROSPECT_STATUS.TO_VISIT).length;
        const visited = prospects.filter(p => p.status !== PROSPECT_STATUS.TO_VISIT).length;
        setSummary({ total: prospects.length, toVisit, visited });
      } catch (e) {
        console.error('No se pudo cargar el resumen de prospección:', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  if (!companyId || loading || !summary || summary.total === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white">Prospección de Marketing</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">El equipo gestiona la ruta desde "Buscar clientes cerca" en terreno</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 py-2.5">
            <p className="text-lg font-black text-slate-800 dark:text-white tabular-nums">{summary.total}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Encontrados</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 py-2.5">
            <p className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums">{summary.toVisit}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Por visitar</p>
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 py-2.5">
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{summary.visited}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Visitados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
