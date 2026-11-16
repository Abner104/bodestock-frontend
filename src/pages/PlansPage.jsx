// src/pages/PlansPage.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Package, Crown, Sparkles, Shield, Zap,
  Copy, CheckCircle, XCircle, CreditCard, MessageCircle,
  Calendar, AlertCircle, Users, Calculator, Warehouse, Receipt,
  Users2, ChevronRight, Plus, Minus,
} from 'lucide-react';
import { auth } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { API_URL } from '../config/env';
import { PLAN_FEATURES, ADDONS } from '../config/plan-features';
import { useTheme } from '../contexts/ThemeContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `${API_URL}`;

const ADDON_ICONS = {
  Users, Calculator, Warehouse, Receipt, Users2, Sparkles,
};

const CARD_BRAND_LABELS = {
  visa: 'Visa',
  master: 'Mastercard',
  mastercard: 'Mastercard',
  amex: 'Amex',
  redcompra: 'Redcompra',
  debito: 'Débito',
};

const CLP = (n) => `$${Number(n).toLocaleString('es-CL')}`;

export default function PlansPage() {
  const { isDark } = useTheme();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [currentAddons, setCurrentAddons] = useState([]);
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Selección en el configurador
  const [selectedPlan, setSelectedPlan] = useState('basico'); // 'basico' | 'profesional'
  const [extraUsers, setExtraUsers] = useState(0);
  const [extraWarehouses, setExtraWarehouses] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [expandedAddon, setExpandedAddon] = useState(null);

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return;
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        setCompanyData({ id: companyId, ...data });
        const plan = data.plan || 'free';
        setCurrentPlan(plan);
        if (plan === 'profesional') setSelectedPlan('profesional');
        const addons = data.addons || [];
        setCurrentAddons(addons);
        setSelectedAddons(addons);
      }
    } catch (error) {
      console.error('Error loading company data:', error);
    } finally {
      setLoading(false);
    }
  };


  const basePlan = PLAN_FEATURES.basico;
  const profesionalPlan = PLAN_FEATURES.profesional;
  const basePrice = selectedPlan === 'profesional' ? profesionalPlan.price : basePlan.price;

  const addonsTotal = selectedPlan === 'basico'
    ? selectedAddons.reduce((sum, id) => sum + (ADDONS[id]?.price || 0), 0)
    : 0;

  const extraUsersPrice = extraUsers * 10990;
  const extraWarehousesPrice = extraWarehouses * 9990;
  const totalPrice = basePrice + addonsTotal + extraUsersPrice + extraWarehousesPrice;

  const toggleAddon = (addonId) => {
    setSelectedAddons(prev =>
      prev.includes(addonId)
        ? prev.filter(a => a !== addonId)
        : [...prev, addonId]
    );
  };

  const hasChanges = () => {
    if (currentPlan === 'free' || currentPlan === 'trial') return true;
    if (selectedPlan !== currentPlan) return true;
    const sorted = (arr) => [...arr].sort().join(',');
    return sorted(selectedAddons) !== sorted(currentAddons);
  };

  const handleSubscribe = async () => {
    if (!hasChanges()) return;
    try {
      setProcessingPayment(true);
      const user = auth.currentUser;
      const token = await user.getIdToken();

      const planTitle = selectedPlan === 'profesional' ? 'Plan Profesional - Bodestock' : 'Plan Básico - Bodestock';
      const addonDetails = selectedPlan === 'basico'
        ? selectedAddons.map(id => ({ title: ADDONS[id]?.name || id, price: ADDONS[id]?.price || 0 }))
        : [];

      const items = [
        { title: planTitle, quantity: 1, unit_price: basePrice, currency_id: 'CLP' },
        ...addonDetails.map(a => ({ title: `Add-on: ${a.title}`, quantity: 1, unit_price: a.price, currency_id: 'CLP' })),
      ];

      const response = await fetch(`${BACKEND_URL}/api/payments/create-preference`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          back_urls: {
            success: `${window.location.origin}/payment-success`,
            failure: `${window.location.origin}/payment-failure`,
            pending: `${window.location.origin}/payment-pending`,
          },
          external_reference: companyData.id,
          metadata: {
            companyId: companyData.id,
            plan: selectedPlan,
            addons: selectedPlan === 'basico' ? selectedAddons : [],
            extraUsers: extraUsers,
            extraWarehouses: extraWarehouses,
            monthlyAmount: totalPrice,
            userEmail: user.email,
          },
        }),
      });
      const data = await response.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert('Error al crear el pago. Por favor intenta nuevamente.');
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('Error al procesar el pago: ' + error.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleContactCustom = () => {
    window.open('https://wa.me/56948487391?text=Hola%2C%20me%20interesa%20el%20plan%20Personalizado%20de%20Bodestock', '_blank');
  };


  const handlePayCustomPlan = async () => {
    // Si no hay monthlyAmount (cuenta sin pago previo), usar el configurador normal
    if (!monthlyAmount) {
      return handleSubscribe();
    }
    try {
      setProcessingPayment(true);
      const user = auth.currentUser;
      const token = await user.getIdToken();

      const response = await fetch(`${BACKEND_URL}/api/payments/create-preference`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            title: `Suscripción Bodestock — ${companyData?.name || companyData?.plan || 'Plan'}`,
            quantity: 1,
            unit_price: monthlyAmount,
            currency_id: 'CLP'
          }],
          back_urls: {
            success: `${window.location.origin}/payment-success`,
            failure: `${window.location.origin}/payment-failure`,
            pending: `${window.location.origin}/payment-pending`,
          },
          external_reference: companyData.id,
          metadata: {
            companyId: companyData.id,
            plan: currentPlan,
            monthlyAmount: monthlyAmount,
            userEmail: user.email,
            source: 'early_payment',
          },
        }),
      });
      const data = await response.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert('Error al crear el pago. Intenta nuevamente.');
    } catch (error) {
      console.error('Error creando pago personalizado:', error);
      alert('Error al procesar el pago: ' + error.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCancelPlan = async () => {
    try {
      const companyId = companyData?.id;
      if (!companyId) return;
      await updateDoc(doc(db, 'companies', companyId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      });
      setCompanyData(prev => ({ ...prev, status: 'cancelled' }));
      setShowCancelConfirm(false);
    } catch (err) {
      console.error('Error cancelando plan:', err);
    }
  };

  const handleCopyReferral = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = companyData?.status === 'active';
  const isTrial = companyData?.status === 'trial';
  const isExpiredStatus = ['billing_expired', 'suspended', 'cancelled', 'trial_expired'].includes(companyData?.status);
  const isCustom = currentPlan === 'personalizado' || currentPlan === 'empresa';
  const cardLastFour = companyData?.cardLastFour;
  const cardBrand = companyData?.cardBrand;
  const lastPayment = companyData?.lastPayment;
  const nextBillingDate = companyData?.nextBillingDate;
  const monthlyAmount = companyData?.monthlyAmount;

  // Normaliza fecha Firestore al mediodía local para evitar salto de día por timezone
  const parseBillingDate = (d) => {
    if (!d) return null;
    const raw = d.toDate ? d.toDate() : new Date(d);
    // Forzar al mediodía en hora local
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), 12, 0, 0);
  };

  const billingDateObj = parseBillingDate(nextBillingDate);

  const daysUntilBilling = (() => {
    if (!billingDateObj) return null;
    return Math.ceil((billingDateObj - new Date()) / (1000 * 60 * 60 * 24));
  })();

  const trialDaysLeft = isTrial && companyData?.trialEndDate
    ? Math.max(0, Math.ceil((companyData.trialEndDate.toDate() - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const base = isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Estado actual */}
      <div className={`rounded-2xl border p-5 ${base}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${muted}`}>Tu suscripción</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isCustom ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-blue-500 to-blue-600'
            }`}>
              {isCustom ? <Crown className="w-5 h-5 text-white" /> : <Package className="w-5 h-5 text-white" />}
            </div>
            <div>
              <p className={`font-semibold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isCustom ? 'Personalizado' : currentPlan === 'free' ? 'Plan Free' : 'Plan Básico'}
                {!isCustom && currentAddons.length > 0 && (
                  <span className={`ml-2 text-xs font-normal ${muted}`}>+ {currentAddons.length} add-on{currentAddons.length > 1 ? 's' : ''}</span>
                )}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {currentPlan === 'free' && <span className={`flex items-center gap-1 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />Gratis</span>}
                {isActive && <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Activo</span>}
                {isTrial && <span className="flex items-center gap-1 text-xs text-amber-500 font-medium"><Sparkles className="w-3 h-3" />Trial · {trialDaysLeft} días restantes</span>}
                {companyData?.status === 'cancelled' && <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><XCircle className="w-3 h-3" /> Cancelado</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {monthlyAmount != null && (
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{CLP(monthlyAmount)}/mes</p>
            )}
            {nextBillingDate && (
              <p className={`text-xs flex items-center gap-1 ${muted}`}>
                <Calendar className="w-3 h-3" />
                Próximo cobro: {billingDateObj?.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
            {cardLastFour && (
              <p className={`text-xs flex items-center gap-1 ${muted}`}>
                <CreditCard className="w-3 h-3" />
                {CARD_BRAND_LABELS[cardBrand?.toLowerCase()] || 'Tarjeta'} ···· {cardLastFour}
              </p>
            )}
          </div>
        </div>

        {isTrial && trialDaysLeft <= 5 && (
          <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Tu trial vence pronto. Elige un plan para no perder el acceso.
          </div>
        )}
      </div>

      {/* Configurador — solo si no es plan personalizado/empresa */}
      {!isCustom && (
        <div className={`rounded-2xl border p-5 space-y-5 ${base}`}>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${muted}`}>Configura tu plan</p>
            <p className={`text-xs ${muted}`}>Empieza con lo básico y agrega lo que necesitas</p>
          </div>

          {/* Selector de plan */}
          <div className="grid grid-cols-2 gap-3">
            {/* Básico */}
            <button
              onClick={() => { setSelectedPlan('basico'); setExtraUsers(0); setExtraWarehouses(0); }}
              className={`rounded-xl border p-3 text-left transition-all ${
                selectedPlan === 'basico'
                  ? isDark ? 'bg-blue-500/10 border-blue-500/40' : 'bg-blue-50 border-blue-400'
                  : isDark ? 'bg-white/[0.02] border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${selectedPlan === 'basico' ? 'bg-blue-500' : isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <Package className={`w-3.5 h-3.5 ${selectedPlan === 'basico' ? 'text-white' : muted}`} />
                </div>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Básico</p>
                {selectedPlan === 'basico' && <CheckCircle className="w-3.5 h-3.5 text-blue-500 ml-auto" />}
              </div>
              <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{CLP(basePlan.price)}<span className={`font-normal ${muted}`}>/mes</span></p>
              <p className={`text-xs mt-0.5 ${muted}`}>1 sucursal · 3 usuarios</p>
            </button>

            {/* Profesional */}
            <button
              onClick={() => { setSelectedPlan('profesional'); setExtraUsers(0); setExtraWarehouses(0); }}
              className={`rounded-xl border p-3 text-left transition-all relative overflow-hidden ${
                selectedPlan === 'profesional'
                  ? isDark ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-indigo-50 border-indigo-400'
                  : isDark ? 'bg-white/[0.02] border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${selectedPlan === 'profesional' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <Zap className={`w-3.5 h-3.5 ${selectedPlan === 'profesional' ? 'text-white' : muted}`} />
                </div>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Profesional</p>
                {selectedPlan === 'profesional' && <CheckCircle className="w-3.5 h-3.5 text-indigo-500 ml-auto" />}
              </div>
              <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{CLP(profesionalPlan.price)}<span className={`font-normal ${muted}`}>/mes</span></p>
              <p className={`text-xs mt-0.5 ${muted}`}>2 sucursales · 4 usuarios</p>
            </button>
          </div>

          {/* Detalle del plan seleccionado */}
          {selectedPlan === 'basico' ? (
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Incluido en el plan</p>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-1">
                {['Inventario tiempo real', 'Control de ventas', 'Escáner de barras', 'Exportar Excel/PDF', 'Reportes básicos', 'Alertas de stock', 'Modo oscuro', 'App móvil'].map(f => (
                  <li key={f} className={`flex items-center gap-1 text-xs ${muted}`}>
                    <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Todo incluido en Profesional</p>
              </div>
              <ul className="grid grid-cols-2 gap-1">
                {['Inventario tiempo real', 'Control de ventas', 'Escáner de barras', 'Excel/PDF', 'Reportes avanzados', 'Alertas de stock', '2 sucursales/bodegas', 'Trabajadores y roles', 'Costeo PPP', 'Asistente IA', 'App móvil', 'Modo oscuro'].map(f => (
                  <li key={f} className={`flex items-center gap-1 text-xs ${muted}`}>
                    <Check className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Usuarios extra */}
              <div className={'mt-3 pt-3 border-t ' + (isDark ? 'border-indigo-500/20' : 'border-indigo-200')}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={'text-xs font-medium ' + (isDark ? 'text-white' : 'text-gray-900')}>Usuarios adicionales</p>
                    <p className={'text-xs ' + muted}>+$10.990/usuario/mes (base: 4 usuarios)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExtraUsers(v => Math.max(0, v - 1))} className={'w-7 h-7 rounded-lg flex items-center justify-center transition-all ' + (isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800')}>
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className={'w-6 text-center text-sm font-bold ' + (isDark ? 'text-white' : 'text-gray-900')}>{extraUsers}</span>
                    <button onClick={() => setExtraUsers(v => v + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white transition-all">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {extraUsers > 0 && (
                  <p className={'text-xs mt-1.5 ' + (isDark ? 'text-indigo-400' : 'text-indigo-600')}>{4 + extraUsers} usuarios en total · +${(extraUsers * 10990).toLocaleString('es-CL')}/mes</p>
                )}
              </div>
            </div>
          )}

          {/* Add-ons — solo en plan básico */}
          {selectedPlan === 'basico' && <div>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${muted}`}>Add-ons opcionales</p>
            <div className="space-y-2">
              {Object.values(ADDONS).filter(a => a.id === 'invoicing').map(addon => {
                const Icon = ADDON_ICONS[addon.icon] || Package;
                const active = selectedAddons.includes(addon.id);
                const expanded = expandedAddon === addon.id;
                return (
                  <div
                    key={addon.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      active
                        ? isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300'
                        : isDark ? 'bg-white/[0.02] border-white/8' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Fila principal */}
                    <div className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => toggleAddon(addon.id)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                          active ? 'bg-emerald-500' : isDark ? 'bg-white/8 hover:bg-white/15' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : muted}`} />
                      </button>

                      <button
                        onClick={() => setExpandedAddon(expanded ? null : addon.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{addon.name}</p>
                        <p className={`text-xs ${muted}`}>{addon.description}</p>
                      </button>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className={`text-sm font-semibold ${active ? 'text-emerald-500' : isDark ? 'text-white' : 'text-gray-900'}`}>
                          +{CLP(addon.price)}
                        </p>
                        <button
                          onClick={() => setExpandedAddon(expanded ? null : addon.id)}
                          className={`p-1 rounded-lg transition-all ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''} ${muted}`} />
                        </button>
                        <button
                          onClick={() => toggleAddon(addon.id)}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            active ? 'bg-emerald-500 border-emerald-500' : isDark ? 'border-white/20 hover:border-white/40' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 text-white" />}
                        </button>
                      </div>
                    </div>

                    {/* Detalle expandible */}
                    <AnimatePresence>
                      {expanded && addon.details && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className={`px-3 pb-3 pt-1 border-t ${isDark ? 'border-white/8' : 'border-gray-200'}`}>
                            <ul className="space-y-1.5">
                              {addon.details.map((detail, i) => (
                                <li key={i} className={`flex items-start gap-2 text-xs ${muted}`}>
                                  <Check className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                  {detail}
                                </li>
                              ))}
                            </ul>
                            <button
                              onClick={() => toggleAddon(addon.id)}
                              className={`mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                                active
                                  ? isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100'
                                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
                              }`}
                            >
                              {active ? 'Quitar add-on' : `Agregar · +${CLP(addon.price)}/mes`}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>}

          {/* Total y botón */}
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs ${muted}`}>{selectedPlan === 'profesional' ? 'Plan Profesional' : 'Plan base'}</p>
              <p className={`text-xs ${muted}`}>{CLP(basePrice)}</p>
            </div>
            {extraWarehouses > 0 && (
              <div className="flex items-center justify-between mb-1">
                <p className={'text-xs ' + muted}>{extraWarehouses} sucursal{extraWarehouses > 1 ? 'es' : ''} extra</p>
                <p className={'text-xs ' + muted}>+{CLP(extraWarehouses * 9990)}</p>
              </div>
            )}
            {selectedPlan === 'profesional' && extraUsers > 0 && (
              <div className="flex items-center justify-between mb-1">
                <p className={'text-xs ' + muted}>{extraUsers} usuario{extraUsers > 1 ? 's' : ''} extra</p>
                <p className={'text-xs ' + muted}>+{CLP(extraUsers * 10990)}</p>
              </div>
            )}
            {selectedPlan === 'basico' && selectedAddons.map(id => (
              <div key={id} className="flex items-center justify-between mb-1">
                <p className={`text-xs ${muted}`}>{ADDONS[id]?.name}</p>
                <p className={`text-xs ${muted}`}>+{CLP(ADDONS[id]?.price)}</p>
              </div>
            ))}
            <div className={`flex items-center justify-between pt-2 mt-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Total mensual</p>
              <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{CLP(totalPrice)}/mes</p>
            </div>
          </div>

          {/* Botón pagar renovación — para cualquier plan con monto y vencimiento próximo o cuenta vencida */}
          {(isExpiredStatus || (monthlyAmount > 0 && daysUntilBilling !== null && daysUntilBilling <= 3)) ? (
            <div className="space-y-2">
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${isExpiredStatus ? (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600') : (isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700')}`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {isExpiredStatus
                  ? 'Tu suscripción está vencida. Paga para recuperar el acceso.'
                  : daysUntilBilling <= 0
                    ? 'Tu suscripción venció. Paga para continuar.'
                    : daysUntilBilling === 1
                      ? 'Tu suscripción vence mañana.'
                      : `Tu suscripción vence en ${daysUntilBilling} días.`}
              </div>
              <button
                onClick={handlePayCustomPlan}
                disabled={processingPayment || !monthlyAmount}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
              >
                {processingPayment
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Procesando...</>
                  : monthlyAmount
                    ? <><CreditCard className="w-4 h-4" /> Pagar {CLP(monthlyAmount)} ahora</>
                    : <><CreditCard className="w-4 h-4" /> Elegir plan abajo</>
                }
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={processingPayment || !hasChanges()}
              className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                !hasChanges()
                  ? isDark ? 'bg-emerald-500/10 text-emerald-400 cursor-default' : 'bg-emerald-50 text-emerald-600 cursor-default'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 shadow-sm'
              }`}
            >
              {processingPayment ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Procesando...</>
              ) : !hasChanges() ? (
                <><CheckCircle className="w-4 h-4" /> Plan al día</>
              ) : (isActive || isTrial) ? (
                <>Actualizar plan · {CLP(totalPrice)}/mes <ChevronRight className="w-4 h-4" /></>
              ) : (
                <>Suscribirse · {CLP(totalPrice)}/mes <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* Plan personalizado / empresa */}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Plan Personalizado</p>
            <p className={`text-xs ${muted}`}>Usuarios, bodegas y features ilimitadas · Soporte prioritario</p>
          </div>
        </div>

        {/* Botón pagar plan personalizado — solo para plan custom */}
        {isCustom && monthlyAmount > 0 && daysUntilBilling !== null && daysUntilBilling <= 3 ? (
          <div className="space-y-2">
            {daysUntilBilling < 0 ? (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-2 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Tu suscripción venció hace {Math.abs(daysUntilBilling)} día{Math.abs(daysUntilBilling) !== 1 ? 's' : ''}. Paga para continuar.
              </div>
            ) : daysUntilBilling === 0 ? (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-2 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Tu suscripción vence hoy. ¡Paga ahora para no perder el acceso!
              </div>
            ) : (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-2 ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Tu suscripción vence en {daysUntilBilling} día{daysUntilBilling !== 1 ? 's' : ''}. Puedes pagar antes.
              </div>
            )}
            <button
              onClick={handlePayCustomPlan}
              disabled={processingPayment}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
            >
              {processingPayment
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Procesando...</>
                : <><CreditCard className="w-4 h-4" /> Pagar {CLP(monthlyAmount)} ahora</>
              }
            </button>
            <button
              onClick={handleContactCustom}
              className={`w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
            >
              <MessageCircle className="w-3.5 h-3.5" /> Contactar por WhatsApp
            </button>
          </div>
        ) : (
          <button
            onClick={handleContactCustom}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            <MessageCircle className="w-4 h-4" /> Contactar por WhatsApp
          </button>
        )}
      </div>

      {/* Cancelar */}
      {isActive && (
        <div className="text-center pt-1">
          <AnimatePresence>
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className={`text-xs underline underline-offset-2 transition-colors ${isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
              >
                Cancelar mi suscripción
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className={`rounded-2xl border p-5 max-w-sm mx-auto ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}
              >
                <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className={`font-semibold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>¿Cancelar tu suscripción?</p>
                <p className={`text-xs mb-4 ${muted}`}>Tu acceso se suspenderá de inmediato.</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setShowCancelConfirm(false)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${isDark ? 'bg-white/8 hover:bg-white/12 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}>
                    Mantener plan
                  </button>
                  <button onClick={handleCancelPlan} className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all">
                    Sí, cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={`flex items-center justify-center gap-2 text-xs ${muted} pt-1`}>
        <Shield className="w-3.5 h-3.5" />
        Pagos seguros con Mercado Pago · Precios en CLP
      </div>
    </div>
  );
}
