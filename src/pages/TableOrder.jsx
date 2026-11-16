// src/pages/TableOrder.jsx
// POS del garzón: catálogo del inventario de cocina/bar, arma el pedido de una mesa
// y lo envía a las pantallas de comanda correspondientes (cocina y/o bar).
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Send,
  Loader,
  AlertCircle,
  X,
} from 'lucide-react';
import { getUserCompanyId } from '../services/companyService';
import { getAllInventories } from '../services/inventories-service';
import { useInventoryData } from '../hooks/inventory/useInventoryData';
import { getTable } from '../services/tables-service';
import { sendItemsToKitchen, listenToOrder } from '../services/table-orders-service';
import { PRODUCTION_BUSINESS_TYPES } from '../config/business-types';
import VoiceOrderButton from '../components/inventory/VoiceOrderButton';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n ?? 0);

export default function TableOrder() {
  const { tableId } = useParams();
  const navigate = useNavigate();

  const [companyId, setCompanyId] = useState(null);
  const [table, setTable] = useState(null);
  const [inventoryId, setInventoryId] = useState(null);
  const [loadingTable, setLoadingTable] = useState(true);
  const [tableError, setTableError] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({}); // { productId: { productId, name, price, qty, station } }
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [showCart, setShowCart] = useState(false);

  const { items: products, loading: loadingProducts } = useInventoryData(inventoryId);

  // Cargar la mesa y el inventario de cocina/bar de la empresa
  useEffect(() => {
    (async () => {
      try {
        const cid = await getUserCompanyId();
        setCompanyId(cid);

        const t = await getTable(tableId);
        if (!t) {
          setTableError('Esta mesa ya no existe.');
          setLoadingTable(false);
          return;
        }
        setTable(t);

        const inventories = await getAllInventories();
        const foodInventory = inventories.find(inv => PRODUCTION_BUSINESS_TYPES.includes(inv.type));
        if (foodInventory) setInventoryId(foodInventory.id);
      } catch (err) {
        setTableError(err.message || 'No se pudo cargar la mesa');
      } finally {
        setLoadingTable(false);
      }
    })();
  }, [tableId]);

  // Escuchar el pedido activo de la mesa (para ver qué ya se envió)
  useEffect(() => {
    if (!companyId || !table?.currentOrderId) {
      setCurrentOrder(null);
      return;
    }
    return listenToOrder(companyId, table.currentOrderId, setCurrentOrder);
  }, [companyId, table?.currentOrderId]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => (p.name || '').toLowerCase().includes(q));
  }, [products, search]);

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          productId: product.id,
          name: product.name,
          price: product.salePrice || product.precioVenta || 0,
          station: product.printStation || 'kitchen',
          qty: (existing?.qty || 0) + 1,
        },
      };
    });
  };

  const changeQty = (productId, delta) => {
    setCart(prev => {
      const item = prev[productId];
      if (!item) return prev;
      const qty = item.qty + delta;
      if (qty <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: { ...item, qty } };
    });
  };

  // VoiceOrderButton ya entrega los items en el formato del carrito de la mesa
  // (productId/name/price/qty/station) — solo sumamos sobre lo que ya había.
  const handleVoiceAddItems = (voiceItems) => {
    setCart(prev => {
      const next = { ...prev };
      for (const vi of voiceItems) {
        const existingQty = next[vi.productId]?.qty || 0;
        next[vi.productId] = { ...vi, qty: existingQty + vi.qty };
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (cartItems.length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      const orderId = await sendItemsToKitchen({
        tableId,
        tableName: table.name,
        existingOrderId: table.currentOrderId,
        inventoryId,
        newItems: cartItems,
      });
      setTable(prev => ({ ...prev, currentOrderId: orderId }));
      setCart({});
      setShowCart(false);
    } catch (err) {
      setSendError(err.message || 'No se pudo enviar el pedido');
    } finally {
      setSending(false);
    }
  };

  if (loadingTable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  if (tableError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-slate-700 dark:text-slate-300 font-semibold mb-4">{tableError}</p>
          <button onClick={() => navigate('/mis-mesas')} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">
            Volver a mesas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-20 flex items-center gap-3">
        <button onClick={() => navigate('/mis-mesas')} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{table.name}</h1>
          {table.zone && <p className="text-xs text-slate-500 dark:text-slate-400">{table.zone}</p>}
        </div>
        {currentOrder && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Pedido en curso
          </span>
        )}
      </div>

      {/* Búsqueda + Voz */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
        {inventoryId && (
          <VoiceOrderButton
            productos={products}
            onAddItems={handleVoiceAddItems}
          />
        )}
      </div>

      {/* Catálogo */}
      {!inventoryId ? (
        <div className="px-4 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">
          No hay un inventario de cocina/bar configurado para esta empresa.
        </div>
      ) : loadingProducts ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredProducts.map((product) => {
            const inCart = cart[product.id];
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  inCart
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <p className={`text-sm font-semibold leading-tight ${inCart ? 'text-blue-900 dark:text-white' : 'text-slate-900 dark:text-white'}`}>{product.name}</p>
                <p className={`text-xs mt-1 ${inCart ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{CLP(product.salePrice || product.precioVenta)}</p>
                {inCart && (
                  <span className="inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    x{inCart.qty}
                  </span>
                )}
              </button>
            );
          })}
          {filteredProducts.length === 0 && (
            <p className="col-span-full text-center text-slate-400 dark:text-slate-500 text-sm py-10">Sin productos que coincidan</p>
          )}
        </div>
      )}

      {/* Botón flotante: ver carrito */}
      {cartCount > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-2xl flex items-center justify-between px-5 z-30"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {cartCount} producto{cartCount > 1 ? 's' : ''}
          </span>
          <span>{CLP(cartTotal)}</span>
        </motion.button>
      )}

      {/* Modal carrito / enviar a cocina */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !sending && setShowCart(false)}
          >
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-t-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
                <h3 className="text-lg font-bold text-white">Pedido — {table.name}</h3>
                {!sending && (
                  <button onClick={() => setShowCart(false)} className="text-white hover:bg-white/20 rounded-lg p-1 transition">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {sendError && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {sendError}
                  </div>
                )}
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{CLP(item.price)} c/u · {item.station === 'bar' ? '🍹 Bar' : '🍳 Cocina'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(item.productId, -1)} className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold text-sm text-slate-900 dark:text-white">{item.qty}</span>
                      <button onClick={() => changeQty(item.productId, 1)} className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {cartItems.length === 0 && (
                  <p className="text-center text-slate-400 dark:text-slate-500 text-sm py-10">Carrito vacío</p>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Total</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{CLP(cartTotal)}</span>
                </div>
                <button
                  onClick={handleSend}
                  disabled={sending || cartItems.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {sending ? 'Enviando...' : 'Enviar a cocina/bar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
