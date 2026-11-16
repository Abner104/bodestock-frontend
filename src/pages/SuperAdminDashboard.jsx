// src/pages/SuperAdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CountUp from 'react-countup';
import {
  Building2, Users, TrendingUp, TrendingDown,
  RefreshCw, AlertCircle, Eye, EyeOff,
  ArrowUpRight, ArrowRight, Pencil, Check, X,
  DollarSign, Activity, ShoppingCart, Zap,
  Clock, ChevronRight, BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  Tooltip, XAxis, CartesianGrid, Cell,
} from 'recharts';
import { auth, db } from '../firebase/firebase';
import { collection, getDocs, doc, getDoc, setDoc, orderBy, query, limit, onSnapshot, where, updateDoc } from 'firebase/firestore';
import GlobalLoading from '../components/GlobalLoading';
import { SUPER_ADMIN_EMAIL } from '../config/env.js';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';
import { motion, AnimatePresence } from 'framer-motion';

const CLP = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const PLAN_COLOR = {
  trial: '#0ea5e9', basico: '#3b82f6',
  profesional: '#8b5cf6', personalizado: '#d946ef', free: '#52525b',
};
const PLAN_LABEL = {
  trial: 'Trial', basico: 'Básico', profesional: 'Pro',
  personalizado: 'Custom', free: 'Free',
};
const STATUS_VARIANT = {
  active: 'active', trial: 'trial', suspended: 'suspended',
  cancelled: 'danger', billing_expired: 'danger', trial_expired: 'danger',
};

// ── Métrica card ──────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, trend, color = 'default', loading, onClick }) {
  const colors = {
    default:  { ring: 'ring-white/[0.08]', icon: 'bg-white/[0.06] text-zinc-400' },
    blue:     { ring: 'ring-blue-500/[0.20]', icon: 'bg-blue-500/[0.12] text-blue-400' },
    emerald:  { ring: 'ring-emerald-500/[0.20]', icon: 'bg-emerald-500/[0.12] text-emerald-400' },
    violet:   { ring: 'ring-violet-500/[0.20]', icon: 'bg-violet-500/[0.12] text-violet-400' },
    amber:    { ring: 'ring-amber-500/[0.20]', icon: 'bg-amber-500/[0.12] text-amber-400' },
  };
  const c = colors[color] || colors.default;

  return (
    <motion.div
      whileHover={onClick ? { y: -2 } : {}}
      onClick={onClick}
      className={`relative rounded-2xl bg-[#111118] ring-1 ${c.ring} p-5 ${onClick ? 'cursor-pointer' : ''} overflow-hidden`}
    >
      {/* Glow top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl ${c.icon} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend !== undefined && !loading && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${
            trend >= 0 ? 'bg-emerald-500/[0.10] text-emerald-400' : 'bg-red-500/[0.10] text-red-400'
          }`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-24 bg-white/[0.05] rounded-lg animate-pulse" />
          <div className="h-3 w-16 bg-white/[0.03] rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-[28px] font-bold text-white tracking-tight tabular-nums leading-none mb-1">
            {value}
          </p>
          <p className="text-[12px] text-zinc-500">{sub || label}</p>
        </>
      )}

      {onClick && (
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        </div>
      )}
    </motion.div>
  );
}

// ── Tooltip personalizado para recharts ───────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a24] border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[11px] text-zinc-500 mb-1">{label}</p>
      <p className="text-[13px] font-bold text-white tabular-nums">{CLP(payload[0]?.value)}</p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mrrVisible, setMrrVisible] = useState(false);
  const [editingMrr, setEditingMrr] = useState(false);
  const [mrrInput, setMrrInput] = useState('');
  const [savingMrr, setSavingMrr] = useState(false);
  const [mrrHistory, setMrrHistory] = useState({});
  const [paymentToasts, setPaymentToasts] = useState([]);

  // Listener en tiempo real para notificaciones de pagos MercadoPago
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== SUPER_ADMIN_EMAIL) return;

    const q = query(
      collection(db, 'sa_notifications'),
      where('read', '==', false),
      where('type', '==', 'payment'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const notif = { id: change.doc.id, ...change.doc.data() };
          // Mostrar toast
          setPaymentToasts(prev => [...prev, notif]);
          // Reproducir sonido
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(520, ctx.currentTime);
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
          } catch {}
          // Marcar como leída en Firestore después de 8s
          setTimeout(() => {
            updateDoc(doc(db, 'sa_notifications', notif.id), { read: true }).catch(() => {});
          }, 8000);
          // Quitar toast visual después de 8s
          setTimeout(() => {
            setPaymentToasts(prev => prev.filter(t => t.id !== notif.id));
          }, 8000);
        }
      });
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== SUPER_ADMIN_EMAIL) { window.location.href = '/login'; return; }
    loadAll();
  }, []);

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [companiesSnap, mrrDoc] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDoc(doc(db, 'sa_config', 'mrr_history')).catch(() => null),
      ]);

      const list = companiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Cargar usuarios
      let totalUsers = 0;
      await Promise.all(list.map(async (c) => {
        try {
          const snap = await getDocs(collection(db, `companies/${c.id}/users`));
          totalUsers += snap.size;
        } catch {}
      }));

      // Actividad reciente — últimas salidas de todas las empresas
      const activityItems = [];
      await Promise.all(list.slice(0, 8).map(async (c) => {
        try {
          const exitsSnap = await getDocs(
            query(collection(db, `companies/${c.id}/inventory_exits`), orderBy('createdAt', 'desc'), limit(3))
          );
          exitsSnap.docs.forEach(d => {
            const data = d.data();
            activityItems.push({
              id: d.id,
              company: c.name,
              type: data.reason || 'SALE',
              amount: data.totalValue || 0,
              worker: data.workerName || '—',
              createdAt: data.createdAt?.toDate?.() || new Date(),
            });
          });
        } catch {}
      }));

      activityItems.sort((a, b) => b.createdAt - a.createdAt);
      setRecentActivity(activityItems.slice(0, 8));
      setStats({ totalCompanies: list.length, totalUsers });
      setCompanies(list);

      if (mrrDoc?.exists?.()) setMrrHistory(mrrDoc.data());
    } catch (e) {
      console.error('Error cargando dashboard:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveMrr = async () => {
    const val = parseInt(mrrInput.replace(/\D/g, ''), 10) || 0;
    const key = monthKey();
    try {
      setSavingMrr(true);
      const updated = { ...mrrHistory, [key]: val };
      await setDoc(doc(db, 'sa_config', 'mrr_history'), updated, { merge: true });
      setMrrHistory(updated);
      setEditingMrr(false);
    } finally { setSavingMrr(false); }
  };

  const toggleMrr = useCallback(async () => {
    if (mrrVisible) { setMrrVisible(false); return; }
    try {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);
          await navigator.credentials.get({ publicKey: { challenge, timeout: 30000, userVerification: 'required', rpId: window.location.hostname } });
          setMrrVisible(true); return;
        }
      }
    } catch (e) { if (e.name === 'NotAllowedError') return; }
    const pin = prompt('PIN:');
    if (pin === '1234') setMrrVisible(true);
  }, [mrrVisible]);

  if (loading) return <GlobalLoading />;

  const now = new Date();
  const cm = now.getMonth();
  const currentMk = monthKey(now);
  const manualMRR = mrrHistory[currentMk] || 0;

  const activeCompanies = companies.filter(c => c.status === 'active').length;
  const trialCompanies = companies.filter(c => c.status === 'trial').length;
  const payingCompanies = companies.filter(c => c.status === 'active' && !['free','trial'].includes(c.plan)).length;
  const atRisk = companies.filter(c => {
    if (['billing_expired','trial_expired','suspended','cancelled'].includes(c.status)) return true;
    if (c.nextBillingDate) {
      const bd = c.nextBillingDate?.toDate ? c.nextBillingDate.toDate() : new Date(c.nextBillingDate);
      const days = Math.ceil((bd - now) / (1000*60*60*24));
      if (days <= 3 && days >= 0) return true;
    }
    return false;
  });

  // MRR histórico 6 meses
  const mrrChart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), cm - (5 - i), 1);
    const k = monthKey(d);
    return { mes: MONTHS[d.getMonth()], value: mrrHistory[k] || 0, isCurrentMonth: k === currentMk };
  });

  // Distribución por plan
  const planDist = Object.entries(
    companies.reduce((acc, c) => {
      const p = c.plan || 'free';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  // Cobros próximos 7 días
  const en7 = new Date(); en7.setDate(now.getDate() + 7);
  const cobros = companies
    .filter(c => c.nextBillingDate && c.status === 'active' && c.monthlyAmount > 0)
    .map(c => {
      const bd = c.nextBillingDate?.toDate ? c.nextBillingDate.toDate() : new Date(c.nextBillingDate);
      return { ...c, billingDate: bd };
    })
    .filter(c => c.billingDate >= now && c.billingDate <= en7)
    .sort((a, b) => a.billingDate - b.billingDate);

  // MRR trend vs mes anterior
  const prevMk = monthKey(new Date(now.getFullYear(), cm - 1, 1));
  const prevMRR = mrrHistory[prevMk] || 0;
  const mrrTrend = prevMRR > 0 ? ((manualMRR - prevMRR) / prevMRR) * 100 : null;

  const ACTIVITY_LABELS = { SALE: 'Venta', CREDIT: 'Fiado', WASTE: 'Merma', TRANSFER: 'Traslado' };
  const ACTIVITY_COLORS = { SALE: 'text-emerald-400', CREDIT: 'text-amber-400', WASTE: 'text-red-400', TRANSFER: 'text-blue-400' };

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Toasts de pagos MercadoPago ── */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {paymentToasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="pointer-events-auto flex items-start gap-3 bg-emerald-950 border border-emerald-500/40 rounded-2xl px-4 py-3.5 shadow-2xl shadow-emerald-900/40 max-w-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 text-xl">
                💰
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-300">{t.title}</p>
                <p className="text-xs text-emerald-400/80 mt-0.5 leading-relaxed">{t.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Panel de control</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5 capitalize">
            {now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadAll(true)} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* ── Fila 1: Métricas principales ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* MRR — card especial, ancho completo en mobile, 2 cols en desktop */}
        <div className="col-span-2 sm:col-span-2 relative rounded-2xl bg-gradient-to-br from-violet-600/[0.15] to-[#111118] ring-1 ring-violet-500/[0.20] p-5 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/[0.30] to-transparent" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-violet-500/[0.06] rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between mb-3 relative">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-violet-500/[0.15] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Ingresos {MONTHS[cm]}
                </p>
                {mrrTrend !== null && (
                  <span className={`text-[10px] font-semibold ${mrrTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {mrrTrend >= 0 ? '↑' : '↓'} {Math.abs(mrrTrend).toFixed(1)}% vs mes anterior
                  </span>
                )}
              </div>
            </div>
            <Badge variant="success" dot>{payingCompanies} pagando</Badge>
          </div>

          {/* Valor MRR */}
          <div className="flex items-end gap-3 mb-1 relative">
            {editingMrr ? (
              <div className="flex items-center gap-2">
                <span className="text-[28px] font-bold text-zinc-500">$</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={mrrInput}
                  onChange={e => setMrrInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') saveMrr(); if (e.key === 'Escape') setEditingMrr(false); }}
                  placeholder="0"
                  className="bg-transparent border-b-2 border-violet-500/60 text-white text-[28px] font-bold leading-none w-36 focus:outline-none tabular-nums"
                />
                <button onClick={saveMrr} disabled={savingMrr} className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingMrr(false)} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-500 hover:text-zinc-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                {mrrVisible ? (
                  <p className="text-[32px] font-bold text-white leading-none tracking-tight tabular-nums">
                    {manualMRR > 0 ? <CountUp end={manualMRR} duration={1.2} separator="." prefix="$" /> : '$0'}
                  </p>
                ) : (
                  <p className="text-[32px] font-bold text-zinc-700 leading-none select-none tracking-[0.08em]">$•••••</p>
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <button onClick={toggleMrr} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    {mrrVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setMrrInput(manualMRR > 0 ? String(manualMRR) : ''); setEditingMrr(true); }} className="text-zinc-700 hover:text-violet-400 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sparkline */}
          <ResponsiveContainer width="100%" height={52}>
            <AreaChart data={mrrChart} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id="mrrG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#mrrG)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <MetricCard label="Empresas activas" value={<CountUp end={activeCompanies} duration={1} />}
          sub={`${trialCompanies} en trial`} icon={Building2} color="blue" loading={loading}
          onClick={() => navigate('/super-admin/empresas')} />

        <MetricCard label="Usuarios" value={<CountUp end={stats?.totalUsers || 0} duration={1} />}
          sub="en todas las empresas" icon={Users} color="emerald" loading={loading} />
      </div>

      {/* ── Fila 2: Alertas de riesgo + Cobros ── */}
      {(atRisk.length > 0 || cobros.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Empresas en riesgo */}
          {atRisk.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <CardTitle className="text-red-400/80">Requieren atención</CardTitle>
                  <span className="ml-auto text-[11px] font-bold text-red-400 bg-red-500/[0.10] px-2 py-0.5 rounded-full">
                    {atRisk.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-white/[0.04]">
                  {atRisk.slice(0, 4).map(c => {
                    const isExpired = ['billing_expired','trial_expired','suspended','cancelled'].includes(c.status);
                    const bd = c.nextBillingDate?.toDate ? c.nextBillingDate.toDate() : null;
                    const daysLeft = bd ? Math.ceil((bd - now) / (1000*60*60*24)) : null;
                    return (
                      <div key={c.id} onClick={() => navigate(`/super-admin/empresa/${c.id}`)}
                        className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-white/[0.02] -mx-5 px-5 transition-colors">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isExpired ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white truncate">{c.name}</p>
                          <p className="text-[11px] text-zinc-600">
                            {isExpired ? c.status.replace('_', ' ') : `Vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        {c.monthlyAmount > 0 && (
                          <p className="text-[12px] font-semibold text-zinc-400 tabular-nums shrink-0">{CLP(c.monthlyAmount)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cobros próximos */}
          {cobros.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <CardTitle className="text-amber-400/80">Cobros esta semana</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-white/[0.04]">
                  {cobros.map(c => {
                    const days = Math.ceil((c.billingDate - now) / (1000*60*60*24));
                    return (
                      <div key={c.id} onClick={() => navigate(`/super-admin/empresa/${c.id}`)}
                        className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-white/[0.02] -mx-5 px-5 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15] flex items-center justify-center text-[12px] font-bold text-amber-500 shrink-0">
                          {days === 0 ? 'Hoy' : days === 1 ? '1d' : `${days}d`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white truncate">{c.name}</p>
                          <p className="text-[11px] text-zinc-600">
                            {c.billingDate.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <p className="text-[13px] font-bold text-white tabular-nums shrink-0">{CLP(c.monthlyAmount)}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Fila 3: Ingresos 6 meses + Actividad reciente ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Ingresos 6 meses — ocupa 2/3 en desktop, full en mobile */}
        <Card className="xl:col-span-2 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[13px] font-semibold text-white">Ingresos mensuales</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Últimos 6 meses · click en la barra para editar</p>
            </div>
            <BarChart3 className="w-4 h-4 text-zinc-700" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={mrrChart} margin={{ top: 4, bottom: 0, left: 0, right: 0 }} barSize={28}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mes" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 6 }} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {mrrChart.map((entry, i) => (
                  <Cell key={i} fill={entry.isCurrentMonth ? '#8b5cf6' : 'rgba(255,255,255,0.07)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Distribución por plan debajo */}
          <div className="mt-5 pt-4 border-t border-white/[0.05]">
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest mb-3">Distribución por plan</p>
            <div className="flex gap-2 flex-wrap">
              {planDist.map(([plan, count]) => (
                <div key={plan} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PLAN_COLOR[plan] || '#52525b' }} />
                  <span className="text-[11px] text-zinc-400">{PLAN_LABEL[plan] || plan}</span>
                  <span className="text-[11px] font-bold text-white ml-1">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Actividad reciente — ocupa 1/3 */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-zinc-500" />
              <CardTitle>Actividad reciente</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 px-5">
                <Zap className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                <p className="text-[12px] text-zinc-600">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recentActivity.map((item, i) => {
                  const mins = Math.floor((now - item.createdAt) / 60000);
                  const hours = Math.floor(mins / 60);
                  const timeLabel = mins < 1 ? 'ahora' : mins < 60 ? `${mins}m` : hours < 24 ? `${hours}h` : item.createdAt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
                  return (
                    <div key={`${item.id}-${i}`} className="flex items-start gap-3 px-5 py-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ACTIVITY_COLORS[item.type] || 'text-zinc-500'}`}
                        style={{ background: 'currentColor' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-white truncate">{item.company}</p>
                        <p className="text-[11px] text-zinc-600 truncate">
                          {ACTIVITY_LABELS[item.type] || item.type}
                          {item.amount > 0 && ` · ${CLP(item.amount)}`}
                        </p>
                      </div>
                      <span className="text-[10px] text-zinc-700 shrink-0 mt-0.5">{timeLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fila 4: Empresas recientes ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-zinc-500" />
              <CardTitle>Empresas</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/empresas')} className="gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-white/[0.04]">
            {[...companies]
              .sort((a, b) => {
                const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return db2 - da;
              })
              .slice(0, 8)
              .map(c => {
                const planKey = c.plan || 'free';
                const color = PLAN_COLOR[planKey] || '#52525b';
                return (
                  <div key={c.id} onClick={() => navigate(`/super-admin/empresa/${c.id}`)}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-white/[0.02] -mx-5 px-5 transition-colors group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0"
                      style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
                      {(c.name || 'E').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate group-hover:text-zinc-200">
                        {c.name || 'Sin nombre'}
                      </p>
                      <p className="text-[11px] text-zinc-600 truncate">{c.adminEmail || c.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={STATUS_VARIANT[c.status] || 'muted'} dot>{c.status}</Badge>
                      <Badge variant="muted">{PLAN_LABEL[planKey] || planKey}</Badge>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
