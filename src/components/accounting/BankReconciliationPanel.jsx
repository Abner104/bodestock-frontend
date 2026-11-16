// src/components/accounting/BankReconciliationPanel.jsx
// UI de conciliación bancaria: subir cartola (Excel/CSV) -> confirmar qué
// columna es cuál -> ver qué no calza contra ventas/gastos reales. Mismo
// patrón de 3 pasos que ImportExcelModal.jsx (subir, mapear, resultado),
// adaptado a cartolas bancarias -- ver bankReconciliationAgent.js para toda
// la lógica de detección/parseo/cruce.
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { suggestColumnMapping, parseStatementRows, reconcileStatement } from '../../agents/bankReconciliationAgent';

const formatCLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const MAPPING_FIELDS = [
  { key: 'date', label: 'Fecha', required: true },
  { key: 'charge', label: 'Cargo (salió plata)', required: false },
  { key: 'deposit', label: 'Abono (entró plata)', required: false },
  { key: 'amount', label: 'Monto (una sola columna, con signo)', required: false },
  { key: 'description', label: 'Descripción', required: false },
];

export default function BankReconciliationPanel({ companyId }) {
  const [step, setStep] = useState('upload'); // upload | map | result
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError(null);
    setResult(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (jsonData.length < 2) {
        setError('El archivo debe tener al menos una fila de encabezados y una fila de datos.');
        return;
      }

      const fileHeaders = jsonData[0].map((h) => String(h || '').trim()).filter(Boolean);
      const fileRows = jsonData.slice(1).filter((row) => row.some((cell) => cell != null && cell !== ''));

      const autoMapping = {};
      fileHeaders.forEach((h) => {
        const suggestion = suggestColumnMapping(h);
        // No pisar una columna ya asignada -- ej. si "Cargo" y "Débito"
        // aparecen ambas, la primera gana y la segunda queda sin mapear
        // para que el usuario decida a mano en vez de una sobreescritura
        // silenciosa.
        if (suggestion && !autoMapping[suggestion]) autoMapping[suggestion] = h;
      });

      setHeaders(fileHeaders);
      setRows(fileRows);
      setMapping(autoMapping);
      setStep('map');
    } catch (err) {
      console.error('Error leyendo el archivo:', err);
      setError('No se pudo leer el archivo. ¿Es un Excel o CSV válido?');
    }
  };

  const canProcess = mapping.date && (mapping.charge || mapping.deposit || mapping.amount);

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    try {
      const movements = parseStatementRows(rows, mapping, headers);
      if (movements.length === 0) {
        setError('No se pudo leer ningún movimiento válido con ese mapeo de columnas. Revisa que las columnas elegidas sean las correctas.');
        setProcessing(false);
        return;
      }
      const reconciliation = await reconcileStatement({ companyId, movements });
      setResult({ ...reconciliation, totalMovements: movements.length });
      setStep('result');
    } catch (err) {
      console.error('Error conciliando:', err.message);
      setError('No se pudo completar la conciliación.');
    } finally {
      setProcessing(false);
    }
  };

  if (step === 'upload') {
    return (
      <div className="p-5 text-center">
        <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-[13px] font-semibold text-white mb-1">Conciliación bancaria</p>
        <p className="text-[12px] text-zinc-500 mb-4 max-w-xs mx-auto">
          Sube la cartola de tu cuenta (Excel o CSV, descargada desde tu banca en línea) para ver qué movimientos no coinciden con tus ventas y gastos registrados.
        </p>
        {error && (
          <div className="flex items-center gap-2 justify-center text-[12px] text-red-400 mb-3">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5" />
          Subir cartola
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>
    );
  }

  if (step === 'map') {
    return (
      <div className="p-5">
        <button onClick={reset} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 mb-3">
          <ArrowLeft className="w-3 h-3" /> Elegir otro archivo
        </button>
        <p className="text-[13px] font-semibold text-white mb-1">¿Qué columna es cuál?</p>
        <p className="text-[12px] text-zinc-500 mb-4">
          Ya adiviné algunas — revisa que estén bien antes de continuar. Necesitas al menos Fecha y (Cargo o Abono, o Monto).
        </p>

        <div className="space-y-2 mb-4">
          {MAPPING_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-zinc-400">{field.label}{field.required && ' *'}</span>
              <select
                value={mapping[field.key] || ''}
                onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value || undefined }))}
                className="text-[12px] bg-white/[0.06] border border-white/[0.08] text-zinc-200 rounded-lg px-2 py-1.5 max-w-[160px]"
              >
                <option value="">— Sin usar —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[12px] text-red-400 mb-3">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={!canProcess || processing}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
        >
          {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {processing ? 'Conciliando...' : `Conciliar ${rows.length} movimientos`}
        </button>
      </div>
    );
  }

  // step === 'result'
  const { unmatchedDeposits, unmatchedCharges, matchedCount, totalMovements } = result;
  return (
    <div className="p-5">
      <button onClick={reset} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 mb-3">
        <ArrowLeft className="w-3 h-3" /> Conciliar otra cartola
      </button>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-base font-bold text-emerald-400">{matchedCount}</p>
          <p className="text-[10px] text-zinc-500">Coinciden</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-base font-bold text-orange-400">{unmatchedDeposits.length}</p>
          <p className="text-[10px] text-zinc-500">Abonos sin venta</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-base font-bold text-orange-400">{unmatchedCharges.length}</p>
          <p className="text-[10px] text-zinc-500">Cargos sin gasto</p>
        </div>
      </div>

      {unmatchedDeposits.length === 0 && unmatchedCharges.length === 0 ? (
        <p className="text-[12px] text-zinc-400 text-center py-4">
          Los {totalMovements} movimientos de la cartola coinciden con tus ventas y gastos registrados.
        </p>
      ) : (
        <div className="space-y-3">
          {unmatchedDeposits.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wide mb-1.5">
                Entró plata al banco sin venta registrada
              </p>
              <div className="space-y-1">
                {unmatchedDeposits.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px] bg-orange-500/[0.06] border border-orange-500/[0.15] rounded-lg px-2.5 py-1.5">
                    <span className="text-zinc-400 truncate">{m.description || m.date.toLocaleDateString('es-CL')}</span>
                    <span className="text-orange-300 font-semibold shrink-0 ml-2">{formatCLP(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unmatchedCharges.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wide mb-1.5">
                Salió plata del banco sin gasto registrado
              </p>
              <div className="space-y-1">
                {unmatchedCharges.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px] bg-orange-500/[0.06] border border-orange-500/[0.15] rounded-lg px-2.5 py-1.5">
                    <span className="text-zinc-400 truncate">{m.description || m.date.toLocaleDateString('es-CL')}</span>
                    <span className="text-orange-300 font-semibold shrink-0 ml-2">{formatCLP(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-zinc-600 pt-1">
            Esto no significa que algo esté mal — puede ser una venta a crédito recién cobrada, un gasto sin cargar, o una comisión bancaria. Revísalo con calma.
          </p>
        </div>
      )}
    </div>
  );
}
