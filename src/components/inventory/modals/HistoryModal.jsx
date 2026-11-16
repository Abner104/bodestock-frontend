// src/components/inventory/modals/HistoryModal.jsx
/**
 * Modal para ver el historial de compras de un producto
 * Incluye filtros por fecha y detalles de cada compra
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as IconX, Clock, History, RotateCcw, PackagePlus, Trash2, ShoppingCart, ArrowDownLeft } from 'lucide-react';

// Movimientos chicos (ej. 0.25 kg de un insumo que se guarda en kg, por una
// receta que pide 250g) se leían peor en la unidad de stock que en la
// chica: "-0.25 kg" obliga a hacer la cuenta mentalmente, "-250 g" se lee
// directo. Solo convierte por debajo de 1 unidad -- una salida de 2.5 kg
// sigue mostrándose en kg, donde el decimal es normal y esperado.
function formatQty(qty, unit) {
  const n = Number(qty) || 0;
  const u = String(unit || '').toLowerCase();
  if (u === 'kg' && Math.abs(n) < 1) return { qty: Math.round(n * 1000), unit: 'g' };
  if ((u === 'l' || u === 'lt' || u === 'litro' || u === 'litros') && Math.abs(n) < 1) {
    return { qty: Math.round(n * 1000), unit: 'ml' };
  }
  return { qty: n, unit };
}

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback para cerrar el modal
 * @param {Object} props.item - Producto con historial
 * @param {Function} props.CLP - Helper para formatear moneda
 */
export default function HistoryModal({
  isOpen = false,
  onClose,
  item,
  CLP
}) {
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filtrar historial por fecha
  const getFilteredHistory = () => {
    let filteredHistory = Array.isArray(item?.history)
      ? item.history.filter(h => {
          // Incluir todo: compras, salidas, anulaciones y mermas
          if (h.type === 'entry' || h.type === 'cancellation') {
            return (h.qty && h.qty > 0) || (h.quantity && h.quantity > 0);
          }
          return true;
        })
      : [];

    if (dateFilter !== 'all' && filteredHistory.length > 0) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filteredHistory = filteredHistory.filter(h => {
        const itemDate = new Date(h.date);

        if (dateFilter === 'today') {
          const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
          return itemDateOnly.getTime() === today.getTime();
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return itemDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return itemDate >= monthAgo;
        } else if (dateFilter === 'custom' && startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return itemDate >= start && itemDate <= end;
        }
        return true;
      });
    }

    return filteredHistory.reverse(); // Más recientes primero
  };

  const filteredHistory = getFilteredHistory();
  // "Último ingreso" debe ser el último evento de tipo compra/entrada, no
  // simplemente el último item del array -- antes tomaba cualquier último
  // evento (incluida una salida/venta), mostrando una cantidad negativa y
  // "$0" de total bajo el label "Último ingreso" (confuso: parecía una
  // compra fallida cuando en realidad era la venta más reciente).
  const lastPurchase = [...(item?.history || [])]
    .reverse()
    .find(h => h.type === 'entry' || h.type === 'purchase' || !h.type);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col"
            style={{ maxHeight: '85vh' }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">Historial de Ingresos</h3>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Información del producto */}
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg mx-6 mt-6 flex-shrink-0">
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base mb-3">
                {item?.name}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm mb-4">
                <div className="flex justify-between sm:block">
                  <span className="text-slate-600 dark:text-slate-400">Stock actual:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {item?.stock ?? 0} {item?.unit}
                  </span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-slate-600 dark:text-slate-400">PPP actual:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {CLP(item?.ppp || 0)}/{item?.unit}
                  </span>
                </div>
                {lastPurchase && (
                  <>
                    <div className="flex justify-between sm:block">
                      <span className="text-slate-600 dark:text-slate-400">Último ingreso (cantidad):</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {(() => { const f = formatQty(lastPurchase.qty || lastPurchase.quantity || 0, item?.unit); return `${f.qty} ${f.unit}`; })()}
                      </span>
                    </div>
                    <div className="flex justify-between sm:block">
                      <span className="text-slate-600 dark:text-slate-400">Último ingreso (total):</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {CLP(lastPurchase.totalPrice || (lastPurchase.price * (lastPurchase.qty || lastPurchase.quantity || 0)) || 0)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Filtro de fecha */}
              <div className="border-t border-slate-200 dark:border-slate-600 pt-3">
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2 block">
                  Filtrar por fecha
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="all">Todas las fechas</option>
                    <option value="today">Hoy</option>
                    <option value="week">Última semana</option>
                    <option value="month">Último mes</option>
                    <option value="custom">Rango personalizado</option>
                  </select>

                  {dateFilter === 'custom' && (
                    <>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        placeholder="Desde"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        placeholder="Hasta"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de historial con scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((h) => {
                    const isCancellation = h.type === 'cancellation';
                    const isShrinkage = h.type === 'shrinkage';
                    const isExit = h.type === 'exit' || (isShrinkage && (h.reason === 'SALE' || h.reason === 'sale'));
                    const isEntry = h.type === 'entry';

                    return (
                      <div
                        key={h.id}
                        className={`p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow ${
                          isCancellation
                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                            : isExit
                              ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                              : isShrinkage
                                ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {/* Fecha y resumen */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium mb-1">
                              {isCancellation ? (
                                <>
                                  <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  <span className="text-red-700 dark:text-red-400">
                                    {(() => { const f = formatQty(h.qty || h.quantity || 0, item?.unit); return `Devolución de ${f.qty} ${f.unit}`; })()}
                                  </span>
                                </>
                              ) : isExit ? (
                                <>
                                  <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  <span className="text-blue-700 dark:text-blue-400">
                                    {(() => { const f = formatQty(Math.abs(h.qty || h.quantity || 0), item?.unit); return `Salida de ${f.qty} ${f.unit}`; })()}
                                  </span>
                                </>
                              ) : isShrinkage ? (
                                <>
                                  <Trash2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                  <span className="text-orange-700 dark:text-orange-400">
                                    {(() => { const f = formatQty(Math.abs(h.qty || h.quantity || 0), item?.unit); return `Merma de ${f.qty} ${f.unit}`; })()}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <PackagePlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {(() => { const f = formatQty(h.qty || h.quantity || 0, item?.unit); return `Ingreso de ${f.qty} ${f.unit}`; })()}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(h.date).toLocaleDateString('es-CL', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            {h.reason && (
                              <div className="mt-2 text-xs text-red-600 dark:text-red-400 italic">
                                Motivo: {h.reason}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Detalles */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          {isExit ? (
                            <>
                              <div className="col-span-2">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Unidades vendidas / salidas</div>
                                <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                                  {(() => { const f = formatQty(Math.abs(h.qty || h.quantity || 0), item?.unit); return `−${f.qty} ${f.unit}`; })()}
                                </div>
                              </div>
                            </>
                          ) : isShrinkage ? (
                            <>
                              <div className="col-span-2">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Unidades dadas de baja</div>
                                <div className="text-base font-bold text-orange-600 dark:text-orange-400">
                                  {(() => { const f = formatQty(Math.abs(h.qty || h.quantity || 0), item?.unit); return `−${f.qty} ${f.unit}`; })()}
                                </div>
                              </div>
                              {h.reason && (
                                <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Motivo</div>
                                  <div className="text-sm font-medium text-orange-700 dark:text-orange-300">{h.reason}</div>
                                </div>
                              )}
                              {h.notes && (
                                <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notas</div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400 italic">{h.notes}</div>
                                </div>
                              )}
                            </>
                          ) : (
                          <>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cantidad</div>
                            <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                              {(() => { const f = formatQty(h.qty || h.quantity || 0, item?.unit); return `${f.qty} ${f.unit}`; })()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Precio por {item?.unit}</div>
                            <div className="text-base font-semibold text-blue-600 dark:text-blue-400">
                              {CLP((h.totalPrice || (h.price * (h.qty || h.quantity || 0)) || h.price || 0) / ((h.qty || h.quantity) || 1))}
                            </div>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total ingresado</div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                              {CLP(h.totalPrice || (h.price * (h.qty || h.quantity || 0)) || h.price || 0)}
                            </div>
                          </div>
                          {h.ppp && (
                            <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">PPP resultante</div>
                              <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                {CLP(h.ppp)} por {item?.unit}
                              </div>
                            </div>
                          )}
                          </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                    <Clock className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm sm:text-base font-medium mb-1">
                      {dateFilter !== 'all' ? 'No hay ingresos en este periodo' : 'No hay ingresos registrados'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {dateFilter !== 'all' ? 'Intenta con otro rango de fechas' : 'Los ingresos de mercadería aparecerán aquí'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de cerrar fijo */}
            <div className="pt-4 pb-6 px-6 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full sm:w-auto sm:ml-auto sm:block px-4 py-2.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
