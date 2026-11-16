// src/components/pricing/ProductPricingSuggestions.jsx
// Sugerencia de precio PRODUCTO POR PRODUCTO (no por categoría -- muchas
// empresas tienen la categoría mal cargada, con typos, y agrupar por ahí
// no tiene sentido). Cada producto muestra su rotación individual
// (unidades vendidas este mes ÷ su stock), el % de margen sugerido según
// esos 3 niveles, y cuánto cambiaría la ganancia mensual si se aplica.
// Ver pricingAgent.js:analyzeProductPricingSuggestions.
import { useState, useEffect } from 'react';
import { analyzeProductPricingSuggestions, applySuggestedPrice } from '../../agents/pricingAgent';
import { Loader2, TrendingUp, TrendingDown, Minus, Download, FileSpreadsheet, Check } from 'lucide-react';

const formatCLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const TIER_ICON = {
  HIGH: <TrendingUp className="w-3 h-3 text-sky-400" />,
  MEDIUM: <Minus className="w-3 h-3 text-zinc-400" />,
  LOW: <TrendingDown className="w-3 h-3 text-amber-400" />,
};

export default function ProductPricingSuggestions({ companyId, companyName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyingId, setApplyingId] = useState(null);
  const [appliedIds, setAppliedIds] = useState({});
  const [exporting, setExporting] = useState(null); // 'pdf' | 'xlsx' | null
  const [onlyAdjust, setOnlyAdjust] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    analyzeProductPricingSuggestions({ companyId })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => {
        console.error('No se pudo calcular sugerencias de precio:', e);
        if (!cancelled) setError(e.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  const handleApply = async (product) => {
    setApplyingId(product.id);
    try {
      await applySuggestedPrice(product);
      setAppliedIds((prev) => ({ ...prev, [product.id]: true }));
    } catch (e) {
      alert('No se pudo aplicar el precio sugerido. Intenta de nuevo.');
      console.error(e);
    } finally {
      setApplyingId(null);
    }
  };

  const rows = () => (onlyAdjust ? data.products.filter((p) => p.needsAdjustment) : data.products);

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      doc.setFontSize(14);
      doc.text('Precios sugeridos por producto', 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`${companyName || ''} — ${new Date().toLocaleDateString('es-CL')}`, 14, 21);

      autoTable(doc, {
        startY: 27,
        head: [['Producto', 'Costo', 'Precio actual', 'Margen actual', '% sugerido', 'Precio sugerido', 'Ganancia est./mes']],
        body: rows().map((p) => [
          p.nombre,
          formatCLP(p.cost),
          formatCLP(p.price),
          `${p.marginPct}%`,
          `${p.suggestedMarginPct}%`,
          formatCLP(p.suggestedPrice),
          p.profitDelta === 0 ? '—' : `${p.profitDelta > 0 ? '+' : ''}${formatCLP(p.profitDelta)}`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 24, 32] },
      });

      doc.save(`precios-sugeridos-${(companyName || 'empresa').toLowerCase().replace(/\s+/g, '-')}.pdf`);
    } catch (e) {
      alert('No se pudo generar el PDF.');
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting('xlsx');
    try {
      const XLSX = await import('xlsx');
      const sheetData = rows().map((p) => ({
        Producto: p.nombre,
        SKU: p.sku || '',
        Costo: p.cost,
        'Precio actual': p.price,
        'Margen actual (%)': p.marginPct,
        'Rotación (%)': Math.round(p.rotationRatio * 100),
        '% sugerido': p.suggestedMarginPct,
        'Precio sugerido': p.suggestedPrice,
        'Ganancia estimada/mes': p.profitDelta,
      }));
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Precios sugeridos');
      XLSX.writeFile(wb, `precios-sugeridos-${(companyName || 'empresa').toLowerCase().replace(/\s+/g, '-')}.xlsx`);
    } catch (e) {
      alert('No se pudo generar el Excel.');
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
        <p className="text-xs text-zinc-500">Calculando rotación y precio sugerido por producto...</p>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-center text-sm text-zinc-500 py-8">No se pudo calcular sugerencias de precio.</p>;
  }

  if (data.products.length === 0) {
    return <p className="text-center text-sm text-zinc-500 py-8">No hay productos de inventario con precio cargado todavía.</p>;
  }

  const visibleRows = rows();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyAdjust}
            onChange={(e) => setOnlyAdjust(e.target.checked)}
            className="w-3.5 h-3.5 accent-emerald-500"
          />
          Mostrar solo los que necesitan ajuste ({data.summary.adjustCount})
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 transition disabled:opacity-50"
          >
            {exporting === 'xlsx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 transition disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>
        </div>
      </div>

      {data.summary.totalProfitDelta !== 0 && (
        <div className={`rounded-lg p-3 mb-3 ${data.summary.totalProfitDelta > 0 ? 'bg-emerald-500/[0.08]' : 'bg-red-500/[0.08]'}`}>
          <p className="text-[11px] text-zinc-400">
            Si aplicás los {data.summary.adjustCount} ajustes sugeridos, con el mismo volumen de ventas de este mes
          </p>
          <p className={`text-lg font-bold tabular-nums ${data.summary.totalProfitDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.summary.totalProfitDelta > 0 ? '+' : ''}{formatCLP(data.summary.totalProfitDelta)} al mes
          </p>
        </div>
      )}

      {visibleRows.length === 0 ? (
        <p className="text-center text-sm text-zinc-500 py-8">Ningún producto necesita ajuste ahora mismo.</p>
      ) : (
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2">
          {visibleRows.map((p) => {
            const isApplying = applyingId === p.id;
            const isApplied = appliedIds[p.id];
            const key = `${p.source}-${p.id}`;
            return (
              <div key={key} className="flex items-center justify-between gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {TIER_ICON[p.rotationTier]}
                    <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Costo {formatCLP(p.cost)} · Venta {formatCLP(isApplied ? p.suggestedPrice : p.price)} · Margen {isApplied ? p.suggestedMarginPct : p.marginPct}% · rotación {Math.round(p.rotationRatio * 100)}%
                  </p>
                  {p.profitDelta !== 0 && (
                    <p className={`text-[11px] font-medium mt-0.5 ${p.profitDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.profitDelta > 0 ? '+' : ''}{formatCLP(p.profitDelta)}/mes si se aplica
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Sugerido</p>
                    <p className="text-sm font-semibold text-emerald-400">{formatCLP(p.suggestedPrice)}</p>
                  </div>
                  <button
                    onClick={() => handleApply(p)}
                    disabled={isApplying || isApplied}
                    className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                      isApplied
                        ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                        : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50'
                    }`}
                  >
                    {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : isApplied ? <Check className="w-3 h-3" /> : null}
                    {isApplying ? 'Aplicando...' : isApplied ? 'Aplicado' : 'Aplicar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
