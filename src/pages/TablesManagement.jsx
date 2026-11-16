// src/pages/TablesManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed,
  Plus,
  Edit,
  Trash2,
  X,
  Loader,
  AlertCircle,
  Fingerprint,
  Lock,
  User,
  Receipt,
} from 'lucide-react';
import { createTable, updateTable, deleteTable, listenToTables, occupyTable, freeTable, TABLE_STATUS } from '../services/tables-service';
import { getUserCompanyId, getUserRole } from '../services/companyService';
import { getAllWorkers } from '../services/workers-service';
import {
  isWebAuthnSupported,
  getAllStoredPasskeys,
  authenticateUserWithPasskey,
  registerUserPasskey,
} from '../services/passkey-service';
import { auth } from '../firebase/firebase';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { API_URL } from '../config/env';

const STATUS_STYLES = {
  [TABLE_STATUS.FREE]: {
    label: 'Libre',
    ring: 'ring-emerald-200 dark:ring-emerald-500/30',
    top: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    icon: 'text-emerald-300 dark:text-emerald-500/20',
    card: 'bg-white dark:bg-slate-800',
  },
  [TABLE_STATUS.OCCUPIED]: {
    label: 'Ocupada',
    ring: 'ring-red-200 dark:ring-red-500/30',
    top: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    icon: 'text-red-200 dark:text-red-500/20',
    card: 'bg-red-50/50 dark:bg-red-950/30',
  },
  [TABLE_STATUS.BILLING]: {
    label: 'Por cobrar',
    ring: 'ring-amber-200 dark:ring-amber-500/30',
    top: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    icon: 'text-amber-200 dark:text-amber-500/20',
    card: 'bg-amber-50/50 dark:bg-amber-950/30',
  },
};

export default function TablesManagement() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [formData, setFormData] = useState({ name: '', zone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Apertura / reingreso a mesa por huella
  const [garzones, setGarzones] = useState([]); // trabajadores con rol GARZON
  const [openingTable, setOpeningTable] = useState(null); // mesa que se está abriendo o reingresando
  const [openError, setOpenError] = useState(null);
  const [authenticating, setAuthenticating] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    let unsubscribeTables;
    const unsubscribeAuth = onAuthStateChanged(auth, async () => {
      // Se re-dispara también tras el login por huella de un garzón, así isAdmin
      // y la lista de mesas quedan correctos para quien está sesión activa ahora.
      const id = await getUserCompanyId();
      const role = await getUserRole();
      setUserRole(role);
      unsubscribeTables?.();
      if (id) {
        unsubscribeTables = listenToTables(id, (data) => {
          setTables(data);
          setLoading(false);
        });
        try {
          const workers = await getAllWorkers();
          setGarzones(workers.filter(w => w.role === 'GARZON' && w.isActive !== false));
        } catch {
          // Sin garzones cargados, el modal de apertura mostrará el mensaje correspondiente
        }
      } else {
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      unsubscribeTables?.();
    };
  }, []);

  // Garzones de esta empresa que tienen huella registrada en este dispositivo
  const storedPasskeys = isWebAuthnSupported() ? getAllStoredPasskeys() : [];
  const garzonesConHuella = garzones.filter(g => storedPasskeys.some(p => p.email === g.email));
  const garzonesSinHuella = garzones.filter(g => !storedPasskeys.some(p => p.email === g.email));

  const openTableFlow = (table) => {
    setOpenError(null);
    setOpeningTable(table);
  };

  // Convierte la huella verificada en una sesión real de Firebase Auth del garzón —
  // así Firestore sabe con certeza quién escribe (request.auth.uid), no solo confía
  // en que la UI mostró la huella correcta.
  const signInAsWorker = async (email) => {
    if (auth.currentUser?.email === email) return; // ya es esa sesión, no hace falta relogear
    const res = await fetch(`${API_URL}/api/auth/passkey-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      throw new Error(data.error || 'No se pudo iniciar sesión con esa huella.');
    }
    await signInWithCustomToken(auth, data.token);
  };

  const handleAuthenticateAndOpen = async (garzon) => {
    setAuthenticating(true);
    setOpenError(null);
    try {
      await authenticateUserWithPasskey(garzon.email);
      await signInAsWorker(garzon.email);
      // Si la mesa ya estaba ocupada por este mismo garzón, solo confirma el reingreso
      // (no reasigna nada). Si estaba libre, la toma.
      if (openingTable.status === TABLE_STATUS.FREE) {
        await occupyTable(openingTable.id, { orderId: null, workerId: garzon.id });
      }
      const tableId = openingTable.id;
      setOpeningTable(null);
      navigate(`/mesa/${tableId}`);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setOpenError('Autenticación cancelada.');
      } else {
        setOpenError(err.message || 'No se pudo verificar la huella.');
      }
    } finally {
      setAuthenticating(false);
    }
  };

  const handleRegisterPasskey = async (garzon) => {
    setAuthenticating(true);
    setOpenError(null);
    try {
      await registerUserPasskey(garzon.email, garzon.name);
      await signInAsWorker(garzon.email);
      await occupyTable(openingTable.id, { orderId: null, workerId: garzon.id });
      const tableId = openingTable.id;
      setOpeningTable(null);
      navigate(`/mesa/${tableId}`);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setOpenError('Registro cancelado.');
      } else {
        setOpenError(err.message || 'No se pudo registrar la huella.');
      }
    } finally {
      setAuthenticating(false);
    }
  };

  const handleFreeTable = async (table, e) => {
    e.stopPropagation();
    // Liberar una mesa ajena solo lo puede hacer el dueño/admin — un garzón no puede
    // vaciar la mesa de otro garzón sin autorización.
    if (!isAdmin) {
      alert('Solo un administrador puede liberar una mesa sin cobrar.');
      return;
    }
    // TODO: cuando exista el cierre de cuenta (cobro), esto debería exigir que la mesa
    // esté en estado "por cobrar" y no simplemente liberarla sin más.
    if (!window.confirm(`¿Liberar "${table.name}" sin cobrar? Úsalo solo si fue un error.`)) return;
    try {
      await freeTable(table.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', zone: '' });
    setError(null);
  };

  const openCreate = () => {
    setEditingTable(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (table) => {
    setEditingTable(table);
    setFormData({ name: table.name, zone: table.zone || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('El número o nombre de la mesa es obligatorio');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingTable) {
        await updateTable(editingTable.id, formData);
      } else {
        await createTable(formData);
      }
      setShowModal(false);
      resetForm();
      setEditingTable(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table) => {
    if (!window.confirm(`¿Eliminar la mesa "${table.name}"?`)) return;
    try {
      await deleteTable(table.id, tables);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-3">
            <UtensilsCrossed className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
            Mesas
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Gestiona las mesas de tu local para que los garzones tomen pedidos</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-xl transition-all flex items-center gap-2 shadow-lg self-start"
        >
          <Plus className="w-5 h-5" />
          Nueva Mesa
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : tables.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-12 text-center">
          <UtensilsCrossed className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No tienes mesas configuradas</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Creá tus mesas para que los garzones puedan tomar pedidos</p>
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Crear Primera Mesa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table) => {
            const style = STATUS_STYLES[table.status] || STATUS_STYLES[TABLE_STATUS.FREE];
            const isFree = table.status === TABLE_STATUS.FREE;
            const assignedGarzon = garzones.find(g => g.id === table.assignedWorkerId);
            const canReenter = table.status === TABLE_STATUS.OCCUPIED && garzones.length > 0;
            const handleCardClick = () => {
              if (isAdmin) {
                // El admin ya está autenticado con su propia cuenta — puede entrar
                // a cualquier mesa sin pasar por la verificación de huella del garzón.
                if (isFree) {
                  occupyTable(table.id, { orderId: null, workerId: null }).finally(() => navigate(`/mesa/${table.id}`));
                } else {
                  navigate(`/mesa/${table.id}`);
                }
                return;
              }
              if (isFree || canReenter) openTableFlow(table);
            };
            const clickable = isAdmin || isFree || canReenter;
            return (
              <div
                key={table.id}
                className={`group relative rounded-2xl ring-1 ${style.ring} ${style.card} shadow-sm overflow-hidden transition-all ${clickable ? 'hover:shadow-lg hover:-translate-y-0.5' : ''}`}
              >
                {/* Franja de estado */}
                <div className={`h-1.5 w-full ${style.top}`} />

                {/* Ícono grande decorativo de fondo */}
                <UtensilsCrossed className={`absolute -right-3 -bottom-3 w-20 h-20 rotate-12 pointer-events-none ${style.icon}`} />

                {/* Acciones admin (editar / borrar) — discretas, aparecen en hover */}
                <div className="absolute top-3.5 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEdit(table); }}
                    className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 backdrop-blur-sm transition"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(table); }}
                    className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 backdrop-blur-sm transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCardClick}
                  disabled={!clickable}
                  className="relative w-full text-left px-4 pt-4 pb-4 disabled:cursor-default"
                >
                  {/* Badge de estado */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${style.badge}`}>
                    {style.label}
                  </span>

                  {/* Nombre de mesa — protagonista */}
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-2.5 leading-tight truncate pr-8">
                    {table.name}
                  </p>
                  {table.zone && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{table.zone}</p>
                  )}

                  {/* Garzón asignado */}
                  {assignedGarzon && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <User className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{assignedGarzon.name}</span>
                    </div>
                  )}

                  {/* Call to action */}
                  {isFree && (
                    <p className="text-xs font-bold mt-3 text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Fingerprint className="w-4 h-4" /> {isAdmin ? 'Abrir mesa' : 'Tocar para abrir'}
                    </p>
                  )}
                  {canReenter && !isAdmin && (
                    <p className="text-xs font-bold mt-3 text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <Fingerprint className="w-4 h-4" /> Tocar para entrar
                    </p>
                  )}
                  {isAdmin && !isFree && (
                    <p className="text-xs font-bold mt-3 text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4" /> Ver mesa
                    </p>
                  )}
                </button>

                {isAdmin && !isFree && (
                  <div className="px-4 pb-3.5 relative">
                    <span
                      onClick={(e) => handleFreeTable(table, e)}
                      className="text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 underline underline-offset-2 inline-block cursor-pointer"
                    >
                      Liberar sin cobrar
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{editingTable ? 'Editar Mesa' : 'Nueva Mesa'}</h3>
                <button onClick={() => setShowModal(false)} className="text-white hover:bg-white/20 rounded-lg p-1 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Número o nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Mesa 1, Terraza 3, Barra 2"
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Zona <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    placeholder="Ej: Salón, Terraza, Segundo piso"
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader className="w-4 h-4 animate-spin" />}
                  {saving ? 'Guardando...' : editingTable ? 'Guardar cambios' : 'Crear mesa'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: abrir mesa por huella */}
      <AnimatePresence>
        {openingTable && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !authenticating && setOpeningTable(null)}
          >
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const isReentry = openingTable.status === TABLE_STATUS.OCCUPIED;
                const assignedGarzon = isReentry ? garzones.find(g => g.id === openingTable.assignedWorkerId) : null;
                const assignedHasPasskey = assignedGarzon && storedPasskeys.some(p => p.email === assignedGarzon.email);

                return (
                  <>
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">{isReentry ? `Entrar a ${openingTable.name}` : `Abrir ${openingTable.name}`}</h3>
                        <p className="text-xs text-blue-100">
                          {isReentry ? 'Solo el garzón que la abrió puede volver a entrar' : '¿Quién va a atender esta mesa?'}
                        </p>
                      </div>
                      {!authenticating && (
                        <button onClick={() => setOpeningTable(null)} className="text-white hover:bg-white/20 rounded-lg p-1 transition">
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="p-5 space-y-4">
                      {openError && (
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {openError}
                        </div>
                      )}

                      {!isWebAuthnSupported() ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                          Este dispositivo no soporta autenticación por huella.
                        </p>
                      ) : authenticating ? (
                        <div className="flex flex-col items-center py-8 gap-3">
                          <Loader className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                          <p className="text-sm text-slate-600 dark:text-slate-400">Verificando huella...</p>
                        </div>
                      ) : isReentry ? (
                        // Reingreso a mesa ocupada: solo el garzón asignado, nadie más
                        !assignedGarzon ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                            No se encontró al garzón asignado. Pídele a un administrador que libere la mesa.
                          </p>
                        ) : !assignedHasPasskey ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                            <strong>{assignedGarzon.name}</strong> no tiene su huella registrada en este dispositivo.
                            Solo un administrador puede liberar esta mesa.
                          </p>
                        ) : (
                          <button
                            onClick={() => handleAuthenticateAndOpen(assignedGarzon)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition text-left"
                          >
                            <Fingerprint className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-white">{assignedGarzon.name}</span>
                          </button>
                        )
                      ) : garzones.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                          No hay garzones registrados. Creá un trabajador con rol Garzón primero.
                        </p>
                      ) : (
                        // Mesa libre: cualquier garzón la puede tomar
                        <div className="space-y-2">
                          {garzonesConHuella.map((g) => (
                            <button
                              key={g.id}
                              onClick={() => handleAuthenticateAndOpen(g)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition text-left"
                            >
                              <Fingerprint className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-white">{g.name}</span>
                            </button>
                          ))}

                          {garzonesSinHuella.length > 0 && (
                            <>
                              {garzonesConHuella.length > 0 && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 pt-2">Sin huella registrada en este dispositivo</p>
                              )}
                              {garzonesSinHuella.map((g) => (
                                <button
                                  key={g.id}
                                  onClick={() => handleRegisterPasskey(g)}
                                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
                                >
                                  <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                  <span className="flex-1">
                                    <span className="font-semibold text-slate-800 dark:text-white block">{g.name}</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500">Registrar huella en este dispositivo</span>
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
