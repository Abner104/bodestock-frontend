// src/pages/CashRegisterPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  TrendingUp,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Clock,
  ShoppingCart,
  X,
  Printer,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
  MinusCircle,
  PackagePlus,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebase.js';
import { getWorkerByEmail, formatCLP } from '../services/workers-service.js';
import { getUserRole, getUserCompanyId } from '../services/companyService.js';
import {
  getActiveCashRegister,
  openCashRegister,
  closeCashRegister,
  getExitsByCashRegister,
  registerCashWithdrawal,
  getCashMovements,
  PAYMENT_METHODS
} from '../services/cash-register-service.js';
import { annulInventoryExit, annulInventoryExitItem } from '../services/inventory-exits-service.js';
import GlobalLoading from '../components/GlobalLoading.jsx';
import WorkerDrawerMenu from '../components/WorkerDrawerMenu.jsx';

const CashRegisterPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState(null);
  const [activeRegister, setActiveRegister] = useState(null);
  const [exits, setExits] = useState([]);
  const [movements, setMovements] = useState([]);

  // Apertura
  const [initialCash, setInitialCash] = useState('');
  const [opening, setOpening] = useState(false);

  // Retiro de efectivo
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Cierre
  const [physicalCash, setPhysicalCash] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [closing, setClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeResult, setCloseResult] = useState(null);

  const [error, setError] = useState('');

  // Anulación unificada
  const [annulModal, setAnnulModal] = useState(null);   // exit seleccionada para anular
  const [annulMode, setAnnulMode] = useState('select'); // 'select' | 'confirm_all' | 'confirm_item'
  const [annulItem, setAnnulItem] = useState(null);     // producto específico seleccionado
  const [annulling, setAnnulling] = useState(false);
  // aliases para compatibilidad con funciones existentes
  const annulTarget = annulModal;
  const setAnnulTarget = (exit) => { setAnnulModal(exit); setAnnulMode('confirm_all'); setAnnulItem(null); };
  const annulItemTarget = annulItem ? { exit: annulModal, product: annulItem } : null;
  const setAnnulItemTarget = (val) => { if (val) { setAnnulItem(val.product); setAnnulMode('confirm_item'); } else { setAnnulItem(null); } };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate('/login'); return; }
      try {
        const workerData = await getWorkerByEmail(user.email);
        if (!workerData) {
          // Admin/owner no tiene registro de worker — crear objeto virtual
          const role = await getUserRole();
          if (role !== 'ADMIN') { navigate('/login'); return; }
          const companyId = await getUserCompanyId();
          const adminWorker = { id: user.uid, name: user.displayName || user.email, role: 'ADMIN', companyId };
          setWorker(adminWorker);
          const active = await getActiveCashRegister(user.uid);
          setActiveRegister(active);
          if (active) {
            const [exitsData, movementsData] = await Promise.all([
              getExitsByCashRegister(active.id),
              getCashMovements(active.id),
            ]);
            setExits(exitsData);
            setMovements(movementsData);
          }
          setLoading(false);
          return;
        }
        setWorker(workerData);

        const active = await getActiveCashRegister(workerData.id);
        setActiveRegister(active);

        if (active) {
          const [exitsData, movementsData] = await Promise.all([
            getExitsByCashRegister(active.id),
            getCashMovements(active.id),
          ]);
          setExits(exitsData);
          setMovements(movementsData);
        }
      } catch (e) {
        setError('Error al cargar datos de caja.');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleOpen = async () => {
    if (!initialCash || isNaN(Number(initialCash)) || Number(initialCash) < 0) {
      setError('Ingresa un fondo inicial válido (puede ser 0).');
      return;
    }
    setOpening(true);
    setError('');
    try {
      const id = await openCashRegister({
        workerId: worker.id,
        workerName: worker.name,
        initialCash: Number(initialCash),
        warehouseId: worker.assignedWarehouses?.[0] || null,
        warehouseName: null,
      });
      const active = await getActiveCashRegister(worker.id);
      setActiveRegister(active);
      setExits([]);
      setMovements([]);
    } catch (e) {
      setError(e.message || 'Error al abrir la caja.');
    } finally {
      setOpening(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      setError('Ingresa un monto válido para el retiro.');
      return;
    }
    if (!withdrawReason.trim()) {
      setError('Indica el motivo del retiro.');
      return;
    }
    setWithdrawing(true);
    setError('');
    try {
      await registerCashWithdrawal({
        cashRegisterId: activeRegister.id,
        workerId: worker.id,
        workerName: worker.name,
        amount: Number(withdrawAmount),
        reason: withdrawReason,
      });
      const updated = await getCashMovements(activeRegister.id);
      setMovements(updated);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawReason('');
    } catch (e) {
      setError(e.message || 'Error al registrar el retiro.');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleClose = async () => {
    if (physicalCash === '' || isNaN(Number(physicalCash)) || Number(physicalCash) < 0) {
      setError('Ingresa el monto de efectivo físico en caja.');
      return;
    }
    setClosing(true);
    setError('');
    try {
      const result = await closeCashRegister({
        cashRegisterId: activeRegister.id,
        workerId: worker.id,
        physicalCash: Number(physicalCash),
        closingNote: closingNote.trim() || null,
      });

      const initialCashVal = activeRegister.initialCash || 0;
      const expectedCash = initialCashVal + result.totalCash - (result.totalWithdrawals || 0);
      const difference = Number(physicalCash) - expectedCash;

      setCloseResult({ ...result, initialCash: initialCashVal, expectedCash, difference });
      setActiveRegister(null);
      setShowCloseConfirm(false);
    } catch (e) {
      setError(e.message || 'Error al cerrar la caja.');
    } finally {
      setClosing(false);
    }
  };

  const closeAnnulModal = () => {
    setAnnulModal(null);
    setAnnulItem(null);
    setAnnulMode('select');
    setError('');
  };

  const handleAnnul = async () => {
    if (!annulModal) return;
    setAnnulling(true);
    try {
      await annulInventoryExit(annulModal.id, worker?.name || worker?.email || '');
      const updated = await getExitsByCashRegister(activeRegister.id);
      setExits(updated);
      closeAnnulModal();
    } catch (e) {
      setError(e.message || 'Error al anular la venta.');
    } finally {
      setAnnulling(false);
    }
  };

  const handleAnnulItem = async () => {
    if (!annulModal || !annulItem) return;
    setAnnulling(true);
    try {
      await annulInventoryExitItem(
        annulModal.id,
        annulItem.productId,
        worker?.name || worker?.email || ''
      );
      const updated = await getExitsByCashRegister(activeRegister.id);
      setExits(updated);
      closeAnnulModal();
    } catch (e) {
      setError(e.message || 'Error al anular el producto.');
    } finally {
      setAnnulling(false);
    }
  };

  // Calcular totales del turno actual desde las salidas cargadas
  const calcTotals = () => {
    let totalCash = 0, totalCard = 0, totalTransfer = 0, totalOther = 0, total = 0;
    exits.filter(e => e.status !== 'cancelled').forEach(e => {
      const amt = e.totalValue || 0;
      total += amt;
      if (e.splitPayment && e.splitCashAmount > 0) {
        totalCash += e.splitCashAmount;
        const rest = amt - e.splitCashAmount;
        switch (e.paymentMethod) {
          case 'CARD': totalCard += rest; break;
          case 'TRANSFER': totalTransfer += rest; break;
          default: totalOther += rest; break;
        }
      } else {
        switch (e.paymentMethod) {
          case 'CASH': totalCash += amt; break;
          case 'CARD': totalCard += amt; break;
          case 'TRANSFER': totalTransfer += amt; break;
          case 'CREDIT': totalOther += amt; break; // fiado — no entra en efectivo
          default: totalOther += amt; break;
        }
      }
    });
    return { totalCash, totalCard, totalTransfer, totalOther, total };
  };

  if (loading) return <GlobalLoading />;

  const totals = activeRegister ? calcTotals() : null;
  const totalWithdrawals = movements.reduce((sum, m) => sum + (m.amount || 0), 0);
  const expectedCash = activeRegister ? (activeRegister.initialCash || 0) + (totals?.totalCash || 0) - totalWithdrawals : 0;

  // ===== RESULTADO DE CIERRE =====
  if (closeResult) {
    const diff = closeResult.difference;
    const diffColor = diff === 0 ? 'text-green-500' : diff > 0 ? 'text-blue-500' : 'text-red-500';
    const diffLabel = diff === 0 ? 'Sin diferencia' : diff > 0 ? `Sobrante: ${formatCLP(Math.abs(diff))}` : `Faltante: ${formatCLP(Math.abs(diff))}`;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden print-area"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-3" />
            <h2 className="text-2xl font-bold">Caja Cerrada</h2>
            <p className="text-green-100 text-sm mt-1">Resumen del turno</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Ventas totales</p>
                <p className="text-lg font-bold text-gray-900">{formatCLP(closeResult.totalSales)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Cantidad ventas</p>
                <p className="text-lg font-bold text-gray-900">{closeResult.salesCount}</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { key: 'CASH', val: closeResult.totalCash },
                { key: 'CARD', val: closeResult.totalCard },
                { key: 'TRANSFER', val: closeResult.totalTransfer },
                { key: 'OTHER', val: closeResult.totalOther },
              ].filter(m => m.val > 0).map(m => (
                <div key={m.key} className="flex justify-between text-sm">
                  <span className="text-gray-600">{PAYMENT_METHODS[m.key]?.icon} {PAYMENT_METHODS[m.key]?.label}</span>
                  <span className="font-semibold">{formatCLP(m.val)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fondo inicial</span>
                <span>{formatCLP(closeResult.initialCash)}</span>
              </div>
              {closeResult.totalWithdrawals > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Retiros de efectivo</span>
                  <span className="text-red-500">-{formatCLP(closeResult.totalWithdrawals)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Efectivo esperado</span>
                <span>{formatCLP(closeResult.expectedCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Efectivo físico contado</span>
                <span>{formatCLP(closeResult.physicalCash)}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span className="text-gray-700">Diferencia</span>
                <span className={diffColor}>{diffLabel}</span>
              </div>
            </div>

            {/* Botones acción */}
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 print:hidden"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={() => navigate('/dashboard-trabajador')}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors print:hidden"
              >
                Volver al inicio
              </button>
            </div>

            {/* Footer branding — visible solo en impresión */}
            <div className="hidden print:block text-center pt-4 border-t mt-2">
              <p className="text-sm font-semibold text-gray-700">Resumen de cierre de turno</p>
              <p className="text-xs text-gray-400 mt-1">Powered by <strong>Bodestock.cl</strong></p>
            </div>
          </div>
        </motion.div>

        {/* Estilos de impresión inline */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area {
              position: fixed;
              top: 0; left: 0;
              width: 100%;
              background: white;
            }
            @page { margin: 10mm; size: A4; }
          }
        `}</style>
      </div>
    );
  }

  const isAdmin = worker?.role === 'ADMIN';

  return (
    <div className={`${isAdmin ? 'min-h-screen' : 'min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900'} p-4`}>
      <div className="max-w-md mx-auto">
        {/* Header — solo para cajera, el admin usa el navbar principal */}
        {!isAdmin && (
          <div className="flex items-center gap-3 mb-6 pt-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">Caja</h1>
              <p className="text-blue-200 text-sm">{worker?.name}</p>
            </div>
            <WorkerDrawerMenu workerRole={worker?.role} workerName={worker?.name} workerPermissions={worker?.customPermissions || []} />
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ===== CAJA CERRADA - Formulario apertura ===== */}
        {!activeRegister && (
          <motion.div
            className="bg-white rounded-2xl shadow-xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-6 text-white text-center">
              <Lock className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <h2 className="text-xl font-bold">Caja Cerrada</h2>
              <p className="text-slate-300 text-sm mt-1">Abre tu turno para comenzar a registrar ventas</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fondo inicial en caja (efectivo)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number"
                    min="0"
                    value={initialCash}
                    onChange={e => setInitialCash(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Ingresa cuánto efectivo hay físicamente en la caja al inicio del turno</p>
              </div>

              <button
                onClick={handleOpen}
                disabled={opening}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2"
              >
                {opening ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    Abriendo...
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5" />
                    Abrir Turno
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ===== CAJA ABIERTA ===== */}
        {activeRegister && (() => {
          const ventasActivas = exits.filter(e => e.status !== 'cancelled');
          const ventasAnuladas = exits.filter(e => e.status === 'cancelled');
          return (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Header turno */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-lg">
              {/* Glow decorativo, mismo lenguaje visual que el Dashboard */}
              <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />

              {/* Turno info */}
              <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">Turno abierto</p>
                    <p className="text-slate-400 text-[11px]">
                      Desde {activeRegister.openedAt?.toDate?.()?.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) || '—'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Fondo inicial</p>
                  <p className="font-bold text-sm text-white">{formatCLP(activeRegister.initialCash || 0)}</p>
                </div>
              </div>

              {/* Efectivo en caja — PROTAGONISTA: es el dato que la cajera más
                  necesita de un vistazo, antes iba después del total vendido */}
              <motion.div
                key={expectedCash}
                initial={{ scale: 0.97, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-4 text-center mb-3"
              >
                <p className="text-[11px] text-amber-400 font-semibold mb-1 flex items-center justify-center gap-1">
                  💵 Efectivo en caja ahora
                </p>
                <p className="text-4xl font-black tabular-nums text-white">{formatCLP(expectedCash)}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Fondo + ventas en efectivo{totalWithdrawals > 0 ? ' − retiros' : ''}
                </p>
              </motion.div>

              {/* Total vendido — secundario, info de contexto */}
              <div className="relative flex items-center justify-between bg-white/[0.04] rounded-xl px-3.5 py-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-300">Total vendido</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold tabular-nums text-white">{formatCLP(totals?.total || 0)}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5">
                    {ventasActivas.length} venta{ventasActivas.length !== 1 ? 's' : ''}
                    {ventasAnuladas.length > 0 && <span className="text-red-400"> · {ventasAnuladas.length} anul.</span>}
                  </span>
                </div>
              </div>

              {/* Retiros del turno — solo si hay alguno */}
              {movements.length > 0 && (
                <div className="relative bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] text-red-400 font-medium">🔻 Retiros del turno</p>
                    <p className="text-sm font-bold tabular-nums text-red-300">-{formatCLP(totalWithdrawals)}</p>
                  </div>
                  <div className="space-y-1">
                    {movements.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate flex-1">{m.reason}</span>
                        <span className="ml-2 shrink-0 text-slate-300 font-semibold">{formatCLP(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Métodos de pago — solo se muestra si ya hubo al menos una
                  venta; antes de eso son 4 filas en $0 que solo hacen ruido */}
              {totals?.total > 0 && (
                <div className="relative space-y-1">
                  {[
                    { key: 'CASH',     val: totals?.totalCash || 0,     icon: '💵', label: 'Efectivo' },
                    { key: 'CARD',     val: totals?.totalCard || 0,     icon: '💳', label: 'Débito/Crédito' },
                    { key: 'TRANSFER', val: totals?.totalTransfer || 0, icon: '🏦', label: 'Transferencia' },
                    { key: 'OTHER',    val: totals?.totalOther || 0,    icon: '💰', label: 'Otro' },
                  ].filter(m => m.val > 0).map(m => (
                    <div key={m.key} className="flex items-center justify-between py-1 px-2 rounded-lg">
                      <span className="text-xs text-slate-300">{m.icon} {m.label}</span>
                      <span className="text-sm font-bold tabular-nums text-white">{formatCLP(m.val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón registrar venta — destacado, la acción más frecuente */}
            <motion.button
              onClick={() => navigate('/salida-inventario')}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              whileTap={{ scale: 0.98 }}
            >
              <ShoppingCart className="w-5 h-5" />
              Nueva Venta
            </motion.button>

            {/* Retirar efectivo / Recibir pedido de proveedor — acciones
                secundarias, mismo peso visual entre sí */}
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setShowWithdrawModal(true); setError(''); }}
                className="py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-2xl font-semibold text-sm transition-colors flex flex-col items-center justify-center gap-1"
              >
                <MinusCircle className="w-4.5 h-4.5 text-red-400" />
                Retirar efectivo
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/recepcion-pedido')}
                className="py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-2xl font-semibold text-sm transition-colors flex flex-col items-center justify-center gap-1"
              >
                <PackagePlus className="w-4.5 h-4.5 text-emerald-400" />
                Recibir pedido
              </motion.button>
            </div>

            {/* Lista de ventas */}
            {exits.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-blue-500" />
                    Ventas del turno
                  </h3>
                  <div className="flex items-center gap-2">
                    {ventasAnuladas.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{ventasAnuladas.length} anulada{ventasAnuladas.length !== 1 ? 's' : ''}</span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{ventasActivas.length} activa{ventasActivas.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {exits.map((exit, idx) => {
                    const anulada = exit.status === 'cancelled';
                    const hora = exit.createdAt?.toDate
                      ? exit.createdAt.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                      : exit.createdAt?.toLocaleTimeString?.('es-CL', { hour: '2-digit', minute: '2-digit' }) || '—';
                    const pm = PAYMENT_METHODS[exit.paymentMethod];
                    const prods = exit.products?.slice(0, 2).map(p => p.productName || p.name || 'Producto').join(', ');
                    const masProds = (exit.products?.length || 0) > 2 ? ` +${exit.products.length - 2}` : '';
                    return (
                      <div key={exit.id} className={`flex items-center gap-3 px-4 py-3 ${anulada ? 'bg-red-50/60' : 'bg-white hover:bg-gray-50'} transition-colors`}>
                        {/* Número de venta */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${anulada ? 'bg-red-100 text-red-400' : 'bg-blue-100 text-blue-600'}`}>
                          {exits.length - idx}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-semibold truncate ${anulada ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {prods}{masProds}
                            </p>
                            {anulada && <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-200 text-red-600">ANULADA</span>}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {hora} · {pm?.icon} {pm?.label || exit.paymentMethod} · {exit.products?.length || 0} producto{(exit.products?.length || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${anulada ? 'text-gray-300 line-through' : 'text-emerald-600'}`}>
                            {formatCLP(exit.totalValue || 0)}
                          </span>
                          {!anulada && (
                            <button
                              onClick={() => { setAnnulModal(exit); setAnnulMode('select'); setAnnulItem(null); }}
                              className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                              title="Anular venta"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botón cerrar caja */}
            <button
              onClick={() => { setShowCloseConfirm(true); setError(''); }}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Cerrar Caja
            </button>
          </motion.div>
          );
        })()}
      </div>

      {/* ===== MODAL RETIRAR EFECTIVO ===== */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-bold text-gray-900 text-lg">Retirar efectivo</h3>
                <button onClick={() => { setShowWithdrawModal(false); setError(''); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">¿Cuánto efectivo vas a sacar?</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                      autoFocus
                    />
                  </div>
                  {Number(withdrawAmount) > expectedCash && (
                    <p className="mt-1 text-xs text-amber-600">Ojo: es más de lo que debería haber en caja ({formatCLP(expectedCash)}).</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                  <input
                    type="text"
                    value={withdrawReason}
                    onChange={e => setWithdrawReason(e.target.value)}
                    placeholder="Ej: Pago a proveedor"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                {error && (
                  <div className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowWithdrawModal(false); setError(''); }}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || !withdrawAmount || !withdrawReason.trim()}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {withdrawing ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <>
                        <MinusCircle className="w-4 h-4" />
                        Retirar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MODAL CIERRE DE CAJA ===== */}
      <AnimatePresence>
        {showCloseConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-bold text-gray-900 text-lg">Cerrar Caja</h3>
                <button onClick={() => setShowCloseConfirm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Resumen antes de cerrar */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fondo inicial</span>
                    <span className="font-semibold">{formatCLP(activeRegister?.initialCash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">💵 Ventas en efectivo</span>
                    <span className="font-semibold">{formatCLP(totals?.totalCash || 0)}</span>
                  </div>
                  {totalWithdrawals > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">🔻 Retiros de efectivo</span>
                      <span className="font-semibold text-red-500">-{formatCLP(totalWithdrawals)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span className="text-gray-700">Efectivo esperado</span>
                    <span className="text-gray-900">{formatCLP(expectedCash)}</span>
                  </div>
                </div>

                {/* Conteo físico */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ¿Cuánto efectivo contaste físicamente?
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      value={physicalCash}
                      onChange={e => setPhysicalCash(e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                      autoFocus
                    />
                  </div>
                  {physicalCash !== '' && !isNaN(Number(physicalCash)) && (
                    <div className={`mt-1 text-sm font-medium ${
                      Number(physicalCash) - expectedCash === 0 ? 'text-green-600' :
                      Number(physicalCash) - expectedCash > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {Number(physicalCash) - expectedCash === 0
                        ? '✓ Sin diferencia'
                        : Number(physicalCash) - expectedCash > 0
                          ? `▲ Sobrante: ${formatCLP(Number(physicalCash) - expectedCash)}`
                          : `▼ Faltante: ${formatCLP(Math.abs(Number(physicalCash) - expectedCash))}`
                      }
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
                  <textarea
                    value={closingNote}
                    onChange={e => setClosingNote(e.target.value)}
                    placeholder="Ej: Se encontraron billetes falsos, etc."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  />
                </div>

                {error && (
                  <div className="text-red-600 text-sm flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCloseConfirm(false)}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleClose}
                    disabled={closing || physicalCash === ''}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {closing ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Cerrar Turno
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MODAL UNIFICADO DE ANULACIÓN ===== */}
      <AnimatePresence>
        {annulModal && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { if (!annulling) { setAnnulModal(null); setAnnulItem(null); setAnnulMode('select'); setError(''); } }}
          >
            <motion.div
              className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5">

                {/* PASO 1 — Seleccionar qué anular */}
                {annulMode === 'select' && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <RotateCcw className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">¿Qué quieres anular?</p>
                        <p className="text-xs text-gray-400">{formatCLP(annulModal.totalValue || 0)} · {annulModal.products?.length} producto{annulModal.products?.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {/* Opción anular todo */}
                      <button
                        onClick={() => setAnnulMode('confirm_all')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <RotateCcw className="w-4 h-4 text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Anular toda la venta</p>
                          <p className="text-xs text-gray-400">Se devuelve el stock de todos los productos</p>
                        </div>
                      </button>

                      {/* Opción quitar un producto — solo si hay más de 1 */}
                      {(annulModal.products?.length || 0) > 1 && (
                        <div>
                          <p className="text-xs text-gray-500 px-1 mb-2">O elige un producto específico para quitarlo:</p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {annulModal.products?.filter(p => !annulModal.partialCancellations?.some(c => c.productId === p.productId)).map((p, i) => (
                              <button
                                key={i}
                                onClick={() => { setAnnulItem(p); setAnnulMode('confirm_item'); }}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-left"
                              >
                                <span className="text-sm text-white truncate flex-1">{p.productName || p.name}</span>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span className="text-xs text-gray-400">x{p.quantity} · {formatCLP(p.totalValue || (p.salePrice || 0) * (p.quantity || 1))}</span>
                                  <X className="w-3.5 h-3.5 text-red-400" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => { setAnnulModal(null); setError(''); }}
                      className="w-full py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                )}

                {/* PASO 2A — Confirmar anular toda la venta */}
                {annulMode === 'confirm_all' && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <RotateCcw className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">¿Anular toda la venta?</p>
                        <p className="text-xs text-gray-400">Se restaurará el stock de todos los productos</p>
                      </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 space-y-1.5">
                      {annulModal.products?.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm text-gray-300">
                          <span className="truncate flex-1">{p.productName || p.name}</span>
                          <span className="ml-2 text-gray-400 flex-shrink-0">x{p.quantity} · {formatCLP(p.totalValue || 0)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-red-500/20 mt-1">
                        <span>Total</span>
                        <span className="text-red-400">{formatCLP(annulModal.totalValue || 0)}</span>
                      </div>
                    </div>
                    {error && <p className="text-xs text-red-400 mb-3 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setAnnulMode('select')} disabled={annulling} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-colors">
                        Atrás
                      </button>
                      <button onClick={handleAnnul} disabled={annulling} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                        {annulling ? <><Loader2 className="w-4 h-4 animate-spin" /> Anulando...</> : <><RotateCcw className="w-4 h-4" /> Sí, anular todo</>}
                      </button>
                    </div>
                  </>
                )}

                {/* PASO 2B — Confirmar quitar un producto específico */}
                {annulMode === 'confirm_item' && annulItem && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                        <X className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">¿Quitar este producto?</p>
                        <p className="text-xs text-gray-400">Se restaurará su stock y se recalculará el total</p>
                      </div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-4">
                      <p className="text-sm font-semibold text-white">{annulItem.productName || annulItem.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">x{annulItem.quantity} · {formatCLP(annulItem.totalValue || (annulItem.salePrice || 0) * (annulItem.quantity || 1))}</p>
                    </div>
                    {error && <p className="text-xs text-red-400 mb-3 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setAnnulMode('select')} disabled={annulling} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-colors">
                        Atrás
                      </button>
                      <button onClick={handleAnnulItem} disabled={annulling} className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                        {annulling ? <><Loader2 className="w-4 h-4 animate-spin" /> Quitando...</> : <><X className="w-4 h-4" /> Sí, quitar</>}
                      </button>
                    </div>
                  </>
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL CIERRE — placeholder para no romper el bloque que cierra abajo */}
      <AnimatePresence>
        {false && (
          <motion.div>
            <motion.div>
              <div className="p-5">
                <div className="flex gap-2">
                  <button onClick={() => {}} className="">Cancelar</button>
                  <button onClick={() => {}} className="">
                    <RotateCcw className="w-4 h-4" />
                    Sí, anular
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CashRegisterPage;
