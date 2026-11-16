// src/components/accounting/VatEstimatePanel.jsx
// Muestra la estimación de IVA del mes (débito - crédito fiscal) para que
// el dueño no se sorprenda al fin de mes. Es una ESTIMACIÓN sobre lo que
// ya está cargado en el sistema -- nunca se declara ni se envía al SII;
// eso lo hace el contador con la documentación completa. Ver
// accountingAgent.js:estimateMonthlyVAT.
import { useState, useEffect } from 'react';
import { estimateMonthlyVAT } from '../../agents/accountingAgent';
import { Loader2, Receipt } from 'lucide-react';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

export default function VatEstimatePanel({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    estimateMonthlyVAT({ companyId })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => {
        console.error('No se pudo calcular el IVA estimado:', e);
        if (!cancelled) setError(e.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-xs text-zinc-500 py-2">No se pudo calcular el IVA estimado.</p>;
  }

  const hasBalance = data.favorableBalance > 0;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Receipt className="w-3.5 h-3.5 text-amber-400" />
        <p className="text-xs font-semibold text-white">IVA estimado de este mes</p>
      </div>

      {hasBalance ? (
        <p className="text-2xl font-bold text-emerald-400 tabular-nums">{CLP(data.favorableBalance)}</p>
      ) : (
        <p className="text-2xl font-bold text-amber-400 tabular-nums">{CLP(data.estimatedVAT)}</p>
      )}
      <p className="text-[11px] text-zinc-400 mt-0.5">
        {hasBalance ? 'A tu favor — pagaste más IVA en compras del que cobraste en ventas' : 'Es lo que le tocaría pagar al Estado este mes (estimado)'}
      </p>

      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.06] text-[11px]">
        <div>
          <p className="text-zinc-500">IVA que cobraste</p>
          <p className="text-zinc-600 dark:text-zinc-500 text-[10px] -mt-0.5 mb-0.5">en tus ventas</p>
          <p className="text-zinc-200 font-semibold tabular-nums">{CLP(data.debitoFiscal)}</p>
        </div>
        <div>
          <p className="text-zinc-500">IVA que pagaste</p>
          <p className="text-zinc-600 dark:text-zinc-500 text-[10px] -mt-0.5 mb-0.5">en tus compras</p>
          <p className="text-zinc-200 font-semibold tabular-nums">{CLP(data.creditoFiscal)}</p>
        </div>
      </div>

      {(data.invoicesTotalWithVat > 0 || data.inventoryPurchasesTotalWithVat > 0) && (
        <div className="mt-2 space-y-0.5 text-[10px] text-zinc-500">
          {data.inventoryPurchasesTotalWithVat > 0 && (
            <p>• {CLP(data.inventoryPurchasesTotalWithVat)} de mercadería que compraste (registrada en Inventario)</p>
          )}
          {data.invoicesTotalWithVat > 0 && (
            <p>• {CLP(data.invoicesTotalWithVat)} de facturas de proveedores que confirmaste</p>
          )}
        </div>
      )}

      <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
        <span className="font-semibold text-zinc-400">¿Cómo se calcula?</span> El IVA que cobraste menos el IVA que pagaste. Esa diferencia es lo que en teoría le corresponde pagar al SII — pero esto es solo una estimación con lo que ya cargaste al sistema, no reemplaza la declaración real que hace tu contador.
      </p>
    </div>
  );
}
