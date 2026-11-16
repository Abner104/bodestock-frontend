// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, FileText, Bell, Package, Globe, CheckCircle2, Save, CreditCard } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LibreDTESettings from '../components/settings/LibreDTESettings';
import MercadoPagoSettings from '../components/settings/MercadoPagoSettings';
const PlansPage = React.lazy(() => import('./PlansPage'));
import { getUserCompanyId } from '../services/companyService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useToast } from '../components/ui/Toast';
import { useSettings } from '../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { useRegionContext } from '../contexts/RegionContext';
import { REGIONS } from '../config/regions';

const TABS = [
  { id: 'plans',         label: 'Planes',          icon: Crown,      desc: 'Suscripción y límites' },
  { id: 'billing',       label: 'Facturación',      icon: FileText,   desc: 'API Libre DTE' },
  { id: 'payments',      label: 'Pagos',            icon: CreditCard, desc: 'Cobra pedidos con Mercado Pago' },
  { id: 'notifications', label: 'Notificaciones',   icon: Bell,       desc: 'Alertas por email' },
  { id: 'inventory',     label: 'Inventario',       icon: Package,    desc: 'Umbrales de stock' },
  { id: 'general',       label: 'General',          icon: Globe,      desc: 'Idioma y moneda' },
];

// Toggle switch compacto
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

// Fila de setting con toggle
function SettingRow({ label, desc, checked, onChange }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-between py-3 border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
      <div>
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{label}</p>
        {desc && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// Fila de setting con input de texto (ej: email)
function TextRow({ label, desc, value, onChange, placeholder, type = 'text' }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-between py-3 border-b last:border-0 gap-4 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{label}</p>
        {desc && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>}
      </div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-56 text-sm rounded-lg px-3 py-1.5 border focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'}`}
      />
    </div>
  );
}

// Fila de setting con input numérico
function NumberRow({ label, desc, value, onChange, min = 0 }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-between py-3 border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
      <div className="flex-1 mr-6">
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{label}</p>
        {desc && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>}
      </div>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className={`w-20 text-center text-sm font-semibold rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
      />
    </div>
  );
}

// Fila de setting con select
function SelectRow({ label, desc, value, onChange, options }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-between py-3 border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
      <div className="flex-1 mr-6">
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{label}</p>
        {desc && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm font-medium rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Fila de setting solo informativa (no editable)
function InfoRow({ label, desc, value }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-between py-3 border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
      <div className="flex-1 mr-6">
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{label}</p>
        {desc && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>}
      </div>
      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{value}</span>
    </div>
  );
}

// Botón guardar compacto
function SaveBtn({ onClick, saving, saved }) {
  const { isDark } = useTheme();
  return (
    <div className="flex justify-end pt-2">
      <button
        onClick={onClick}
        disabled={saving}
        className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 ${
          saved
            ? 'bg-emerald-500/10 text-emerald-600'
            : isDark
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
      </button>
    </div>
  );
}

// Sección con título
function Section({ title, children }) {
  const { isDark } = useTheme();
  return (
    <div className={`rounded-xl border px-4 py-2 mb-4 ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-white border-gray-100'}`}>
      {title && <p className={`text-xs font-semibold uppercase tracking-wider pt-2 pb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{title}</p>}
      {children}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isDark } = useTheme();
  const { updateSettings: updateGlobalSettings } = useSettings();
  const { i18n } = useTranslation();
  const { hasFeature } = usePlanFeatures();
  const { regionCode, setRegion, region } = useRegionContext();

  // Filtrar tabs según features activas de la empresa
  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'billing') return hasFeature('invoicing');
    return true;
  });

  const [activeTab, setActiveTab] = useState('plans');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  const [notif, setNotif] = useState({
    emailAlerts: true, lowStockAlerts: true, expiryAlerts: true,
    dailyReport: false, weeklyReport: true,
    email: { address: '', threshold: 5 },
  });
  const [inv, setInv] = useState({
    lowStockThreshold: 10, criticalStockThreshold: 5,
    expiryWarningDays: 30, expiryCriticalDays: 7
  });
  const [gen, setGen] = useState({ timezone: 'America/Santiago', language: 'es' });

  useEffect(() => {
    (async () => {
      try {
        const companyId = await getUserCompanyId();
        const [n, i, g] = await Promise.all([
          getDoc(doc(db, `companies/${companyId}/settings`, 'notifications')),
          getDoc(doc(db, `companies/${companyId}/settings`, 'inventory')),
          getDoc(doc(db, `companies/${companyId}/settings`, 'general')),
        ]);
        if (n.exists()) setNotif(p => ({ ...p, ...n.data() }));
        if (i.exists()) setInv(p => ({ ...p, ...i.data() }));
        if (g.exists()) setGen(p => ({ ...p, ...g.data() }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (type, data) => {
    try {
      setSaving(true);
      setSaveSuccess(null);
      const companyId = await getUserCompanyId();
      await setDoc(doc(db, `companies/${companyId}/settings`, type), { ...data, updatedAt: new Date() }, { merge: true });
      if (type === 'general') {
        updateGlobalSettings(data);
        if (data.language && i18n.language !== data.language) i18n.changeLanguage(data.language);
      }
      setSaveSuccess(type);
      setTimeout(() => setSaveSuccess(null), 3000);
      toast?.addToast?.('Guardado', 'success');
    } catch (e) {
      toast?.addToast?.('Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const content = () => {
    switch (activeTab) {
      case 'plans': return <React.Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}><PlansPage /></React.Suspense>;
      case 'billing': return <LibreDTESettings />;
      case 'payments': return <MercadoPagoSettings />;

      case 'notifications':
        return (
          <>
            <Section title="Email">
              <TextRow
                label="Correo para alertas"
                desc="A dónde llegan los pedidos nuevos de tu tienda online, las alertas de stock bajo y los reportes"
                type="email"
                placeholder="correo@empresa.com"
                value={notif.email?.address || ''}
                onChange={v => setNotif(p => ({ ...p, email: { ...p.email, address: v } }))}
              />
              <SettingRow label="Alertas por email" desc="Recibir notificaciones por correo" checked={notif.emailAlerts} onChange={v => setNotif(p => ({ ...p, emailAlerts: v }))} />
              <SettingRow label="Reporte diario" desc="Resumen diario de actividad" checked={notif.dailyReport} onChange={v => setNotif(p => ({ ...p, dailyReport: v }))} />
              <SettingRow label="Reporte semanal" desc="Resumen semanal de ventas" checked={notif.weeklyReport} onChange={v => setNotif(p => ({ ...p, weeklyReport: v }))} />
            </Section>
            <Section title="Stock">
              <SettingRow label="Stock bajo" desc="Notificar cuando el stock es bajo" checked={notif.lowStockAlerts} onChange={v => setNotif(p => ({ ...p, lowStockAlerts: v }))} />
              <SettingRow label="Vencimiento" desc="Notificar productos próximos a vencer" checked={notif.expiryAlerts} onChange={v => setNotif(p => ({ ...p, expiryAlerts: v }))} />
            </Section>
            <SaveBtn onClick={() => save('notifications', notif)} saving={saving} saved={saveSuccess === 'notifications'} />
          </>
        );

      case 'inventory':
        return (
          <>
            <Section title="Umbrales de stock">
              <NumberRow label="Stock bajo" desc="Alertar cuando sea ≤ a este valor" value={inv.lowStockThreshold} onChange={v => setInv(p => ({ ...p, lowStockThreshold: v }))} />
              <NumberRow label="Stock crítico" desc="Nivel de alerta crítica" value={inv.criticalStockThreshold} onChange={v => setInv(p => ({ ...p, criticalStockThreshold: v }))} />
            </Section>
            <Section title="Vencimientos">
              <NumberRow label="Aviso de vencimiento" desc="Días antes de vencer para avisar" value={inv.expiryWarningDays} onChange={v => setInv(p => ({ ...p, expiryWarningDays: v }))} />
              <NumberRow label="Vencimiento crítico" desc="Días para alerta crítica" value={inv.expiryCriticalDays} onChange={v => setInv(p => ({ ...p, expiryCriticalDays: v }))} />
            </Section>
            <SaveBtn onClick={() => save('inventory', inv)} saving={saving} saved={saveSuccess === 'inventory'} />
          </>
        );

      case 'general':
        return (
          <>
            <Section>
              <SelectRow label="Zona horaria" value={gen.timezone} onChange={v => setGen(p => ({ ...p, timezone: v }))} options={[
                { value: 'America/Santiago', label: 'Chile (Santiago)' },
                { value: 'America/Argentina/Buenos_Aires', label: 'Argentina' },
                { value: 'America/Lima', label: 'Perú (Lima)' },
                { value: 'America/Bogota', label: 'Colombia' },
                { value: 'America/Mexico_City', label: 'México' },
              ]} />
              <SelectRow label="País / Región" value={regionCode} onChange={v => setRegion(v)} options={
                Object.values(REGIONS).map(r => ({ value: r.code, label: `${r.flag} ${r.name}` }))
              } />
              <InfoRow label="Moneda" value={`${region.currency.code} (${region.currency.symbol})`} desc="Se define automáticamente según tu País / Región" />
              <SelectRow label="Idioma" value={gen.language} onChange={v => setGen(p => ({ ...p, language: v }))} options={[
                { value: 'es', label: 'Español' },
                { value: 'en', label: 'English' },
              ]} />
            </Section>
            <SaveBtn onClick={() => save('general', gen)} saving={saving} saved={saveSuccess === 'general'} />
          </>
        );

      default: return null;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className="max-w-5xl mx-auto px-4 py-6 pb-safe-nav md:pb-10">

        {/* Título */}
        <div className="mb-6">
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Configuración</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Personaliza tu sistema Bodestock</p>
        </div>

        {/* Tabs scroll — mobile */}
        <div className="md:hidden mb-4">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap flex-shrink-0 transition ${
                    active
                      ? isDark ? 'bg-white/10 text-white font-medium' : 'bg-gray-900 text-white font-medium'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout: sidebar + content — desktop */}
        <div className="md:flex md:gap-6">

          {/* Sidebar — desktop only */}
          <aside className="hidden md:block w-44 flex-shrink-0">
            <nav className="space-y-0.5">
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                      active
                        ? isDark ? 'bg-white/8 text-white font-medium' : 'bg-gray-900 text-white font-medium'
                        : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {activeTab !== 'plans' && activeTab !== 'billing' && (
              <div className="mb-4">
                <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {TABS.find(t => t.id === activeTab)?.label}
                </h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {TABS.find(t => t.id === activeTab)?.desc}
                </p>
              </div>
            )}
            {content()}
          </main>
        </div>
      </div>
    </div>
  );
}
