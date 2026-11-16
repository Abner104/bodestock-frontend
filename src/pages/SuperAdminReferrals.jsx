// src/pages/SuperAdminReferrals.jsx
import { useState, useEffect } from 'react';
import {
  Gift, Users, Percent, Calendar, Settings, Save,
  CheckCircle, Copy, Award, Search, RefreshCw,
  ToggleLeft, ToggleRight, Hash, Mail, Send, Loader2,
} from 'lucide-react';
import { auth, db } from '../firebase/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { SUPER_ADMIN_EMAIL } from '../config/env';
import { FUNCTIONS_ENDPOINTS, callFunction } from '../config/functions';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';

export default function SuperAdminReferrals() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState({
    active: true, discountMonths: 3, discountPercent: 50,
    maxReferralsPerCompany: 10, limitFirstNClients: 10,
  });
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ totalReferrals: 0, activeDiscounts: 0, topReferrer: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [emailInputs, setEmailInputs] = useState({});
  const [sendingEmail, setSendingEmail] = useState({});
  const [emailSent, setEmailSent] = useState({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== SUPER_ADMIN_EMAIL) { window.location.href = '/login'; return; }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const configDoc = await getDoc(doc(db, 'config', 'referral_program'));
      if (configDoc.exists()) setConfig(prev => ({ ...prev, ...configDoc.data() }));
      const snap = await getDocs(collection(db, 'companies'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompanies(all);
      let totalRefs = 0, activeDiscs = 0, topRef = null, topCount = 0;
      all.forEach(c => {
        const n = c.referralCount || 0; totalRefs += n;
        if (c.referralDiscount?.active) activeDiscs++;
        if (n > topCount) { topCount = n; topRef = c; }
      });
      setStats({ totalReferrals: totalRefs, activeDiscounts: activeDiscs, topReferrer: topRef });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'config', 'referral_program'), {
        ...config, updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.email,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { alert('Error al guardar: ' + err.message); }
    finally { setSaving(false); }
  };

  const generateReferralCode = async (companyId, companyName) => {
    try {
      const code = `STOCKLY-${companyName.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await updateDoc(doc(db, 'companies', companyId), { referralCode: code, referralCodeCreatedAt: new Date().toISOString() });
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, referralCode: code } : c));
    } catch (err) { alert('Error generando código: ' + err.message); }
  };

  const handleSendEmail = async (company) => {
    const toEmail = emailInputs[company.id];
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) { alert('Ingresa un email válido'); return; }
    try {
      setSendingEmail(prev => ({ ...prev, [company.id]: true }));
      await callFunction(FUNCTIONS_ENDPOINTS.SEND_REFERRAL_EMAIL, 'POST', {
        to: toEmail, companyName: company.name, referralCode: company.referralCode,
        discountPercent: config.discountPercent, discountMonths: config.discountMonths,
      });
      setEmailSent(prev => ({ ...prev, [company.id]: true }));
      setTimeout(() => setEmailSent(prev => ({ ...prev, [company.id]: false })), 4000);
      setEmailInputs(prev => ({ ...prev, [company.id]: '' }));
    } catch (err) { alert('Error enviando email: ' + err.message); }
    finally { setSendingEmail(prev => ({ ...prev, [company.id]: false })); }
  };

  const filteredCompanies = companies.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.referralCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      <p className="text-zinc-500 text-sm">Cargando referidos...</p>
    </div>
  );

  const kpis = [
    { label: 'Referidos totales',  value: stats.totalReferrals,                         icon: Users,   },
    { label: 'Descuentos activos', value: stats.activeDiscounts,                         icon: Percent, },
    { label: 'Con código',         value: companies.filter(c => c.referralCode).length,  icon: Hash,    },
    { label: 'Top referidor',      value: stats.topReferrer?.name || '—',               icon: Award,   isText: true },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white text-white">Programa de referidos</h1>
          <p className="text-sm text-zinc-500 text-zinc-400 mt-0.5">Gestiona el programa para tus primeros clientes</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, isText }) => (
          <Card key={label} className="p-5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center mb-3">
              <Icon className="w-4 h-4 text-zinc-500 text-zinc-400" />
            </div>
            <p className={`font-bold text-white text-white leading-none mb-1 ${isText ? 'text-sm' : 'text-2xl'}`}>
              {value}
            </p>
            <p className="text-xs text-zinc-500 text-zinc-400">{label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Configuración */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Configuración</CardTitle>
              <button
                onClick={() => setConfig(prev => ({ ...prev, active: !prev.active }))}
                className="flex items-center gap-1.5 bg-transparent border-0 cursor-pointer"
              >
                {config.active
                  ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                  : <ToggleLeft  className="w-8 h-8 text-zinc-300 text-zinc-600" />
                }
                <span className={`text-xs font-medium ${config.active ? 'text-emerald-600 text-emerald-400' : 'text-zinc-400'}`}>
                  {config.active ? 'Activo' : 'Inactivo'}
                </span>
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Meses de descuento',    icon: Calendar, key: 'discountMonths',        min: 1,  max: 12,  hint: 'Duración del beneficio' },
              { label: '% Descuento',           icon: Percent,  key: 'discountPercent',       min: 5,  max: 100, hint: 'Sobre la mensualidad' },
              { label: 'Max referidos/empresa', icon: Users,    key: 'maxReferralsPerCompany',min: 1,  max: 50,  hint: 'Límite por empresa' },
              { label: 'Solo primeros N',        icon: Award,    key: 'limitFirstNClients',    min: 0,  max: 100, hint: '0 = sin límite' },
            ].map(({ label, icon: Icon, key, min, max, hint }) => (
              <div key={key}>
                <label className="flex items-center gap-1 text-xs text-zinc-500 text-zinc-400 mb-1 font-medium">
                  <Icon className="w-3 h-3" /> {label}
                </label>
                <input
                  type="number" min={min} max={max}
                  value={config[key]}
                  onChange={(e) => setConfig(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 transition-all"
                />
                <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p>
              </div>
            ))}

            {/* Preview */}
            <div className="rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.04] p-3 text-xs text-zinc-500 text-zinc-400 leading-relaxed">
              <Gift className="w-3 h-3 inline mr-1" />
              Refiere y obtén <strong className="text-white text-white">{config.discountMonths} meses al {config.discountPercent}% OFF</strong>.
              Hasta {config.maxReferralsPerCompany} referidos.
              {config.limitFirstNClients > 0 && ` Solo primeros ${config.limitFirstNClients} clientes.`}
            </div>

            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              className={`w-full ${saved ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600' : ''}`}
            >
              {saving
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                : saved
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Guardado</>
                  : <><Save className="w-3.5 h-3.5" /> Guardar configuración</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Empresas */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Códigos por empresa</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar empresa o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05] bg-white/[0.05]/[0.06] text-sm text-white text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 w-full sm:w-56 transition-all"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[520px] overflow-y-auto">
              {filteredCompanies.map((company) => {
                const referrer = company.referredBy ? companies.find(c => c.id === company.referredBy) : null;
                return (
                  <div key={company.id} className="px-5 py-4 hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.03] transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white text-white truncate">{company.name}</p>
                        <p className="text-xs text-zinc-400 truncate">{company.adminEmail || 'Sin email'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {company.referralCode ? (
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] text-zinc-300 text-zinc-300 px-2 py-1 rounded font-mono border border-white/[0.08] border-white/[0.08]">
                              {company.referralCode}
                            </code>
                            <button
                              onClick={() => navigator.clipboard.writeText(company.referralCode)}
                              className="p-1 hover:bg-white/[0.05]/[0.05] dark:hover:bg-zinc-700 rounded transition-colors bg-transparent border-0 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            </button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => generateReferralCode(company.id, company.name || 'COMP')}>
                            Generar código
                          </Button>
                        )}
                        <Badge variant={(company.referralCount || 0) > 0 ? 'success' : 'muted'}>
                          {company.referralCount || 0} referidos
                        </Badge>
                        {referrer && <Badge variant="default">Ref: {referrer.name}</Badge>}
                        {company.referralDiscount?.active && (
                          <Badge variant="success">{company.referralDiscount.discountPercent}% · {company.referralDiscount.monthsRemaining}m</Badge>
                        )}
                      </div>
                    </div>

                    {company.referralCode && (
                      <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06] border-white/[0.06]">
                        <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <input
                          type="email"
                          placeholder="Email del cliente a invitar..."
                          value={emailInputs[company.id] || ''}
                          onChange={(e) => setEmailInputs(prev => ({ ...prev, [company.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendEmail(company)}
                          className="flex-1 border border-white/[0.08] border-white/[0.08] rounded-md px-3 py-1.5 text-xs bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:ring-zinc-600 transition-all"
                        />
                        <Button
                          size="sm"
                          variant={emailSent[company.id] ? 'secondary' : 'default'}
                          onClick={() => handleSendEmail(company)}
                          disabled={sendingEmail[company.id] || !emailInputs[company.id]}
                        >
                          {sendingEmail[company.id]
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : emailSent[company.id]
                              ? <><CheckCircle className="w-3.5 h-3.5" /> Enviado</>
                              : <><Send className="w-3.5 h-3.5" /> Enviar</>
                          }
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredCompanies.length === 0 && (
                <div className="py-12 text-center">
                  <Gift className="w-8 h-8 text-zinc-300 text-zinc-300 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">No se encontraron empresas</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
