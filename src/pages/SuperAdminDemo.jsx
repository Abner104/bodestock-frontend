// src/pages/SuperAdminDemo.jsx
import { useState } from 'react';
import { auth, db } from '../firebase/firebase';
import { doc, setDoc, updateDoc, collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';
import {
  Sparkles, Copy, Check, RefreshCw, User, Building2,
  Package, ArrowRight, Trash2, Eye, EyeOff, AlertCircle,
  CheckCircle, Loader2, FlaskConical, Monitor, X,
} from 'lucide-react';
import SubscriptionExpiredScreen from '../components/SubscriptionExpiredScreen';

const DEMO_PLANS = [
  { id: 'basico',       label: 'Básico',       price: 9990,  color: '#3b82f6', desc: 'Hasta 3 usuarios, 200 productos' },
  { id: 'profesional',  label: 'Profesional',  price: 19990, color: '#8b5cf6', desc: 'Hasta 10 usuarios, ilimitado' },
  { id: 'personalizado',label: 'Custom',       price: 49990, color: '#d946ef', desc: 'Features a medida' },
];

const DEMO_PRODUCTS = [
  { name: 'Polera Básica',     unit: 'un', stock: 50, cost: 3500,  price: 8990,  category: 'Ropa' },
  { name: 'Jeans Slim',        unit: 'un', stock: 30, cost: 12000, price: 29990, category: 'Ropa' },
  { name: 'Zapatilla Running', unit: 'un', stock: 20, cost: 25000, price: 59990, category: 'Calzado' },
  { name: 'Mochila Urbana',    unit: 'un', stock: 15, cost: 8000,  price: 19990, category: 'Accesorios' },
  { name: 'Gorro Invierno',    unit: 'un', stock: 40, cost: 2500,  price: 5990,  category: 'Accesorios' },
];

function genEmail() {
  const adj = ['alpha', 'beta', 'delta', 'nova', 'peak', 'prime', 'swift', 'ultra'];
  const noun = ['store', 'shop', 'market', 'trade', 'hub', 'zone'];
  return `demo.${adj[Math.floor(Math.random() * adj.length)]}.${noun[Math.floor(Math.random() * noun.length)]}@bodestock-demo.cl`;
}

function genCompanyName() {
  const adj = ['Alpha', 'Nova', 'Peak', 'Swift', 'Ultra', 'Delta', 'Prime', 'Apex'];
  const noun = ['Store', 'Market', 'Trade', 'Hub', 'Commerce', 'Shop'];
  return `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]}`;
}

function StepBadge({ n, done, active }) {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
      done ? 'bg-emerald-500 text-white' :
      active ? 'bg-white text-zinc-950' :
      'bg-white/[0.06] text-zinc-600'
    }`}>
      {done ? <Check className="w-3 h-3" /> : n}
    </div>
  );
}

export default function SuperAdminDemo() {
  const [plan, setPlan]               = useState('profesional');
  const [companyName, setCompanyName] = useState(genCompanyName());
  const [email, setEmail]             = useState(genEmail());
  const [password, setPassword]       = useState('Demo1234!');
  const [showPass, setShowPass]       = useState(false);
  const [step, setStep]               = useState(0); // 0=idle 1=creating 2=done
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState('');
  const [existingDemos, setExistingDemos] = useState([]);
  const [loadingDemos, setLoadingDemos]   = useState(false);
  const [showDemos, setShowDemos]         = useState(false);
  const [deletingId, setDeletingId]       = useState(null);
  const [stepLog, setStepLog]             = useState([]);
  const [previewExpired, setPreviewExpired] = useState(null); // null | 'trial' | 'billing'

  const addLog = (msg, status = 'pending') =>
    setStepLog(prev => [...prev, { msg, status, id: Date.now() + Math.random() }]);

  const updateLastLog = (status) =>
    setStepLog(prev => prev.map((l, i) => i === prev.length - 1 ? { ...l, status } : l));

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const createDemo = async () => {
    setError('');
    setResult(null);
    setStepLog([]);
    setStep(1);

    try {
      // 1. Crear usuario + empresa via registerCompany
      addLog('Creando usuario en Firebase Auth...');
      const resp = await fetch(FUNCTIONS_ENDPOINTS.REGISTER_COMPANY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          adminName: companyName,
          adminEmail: email,
          password,
          plan,
          isDemo: true,
          discount: 100,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || `Error ${resp.status}: ${JSON.stringify(data)}`);
      }

      // La función devuelve { data: { companyId, userId, ... } }
      const companyId = data.companyId || data.data?.companyId;
      if (!companyId) throw new Error('No se recibió companyId: ' + JSON.stringify(data));
      updateLastLog('done');

      // 2. Agregar productos de muestra
      addLog('Cargando productos de muestra...');
      const invRef = doc(collection(db, `companies/${companyId}/inventories`));
      await setDoc(invRef, { name: 'Inventario Principal', isDefault: true, createdAt: Timestamp.now() });
      for (const p of DEMO_PRODUCTS) {
        // Path correcto: companies/{id}/inventories/{invId}/products
        await addDoc(collection(db, `companies/${companyId}/inventories/${invRef.id}/products`), {
          ...p,
          createdAt: Timestamp.now(),
          isDemo: true,
        });
      }
      updateLastLog('done');

      setResult({ email, password, companyName, plan, companyId });
      setStep(2);

      // Generar próximas credenciales para la siguiente demo
      setEmail(genEmail());
      setCompanyName(genCompanyName());

    } catch (err) {
      updateLastLog('error');
      setError(err.message || 'Error al crear demo');
      setStep(0);
    }
  };

  const loadExistingDemos = async () => {
    setLoadingDemos(true);
    try {
      const snap = await getDocs(collection(db, 'companies'));
      setExistingDemos(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.isDemo === true)
          .sort((a, b) => {
            const da = a.createdAt?.toDate?.() || new Date(0);
            const db2 = b.createdAt?.toDate?.() || new Date(0);
            return db2 - da;
          })
      );
      setShowDemos(true);
    } catch {}
    finally { setLoadingDemos(false); }
  };

  const selectedPlan = DEMO_PLANS.find(p => p.id === plan);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-4 h-4 text-violet-400" />
          <h1 className="text-lg font-semibold text-white tracking-tight">Cuenta demo</h1>
          <Badge variant="pro">Beta</Badge>
        </div>
        <p className="text-[12px] text-zinc-600">
          Crea una cuenta de prueba con datos cargados para mostrar el SaaS a potenciales clientes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Config panel */}
        <div className="lg:col-span-3 space-y-4">

          {/* Plan */}
          <Card className="p-5">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Plan demo</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_PLANS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer [background:none] ${
                    plan === p.id
                      ? 'border-white/[0.20] bg-white/[0.06]'
                      : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full mb-2" style={{ background: p.color }} />
                  <p className="text-[12px] font-semibold text-white">{p.label}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Credenciales */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Credenciales</p>
              <button
                onClick={() => { setEmail(genEmail()); setCompanyName(genCompanyName()); }}
                className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer [background:none] [border:none] [padding:0]"
              >
                <RefreshCw className="w-3 h-3" /> Generar nuevas
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-600 mb-1 block">Nombre empresa</label>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-600 mb-1 block">Email</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-600 mb-1 block">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] focus:outline-none focus:border-white/[0.20] transition-colors"
                  />
                  <button
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer [background:none] [border:none] [padding:0]"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Datos de muestra */}
          <Card className="p-5">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Datos incluidos</p>
            <div className="space-y-2">
              {DEMO_PRODUCTS.map(p => (
                <div key={p.name} className="flex items-center gap-3 text-[12px]">
                  <Package className="w-3 h-3 text-zinc-600 shrink-0" />
                  <span className="text-zinc-400 flex-1">{p.name}</span>
                  <span className="text-zinc-600">{p.category}</span>
                  <span className="text-emerald-500 tabular-nums">
                    ${p.price.toLocaleString('es-CL')}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/[0.08] border border-red-500/[0.20]">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-400">{error}</p>
            </div>
          )}

          <Button
            onClick={createDemo}
            disabled={step === 1 || !email || !companyName || !password}
            className="w-full justify-center py-3 text-sm gap-2"
          >
            {step === 1 ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta demo...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Crear cuenta demo</>
            )}
          </Button>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">

          {/* Log en tiempo real */}
          {stepLog.length > 0 && (
            <Card className="p-5">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Progreso</p>
              <div className="space-y-2.5">
                {stepLog.map((log, i) => (
                  <div key={log.id} className="flex items-center gap-2.5">
                    <StepBadge n={i + 1} done={log.status === 'done'} active={log.status === 'pending'} />
                    <span className={`text-[12px] ${
                      log.status === 'done'  ? 'text-emerald-400' :
                      log.status === 'error' ? 'text-red-400' :
                      'text-zinc-400'
                    }`}>
                      {log.msg}
                    </span>
                    {log.status === 'pending' && (
                      <Loader2 className="w-3 h-3 text-zinc-600 animate-spin ml-auto" />
                    )}
                    {log.status === 'error' && (
                      <AlertCircle className="w-3 h-3 text-red-400 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Resultado */}
          {result && (
            <Card className="p-5" glow>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-[13px] font-semibold text-white">Cuenta creada</p>
                <Badge variant="success" dot>Lista</Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-600 mb-1">EMPRESA</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-white truncate">{result.companyName}</p>
                    <Badge variant={result.plan === 'profesional' ? 'pro' : result.plan === 'personalizado' ? 'custom' : 'default'}>
                      {DEMO_PLANS.find(p => p.id === result.plan)?.label}
                    </Badge>
                  </div>
                </div>

                {[
                  { label: 'EMAIL', value: result.email, key: 'email' },
                  { label: 'CONTRASEÑA', value: result.password, key: 'pass' },
                ].map(({ label, value, key }) => (
                  <div key={key} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] text-zinc-600 mb-1">{label}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] text-zinc-300 font-mono truncate">{value}</p>
                      <button
                        onClick={() => copy(value, key)}
                        className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer [background:none] [border:none] [padding:0]"
                      >
                        {copied === key
                          ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => copy(`Empresa: ${result.companyName}\nEmail: ${result.email}\nContraseña: ${result.password}\nPlan: ${DEMO_PLANS.find(p=>p.id===result.plan)?.label}`, 'all')}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-white/[0.08] text-[12px] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.15] transition-all cursor-pointer [background:none]"
                >
                  {copied === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar todo
                </button>
              </div>
            </Card>
          )}

          {/* Preview pantallas cliente */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-3.5 h-3.5 text-zinc-500" />
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Preview — pantallas del cliente</p>
            </div>
            <p className="text-[12px] text-zinc-600 mb-3">Visualiza lo que ve el cliente cuando su cuenta está bloqueada.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPreviewExpired('trial')}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all text-center cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/[0.12] border border-amber-500/[0.20] flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-300">Trial expirado</p>
              </button>
              <button
                onClick={() => setPreviewExpired('billing')}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all text-center cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/[0.12] border border-red-500/[0.20] flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-300">Suscripción vencida</p>
              </button>
            </div>
          </Card>

          {/* Demos existentes */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Demos activas</p>
              <button
                onClick={loadExistingDemos}
                disabled={loadingDemos}
                className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer [background:none] [border:none] [padding:0] flex items-center gap-1"
              >
                {loadingDemos ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Ver
              </button>
            </div>
            {showDemos && existingDemos.length === 0 && (
              <p className="text-[12px] text-zinc-600 text-center py-3">Sin demos creadas aún</p>
            )}
            {existingDemos.map(d => (
              <div key={d.id} className="flex items-center gap-2 py-2 border-t border-white/[0.05]">
                <div className="w-6 h-6 rounded-md bg-violet-500/[0.10] border border-violet-500/[0.20] flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0">
                  {(d.name || 'D').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-white truncate">{d.name}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{d.adminEmail}</p>
                </div>
                <Badge variant="muted" className="text-[9px]">{d.plan}</Badge>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Preview overlay — solo lectura, botón X para cerrar */}
      {previewExpired && (
        <div className="fixed inset-0 z-[300]">
          <SubscriptionExpiredScreen billingExpired={previewExpired === 'billing'} />
          {/* Capa que bloquea interacción con los botones internos */}
          <div className="absolute inset-0 z-[350]" />
          <button
            onClick={() => setPreviewExpired(null)}
            className="fixed top-4 right-4 z-[400] w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
            title="Cerrar preview"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full bg-zinc-900/90 border border-white/10 text-[11px] text-zinc-400 backdrop-blur-sm pointer-events-none select-none">
            Preview modo SA · Presiona X para cerrar
          </div>
        </div>
      )}
    </div>
  );
}
