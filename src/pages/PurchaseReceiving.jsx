// src/pages/PurchaseReceiving.jsx
// Recepción de pedido de proveedor: agregar varios productos (cantidad +
// costo) en un solo flujo, en vez de abrir PurchaseModal una vez por cada
// producto. Al confirmar, llama a purchaseService.registerPurchase en loop
// -- reutiliza toda la lógica existente (conversión de presentación,
// recálculo de PPP, historial) sin duplicarla.
//
// Pensado para que la cajera lo use rápido bajo presión: el costo por
// unidad se autocompleta con el último precio pagado (mismo dato que ya usa
// PurchaseModal.jsx vía item.history), así normalmente solo toca escribir
// la cantidad -- el costo queda ahí por si vino distinto, no hay que
// escribirlo de cero cada vez.
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trash2, PackagePlus, CheckCircle, AlertTriangle, Loader2, ArrowLeft, Check, Package, Receipt, Banknote, ArrowLeftRight, Clock3 } from 'lucide-react';
import { useInventoryData } from '../hooks/inventory/useInventoryData';
import { purchaseService } from '../services/inventory/purchaseService';
import { CLP, toNum } from '../utils/inventory/inventoryHelpers';
import { getActiveInventoryId } from '../hooks/usePlanFeatures';
import { getAllInventories } from '../services/inventories-service';
import { getActiveCashRegister, registerCashWithdrawal } from '../services/cash-register-service';
import { getWorkerByEmail } from '../services/workers-service';
import { auth } from '../firebase/firebase';
import { useToast, ToastContainer } from '../components/ui/Toast.jsx';
import PermissionGuard from '../components/guards/PermissionGuard';
import GlobalLoading from '../components/GlobalLoading.jsx';

const PAYMENT_OPTIONS = [
  { id: 'CASH', label: 'Efectivo de caja', icon: Banknote, hint: 'Se descuenta de tu turno' },
  { id: 'TRANSFER', label: 'Transferencia', icon: ArrowLeftRight, hint: 'Ya pagado' },
  { id: 'PENDING', label: 'Pendiente', icon: Clock3, hint: 'Todavía no se paga' },
];

function getLastUnitPrice(item) {
  if (!item?.history?.length) return 0;
  const purchases = item.history.filter((h) => h.qty > 0);
  if (purchases.length === 0) return 0;
  const last = purchases[purchases.length - 1];
  return last.price || (last.totalPrice && last.qty ? Math.round(last.totalPrice / last.qty) : 0);
}

function PurchaseReceivingContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const inventoryIdFromUrl = searchParams.get('inventoryId') || null;

  // Resolución del inventario a usar: query param > último inventario que el
  // usuario tenía activo (ver setActiveInventoryId en Inventory.jsx) > si hay
  // uno solo en la empresa, ese > si hay varios y no hay nada determinado,
  // se le pregunta al usuario (no se adivina). Sin esto, entrar directo acá
  // sin haber pasado antes por /inventario dejaba inventoryId=null, que cae
  // a la colección legacy companies/{id}/inventory -- vacía en empresas que
  // ya migraron al esquema nuevo, así que el buscador no encontraba nada.
  const [resolvingInventory, setResolvingInventory] = useState(!inventoryIdFromUrl);
  const [inventoryOptions, setInventoryOptions] = useState(null); // null = aún no se sabe si hace falta elegir
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventoryIdFromUrl);

  useEffect(() => {
    if (inventoryIdFromUrl) return;
    let cancelled = false;
    (async () => {
      const active = getActiveInventoryId();
      if (active) {
        if (!cancelled) { setSelectedInventoryId(active); setResolvingInventory(false); }
        return;
      }
      try {
        const all = await getAllInventories();
        if (cancelled) return;
        if (all.length <= 1) {
          setSelectedInventoryId(all[0]?.id || null);
        } else {
          setInventoryOptions(all);
        }
      } catch {
        // Sin inventarios propios (empresa legacy de un solo inventario) --
        // selectedInventoryId queda null, useInventoryData cae a la colección legacy.
      } finally {
        if (!cancelled) setResolvingInventory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inventoryIdFromUrl]);

  const inventoryId = selectedInventoryId;
  const { items, loading } = useInventoryData(inventoryId);

  // Turno de caja activo del usuario actual -- si hay uno abierto, se ofrece
  // "Efectivo de caja" como forma de pago y el total se descuenta automático
  // como retiro (mismo mecanismo que el botón "Retirar efectivo" de /caja),
  // en vez de obligar a ir aparte a anotarlo a mano.
  const [activeCashRegister, setActiveCashRegister] = useState(null);
  const [currentWorker, setCurrentWorker] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const workerData = await getWorkerByEmail(user.email);
        const workerId = workerData?.id || user.uid;
        const workerName = workerData?.name || user.displayName || user.email;
        if (cancelled) return;
        setCurrentWorker({ id: workerId, name: workerName });
        const active = await getActiveCashRegister(workerId);
        if (!cancelled) setActiveCashRegister(active);
      } catch {
        // Sin turno detectable -- la opción de efectivo simplemente no se ofrece.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [lines, setLines] = useState([]); // [{ productId, name, unit, qty, unitPrice, item }]
  const [providerNote, setProviderNote] = useState('');
  const [invoiceTotal, setInvoiceTotal] = useState(''); // total de la factura, solo para verificar contra lo cargado
  const [paymentMethod, setPaymentMethod] = useState('PENDING');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // [{ productId, name, ok, error? }]
  const [cashWithdrawalResult, setCashWithdrawalResult] = useState(null); // { ok, error? } del retiro de caja automático

  // Grilla de productos siempre visible (como en Inventario), filtrable por
  // nombre -- antes solo aparecía una lista desplegable al escribir, que el
  // usuario sentía incómoda comparado con las cards que ya conoce.
  const visibleItems = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    const base = search ? items.filter((it) => String(it.name || '').toLowerCase().includes(search)) : items;
    return base.slice(0, 60);
  }, [items, searchTerm]);

  const selectedIds = useMemo(() => new Set(lines.map((l) => l.productId)), [lines]);

  const toggleLine = (item) => {
    setLines((prev) => {
      if (prev.some((l) => l.productId === item.id)) {
        return prev.filter((l) => l.productId !== item.id);
      }
      // Autocompleta con el último costo pagado -- la cajera normalmente
      // solo necesita tocar la cantidad, no escribir el costo de cero.
      const lastPrice = getLastUnitPrice(item);
      return [...prev, { productId: item.id, name: item.name, unit: item.unit, qty: '', unitPrice: lastPrice > 0 ? String(lastPrice) : '', item }];
    });
  };

  const removeLine = (productId) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const updateLine = (productId, field, value) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, [field]: value } : l)));
  };

  const total = lines.reduce((sum, l) => sum + toNum(l.qty) * toNum(l.unitPrice), 0);
  const missingQty = lines.filter((l) => toNum(l.qty) <= 0);
  const missingPrice = lines.filter((l) => toNum(l.qty) > 0 && toNum(l.unitPrice) <= 0);
  const invoiceDiff = invoiceTotal !== '' ? toNum(invoiceTotal) - total : null;

  const handleSubmit = async () => {
    if (submitting) return;
    if (lines.length === 0) {
      toast.error('Agrega al menos un producto al pedido.');
      return;
    }
    if (missingQty.length > 0) {
      toast.error(`Falta la cantidad de "${missingQty[0].name}".`);
      return;
    }
    if (missingPrice.length > 0) {
      toast.error(`Falta el costo de "${missingPrice[0].name}".`);
      return;
    }

    setSubmitting(true);
    const outcomes = [];

    for (const line of lines) {
      try {
        const qty = Math.round(toNum(line.qty));
        const unitPrice = toNum(line.unitPrice);
        await purchaseService.registerPurchase(
          line.productId,
          { qty: String(qty), price: String(Math.round(unitPrice * qty)) },
          line.item,
          { inventoryId }
        );
        outcomes.push({ productId: line.productId, name: line.name, ok: true });
      } catch (err) {
        outcomes.push({ productId: line.productId, name: line.name, ok: false, error: err.message });
      }
    }

    // Si se pagó en efectivo y hay turno abierto, descontarlo de la caja
    // automáticamente -- mismo mecanismo que "Retirar efectivo" en /caja,
    // para no obligar a ir aparte a anotarlo a mano.
    let cashWithdrawalError = null;
    if (paymentMethod === 'CASH' && activeCashRegister) {
      try {
        await registerCashWithdrawal({
          cashRegisterId: activeCashRegister.id,
          workerId: currentWorker?.id,
          workerName: currentWorker?.name,
          amount: total,
          reason: `Pago a proveedor${providerNote.trim() ? ` — ${providerNote.trim()}` : ''}`,
        });
      } catch (err) {
        cashWithdrawalError = err.message;
      }
    }

    const allOk = outcomes.every((o) => o.ok);
    if (allOk) {
      toast.success(`✅ Pedido registrado: ${outcomes.length} producto${outcomes.length !== 1 ? 's' : ''}`);
    } else {
      const failedCount = outcomes.filter((o) => !o.ok).length;
      toast.error(`${failedCount} producto${failedCount !== 1 ? 's' : ''} no se pudo registrar, revisa abajo`);
    }
    if (cashWithdrawalError) {
      toast.error(`No se pudo descontar de la caja: ${cashWithdrawalError}`);
    }

    setResults(outcomes);
    setSubmitting(false);
    setCashWithdrawalResult(cashWithdrawalError ? { ok: false, error: cashWithdrawalError } : (paymentMethod === 'CASH' && activeCashRegister ? { ok: true } : null));
    setLines(outcomes.filter((o) => !o.ok).map((o) => lines.find((l) => l.productId === o.productId)).filter(Boolean));
  };

  if (resolvingInventory) return <GlobalLoading />;

  // Varios inventarios y ninguno determinado -- se le pregunta al usuario
  // en vez de adivinar cuál quiso decir.
  if (inventoryOptions && !selectedInventoryId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-center">
        <div className="max-w-sm w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">¿A qué inventario llegó el pedido?</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Tienes más de un inventario, elige a cuál vas a ingresar la mercadería.</p>
          <div className="space-y-2">
            {inventoryOptions.map((inv) => (
              <button
                key={inv.id}
                onClick={() => setSelectedInventoryId(inv.id)}
                className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100"
              >
                {inv.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <GlobalLoading />;

  const allOk = results && results.every((r) => r.ok);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5 pt-2">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-emerald-600" />
              Recepción de pedido
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Toca los productos que llegaron y pon la cantidad</p>
          </div>
        </div>

        {results && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-4 mb-4 border ${allOk ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {allOk ? <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />}
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                {allOk ? 'Pedido registrado' : 'Algunos productos no se pudieron registrar'}
              </p>
            </div>
            <div className="space-y-1">
              {results.map((r) => (
                <div key={r.productId} className="text-xs flex items-center justify-between">
                  <span className={r.ok ? 'text-slate-600 dark:text-slate-300' : 'text-red-600 dark:text-red-400'}>{r.name}</span>
                  <span className={r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{r.ok ? '✓ Registrado' : r.error || 'Error'}</span>
                </div>
              ))}
            </div>
            {allOk && cashWithdrawalResult && (
              <div className={`mt-3 text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${
                cashWithdrawalResult.ok
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                <Banknote className="w-3.5 h-3.5 shrink-0" />
                {cashWithdrawalResult.ok
                  ? `Se descontó ${CLP(total)} de la caja como retiro (pago a proveedor).`
                  : `No se pudo descontar de la caja: ${cashWithdrawalResult.error}. Regístralo manualmente en /caja.`}
              </div>
            )}
            {allOk && (
              <button
                onClick={() => { setResults(null); setProviderNote(''); setInvoiceTotal(''); setPaymentMethod('PENDING'); setCashWithdrawalResult(null); }}
                className="w-full mt-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Registrar otro pedido
              </button>
            )}
          </motion.div>
        )}

        {!allOk && (
          <>
            {/* Buscador */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Busca un producto..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Grilla de productos — mismo estilo de card que Inventario
                (foto + nombre + stock), tocable para agregar/quitar del
                pedido. Siempre visible, no solo al escribir en el buscador. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 max-h-[340px] overflow-y-auto pr-0.5">
              {visibleItems.length === 0 && (
                <div className="col-span-full text-center py-8 text-sm text-slate-400">
                  {searchTerm ? `No se encontró "${searchTerm}"` : 'No hay productos en este inventario'}
                </div>
              )}
              {visibleItems.map((it) => {
                const isSelected = selectedIds.has(it.id);
                const thumbnailUrl = it.photos?.[0] || it.photoURL || null;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleLine(it)}
                    className={`relative text-left rounded-xl border p-2 transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-1.5">
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">{it.name}</p>
                    <p className="text-[10px] text-slate-400">Stock: {it.stock ?? 0} {it.unit}</p>
                  </button>
                );
              })}
            </div>

            {/* Nota de proveedor / documento (opcional, solo anotación) */}
            {lines.length > 0 && (
              <input
                type="text"
                value={providerNote}
                onChange={(e) => setProviderNote(e.target.value)}
                placeholder="Proveedor / N° de factura o guía (opcional)"
                className="w-full mb-3 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}

            {/* Lista de productos agregados — solo pide CANTIDAD de entrada;
                el costo ya viene autocompletado con el último precio pagado
                (ver toggleLine) y solo hay que tocarlo si vino distinto. */}
            {lines.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400">Toca los productos de arriba para agregarlos al pedido</div>
            ) : (
              <div className="space-y-2 mb-4">
                <AnimatePresence>
                  {lines.map((line) => (
                    <motion.div
                      key={line.productId}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{line.name}</p>
                        <button onClick={() => removeLine(line.productId)} className="text-red-400 hover:text-red-600 shrink-0 ml-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Cantidad que llegó ({line.unit || 'unidad'})</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.qty}
                            onChange={(e) => updateLine(line.productId, 'qty', e.target.value)}
                            placeholder="0"
                            autoFocus
                            className="w-full px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Costo por {line.unit || 'unidad'}{toNum(line.unitPrice) > 0 ? ' (último pagado)' : ''}
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.unitPrice}
                              onChange={(e) => updateLine(line.productId, 'unitPrice', e.target.value)}
                              placeholder="0"
                              className="w-full pl-5 pr-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                      {toNum(line.qty) > 0 && toNum(line.unitPrice) > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 text-right font-medium">
                          Subtotal: {CLP(toNum(line.qty) * toNum(line.unitPrice))}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {lines.length > 0 && (
              <>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3 mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total del pedido</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{CLP(total)}</span>
                </div>

                {/* Total de la factura — compara contra la suma de lo que
                    cargaste arriba (cantidad × costo de cada producto). Sirve
                    para detectar un error de tipeo (ej. pusiste $120 en vez
                    de $1.200 en algún producto) antes de confirmar -- no
                    reparte el monto ni reemplaza el costo por producto. */}
                <div className="mb-4">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    <Receipt className="w-3.5 h-3.5" />
                    Total de la factura (opcional)
                  </label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    Escribe el monto total que dice el papel de la factura, para comparar con lo que cargaste arriba.
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={invoiceTotal}
                      onChange={(e) => setInvoiceTotal(e.target.value)}
                      placeholder="Ej: 12.000"
                      className="w-full pl-7 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {invoiceDiff !== null && (
                    <p className={`text-xs mt-1 font-medium ${invoiceDiff === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {invoiceDiff === 0
                        ? '✓ Coincide con lo que cargaste arriba'
                        : invoiceDiff > 0
                          ? `⚠️ La factura dice ${CLP(toNum(invoiceTotal))} pero arriba solo cargaste ${CLP(total)} — revisa si falta algún producto o si algún costo está mal escrito`
                          : `⚠️ Arriba cargaste ${CLP(total)}, más que los ${CLP(toNum(invoiceTotal))} de la factura — revisa si algún costo quedó repetido o mal escrito`}
                    </p>
                  )}
                </div>

                {/* Forma de pago */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">¿Cómo se pagó?</label>
                  <div className={`grid gap-1.5 ${activeCashRegister ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {PAYMENT_OPTIONS.filter((opt) => opt.id !== 'CASH' || activeCashRegister).map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = paymentMethod === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPaymentMethod(opt.id)}
                          className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border text-center transition-colors ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                          <p className="text-[11px] font-semibold text-slate-800 dark:text-white leading-tight">{opt.label}</p>
                        </button>
                      );
                    })}
                  </div>
                  {!activeCashRegister && (
                    <p className="text-[11px] text-slate-400 mt-1.5">No tienes un turno de caja abierto, por eso no aparece "Efectivo de caja".</p>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
                  ) : (
                    <><PackagePlus className="w-4 h-4" /> Registrar ingreso de {lines.length} producto{lines.length !== 1 ? 's' : ''}</>
                  )}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PurchaseReceiving() {
  return (
    <PermissionGuard requiredPermissions={['manage_inventory', 'register_purchases']}>
      <PurchaseReceivingContent />
    </PermissionGuard>
  );
}
