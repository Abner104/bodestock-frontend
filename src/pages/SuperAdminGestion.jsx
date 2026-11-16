// src/pages/SuperAdminGestion.jsx
// Control de Gestión Empresarial — Dashboard SA
import { useState, useEffect, useMemo } from 'react';
import { API_URL } from '../config/env';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/firebase';
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc,
  query, orderBy, limit, where, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import {
  TrendingUp, TrendingDown, Package, Users, AlertTriangle,
  DollarSign, ShoppingCart, ArrowLeft, RefreshCw, ChevronRight,
  Flame, Minus, BarChart2, Save, Send, Eye, FileText,
  CheckCircle, XCircle, Clock, Loader2, Edit3, Plus, Trash2,
  Award, Zap, History, ChevronDown, ChevronUp, UserCircle, Search, Upload, Megaphone, Copy, Sparkles, Download
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import TabMarketing from '../components/marketing/TabMarketing';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { GASTO_TIPOS } from '../config/gasto-tipos';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);
const PCT = (n) => `${(n || 0).toFixed(1)}%`;
// Formatea mientras escribe: "1000000" → "1.000.000" y lo guarda sin puntos
const fmtInput = (v) => {
  const raw = String(v).replace(/\D/g, '');
  return raw ? Number(raw).toLocaleString('es-CL') : '';
};
const parseInput = (v) => parseInt(String(v).replace(/\D/g, '') || '0', 10);

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function KPICard({ title, value, sub, icon: Icon, trend, color = 'zinc', loading }) {
  const colors = {
    zinc:    { bg: 'bg-white/[0.04]', icon: 'text-zinc-400', border: 'border-white/[0.08]' },
    blue:    { bg: 'bg-blue-500/[0.08]', icon: 'text-blue-400', border: 'border-blue-500/[0.15]' },
    emerald: { bg: 'bg-emerald-500/[0.08]', icon: 'text-emerald-400', border: 'border-emerald-500/[0.15]' },
    violet:  { bg: 'bg-violet-500/[0.08]', icon: 'text-violet-400', border: 'border-violet-500/[0.15]' },
    amber:   { bg: 'bg-amber-500/[0.08]', icon: 'text-amber-400', border: 'border-amber-500/[0.15]' },
    red:     { bg: 'bg-red-500/[0.08]', icon: 'text-red-400', border: 'border-red-500/[0.15]' },
  };
  const c = colors[color] || colors.zinc;
  return (
    <Card className={`p-5 border ${c.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        {trend !== undefined && !loading && (
          <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-white/[0.05] rounded-lg animate-pulse mb-1" />
      ) : (
        <p className="text-[26px] font-bold text-white leading-none mb-1 tracking-tight tabular-nums">{value}</p>
      )}
      <p className="text-[11px] text-zinc-500">{sub || title}</p>
    </Card>
  );
}

function AlertChip({ type, message }) {
  const styles = {
    critical: 'bg-red-500/[0.10] border-red-500/[0.25] text-red-400',
    warning:  'bg-amber-500/[0.10] border-amber-500/[0.25] text-amber-400',
    info:     'bg-blue-500/[0.10] border-blue-500/[0.25] text-blue-400',
  };
  const icons = { critical: '🔴', warning: '🟡', info: '🔵' };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium ${styles[type]}`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Plan de acción: Stock parado ─────────────────────
function StockParadoPanel({ productos, valorTotal, stockPlan, setStockPlan, stockSearch, setStockSearch, onGenerarRecs, addingRecs, onAnalizar, analizando, analisisIA, onExportarPDF, onExportarExcel }) {
  const ESTRATEGIAS = [
    { id: 'liquidar',  label: 'Liquidar',  color: 'text-red-400',     bg: 'bg-red-500/[0.08] border-red-500/[0.20]',     icon: '🔻' },
    { id: 'combo',     label: 'Combo',     color: 'text-orange-400',  bg: 'bg-orange-500/[0.08] border-orange-500/[0.20]', icon: '🎁' },
    { id: 'promover',  label: 'Promover',  color: 'text-emerald-400', bg: 'bg-emerald-500/[0.08] border-emerald-500/[0.20]', icon: '🎯' },
    { id: 'devolver',  label: 'Devolver',  color: 'text-blue-400',    bg: 'bg-blue-500/[0.08] border-blue-500/[0.20]',   icon: '↩️' },
  ];

  const filtered = productos.filter(p =>
    !stockSearch || p.name?.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const conPlan = productos.filter(p => stockPlan[p.id]?.estrategia);
  const recuperableTotal = conPlan.reduce((s, p) => {
    const plan = stockPlan[p.id];
    if (!plan?.estrategia) return s;
    if (plan.estrategia === 'liquidar' && plan.precioLiquidacion > 0)
      return s + (p.stock || 0) * parseFloat(plan.precioLiquidacion);
    if (plan.estrategia === 'devolver')
      return s + (p.stock || 0) * (p.ppp || 0);
    return s;
  }, 0);

  const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">💤</span>
            <p className="text-[13px] font-bold text-white">Plan de acción — Stock parado</p>
          </div>
          <div className="flex items-center gap-2">
            {onExportarPDF && (
              <button onClick={onExportarPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[12px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            )}
            {onExportarExcel && (
              <button onClick={onExportarExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[12px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            )}
            <div className="text-right">
              <p className="text-[11px] text-zinc-600">{productos.length} productos</p>
              <p className="text-[11px] font-bold text-amber-400 tabular-nums">{CLP(valorTotal)} inmovilizados</p>
            </div>
          </div>
        </div>

        {/* Resumen recuperable */}
        {conPlan.length > 0 && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/[0.20] flex items-center justify-between">
            <p className="text-[12px] text-emerald-400">
              {conPlan.length} producto{conPlan.length !== 1 ? 's' : ''} con plan asignado
            </p>
            {recuperableTotal > 0 && (
              <p className="text-[12px] font-bold text-emerald-400 tabular-nums">
                Recuperas ~{CLP(recuperableTotal)}
              </p>
            )}
          </div>
        )}

        {/* Botón analizar con IA */}
        <button
          onClick={onAnalizar}
          disabled={analizando}
          className={`w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed transition-all text-[13px] font-semibold ${
            analizando
              ? 'border-violet-500/30 bg-violet-500/[0.05] text-violet-400 cursor-not-allowed'
              : 'border-violet-500/40 bg-violet-500/[0.05] text-violet-400 hover:bg-violet-500/[0.10] hover:border-violet-500/60 cursor-pointer'
          }`}
        >
          {analizando
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando estrategia comercial...</>
            : <><span className="text-base">✨</span> Estrategia IA — combos, promociones y liquidación</>
          }
        </button>

        {/* Resultados del análisis IA */}
        {analisisIA && (
          <div className="mt-3 p-3 rounded-xl bg-violet-500/[0.06] border border-violet-500/[0.15]">
            <p className="text-[11px] font-bold text-violet-400 uppercase tracking-widest mb-2">✨ Estrategia comercial IA</p>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {analisisIA.map((item, i) => {
                const estrategiaColor = {
                  LIQUIDAR: 'text-red-400 bg-red-500/10 border-red-500/20',
                  COMBO: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                  PROMOVER: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  DEVOLVER: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                }[item.estrategia] || 'text-zinc-400 bg-white/5 border-white/10';
                const estrategiaIcon = { LIQUIDAR: '🔻', COMBO: '🎁', PROMOVER: '🎯', DEVOLVER: '↩️' }[item.estrategia] || '•';
                return (
                  <div key={i} className="border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-bold text-white">{item.nombre}</span>
                      {item.estrategia && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${estrategiaColor}`}>
                          {estrategiaIcon} {item.estrategia}
                        </span>
                      )}
                      {item.precioSugerido > 0 && (
                        <span className="text-[11px] font-bold text-emerald-400 tabular-nums ml-auto shrink-0">→ {CLP(item.precioSugerido)}</span>
                      )}
                    </div>
                    {item.accionEstaaSemana && (
                      <p className="text-[11px] font-semibold text-amber-400 mb-1">⚡ {item.accionEstaaSemana}</p>
                    )}
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{item.recomendacion}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buscador */}
        <div className="relative mt-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={stockSearch}
            onChange={e => setStockSearch(e.target.value)}
            placeholder={`Buscar entre ${productos.length} productos...`}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors"
          />
        </div>
      </div>

      {/* Lista completa */}
      <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto">
        {filtered.map((p) => {
          const plan = stockPlan[p.id] || {};
          const valor = (p.stock || 0) * (p.ppp || 0);
          const estrategia = ESTRATEGIAS.find(e => e.id === plan.estrategia);

          return (
            <div key={p.id} className={`px-4 py-3 transition-colors ${plan.estrategia ? 'bg-white/[0.01]' : ''}`}>
              {/* Fila principal */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-zinc-500">{p.stock} un</span>
                    {p.ppp > 0 && <>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[11px] text-zinc-500">costo {CLP(p.ppp)}</span>
                    </>}
                    {valor > 0 && (
                      <span className="text-[11px] font-semibold text-amber-500/80 tabular-nums">{CLP(valor)}</span>
                    )}
                  </div>
                </div>

                {/* Selector de estrategia */}
                <div className="flex gap-1 shrink-0">
                  {ESTRATEGIAS.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setStockPlan(prev => ({
                        ...prev,
                        [p.id]: plan.estrategia === e.id
                          ? {} // deseleccionar
                          : { estrategia: e.id, precioLiquidacion: '' }
                      }))}
                      title={e.label}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all border ${
                        plan.estrategia === e.id
                          ? e.bg + ' ' + e.color
                          : 'bg-white/[0.03] border-white/[0.06] text-zinc-600 hover:border-white/[0.12]'
                      }`}
                    >
                      {e.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campo precio liquidación */}
              {plan.estrategia === 'liquidar' && (
                <div className="flex items-center gap-2 ml-0 mt-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-[12px]">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={plan.precioLiquidacion || ''}
                      onChange={e => setStockPlan(prev => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], precioLiquidacion: e.target.value.replace(/\D/g, '') }
                      }))}
                      placeholder={p.ppp > 0 ? `Costo: ${p.ppp.toLocaleString('es-CL')}` : 'Precio de liquidación'}
                      className="w-full pl-6 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-red-500/[0.20] text-white text-[12px] placeholder-zinc-600 focus:outline-none focus:border-red-500/[0.40] transition-colors tabular-nums"
                    />
                  </div>
                  {plan.precioLiquidacion > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-emerald-400 tabular-nums font-semibold">
                        Recuperas {CLP((p.stock || 0) * parseFloat(plan.precioLiquidacion))}
                      </p>
                      {p.ppp > 0 && parseFloat(plan.precioLiquidacion) < p.ppp && (
                        <p className="text-[10px] text-red-400/70">
                          Pérdida: {CLP((p.ppp - parseFloat(plan.precioLiquidacion)) * (p.stock || 0))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Campo combo */}
              {plan.estrategia === 'combo' && (
                <div className="mt-1.5 space-y-1.5">
                  <input
                    type="text"
                    value={plan.comboDescripcion || ''}
                    onChange={e => setStockPlan(prev => ({
                      ...prev,
                      [p.id]: { ...prev[p.id], comboDescripcion: e.target.value }
                    }))}
                    placeholder='Ej: "Lleva 2 y paga 1", "Combo con Coca-Cola", "Pack x3"'
                    className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-orange-500/[0.20] text-white text-[12px] placeholder-zinc-600 focus:outline-none focus:border-orange-500/[0.40] transition-colors"
                  />
                  {plan.comboDescripcion && (
                    <p className="text-[11px] text-orange-400">
                      🎁 Combo definido — se incluirá en el reporte y recomendaciones
                    </p>
                  )}
                </div>
              )}

              {/* Info devolver */}
              {plan.estrategia === 'devolver' && valor > 0 && (
                <p className="text-[11px] text-blue-400 mt-1.5 ml-0">
                  ↩ Devolución al proveedor — recuperas {CLP(valor)} en crédito
                </p>
              )}

              {/* Info promover */}
              {plan.estrategia === 'promover' && (
                <p className="text-[11px] text-emerald-400 mt-1.5 ml-0">
                  🎯 Se agregará como promoción sugerida al reporte
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer con botón generar */}
      {conPlan.length > 0 && (
        <div className="p-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
          <p className="text-[12px] text-zinc-500">
            {conPlan.length} producto{conPlan.length !== 1 ? 's' : ''} → se agregarán al reporte como recomendaciones
          </p>
          <button
            onClick={onGenerarRecs}
            disabled={addingRecs}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-bold transition-colors disabled:opacity-60 shrink-0"
          >
            {addingRecs ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Agregando...</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Agregar al reporte</>
            )}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Componente de inventario unificado ────────────────
function InventarioPanel({ stats }) {
  const [tab, setTab] = useState('sin_stock');
  const [busqueda, setBusqueda] = useState('');

  const TABS = [
    {
      id: 'sin_stock',
      label: 'Sin stock',
      count: stats.sinStock?.length || 0,
      color: 'text-red-400',
      activeBg: 'bg-red-500/[0.10] border-red-500/[0.25]',
      icon: XCircle,
    },
    {
      id: 'stock_bajo',
      label: 'Stock bajo',
      count: stats.stockCritico?.length || 0,
      color: 'text-amber-400',
      activeBg: 'bg-amber-500/[0.10] border-amber-500/[0.25]',
      icon: Flame,
    },
    {
      id: 'sin_rotacion',
      label: 'Sin rotación',
      count: stats.sinMovimiento?.length || 0,
      color: 'text-zinc-400',
      activeBg: 'bg-white/[0.06] border-white/[0.15]',
      icon: Minus,
    },
  ];

  const activeTab = TABS.find(t => t.id === tab);

  const items = (() => {
    const list = tab === 'sin_stock'
      ? (stats.sinStock || [])
      : tab === 'stock_bajo'
        ? (stats.stockCritico || [])
        : (stats.sinMovimiento || []);

    if (!busqueda.trim()) return list;
    return list.filter(p => p.name?.toLowerCase().includes(busqueda.toLowerCase()));
  })();

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">Análisis de inventario</p>
          {/* Capital inmovilizado — solo en tab sin rotación */}
          {tab === 'sin_rotacion' && stats.valorInmovilizado > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.20]">
              <span className="text-[10px] text-amber-500/70">Capital parado:</span>
              <span className="text-[12px] font-bold text-amber-400 tabular-nums">{CLP(stats.valorInmovilizado)}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setBusqueda(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? `${t.activeBg} ${t.color}`
                    : 'bg-white/[0.02] border-white/[0.06] text-zinc-600 hover:text-zinc-300 hover:border-white/[0.12]'
                }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/[0.15]' : 'bg-white/[0.05] text-zinc-600'
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder={`Buscar en ${activeTab?.label.toLowerCase()}...`}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Lista de productos */}
      <div className="divide-y divide-white/[0.04] max-h-[420px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-[13px] text-zinc-400">
              {busqueda ? `Sin resultados para "${busqueda}"` : `Sin productos en esta categoría`}
            </p>
          </div>
        ) : (
          items.map((p, i) => {
            const valorItem = (p.stock ?? 0) * (p.ppp || 0);
            return (
              <div
                key={p.id || i}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                {/* Índice */}
                <span className="text-[11px] text-zinc-700 w-5 shrink-0 tabular-nums text-right">{i + 1}</span>

                {/* Nombre y categoría */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{p.name}</p>
                  {p.category && (
                    <p className="text-[11px] text-zinc-600 truncate">{p.category}</p>
                  )}
                </div>

                {/* Badge según tab */}
                <div className="flex items-center gap-2 shrink-0">
                  {tab === 'sin_stock' && (
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/[0.10] border border-red-500/[0.20] px-2 py-0.5 rounded-full">
                      AGOTADO
                    </span>
                  )}
                  {tab === 'stock_bajo' && (
                    <span className={`text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full border ${
                      p.stock <= 2
                        ? 'text-red-400 bg-red-500/[0.10] border-red-500/[0.20]'
                        : 'text-amber-400 bg-amber-500/[0.10] border-amber-500/[0.20]'
                    }`}>
                      {p.stock} un
                    </span>
                  )}
                  {tab === 'sin_rotacion' && (
                    <div className="text-right">
                      <p className="text-[12px] font-semibold text-zinc-400 tabular-nums">{p.stock} un</p>
                      {valorItem > 0 && (
                        <p className="text-[10px] text-amber-500/70 tabular-nums">{CLP(valorItem)}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer con conteo */}
      {items.length > 0 && (
        <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center justify-between">
          <p className="text-[11px] text-zinc-600">
            {busqueda
              ? `${items.length} resultado${items.length !== 1 ? 's' : ''} de ${tab === 'sin_stock' ? stats.sinStock?.length : tab === 'stock_bajo' ? stats.stockCritico?.length : stats.sinMovimiento?.length} total`
              : `${items.length} producto${items.length !== 1 ? 's' : ''}`
            }
          </p>
          {tab === 'sin_rotacion' && stats.valorInmovilizado > 0 && (
            <p className="text-[11px] text-amber-500/70">
              Total inmovilizado: <span className="font-bold text-amber-400">{CLP(stats.valorInmovilizado)}</span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function SuperAdminGestion() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [exits, setExits] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | gastos | reporte | historial

  // Historial de reportes
  const [reportes, setReportes] = useState([]);
  const [loadingReportes, setLoadingReportes] = useState(false);
  const [expandedReporte, setExpandedReporte] = useState(null);

  // Plan de acción stock parado
  const [stockPlan, setStockPlan] = useState({});
  const [stockSearch, setStockSearch] = useState('');
  const [addingStockRecs, setAddingStockRecs] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [analisisIA, setAnalisisIA] = useState(null);

  // Tab clientes
  const [clienteSearch, setClienteSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null); // cliente expandido
  const [clienteExits, setClienteExits] = useState([]); // exits del cliente seleccionado
  const [loadingClienteExits, setLoadingClienteExits] = useState(false);

  // Gastos
  const [gastos, setGastos] = useState([]);
  const [nuevoGasto, setNuevoGasto] = useState({ tipo: 'arriendo', descripcion: '', monto: '', banco: '', cuotaActual: '', cuotaTotal: '' });
  const [savingGasto, setSavingGasto] = useState(false);
  const [editandoGastoId, setEditandoGastoId] = useState(null);

  // Configuración del negocio (margen, inversión, etc.)
  const [config, setConfig] = useState({ margenPromedio: '', inversionMercaderia: '', usarMargenReal: false });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Facturas subidas por el cliente o por el admin
  const [facturas, setFacturas] = useState([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [uploadingFactura, setUploadingFactura] = useState(false);
  const [editingMontoId, setEditingMontoId] = useState(null);
  const [montoTemp, setMontoTemp] = useState('');
  // Folio y RUT del proveedor -- para el libro de compras (ver
  // accountingAgent.js:getPurchaseBook), mismo patrón "click para editar"
  // que el monto: el consultor ya está mirando la foto de la factura acá.
  const [editingDocId, setEditingDocId] = useState(null); // id de la factura cuyo folio/RUT se está editando
  const [folioTemp, setFolioTemp] = useState('');
  const [rutTemp, setRutTemp] = useState('');

  // Reporte
  const [observaciones, setObservaciones] = useState('');
  const [recomendaciones, setRecomendaciones] = useState(['']);
  const [objetivos, setObjetivos] = useState(['']);
  const [tipoReporte, setTipoReporte] = useState('mensual');
  const [savingReporte, setSavingReporte] = useState(false);
  const [reporteSaved, setReporteSaved] = useState(false);
  const [generandoIA, setGenerandoIA] = useState(false);

  const now = new Date();

  // Mes seleccionado — por defecto el actual
  const [selectedMonth, setSelectedMonth] = useState(monthKey(now));

  // Generar lista de últimos 12 meses
  const availableMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { key: monthKey(d), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  });

  const mk = selectedMonth;
  const selectedDate = (() => { const [y, m] = selectedMonth.split('-'); return new Date(parseInt(y), parseInt(m) - 1, 1); })();
  const mesActual = `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  const isCurrentMonth = selectedMonth === monthKey(now);

  useEffect(() => {
    loadAll();
  }, [companyId, selectedMonth]);

  useEffect(() => {
    if (activeTab !== 'historial' || reportes.length > 0) return;
    loadReportes();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'rotacion' || rotacionExits !== null || !companyId) return;
    const cargarTodosExits = async () => {
      setLoadingRot(true);
      try {
        const snap = await getDocs(query(
          collection(db, `companies/${companyId}/inventory_exits`),
          orderBy('createdAt', 'desc')
        ));
        // Solo guardamos lo mínimo: productId, fecha, quantity
        const datos = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.status === 'cancelled') return;
          const fecha = data.createdAt?.toDate?.() || null;
          if (!fecha) return;
          (data.products || []).forEach(p => {
            const id = p.productId || p.id;
            if (!id) return;
            if (!datos[id]) datos[id] = { lastSaleDate: null, totalSales: 0, totalQty: 0 };
            datos[id].totalSales += 1;
            datos[id].totalQty += Number(p.quantity) || 1;
            if (!datos[id].lastSaleDate || fecha > datos[id].lastSaleDate) {
              datos[id].lastSaleDate = fecha;
            }
          });
        });
        setRotacionExits(datos);
      } catch (e) {
        console.error('Error cargando exits para rotación:', e);
        setRotacionExits({});
      } finally {
        setLoadingRot(false);
      }
    };
    cargarTodosExits();
  }, [activeTab, companyId]);

  const loadReportes = async () => {
    setLoadingReportes(true);
    try {
      // Los reportes están en companies/{id}/gestion/reportes/{periodo}
      // Como son docs individuales por mes, hacemos getDocs de la colección padre
      const snap = await getDocs(collection(db, `companies/${companyId}/gestion_reportes`)).catch(() => ({ docs: [] }));
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.id.localeCompare(a.id)); // orden descendente por periodo
      setReportes(lista);
    } finally {
      setLoadingReportes(false);
    }
  };

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    console.log('🏢 SuperAdminGestion loadAll — companyId:', companyId);
    try {
      // Calcular rango del mes seleccionado
      const [sy, sm] = selectedMonth.split('-').map(Number);
      const startOfSelected = new Date(sy, sm - 1, 1);
      const endOfSelected = new Date(sy, sm, 0, 23, 59, 59); // último día del mes

      // Para el dashboard necesitamos también el mes anterior (para comparar tendencia)
      const startOfPrev = new Date(sy, sm - 2, 1);

      const [compDoc, exitsSnap, gastosSnap, custSnap] = await Promise.all([
        getDoc(doc(db, 'companies', companyId)),
        // Traer exits del mes seleccionado + mes anterior para comparar
        getDocs(query(
          collection(db, `companies/${companyId}/inventory_exits`),
          orderBy('createdAt', 'desc'),
          limit(1000)
        )),
        getDocs(query(collection(db, `companies/${companyId}/gestion_gastos`), where('periodo', '==', mk))).catch(() => ({ docs: [] })),
        getDocs(collection(db, `companies/${companyId}/customers`)).catch(() => ({ docs: [] })),
      ]);

      setCompany({ id: companyId, ...compDoc.data() });
      setExits(exitsSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || new Date() })));
      setGastos(gastosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Cargar config del negocio — global (margen%, usarMargenReal) + mensual (inversionMercaderia)
      const [configDoc, configMesDoc] = await Promise.all([
        getDoc(doc(db, `companies/${companyId}/gestion_config/settings`)).catch(() => null),
        getDoc(doc(db, `companies/${companyId}/gestion_config/settings_${mk}`)).catch(() => null),
      ]);
      const globalCfg = configDoc?.exists?.() ? configDoc.data() : {};
      const mesCfg = configMesDoc?.exists?.() ? configMesDoc.data() : {};
      setConfig({ margenPromedio: '', usarMargenReal: false, ...globalCfg, inversionMercaderia: mesCfg.inversionMercaderia || '' });
      setConfigLoaded(true);

      // Cargar reporte borrador si existe
      const borrador = await getDoc(doc(db, `companies/${companyId}/gestion_reportes/${mk}`)).catch(() => null);
      if (borrador?.exists?.()) {
        const data = borrador.data();
        setObservaciones(data.observaciones || '');
        setRecomendaciones(data.recomendaciones?.length ? data.recomendaciones : ['']);
        setObjetivos(data.objetivos?.length ? data.objetivos : ['']);
        if (data.tipo) setTipoReporte(data.tipo);
      }

      // Cargar facturas del cliente
      try {
        setLoadingFacturas(true);
        const facturasSnap = await getDocs(
          query(collection(db, `companies/${companyId}/facturas_proveedores`), orderBy('creadoAt', 'desc'))
        );
        console.log('📄 Facturas encontradas:', facturasSnap.size, 'para companyId:', companyId);
        setFacturas(facturasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('❌ Error cargando facturas:', e); setFacturas([]); } finally { setLoadingFacturas(false); }

      // Cargar productos de todos los inventarios
      const allProds = [];
      try {
        const invSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
        console.log('📦 Inventarios encontrados:', invSnap.size);
        const invList = [];
        await Promise.all(invSnap.docs.map(async invDoc => {
          const invData = invDoc.data();
          invList.push({ id: invDoc.id, name: invData.name || invDoc.id });
          try {
            const prodSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`));
            console.log(`  → ${invDoc.id}: ${prodSnap.size} productos`);
            prodSnap.docs.forEach(p => allProds.push({ id: p.id, inventoryId: invDoc.id, ...p.data() }));
          } catch (e) {
            console.warn('Error cargando productos de', invDoc.id, e.message);
          }
        }));
        setInventoryList(invList);
        // Si hay más de un inventario, pre-seleccionar el primero en Rotación
        if (invList.length > 1) setRotInvFilter(invList[0].id);
      } catch (e) {
        console.warn('Error cargando inventarios:', e.message);
      }
      console.log('📊 Total productos cargados:', allProds.length);
      console.log('  Sin stock:', allProds.filter(p => p.productType !== 'INSUMO' && !p.byWeight && (p.stock ?? 0) === 0).length);
      setProducts(allProds);
    } catch (e) {
      console.error('Error cargando gestión:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── CÁLCULOS ─────────────────────────────────────────
  const stats = useMemo(() => {
    const [sy, sm] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(sy, sm - 1, 1);
    const endOfMonth = new Date(sy, sm, 0, 23, 59, 59);
    const startOfLastMonth = new Date(sy, sm - 2, 1);
    const endOfLastMonth = new Date(sy, sm - 1, 0, 23, 59, 59);

    // Inversión en mercadería del mes — suma totalPrice de ingresos de compra
    let inversionCalculada = 0;
    products.forEach(prod => {
      (prod.history || []).forEach(h => {
        // Excluir mermas y salidas
        if (h.type === 'shrinkage' || h.type === 'exit') return;
        if (h.reason === 'SALE' || h.reason === 'sale') return;
        // Solo si tiene totalPrice guardado
        if (!h.totalPrice || h.totalPrice <= 0) return;
        const fecha = h.date ? new Date(h.date) : null;
        if (!fecha || isNaN(fecha.getTime())) return;
        if (fecha < startOfMonth || fecha > endOfMonth) return;
        inversionCalculada += h.totalPrice;
      });
    });

    const sales = exits.filter(e => e.reason === 'SALE' && e.status !== 'cancelled');
    const salesThisMonth = sales.filter(e => e.createdAt >= startOfMonth && e.createdAt <= endOfMonth);
    const salesLastMonth = sales.filter(e => e.createdAt >= startOfLastMonth && e.createdAt <= endOfLastMonth);

    const totalVentas = salesThisMonth.reduce((s, e) => s + (e.totalValue || 0), 0);
    const totalVentasAnterior = salesLastMonth.reduce((s, e) => s + (e.totalValue || 0), 0);
    const trendVentas = totalVentasAnterior > 0 ? ((totalVentas - totalVentasAnterior) / totalVentasAnterior) * 100 : 0;

    // Costo de ventas — prioridad:
    // 1. Inversión manual ingresada por el consultor (más precisa para este caso)
    // 2. Margen % manual
    // 3. PPP del sistema (si está bien cargado)
    const inversionManual = parseFloat(String(config.inversionMercaderia || '').replace(/\D/g, '')) || 0;
    const margenManual = parseFloat(config.margenPromedio) || 0;

    let costoVentas = 0;
    let tienePPP = false;
    // Margen real: usando salePrice del producto (inventario) vs ppp
    // Primero construir mapa productId → salePrice desde products cargados
    const salePriceMap = {};
    products.forEach(p => { if (p.salePrice > 0) salePriceMap[p.id] = p.salePrice; });

    let ventaConPrecioReal = 0, ventaTotalConDatos = 0, itemsConSalePrice = 0, itemsTotal = 0;
    salesThisMonth.forEach(e => {
      (e.products || []).forEach(p => {
        const costo = p.ppp || p.unitCost || 0;
        if (costo > 0) tienePPP = true;
        costoVentas += costo * (p.quantity || 1);

        itemsTotal++;
        // Buscar salePrice primero en el exit, luego en el mapa de productos
        const spFromExit = p.salePrice || 0;
        const spFromProd = salePriceMap[p.productId || p.id] || 0;
        const sp = spFromExit > 0 ? spFromExit : spFromProd;
        if (sp > 0 && costo > 0) {
          itemsConSalePrice++;
          ventaConPrecioReal += (sp - costo) * (p.quantity || 1);
          ventaTotalConDatos += sp * (p.quantity || 1);
        }
      });
    });
    // También calcular cobertura desde el catálogo de productos (no solo ventas del mes)
    const prodsConSalePrice = products.filter(p => p.salePrice > 0 && p.ppp > 0).length;
    const prodsTotal = products.filter(p => p.ppp > 0).length;
    const coberturaMargenReal = prodsTotal > 0 ? (prodsConSalePrice / prodsTotal) * 100 : 0;
    const margenRealCalculado = ventaTotalConDatos > 0 ? (ventaConPrecioReal / ventaTotalConDatos) * 100 : 0;

    const usarMargenReal = config.usarMargenReal && coberturaMargenReal >= 50;

    let margenBruto = 0;
    if (usarMargenReal) {
      // Opción C: margen real producto por producto (costo real vs precio de venta real)
      margenBruto = margenRealCalculado;
      costoVentas = totalVentas * (1 - margenRealCalculado / 100);
    } else if (inversionManual > 0) {
      // Inversión real ingresada por el consultor — más precisa
      costoVentas = inversionManual;
      margenBruto = totalVentas > 0 ? ((totalVentas - inversionManual) / totalVentas) * 100 : 0;
    } else if (margenManual > 0) {
      // Margen % estimado
      margenBruto = margenManual;
      costoVentas = totalVentas * (1 - margenManual / 100);
    } else if (tienePPP && costoVentas > 0) {
      // PPP del sistema como último recurso
      margenBruto = totalVentas > 0 ? ((totalVentas - costoVentas) / totalVentas) * 100 : 0;
    }

    // Gastos del mes
    const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0);
    const resultadoOperacional = (totalVentas - costoVentas) - totalGastos;

    // Punto de equilibrio
    const margenBrutoDecimal = totalVentas > 0 ? margenBruto / 100 : 0;
    // Si el margen es < 10% el PE se dispara a valores irreales — en ese caso marcamos como "sin margen suficiente"
    const puntoEquilibrio = (margenBrutoDecimal >= 0.10 && totalGastos > 0)
      ? totalGastos / margenBrutoDecimal
      : null;
    const equilibrioSinMargen = margenBrutoDecimal < 0.10 && totalVentas > 0;

    // Top productos por venta
    const prodMap = {};
    salesThisMonth.forEach(e => {
      (e.products || []).forEach(p => {
        const key = p.productId || p.productName;
        if (!prodMap[key]) prodMap[key] = { name: p.productName || p.name || 'Sin nombre', qty: 0, total: 0 };
        prodMap[key].qty += p.quantity || 1;
        prodMap[key].total += p.totalValue || (p.salePrice || 0) * (p.quantity || 1);
      });
    });
    const topProductos = Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 8);

    // IDs vendidos en el mes seleccionado
    const vendidosIds = new Set(salesThisMonth.flatMap(e => (e.products || []).map(p => p.productId)));
    // IDs vendidos alguna vez (últimos 500 exits)
    const vendidosSiempre = new Set(sales.flatMap(e => (e.products || []).map(p => p.productId)));

    // Sin stock (agotados)
    const sinStock = products.filter(p =>
      p.productType !== 'INSUMO' && !p.byWeight && (p.stock ?? 0) === 0
    );

    // Stock crítico (1-5 unidades)
    const stockCritico = products.filter(p =>
      p.productType !== 'INSUMO' && !p.byWeight && (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5
    ).sort((a, b) => a.stock - b.stock).slice(0, 10);

    // Sin movimiento: tienen stock pero NO aparecen en ventas recientes
    const sinMovimiento = products.filter(p =>
      p.productType !== 'INSUMO' && !p.byWeight && (p.stock ?? 0) > 5 && !vendidosSiempre.has(p.id)
    ).sort((a, b) => ((b.stock ?? 0) * (b.ppp || 0)) - ((a.stock ?? 0) * (a.ppp || 0)));

    // Valor estimado inmovilizado (stock parado × costo PPP)
    const valorInmovilizado = sinMovimiento.reduce((s, p) => s + (p.stock ?? 0) * (p.ppp || 0), 0);

    // Valor total del inventario (todos los productos con stock × PPP)
    const valorTotalInventario = products
      .filter(p => p.productType !== 'INSUMO' && !p.byWeight && (p.stock ?? 0) > 0 && (p.ppp || 0) > 0)
      .reduce((s, p) => s + (p.stock ?? 0) * (p.ppp || 0), 0);
    const productosConValor = products.filter(p => p.productType !== 'INSUMO' && !p.byWeight && (p.stock ?? 0) > 0 && (p.ppp || 0) > 0).length;

    // Top clientes — solo ventas con cliente identificado (rut o nombre), nunca el vendedor
    const clientMap = {};
    salesThisMonth.forEach(e => {
      const rut = e.customerRut;
      const nombre = e.customerName;
      if (!rut && !nombre) return; // sin cliente identificado, no contar
      const key = rut || nombre;
      if (!clientMap[key]) {
        const clienteReal = rut ? customers.find(c => c.rut === rut) : null;
        clientMap[key] = { name: clienteReal?.razonSocial || nombre || rut, total: 0, count: 0 };
      }
      clientMap[key].total += e.totalValue || 0;
      clientMap[key].count++;
    });
    const topClientes = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 5);
    const topLabel = 'Top clientes';

    // Comparativa últimos 6 meses
    const comparativa6Meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(sy, sm - 1 - (5 - i), 1);
      const dEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const total = sales
        .filter(e => e.createdAt >= d && e.createdAt <= dEnd)
        .reduce((s, e) => s + (e.totalValue || 0), 0);
      const isSelected = monthKey(d) === selectedMonth;
      return { mes: MONTHS[d.getMonth()].slice(0, 3), total, isSelected };
    });

    // Ventas por día — últimos 7 días del mes seleccionado
    const refDate = endOfMonth < new Date() ? endOfMonth : new Date();
    const ventasPorDia = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(refDate);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59);
      const total = sales.filter(e => e.createdAt >= d && e.createdAt <= dEnd).reduce((s, e) => s + (e.totalValue || 0), 0);
      return { dia: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()], total };
    });

    // Alertas automáticas
    const alertas = [];
    if (sinStock.length > 0) alertas.push({ type: 'critical', message: `${sinStock.length} productos SIN STOCK — perdiendo ventas ahora mismo` });
    if (stockCritico.length > 0) alertas.push({ type: 'critical', message: `${stockCritico.length} producto${stockCritico.length > 1 ? 's' : ''} con stock crítico (≤5 unidades)` });
    if (sinMovimiento.length > 0) alertas.push({ type: 'warning', message: `${sinMovimiento.length} productos con stock parado sin rotación${valorInmovilizado > 0 ? ` — capital inmovilizado: aprox. ${CLP(valorInmovilizado)}` : ''}` });
    if (margenBruto < 15 && margenBruto > 0) alertas.push({ type: 'critical', message: `Margen bruto bajo: ${PCT(margenBruto)}` });
    else if (margenBruto < 25 && margenBruto > 0) alertas.push({ type: 'warning', message: `Margen bruto ajustado: ${PCT(margenBruto)}` });
    if (resultadoOperacional < 0 && totalGastos > 0) alertas.push({ type: 'critical', message: `Resultado operacional negativo: ${CLP(resultadoOperacional)}` });
    if (trendVentas < -20) alertas.push({ type: 'warning', message: `Ventas bajaron ${Math.abs(trendVentas).toFixed(0)}% vs mes anterior` });
    if (trendVentas > 20) alertas.push({ type: 'info', message: `Ventas subieron ${trendVentas.toFixed(0)}% vs mes anterior 🚀` });

    // Ranking completo de clientes (todos los meses, no solo el seleccionado)
    const allSales = exits.filter(e => e.reason === 'SALE' && e.status !== 'cancelled');
    const clienteMap = {};
    allSales.forEach(e => {
      const rut = e.customerRut || e.boleta?.receptor?.rut;
      const nombre = e.customerName || e.boleta?.receptor?.razonSocial;
      // Solo incluir si tiene cliente identificado (rut o nombre de cliente real)
      // No usar workerName — el vendedor no es el cliente
      if (!rut && !nombre) return;
      const key = rut || nombre;
      if (!clienteMap[key]) {
        clienteMap[key] = {
          rut: rut || null,
          nombre: nombre || rut || 'Sin nombre',
          totalHistorico: 0,
          compras: 0,
          ultimaCompra: null,
          // mes actual
          totalMes: 0,
          comprasMes: 0,
        };
      }
      clienteMap[key].totalHistorico += e.totalValue || 0;
      clienteMap[key].compras++;
      const fecha = e.createdAt instanceof Date ? e.createdAt : e.createdAt?.toDate?.() || new Date();
      if (!clienteMap[key].ultimaCompra || fecha > clienteMap[key].ultimaCompra) {
        clienteMap[key].ultimaCompra = fecha;
      }
      // Si la venta es del mes seleccionado
      if (e.createdAt >= startOfMonth && e.createdAt <= endOfMonth) {
        clienteMap[key].totalMes += e.totalValue || 0;
        clienteMap[key].comprasMes++;
      }
    });

    const rankingClientes = Object.values(clienteMap)
      .sort((a, b) => b.totalHistorico - a.totalHistorico);

    // Ventas por vendedor del mes (para calcular comisiones)
    const ventasPorVendedor = {};
    salesThisMonth.forEach(e => {
      const nombre = e.workerName || 'Sin nombre';
      if (!ventasPorVendedor[nombre]) ventasPorVendedor[nombre] = 0;
      ventasPorVendedor[nombre] += e.totalValue || 0;
    });

    return {
      totalVentas, totalVentasAnterior, trendVentas,
      costoVentas, margenBruto,
      totalGastos, resultadoOperacional, puntoEquilibrio, equilibrioSinMargen, margenBrutoDecimal,
      topProductos, sinMovimiento, stockCritico, sinStock, topClientes, topLabel, comparativa6Meses,
      ventasPorDia, alertas, valorInmovilizado,
      cantVentas: salesThisMonth.length,
      rankingClientes,
      coberturaMargenReal, margenRealCalculado, usarMargenReal,
      inversionCalculada,
      ventasPorVendedor,
      valorTotalInventario, productosConValor,
    };
  }, [exits, products, gastos, config, selectedMonth, customers]);

  // ── GASTOS ───────────────────────────────────────────
  const handleUploadFacturaAdmin = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploadingFactura(true);
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { addDoc, serverTimestamp: sts } = await import('firebase/firestore');
      const now = new Date();
      // Usar el mes que se está viendo en Gestión (mk), no la fecha real de hoy —
      // así una factura de junio subida el 1 de julio queda en junio si así lo eliges
      const periodo = mk;
      const fileName = `facturas/${companyId}/${periodo}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const snap = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snap.ref);

      const docRef = await addDoc(collection(db, `companies/${companyId}/facturas_proveedores`), {
        url,
        fileName: file.name,
        fileType: file.type,
        periodo,
        creadoAt: sts(),
        subidoPor: 'consultor',
        estado: 'confirmado', // las que sube el admin ya están revisadas
        monto: 0,
      });

      setFacturas(prev => [{ id: docRef.id, url, fileName: file.name, fileType: file.type, periodo, creadoAt: { toDate: () => now }, subidoPor: 'consultor', estado: 'confirmado', monto: 0 }, ...prev]);
    } catch (e) {
      console.error('Error subiendo factura:', e);
    } finally {
      setUploadingFactura(false);
      e.target.value = '';
    }
  };

  const guardarMontoFactura = async (facturaId) => {
    const monto = parseFloat(String(montoTemp).replace(/\./g, '').replace(',', '.')) || 0;
    try {
      const { updateDoc, doc: fDoc } = await import('firebase/firestore');
      await updateDoc(fDoc(db, `companies/${companyId}/facturas_proveedores/${facturaId}`), { monto });
      setFacturas(prev => prev.map(f => f.id === facturaId ? { ...f, monto } : f));
    } catch (e) {
      console.error('Error guardando monto:', e);
    } finally {
      setEditingMontoId(null);
      setMontoTemp('');
    }
  };

  const guardarFolioYRutFactura = async (facturaId) => {
    const folio = folioTemp.trim();
    const rut = rutTemp.trim();
    try {
      const { updateDoc, doc: fDoc } = await import('firebase/firestore');
      await updateDoc(fDoc(db, `companies/${companyId}/facturas_proveedores/${facturaId}`), { folio, rut });
      setFacturas(prev => prev.map(f => f.id === facturaId ? { ...f, folio, rut } : f));
    } catch (e) {
      console.error('Error guardando folio/RUT:', e);
    } finally {
      setEditingDocId(null);
      setFolioTemp('');
      setRutTemp('');
    }
  };

  const confirmarFactura = async (facturaId) => {
    try {
      const { updateDoc, doc: fDoc } = await import('firebase/firestore');
      await updateDoc(fDoc(db, `companies/${companyId}/facturas_proveedores/${facturaId}`), {
        estado: 'confirmado',
        confirmadoAt: new Date(),
      });
      setFacturas(prev => prev.map(f => f.id === facturaId ? { ...f, estado: 'confirmado' } : f));
    } catch (e) {
      console.error('Error confirmando factura:', e);
    }
  };

  const eliminarFactura = async (facturaId) => {
    try {
      const { deleteDoc, doc: fDoc } = await import('firebase/firestore');
      await deleteDoc(fDoc(db, `companies/${companyId}/facturas_proveedores/${facturaId}`));
      setFacturas(prev => prev.filter(f => f.id !== facturaId));
    } catch (e) {
      console.error('Error eliminando factura:', e);
    }
  };

  const loadClienteExits = async (cliente) => {
    setSelectedCliente(cliente);
    setLoadingClienteExits(true);
    try {
      // Filtrar exits del cliente desde los que ya tenemos cargados
      const clienteVentas = exits.filter(e => {
        if (e.reason !== 'SALE' || e.status === 'cancelled') return false;
        const rut = e.customerRut || e.boleta?.receptor?.rut;
        const nombre = e.customerName || e.boleta?.receptor?.razonSocial || e.workerName;
        if (cliente.rut) return rut === cliente.rut;
        return nombre === cliente.nombre;
      }).sort((a, b) => {
        const da = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.() || new Date(0);
        const db2 = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.() || new Date(0);
        return db2 - da;
      });
      setClienteExits(clienteVentas);
    } finally {
      setLoadingClienteExits(false);
    }
  };

  const saveConfig = async (configToSave = config) => {
    setSavingConfig(true);
    try {
      const { inversionMercaderia, ...globalCfg } = configToSave;
      // Margen y modo: globales (no cambian por mes)
      await setDoc(doc(db, `companies/${companyId}/gestion_config/settings`), { ...globalCfg, updatedAt: serverTimestamp() }, { merge: true });
      // Inversión: por mes (cada mes tiene su propia inversión)
      await setDoc(doc(db, `companies/${companyId}/gestion_config/settings_${mk}`), { inversionMercaderia: inversionMercaderia || '', updatedAt: serverTimestamp() }, { merge: true });
    } finally {
      setSavingConfig(false);
    }
  };

  // Auto-guardar config cuando cambia (debounce 800ms)
  useEffect(() => {
    if (!configLoaded || !companyId) return;
    const t = setTimeout(() => saveConfig(config), 800);
    return () => clearTimeout(t);
  }, [config, configLoaded, companyId]);

  const [copiandoGastos, setCopiandoGastos] = useState(false);
  const [gastosCopiadosOk, setGastosCopiadosOk] = useState(false);
  const [gastosAnterioresPanel, setGastosAnterioresPanel] = useState(null); // null=cerrado, []=abierto
  const [gastosAnterioresSeleccion, setGastosAnterioresSeleccion] = useState(new Set());
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [filtroRot, setFiltroRot] = useState('todos');
  const [busqRot, setBusqRot] = useState('');
  const [rotacionExits, setRotacionExits] = useState(null); // null = no cargado aún
  const [loadingRot, setLoadingRot] = useState(false);
  const [inventoryList, setInventoryList] = useState([]); // [{id, name}] de todos los inventarios
  const [rotInvFilter, setRotInvFilter] = useState('todos'); // filtro por inventario en tab Rotación
  const [analisisRotIA, setAnalisisRotIA] = useState(null); // resultado del análisis IA de rotación
  const [loadingRotIA, setLoadingRotIA] = useState(false); // cargando análisis IA de rotación

  const analizarRotacionIA = async (rows, topProductos, companyName) => {
    setLoadingRotIA(true);
    setAnalisisRotIA(null);
    try {
      // Tomar solo los 10 más críticos (mayor valor inmovilizado)
      const criticos = rows
        .filter(r => r.estado === 'parado' || r.estado === 'nunca')
        .sort((a, b) => (b.valorInmovilizado || 0) - (a.valorInmovilizado || 0))
        .slice(0, 10);

      const topStr = (topProductos || []).slice(0, 3)
        .map(p => `${p.name}(${p.qty}u)`).join(', ') || 'Sin datos';

      const fmtDiasIA = (d) => {
        if (d === null) return 'nunca vendido';
        if (d < 7) return `${d} días`;
        if (d < 30) return `${Math.floor(d / 7)} semanas`;
        if (d < 365) return `${Math.floor(d / 30)} meses`;
        return '+1 año';
      };
      const prodStr = criticos.map(p => {
        return `${p.name}|stock:${p.stock}|sin venta hace ${fmtDiasIA(p.diasSinVenta)}|$${Math.round(p.valorInmovilizado || 0).toLocaleString('es-CL')}`;
      }).join('\n');

      const prompt = `Consultor retail Chile. Analiza productos sin rotacion y responde SOLO JSON, sin texto extra, sin saltos de linea en strings, maximo 80 caracteres por campo de texto.

Top ventas: ${topStr}
Productos parados (nombre|stock|dias sin venta|valor):
${prodStr}

JSON exacto requerido (un objeto por producto, accion max 80 chars, razon max 60 chars):
{"resumen":"max 100 chars","recomendaciones":[{"producto":"nombre","accion":"accion corta","urgencia":"alta|media|baja","razon":"razon corta"}],"consejo_general":"max 100 chars"}`;

      const res = await fetch(`${API_URL}/api/assistant/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, empresa: companyName, mes: 'rotacion' }),
      });
      const data = await res.json();
      const raw = data.content || '{}';
      let parsed = { resumen: '', recomendaciones: [], consejo_general: '' };
      // Intentar extraer JSON limpio — Claude a veces incluye texto antes/después
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // Si falla el parse, mostrar el texto plano como resumen
          parsed = { resumen: raw.slice(0, 500), recomendaciones: [], consejo_general: '' };
        }
      }
      setAnalisisRotIA(parsed);
    } catch (e) {
      console.error('Error analizando rotación:', e);
      setAnalisisRotIA({ resumen: 'Error al analizar. Intenta de nuevo.', recomendaciones: [], consejo_general: '' });
    } finally {
      setLoadingRotIA(false);
    }
  };

  const exportarRotacionPDF = async (rows, analisisRotIA, companyName) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    const W = doc.internal.pageSize.getWidth();

    // ── Encabezado ──────────────────────────────────────────────────────────
    doc.setFillColor(15, 15, 20);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Informe de Rotación de Inventario', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 180);
    doc.text(`${companyName || 'Empresa'} · Generado el ${hoy}`, 14, 20);

    let y = 36;

    // ── Resumen estadístico ────────────────────────────────────────────────
    const activos = rows.filter(r => r.estado === 'activo').length;
    const lentos  = rows.filter(r => r.estado === 'lento').length;
    const parados = rows.filter(r => r.estado === 'parado').length;
    const nunca   = rows.filter(r => r.estado === 'nunca').length;
    const capitalParado = rows
      .filter(r => r.estado === 'parado' || r.estado === 'nunca')
      .reduce((s, r) => s + r.valorInmovilizado, 0);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 40);
    doc.text('Resumen', 14, y); y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Estado', 'Productos', 'Definición']],
      body: [
        ['✅ Activos',    String(activos), 'Vendidos en los últimos 15 días'],
        ['⚠️ Lentos',    String(lentos),  'Entre 15 y 45 días sin venta'],
        ['🔴 Parados',   String(parados), 'Más de 45 días sin venta'],
        ['⬜ Sin ventas', String(nunca),   'Nunca han sido vendidos'],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 50], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 6;

    if (capitalParado > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 40, 40);
      doc.text(`Capital inmovilizado (parados + sin ventas): $${Math.round(capitalParado).toLocaleString('es-CL')}`, 14, y);
      y += 8;
    }

    // ── Análisis IA (si existe) ─────────────────────────────────────────────
    if (analisisRotIA?.recomendaciones?.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 40);
      doc.text('Recomendaciones IA', 14, y); y += 6;

      if (analisisRotIA.resumen) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80, 80, 100);
        const lines = doc.splitTextToSize(analisisRotIA.resumen, W - 28);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 3;
      }

      autoTable(doc, {
        startY: y,
        head: [['Producto', 'Acción recomendada', 'Urgencia', 'Razón']],
        body: analisisRotIA.recomendaciones.map(r => [
          r.producto,
          r.accion,
          r.urgencia?.toUpperCase() || '',
          r.razon,
        ]),
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [80, 40, 140], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 60 },
          2: { cellWidth: 20 },
          3: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.column.index === 2 && data.section === 'body') {
            const urg = data.cell.raw?.toLowerCase();
            if (urg === 'alta' || urg === 'critica' || urg === 'crítica') data.cell.styles.textColor = [200, 40, 40];
            else if (urg === 'media') data.cell.styles.textColor = [180, 120, 20];
          }
        },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        margin: { left: 14, right: 14 },
      });

      y = doc.lastAutoTable.finalY + 6;

      if (analisisRotIA.consejo_general) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 40, 140);
        doc.text('Consejo general:', 14, y); y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 70);
        const lines = doc.splitTextToSize(analisisRotIA.consejo_general, W - 28);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 6;
      }
    }

    // ── Listado completo ──────────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 40);
    doc.text('Detalle por producto', 14, y); y += 4;

    const estadoLabel = { activo: 'Activo', lento: 'Lento', parado: 'Parado', nunca: 'Sin ventas' };
    const fmtDias = (d) => {
      if (d === null) return 'Nunca vendido';
      if (d < 7) return `${d} día${d !== 1 ? 's' : ''}`;
      if (d < 30) return `${Math.floor(d / 7)} semana${Math.floor(d / 7) !== 1 ? 's' : ''}`;
      if (d < 365) return `${Math.floor(d / 30)} mes${Math.floor(d / 30) !== 1 ? 'es' : ''}`;
      return `+1 año`;
    };
    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Stock', 'Estado', 'Sin venta hace', 'Valor inmovilizado']],
      body: rows.map(r => [
        r.name,
        `${r.stock} ${r.unit || 'un'}`,
        estadoLabel[r.estado] || r.estado,
        fmtDias(r.diasSinVenta),
        r.valorInmovilizado > 0 ? `$${Math.round(r.valorInmovilizado).toLocaleString('es-CL')}` : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 30, 50], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          const v = data.cell.raw;
          if (v === 'Parado') data.cell.styles.textColor = [180, 40, 40];
          else if (v === 'Sin ventas') data.cell.styles.textColor = [120, 120, 140];
          else if (v === 'Lento') data.cell.styles.textColor = [160, 100, 20];
          else data.cell.styles.textColor = [30, 140, 80];
        }
      },
      margin: { left: 14, right: 14 },
    });

    // ── Pie de página ──────────────────────────────────────────────────────
    const totalPags = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPags; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 180);
      doc.text(`Página ${i} de ${totalPags} · Bodestock`, W / 2, 290, { align: 'center' });
    }

    doc.save(`rotacion-inventario-${companyName?.replace(/\s+/g, '-').toLowerCase() || 'empresa'}-${hoy.replace(/\s/g, '')}.pdf`);
  };

  const abrirPanelGastosAnteriores = async () => {
    setCargandoAnteriores(true);
    try {
      const [y, m] = mk.split('-').map(Number);
      const mesAnterior = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      const snap = await getDocs(
        query(collection(db, `companies/${companyId}/gestion_gastos`), where('periodo', '==', mesAnterior))
      ).catch(() => ({ docs: [] }));
      const NO_COPIAR = ['comision_vendedor'];
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(g => !NO_COPIAR.includes(g.tipo));
      setGastosAnterioresPanel(lista);
      // Pre-seleccionar todos por defecto
      setGastosAnterioresSeleccion(new Set(lista.map(g => g.id)));
    } catch (e) {
      console.error('Error cargando gastos anteriores:', e);
      setGastosAnterioresPanel([]);
    } finally {
      setCargandoAnteriores(false);
    }
  };

  const confirmarCopiaGastos = async () => {
    setCopiandoGastos(true);
    try {
      const acopiar = (gastosAnterioresPanel || []).filter(g => gastosAnterioresSeleccion.has(g.id));
      const nuevos = [];
      for (const g of acopiar) {
        const { id, creadoAt, periodo, ...resto } = g;
        const cuotaActual = resto.cuotaActual ? String(parseInt(resto.cuotaActual) + 1) : undefined;
        const gastoData = { ...resto, ...(cuotaActual ? { cuotaActual } : {}), periodo: mk, creadoAt: serverTimestamp() };
        const ref = await addDoc(collection(db, `companies/${companyId}/gestion_gastos`), gastoData);
        nuevos.push({ id: ref.id, ...gastoData });
      }
      setGastos(prev => [...prev, ...nuevos]);
      setGastosCopiadosOk(true);
      setGastosAnterioresPanel(null);
      setGastosAnterioresSeleccion(new Set());
      setTimeout(() => setGastosCopiadosOk(false), 3000);
    } catch (e) {
      console.error('Error copiando gastos:', e);
    } finally {
      setCopiandoGastos(false);
    }
  };

  const saveGasto = async () => {
    const montoNum = parseInput(nuevoGasto.monto);
    if (!montoNum || montoNum <= 0) return;
    setSavingGasto(true);
    try {
      if (editandoGastoId) {
        // Editar existente
        await setDoc(doc(db, `companies/${companyId}/gestion_gastos/${editandoGastoId}`), { ...nuevoGasto, monto: montoNum, periodo: mk }, { merge: true });
        setGastos(prev => prev.map(g => g.id === editandoGastoId ? { ...g, ...nuevoGasto, monto: montoNum } : g));
        setEditandoGastoId(null);
      } else {
        // Crear nuevo
        const ref = await addDoc(
          collection(db, `companies/${companyId}/gestion_gastos`),
          { ...nuevoGasto, monto: montoNum, periodo: mk, creadoAt: serverTimestamp() }
        );
        setGastos(prev => [...prev, { id: ref.id, ...nuevoGasto, monto: montoNum }]);
      }
      setNuevoGasto({ tipo: 'arriendo', descripcion: '', monto: '', banco: '', cuotaActual: '', cuotaTotal: '', comisionVendedor: '', comisionPct: 3 });
    } finally {
      setSavingGasto(false);
    }
  };

  const deleteGasto = async (id) => {
    await deleteDoc(doc(db, `companies/${companyId}/gestion_gastos/${id}`));
    setGastos(prev => prev.filter(g => g.id !== id));
  };

  // ── REPORTE ──────────────────────────────────────────
  const analizarStockConIA = async () => {
    const productos = stats.sinMovimiento || [];
    if (productos.length === 0) return;
    setAnalizandoIA(true);
    setAnalisisIA(null);
    try {
      // Tomar los 20 más valiosos para no sobrecargar el prompt
      const top = [...productos]
        .sort((a, b) => ((b.stock || 0) * (b.ppp || 0)) - ((a.stock || 0) * (a.ppp || 0)))
        .slice(0, 20);

      const lista = top.map(p =>
        `- ${p.name}: ${p.stock} unidades, costo unitario ${CLP(p.ppp || 0)}, valor total ${CLP((p.stock || 0) * (p.ppp || 0))}`
      ).join('\n');

      const prompt = `Eres un estratega comercial experto en distribuidoras y minimarkets chilenos. Tu trabajo es mover stock parado con estrategias reales, no solo bajar precios.

Empresa: ${company?.name}
Capital inmovilizado total: ${CLP(stats.valorInmovilizado)}

PRODUCTOS CON STOCK PARADO (sin rotación):
${lista}

Para cada producto, elige la MEJOR estrategia entre estas opciones y explica exactamente cómo ejecutarla:
- LIQUIDAR: si el producto está próximo a vencer o es muy difícil de rotar. Sugiere precio exacto con descuento agresivo.
- COMBO: si se puede agrupar con otro producto que sí se vende bien (ej: "compra X y lleva Y de regalo", "pack 2x1", "lleva 3 paga 2"). Indica con qué producto combinarlo y cómo armar la oferta.
- PROMOVER: si es buen producto pero falta visibilidad. Indica canal concreto (WhatsApp a clientes, redes sociales, oferta de la semana) y qué mensaje usar.
- DEVOLVER: solo si es el último recurso (producto sin salida ninguna).

Sé directo, específico y comercialmente agresivo. Piensa como dueño de negocio que necesita liquidez esta semana.

Responde SOLO en este JSON exacto, sin texto extra:
{
  "analisis": [
    {
      "nombre": "nombre del producto",
      "estrategia": "LIQUIDAR|COMBO|PROMOVER|DEVOLVER",
      "precioSugerido": 1200,
      "accionEstaaSemana": "texto corto — qué hacer exactamente HOY o esta semana",
      "recomendacion": "explicación completa de la estrategia con números y detalles concretos"
    }
  ]
}`;

      const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'https://api.bodestock.cl';
      const resp = await fetch(`${backendUrl}/api/assistant/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, empresa: company?.name, mes: mesActual }),
      });

      if (!resp.ok) throw new Error('Error del servidor');
      const data = await resp.json();
      const match = (data.content || '').match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Respuesta inválida');
      const parsed = JSON.parse(match[0]);
      setAnalisisIA(parsed.analisis || []);

      // Pre-llenar el stockPlan con la estrategia y precio sugeridos por la IA
      const newPlan = { ...stockPlan };
      parsed.analisis?.forEach(item => {
        const prod = productos.find(p => p.name === item.nombre || p.name?.toLowerCase().includes(item.nombre?.toLowerCase()));
        if (!prod) return;
        const estrategiaIA = (item.estrategia || '').toLowerCase();
        const estrategiaMap = { liquidar: 'liquidar', combo: 'combo', promover: 'promover', devolver: 'devolver' };
        const estrategia = estrategiaMap[estrategiaIA] || 'promover';
        newPlan[prod.id] = {
          estrategia,
          precioLiquidacion: estrategia === 'liquidar' && item.precioSugerido > 0 ? String(item.precioSugerido) : '',
          comboDescripcion: estrategia === 'combo' ? (item.recomendacion || '') : '',
        };
      });
      setStockPlan(newPlan);

    } catch (e) {
      console.error('Error analizando stock:', e);
    } finally {
      setAnalizandoIA(false);
    }
  };

  const generarConIA = async () => {
    setGenerandoIA(true);
    try {
      // Preparar contexto con todos los datos del mes
      const ctx = {
        empresa: company?.name,
        mes: mesActual,
        ventas: stats.totalVentas,
        ventasAnterior: stats.totalVentasAnterior,
        trendVentas: stats.trendVentas,
        margenBruto: stats.margenBruto,
        gastosFijos: stats.totalGastos,
        resultado: stats.resultadoOperacional,
        puntoEquilibrio: stats.puntoEquilibrio,
        equilibrioSinMargen: stats.equilibrioSinMargen,
        margenBrutoDecimal: stats.margenBrutoDecimal,
        cantVentas: stats.cantVentas,
        sinStock: Array.isArray(stats.sinStock) ? stats.sinStock.length : (stats.sinStock || 0),
        stockCritico: Array.isArray(stats.stockCritico) ? stats.stockCritico.length : (stats.stockCritico || 0),
        sinMovimiento: Array.isArray(stats.sinMovimiento) ? stats.sinMovimiento.length : (stats.sinMovimiento || 0),
        valorInmovilizado: stats.valorInmovilizado,
        topProductos: (stats.topProductos || []).slice(0, 5).map(p => `${p.name} (${p.qty} un, ${CLP(p.total)})`).join(', '),
        topClientes: (stats.rankingClientes || []).filter(c => c.comprasMes > 0).slice(0, 3).map(c => `${c.nombre} (${CLP(c.totalMes)})`).join(', '),
        alertas: (stats.alertas || []).map(a => a.message).join('; '),
      };

      const esSemanal = tipoReporte === 'semanal';

      const prompt = esSemanal
        ? `Eres un consultor de negocios experto entregando el pulso semanal de ${ctx.empresa}.

DATOS DE LA SEMANA:
- Ventas: ${CLP(ctx.ventas)} (${ctx.trendVentas > 0 ? '+' : ''}${ctx.trendVentas?.toFixed(1)}% vs semana anterior)
- Margen bruto estimado: ${PCT(ctx.margenBruto)}
- Transacciones: ${ctx.cantVentas}

INVENTARIO URGENTE:
- Productos sin stock: ${ctx.sinStock} (perdiendo ventas ahora mismo)
- Stock crítico (≤5 un): ${ctx.stockCritico}

TOP PRODUCTOS: ${ctx.topProductos || 'Sin datos'}
ALERTAS: ${ctx.alertas || 'Ninguna'}

Genera en español chileno (informal pero profesional). El reporte semanal debe ser CORTO y ACCIONABLE — el cliente lo lee en 2 minutos.

1. OBSERVACIONES (máximo 3-4 líneas): Qué pasó esta semana. Solo lo más importante. Menciona números. Directo al grano.

2. RECOMENDACIONES (exactamente 3, formato lista): Acciones concretas para ESTA semana. Cortas. Verbos de acción. Ej: "Reponer X antes del jueves".

3. OBJETIVOS (exactamente 2, formato lista): Las 2 tareas más importantes para la semana.

Responde SOLO en este formato JSON, sin texto extra:
{
  "observaciones": "texto corto aquí",
  "recomendaciones": ["rec1", "rec2", "rec3"],
  "objetivos": ["obj1", "obj2"]
}`
        : `Eres un consultor de negocios experto analizando los resultados mensuales de ${ctx.empresa} para ${ctx.mes}.

DATOS DEL MES:
- Ventas: ${CLP(ctx.ventas)} (${ctx.trendVentas > 0 ? '+' : ''}${ctx.trendVentas?.toFixed(1)}% vs mes anterior)
- Margen bruto estimado: ${PCT(ctx.margenBruto)}
- Gastos fijos: ${CLP(ctx.gastosFijos)}
- Resultado operacional: ${CLP(ctx.resultado)} (${ctx.resultado >= 0 ? 'ganancia' : 'pérdida'})
- Transacciones: ${ctx.cantVentas}
${ctx.puntoEquilibrio ? `- Punto de equilibrio: ${CLP(ctx.puntoEquilibrio)}` : ctx.equilibrioSinMargen ? `- Punto de equilibrio: no calculable (margen bruto ${(ctx.margenBrutoDecimal * 100).toFixed(1)}% — mes de alta inversión en mercadería)` : ''}

INVENTARIO:
- Productos sin stock: ${ctx.sinStock}
- Stock crítico (≤5 un): ${ctx.stockCritico}
- Productos sin rotación: ${ctx.sinMovimiento} (capital inmovilizado: ${CLP(ctx.valorInmovilizado)})

TOP PRODUCTOS: ${ctx.topProductos || 'Sin datos'}
TOP CLIENTES: ${ctx.topClientes || 'Sin datos'}
ALERTAS: ${ctx.alertas || 'Ninguna'}

Genera en español chileno (informal pero profesional):

1. OBSERVACIONES (2-3 párrafos): Análisis completo del mes. Qué pasó, por qué, qué destaca. Menciona números específicos. Sé directo.

2. RECOMENDACIONES (exactamente 4, formato lista): Acciones concretas y específicas para el próximo mes. Verbos de acción.

3. OBJETIVOS (exactamente 3, formato lista): Tareas específicas y medibles para el próximo mes.

Responde SOLO en este formato JSON, sin texto extra:
{
  "observaciones": "texto aquí",
  "recomendaciones": ["rec1", "rec2", "rec3", "rec4"],
  "objetivos": ["obj1", "obj2", "obj3"]
}`;

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;

      // Llamar a Claude via backend para evitar exponer API key
      const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'https://api.bodestock.cl';
      const response = await fetch(`${backendUrl}/api/assistant/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, empresa: ctx.empresa, mes: ctx.mes }),
      });

      if (!response.ok) throw new Error('Error del servidor al generar reporte');

      const data = await response.json();
      const content = data.content || data.text || data.response;

      // Parsear JSON de la respuesta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Respuesta inválida de la IA');
      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.observaciones) setObservaciones(parsed.observaciones);
      if (parsed.recomendaciones?.length) setRecomendaciones(parsed.recomendaciones);
      if (parsed.objetivos?.length) setObjetivos(parsed.objetivos);

    } catch (e) {
      console.error('Error generando con IA:', e.message);
      // Fallback: generar texto básico localmente si falla el backend
      const trend = stats.trendVentas > 0 ? `subió un ${stats.trendVentas.toFixed(0)}%` : `bajó un ${Math.abs(stats.trendVentas || 0).toFixed(0)}%`;
      if (esSemanal) {
        setObservaciones(
          `Esta semana ${ctx.empresa} registró ventas de ${CLP(stats.totalVentas)} en ${stats.cantVentas} transacciones, ${trend} vs la semana anterior.` +
          ((stats.sinStock?.length || 0) > 0 ? ` Hay ${stats.sinStock?.length} productos sin stock que están perdiendo ventas ahora mismo.` : '')
        );
        setRecomendaciones([
          ...(stats.sinStock?.length > 0 ? [`Reponer urgente: ${(stats.sinStock || []).slice(0, 3).map(p => p.name).join(', ')}`] : []),
          'Revisar precios de los productos más vendidos esta semana',
          'Confirmar pedido a proveedores antes del jueves',
        ].slice(0, 3));
        setObjetivos([
          'Reponer stock crítico antes del fin de semana',
          'Cerrar la semana con más transacciones que la anterior',
        ]);
      } else {
        const resultadoTexto = stats.resultadoOperacional >= 0
          ? `con una ganancia operacional de ${CLP(stats.resultadoOperacional)}`
          : `con una pérdida operacional de ${CLP(Math.abs(stats.resultadoOperacional))}`;
        setObservaciones(
          `${mesActual} cerró con ventas de ${CLP(stats.totalVentas)} en ${stats.cantVentas} transacciones, ${trend} respecto al mes anterior.\n\n` +
          `El mes quedó ${resultadoTexto}. ` +
          ((stats.sinStock?.length || 0) > 0 ? `Se detectaron ${stats.sinStock?.length} productos sin stock, lo que representa ventas perdidas durante el período. ` : '') +
          (stats.valorInmovilizado > 0 ? `Hay ${CLP(stats.valorInmovilizado)} en capital inmovilizado en productos sin rotación.` : '')
        );
        setRecomendaciones([
          ...(stats.sinStock?.length > 0 ? [`Reponer urgente los ${stats.stockCritico?.length} productos con stock crítico`] : []),
          ...(stats.valorInmovilizado > 0 ? [`Liquidar o promocionar los ${stats.sinMovimiento?.length} productos sin rotación`] : []),
          'Revisar precios vs competencia en los productos más vendidos',
          'Confirmar pedido a proveedores para la próxima semana',
        ].slice(0, 4));
        setObjetivos([
          'Hacer pedido a proveedores priorizando productos agotados',
          'Revisar y actualizar lista de precios',
          'Confirmar monto real de inversión en mercadería del mes',
        ]);
      }
    } finally {
      setGenerandoIA(false);
    }
  };

  const saveReporte = async (publicar = false) => {
    setSavingReporte(true);
    try {
      const data = {
        periodo: mk,
        tipo: tipoReporte,
        observaciones,
        recomendaciones: recomendaciones.filter(r => r.trim()),
        objetivos: objetivos.filter(o => o.trim()),
        estado: publicar ? 'publicado' : 'borrador',
        kpis: {
          ventas: stats.totalVentas,
          margen: stats.margenBruto,
          gastos: stats.totalGastos,
          resultado: stats.resultadoOperacional,
          cantVentas: stats.cantVentas,
        },
        alertas: stats.alertas,
        // Detalle de gastos para estado de resultados en Mi Consultor
        detalleGastos: gastos.map(g => ({
          tipo: g.tipo,
          descripcion: g.descripcion || '',
          monto: g.monto || 0,
          ...(g.tipo === 'comision_vendedor' ? { comisionVendedor: g.comisionVendedor || '', comisionPct: g.comisionPct ?? null } : {}),
        })),
        costoVentas: stats.costoVentas || 0,
        // Productos sin rotación para mostrar en Mi Consultor
        sinMovimiento: (stats.sinMovimiento || []).slice(0, 15).map(p => ({
          id: p.id,
          name: p.name,
          stock: p.stock ?? 0,
          unit: p.unit || 'un',
          valorInmovilizado: (p.stock ?? 0) * (p.ppp || 0),
        })),
        // Top 3 clientes del mes para mostrar en Mi Consultor
        topClientes: (stats.rankingClientes || [])
          .filter(c => c.comprasMes > 0)
          .slice(0, 3)
          .map(c => ({
            nombre: c.nombre,
            rut: c.rut || null,
            totalMes: c.totalMes,
            comprasMes: c.comprasMes,
          })),
        // Top 3 productos del mes
        topProductos: (stats.topProductos || []).slice(0, 3).map(p => ({
          name: p.name,
          qty: p.qty,
          total: p.total,
        })),
        updatedAt: serverTimestamp(),
        ...(publicar ? { publicadoAt: serverTimestamp() } : {}),
      };
      await setDoc(doc(db, `companies/${companyId}/gestion_reportes/${mk}`), data, { merge: true });
      if (publicar) setReporteSaved(true);
    } finally {
      setSavingReporte(false);
    }
  };

  const slug = `${company?.name?.replace(/\s+/g, '-').toLowerCase() || 'empresa'}-${selectedMonth}`;

  // Helper PDF — crea doc con header estándar
  const _pdfBase = async (tituloDoc) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(20, 20, 30); doc.rect(0, 0, W, 22, 'F');
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(`${company?.name} — ${tituloDoc} — ${mesActual}`, 14, 14);
    doc.setTextColor(30, 30, 30);
    return { doc, autoTable, W, y: 28 };
  };
  const _pdfPie = (doc, W) => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 160);
      doc.text(`${company?.name} · Bodestock · Pág. ${i}/${n}`, W / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
    }
  };

  // ── Dashboard: PDF ─────────────────────────────────────────────────────────
  const exportarDashboardPDF = async () => {
    const { doc, autoTable, W } = await _pdfBase('Dashboard');
    let y = 28;
    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor']],
      body: [
        ['Ventas del mes', CLP(stats.totalVentas)],
        ['N° de ventas', String(stats.cantVentas || 0)],
        ['Margen bruto', PCT(stats.margenBruto)],
        ['Costo de ventas', CLP(stats.costoVentas)],
        ['Total gastos', CLP(stats.totalGastos)],
        ['Resultado operacional', CLP(stats.resultadoOperacional)],
        ...(stats.puntoEquilibrio ? [['Punto de equilibrio', CLP(stats.puntoEquilibrio)]] : []),
        ['Capital inmovilizado', CLP(stats.valorInmovilizado)],
      ],
      theme: 'striped', headStyles: { fillColor: [20, 20, 30], textColor: 255 },
      styles: { fontSize: 10 }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
    if (stats.alertas?.length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 120);
      doc.text('ALERTAS', 14, y); y += 4; doc.setTextColor(30, 30, 30);
      autoTable(doc, {
        startY: y,
        body: stats.alertas.map(a => [a.type === 'critical' ? '[CRÍTICO]' : a.type === 'warning' ? '[AVISO]' : '[INFO]', a.message]),
        theme: 'plain', styles: { fontSize: 8 }, margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 6;
    }
    if (stats.topProductos?.length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 120);
      doc.text('TOP PRODUCTOS', 14, y); y += 4; doc.setTextColor(30, 30, 30);
      autoTable(doc, {
        startY: y,
        head: [['Producto', 'Unidades', 'Total']],
        body: stats.topProductos.map(p => [p.name, String(p.qty || 0), CLP(p.total)]),
        theme: 'striped', headStyles: { fillColor: [20, 20, 30], textColor: 255 },
        styles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });
    }
    _pdfPie(doc, W);
    doc.save(`dashboard-${slug}.pdf`);
  };

  // ── Dashboard: Excel ────────────────────────────────────────────────────────
  const exportarDashboardExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([
      [`${company?.name} — Dashboard — ${mesActual}`], [''],
      ['Indicador', 'Valor'],
      ['Ventas del mes', stats.totalVentas || 0],
      ['N° de ventas', stats.cantVentas || 0],
      ['Margen bruto (%)', parseFloat((stats.margenBruto || 0).toFixed(2))],
      ['Costo de ventas', stats.costoVentas || 0],
      ['Total gastos', stats.totalGastos || 0],
      ['Resultado operacional', stats.resultadoOperacional || 0],
      ...(stats.puntoEquilibrio ? [['Punto de equilibrio', stats.puntoEquilibrio]] : []),
      ['Capital inmovilizado', stats.valorInmovilizado || 0],
      [''], ['ALERTAS'],
      ...(stats.alertas || []).map(a => [a.type.toUpperCase(), a.message]),
      [''], ['TOP PRODUCTOS', 'Unidades', 'Total'],
      ...(stats.topProductos || []).map(p => [p.name, p.qty || 0, p.total || 0]),
    ]);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 16 }];
    utils.book_append_sheet(wb, ws, 'Dashboard');
    writeFile(wb, `dashboard-${slug}.xlsx`);
  };

  // ── Clientes: PDF ───────────────────────────────────────────────────────────
  const exportarClientesPDF = async () => {
    const { doc, autoTable, W } = await _pdfBase('Clientes');
    autoTable(doc, {
      startY: 28,
      head: [['Cliente', 'RUT', 'Compras mes', 'Total mes', 'Total histórico', 'Última compra']],
      body: (stats.rankingClientes || []).map(c => {
        const uc = c.ultimaCompra ? new Date(c.ultimaCompra instanceof Date ? c.ultimaCompra : c.ultimaCompra?.toDate?.() || c.ultimaCompra).toLocaleDateString('es-CL') : '-';
        return [c.nombre, c.rut || '-', String(c.comprasMes || 0), CLP(c.totalMes), CLP(c.totalHistorico), uc];
      }),
      theme: 'striped', headStyles: { fillColor: [20, 20, 30], textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    _pdfPie(doc, W);
    doc.save(`clientes-${slug}.pdf`);
  };

  // ── Clientes: Excel ─────────────────────────────────────────────────────────
  const exportarClientesExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([
      [`${company?.name} — Clientes — ${mesActual}`], [''],
      ['Cliente', 'RUT', 'Compras este mes', 'Total mes', 'Total histórico', 'Última compra'],
      ...(stats.rankingClientes || []).map(c => {
        const uc = c.ultimaCompra ? new Date(c.ultimaCompra instanceof Date ? c.ultimaCompra : c.ultimaCompra?.toDate?.() || c.ultimaCompra).toLocaleDateString('es-CL') : '-';
        return [c.nombre, c.rut || '-', c.comprasMes || 0, c.totalMes || 0, c.totalHistorico || 0, uc];
      }),
    ]);
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }];
    utils.book_append_sheet(wb, ws, 'Clientes');
    writeFile(wb, `clientes-${slug}.xlsx`);
  };

  // ── Gastos: PDF ─────────────────────────────────────────────────────────────
  const exportarGastosPDF = async () => {
    const { doc, autoTable, W } = await _pdfBase('Gastos');
    const total = gastos.reduce((s, g) => s + (g.monto || 0), 0);
    autoTable(doc, {
      startY: 28,
      head: [['Tipo', 'Descripción', 'Monto']],
      body: [
        ...gastos.map(g => [g.tipo, g.descripcion || '-', CLP(g.monto || 0)]),
        [{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } }, CLP(total)],
      ],
      theme: 'striped', headStyles: { fillColor: [20, 20, 30], textColor: 255 },
      styles: { fontSize: 9 }, columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });
    _pdfPie(doc, W);
    doc.save(`gastos-${slug}.pdf`);
  };

  // ── Gastos: Excel ───────────────────────────────────────────────────────────
  const exportarGastosExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const wb = utils.book_new();
    const total = gastos.reduce((s, g) => s + (g.monto || 0), 0);
    const ws = utils.aoa_to_sheet([
      [`${company?.name} — Gastos — ${mesActual}`], [''],
      ['Tipo', 'Descripción', 'Monto'],
      ...gastos.map(g => [g.tipo, g.descripcion || '-', g.monto || 0]),
      ['', 'TOTAL', total],
    ]);
    ws['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 14 }];
    utils.book_append_sheet(wb, ws, 'Gastos');
    writeFile(wb, `gastos-${slug}.xlsx`);
  };

  // ── Plan / Stock parado: PDF ────────────────────────────────────────────────
  const exportarPlanPDF = async () => {
    const { doc, autoTable, W } = await _pdfBase('Plan de Acción');
    let y = 28;
    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Stock', 'Costo u.', 'Valor', 'Estrategia', 'Detalle']],
      body: (stats.sinMovimiento || []).map(p => {
        const plan = stockPlan[p.id] || {};
        const val = (p.stock || 0) * (p.ppp || 0);
        const det = plan.estrategia === 'liquidar' && plan.precioLiquidacion
          ? `Precio: ${CLP(Number(plan.precioLiquidacion))}`
          : plan.estrategia === 'combo' && plan.comboDescripcion ? plan.comboDescripcion : '-';
        return [p.name, String(p.stock || 0), CLP(p.ppp || 0), CLP(val), (plan.estrategia || 'Sin asignar').toUpperCase(), det];
      }),
      theme: 'striped', headStyles: { fillColor: [20, 20, 30], textColor: 255 },
      styles: { fontSize: 8 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 6;
    if (analisisIA?.length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 40, 120);
      doc.text('ESTRATEGIA IA', 14, y); y += 4; doc.setTextColor(30, 30, 30);
      autoTable(doc, {
        startY: y,
        head: [['Producto', 'Estrategia', 'Acción esta semana', 'Precio sugerido']],
        body: analisisIA.map(a => [a.nombre, a.estrategia || '-', a.accionEstaaSemana || a.recomendacion || '-', a.precioSugerido ? CLP(a.precioSugerido) : '-']),
        theme: 'striped', headStyles: { fillColor: [80, 40, 120], textColor: 255 },
        styles: { fontSize: 8 }, columnStyles: { 3: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      });
    }
    _pdfPie(doc, W);
    doc.save(`plan-stock-${slug}.pdf`);
  };

  // ── Plan / Stock parado: Excel ──────────────────────────────────────────────
  const exportarPlanExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([
      [`${company?.name} — Plan de Acción Stock Parado — ${mesActual}`], [''],
      ['Producto', 'Stock', 'Costo unitario', 'Valor inmovilizado', 'Estrategia', 'Detalle', 'Acción IA', 'Precio IA'],
      ...(stats.sinMovimiento || []).map(p => {
        const plan = stockPlan[p.id] || {};
        const val = (p.stock || 0) * (p.ppp || 0);
        const ia = analisisIA?.find(a => a.nombre === p.name || p.name?.toLowerCase().includes(a.nombre?.toLowerCase()));
        return [
          p.name, p.stock || 0, p.ppp || 0, val,
          (plan.estrategia || '').toUpperCase(),
          plan.estrategia === 'liquidar' && plan.precioLiquidacion ? Number(plan.precioLiquidacion) : plan.comboDescripcion || '',
          ia?.accionEstaaSemana || ia?.recomendacion || '',
          ia?.precioSugerido || '',
        ];
      }),
    ]);
    ws['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 25 }, { wch: 35 }, { wch: 12 }];
    utils.book_append_sheet(wb, ws, 'Stock Parado');
    writeFile(wb, `plan-stock-${slug}.xlsx`);
  };

  // ── Inventario (alertas): PDF ────────────────────────────────────────────────
  const exportarInventarioPDF = async () => {
    const { doc, autoTable, W } = await _pdfBase('Inventario');
    let y = 28;
    if ((stats.sinStock || []).length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 40, 40);
      doc.text('SIN STOCK (agotados)', 14, y); y += 4; doc.setTextColor(30, 30, 30);
      autoTable(doc, {
        startY: y, body: stats.sinStock.map(p => [p.name, '0 unidades']),
        theme: 'plain', styles: { fontSize: 9 }, margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 6;
    }
    if ((stats.stockCritico || []).length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 120, 20);
      doc.text('STOCK CRÍTICO (≤5 unidades)', 14, y); y += 4; doc.setTextColor(30, 30, 30);
      autoTable(doc, {
        startY: y, head: [['Producto', 'Stock actual']],
        body: stats.stockCritico.map(p => [p.name, `${p.stock} unidades`]),
        theme: 'striped', headStyles: { fillColor: [20, 20, 30], textColor: 255 },
        styles: { fontSize: 9 }, margin: { left: 14, right: 14 },
      });
    }
    _pdfPie(doc, W);
    doc.save(`inventario-alertas-${slug}.pdf`);
  };

  // ── Inventario (alertas): Excel ─────────────────────────────────────────────
  const exportarInventarioExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([
      [`${company?.name} — Alertas Inventario — ${mesActual}`], [''],
      ['Estado', 'Producto', 'Stock'],
      ...(stats.sinStock || []).map(p => ['SIN STOCK', p.name, 0]),
      ...(stats.stockCritico || []).map(p => ['STOCK CRÍTICO', p.name, p.stock || 0]),
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 10 }];
    utils.book_append_sheet(wb, ws, 'Inventario Alertas');
    writeFile(wb, `inventario-alertas-${slug}.xlsx`);
  };

  // ── Ventas (dashboard): Excel solo ─────────────────────────────────────────
  const exportarVentasExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const wb = utils.book_new();
    const salesThisMonth = exits.filter(e => {
      const d = e.createdAt instanceof Date ? e.createdAt : e.createdAt?.toDate?.() || null;
      return d && monthKey(d) === selectedMonth && e.reason === 'SALE' && e.status !== 'cancelled';
    });
    const ws = utils.aoa_to_sheet([
      [`${company?.name} — Ventas — ${mesActual}`], [''],
      ['Fecha', 'Cliente', 'RUT', 'Total', 'Productos'],
      ...salesThisMonth.map(e => {
        const d = e.createdAt instanceof Date ? e.createdAt : e.createdAt?.toDate?.() || new Date(0);
        return [
          d.toLocaleDateString('es-CL'),
          e.customerName || e.workerName || '-',
          e.customerRut || '-',
          e.totalValue || 0,
          (e.products || []).map(p => `${p.productName || p.name} x${p.quantity || 1}`).join(', '),
        ];
      }),
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
    utils.book_append_sheet(wb, ws, 'Ventas');
    writeFile(wb, `ventas-${slug}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
    </div>
  );

  const botonesExportar = {
    dashboard:  [['PDF', exportarDashboardPDF], ['Excel', exportarDashboardExcel], ['Ventas', exportarVentasExcel]],
    clientes:   [['PDF', exportarClientesPDF], ['Excel', exportarClientesExcel]],
    plan:       [['PDF', exportarPlanPDF], ['Excel', exportarPlanExcel]],
    gastos:     [['PDF', exportarGastosPDF], ['Excel', exportarGastosExcel]],
    inventario: [['PDF', exportarInventarioPDF], ['Excel', exportarInventarioExcel]],
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 px-2 sm:px-0">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="icon" onClick={() => navigate(`/super-admin/empresa/${companyId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">{company?.name}</h1>
            <p className="text-[11px] text-zinc-600">Control de Gestión · {mesActual}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadAll(true)} className="gap-1.5 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
        <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] w-max min-w-full sm:w-fit">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'plan', label: 'Plan', icon: Zap },
            { id: 'gastos', label: 'Gastos', icon: DollarSign },
            { id: 'inventario', label: 'Inventario', icon: Package },
            { id: 'rotacion', label: 'Rotación', icon: RefreshCw },
            { id: 'reporte', label: 'Reporte', icon: FileText },
            { id: 'historial', label: 'Historial', icon: History },
            { id: 'marketing', label: 'Marketing', icon: Megaphone },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium transition-all cursor-pointer border-none whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white/[0.10] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <t.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: DASHBOARD ── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5">

          {/* Selector de mes */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  const prev = new Date(y, m - 2, 1);
                  setSelectedMonth(monthKey(prev));
                }}
                className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                ‹
              </button>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] font-semibold focus:outline-none cursor-pointer"
                >
                  {availableMonths.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              </div>
              <button
                onClick={() => {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  const next = new Date(y, m, 1);
                  if (next <= now) setSelectedMonth(monthKey(next));
                }}
                disabled={isCurrentMonth}
                className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-30"
              >
                ›
              </button>
            </div>
            {!isCurrentMonth && (
              <button
                onClick={() => setSelectedMonth(monthKey(now))}
                className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors bg-transparent border-none cursor-pointer"
              >
                Ir al mes actual
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={exportarDashboardPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[12px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={exportarDashboardExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[12px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              <button onClick={exportarVentasExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[12px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-3.5 h-3.5" /> Ventas
              </button>
            </div>
          </div>

          {/* Alertas */}
          {stats.alertas.length > 0 && (
            <Card className="p-4">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Alertas automáticas</p>
              <div className="space-y-2">
                {stats.alertas.map((a, i) => <AlertChip key={i} type={a.type} message={a.message} />)}
              </div>
            </Card>
          )}

          {/* KPIs — fila superior: ventas y tendencia */}
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              title="Ventas del mes"
              value={CLP(stats.totalVentas)}
              sub={`${stats.cantVentas} transacciones`}
              icon={ShoppingCart}
              color="blue"
              trend={stats.trendVentas}
            />
            <KPICard
              title="Margen bruto"
              value={PCT(stats.margenBruto)}
              sub={stats.margenBruto > 0
                ? `Ganancia estimada: ${CLP(Math.round(stats.totalVentas * stats.margenBruto / 100))}`
                : 'Ingresa inversión en tab Gastos'
              }
              icon={TrendingUp}
              color={stats.margenBruto >= 25 ? 'emerald' : stats.margenBruto >= 15 ? 'amber' : stats.margenBruto > 0 ? 'red' : 'zinc'}
            />
          </div>

          {/* Valor total del inventario */}
          {stats.valorTotalInventario > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Capital invertido en stock</p>
                  <p className="text-[26px] font-black text-white tabular-nums leading-none">{CLP(stats.valorTotalInventario)}</p>
                  <p className="text-[11px] text-zinc-500 mt-1.5">{stats.productosConValor} productos con stock valorizado · actualizado al momento</p>
                </div>
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-emerald-500/[0.10] border border-emerald-500/[0.20] flex items-center justify-center">
                  <Package className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              {stats.valorInmovilizado > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                  <p className="text-[11px] text-zinc-500">De ese total, capital parado (sin rotación):</p>
                  <p className="text-[12px] font-bold text-amber-400 tabular-nums">{CLP(stats.valorInmovilizado)}</p>
                </div>
              )}
            </Card>
          )}

          {/* Ecuación visual del resultado */}
          <Card className="p-5">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">
              ¿Cómo quedó el mes?
            </p>
            <div className="space-y-2">
              {/* Ventas */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-[13px] text-zinc-400">Ventas del mes</span>
                </div>
                <span className="text-[14px] font-bold text-white tabular-nums">{CLP(stats.totalVentas)}</span>
              </div>

              {/* Inversión mercadería — solo si fue ingresada manualmente */}
              {stats.costoVentas > 0 && parseInput(config.inversionMercaderia) > 0 && (
                <div className="flex items-center justify-between py-2 border-t border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <span className="text-[13px] text-zinc-400">Inversión en mercadería (facturas)</span>
                  </div>
                  <span className="text-[14px] font-bold text-red-400 tabular-nums">−{CLP(stats.costoVentas)}</span>
                </div>
              )}

              {/* Margen bruto */}
              {stats.margenBruto > 0 && (
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div>
                    <span className="text-[13px] font-semibold text-white">Margen bruto</span>
                    <span className="text-[11px] text-zinc-500 ml-2">
                      {parseInput(config.inversionMercaderia) > 0
                        ? `(${PCT(stats.margenBruto)} sobre ventas)`
                        : `(${PCT(stats.margenBruto)} estimado por ti)`
                      }
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-emerald-400 tabular-nums">
                    {CLP(Math.round(stats.totalVentas * stats.margenBruto / 100))}
                  </span>
                </div>
              )}

              {/* Gastos fijos */}
              {stats.totalGastos > 0 && (
                <div className="flex items-center justify-between py-2 border-t border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                    <span className="text-[13px] text-zinc-400">Gastos fijos del mes</span>
                    <span className="text-[11px] text-zinc-700">({gastos.length} ítems)</span>
                  </div>
                  <span className="text-[14px] font-bold text-violet-400 tabular-nums">−{CLP(stats.totalGastos)}</span>
                </div>
              )}

              {/* Resultado final — destacado */}
              <div className={`flex items-center justify-between py-3 px-4 rounded-xl border-2 mt-2 ${
                stats.resultadoOperacional >= 0
                  ? 'bg-emerald-500/[0.08] border-emerald-500/[0.30]'
                  : 'bg-red-500/[0.08] border-red-500/[0.30]'
              }`}>
                <div>
                  <span className="text-[14px] font-bold text-white">
                    {stats.resultadoOperacional >= 0 ? '✅ Resultado del mes' : '❌ Resultado del mes'}
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {stats.resultadoOperacional >= 0
                      ? 'Lo que sobró después de descontar costo de productos y gastos del negocio'
                      : 'Los gastos y costos superaron las ventas — revisar en pestaña Gastos'}
                  </p>
                  {stats.costoVentas === 0 && stats.totalGastos === 0 && (
                    <p className="text-[11px] text-amber-500/80 mt-0.5">Ingresa inversión y gastos para ver el resultado real</p>
                  )}
                </div>
                <span className={`text-[20px] font-black tabular-nums ${
                  stats.resultadoOperacional >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {stats.resultadoOperacional >= 0 ? '' : '−'}{CLP(Math.abs(stats.resultadoOperacional))}
                </span>
              </div>

              {/* Punto de equilibrio */}
              {(stats.puntoEquilibrio || stats.equilibrioSinMargen) && (
                <div className="mt-3 pt-3 border-t border-white/[0.05]">
                  {stats.equilibrioSinMargen ? (
                    <div className="rounded-lg bg-orange-500/[0.08] border border-orange-500/[0.20] p-3">
                      <p className="text-[11px] font-semibold text-orange-400 mb-1">Margen insuficiente para calcular PE</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        El margen bruto actual es {(stats.margenBrutoDecimal * 100).toFixed(1)}% — demasiado bajo para cubrir los gastos fijos.
                        Esto ocurre cuando la inversión en mercadería es alta respecto a las ventas del mes.
                        Para mejorar: aumentar precios de venta, rotar más stock o reducir la inversión del período.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-zinc-600">Ventas mínimas para cubrir todos los gastos</span>
                        <span className="text-[12px] font-bold text-zinc-400 tabular-nums">{CLP(stats.puntoEquilibrio)}</span>
                      </div>
                      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${stats.totalVentas >= stats.puntoEquilibrio ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (stats.totalVentas / stats.puntoEquilibrio) * 100).toFixed(0)}%` }}
                        />
                      </div>
                      <p className={`text-[11px] mt-1.5 font-medium ${stats.totalVentas >= stats.puntoEquilibrio ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {stats.totalVentas >= stats.puntoEquilibrio
                          ? `✓ Superado — vendiste ${CLP(stats.totalVentas - stats.puntoEquilibrio)} más de lo necesario`
                          : `Faltan ${CLP(stats.puntoEquilibrio - stats.totalVentas)} para cubrir todos los gastos`
                        }
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Gráfico 6 meses + Top productos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Comparativa 6 meses */}
            <Card className="p-5">
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Ventas — últimos 6 meses</p>
              <p className="text-[11px] text-zinc-700 mb-4">El mes resaltado es el seleccionado</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={stats.comparativa6Meses} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                  <XAxis dataKey="mes" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px', color: '#a1a1aa' }}
                    formatter={(v) => [CLP(v), 'Ventas']}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {stats.comparativa6Meses.map((entry, i) => (
                      <Cell key={i} fill={entry.isSelected ? '#3b82f6' : 'rgba(255,255,255,0.07)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Punto de equilibrio visual */}
              {stats.totalVentas > 0 && (stats.puntoEquilibrio || stats.equilibrioSinMargen) && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Punto de equilibrio</p>
                  {stats.equilibrioSinMargen ? (
                    <p className="text-[11px] text-orange-400">
                      Margen {(stats.margenBrutoDecimal * 100).toFixed(1)}% — no es posible calcular el PE con margen menor al 10%. Rotá más stock para mejorar el margen del mes.
                    </p>
                  ) : (
                    <>
                      <div className="relative h-4 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${stats.totalVentas >= stats.puntoEquilibrio ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (stats.totalVentas / stats.puntoEquilibrio) * 100).toFixed(1)}%` }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                          style={{ left: '100%', transform: 'translateX(-1px)' }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] text-zinc-500">
                          {stats.totalVentas >= stats.puntoEquilibrio
                            ? <span className="text-emerald-400">✓ Superado por {CLP(stats.totalVentas - stats.puntoEquilibrio)}</span>
                            : <span className="text-amber-400">Faltan {CLP(stats.puntoEquilibrio - stats.totalVentas)} para cubrir gastos</span>
                          }
                        </span>
                        <span className="text-[11px] text-zinc-600">Meta: {CLP(stats.puntoEquilibrio)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>

            {/* Top 8 productos */}
            <Card className="p-5">
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">Top productos — {mesActual}</p>
              {stats.topProductos.length === 0 ? (
                <p className="text-zinc-600 text-[13px] text-center py-6">Sin ventas este mes</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.topProductos.map((p, i) => {
                    const maxTotal = stats.topProductos[0]?.total || 1;
                    const pct = Math.round((p.total / maxTotal) * 100);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-zinc-600 w-4 shrink-0">{i + 1}</span>
                            <span className="text-[12px] text-zinc-300 truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[11px] text-zinc-500">{p.qty} un</span>
                            <span className="text-[12px] font-semibold text-white tabular-nums">{CLP(p.total)}</span>
                          </div>
                        </div>
                        <div className="h-1 bg-white/[0.04] rounded-full">
                          <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── INVENTARIO — Panel unificado con tabs y búsqueda ── */}
          <InventarioPanel stats={stats} />

          {/* Top clientes */}
          {stats.topClientes.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">{stats.topLabel} — {mesActual}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.topClientes.map((c, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? 'bg-amber-500/[0.06] border-amber-500/[0.20]' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-zinc-500'}`}>
                      #{i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white truncate">{c.name}</p>
                      <p className="text-[11px] text-zinc-500">{c.count} compra{c.count !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-[13px] font-bold text-white tabular-nums shrink-0">{CLP(c.total)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: CLIENTES ── */}
      {activeTab === 'clientes' && (
        <div className="space-y-4">

          {!selectedCliente && (
            <div className="flex items-center gap-2">
              <button onClick={exportarClientesPDF} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportarClientesExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          )}

          {selectedCliente ? (
            /* ── Vista detalle de un cliente ── */
            <div className="space-y-4">
              {/* Header cliente */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedCliente(null); setClienteExits([]); }}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[15px] font-bold text-white truncate">{selectedCliente.nombre}</h2>
                  {selectedCliente.rut && <p className="text-[11px] text-zinc-600">RUT: {selectedCliente.rut}</p>}
                </div>
              </div>

              {/* KPIs del cliente */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total histórico', value: CLP(selectedCliente.totalHistorico), color: 'text-white' },
                  { label: 'Compras totales', value: String(selectedCliente.compras), color: 'text-blue-400' },
                  { label: 'Ticket promedio', value: CLP(Math.round(selectedCliente.totalHistorico / (selectedCliente.compras || 1))), color: 'text-violet-400' },
                  { label: 'Este mes', value: CLP(selectedCliente.totalMes), color: 'text-emerald-400' },
                ].map((k, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                    <p className="text-[10px] text-zinc-600 mb-1">{k.label}</p>
                    <p className={`text-[15px] font-bold tabular-nums ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Historial de ventas */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-3.5 h-3.5 text-zinc-500" />
                    <CardTitle>Historial de compras</CardTitle>
                    <span className="ml-auto text-[11px] text-zinc-600">{clienteExits.length} ventas</span>
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  {loadingClienteExits ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                    </div>
                  ) : clienteExits.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-zinc-600 text-[13px]">Sin ventas registradas</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {clienteExits.map((exit, i) => {
                        const fecha = exit.createdAt instanceof Date
                          ? exit.createdAt
                          : exit.createdAt?.toDate?.() || new Date();
                        const diasAtras = Math.floor((new Date() - fecha) / (1000 * 60 * 60 * 24));
                        const fechaLabel = diasAtras === 0 ? 'Hoy' : diasAtras === 1 ? 'Ayer' : `hace ${diasAtras} días`;

                        return (
                          <div key={exit.id || i} className="px-5 py-4">
                            {/* Cabecera de la venta */}
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-[13px] font-semibold text-white">
                                  {fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-[11px] text-zinc-600">
                                  {fechaLabel} · {exit.products?.length || 0} producto{(exit.products?.length || 0) !== 1 ? 's' : ''}
                                  {exit.paymentMethodLabel && ` · ${exit.paymentMethodLabel}`}
                                </p>
                              </div>
                              <p className="text-[15px] font-bold text-white tabular-nums">{CLP(exit.totalValue || 0)}</p>
                            </div>

                            {/* Detalle de productos */}
                            {exit.products?.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {exit.products.map((p, j) => (
                                  <div key={j} className="flex items-center justify-between text-[12px]">
                                    <span className="text-zinc-400 truncate flex-1">{p.productName || p.name}</span>
                                    <div className="flex items-center gap-3 shrink-0 ml-2">
                                      <span className="text-zinc-600">x{p.quantity}</span>
                                      <span className="text-zinc-300 tabular-nums w-20 text-right">{CLP(p.totalValue || 0)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          ) : (
            /* ── Vista ranking de clientes ── */
            <>
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  value={clienteSearch}
                  onChange={e => setClienteSearch(e.target.value)}
                  placeholder="Buscar cliente por nombre o RUT..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors"
                />
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Clientes únicos', value: stats.rankingClientes?.length || 0 },
                  { label: 'Con compra este mes', value: stats.rankingClientes?.filter(c => c.comprasMes > 0).length || 0 },
                  { label: 'Sin compra este mes', value: stats.rankingClientes?.filter(c => c.comprasMes === 0).length || 0 },
                ].map((k, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                    <p className="text-[10px] text-zinc-600 mb-0.5">{k.label}</p>
                    <p className="text-[18px] font-bold text-white">{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Ranking */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Ranking por volumen histórico</CardTitle>
                    <span className="text-[11px] text-zinc-600">{stats.rankingClientes?.length || 0} clientes</span>
                  </div>
                </CardHeader>
                <CardContent className="px-0">
                  {!stats.rankingClientes?.length ? (
                    <div className="text-center py-8">
                      <Users className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-zinc-600 text-[13px]">Sin ventas asociadas a clientes</p>
                      <p className="text-zinc-700 text-[11px] mt-1">Las ventas se asocian al registrarlas desde el perfil del cliente</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {(stats.rankingClientes || [])
                        .filter(c => !clienteSearch || c.nombre?.toLowerCase().includes(clienteSearch.toLowerCase()) || c.rut?.includes(clienteSearch))
                        .map((cliente, i) => {
                          const diasDesdeUltima = cliente.ultimaCompra
                            ? Math.floor((new Date() - cliente.ultimaCompra) / (1000 * 60 * 60 * 24))
                            : null;
                          const ticketPromedio = Math.round(cliente.totalHistorico / (cliente.compras || 1));

                          return (
                            <motion.div
                              key={cliente.rut || cliente.nombre}
                              whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                              onClick={() => loadClienteExits(cliente)}
                              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors"
                            >
                              {/* Posición */}
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                i === 0 ? 'bg-amber-500/20 text-amber-400' :
                                i === 1 ? 'bg-zinc-400/20 text-zinc-400' :
                                i === 2 ? 'bg-orange-600/20 text-orange-500' :
                                'bg-white/[0.04] text-zinc-600'
                              }`}>
                                {i + 1}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-medium text-white truncate">{cliente.nombre}</p>
                                  {cliente.comprasMes > 0 && (
                                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                                      {cliente.comprasMes} este mes
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[11px] text-zinc-600">{cliente.compras} compras</span>
                                  <span className="text-[11px] text-zinc-700">·</span>
                                  <span className="text-[11px] text-zinc-600">Ticket: {CLP(ticketPromedio)}</span>
                                  {diasDesdeUltima !== null && (
                                    <>
                                      <span className="text-[11px] text-zinc-700">·</span>
                                      <span className={`text-[11px] ${diasDesdeUltima > 30 ? 'text-amber-500' : 'text-zinc-600'}`}>
                                        {diasDesdeUltima === 0 ? 'Hoy' : diasDesdeUltima === 1 ? 'Ayer' : `hace ${diasDesdeUltima}d`}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Total + flecha */}
                              <div className="text-right shrink-0">
                                <p className="text-[14px] font-bold text-white tabular-nums">{CLP(cliente.totalHistorico)}</p>
                                {cliente.totalMes > 0 && (
                                  <p className="text-[11px] text-emerald-400 tabular-nums">{CLP(cliente.totalMes)} mes</p>
                                )}
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-700 shrink-0 ml-1" />
                            </motion.div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── TAB: PLAN DE ACCIÓN ── */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          {(stats.sinMovimiento?.length || 0) === 0 ? (
            <Card className="p-10 text-center">
              <Zap className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">¡Todo el stock está rotando!</p>
              <p className="text-zinc-500 text-[13px]">No hay productos parados en este período.</p>
            </Card>
          ) : (
            <StockParadoPanel
              productos={stats.sinMovimiento || []}
              valorTotal={stats.valorInmovilizado || 0}
              stockPlan={stockPlan}
              setStockPlan={setStockPlan}
              stockSearch={stockSearch}
              setStockSearch={setStockSearch}
              onGenerarRecs={async () => {
                setAddingStockRecs(true);
                try {
                  const conPlan = (stats.sinMovimiento || []).filter(p => stockPlan[p.id]?.estrategia);
                  if (conPlan.length === 0) return;

                  // Llamar a IA para generar recomendaciones elaboradas
                  const resumen = conPlan.map(p => {
                    const plan = stockPlan[p.id];
                    const valor = (p.stock || 0) * (p.ppp || 0);
                    const precioLiq = parseFloat(plan.precioLiquidacion || 0);
                    return `${p.name}: ${p.stock} un, costo ${CLP(p.ppp || 0)}, valor ${CLP(valor)}, estrategia: ${plan.estrategia}${precioLiq > 0 ? `, precio liquidación: ${CLP(precioLiq)}` : ''}`;
                  }).join('\n');

                  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'https://api.bodestock.cl';
                  let nuevasRecs = [];

                  try {
                    const resp = await fetch(`${backendUrl}/api/assistant/generate-report`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        prompt: `Eres un consultor de negocios. Genera recomendaciones concretas y directas (máximo 2 líneas cada una) para estos productos con stock parado en una distribuidora chilena:\n\n${resumen}\n\nResponde SOLO un JSON: {"recomendaciones": ["rec1", "rec2", ...]} — una por producto, en español informal, con números específicos.`,
                        empresa: company?.name,
                        mes: mesActual,
                      }),
                    });
                    if (resp.ok) {
                      const data = await resp.json();
                      const match = (data.content || '').match(/\{[\s\S]*\}/);
                      if (match) {
                        const parsed = JSON.parse(match[0]);
                        nuevasRecs = parsed.recomendaciones || [];
                      }
                    }
                  } catch {}

                  // Fallback local si IA falla
                  if (nuevasRecs.length === 0) {
                    nuevasRecs = conPlan.map(p => {
                      const plan = stockPlan[p.id];
                      const valor = (p.stock || 0) * (p.ppp || 0);
                      const precioLiq = parseFloat(plan.precioLiquidacion || 0);
                      if (plan.estrategia === 'liquidar' && precioLiq > 0)
                        return `Liquidar "${p.name}" (${p.stock} un) a ${CLP(precioLiq)} — recuperas ${CLP((p.stock || 0) * precioLiq)} esta semana`;
                      if (plan.estrategia === 'devolver')
                        return `Devolver "${p.name}" al proveedor (${p.stock} un) — recuperas ${CLP(valor)} en crédito`;
                      return `Crear promoción con "${p.name}" (${p.stock} un en stock) para liquidar antes de fin de mes`;
                    }).filter(Boolean);
                  }

                  if (nuevasRecs.length > 0) {
                    setRecomendaciones(prev => [...prev.filter(r => r.trim()), ...nuevasRecs]);
                    setActiveTab('reporte');
                  }
                } finally {
                  setAddingStockRecs(false);
                }
              }}
              addingRecs={addingStockRecs}
              onAnalizar={analizarStockConIA}
              analizando={analizandoIA}
              analisisIA={analisisIA}
              onExportarPDF={exportarPlanPDF}
              onExportarExcel={exportarPlanExcel}
            />
          )}
        </div>
      )}

      {/* ── TAB: GASTOS ── */}
      {activeTab === 'gastos' && (
        <div className="space-y-4">

          <div className="flex items-center gap-2">
            <button onClick={exportarGastosPDF} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.09] transition-all">
              <Download className="w-4 h-4" /> PDF
            </button>
            <button onClick={exportarGastosExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.09] transition-all">
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>

          {/* Costo de mercadería — selector de método */}
          <Card className="p-5">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">
              Costo de mercadería — {mesActual}
            </p>
            <p className="text-[12px] text-zinc-500 mb-4">
              Elige cómo calcular el costo. Solo uno aplica a la vez.
            </p>

            {/* Opción A — Inversión real */}
            <div className={`rounded-xl border p-4 mb-3 transition-all ${
              parseInput(config.inversionMercaderia) > 0
                ? 'border-emerald-500/[0.30] bg-emerald-500/[0.05]'
                : 'border-white/[0.08] bg-white/[0.02]'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, margenPromedio: '', usarMargenReal: false }))}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer bg-transparent ${
                    parseInput(config.inversionMercaderia) > 0
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-zinc-600'
                  }`}>
                  {parseInput(config.inversionMercaderia) > 0 && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
                <p className="text-[13px] font-semibold text-white">Opción A — Inversión real en facturas</p>
                <span className="text-[10px] text-emerald-400 font-bold ml-auto">MÁS PRECISO</span>
              </div>
              <p className="text-[11px] text-zinc-600 mb-3 ml-0 sm:ml-6">
                Suma todas las facturas de proveedores del mes y escribe el total
              </p>

              {/* Inversión calculada automáticamente desde ingresos */}
              {stats.inversionCalculada > 0 && (
                <div className="ml-0 sm:ml-6 mb-3 flex items-center gap-3 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.15]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-emerald-400 font-semibold">📦 Calculado desde ingresos de inventario</p>
                    <p className="text-[18px] font-black text-white tabular-nums">{CLP(stats.inversionCalculada)}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Suma de todos los ingresos registrados en {mesActual}</p>
                  </div>
                  <button
                    onClick={() => setConfig(c => ({ ...c, inversionMercaderia: String(stats.inversionCalculada), margenPromedio: '' }))}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer border-none"
                  >
                    Usar este valor
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 ml-0 sm:ml-6">
                <div className="relative w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[13px]">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={config.inversionMercaderia ? fmtInput(config.inversionMercaderia) : ''}
                    onChange={e => {
                      const val = String(parseInput(e.target.value));
                      setConfig(c => ({ ...c, inversionMercaderia: val, margenPromedio: val !== '0' ? '' : c.margenPromedio }));
                    }}
                    placeholder="Ej: 8.000.000"
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] font-bold focus:outline-none focus:border-emerald-500/50 transition-colors tabular-nums"
                  />
                </div>
                {parseInput(config.inversionMercaderia) > 0 && (
                  <button
                    onClick={() => setConfig(c => ({ ...c, inversionMercaderia: '0' }))}
                    className="text-zinc-600 hover:text-red-400 transition-colors text-[11px] underline cursor-pointer bg-transparent border-none"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Opción B — Margen % */}
            <div className={`rounded-xl border p-4 transition-all ${
              parseInput(config.inversionMercaderia) === 0 && parseFloat(config.margenPromedio) > 0
                ? 'border-violet-500/[0.30] bg-violet-500/[0.05]'
                : 'border-white/[0.08] bg-white/[0.02]'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  parseInput(config.inversionMercaderia) === 0 && parseFloat(config.margenPromedio) > 0
                    ? 'border-violet-500 bg-violet-500'
                    : 'border-zinc-600'
                }`}>
                  {parseInput(config.inversionMercaderia) === 0 && parseFloat(config.margenPromedio) > 0 && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <p className="text-[13px] font-semibold text-white">Opción B — Margen % estimado</p>
                <span className="text-[10px] text-zinc-500 font-bold ml-auto">ESTIMADO</span>
              </div>
              <p className="text-[11px] text-zinc-600 mb-3 ml-0 sm:ml-6">
                Pregúntale al cliente: "¿Cuánto ganas de cada $100 que vendes?" Solo aplica si Opción A está en $0
              </p>
              <div className="flex items-center gap-2 ml-0 sm:ml-6">
                <div className="relative w-28">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={config.margenPromedio}
                    onChange={e => setConfig(c => ({ ...c, margenPromedio: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder="Ej: 20"
                    disabled={parseInput(config.inversionMercaderia) > 0}
                    className="w-full pl-3 pr-8 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] font-bold focus:outline-none focus:border-violet-500/50 transition-colors tabular-nums disabled:opacity-30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[13px]">%</span>
                </div>
                {parseInput(config.inversionMercaderia) > 0 && (
                  <span className="text-[11px] text-zinc-600">Limpia la Opción A para usar esto</span>
                )}
              </div>
            </div>

            {/* Opción C — Margen real desde precio de venta cargado en productos */}
            <div className={`rounded-xl border p-4 transition-all mt-3 ${
              config.usarMargenReal && stats.coberturaMargenReal >= 50
                ? 'border-emerald-500/[0.30] bg-emerald-500/[0.05]'
                : 'border-white/[0.08] bg-white/[0.02]'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => stats.coberturaMargenReal >= 50 && setConfig(c => ({ ...c, usarMargenReal: !c.usarMargenReal }))}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    config.usarMargenReal && stats.coberturaMargenReal >= 50 ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'
                  } ${stats.coberturaMargenReal < 50 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {config.usarMargenReal && stats.coberturaMargenReal >= 50 && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
                <p className="text-[13px] font-semibold text-white">Opción C — Margen real por producto</p>
                <span className="text-[10px] text-emerald-400 font-bold ml-auto">MÁS PRECISO</span>
              </div>
              <p className="text-[11px] text-zinc-600 mb-3 ml-0 sm:ml-6">
                Calculado automáticamente usando el costo y precio de venta cargado en cada producto del inventario
              </p>
              <div className="ml-0 sm:ml-6 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stats.coberturaMargenReal >= 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, stats.coberturaMargenReal)}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-zinc-400 tabular-nums shrink-0">
                  {stats.coberturaMargenReal.toFixed(0)}% de productos con precio cargado
                </span>
              </div>
              {stats.coberturaMargenReal < 50 ? (
                <p className="text-[11px] text-amber-400 mt-2 ml-0 sm:ml-6">
                  Necesitas cargar el precio de venta en más productos para activar esta opción (mínimo 50%)
                </p>
              ) : (
                <p className="text-[11px] text-emerald-400 mt-2 ml-0 sm:ml-6 font-semibold">
                  Margen real calculado: {stats.margenRealCalculado.toFixed(1)}%
                </p>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <Button onClick={saveConfig} disabled={savingConfig} className="gap-1.5">
                {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar cambios
              </Button>
            </div>
          </Card>

          <Card className="p-5" data-gasto-form>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
                {editandoGastoId ? '✏️ Editando gasto' : `Agregar gasto — ${mesActual}`}
              </p>
              {editandoGastoId && (
                <button
                  onClick={() => { setEditandoGastoId(null); setNuevoGasto({ tipo: 'arriendo', descripcion: '', monto: '', banco: '', cuotaActual: '', cuotaTotal: '', comisionVendedor: '', comisionPct: 3 }); }}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors border-none bg-transparent cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 mb-3">
              <select
                value={nuevoGasto.tipo}
                onChange={e => setNuevoGasto(f => ({ ...f, tipo: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors"
              >
                {GASTO_TIPOS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>

              {/* Campos extra para comisión vendedor */}
              {nuevoGasto.tipo === 'comision_vendedor' && (() => {
                const vendedores = Object.entries(stats.ventasPorVendedor || {}).sort((a, b) => b[1] - a[1]);
                const pct = parseFloat(nuevoGasto.comisionPct || 3);
                const vendedorSel = nuevoGasto.comisionVendedor || '';
                const ventasVendedor = stats.ventasPorVendedor?.[vendedorSel] || 0;
                const montoCalc = Math.round(ventasVendedor * pct / 100);
                return (
                  <div className="space-y-2 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.15]">
                    <p className="text-[11px] text-emerald-400 font-semibold">🤝 Comisión por ventas</p>
                    <select
                      value={vendedorSel}
                      onChange={e => {
                        const vend = e.target.value;
                        const ventas = stats.ventasPorVendedor?.[vend] || 0;
                        const monto = Math.round(ventas * pct / 100);
                        setNuevoGasto(f => ({ ...f, comisionVendedor: vend, descripcion: `Comisión ${pct}% — ${vend}`, monto: String(monto) }));
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-emerald-500/40 transition-colors"
                    >
                      <option value="">— Selecciona vendedor —</option>
                      {vendedores.map(([nombre, total]) => (
                        <option key={nombre} value={nombre}>{nombre} — {CLP(total)} en ventas</option>
                      ))}
                    </select>
                    <div className="flex gap-2 items-center">
                      <div className="relative w-28">
                        <input
                          type="number"
                          min="0.1"
                          max="50"
                          step="0.5"
                          value={nuevoGasto.comisionPct ?? 3}
                          onChange={e => {
                            const p = parseFloat(e.target.value) || 0;
                            const monto = Math.round(ventasVendedor * p / 100);
                            setNuevoGasto(f => ({ ...f, comisionPct: e.target.value, monto: vendedorSel ? String(monto) : f.monto }));
                          }}
                          className="w-full px-3 pr-7 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-emerald-500/40 transition-colors"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-[13px]">%</span>
                      </div>
                      {vendedorSel && (
                        <p className="text-[12px] text-emerald-400 font-semibold">
                          = {CLP(montoCalc)} sobre {CLP(ventasVendedor)} en ventas
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Campos extra para crédito bancario */}
              {nuevoGasto.tipo === 'credito_bancario' && (
                <div className="space-y-2 p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/[0.15]">
                  <p className="text-[11px] text-blue-400 font-semibold">🏦 Datos del crédito</p>
                  <input
                    value={nuevoGasto.banco}
                    onChange={e => setNuevoGasto(f => ({ ...f, banco: e.target.value }))}
                    placeholder="Nombre del banco (ej: BancoEstado)"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={nuevoGasto.cuotaActual}
                      onChange={e => setNuevoGasto(f => ({ ...f, cuotaActual: e.target.value }))}
                      placeholder="Cuota N°"
                      className="w-1/2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                    />
                    <input
                      type="number"
                      min="1"
                      value={nuevoGasto.cuotaTotal}
                      onChange={e => setNuevoGasto(f => ({ ...f, cuotaTotal: e.target.value }))}
                      placeholder="Total cuotas"
                      className="w-1/2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                    />
                  </div>
                </div>
              )}

              <input
                value={nuevoGasto.descripcion}
                onChange={e => setNuevoGasto(f => ({ ...f, descripcion: e.target.value }))}
                placeholder={nuevoGasto.tipo === 'credito_bancario' ? 'Descripción (ej: Crédito capital de trabajo)' : nuevoGasto.tipo === 'imposiciones' ? 'Descripción (ej: Imposiciones Juan Pérez)' : 'Descripción (opcional)'}
                className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors"
              />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[13px]">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nuevoGasto.monto ? fmtInput(nuevoGasto.monto) : ''}
                    onChange={e => setNuevoGasto(f => ({ ...f, monto: String(parseInput(e.target.value)) }))}
                    onKeyDown={e => e.key === 'Enter' && saveGasto()}
                    placeholder="Ej: 350.000"
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors tabular-nums"
                  />
                </div>
                <Button onClick={saveGasto} disabled={savingGasto || !nuevoGasto.monto} className="gap-1.5 shrink-0">
                  {savingGasto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editandoGastoId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {editandoGastoId ? 'Guardar' : 'Agregar'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Lista de gastos */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">Gastos registrados — {mesActual}</p>
              <div className="flex items-center gap-2">
                {gastos.length > 0 && (
                  <p className="text-sm font-bold text-white tabular-nums">{CLP(gastos.reduce((s, g) => s + (g.monto || 0), 0))}</p>
                )}
                {/* Botón copiar mes anterior */}
                <button
                  onClick={abrirPanelGastosAnteriores}
                  disabled={cargandoAnteriores}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {cargandoAnteriores
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : gastosCopiadosOk
                      ? <span>✓ Copiados</span>
                      : <><Copy className="w-3 h-3" /> Copiar del mes anterior</>
                  }
                </button>
              </div>
            </div>
            {/* Panel selección gastos mes anterior */}
            {gastosAnterioresPanel !== null && (
              <div className="mt-3 rounded-2xl border border-white/[0.10] bg-white/[0.03] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[12px] font-semibold text-white">Seleccioná los gastos a copiar</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGastosAnterioresSeleccion(new Set(gastosAnterioresPanel.map(g => g.id)))}
                      className="text-[11px] text-violet-400 hover:text-violet-300 cursor-pointer bg-transparent border-none"
                    >Todos</button>
                    <span className="text-zinc-700">·</span>
                    <button
                      onClick={() => setGastosAnterioresSeleccion(new Set())}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer bg-transparent border-none"
                    >Ninguno</button>
                  </div>
                </div>
                {gastosAnterioresPanel.length === 0 ? (
                  <p className="text-zinc-600 text-[12px] text-center py-5">Sin gastos en el mes anterior</p>
                ) : (
                  <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                    {gastosAnterioresPanel.map(g => {
                      const tipo = GASTO_TIPOS.find(t => t.id === g.tipo);
                      const sel = gastosAnterioresSeleccion.has(g.id);
                      return (
                        <label key={g.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors">
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => {
                              const next = new Set(gastosAnterioresSeleccion);
                              sel ? next.delete(g.id) : next.add(g.id);
                              setGastosAnterioresSeleccion(next);
                            }}
                            className="accent-violet-500 w-4 h-4 shrink-0"
                          />
                          <span className="text-base shrink-0">{tipo?.icon || '📋'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-white">{tipo?.label || g.tipo}</p>
                            {g.descripcion && <p className="text-[11px] text-zinc-500 truncate">{g.descripcion}</p>}
                          </div>
                          <span className="text-[12px] font-bold text-white tabular-nums shrink-0">{CLP(g.monto)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => { setGastosAnterioresPanel(null); setGastosAnterioresSeleccion(new Set()); }}
                    className="text-[12px] text-zinc-500 hover:text-zinc-300 cursor-pointer bg-transparent border-none"
                  >Cancelar</button>
                  <button
                    onClick={confirmarCopiaGastos}
                    disabled={copiandoGastos || gastosAnterioresSeleccion.size === 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[12px] font-semibold hover:bg-violet-500/30 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {copiandoGastos ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    Copiar {gastosAnterioresSeleccion.size} gasto{gastosAnterioresSeleccion.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}

            {gastos.length === 0 ? (
              <p className="text-zinc-600 text-[13px] text-center py-6">Sin gastos registrados este mes</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {gastos.map(g => {
                  const tipo = GASTO_TIPOS.find(t => t.id === g.tipo);
                  return (
                    <div key={g.id} className="flex items-center gap-3 py-3 group">
                      <span className="text-lg shrink-0">{tipo?.icon || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white">{tipo?.label || g.tipo}</p>
                        {g.tipo === 'comision_vendedor' && g.comisionVendedor && (
                          <p className="text-[11px] text-emerald-400">
                            {g.comisionVendedor}{g.comisionPct ? ` · ${g.comisionPct}%` : ''}
                          </p>
                        )}
                        {g.banco && (
                          <p className="text-[11px] text-blue-400">
                            {g.banco}{g.cuotaActual && g.cuotaTotal ? ` · cuota ${g.cuotaActual}/${g.cuotaTotal}` : ''}
                          </p>
                        )}
                        {g.descripcion && <p className="text-[11px] text-zinc-500">{g.descripcion}</p>}
                      </div>
                      <p className="text-[14px] font-bold text-white tabular-nums shrink-0">{CLP(g.monto)}</p>
                      <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={() => {
                            setEditandoGastoId(g.id);
                            setNuevoGasto({ tipo: g.tipo, descripcion: g.descripcion || '', monto: String(g.monto), banco: g.banco || '', cuotaActual: g.cuotaActual || '', cuotaTotal: g.cuotaTotal || '', comisionVendedor: g.comisionVendedor || '', comisionPct: g.comisionPct ?? 3 });
                            setTimeout(() => document.querySelector('[data-gasto-form]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-blue-400 hover:bg-blue-500/[0.08] transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('¿Eliminar este gasto?')) deleteGasto(g.id);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Rentabilidad */}
          {gastos.length > 0 && (
            <Card className="p-5">
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-4">Resumen rentabilidad — {mesActual}</p>
              <div className="space-y-3">
                {[
                  { label: 'Ventas del mes', value: stats.totalVentas, color: 'text-white' },
                  {
                    label: config.inversionMercaderia
                      ? 'Inversión en mercadería (facturas)'
                      : config.margenPromedio
                        ? `Costo estimado (${PCT(100 - parseFloat(config.margenPromedio || 0))})`
                        : 'Costo de mercadería (PPP sistema)',
                    value: -stats.costoVentas,
                    color: 'text-red-400'
                  },
                  { label: 'Margen bruto', value: stats.totalVentas - stats.costoVentas, color: 'text-emerald-400', bold: true, sub: PCT(stats.margenBruto) },
                  { label: 'Gastos fijos del mes', value: -stats.totalGastos, color: 'text-red-400' },
                  { label: 'Resultado operacional', value: stats.resultadoOperacional, color: stats.resultadoOperacional >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true },
                ].map((row, i) => (
                  <div key={i} className={`flex justify-between items-center ${row.bold ? 'pt-3 border-t border-white/[0.08]' : ''}`}>
                    <span className={`text-[13px] ${row.bold ? 'font-semibold text-white' : 'text-zinc-400'}`}>
                      {row.label}
                      {row.sub && <span className="ml-2 text-[11px] font-normal text-zinc-500">({row.sub})</span>}
                    </span>
                    <span className={`text-[13px] font-bold tabular-nums ${row.color}`}>
                      {row.value >= 0 ? '' : '-'}{CLP(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
                {stats.puntoEquilibrio && (
                  <div className="mt-3 p-3 rounded-xl bg-violet-500/[0.08] border border-violet-500/[0.20]">
                    <p className="text-[11px] text-violet-400 font-semibold mb-0.5">Punto de equilibrio</p>
                    <p className="text-[15px] font-bold text-white tabular-nums">{CLP(stats.puntoEquilibrio)}/mes</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Necesitas vender al menos esto para cubrir todos los gastos</p>
                  </div>
                )}
                {stats.equilibrioSinMargen && (
                  <div className="mt-3 p-3 rounded-xl bg-orange-500/[0.08] border border-orange-500/[0.20]">
                    <p className="text-[11px] text-orange-400 font-semibold mb-0.5">Margen muy bajo — PE no calculable</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                      El margen bruto es {(stats.margenBrutoDecimal * 100).toFixed(1)}%. Cuando la inversión en mercadería es alta respecto a las ventas del mes, el PE se dispara a valores irreales. Esto es normal en meses de reposición fuerte — el número se normalizará cuando el stock comience a rotar.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: REPORTE ── */}
      {activeTab === 'gastos' && (
        <Card className="p-5 mt-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">Facturas de proveedores</p>
              <p className="text-[12px] text-zinc-600 mt-0.5">Subidas por el cliente o por ti</p>
            </div>
            <div className="flex items-center gap-3">
              {facturas.length > 0 && (
                <span className="text-[11px] font-bold text-violet-400">{facturas.length} archivo{facturas.length !== 1 ? 's' : ''}</span>
              )}
              <div className="flex flex-col items-end gap-1">
                <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer transition-colors ${
                  uploadingFactura ? 'bg-violet-500/[0.10] text-violet-500 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'
                }`}>
                  {uploadingFactura ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Subir factura
                  <input type="file" accept="image/*,application/pdf" onChange={handleUploadFacturaAdmin} disabled={uploadingFactura} className="hidden" />
                </label>
                <span className="text-[10px] text-zinc-600">Se asigna a <span className="text-violet-400 font-semibold">{mesActual}</span></span>
              </div>
            </div>
          </div>

          {/* Total acumulado en facturas */}
          {facturas.length > 0 && (
            <div className="mb-4 p-4 rounded-xl bg-violet-500/[0.06] border border-violet-500/[0.20] flex items-center justify-between">
              <div>
                <p className="text-[11px] text-violet-400 font-semibold uppercase tracking-wide">Total en facturas</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Suma de todos los montos registrados</p>
              </div>
              <p className="text-2xl font-black text-white tabular-nums">
                {CLP(facturas.reduce((s, f) => s + (f.monto || 0), 0))}
              </p>
            </div>
          )}

          {loadingFacturas ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
            </div>
          ) : facturas.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-[13px] text-zinc-600">El cliente aún no ha subido facturas</p>
              <p className="text-[11px] text-zinc-700 mt-1">Aparecerán aquí cuando active Mi Consultor y las suba</p>
            </div>
          ) : (
            <div className="space-y-2">
              {facturas.map(f => {
                const fecha = f.creadoAt?.toDate?.()?.toLocaleDateString('es-CL') || '';
                const esPendiente = f.estado === 'pendiente';
                return (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/[0.10] border border-violet-500/[0.20] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">{f.fileName}</p>
                      <p className="text-[11px] text-zinc-600">{fecha} · {f.periodo}</p>
                    </div>

                    {/* Monto — click para editar */}
                    {editingMontoId === f.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          autoFocus
                          type="text"
                          inputMode="numeric"
                          value={montoTemp}
                          onChange={e => setMontoTemp(e.target.value.replace(/[^0-9.]/g, ''))}
                          onKeyDown={e => { if (e.key === 'Enter') guardarMontoFactura(f.id); if (e.key === 'Escape') setEditingMontoId(null); }}
                          placeholder="Monto"
                          className="w-24 px-2 py-1 rounded-lg bg-white/[0.06] border border-violet-500/[0.40] text-white text-[12px] text-right tabular-nums focus:outline-none"
                        />
                        <button onClick={() => guardarMontoFactura(f.id)} className="w-6 h-6 rounded-lg bg-emerald-500/[0.15] text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingMontoId(f.id); setMontoTemp(f.monto ? String(f.monto) : ''); }}
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-bold tabular-nums transition-colors ${
                          f.monto > 0 ? 'text-white hover:bg-white/[0.06]' : 'text-zinc-600 border border-dashed border-zinc-700 hover:border-zinc-500 hover:text-zinc-400'
                        }`}
                        title="Click para editar el monto"
                      >
                        {f.monto > 0 ? CLP(f.monto) : '+ Monto'}
                      </button>
                    )}

                    {/* Folio y RUT del proveedor — para el libro de compras */}
                    {editingDocId === f.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          autoFocus
                          type="text"
                          value={folioTemp}
                          onChange={e => setFolioTemp(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') guardarFolioYRutFactura(f.id); if (e.key === 'Escape') setEditingDocId(null); }}
                          placeholder="Folio"
                          className="w-16 px-2 py-1 rounded-lg bg-white/[0.06] border border-violet-500/[0.40] text-white text-[12px] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={rutTemp}
                          onChange={e => setRutTemp(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') guardarFolioYRutFactura(f.id); if (e.key === 'Escape') setEditingDocId(null); }}
                          placeholder="RUT proveedor"
                          className="w-24 px-2 py-1 rounded-lg bg-white/[0.06] border border-violet-500/[0.40] text-white text-[12px] focus:outline-none"
                        />
                        <button onClick={() => guardarFolioYRutFactura(f.id)} className="w-6 h-6 rounded-lg bg-emerald-500/[0.15] text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingDocId(f.id); setFolioTemp(f.folio || ''); setRutTemp(f.rut || ''); }}
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                          f.folio || f.rut ? 'text-zinc-300 hover:bg-white/[0.06]' : 'text-zinc-600 border border-dashed border-zinc-700 hover:border-zinc-500 hover:text-zinc-400'
                        }`}
                        title="Click para agregar folio y RUT del proveedor"
                      >
                        {f.folio || f.rut ? `${f.folio || '—'} · ${f.rut || '—'}` : '+ Folio/RUT'}
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Ver factura */}
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                        title="Ver factura"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>

                      {/* Confirmar — solo si está pendiente */}
                      {esPendiente && (
                        <button
                          onClick={() => confirmarFactura(f.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/[0.10] border border-emerald-500/[0.20] text-emerald-400 hover:bg-emerald-500/[0.20] transition-colors text-[10px] font-bold"
                          title="Marcar como revisada"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Confirmar
                        </button>
                      )}

                      {/* Badge estado */}
                      {!esPendiente && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/[0.10] border-emerald-500/[0.20]">
                          ✓ Confirmada
                        </span>
                      )}

                      {/* Eliminar */}
                      <button
                        onClick={() => eliminarFactura(f.id)}
                        className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: INVENTARIO ── */}
      {activeTab === 'inventario' && (() => {
        const [sy, sm] = selectedMonth.split('-').map(Number);
        const startOfMonth = new Date(sy, sm - 1, 1);
        const endOfMonth = new Date(sy, sm, 0, 23, 59, 59);

        // Recopilar todos los movimientos del history de productos
        const ingresos = [];
        const mermas = [];

        products.forEach(prod => {
          (prod.history || []).forEach(h => {
            const fecha = new Date(h.date);
            if (isNaN(fecha.getTime()) || fecha < startOfMonth || fecha > endOfMonth) return;
            const qty = Math.abs(h.qty || h.quantity || 0);
            const esSalida = h.type === 'shrinkage' || h.type === 'exit' || h.reason === 'SALE' || h.reason === 'sale';
            const esIngreso = h.type === 'entry' || h.type === 'purchase' || h.by === 'manual' || (!h.type && !esSalida);
            const entry = {
              producto: prod.name,
              unidad: prod.unit || 'u',
              fecha,
              qty,
              reason: h.reason || '',
              notes: h.notes || '',
              ppp: prod.ppp || 0,
              totalPrice: h.totalPrice || 0,
            };
            if (h.type === 'shrinkage') mermas.push({ ...entry, valor: qty * (prod.ppp || 0) });
            else if (esIngreso) ingresos.push(entry);
          });
        });

        // Ordenar más recientes primero
        ingresos.sort((a, b) => b.fecha - a.fecha);
        mermas.sort((a, b) => b.fecha - a.fecha);

        const totalMermas = mermas.reduce((s, m) => s + m.valor, 0);
        const totalInvertido = ingresos.reduce((s, h) => s + (h.totalPrice || 0), 0);

        return (
          <div className="space-y-4">

            <div className="flex items-center gap-2">
              <button onClick={exportarInventarioPDF} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportarInventarioExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.09] transition-all">
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>

            {/* Resumen inversión del mes */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Invertido en mercadería</p>
                <p className="text-[22px] font-black text-white tabular-nums">{CLP(totalInvertido)}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{ingresos.length} ingresos en {mesActual}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Costo de mermas</p>
                <p className="text-[22px] font-black text-orange-400 tabular-nums">{CLP(totalMermas)}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{mermas.length} merma{mermas.length !== 1 ? 's' : ''} en {mesActual}</p>
              </Card>
            </div>

            {/* Ingresos de mercadería */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Ingresos de mercadería</p>
                <span className="ml-auto text-[12px] text-zinc-500">{ingresos.length} movimiento{ingresos.length !== 1 ? 's' : ''}</span>
              </div>
              {ingresos.length === 0 ? (
                <p className="text-[13px] text-zinc-600 text-center py-6">Sin ingresos registrados en este período</p>
              ) : (
                <div className="space-y-2">
                  {ingresos.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{h.producto}</p>
                        <p className="text-[11px] text-zinc-500">
                          {h.fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-[13px] font-bold text-emerald-400">+{h.qty} {h.unidad}</p>
                        {h.totalPrice > 0 && <p className="text-[11px] text-zinc-500 tabular-nums">{CLP(h.totalPrice)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Mermas */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Mermas registradas</p>
                <span className="ml-auto text-[12px] text-zinc-500">{mermas.length} merma{mermas.length !== 1 ? 's' : ''}</span>
                {totalMermas > 0 && (
                  <span className="text-[12px] font-bold text-orange-400 ml-2">{CLP(totalMermas)} costo de mermas</span>
                )}
              </div>
              {mermas.length === 0 ? (
                <p className="text-[13px] text-zinc-600 text-center py-6">Sin mermas registradas en este período</p>
              ) : (
                <div className="space-y-2">
                  {mermas.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{h.producto}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-zinc-500">
                            {h.fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {h.reason && (
                            <span className="text-[10px] bg-orange-500/[0.15] text-orange-400 px-1.5 py-0.5 rounded-full border border-orange-500/[0.2]">
                              {h.reason}
                            </span>
                          )}
                        </div>
                        {h.notes && <p className="text-[11px] text-zinc-600 italic mt-0.5">{h.notes}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-[13px] font-bold text-orange-400">−{h.qty} {h.unidad}</p>
                        {h.valor > 0 && <p className="text-[11px] text-zinc-500">{CLP(h.valor)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {activeTab === 'reporte' && (
        <div className="space-y-4">

          {/* Resumen automático del mes */}
          <Card className="p-5">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Resumen del mes (auto)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Ventas', value: CLP(stats.totalVentas) },
                { label: 'Margen', value: PCT(stats.margenBruto) },
                { label: 'Resultado', value: CLP(stats.resultadoOperacional) },
                { label: 'Transacciones', value: stats.cantVentas },
              ].map((k, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                  <p className="text-[11px] text-zinc-600 mb-1">{k.label}</p>
                  <p className="text-[15px] font-bold text-white tabular-nums">{k.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Tipo de reporte */}
          <Card className="p-4">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Tipo de reporte</p>
            <div className="flex gap-2">
              {[
                { id: 'semanal', label: '📅 Semanal', desc: 'Resumen rápido de la semana' },
                { id: 'mensual', label: '📊 Mensual', desc: 'Análisis completo del mes' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTipoReporte(t.id)}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    tipoReporte === t.id
                      ? 'border-violet-500/50 bg-violet-500/[0.10] text-white'
                      : 'border-white/[0.08] bg-white/[0.02] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <p className="text-[13px] font-semibold">{t.label}</p>
                  <p className="text-[11px] mt-0.5 opacity-70">{t.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Botón generar con IA */}
          <button
            onClick={generarConIA}
            disabled={generandoIA}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-dashed transition-all font-semibold text-[14px] ${
              generandoIA
                ? 'border-violet-500/30 bg-violet-500/[0.05] text-violet-400 cursor-not-allowed'
                : 'border-violet-500/40 bg-violet-500/[0.05] text-violet-400 hover:bg-violet-500/[0.10] hover:border-violet-500/60 cursor-pointer'
            }`}
          >
            {generandoIA ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generando análisis con IA...</>
            ) : (
              <>
                <span className="text-lg">✨</span>
                Generar reporte completo con IA
                <span className="text-[11px] font-normal text-violet-500/70">— observaciones, recomendaciones y objetivos</span>
              </>
            )}
          </button>

          {/* Observaciones del consultor */}
          <Card className="p-5">
            <label className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest block mb-2">
              Observaciones del consultor
            </label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Haz clic en ✨ para generar con IA, o escribe tu análisis aquí..."
              rows={5}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors resize-none leading-relaxed"
            />
          </Card>

          {/* Recomendaciones */}
          <Card className="p-5">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Recomendaciones para el cliente</p>
            <div className="space-y-2">
              {recomendaciones.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-zinc-600 text-[13px] shrink-0">{i + 1}.</span>
                  <input
                    value={r}
                    onChange={e => setRecomendaciones(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                    placeholder="Ej: Reponer stock de jabón líquido antes del viernes"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors"
                  />
                  {recomendaciones.length > 1 && (
                    <button onClick={() => setRecomendaciones(prev => prev.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setRecomendaciones(prev => [...prev, ''])}
                className="text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 mt-1 bg-transparent border-none cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Agregar recomendación
              </button>
            </div>
          </Card>

          {/* Objetivos */}
          <Card className="p-5">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Objetivos para la próxima semana</p>
            <div className="space-y-2">
              {objetivos.map((o, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-zinc-600 text-[13px] shrink-0">☐</span>
                  <input
                    value={o}
                    onChange={e => setObjetivos(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                    placeholder="Ej: Hacer inventario físico de bodega"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors"
                  />
                  {objetivos.length > 1 && (
                    <button onClick={() => setObjetivos(prev => prev.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-400/10 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setObjetivos(prev => [...prev, ''])}
                className="text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1 mt-1 bg-transparent border-none cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Agregar objetivo
              </button>
            </div>
          </Card>

          {/* Botones */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => saveReporte(false)} disabled={savingReporte} className="gap-1.5">
              <Save className="w-3.5 h-3.5" /> Guardar borrador
            </Button>
            <Button onClick={() => saveReporte(true)} disabled={savingReporte} className="gap-1.5 flex-1 justify-center">
              {savingReporte
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Publicando...</>
                : reporteSaved
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Publicado</>
                  : <><Send className="w-3.5 h-3.5" /> Publicar reporte al cliente</>
              }
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: HISTORIAL ── */}
      {activeTab === 'historial' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-zinc-400">Todos los reportes de este cliente</p>
            <Button variant="outline" size="sm" onClick={loadReportes} disabled={loadingReportes} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReportes ? 'animate-spin' : ''}`} />
              Recargar
            </Button>
          </div>

          {loadingReportes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : reportes.length === 0 ? (
            <Card className="p-10 text-center">
              <History className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-[13px]">Sin reportes publicados aún</p>
              <p className="text-zinc-600 text-[11px] mt-1">El primer reporte aparecerá aquí cuando lo publiques desde el tab Reporte</p>
            </Card>
          ) : (
            reportes.map(r => {
              const [year, month] = r.id.split('-');
              const mesNombre = `${MONTHS[parseInt(month) - 1]} ${year}`;
              const isExpanded = expandedReporte === r.id;
              const isPublicado = r.estado === 'publicado';

              return (
                <Card key={r.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedReporte(isExpanded ? null : r.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isPublicado ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-white">{mesNombre}</p>
                          {r.tipo && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              r.tipo === 'semanal'
                                ? 'bg-blue-500/[0.10] border-blue-500/[0.25] text-blue-400'
                                : 'bg-violet-500/[0.10] border-violet-500/[0.25] text-violet-400'
                            }`}>
                              {r.tipo === 'semanal' ? '📅 Semanal' : '📊 Mensual'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-600">
                          {isPublicado ? '✅ Publicado al cliente' : '📝 Borrador'}
                          {r.publicadoAt?.toDate && ` · ${r.publicadoAt.toDate().toLocaleDateString('es-CL')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {r.kpis && (
                        <div className="hidden sm:flex items-center gap-4 text-right">
                          <div>
                            <p className="text-[10px] text-zinc-600">Ventas</p>
                            <p className="text-[13px] font-bold text-white tabular-nums">{CLP(r.kpis.ventas)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600">Margen</p>
                            <p className={`text-[13px] font-bold tabular-nums ${r.kpis.margen >= 25 ? 'text-emerald-400' : r.kpis.margen >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                              {PCT(r.kpis.margen)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600">Resultado</p>
                            <p className={`text-[13px] font-bold tabular-nums ${(r.kpis.resultado || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {CLP(r.kpis.resultado)}
                            </p>
                          </div>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-white/[0.06]"
                      >
                        <div className="p-4 space-y-4">
                          {/* KPIs mobile */}
                          {r.kpis && (
                            <div className="grid grid-cols-3 gap-2 sm:hidden">
                              {[
                                { label: 'Ventas', val: CLP(r.kpis.ventas) },
                                { label: 'Margen', val: PCT(r.kpis.margen) },
                                { label: 'Resultado', val: CLP(r.kpis.resultado) },
                              ].map((k, i) => (
                                <div key={i} className="p-2 rounded-lg bg-white/[0.03] text-center">
                                  <p className="text-[10px] text-zinc-600">{k.label}</p>
                                  <p className="text-[12px] font-bold text-white tabular-nums">{k.val}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {r.alertas?.length > 0 && (
                            <div>
                              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Alertas del período</p>
                              <div className="space-y-1.5">{r.alertas.map((a, i) => <AlertChip key={i} type={a.type} message={a.message} />)}</div>
                            </div>
                          )}

                          {r.observaciones && (
                            <div>
                              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Observaciones</p>
                              <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{r.observaciones}</p>
                            </div>
                          )}

                          {r.recomendaciones?.length > 0 && (
                            <div>
                              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Recomendaciones</p>
                              <ul className="space-y-1">
                                {r.recomendaciones.map((rec, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-300">
                                    <span className="text-violet-400 shrink-0 mt-0.5">→</span>{rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {r.objetivos?.length > 0 && (
                            <div>
                              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Objetivos</p>
                              <ul className="space-y-1">
                                {r.objetivos.map((obj, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-300">
                                    <span className="text-zinc-600 shrink-0">☐</span>{obj}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="pt-2 border-t border-white/[0.05]">
                            <Button variant="outline" size="sm" className="gap-1.5"
                              onClick={() => {
                                setObservaciones(r.observaciones || '');
                                setRecomendaciones(r.recomendaciones?.length ? r.recomendaciones : ['']);
                                setObjetivos(r.objetivos?.length ? r.objetivos : ['']);
                                setActiveTab('reporte');
                              }}
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Editar este reporte
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: ROTACIÓN ── */}
      {activeTab === 'rotacion' && (() => {
        const now = new Date();

        if (loadingRot || rotacionExits === null) return (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600 mr-2" />
            <span className="text-zinc-600 text-[13px]">Analizando historial completo de ventas...</span>
          </div>
        );

        const rotMap = rotacionExits;

        // Solo productos con stock > 0, filtrados por inventario si aplica
        const rows = products
          .filter(p => (p.stock ?? 0) > 0)
          .filter(p => rotInvFilter === 'todos' || p.inventoryId === rotInvFilter)
          .map(p => {
            const rot = rotMap[p.id] || null;
            const diasSinVenta = rot?.lastSaleDate
              ? Math.floor((now - rot.lastSaleDate) / (1000 * 60 * 60 * 24))
              : null; // null = nunca vendido
            const valorInmovilizado = (p.stock ?? 0) * (p.ppp || 0);
            const estado = diasSinVenta === null
              ? 'nunca'
              : diasSinVenta <= 15 ? 'activo'
              : diasSinVenta <= 45 ? 'lento'
              : 'parado';
            return { ...p, diasSinVenta, estado, totalSales: rot?.totalSales || 0, totalQty: rot?.totalQty || 0, valorInmovilizado };
          })
          .sort((a, b) => {
            // Nunca vendido primero, luego por días desc
            if (a.estado === 'nunca' && b.estado !== 'nunca') return -1;
            if (b.estado === 'nunca' && a.estado !== 'nunca') return 1;
            return (b.diasSinVenta ?? 9999) - (a.diasSinVenta ?? 9999);
          });

        const totales = {
          activo: rows.filter(r => r.estado === 'activo').length,
          lento: rows.filter(r => r.estado === 'lento').length,
          parado: rows.filter(r => r.estado === 'parado').length,
          nunca: rows.filter(r => r.estado === 'nunca').length,
        };
        const valorParado = rows
          .filter(r => r.estado === 'parado' || r.estado === 'nunca')
          .reduce((s, r) => s + r.valorInmovilizado, 0);

        const rowsFiltrados = rows
          .filter(r => filtroRot === 'todos' || r.estado === filtroRot)
          .filter(r => !busqRot || r.name?.toLowerCase().includes(busqRot.toLowerCase()));

        const estadoCfg = {
          activo: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-500/[0.10] border-emerald-500/[0.20]', dot: 'bg-emerald-400' },
          lento:  { label: 'Lento',  color: 'text-amber-400',   bg: 'bg-amber-500/[0.10] border-amber-500/[0.20]',   dot: 'bg-amber-400' },
          parado: { label: 'Parado', color: 'text-red-400',     bg: 'bg-red-500/[0.10] border-red-500/[0.20]',       dot: 'bg-red-400' },
          nunca:  { label: 'Sin ventas', color: 'text-zinc-500', bg: 'bg-zinc-800/[0.60] border-zinc-700/[0.40]',    dot: 'bg-zinc-600' },
        };

        return (
          <div className="space-y-4">
            {/* Selector de inventario (solo si hay más de uno) */}
            {inventoryList.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRotInvFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${rotInvFilter === 'todos' ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07]'}`}
                >
                  Todos
                </button>
                {inventoryList.map(inv => (
                  <button
                    key={inv.id}
                    onClick={() => setRotInvFilter(inv.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${rotInvFilter === inv.id ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07]'}`}
                  >
                    {inv.name}
                  </button>
                ))}
              </div>
            )}

            {/* Botón Analizar con IA */}
            {(totales.parado > 0 || totales.nunca > 0) && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => analizarRotacionIA(rows, stats.topProductos, company?.name)}
                  disabled={loadingRotIA}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[13px] font-semibold hover:bg-violet-500/25 transition-all disabled:opacity-50"
                >
                  {loadingRotIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loadingRotIA ? 'Analizando...' : 'Analizar con IA'}
                </button>
                {analisisRotIA && (
                  <span className="text-[11px] text-zinc-600">Análisis listo · haz clic de nuevo para actualizar</span>
                )}
                <button
                  onClick={() => exportarRotacionPDF(rows, analisisRotIA, company?.name)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10] text-zinc-300 text-[13px] font-semibold hover:bg-white/[0.09] transition-all"
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
              </div>
            )}

            {/* Panel resultado IA */}
            {analisisRotIA && (
              <Card className="p-5 border-violet-500/20 bg-violet-500/[0.04]">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <p className="text-[11px] font-semibold text-violet-400 uppercase tracking-widest">Análisis IA</p>
                </div>
                {analisisRotIA.resumen && (
                  <p className="text-[13px] text-zinc-300 mb-4 leading-relaxed">{analisisRotIA.resumen}</p>
                )}
                {analisisRotIA.recomendaciones?.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {analisisRotIA.recomendaciones.map((r, i) => {
                      const urg = r.urgencia?.toLowerCase() || '';
                      const urgColor = (urg === 'alta' || urg === 'critica' || urg === 'crítica') ? 'text-red-400 bg-red-500/10 border-red-500/20'
                        : urg === 'media' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        : 'text-zinc-400 bg-white/[0.03] border-white/[0.06]';
                      return (
                        <div key={i} className={`rounded-xl border p-3 ${urgColor}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[12px] font-bold text-white">{r.producto}</p>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${urgColor}`}>{urg}</span>
                          </div>
                          <p className="text-[12px] font-semibold mb-0.5">{r.accion}</p>
                          <p className="text-[11px] opacity-75">{r.razon}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {analisisRotIA.consejo_general && (
                  <div className="pt-3 border-t border-white/[0.05]">
                    <p className="text-[11px] text-zinc-500 mb-1 uppercase tracking-widest">Consejo general</p>
                    <p className="text-[12px] text-zinc-300 leading-relaxed">{analisisRotIA.consejo_general}</p>
                  </div>
                )}
              </Card>
            )}

            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'activo', label: 'Activos', sub: '≤ 15 días', count: totales.activo, color: 'text-emerald-400', ring: 'ring-emerald-500/20' },
                { id: 'lento', label: 'Lentos', sub: '15 – 45 días', count: totales.lento, color: 'text-amber-400', ring: 'ring-amber-500/20' },
                { id: 'parado', label: 'Parados', sub: '+ 45 días', count: totales.parado, color: 'text-red-400', ring: 'ring-red-500/20' },
                { id: 'nunca', label: 'Sin ventas', sub: 'nunca vendidos', count: totales.nunca, color: 'text-zinc-500', ring: 'ring-zinc-700/40' },
              ].map(k => (
                <button
                  key={k.id}
                  onClick={() => setFiltroRot(filtroRot === k.id ? 'todos' : k.id)}
                  className={`text-left p-4 rounded-2xl ring-1 transition-all cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] ${k.ring} ${filtroRot === k.id ? 'bg-white/[0.06]' : ''}`}
                >
                  <p className={`text-2xl font-black tabular-nums ${k.color}`}>{k.count}</p>
                  <p className="text-[13px] font-semibold text-white mt-0.5">{k.label}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{k.sub}</p>
                </button>
              ))}
            </div>

            {/* Capital inmovilizado en parados + nunca */}
            {valorParado > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/[0.06] border border-red-500/[0.15]">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-[13px] text-red-300">
                  <span className="font-bold">{CLP(valorParado)}</span> en capital inmovilizado en productos parados o sin ventas
                </p>
              </div>
            )}

            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                value={busqRot}
                onChange={e => setBusqRot(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder-zinc-600 focus:outline-none focus:border-white/[0.20] transition-colors"
              />
            </div>

            {/* Tabla */}
            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-white/[0.04]">
                {rowsFiltrados.length === 0 ? (
                  <p className="text-zinc-600 text-[13px] text-center py-8">Sin productos</p>
                ) : rowsFiltrados.map(r => {
                  const cfg = estadoCfg[r.estado];
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Dot estado */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                      {/* Nombre + categoría */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{r.name}</p>
                        <p className="text-[11px] text-zinc-600">
                          Stock: {r.stock} {r.unit || 'un'}
                          {r.valorInmovilizado > 0 && <span className="ml-2 text-zinc-700">· {CLP(r.valorInmovilizado)}</span>}
                          {(() => {
                            const fecha = r.createdAt?.toDate?.() || (r.createdAt instanceof Date ? r.createdAt : null);
                            if (!fecha) return null;
                            const dias = Math.floor((now - fecha) / (1000 * 60 * 60 * 24));
                            const label = dias < 7 ? `${dias}d` : dias < 30 ? `${Math.floor(dias/7)}sem` : `${Math.floor(dias/30)}m`;
                            return <span className="ml-2 text-zinc-700">· ingresado hace {label}</span>;
                          })()}
                        </p>
                      </div>

                      {/* Ventas */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-[12px] text-zinc-400">
                          {r.totalSales > 0 ? `${r.totalSales} venta${r.totalSales !== 1 ? 's' : ''} · ${r.totalQty} un` : '—'}
                        </p>
                      </div>

                      {/* Días / estado */}
                      <div className={`shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${cfg.bg} ${cfg.color}`}>
                        {r.estado === 'nunca'
                          ? 'Sin ventas'
                          : r.diasSinVenta === 0
                            ? 'Hoy'
                            : r.diasSinVenta < 7
                              ? `${r.diasSinVenta} día${r.diasSinVenta !== 1 ? 's' : ''}`
                              : r.diasSinVenta < 30
                                ? `${Math.floor(r.diasSinVenta / 7)} sem${Math.floor(r.diasSinVenta / 7) !== 1 ? 's' : ''}`
                                : r.diasSinVenta < 365
                                  ? `${Math.floor(r.diasSinVenta / 30)} mes${Math.floor(r.diasSinVenta / 30) !== 1 ? 'es' : ''}`
                                  : `+1 año`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ── TAB: MARKETING ── */}
      {activeTab === 'marketing' && (
        <TabMarketing
          exits={exits}
          products={products}
          topProductos={stats.topProductos}
          rankingClientes={stats.rankingClientes}
          companyName={company?.name}
        />
      )}

    </div>
  );
}
