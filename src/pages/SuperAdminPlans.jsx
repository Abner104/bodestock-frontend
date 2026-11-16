// src/pages/SuperAdminPlans.jsx
import { useState, useEffect } from 'react';
import {
  Save, CheckCircle, DollarSign, Users, Package,
  Warehouse, RefreshCw, Zap, Crown, ToggleLeft, ToggleRight,
  Settings, MessageCircle,
} from 'lucide-react';
import { auth, db } from '../firebase/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SUPER_ADMIN_EMAIL } from '../config/env';
import { PLAN_FEATURES, FEATURE_LABELS } from '../config/plan-features';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import { Button } from '../components/ui/sa-button';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
const PLAN_ICONS = { basico: Package, profesional: Zap, personalizado: Crown };

function LimitInput({ icon: Icon, label, value, planId, field, onChange }) {
  const isInfinity = value === Infinity;
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-zinc-500 text-zinc-400 mb-1 font-medium">
        <Icon className="w-3 h-3" /> {label}
      </label>
      <input
        type={isInfinity ? 'text' : 'number'}
        value={isInfinity ? 'Ilimitado' : value}
        onChange={(e) => onChange(planId, field, e.target.value === 'Ilimitado' ? 'Infinity' : e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 transition-all"
      />
    </div>
  );
}

export default function SuperAdminPlans() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== SUPER_ADMIN_EMAIL) { window.location.href = '/login'; return; }
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const planDoc = await getDoc(doc(db, 'config', 'plans'));
      if (planDoc.exists()) {
        const data = planDoc.data();
        const merged = {};
        Object.keys(PLAN_FEATURES).forEach(planId => {
          merged[planId] = {
            ...PLAN_FEATURES[planId],
            price:         data[planId]?.price         ?? PLAN_FEATURES[planId].price,
            features:      data[planId]?.features      ?? PLAN_FEATURES[planId].features,
            maxUsers:      data[planId]?.maxUsers      ?? PLAN_FEATURES[planId].maxUsers,
            maxProducts:   data[planId]?.maxProducts   ?? PLAN_FEATURES[planId].maxProducts,
            maxWarehouses: data[planId]?.maxWarehouses ?? PLAN_FEATURES[planId].maxWarehouses,
          };
        });
        setPlans(merged);
      } else {
        setPlans({ ...PLAN_FEATURES });
      }
    } catch (err) {
      setPlans({ ...PLAN_FEATURES });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const saveData = {};
      Object.keys(plans).forEach(planId => {
        saveData[planId] = {
          price: plans[planId].price, name: plans[planId].name,
          features: plans[planId].features,
          maxUsers: plans[planId].maxUsers,
          maxProducts: plans[planId].maxProducts,
          maxWarehouses: plans[planId].maxWarehouses,
        };
      });
      saveData.updatedAt = new Date().toISOString();
      saveData.updatedBy = auth.currentUser?.email;
      await setDoc(doc(db, 'config', 'plans'), saveData, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      if (err.code === 'permission-denied') {
        alert('Error de permisos: despliega las reglas de Firestore.');
      } else {
        alert('Error al guardar: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (planId, feature) => {
    setPlans(prev => {
      const current = prev[planId].features;
      if (current.includes('*')) return prev;
      const updated = current.includes(feature)
        ? current.filter(f => f !== feature)
        : [...current, feature];
      return { ...prev, [planId]: { ...prev[planId], features: updated } };
    });
  };

  const updateLimit = (planId, field, value) => {
    setPlans(prev => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value === '' ? 0 : (value === 'Infinity' ? Infinity : Number(value)) },
    }));
  };

  const updatePrice = (planId, price) => {
    setPlans(prev => ({ ...prev, [planId]: { ...prev[planId], price: Number(price) || 0 } }));
  };

  if (loading || !plans) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      <p className="text-zinc-500 text-sm">Cargando planes...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white text-white">Gestión de planes</h1>
          <p className="text-sm text-zinc-500 text-zinc-400 mt-0.5">Precios, límites y features por plan</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadPlans}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className={saved ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700' : ''}
          >
            {saving
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
              : saved
                ? <><CheckCircle className="w-3.5 h-3.5" /> Guardado</>
                : <><Save className="w-3.5 h-3.5" /> Guardar todo</>
            }
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Object.entries(plans)
          .filter(([planId]) => !['trial', 'free'].includes(planId))
          .map(([planId, plan]) => {
            const Icon  = PLAN_ICONS[planId] || Package;
            const isAll = plan.features.includes('*');

            return (
              <Card key={planId}>
                {/* Plan header */}
                <div className="px-5 py-4 border-b border-white/[0.06] border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center">
                        <Icon className="w-4 h-4 text-zinc-600 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white text-white">{plan.name}</p>
                        <p className="text-xs text-zinc-400">{plan.subtitle || planId}</p>
                      </div>
                    </div>
                    {plan.contactWhatsApp ? (
                      <div className="flex items-center gap-1 text-zinc-400 text-xs">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="font-bold text-base text-white text-white">{CLP(plan.price)}</p>
                        <p className="text-zinc-400 text-[10px]">/mes</p>
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="space-y-4">
                  {/* Precio */}
                  <div>
                    <label className="flex items-center gap-1 text-xs text-zinc-500 text-zinc-400 mb-1 font-medium">
                      <DollarSign className="w-3 h-3" /> Precio mensual (CLP)
                    </label>
                    <input
                      type="number"
                      value={plan.price}
                      onChange={(e) => updatePrice(planId, e.target.value)}
                      disabled={planId === 'personalizado'}
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    />
                  </div>

                  {/* Límites */}
                  <div className="grid grid-cols-3 gap-2">
                    <LimitInput icon={Users}     label="Usuarios"  value={plan.maxUsers}      planId={planId} field="maxUsers"      onChange={updateLimit} />
                    <LimitInput icon={Package}   label="Productos" value={plan.maxProducts}   planId={planId} field="maxProducts"   onChange={updateLimit} />
                    <LimitInput icon={Warehouse} label="Bodegas"   value={plan.maxWarehouses} planId={planId} field="maxWarehouses" onChange={updateLimit} />
                  </div>

                  {/* Features */}
                  <div>
                    <p className="flex items-center gap-1 text-xs text-zinc-500 text-zinc-400 mb-2 font-medium">
                      <Settings className="w-3 h-3" /> Features incluidas
                    </p>
                    {isAll ? (
                      <div className="rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.04] p-3 text-xs text-zinc-500 text-zinc-400">
                        Todas las features habilitadas
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {Object.entries(FEATURE_LABELS).map(([featureId, label]) => {
                          const has = plan.features.includes(featureId);
                          return (
                            <button
                              key={featureId}
                              onClick={() => toggleFeature(planId, featureId)}
                              className={[
                                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border cursor-pointer bg-transparent',
                                has
                                  ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white text-white'
                                  : 'border-white/[0.08] border-white/[0.08] text-zinc-500 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600',
                              ].join(' ')}
                            >
                              <span>{label}</span>
                              {has
                                ? <ToggleRight className="w-4 h-4 flex-shrink-0" />
                                : <ToggleLeft  className="w-4 h-4 flex-shrink-0" />
                              }
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
