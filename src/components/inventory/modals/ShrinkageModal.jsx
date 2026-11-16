import React, { useState } from 'react';
import { X as IconX, AlertTriangle } from 'lucide-react';

const ShrinkageModal = ({ isOpen, onClose, item, onRegisterShrinkage, CLP }) => {
  const [shrinkage, setShrinkage] = useState({
    quantity: 0,
    reason: 'vencido',
    notes: '',
  });

  const reasons = [
    { value: 'vencido', label: 'Producto vencido' },
    { value: 'dañado', label: 'Producto dañado' },
    { value: 'robo', label: 'Robo/Pérdida' },
    { value: 'error_conteo', label: 'Error de conteo' },
    { value: 'deterioro', label: 'Deterioro natural' },
    { value: 'otros', label: 'Otros motivos' },
  ];

  const toNum = (v) => {
    const n = Number(String(v ?? 0).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const quantity = toNum(shrinkage.quantity);

    if (quantity <= 0) {
      alert('La cantidad debe ser mayor a 0.');
      return;
    }

    if (quantity > (item?.stock ?? 0)) {
      alert('No puedes registrar una merma mayor al stock disponible.');
      return;
    }

    onRegisterShrinkage({
      quantity,
      reason: shrinkage.reason,
      notes: shrinkage.notes.trim(),
    });

    // Reset form
    setShrinkage({ quantity: 0, reason: 'vencido', notes: '' });
  };

  const handleClose = () => {
    setShrinkage({ quantity: 0, reason: 'vencido', notes: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl sm:rounded-2xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
              <span className="hidden sm:inline">Registrar merma</span>
              <span className="sm:hidden">Merma</span>
            </h3>
            <div className="text-xs sm:text-sm text-slate-500 truncate ml-2">
              {item?.name}
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-md hover:bg-slate-50 flex-shrink-0">
            <IconX className="w-4 sm:w-5 h-4 sm:h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Información del producto */}
            <div className="bg-red-50 rounded-lg p-4 mb-4 border border-red-100">
              <h4 className="font-medium text-red-900 text-sm mb-2">{item?.name}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-red-700">
                <div>Stock disponible: <span className="font-semibold text-red-800">{item?.stock ?? 0} {item?.unit}</span></div>
              </div>
            </div>

            {/* Cantidad de merma */}
            <div>
              <label className="block text-xs sm:text-sm text-slate-700 mb-1.5">Cantidad perdida *</label>
              <input
                required
                type="number"
                min="0.01"
                max={item?.stock ?? 0}
                step="0.01"
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                value={shrinkage.quantity}
                onChange={(e) => setShrinkage(s => ({ ...s, quantity: toNum(e.target.value) }))}
                placeholder={`Máximo: ${item?.stock ?? 0}`}
              />
            </div>

            {/* Razón de la merma */}
            <div>
              <label className="block text-xs sm:text-sm text-slate-700 mb-1.5">Razón de la merma *</label>
              <select
                required
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                value={shrinkage.reason}
                onChange={(e) => setShrinkage(s => ({ ...s, reason: e.target.value }))}
              >
                {reasons.map(reason => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notas adicionales */}
            <div>
              <label className="block text-xs sm:text-sm text-slate-700 mb-1.5">Notas adicionales</label>
              <textarea
                className="w-full px-3 py-2.5 sm:py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={3}
                value={shrinkage.notes}
                onChange={(e) => setShrinkage(s => ({ ...s, notes: e.target.value }))}
                placeholder="Detalles opcionales sobre la merma..."
              />
            </div>

            {/* Información de pérdida económica */}
            {shrinkage.quantity > 0 && (
              <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                <p className="font-medium">Impacto económico estimado:</p>
                <p className="mt-1">
                  {CLP((shrinkage.quantity) * (item?.ppp ?? 0))}
                  ({shrinkage.quantity} {item?.unit} × {CLP(item?.ppp ?? 0)})
                </p>
              </div>
            )}

            {/* Botones */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm rounded-md bg-red-600 text-black hover:bg-red-700 transition font-medium"
              >
                Registrar merma
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShrinkageModal;