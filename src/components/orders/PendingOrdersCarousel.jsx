// src/components/orders/PendingOrdersCarousel.jsx
// Carrusel de "comandas" estilo ticket térmico para los pedidos PENDING --
// ver de a uno, como en una cocina real, en vez de escanear una lista larga
// de tarjetas administrativas. El resto del panel (filtros, búsqueda,
// pedidos ya aprobados/en camino/facturados) sigue en la lista normal
// debajo; este carrusel es solo para "qué hay que decidir ahora".
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Bike, Store, Loader, CheckCircle, X, Landmark } from 'lucide-react';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n ?? 0);

function minutesAgo(createdAt) {
  const date = createdAt?.toDate ? createdAt.toDate() : (createdAt instanceof Date ? createdAt : null);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export default function PendingOrdersCarousel({ orders, onApprove, onReject, processingOrderId }) {
  const [index, setIndex] = useState(0);
  // Recalcula "hace X minutos" cada 30s -- sin esto el ticket se queda
  // congelado en el minuto en que se montó el componente, y la barra de
  // urgencia (ámbar → rojo a los ~15 min) nunca escalaría sola.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick(v => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Si el pedido actual del carrusel ya no está pendiente (se aprobó/rechazó
  // desde acá o desde la lista de abajo) o la lista cambió de tamaño, no
  // dejar el índice apuntando fuera de rango o a un pedido que ya se fue.
  useEffect(() => {
    if (index >= orders.length) setIndex(Math.max(0, orders.length - 1));
  }, [orders.length, index]);

  if (orders.length === 0) return null;

  const order = orders[Math.min(index, orders.length - 1)];
  const mins = minutesAgo(order.createdAt);
  const isUrgent = mins != null && mins >= 15;
  const isWarning = mins != null && mins >= 7 && mins < 15;
  const urgencyColor = isUrgent ? '#dc2626' : isWarning ? '#f59e0b' : '#f59e0b';
  const urgencyBg = isUrgent ? '#fef2f2' : '#fffbeb';
  const urgencyBorder = isUrgent ? '#fecaca' : '#fde68a';
  const urgencyText = isUrgent ? '#991b1b' : '#92400e';
  const isDelivery = order.deliveryMethod === 'delivery';
  const processing = processingOrderId === order.id;

  return (
    <div className="mb-6">
      {/* Header: posición en el carrusel + flechas */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-gray-800 disabled:opacity-30 flex items-center justify-center flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-gray-300" />
        </button>
        <div className="text-center">
          <p className="text-[11px] font-bold text-slate-500 dark:text-gray-400">
            PEDIDO {index + 1} DE {orders.length}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-gray-500">Pendientes por decidir</p>
        </div>
        <button
          onClick={() => setIndex(i => Math.min(orders.length - 1, i + 1))}
          disabled={index === orders.length - 1}
          className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-blue-600 disabled:opacity-30 flex items-center justify-center flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Puntos de posición */}
      {orders.length > 1 && (
        <div className="flex justify-center gap-1.5 mb-4">
          {orders.map((o, i) => (
            <button
              key={o.id}
              onClick={() => setIndex(i)}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === index ? 18 : 6, background: i === index ? '#0f172a' : '#cbd5e1' }}
            />
          ))}
        </div>
      )}

      {/* El ticket */}
      <div className="flex justify-center px-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm"
          >
            <div className="bg-white rounded-sm shadow-xl overflow-hidden" style={{ fontFamily: "'Courier New', monospace" }}>
              {/* Franja de urgencia */}
              <div className="px-4 py-2 flex items-center justify-between" style={{ background: urgencyBg, borderBottom: `1px solid ${urgencyBorder}` }}>
                <span className="text-[11px] font-extrabold" style={{ color: urgencyText }}>
                  ⏱ {mins == null ? '—' : mins === 0 ? 'RECIÉN LLEGÓ' : `HACE ${mins} MIN`}{isUrgent ? ' · DEMORADO' : ''}
                </span>
                <span className="text-[11px] font-bold" style={{ color: urgencyText }}>#{order.id.slice(-6).toUpperCase()}</span>
              </div>

              <div className="px-5 py-5" style={{ borderLeft: `4px solid ${urgencyColor}` }}>
                {/* Número de pedido, grande */}
                <div className="text-center mb-3">
                  <p className="text-[11px] tracking-widest text-slate-500">PEDIDO</p>
                  <p className="text-3xl font-bold tracking-wide text-slate-900">#{order.id.slice(-6).toUpperCase()}</p>
                </div>

                <div className="border-t border-dashed border-slate-300 mb-3" />

                {/* Items -- lo más grande de todo el ticket */}
                <div className="mb-3 space-y-2.5">
                  {(order.items || []).map((item, i) => (
                    <div key={i}>
                      <p className="text-base font-bold text-slate-900">{item.quantity}x {(item.productName || '').toUpperCase()}</p>
                      {item.note && (
                        <p className="text-sm font-bold pl-3" style={{ color: '#dc2626' }}>
                          ↳ {item.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-300 mb-3" />

                {/* Entrega */}
                <div className="mb-3 flex items-start gap-2">
                  {isDelivery ? <Bike className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" /> : <Store className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-[11px] font-bold tracking-wide" style={{ color: isDelivery ? '#4338ca' : '#059669' }}>
                      {isDelivery ? 'DESPACHO A:' : 'RETIRO EN EL LOCAL'}
                    </p>
                    {isDelivery && order.deliveryAddress && (
                      <p className="text-sm text-slate-800">{order.deliveryAddress}</p>
                    )}
                  </div>
                </div>

                {/* Transferencia -- el negocio tiene que confirmar el
                    comprobante antes de aprobar, a diferencia de
                    efectivo/tarjeta en mostrador que se cobra al momento. */}
                {order.paymentMethod === 'transferencia' && (
                  <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                    <span className="text-[11px] font-bold text-amber-800">PAGA POR TRANSFERENCIA · revisar comprobante</span>
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 mb-3" />

                {/* Cliente */}
                <div className="mb-3 text-xs text-slate-600 space-y-0.5">
                  <div className="flex justify-between"><span>CLIENTE</span><span className="font-bold text-slate-900">{(order.customerInfo?.nombre || 'Cliente').toUpperCase()}</span></div>
                  {order.customerInfo?.telefono && (
                    <div className="flex justify-between"><span>FONO</span><span className="font-bold text-slate-900">{order.customerInfo.telefono}</span></div>
                  )}
                </div>

                <div className="border-t border-dashed border-slate-300 mb-3" />

                {/* Total */}
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold tracking-wide text-slate-900">TOTAL</span>
                  <span className="text-xl font-bold text-slate-900">{CLP(order.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Acciones -- fuera del "papel", tipografía normal de UI */}
            <div className="flex gap-2.5 mt-3" style={{ fontFamily: 'inherit' }}>
              <button
                onClick={() => onApprove(order.id)}
                disabled={processing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {processing ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Aprobar
              </button>
              <button
                onClick={() => onReject(order)}
                disabled={processing}
                className="w-14 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 rounded-xl flex items-center justify-center transition-all"
                title="Rechazar pedido"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
