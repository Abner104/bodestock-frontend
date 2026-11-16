// src/components/finance/FinanceSuggestions.jsx
// Flujo de caja, fiado, simulador de préstamo y presupuesto para UNA
// empresa -- vive dentro del panel del agente en el mapa
// (SuperAdminAgentRoom.jsx), mismo patrón que Precios/Inventario/
// Contabilidad. Dos pestañas: "Flujo de caja" (lo que se mira todos los
// días, con análisis automático -- igual que Inventario) y "Simulador de
// préstamo" (herramienta puntual, no compite por espacio cuando no se usa).
// Ver financeAgent.js:analyzeCashFlow.
import { useState, useEffect } from 'react';
import {
  analyzeCashFlow, projectInvestmentRecovery, calculateRequiredMonthlySales,
  calculateAverageGrossMarginPct, getFinanceAIAnalysis, getFinanceAIAnalysisCached, buildLoanBudget, LOAN_BUDGET_CATEGORIES
} from '../../agents/financeAgent';
import { Loader2, AlertTriangle, Sparkles, RefreshCw, PiggyBank } from 'lucide-react';

const formatCLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const TABS = [
  { id: 'cashflow', label: 'Flujo de caja' },
  { id: 'loan', label: 'Simulador de préstamo' },
];

function CashFlowTab({ company, companyName }) {
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Análisis automático al entrar -- mismo criterio que Inventario: nada
  // pide un click para que el agente dé su lectura de la situación real
  // (a diferencia del simulador, esto no depende de ningún input nuevo).
  // Usa caché (ver getFinanceAIAnalysisCached): si los números no
  // cambiaron desde la última vez, reutiliza el texto guardado en vez de
  // volver a pagar la llamada a Claude (y la espera de ~10s) cada vez que
  // se abre el panel.
  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setAiLoading(true);
    setAiError(null);
    getFinanceAIAnalysisCached(company, companyName, company.companyId)
      .then((text) => { if (!cancelled) setAiAnalysis(text); })
      .catch((err) => {
        console.error('Error pidiendo análisis con IA:', err);
        if (!cancelled) setAiError(err.message || 'No se pudo generar el análisis.');
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-emerald-400 break-words">{formatCLP(company.summary.totalSales)}</p>
          <p className="text-[10px] text-zinc-400">Ventas totales</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-red-400 break-words">{formatCLP(company.summary.totalExpenses)}</p>
          <p className="text-[10px] text-zinc-400">Gastos cargados</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-orange-400 break-words">{formatCLP(company.totalCreditExposure)}</p>
          <p className="text-[10px] text-zinc-400">Fiado acumulado</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-purple-400 break-words">{formatCLP(company.inventoryValue?.totalValue)}</p>
          <p className="text-[10px] text-zinc-400">Mercadería en inventario</p>
        </div>
      </div>

      <div className="mb-4 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-violet-300 mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          Lectura del agente
        </div>
        {aiLoading && (
          <p className="text-xs text-zinc-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Analizando...</p>
        )}
        {!aiLoading && aiError && <p className="text-xs text-red-400">{aiError}</p>}
        {!aiLoading && !aiError && aiAnalysis && (
          <p className="text-sm text-zinc-200 mt-1 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
        )}
        {!aiLoading && !aiError && !aiAnalysis && (
          <p className="text-xs text-zinc-500">No se pudo generar el análisis esta vez. Vuelve a intentarlo más tarde.</p>
        )}
      </div>

      {company.totalCreditExposure > 0 && (
        <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-3">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-200">
            {formatCLP(company.totalCreditExposure)} en ventas quedaron como fiado — cuentan como venta pero no como efectivo en caja. El sistema no registra si ya se cobraron.
          </p>
        </div>
      )}

      {company.summary.monthsWithoutExpenseData > 0 && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200">
            {company.summary.monthsWithoutExpenseData} de {company.summary.totalMonths} meses no tienen gastos operativos cargados — el neto de esos meses solo refleja ventas, no la utilidad real.
          </p>
        </div>
      )}

      <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
        {[...company.months].reverse().map(month => (
          <div key={month.period} className="flex items-center justify-between gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{month.period}</p>
              <p className="text-xs text-zinc-500">
                {month.salesCount} ventas
                {month.hasExpenseData ? ` · ${month.expensesCount} gastos` : ' · sin gastos cargados'}
                {month.creditPct > 0 && <span className="text-orange-400"> · {month.creditPct}% fiado</span>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold ${month.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCLP(month.net)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoanSimulatorTab({ company, companyName }) {
  const [investmentInput, setInvestmentInput] = useState('');
  const [expensePctInput, setExpensePctInput] = useState('');
  const [termMonthsInput, setTermMonthsInput] = useState('');
  const [grossMarginPct, setGrossMarginPct] = useState(null);
  const [grossMarginLoading, setGrossMarginLoading] = useState(true);
  const [budgetPcts, setBudgetPcts] = useState(() =>
    Object.fromEntries(LOAN_BUDGET_CATEGORIES.map(cat => [cat.key, cat.defaultPct]))
  );
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setGrossMarginLoading(true);
    calculateAverageGrossMarginPct(company.companyId)
      .then(pct => { if (!cancelled) setGrossMarginPct(pct); })
      .catch(() => { if (!cancelled) setGrossMarginPct(null); })
      .finally(() => { if (!cancelled) setGrossMarginLoading(false); });
    return () => { cancelled = true; };
  }, [company.companyId]);

  const hasMissingExpenseData = company.summary.monthsWithoutExpenseData > 0;
  const expensePct = expensePctInput.trim() ? Number(expensePctInput) : null;

  const monthsWithRealExpenses = company.months.filter(m => m.hasExpenseData && m.salesTotal > 0);
  const realExpensePct = monthsWithRealExpenses.length > 0
    ? Number((
        monthsWithRealExpenses.reduce((sum, m) => sum + (m.expensesTotal / m.salesTotal), 0) /
        monthsWithRealExpenses.length * 100
      ).toFixed(1))
    : null;

  const projection = investmentInput.trim()
    ? projectInvestmentRecovery(company, investmentInput.replace(/\./g, ''), expensePct)
    : null;

  const effectiveExpensePct = expensePct ?? realExpensePct;
  const salesTarget = (investmentInput.trim() && termMonthsInput.trim() && effectiveExpensePct !== null && grossMarginPct !== null)
    ? calculateRequiredMonthlySales(investmentInput.replace(/\./g, ''), termMonthsInput, effectiveExpensePct, grossMarginPct)
    : null;

  const loanBudget = investmentInput.trim()
    ? buildLoanBudget(investmentInput.replace(/\./g, ''), budgetPcts, salesTarget?.valid ? salesTarget.monthlyInstallment : null)
    : null;

  const handleAskAI = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const text = await getFinanceAIAnalysis(company, companyName, salesTarget?.valid ? salesTarget : null);
      setAiAnalysis(text);
    } catch (err) {
      console.error('Error pidiendo análisis con IA:', err);
      setAiError(err.message || 'No se pudo generar el análisis.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
        <p className="text-sm font-semibold text-white mb-1">Simular recuperación de una inversión</p>
        <p className="text-xs text-zinc-500 mb-3">
          Ya tiene {formatCLP(company.inventoryValue?.totalValue)} invertidos en mercadería hoy.
          Escribe un monto adicional (ej. un préstamo) y proyecta cuántos meses tomaría recuperarlo. No se guarda en ningún lado.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-zinc-400 text-sm">$</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ej. 40.000.000"
            value={investmentInput}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '');
              setInvestmentInput(digitsOnly ? Number(digitsOnly).toLocaleString('es-CL') : '');
            }}
            className="flex-1 min-w-0 text-sm bg-white/[0.06] border border-white/[0.08] text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {hasMissingExpenseData && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <label className="text-xs text-zinc-400 whitespace-nowrap">% gasto estimado (meses sin dato)</label>
            <input
              type="number"
              min={0}
              max={90}
              placeholder="Ej. 15"
              value={expensePctInput}
              onChange={(e) => setExpensePctInput(e.target.value)}
              className="w-16 text-sm bg-white/[0.06] border border-white/[0.08] text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <span className="text-xs text-zinc-500">%</span>
            {realExpensePct !== null && (
              <button
                onClick={() => setExpensePctInput(String(realExpensePct))}
                className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-md transition whitespace-nowrap"
              >
                Usar % real ({realExpensePct}%)
              </button>
            )}
          </div>
        )}

        {projection && !projection.valid && <p className="text-xs text-red-400">{projection.reason}</p>}

        {projection?.valid && projection.monthsToRecover !== null && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm text-blue-200">
              Con un flujo de caja neto promedio de <strong>{formatCLP(projection.avgMonthlyNet)}</strong>/mes,
              esta inversión se recuperaría en aproximadamente <strong>{projection.monthsToRecover} meses</strong>.
            </p>
            {projection.usedEstimate ? (
              <p className="text-xs text-blue-300/70 mt-2">
                Se estimó un gasto de {expensePct}% de ventas en {projection.estimatedMonthsCount} mes{projection.estimatedMonthsCount !== 1 ? 'es' : ''} sin gastos cargados.
              </p>
            ) : !projection.usedRealExpenseData && (
              <p className="text-xs text-blue-300/70 mt-2">
                Estimado solo con ventas — no hay gastos operativos cargados para esta empresa.
              </p>
            )}
          </div>
        )}

        {projection?.valid && projection.monthsToRecover === null && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-300">{projection.warning}</p>
          </div>
        )}

        {investmentInput.trim() && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-sm font-semibold text-white mb-1">¿Cuánto tengo que vender al mes?</p>
            <p className="text-xs text-zinc-500 mb-3">
              Dile en cuántos meses quiere pagar el préstamo. Resta primero el costo de mercadería, después gastos operativos, y lo que queda paga la cuota.
            </p>

            {grossMarginLoading && <p className="text-xs text-zinc-500 mb-3">Calculando margen bruto real...</p>}
            {!grossMarginLoading && grossMarginPct !== null && (
              <p className="text-xs text-zinc-500 mb-3">
                Margen bruto promedio actual: <strong className="text-zinc-300">{grossMarginPct}%</strong>
              </p>
            )}
            {!grossMarginLoading && grossMarginPct === null && (
              <p className="text-xs text-yellow-400 mb-3">
                No se pudo calcular el margen bruto — revisa que haya productos con precio de venta y costo cargados.
              </p>
            )}

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-zinc-400 whitespace-nowrap">Pagarlo en</span>
              <input
                type="number"
                min={1}
                placeholder="Ej. 12"
                value={termMonthsInput}
                onChange={(e) => setTermMonthsInput(e.target.value)}
                className="w-16 text-sm bg-white/[0.06] border border-white/[0.08] text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <span className="text-xs text-zinc-400">meses</span>
            </div>

            {termMonthsInput.trim() && effectiveExpensePct === null && (
              <p className="text-xs text-yellow-400">Falta el % de gasto sobre ventas (real o estimado, arriba).</p>
            )}

            {salesTarget && !salesTarget.valid && <p className="text-xs text-red-400">{salesTarget.reason}</p>}

            {salesTarget?.valid && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-sm text-emerald-200 mb-3">
                  Necesita vender al menos <strong>{formatCLP(salesTarget.requiredMonthlySales)}</strong> al mes
                  para cubrir mercadería, gastos y la cuota de <strong>{formatCLP(salesTarget.monthlyInstallment)}</strong>.
                </p>
                <div className="space-y-1.5 text-xs border-t border-emerald-500/20 pt-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-emerald-300/70">Venta necesaria</span>
                    <span className="text-emerald-200 font-medium text-right">{formatCLP(salesTarget.requiredMonthlySales)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-emerald-300/70">(−) Costo de mercadería ({(100 - salesTarget.grossMarginPct).toFixed(1)}%)</span>
                    <span className="text-red-300 text-right whitespace-nowrap">−{formatCLP(salesTarget.costOfGoodsAtTarget)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-emerald-500/10 pt-1.5">
                    <span className="text-emerald-300/70">(=) Margen bruto</span>
                    <span className="text-emerald-200 text-right">{formatCLP(salesTarget.grossProfitAtTarget)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-emerald-300/70">(−) Gastos operativos ({salesTarget.expensePct}%)</span>
                    <span className="text-red-300 text-right whitespace-nowrap">−{formatCLP(salesTarget.operatingExpensesAtTarget)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-emerald-500/20 pt-1.5">
                    <span className="text-emerald-200 font-medium">(=) Ganancia real</span>
                    <span className="text-emerald-200 font-medium text-right">{formatCLP(salesTarget.realProfitAtTarget)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-emerald-300/70">Cuota del préstamo</span>
                    <span className="text-emerald-200 text-right">{formatCLP(salesTarget.monthlyInstallment)}</span>
                  </div>
                </div>
                {company.latestMonth && (
                  <p className="text-xs text-emerald-300/70 mt-3 pt-3 border-t border-emerald-500/20">
                    Su último mes con datos ({company.latestMonth.period}) vendió {formatCLP(company.latestMonth.salesTotal)}.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {investmentInput.trim() && (
        <div className="mt-4 bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <PiggyBank className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-semibold text-white">Cómo dividir el préstamo</p>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Antes de recibir la plata, decide en qué se va a usar cada parte. Ajusta los porcentajes si no le calzan a este negocio.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {LOAN_BUDGET_CATEGORIES.map(cat => (
              <div key={cat.key} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-300 truncate" title={cat.description}>{cat.label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={budgetPcts[cat.key]}
                      onChange={(e) => setBudgetPcts(prev => ({ ...prev, [cat.key]: Number(e.target.value) || 0 }))}
                      className="w-12 text-xs bg-white/[0.06] border border-white/[0.08] text-white rounded-lg px-1.5 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <span className="text-xs text-zinc-500">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{cat.description}</p>
                {loanBudget?.valid && (
                  <p className="text-xs text-blue-300 mt-0.5">
                    {formatCLP(loanBudget.breakdown.find(b => b.key === cat.key)?.amount)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {loanBudget?.valid && (
            <p className="text-xs text-zinc-400 mb-2">
              Suma: <span className={loanBudget.totalPct === 100 ? 'text-emerald-400' : 'text-red-400'}>{loanBudget.totalPct.toFixed(0)}%</span>
            </p>
          )}
          {loanBudget && !loanBudget.valid && <p className="text-xs text-red-400">{loanBudget.reason}</p>}
          {loanBudget?.valid && loanBudget.cuotaWarning && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-200">{loanBudget.cuotaWarning}</p>
            </div>
          )}
        </div>
      )}

      {investmentInput.trim() && (
        <div className="mt-4 bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
          <button
            onClick={handleAskAI}
            disabled={aiLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition"
          >
            {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiLoading ? 'Analizando...' : 'Analizar esta simulación con IA'}
          </button>
          {aiError && <p className="text-xs text-red-400 mt-2">{aiError}</p>}
          {aiAnalysis && <p className="text-sm text-zinc-200 mt-3 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>}
        </div>
      )}
    </div>
  );
}

export default function FinanceSuggestions({ companyId, companyName }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cashflow');

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    analyzeCashFlow({ companyId })
      .then((result) => { if (!cancelled) setCompany({ companyId, companyName, ...result }); })
      .catch((e) => {
        console.error('No se pudo analizar el flujo de caja:', e);
        if (!cancelled) setError(e.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, companyName]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
        <p className="text-xs text-zinc-500">Cruzando ventas y gastos...</p>
      </div>
    );
  }

  if (error || !company) {
    return <p className="text-center text-sm text-zinc-500 py-8">No se pudo analizar el flujo de caja.</p>;
  }

  if (company.months.length === 0) {
    return <p className="text-center text-sm text-zinc-500 py-8">Esta empresa todavía no tiene ventas registradas.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-3 bg-white/[0.03] rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.1] text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cashflow' && <CashFlowTab company={company} companyName={companyName} />}
      {activeTab === 'loan' && <LoanSimulatorTab company={company} companyName={companyName} />}
    </div>
  );
}
