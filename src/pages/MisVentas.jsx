// src/pages/MisVentas.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { auth } from '../firebase/firebase.js';
import { getUserCompanyId } from '../services/companyService.js';
import { getWorkerByEmail } from '../services/workers-service.js';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, ShoppingCart, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

export default function MisVentas() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [exits, setExits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const workerData = await getWorkerByEmail(user.email);
        setWorker(workerData);

        const companyId = await getUserCompanyId();
        if (!companyId) return;

        const q = query(
          collection(db, `companies/${companyId}/inventory_exits`),
          orderBy('createdAt', 'desc'),
          limit(500)
        );

        const unsub = onSnapshot(q, (snap) => {
          const all = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate() || new Date()
          }));
          // Solo mis ventas
          const mine = all.filter(e =>
            e.status !== 'cancelled' &&
            e.reason === 'SALE' &&
            (e.workerId === user.email ||
             e.workerId === workerData?.id ||
             e.workerName === workerData?.name)
          );
          setExits(mine);
        });

        setLoading(false);
        return unsub;
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    let unsub;
    init().then(u => { unsub = u; });
    return () => { if (unsub) unsub(); };
  }, []);

  // Filtrar por fecha
  const filtered = exits.filter(e => {
    if (dateFrom && e.createdAt < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      if (e.createdAt > to) return false;
    }
    return true;
  });

  const totalVentas = filtered.reduce((s, e) => s + (e.totalValue || 0), 0);
  const totalSinIva = totalVentas / 1.19;
  const pct = worker?.commissionPercent ?? null;
  const comision = pct != null ? (totalSinIva * pct) / 100 : null;

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-xl border-b border-white/20 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/dashboard-trabajador')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Mis Ventas</h1>
            <p className="text-xs text-blue-300">{worker?.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Filtro de fechas */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
          <p className="text-xs text-blue-300 font-semibold mb-3 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Filtrar por período
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="mt-2 text-xs text-blue-400 hover:text-blue-300">
              Limpiar filtro
            </button>
          )}
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <p className="text-xs text-blue-300 mb-1">Total ventas</p>
            <p className="text-xl font-bold text-white">{filtered.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <p className="text-xs text-blue-300 mb-1">Monto total</p>
            <p className="text-xl font-bold text-emerald-400">{CLP(totalVentas)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <p className="text-xs text-blue-300 mb-1">Sin IVA (÷1.19)</p>
            <p className="text-xl font-bold text-white">{CLP(Math.round(totalSinIva))}</p>
          </div>
          <div className={`backdrop-blur-xl rounded-2xl p-4 border ${comision != null ? 'bg-purple-500/20 border-purple-400/30' : 'bg-white/10 border-white/10'}`}>
            <p className="text-xs text-purple-300 mb-1">
              {pct != null ? `Mi comisión (${pct}%)` : 'Mi comisión'}
            </p>
            <p className={`text-xl font-bold ${comision != null ? 'text-purple-300' : 'text-white/30'}`}>
              {comision != null ? CLP(Math.round(comision)) : 'No configurada'}
            </p>
          </div>
        </div>

        {/* Lista de ventas */}
        <div className="space-y-2">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider px-1">
            Detalle de ventas ({filtered.length})
          </p>

          {filtered.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-8 text-center">
              <ShoppingCart className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No hay ventas en este período</p>
            </div>
          ) : (
            filtered.map((exit, i) => (
              <motion.div
                key={exit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setExpandedId(expandedId === exit.id ? null : exit.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {exit.products?.length || 0} producto{exit.products?.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-white/40">
                        {exit.createdAt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {' · '}
                        {exit.createdAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-emerald-400">{CLP(exit.totalValue || 0)}</p>
                    {expandedId === exit.id
                      ? <ChevronUp className="w-4 h-4 text-white/40" />
                      : <ChevronDown className="w-4 h-4 text-white/40" />
                    }
                  </div>
                </button>

                {expandedId === exit.id && exit.products?.length > 0 && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-2 space-y-1.5">
                    {exit.products.map((p, pi) => (
                      <div key={pi} className="flex items-center justify-between text-xs">
                        <span className="text-white/70">{p.productName} × {p.quantity}</span>
                        <span className="text-white/50">{CLP(p.totalValue || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
