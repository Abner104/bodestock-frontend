// src/pages/SuperAdminIngresos.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import {
  Plus, Trash2, CreditCard, Banknote, ArrowLeftRight,
  Building2, Check, X, Loader2, TrendingUp, ChevronDown,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';

const CLP = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const METHOD_ICONS = {
  mercadopago: CreditCard,
  efectivo:    Banknote,
  transferencia: ArrowLeftRight,
  tarjeta:     CreditCard,
};

const METHOD_LABELS = {
  mercadopago:   'Mercado Pago',
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  tarjeta:       'Tarjeta',
};

const METHOD_COLORS = {
  mercadopago:   { bg: 'bg-blue-500/[0.08]',   border: 'border-blue-500/[0.20]',   text: 'text-blue-400' },
  efectivo:      { bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-500/[0.20]', text: 'text-emerald-400' },
  transferencia: { bg: 'bg-violet-500/[0.08]',  border: 'border-violet-500/[0.20]',  text: 'text-violet-400' },
  tarjeta:       { bg: 'bg-amber-500/[0.08]',   border: 'border-amber-500/[0.20]',   text: 'text-amber-400' },
};

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export default function SuperAdminIngresos() {
  const [payments, setPayments]     = useState([]);
  const [companies, setCompanies]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));

  // Form state
  const [form, setForm] = useState({
    amount: '',
    method: 'efectivo',
    companyId: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [paymentsSnap, companiesSnap] = await Promise.all([
        getDocs(query(collection(db, 'sa_payments'), orderBy('date', 'desc'))),
        getDocs(collection(db, 'companies')),
      ]);
      setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCompanies(companiesSnap.docs.map(d => ({ id: d.id, name: d.data().name, adminEmail: d.data().adminEmail })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const savePayment = async () => {
    if (!form.amount || isNaN(Number(form.amount.replace(/\D/g, '')))) {
      setFormError('Ingresa un monto válido'); return;
    }
    setFormError('');
    try {
      setSaving(true);
      const amount = parseInt(form.amount.replace(/\D/g, ''), 10);
      const dateObj = new Date(form.date + 'T12:00:00');
      const company = companies.find(c => c.id === form.companyId);
      await addDoc(collection(db, 'sa_payments'), {
        amount,
        method: form.method,
        companyId: form.companyId || null,
        companyName: company?.name || null,
        note: form.note || null,
        date: dateObj,
        monthKey: monthKey(dateObj),
        source: 'manual',
        createdAt: serverTimestamp(),
      });
      setForm({ amount: '', method: 'efectivo', companyId: '', note: '', date: new Date().toISOString().split('T')[0] });
      setShowForm(false);
      await loadAll();
    } catch (e) {
      setFormError('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (id) => {
    try {
      setDeleting(id);
      await deleteDoc(doc(db, 'sa_payments', id));
      setPayments(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  // Calcular meses disponibles desde los pagos
  const availableMonths = [...new Set(payments.map(p => p.monthKey || monthKey(
    p.date?.toDate ? p.date.toDate() : new Date(p.date)
  )))].sort((a, b) => b.localeCompare(a));

  // Si no hay pagos, al menos el mes actual
  if (!availableMonths.includes(monthKey(new Date()))) {
    availableMonths.unshift(monthKey(new Date()));
  }

  // Pagos del mes seleccionado
  const monthPayments = payments.filter(p => {
    const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
    return monthKey(d) === selectedMonth;
  });

  const monthTotal = monthPayments.reduce((t, p) => t + (p.amount || 0), 0);
  const byMethod = monthPayments.reduce((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + (p.amount || 0);
    return acc;
  }, {});

  // Totales por mes para el gráfico de barras
  const monthTotals = availableMonths.slice(0, 6).reverse().map(mk => {
    const { year, month } = parseMonthKey(mk);
    const total = payments
      .filter(p => {
        const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
        return monthKey(d) === mk;
      })
      .reduce((t, p) => t + (p.amount || 0), 0);
    return { label: MONTHS[month].slice(0, 3), mk, total };
  });
  const maxTotal = Math.max(...monthTotals.map(m => m.total), 1);

  const displayMonth = () => {
    const { year, month } = parseMonthKey(selectedMonth);
    return `${MONTHS[month]} ${year}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Caja de ingresos</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Registro de todos los pagos recibidos</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-1.5">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancelar' : 'Registrar pago'}
        </Button>
      </div>

      {/* Formulario nuevo pago */}
      {showForm && (
        <Card className="p-5">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">Nuevo pago</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Monto */}
            <div>
              <label className="text-[11px] text-zinc-600 mb-1 block">Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[13px]">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors tabular-nums"
                />
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="text-[11px] text-zinc-600 mb-1 block">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors"
              />
            </div>

            {/* Método */}
            <div>
              <label className="text-[11px] text-zinc-600 mb-1 block">Método de pago</label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.keys(METHOD_LABELS).map(m => {
                  const Icon = METHOD_ICONS[m];
                  const active = form.method === m;
                  const col = METHOD_COLORS[m];
                  return (
                    <button
                      key={m}
                      onClick={() => setForm(f => ({ ...f, method: m }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] transition-all cursor-pointer ${
                        active
                          ? `${col.bg} ${col.border} ${col.text} font-medium`
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {METHOD_LABELS[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Empresa */}
            <div>
              <label className="text-[11px] text-zinc-600 mb-1 block">Empresa (opcional)</label>
              <div className="relative">
                <select
                  value={form.companyId}
                  onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors"
                >
                  <option value="">Sin empresa específica</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            {/* Nota */}
            <div className="sm:col-span-2">
              <label className="text-[11px] text-zinc-600 mb-1 block">Nota (opcional)</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Ej: Pago mensualidad enero, abono, etc."
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors placeholder:text-zinc-700"
              />
            </div>
          </div>

          {formError && (
            <p className="text-[12px] text-red-400 mt-3">{formError}</p>
          )}

          <div className="flex items-center gap-2 mt-4">
            <Button onClick={savePayment} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Guardando...' : 'Guardar pago'}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setFormError(''); }}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Historial por barras */}
      {monthTotals.some(m => m.total > 0) && (
        <Card className="p-5">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">Últimos 6 meses</p>
          <div className="flex items-end gap-2 h-20">
            {monthTotals.map(m => {
              const pct = Math.round((m.total / maxTotal) * 100);
              const isSelected = m.mk === selectedMonth;
              return (
                <button
                  key={m.mk}
                  onClick={() => setSelectedMonth(m.mk)}
                  className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                >
                  <span className={`text-[10px] tabular-nums transition-colors ${isSelected ? 'text-violet-400' : 'text-zinc-700 group-hover:text-zinc-500'}`}>
                    {m.total > 0 ? CLP(m.total).replace('$', '$') : ''}
                  </span>
                  <div className="w-full flex items-end" style={{ height: 48 }}>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${isSelected ? 'bg-violet-500' : 'bg-white/[0.06] group-hover:bg-white/[0.10]'}`}
                      style={{ height: `${Math.max(pct, m.total > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] transition-colors ${isSelected ? 'text-violet-400 font-semibold' : 'text-zinc-700'}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mes seleccionado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-zinc-600" />
          <p className="text-[13px] font-semibold text-white">{displayMonth()}</p>
          {monthTotal > 0 && (
            <span className="text-[13px] font-bold text-emerald-400 tabular-nums">{CLP(monthTotal)}</span>
          )}
        </div>
        {/* Selector de mes */}
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-400 text-[12px] focus:outline-none cursor-pointer"
          >
            {availableMonths.map(mk => {
              const { year, month } = parseMonthKey(mk);
              return <option key={mk} value={mk}>{MONTHS[month]} {year}</option>;
            })}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
        </div>
      </div>

      {/* Resumen por método */}
      {Object.keys(byMethod).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(byMethod).map(([method, total]) => {
            const Icon = METHOD_ICONS[method] || CreditCard;
            const col = METHOD_COLORS[method] || METHOD_COLORS.tarjeta;
            return (
              <div key={method} className={`rounded-xl border p-3 ${col.bg} ${col.border}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3 h-3 ${col.text}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${col.text}`}>
                    {METHOD_LABELS[method]}
                  </span>
                </div>
                <p className="text-[15px] font-bold text-white tabular-nums">{CLP(total)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de pagos */}
      <Card>
        <CardHeader>
          <CardTitle>
            {monthPayments.length > 0
              ? `${monthPayments.length} pago${monthPayments.length > 1 ? 's' : ''}`
              : 'Sin pagos este mes'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : monthPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-600 text-[13px]">No hay pagos registrados para este mes.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 text-[12px] text-violet-400 hover:text-violet-300 transition-colors cursor-pointer bg-transparent border-none"
              >
                + Registrar el primero
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {monthPayments.map(p => {
                const Icon = METHOD_ICONS[p.method] || CreditCard;
                const col = METHOD_COLORS[p.method] || METHOD_COLORS.tarjeta;
                const date = p.date?.toDate ? p.date.toDate() : new Date(p.date);
                const isAutoMP = p.source === 'mercadopago';
                return (
                  <div key={p.id} className="flex items-center gap-3 py-3 group">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${col.bg} ${col.border}`}>
                      <Icon className={`w-3.5 h-3.5 ${col.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-medium text-white">
                          {p.companyName || METHOD_LABELS[p.method]}
                        </p>
                        {isAutoMP && (
                          <Badge variant="default" className="text-[9px]">MP auto</Badge>
                        )}
                        {p.source === 'manual' && (
                          <Badge variant="muted" className="text-[9px]">manual</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        {date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <p className="text-[14px] font-bold text-white tabular-nums shrink-0">{CLP(p.amount)}</p>
                    <button
                      onClick={() => deletePayment(p.id)}
                      disabled={deleting === p.id}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/[0.08] transition-all shrink-0"
                    >
                      {deleting === p.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
