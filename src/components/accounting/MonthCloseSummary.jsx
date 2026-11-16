// src/components/accounting/MonthCloseSummary.jsx
// Resumen del cierre de mes: ventas, gastos por tipo, sueldos y hallazgos
// del período, todo en un solo lugar -- para que el dueño lo revise antes
// de pasárselo a su contador. Junta lo que ya calculan auditAccounting,
// estimateMonthlyVAT y calculatePayroll (ver
// accountingAgent.js:getMonthClose), no recalcula nada nuevo.
import { useState, useEffect } from 'react';
import { getMonthClose } from '../../agents/accountingAgent';
import { Loader2, ClipboardCheck } from 'lucide-react';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const EXPENSE_LABELS = {
  arriendo: 'Arriendo',
  sueldos: 'Sueldos',
  imposiciones: 'Imposiciones (AFP/Salud)',
  servicios: 'Servicios (luz/agua/internet)',
  transporte: 'Transporte',
  credito_bancario: 'Crédito bancario',
  software: 'Software/Suscripciones',
  honorarios: 'Honorarios',
  impuestos: 'Impuestos/Tributario',
  comision_vendedor: 'Comisión vendedor',
  otro: 'Otro',
};

function mesLabel(periodKey) {
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [y, m] = periodKey.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

export default function MonthCloseSummary({ companyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    getMonthClose({ companyId })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => {
        console.error('No se pudo armar el cierre de mes:', e);
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
    return <p className="text-xs text-zinc-500 py-2">No se pudo armar el cierre de mes.</p>;
  }

  const expenseRows = Object.entries(data.expensesByType).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
        <p className="text-xs font-semibold text-white">Cierre de {mesLabel(data.periodKey)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-white/[0.03] p-2.5">
          <p className="text-zinc-500">Ventas del mes</p>
          <p className="text-zinc-100 font-semibold tabular-nums text-sm">{CLP(data.salesTotal)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2.5">
          <p className="text-zinc-500">Todo lo que gastaste</p>
          <p className="text-zinc-100 font-semibold tabular-nums text-sm">{CLP(data.totalExpenses)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
        <div>
          <p className="text-zinc-500">Mercadería que compraste</p>
          <p className="text-zinc-300 tabular-nums">{CLP(data.merchandiseInvestment)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Gastos del negocio</p>
          <p className="text-zinc-300 tabular-nums">{CLP(data.operatingExpenses)}</p>
        </div>
      </div>

      <div className={`rounded-lg p-2.5 mt-3 ${data.netResult >= 0 ? 'bg-emerald-500/[0.08]' : 'bg-red-500/[0.08]'}`}>
        <p className="text-[11px] text-zinc-400">Lo que sobró después de descontar todo</p>
        <p className={`font-bold tabular-nums text-lg ${data.netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {CLP(data.netResult)}
        </p>
      </div>

      {expenseRows.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">Gastos del negocio, por tipo</p>
          <div className="space-y-1">
            {expenseRows.map(([tipo, monto]) => (
              <div key={tipo} className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{EXPENSE_LABELS[tipo] || tipo}</span>
                <span className="text-zinc-200 tabular-nums">{CLP(monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.payroll && data.payroll.totalPayroll > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">Sueldos calculados ({data.payroll.workers.length} trabajador{data.payroll.workers.length === 1 ? '' : 'es'})</span>
          <span className="text-zinc-200 font-semibold tabular-nums">{CLP(data.payroll.totalPayroll)}</span>
        </div>
      )}

      {data.vat && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">{data.vat.favorableBalance > 0 ? 'IVA a tu favor (estimado)' : 'IVA que le tocaría pagar al SII (estimado)'}</span>
          <span className="text-zinc-200 font-semibold tabular-nums">
            {CLP(data.vat.favorableBalance > 0 ? data.vat.favorableBalance : data.vat.estimatedVAT)}
          </span>
        </div>
      )}

      {data.findings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">Hallazgos pendientes ({data.findings.length})</p>
          <div className="space-y-1">
            {data.findings.map((f) => (
              <p key={f.id} className="text-[11px] text-zinc-400 leading-relaxed">• {f.title}</p>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
        Resumen para tu revisión — no reemplaza el cierre contable real que hace tu contador con la documentación completa.
      </p>
    </div>
  );
}
