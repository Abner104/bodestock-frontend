// src/pages/KitchenDisplay.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, Package, CheckCircle, Clock, Loader,
  Bell, Volume2, VolumeX, ShoppingBag, BellRing, Printer,
} from 'lucide-react';
import {
  collection, onSnapshot, doc, updateDoc, query,
  where, orderBy, getDoc, writeBatch, increment, serverTimestamp, addDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';
import { useFCMToken } from '../hooks/useFCMToken';
import { playBeep } from '../utils/notificationSound';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n ?? 0);

const STATUS = {
  pendiente: { bg: 'bg-amber-500/10', border: 'border-amber-500/25', dot: 'bg-amber-400', label: 'Nuevo' },
  preparando: { bg: 'bg-blue-500/10',  border: 'border-blue-500/25',  dot: 'bg-blue-400',  label: 'Preparando' },
};

export default function KitchenDisplay() {
  const [searchParams] = useSearchParams();
  // ?station=kitchen o ?station=bar filtra los ítems de pedidos de mesa para esa
  // estación (impresora de cocina vs. impresora de bar). Sin el parámetro, se
  // muestra todo — mantiene el comportamiento de siempre para /pedidos-caja y /cocina.
  const station = searchParams.get('station');

  const [orders, setOrders]         = useState([]);
  const [companyId, setCompanyId]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [weightInputs, setWeightInputs] = useState({});
  const [confirming, setConfirming] = useState({});
  const [soundOn, setSoundOn]       = useState(true);
  const [printingOrder, setPrintingOrder] = useState(null);
  const prevIds = useRef(new Set());

  const { permission, requestPermission, error: fcmError } = useFCMToken({ companyId });

  useEffect(() => {
    getUserCompanyId().then(cid => setCompanyId(cid));
  }, []);

  // Imprime la comanda de un pedido en la impresora térmica conectada a este dispositivo.
  // Renderiza un ticket angosto oculto (ver .print-ticket / @media print más abajo) y
  // dispara el diálogo de impresión del navegador, donde se elige la impresora local.
  const printOrder = (order) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
      setPrintingOrder(null);
    }, 50);
  };

  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, `companies/${companyId}/orders`),
      where('status', 'in', ['pendiente', 'preparando']),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        // En esta estación, cada pedido solo muestra los ítems que le corresponden.
        // Los pedidos que no vienen de una mesa (catálogo/tienda) no tienen `station`
        // por ítem — se muestran completos para no romper ese flujo existente.
        .map(order => {
          if (!station || !order.tableId) return order;
          const stationItems = (order.items || []).filter(it => (it.station || 'kitchen') === station);
          return { ...order, items: stationItems };
        })
        .filter(order => !station || !order.tableId || order.items.length > 0);

      // Detectar pedidos NUEVOS y tocar sonido
      const newIds = new Set(list.map(o => o.id));
      const added = list.filter(o => !prevIds.current.has(o.id));
      if (added.length > 0 && prevIds.current.size > 0 && soundOn) {
        playBeep(added.length > 1 ? 3 : 2);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      // Auto-imprimir comandas de pedidos de mesa nuevos en esta estación.
      // El navegador igual va a mostrar el diálogo de impresión salvo que este
      // dispositivo esté en modo kiosko de impresión (Chrome: --kiosk-printing),
      // que es lo que hace falta configurar para que quede 100% desatendido.
      if (station && prevIds.current.size > 0) {
        const newTableOrders = added.filter(o => o.tableId && (o.items || []).length > 0);
        newTableOrders.forEach((order, i) => {
          setTimeout(() => printOrder(order), i * 1200);
        });
      }
      prevIds.current = newIds;

      setOrders(list);
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, soundOn, station]);

  const startPreparing = async (orderId) => {
    await updateDoc(doc(db, `companies/${companyId}/orders`, orderId), { status: 'preparando' });
  };

  const confirmWeight = async (order, itemIndex) => {
    const key = `${order.id}_${itemIndex}`;
    const grams = parseFloat(weightInputs[key]);
    if (!grams || grams <= 0) return;

    const item = order.items[itemIndex];
    const pricePerKg = item.pricePerKg || item.price || 0;
    const confirmedPrice = Math.round((pricePerKg / 1000) * grams);

    setConfirming(prev => ({ ...prev, [key]: true }));
    try {
      const updatedItems = order.items.map((it, idx) =>
        idx !== itemIndex ? it : { ...it, confirmedGrams: grams, confirmedPrice, status: 'ready' }
      );
      const allReady = updatedItems.every(it => it.status === 'ready');
      if (allReady && !order.stockDescontado) {
        await descontarStock({ ...order, items: updatedItems });
      }
      await updateDoc(doc(db, `companies/${companyId}/orders`, order.id), {
        items: updatedItems,
        ...(allReady ? { status: 'listo', stockDescontado: true } : {}),
      });
      setWeightInputs(prev => { const n = { ...prev }; delete n[key]; return n; });
    } finally {
      setConfirming(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const markDone = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order && !order.stockDescontado) await descontarStock(order);
    await updateDoc(doc(db, `companies/${companyId}/orders`, orderId), {
      status: 'listo',
      stockDescontado: true,
    });
  };

  const descontarStock = async (order) => {
    if (!order.inventoryId) return;
    const batch = writeBatch(db);
    for (const item of order.items || []) {
      if (!item.productId) continue;
      const productRef = doc(db, `companies/${companyId}/inventories/${order.inventoryId}/products`, item.productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) continue;
      const productData = productSnap.data();
      if (productData.productType === 'ELABORADO' && productData.receta?.length > 0) {
        for (const ing of productData.receta) {
          const cantidad = Number(ing.cantidad) * (item.qty || 1);
          const insumoRef = doc(db, `companies/${companyId}/inventories/${order.inventoryId}/products`, ing.insumoId);
          const insumoSnap = await getDoc(insumoRef);
          if (!insumoSnap.exists()) continue;
          if ((insumoSnap.data().stock || 0) >= cantidad) {
            batch.update(insumoRef, { stock: increment(-cantidad), updatedAt: serverTimestamp() });
          }
        }
      } else {
        const qty = item.byWeight ? 1 : (item.qty || 1);
        if ((productData.stock || 0) >= qty) {
          batch.update(productRef, { stock: increment(-qty), updatedAt: serverTimestamp() });
        }
      }
    }
    await addDoc(collection(db, `companies/${companyId}/inventory_exits`), {
      source: 'tienda_publica',
      orderId: order.id,
      clientName: order.clientName,
      inventoryId: order.inventoryId,
      products: (order.items || []).map(i => ({
        productId: i.productId,
        productName: i.name,
        quantity: i.qty || 1,
        totalValue: i.confirmedPrice || ((i.price || 0) * (i.qty || 1)),
      })),
      totalValue: order.items?.reduce((s, i) => s + (i.confirmedPrice || ((i.price || 0) * (i.qty || 1))), 0) || 0,
      reason: 'SALE',
      reasonName: 'Venta tienda pública',
      status: 'active',
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#04040a] flex items-center justify-center">
      <Loader className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#04040a] pt-20 px-4 pb-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-1">Pedidos · En vivo</p>
            <h1 className="text-white text-2xl font-black">
              Pedidos activos
              {orders.length > 0 && (
                <span className="ml-2 text-sm font-bold text-amber-400">({orders.length})</span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle sonido */}
            <button
              onClick={() => setSoundOn(v => !v)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                soundOn
                  ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-zinc-600'
              }`}
              title={soundOn ? 'Silenciar alertas' : 'Activar alertas'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2 bg-[#111118] border border-white/[0.07] rounded-xl px-3 py-2">
              <motion.div
                className="w-2 h-2 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-green-400 text-xs font-bold">En vivo</span>
            </div>
          </div>
        </div>

        {/* Banner activar notificaciones push */}
        {permission !== 'granted' && (
          <motion.div
            className="mb-5 flex items-center justify-between gap-3 bg-violet-500/[0.08] border border-violet-500/[0.20] rounded-2xl px-4 py-3"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <BellRing className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold leading-tight">Activar notificaciones</p>
                <p className="text-violet-400/70 text-xs truncate">
                  {permission === 'denied'
                    ? 'Bloqueadas en el navegador — actívalas en Configuración'
                    : 'Recibe alertas aunque no estés en esta página'
                  }
                </p>
              </div>
            </div>
            {permission !== 'denied' && (
              <button
                onClick={requestPermission}
                className="flex-shrink-0 px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold rounded-xl transition-all"
              >
                Activar
              </button>
            )}
          </motion.div>
        )}

        {/* Sin pedidos */}
        {orders.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-white/[0.03] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-gray-700" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">Sin pedidos por ahora</p>
            <p className="text-gray-700 text-xs mt-1">Los nuevos pedidos aparecerán aquí automáticamente</p>
            {soundOn && (
              <p className="text-blue-500/60 text-xs mt-3 flex items-center justify-center gap-1">
                <Bell className="w-3 h-3" /> Sonido activado — te avisaremos cuando llegue un pedido
              </p>
            )}
          </div>
        )}

        {/* Lista de pedidos */}
        <div className="space-y-4">
          <AnimatePresence>
            {orders.map(order => {
              const st = STATUS[order.status] || STATUS.pendiente;
              const allReady = order.items?.every(i => i.status === 'ready');
              const weightPending = order.items?.filter(i => i.byWeight && i.status !== 'ready') || [];
              const orderTotal = order.items?.reduce((s, i) =>
                s + (i.byWeight ? (i.confirmedPrice || 0) : ((i.price || 0) * (i.qty || 1))), 0
              ) || 0;
              const createdAt = order.createdAt?.toDate ? order.createdAt.toDate() : null;

              return (
                <motion.div
                  key={order.id}
                  className={`${st.bg} border ${st.border} rounded-3xl overflow-hidden`}
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 60, scale: 0.95 }}
                  layout
                >
                  {/* Header pedido */}
                  <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.05]">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot} ${order.status === 'pendiente' ? 'animate-pulse' : ''}`} />
                      <div>
                        <p className="text-white font-black text-base leading-tight">{order.clientName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-gray-600 text-xs">#{order.id.slice(-6).toUpperCase()}</p>
                          {createdAt && (
                            <p className="text-gray-700 text-xs">
                              {createdAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printOrder(order)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 transition-all print:hidden"
                        title="Imprimir comanda"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {order.status === 'pendiente' && (
                        <motion.button
                          onClick={() => startPreparing(order.id)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition-all"
                          whileTap={{ scale: 0.96 }}
                        >
                          Aceptar
                        </motion.button>
                      )}
                      {order.status === 'preparando' && (
                        <span className="text-blue-400 text-xs font-semibold flex items-center gap-1">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                            <Clock className="w-3 h-3" />
                          </motion.div>
                          Preparando
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="px-5 py-3 space-y-3">
                    {(order.items || []).map((item, idx) => {
                      const key = `${order.id}_${idx}`;
                      const isReady = item.status === 'ready';
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${item.byWeight ? 'bg-amber-500/15' : 'bg-blue-500/15'}`}>
                            {item.byWeight
                              ? <Scale className="w-4 h-4 text-amber-400" />
                              : <Package className="w-4 h-4 text-blue-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold">{item.name}</p>
                            {item.byWeight ? (
                              isReady ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                  <span className="text-green-400 text-xs font-bold">{item.confirmedGrams}g · {CLP(item.confirmedPrice)}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-amber-400/70 text-xs">~{item.requestedGrams}g</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      placeholder="g real"
                                      value={weightInputs[key] || ''}
                                      onChange={e => setWeightInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                      onKeyDown={e => e.key === 'Enter' && confirmWeight(order, idx)}
                                      className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-500/50 text-center"
                                    />
                                    <motion.button
                                      onClick={() => confirmWeight(order, idx)}
                                      disabled={!weightInputs[key] || confirming[key]}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-black rounded-lg transition-all"
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      {confirming[key] ? '...' : 'OK'}
                                    </motion.button>
                                  </div>
                                </div>
                              )
                            ) : (
                              <p className="text-gray-500 text-xs mt-0.5">
                                x{item.qty} · {CLP((item.price || 0) * (item.qty || 1))}
                              </p>
                            )}
                          </div>
                          {!item.byWeight && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between">
                    <div>
                      {orderTotal > 0 && (
                        <p className="text-white text-sm font-black">{CLP(orderTotal)}</p>
                      )}
                      {weightPending.length > 0 && (
                        <p className="text-amber-400/70 text-xs">{weightPending.length} item{weightPending.length > 1 ? 's' : ''} por pesar</p>
                      )}
                      {order.status === 'preparando' && allReady && (
                        <p className="text-green-400/80 text-xs">Todo listo ✓</p>
                      )}
                    </div>
                    {order.status === 'preparando' && (
                      <motion.button
                        onClick={() => markDone(order.id)}
                        disabled={weightPending.length > 0}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white text-sm font-bold rounded-xl transition-all"
                        whileTap={{ scale: 0.97 }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Listo para retirar
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Ticket de comanda — oculto en pantalla, solo visible al imprimir.
          window.print() en printOrder() usa la impresora que el navegador tenga
          configurada por defecto en este dispositivo (la térmica de esta estación). */}
      {printingOrder && (
        <div className="print-ticket hidden print:block">
          <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, margin: 0 }}>
            {station === 'bar' ? 'BAR' : station === 'kitchen' ? 'COCINA' : 'COMANDA'}
          </p>
          <p style={{ textAlign: 'center', fontSize: 12, margin: '2px 0 8px' }}>
            {printingOrder.clientName} · #{printingOrder.id.slice(-6).toUpperCase()}
          </p>
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />
          {(printingOrder.items || []).map((item, idx) => (
            <p key={idx} style={{ fontSize: 13, margin: '4px 0' }}>
              {item.qty}x {item.name}
            </p>
          ))}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '4px 0' }} />
          <p style={{ textAlign: 'center', fontSize: 10, margin: '6px 0 0' }}>
            {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-ticket, .print-ticket * { visibility: visible; }
          .print-ticket {
            position: absolute;
            top: 0;
            left: 0;
            width: 72mm;
            padding: 4mm;
            font-family: monospace;
            color: #000;
          }
        }
      `}</style>
    </div>
  );
}
