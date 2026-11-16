// src/components/accounting/PurchaseSalesBookPanel.jsx
// Libro de compras y ventas del período: fecha, folio, RUT, neto, IVA y
// total de cada venta y cada factura de proveedor confirmada -- para que
// el contador arme el libro oficial con esto como base. No reemplaza el
// libro que se declara al SII (ver conversación con el usuario sobre
// alcance). Ver accountingAgent.js:getPurchaseSalesBook.
import { useState, useEffect } from 'react';
import { getPurchaseSalesBook } from '../../agents/accountingAgent';
import { Loader2, Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? d.toLocaleDateString('es-CL') : '—';

export default function PurchaseSalesBookPanel({ companyId, companyName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('sales'); // 'sales' | 'purchases'
  const [exporting, setExporting] = useState(null); // 'pdf' | 'xlsx' | null

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    getPurchaseSalesBook({ companyId })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => {
        console.error('No se pudo armar el libro de compra/venta:', e);
        if (!cancelled) setError(e.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  const handleExportExcel = async () => {
    setExporting('xlsx');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const salesSheet = data.sales.map((s) => ({
        Fecha: fmtDate(s.date),
        Folio: s.folio || '',
        Cliente: s.customerName || '',
        RUT: s.customerRut || '',
        'Monto neto': s.netAmount,
        IVA: s.vatAmount,
        Total: s.totalAmount,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesSheet), 'Ventas');

      const purchasesSheet = data.purchases.map((p) => ({
        Fecha: fmtDate(p.date),
        Folio: p.folio || '',
        RUT: p.supplierRut || '',
        Archivo: p.fileName || '',
        'Monto neto': p.netAmount,
        IVA: p.vatAmount,
        Total: p.totalAmount,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesSheet), 'Compras');

      XLSX.writeFile(wb, `libro-compra-venta-${(companyName || 'empresa').toLowerCase().replace(/\s+/g, '-')}-${data.periodKey}.xlsx`);
    } catch (e) {
      alert('No se pudo generar el Excel.');
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFontSize(14);
      doc.text('Libro de compra y venta', 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`${companyName || ''} — periodo ${data.periodKey}`, 14, 21);

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Ventas', 14, 30);
      autoTable(doc, {
        startY: 33,
        head: [['Fecha', 'Folio', 'Cliente', 'RUT', 'Neto', 'IVA', 'Total']],
        body: data.sales.map((s) => [fmtDate(s.date), s.folio || '—', s.customerName || '—', s.customerRut || '—', CLP(s.netAmount), CLP(s.vatAmount), CLP(s.totalAmount)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 24, 32] },
      });

      let y = doc.lastAutoTable.finY + 10;
      doc.setFontSize(12);
      doc.text('Compras', 14, y);
      autoTable(doc, {
        startY: y + 3,
        head: [['Fecha', 'Folio', 'RUT proveedor', 'Neto', 'IVA', 'Total']],
        body: data.purchases.map((p) => [fmtDate(p.date), p.folio || '—', p.supplierRut || '—', CLP(p.netAmount), CLP(p.vatAmount), CLP(p.totalAmount)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 24, 32] },
      });

      doc.save(`libro-compra-venta-${(companyName || 'empresa').toLowerCase().replace(/\s+/g, '-')}-${data.periodKey}.pdf`);
    } catch (e) {
      alert('No se pudo generar el PDF.');
      console.error(e);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-2" />
        <p className="text-xs text-zinc-500">Armando el libro del período...</p>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-center text-sm text-zinc-500 py-8">No se pudo armar el libro de compra/venta.</p>;
  }

  const rows = tab === 'sales' ? data.sales : data.purchases;
  const missingFolio = tab === 'sales' ? data.summary.missingFolioSalesCount : data.summary.missingFolioPurchasesCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1">
          <button
            onClick={() => setTab('sales')}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${tab === 'sales' ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Ventas ({data.summary.salesCount})
          </button>
          <button
            onClick={() => setTab('purchases')}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${tab === 'purchases' ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Compras ({data.summary.purchasesCount})
          </button>
        </div>
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

      {missingFolio > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200">
            {missingFolio} {tab === 'sales' ? 'venta(s)' : 'compra(s)'} sin folio cargado — el libro sale incompleto para esos casos.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">Sin {tab === 'sales' ? 'ventas' : 'compras confirmadas'} este período.</p>
      ) : (
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[11px]">
              <div className="min-w-0 flex-1">
                <p className="text-zinc-200 font-medium truncate">
                  {tab === 'sales' ? (r.customerName || 'Sin cliente') : (r.fileName || 'Factura')}
                </p>
                <p className="text-zinc-500">
                  {fmtDate(r.date)} · Folio {r.folio || '—'} · RUT {tab === 'sales' ? (r.customerRut || '—') : (r.supplierRut || '—')}
                </p>
              </div>
              <p className="text-zinc-200 font-semibold tabular-nums shrink-0">{CLP(r.totalAmount)}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
        Base para que tu contador arme el libro oficial — no reemplaza lo que se declara al SII.
      </p>
    </div>
  );
}
