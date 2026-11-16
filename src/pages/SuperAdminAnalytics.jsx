// src/pages/SuperAdminAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/firebase';
import {
  TrendingDown, Activity, AlertCircle,
  CheckCircle, RefreshCw, BarChart3, Crown,
} from 'lucide-react';
import GlobalLoading from '../components/GlobalLoading';
import { SUPER_ADMIN_EMAIL } from '../config/env.js';
import { getAllCompaniesAnalytics, filterInactiveCompanies, filterTopActiveCompanies } from '../services/analyticsService';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';

const planVariant = { trial: 'trial', basico: 'default', profesional: 'pro', personalizado: 'custom', free: 'free' };
const PLAN_LABELS = { trial: 'Trial', basico: 'Básico', profesional: 'Pro', personalizado: 'Custom', free: 'Free' };

function EngagementBar({ score }) {
  const color  = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  const textCls = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
      </div>
      <span className={`text-[12px] font-bold tabular-nums ${textCls}`}>{score}</span>
    </div>
  );
}

const PLAN_COLORS = {
  profesional: '#8b5cf6', personalizado: '#d946ef',
  basico: '#3b82f6', trial: '#0ea5e9', free: '#52525b',
};

export default function SuperAdminAnalytics() {
  const navigate = useNavigate();
  const [analyticsData, setAnalyticsData] = useState([]);
  const [inactiveCompanies, setInactiveCompanies] = useState([]);
  const [topCompanies, setTopCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== SUPER_ADMIN_EMAIL) { window.location.href = '/login'; return; }
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Un solo escaneo pesado de Firestore — top e inactivas se derivan en el cliente
      // sin volver a recorrer todas las empresas (antes se calculaba 3 veces por carga).
      const allAnalytics = await getAllCompaniesAnalytics();
      setAnalyticsData(allAnalytics);
      setInactiveCompanies(filterInactiveCompanies(allAnalytics));
      setTopCompanies(filterTopActiveCompanies(allAnalytics, 5));
      setError('');
    } catch {
      setError('Error al cargar analytics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <GlobalLoading />;

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-8 text-center max-w-sm w-full">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="font-semibold text-white mb-1">Error</p>
        <p className="text-zinc-500 text-sm mb-4">{error}</p>
        <Button onClick={loadAnalytics}>Reintentar</Button>
      </Card>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Analytics de uso</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">{analyticsData.length} empresas analizadas</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAnalytics} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top empresas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top empresas activas</CardTitle>
              <Badge variant="success">Top 5</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {topCompanies.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-zinc-600">
                <BarChart3 className="w-8 h-8 mb-2" />
                <p className="text-sm">Sin datos disponibles</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {topCompanies.slice(0, 5).map((a, i) => {
                  const color = PLAN_COLORS[a.plan] || '#52525b';
                  const initial = (a.companyName || 'E').charAt(0).toUpperCase();
                  return (
                    <div
                      key={a.companyId}
                      onClick={() => navigate(`/super-admin/empresa/${a.companyId}`)}
                      className="flex items-center gap-3 py-3 cursor-pointer hover:bg-white/[0.02] -mx-5 px-5 transition-colors group"
                    >
                      <div className="relative shrink-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold"
                          style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
                        >
                          {initial}
                        </div>
                        {i === 0 && (
                          <Crown className="absolute -top-1.5 -right-1.5 w-3 h-3 text-amber-400" />
                        )}
                        {i > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-zinc-800 border border-white/[0.08] rounded-full text-[8px] font-bold text-zinc-400 flex items-center justify-center">
                            {i + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white truncate group-hover:text-zinc-200">
                          {a.companyName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={planVariant[a.plan] || 'muted'}>{PLAN_LABELS[a.plan] || a.plan}</Badge>
                          <span className="text-[11px] text-zinc-600">
                            {a.metrics.productsCount} prod · {a.metrics.workersCount} trab
                          </span>
                        </div>
                      </div>
                      <EngagementBar score={a.engagementScore} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Riesgo churn */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Riesgo de churn</CardTitle>
              <Badge variant={inactiveCompanies.length > 0 ? 'warning' : 'success'} dot>
                {inactiveCompanies.length} empresas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {inactiveCompanies.length === 0 ? (
              <div className="flex flex-col items-center py-8 rounded-xl border border-emerald-500/[0.15] bg-emerald-500/[0.05]">
                <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-white">Todo bien</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Todas activas en los últimos 7 días</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {inactiveCompanies.slice(0, 5).map((a) => (
                  <div
                    key={a.companyId}
                    onClick={() => navigate(`/super-admin/empresa/${a.companyId}`)}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-white/[0.02] -mx-5 px-5 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15] flex items-center justify-center shrink-0">
                      <TrendingDown className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate group-hover:text-zinc-200">
                        {a.companyName}
                      </p>
                      <Badge variant={planVariant[a.plan] || 'muted'}>{PLAN_LABELS[a.plan] || a.plan}</Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-amber-400 tabular-nums">{a.engagementScore}</p>
                      <p className="text-[10px] text-zinc-600">score</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla todas las empresas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-zinc-600" />
            <CardTitle>Todas las empresas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile */}
          <div className="md:hidden divide-y divide-white/[0.05]">
            {analyticsData.map((a) => (
              <div
                key={a.companyId}
                onClick={() => navigate(`/super-admin/empresa/${a.companyId}`)}
                className="flex items-center gap-3 p-4 hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{a.companyName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={planVariant[a.plan] || 'muted'}>{PLAN_LABELS[a.plan] || a.plan}</Badge>
                    <span className="text-[11px] text-zinc-600">{a.metrics.productsCount} prod</span>
                  </div>
                </div>
                <EngagementBar score={a.engagementScore} />
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['Empresa', 'Plan', 'Engagement', 'Productos', 'Movimientos', 'Trabajadores'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {analyticsData.map((a) => (
                  <tr
                    key={a.companyId}
                    onClick={() => navigate(`/super-admin/empresa/${a.companyId}`)}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-[13px] font-medium text-white">{a.companyName}</td>
                    <td className="px-5 py-3">
                      <Badge variant={planVariant[a.plan] || 'muted'}>{PLAN_LABELS[a.plan] || a.plan}</Badge>
                    </td>
                    <td className="px-5 py-3"><EngagementBar score={a.engagementScore} /></td>
                    <td className="px-5 py-3 text-[13px] text-zinc-400 tabular-nums">{a.metrics.productsCount}</td>
                    <td className="px-5 py-3 text-[13px] text-zinc-400 tabular-nums">{a.metrics.inventoryMovements}</td>
                    <td className="px-5 py-3 text-[13px] text-zinc-400 tabular-nums">{a.metrics.workersCount}</td>
                  </tr>
                ))}
                {analyticsData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-600 text-sm">
                      Sin datos disponibles
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
