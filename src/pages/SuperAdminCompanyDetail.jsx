// src/pages/SuperAdminCompanyDetail.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, addDoc, deleteDoc, orderBy, query, limit, serverTimestamp } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase/firebase';
import { sendPasswordResetEmail, signInWithCustomToken } from 'firebase/auth';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import { getCompanyAnalytics } from '../services/analyticsService';
import { API_URL } from '../config/env';
import {
  ArrowLeft, Building2, Package, Warehouse, Users, TrendingUp,
  ShoppingCart, Activity, Clock, RefreshCw,
  BarChart3, CheckCircle2, AlertTriangle, Star, Mail, Pencil, X, Loader2,
  ToggleLeft, ToggleRight, Zap, MessageSquare, Trash2, Send, LogIn, MoveRight, Search, Eye, BarChart2
} from 'lucide-react';
import SubscriptionExpiredScreen from '../components/SubscriptionExpiredScreen';
import { FEATURE_LABELS, ADDONS } from '../config/plan-features';
import { BUSINESS_TYPES } from '../config/business-types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';

const formatCLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
const formatDate = (ts) => {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const CONTROLLABLE_FEATURES = ['customers', 'invoicing', 'orders', 'public_catalog', 'ai_assistant', 'reports_advanced'];
const REASON_LABELS = { SALE: 'Venta', PRODUCTION: 'Producción', CONSUMPTION: 'Consumo', TRANSFER: 'Traslado', LOSS: 'Pérdida', OTHER: 'Otro' };
const planVariant = { trial: 'trial', basico: 'default', profesional: 'pro', personalizado: 'custom', free: 'free' };
const PLAN_LABELS = { trial: 'Trial', basico: 'Básico', profesional: 'Pro', personalizado: 'Custom', free: 'Free' };

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 disabled:opacity-50 transition-all ${className}`}
      {...props}
    />
  );
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white/[0.05] bg-[#13131a] border border-white/[0.08] border-white/[0.06] rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function SuperAdminCompanyDetail() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [inventories, setInventories] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [recentExits, setRecentExits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInventoryFilter, setSelectedInventoryFilter] = useState('all');

  const [savingFeatures, setSavingFeatures] = useState(false);
  const [featuresSaved, setFeaturesSaved] = useState(false);
  const [inventoryMetaDocs, setInventoryMetaDocs] = useState({});
  const [inventoryFeaturesMap, setInventoryFeaturesMap] = useState({});
  const [savingInventoryFeatures, setSavingInventoryFeatures] = useState({});
  const [expandedInventory, setExpandedInventory] = useState(null);
  const [previewBlock, setPreviewBlock] = useState(null); // null | 'trial' | 'billing'
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const [impersonatingWorker, setImpersonatingWorker] = useState(null);
  const [sessionModal, setSessionModal] = useState(false);

  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNote, setDeletingNote] = useState(null);

  const [emailModal, setEmailModal] = useState({ open: false, worker: null });
  const [newEmail, setNewEmail] = useState('');
  const [emailChanging, setEmailChanging] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const [moveModal, setMoveModal] = useState({ open: false, inv: null });
  const [editingNotifEmail, setEditingNotifEmail] = useState(false);
  const [notifEmail, setNotifEmail] = useState('');
  const [savingBusinessType, setSavingBusinessType] = useState(false);
  const [savingNotifEmail, setSavingNotifEmail] = useState(false);

  const [moveWorkerModal, setMoveWorkerModal] = useState({ open: false, worker: null });
  const [workerCompanySearch, setWorkerCompanySearch] = useState('');
  const [workerCompanyResults, setWorkerCompanyResults] = useState([]);
  const [workerCompanySearching, setWorkerCompanySearching] = useState(false);
  const [targetWorkerCompany, setTargetWorkerCompany] = useState(null);
  const [movingWorker, setMovingWorker] = useState(false);
  const [moveWorkerError, setMoveWorkerError] = useState('');
  const [moveWorkerSuccess, setMoveWorkerSuccess] = useState('');

  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [companySearching, setCompanySearching] = useState(false);
  const [targetCompany, setTargetCompany] = useState(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [moveSuccess, setMoveSuccess] = useState('');

  const load = async () => {
    try {
      const [companyDoc, gestionConfigDoc] = await Promise.all([
        getDoc(doc(db, 'companies', companyId)),
        getDoc(doc(db, `companies/${companyId}/gestion_config/settings`)).catch(() => null),
      ]);
      if (companyDoc.exists()) {
        const gestionActivo = gestionConfigDoc?.exists?.() ? (gestionConfigDoc.data().gestionActivo === true) : false;
        setCompany({ id: companyDoc.id, ...companyDoc.data(), gestionActivo });
      }
      const analyticsData = await getCompanyAnalytics(companyId);
      setAnalytics(analyticsData);
      const invSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
      const newMetaDocs = {}, newFeaturesMap = {};
      const invList = await Promise.all(invSnap.docs.map(async (invDoc) => {
        const invId = invDoc.id;
        const metaSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invId}/metadata`));
        const metaDoc = metaSnap.empty ? null : metaSnap.docs[0];
        const meta = metaDoc ? metaDoc.data() : {};
        const name = meta.name || invId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (metaDoc) newMetaDocs[invId] = metaDoc.id;
        newFeaturesMap[invId] = meta.inventoryFeatures || {};
        const prodSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invId}/products`));
        return { id: invId, name, type: meta.type || 'OTHER', productsCount: prodSnap.size, products: prodSnap.docs.map(p => ({ id: p.id, ...p.data() })).slice(0, 5) };
      }));
      setInventories(invList);
      setInventoryMetaDocs(newMetaDocs);
      setInventoryFeaturesMap(newFeaturesMap);
      const workersSnap = await getDocs(collection(db, `companies/${companyId}/workers`));
      setWorkers(workersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const exitsQ = query(collection(db, `companies/${companyId}/inventory_exits`), orderBy('createdAt', 'desc'), limit(100));
      const exitsSnap = await getDocs(exitsQ);
      setRecentExits(exitsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadNotes = async () => {
    try {
      const notesSnap = await getDocs(query(collection(db, `companies/${companyId}/crm_notes`), orderBy('createdAt', 'desc')));
      setNotes(notesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { load(); loadNotes(); }, [companyId]);
  const handleRefresh = () => { setRefreshing(true); load(); };

  const searchCompanies = async (term) => {
    if (!term.trim()) { setCompanyResults([]); return; }
    setCompanySearching(true);
    try {
      const snap = await getDocs(collection(db, 'companies'));
      setCompanyResults(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.id !== companyId && c.name?.toLowerCase().includes(term.toLowerCase())).slice(0, 6));
    } finally { setCompanySearching(false); }
  };

  const handleMoveInventory = async () => {
    if (!targetCompany || !moveModal.inv) return;
    const inv = moveModal.inv;
    setMoving(true); setMoveError('');
    try {
      const srcBase = `companies/${companyId}/inventories/${inv.id}`;
      const dstBase = `companies/${targetCompany.id}/inventories/${inv.id}`;
      const [metaSnap, prodSnap, exitsSnap, catsSnap, whSnap] = await Promise.all([
        getDocs(collection(db, `${srcBase}/metadata`)),
        getDocs(collection(db, `${srcBase}/products`)),
        getDocs(collection(db, `companies/${companyId}/inventory_exits`)),
        getDocs(collection(db, `${srcBase}/categories`)),
        getDocs(collection(db, `${srcBase}/warehouses`)),
      ]);
      for (const d of metaSnap.docs) await setDoc(doc(db, `${dstBase}/metadata/${d.id}`), d.data());
      for (const d of prodSnap.docs) await setDoc(doc(db, `${dstBase}/products/${d.id}`), d.data());
      for (const d of exitsSnap.docs) { if (d.data().inventoryId === inv.id) await setDoc(doc(db, `companies/${targetCompany.id}/inventory_exits/${d.id}`), d.data()); }
      for (const d of catsSnap.docs) await setDoc(doc(db, `${dstBase}/categories/${d.id}`), d.data());
      for (const d of whSnap.docs) await setDoc(doc(db, `${dstBase}/warehouses/${d.id}`), d.data());
      await Promise.all([...prodSnap.docs, ...metaSnap.docs, ...catsSnap.docs, ...whSnap.docs].map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, `companies/${companyId}/inventories/${inv.id}`));
      setMoveSuccess(`Inventario "${inv.name}" movido a "${targetCompany.name}".`);
      load();
    } catch (err) { setMoveError('Error al mover: ' + err.message); }
    finally { setMoving(false); }
  };

  const searchWorkerCompanies = async (term) => {
    if (!term.trim()) { setWorkerCompanyResults([]); return; }
    setWorkerCompanySearching(true);
    try {
      const snap = await getDocs(collection(db, 'companies'));
      setWorkerCompanyResults(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.id !== companyId && c.name?.toLowerCase().includes(term.toLowerCase())).slice(0, 6));
    } finally { setWorkerCompanySearching(false); }
  };

  const handleMoveWorker = async () => {
    if (!targetWorkerCompany || !moveWorkerModal.worker) return;
    const w = moveWorkerModal.worker;
    setMovingWorker(true); setMoveWorkerError('');
    try {
      await setDoc(doc(db, `companies/${targetWorkerCompany.id}/workers/${w.id}`), w);
      await deleteDoc(doc(db, `companies/${companyId}/workers/${w.id}`));
      setWorkers(prev => prev.filter(wk => wk.id !== w.id));
      setMoveWorkerSuccess(`Trabajador "${w.name || w.email}" movido a "${targetWorkerCompany.name}".`);
    } catch (err) { setMoveWorkerError('Error: ' + err.message); }
    finally { setMovingWorker(false); }
  };

  const handleDeleteInventory = async (inv) => {
    const confirm = window.prompt(`Escribe el nombre del inventario para confirmar la eliminación:\n"${inv.name}"`);
    if (!confirm || confirm.trim().toLowerCase() !== inv.name.toLowerCase()) { alert('Cancelado.'); return; }
    try {
      const base = `companies/${companyId}/inventories/${inv.id}`;
      const [prodSnap, metaSnap, catSnap, whSnap] = await Promise.all([getDocs(collection(db, `${base}/products`)), getDocs(collection(db, `${base}/metadata`)), getDocs(collection(db, `${base}/categories`)), getDocs(collection(db, `${base}/warehouses`))]);
      await Promise.all([...prodSnap.docs, ...metaSnap.docs, ...catSnap.docs, ...whSnap.docs].map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, `companies/${companyId}/inventories/${inv.id}`));
      load();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleImpersonateWorker = async (worker) => {
    try {
      setImpersonatingWorker(worker.id);
      const targetUid = worker.uid || worker.firebaseUid || worker.id;
      const superAdminUid = firebaseAuth.currentUser?.uid;
      const [res, superAdminRes] = await Promise.all([
        fetch(FUNCTIONS_ENDPOINTS.IMPERSONATE_USER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUid, companyId }) }),
        fetch(FUNCTIONS_ENDPOINTS.IMPERSONATE_USER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUid: superAdminUid }) }),
      ]);
      const data = await res.json();
      const superAdminData = await superAdminRes.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Error');
      sessionStorage.setItem('impersonation', JSON.stringify({ active: true, companyName: company?.name || 'Empresa', companyId, workerName: worker.name || worker.email || 'Usuario', returnPath: `/super-admin/empresa/${companyId}`, superAdminToken: superAdminData.customToken || null }));
      await signInWithCustomToken(firebaseAuth, data.customToken);
      window.location.href = '/';
    } catch (err) { alert('Error: ' + err.message); setImpersonatingWorker(null); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      setSavingNote(true);
      const noteData = { text: newNote.trim(), createdAt: serverTimestamp(), author: firebaseAuth.currentUser?.email || 'super-admin' };
      const ref = await addDoc(collection(db, `companies/${companyId}/crm_notes`), noteData);
      setNotes(prev => [{ id: ref.id, ...noteData, createdAt: new Date() }, ...prev]);
      setNewNote('');
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSavingNote(false); }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try { setDeletingNote(noteId); await deleteDoc(doc(db, `companies/${companyId}/crm_notes`, noteId)); setNotes(prev => prev.filter(n => n.id !== noteId)); }
    finally { setDeletingNote(null); }
  };

  const toggleFeature = async (featureKey, currentValue) => {
    try {
      setSavingFeatures(true);
      const updated = { ...company?.companyFeatures, [featureKey]: !currentValue };
      await updateDoc(doc(db, 'companies', companyId), { companyFeatures: updated });
      setCompany(prev => ({ ...prev, companyFeatures: updated }));
      setFeaturesSaved(true);
      setTimeout(() => setFeaturesSaved(false), 2000);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSavingFeatures(false); }
  };

  // Add-ons normalmente se activan vía checkout de Mercado Pago (ver
  // PlansPage.jsx) -- esto es la puerta de super admin para regalar/activar
  // uno sin cobrar, útil para pruebas o cortesías. Escribe directo en
  // companies/{id}.addons (el mismo array que lee usePlanFeatures.js).
  const isAddonOn = (addonId) => (company?.addons || []).includes(addonId);
  const toggleAddon = async (addonId) => {
    try {
      setSavingFeatures(true);
      const current = company?.addons || [];
      const updated = current.includes(addonId)
        ? current.filter(a => a !== addonId)
        : [...current, addonId];
      await updateDoc(doc(db, 'companies', companyId), { addons: updated });
      setCompany(prev => ({ ...prev, addons: updated }));
      setFeaturesSaved(true);
      setTimeout(() => setFeaturesSaved(false), 2000);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSavingFeatures(false); }
  };

  const isFeatureOn = (featureKey) => {
    const cf = company?.companyFeatures;
    if (!cf || cf[featureKey] === undefined) return true;
    return cf[featureKey] === true;
  };

  const toggleGestion = async () => {
    try {
      const current = company?.gestionActivo === true;
      await setDoc(
        doc(db, `companies/${companyId}/gestion_config/settings`),
        { gestionActivo: !current, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setCompany(prev => ({ ...prev, gestionActivo: !current }));
    } catch (e) { alert('Error activando consultor: ' + e.message); }
  };

  const toggleInventoryFeature = async (inventoryId, featureKey, currentValue) => {
    try {
      setSavingInventoryFeatures(prev => ({ ...prev, [inventoryId]: true }));
      const updated = { ...inventoryFeaturesMap[inventoryId], [featureKey]: !currentValue };
      const metaDocId = inventoryMetaDocs[inventoryId];
      if (metaDocId) {
        await updateDoc(doc(db, `companies/${companyId}/inventories/${inventoryId}/metadata`, metaDocId), { inventoryFeatures: updated });
      } else {
        const newMetaRef = doc(collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`));
        await setDoc(newMetaRef, { inventoryFeatures: updated });
        setInventoryMetaDocs(prev => ({ ...prev, [inventoryId]: newMetaRef.id }));
      }
      setInventoryFeaturesMap(prev => ({ ...prev, [inventoryId]: updated }));
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSavingInventoryFeatures(prev => ({ ...prev, [inventoryId]: false })); }
  };

  const isInventoryFeatureOn = (inventoryId, featureKey) => {
    const iF = inventoryFeaturesMap[inventoryId];
    if (!iF || iF[featureKey] === undefined) return true;
    return iF[featureKey] === true;
  };

  const openEmailModal = (worker) => { setEmailModal({ open: true, worker }); setNewEmail(worker.email || ''); setEmailError(''); setEmailSuccess(''); };
  const closeEmailModal = () => { setEmailModal({ open: false, worker: null }); setNewEmail(''); setEmailError(''); setEmailSuccess(''); };

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) { setEmailError('Correo inválido.'); return; }
    if (newEmail.trim() === emailModal.worker?.email) { setEmailError('El correo es igual al actual.'); return; }
    setEmailChanging(true); setEmailError(''); setEmailSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/users/${emailModal.worker.firebaseUid}/email`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newEmail: newEmail.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Error');
      await updateDoc(doc(db, `companies/${companyId}/workers`, emailModal.worker.id), { email: newEmail.trim() });
      setWorkers(prev => prev.map(w => w.id === emailModal.worker.id ? { ...w, email: newEmail.trim() } : w));
      try { await sendPasswordResetEmail(firebaseAuth, newEmail.trim()); setEmailSuccess('Correo actualizado. Se envió un reset de contraseña.'); }
      catch { setEmailSuccess('Correo actualizado correctamente.'); }
      setTimeout(closeEmailModal, 2500);
    } catch (err) { setEmailError(err.message); }
    finally { setEmailChanging(false); }
  };

  const handleSaveNotifEmail = async () => {
    setSavingNotifEmail(true);
    try { await updateDoc(doc(db, 'companies', companyId), { notificationEmail: notifEmail.trim() }); setCompany(prev => ({ ...prev, notificationEmail: notifEmail.trim() })); setEditingNotifEmail(false); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setSavingNotifEmail(false); }
  };

  const handleSetBusinessType = async (value) => {
    setSavingBusinessType(true);
    try { await updateDoc(doc(db, 'companies', companyId), { businessType: value }); setCompany(prev => ({ ...prev, businessType: value })); }
    catch (err) { alert('Error: ' + err.message); }
    finally { setSavingBusinessType(false); }
  };

  const filteredExits = useMemo(() => selectedInventoryFilter === 'all' ? recentExits : recentExits.filter(e => e.inventoryId === selectedInventoryFilter), [recentExits, selectedInventoryFilter]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      <p className="text-zinc-500 text-sm">Cargando datos...</p>
    </div>
  );

  const score = analytics?.engagementScore || 0;
  const scoreColor = score >= 70 ? 'text-emerald-600 text-emerald-400' : score >= 40 ? 'text-amber-600 text-amber-400' : 'text-red-600 text-red-400';
  const weeklyChartData = analytics?.activity?.weekly?.slice().reverse() || [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="icon" onClick={() => navigate('/super-admin/empresas')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-white text-white truncate">{company?.name || 'Empresa'}</h1>
            <Badge variant={company?.status === 'active' ? 'active' : 'danger'} dot>{company?.status || 'Desconocido'}</Badge>
            <Badge variant={planVariant[company?.plan] || 'muted'}>{PLAN_LABELS[company?.plan] || company?.plan || 'free'}</Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">{company?.email || companyId}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Gestión — siempre visible */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/super-admin/gestion/${companyId}`)}
            title="Control de Gestión"
            className="gap-1.5"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gestión</span>
          </Button>

          {/* Entrar — siempre visible */}
          <Button
            onClick={() => setSessionModal(true)}
            disabled={workers.length === 0}
            size="sm"
            className="gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Entrar</span>
          </Button>

          {/* Menú secundario — en mobile colapsa en un botón "···" */}
          <div className="relative">
            <Button
              variant="icon"
              size="sm"
              onClick={() => setShowActionsMenu(v => !v)}
              title="Más acciones"
            >
              <span className="text-[16px] leading-none tracking-wider">···</span>
            </Button>

            {showActionsMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#111118] border border-white/[0.10] rounded-xl shadow-2xl overflow-hidden min-w-[180px]">

                  {/* Toggle Consultor */}
                  <button
                    onClick={() => { toggleGestion(); setShowActionsMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors text-left hover:bg-white/[0.05] ${
                      company?.gestionActivo ? 'text-emerald-400' : 'text-zinc-400'
                    }`}
                  >
                    {company?.gestionActivo
                      ? <><ToggleRight className="w-4 h-4" /> Consultor ON</>
                      : <><ToggleLeft className="w-4 h-4" /> Consultor OFF</>
                    }
                  </button>

                  {/* Ver bloqueo */}
                  <button
                    onClick={() => {
                      const s = company?.status;
                      const plan = company?.plan;
                      const billing = company?.nextBillingDate?.toDate ? company.nextBillingDate.toDate() : null;
                      const trial = company?.trialEndDate?.toDate ? company.trialEndDate.toDate() : null;
                      const now = new Date();
                      if (['trial_expired','billing_expired','suspended','cancelled'].includes(s)) {
                        setPreviewBlock(s === 'trial_expired' ? 'trial' : 'billing');
                      } else if (s === 'trial' && trial && trial < now) {
                        setPreviewBlock('trial');
                      } else {
                        setPreviewBlock('billing');
                      }
                      setShowActionsMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-zinc-400 hover:bg-white/[0.05] transition-colors text-left"
                  >
                    <Eye className="w-4 h-4" /> Ver bloqueo cliente
                  </button>

                  <div className="border-t border-white/[0.06]" />

                  {/* Actualizar */}
                  <button
                    onClick={() => { handleRefresh(); setShowActionsMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-zinc-400 hover:bg-white/[0.05] transition-colors text-left"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="col-span-2 sm:col-span-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
          <Star className={`w-4 h-4 ${scoreColor}`} />
          <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
          <span className="text-xs text-zinc-400">Engagement</span>
          <div className="w-3/4 h-1.5 bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] rounded-full mt-1">
            <div className={`h-full rounded-full ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
          </div>
        </Card>
        {[
          { icon: Package, label: 'Productos', value: analytics?.metrics?.productsCount ?? 0 },
          { icon: Warehouse, label: 'Inventarios', value: analytics?.metrics?.inventoriesCount ?? inventories.length },
          { icon: Users, label: 'Trabajadores', value: analytics?.metrics?.workersCount ?? 0 },
          { icon: ShoppingCart, label: 'Movimientos', value: analytics?.metrics?.inventoryMovements ?? 0 },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <kpi.icon className="w-4 h-4 text-zinc-400 mb-2" />
            <span className="text-2xl font-bold text-white text-white block">{kpi.value}</span>
            <span className="text-xs text-zinc-400">{kpi.label}</span>
          </Card>
        ))}
      </div>

      {/* Gráfico + Features */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Actividad semanal</CardTitle></CardHeader>
          <CardContent>
            {weeklyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={weeklyChartData}>
                  <defs>
                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#18181b" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} movimientos`, 'Actividad']} />
                  <Area type="monotone" dataKey="count" stroke="#18181b" strokeWidth={1.5} fill="url(#actGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-zinc-400 text-sm">Sin actividad esta semana</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Features activas</CardTitle>
              {featuresSaved && <span className="text-xs text-emerald-600 text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Guardado</span>}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-400 mb-3">Override de módulos para esta empresa.</p>
            <div className="space-y-1">
              {CONTROLLABLE_FEATURES.map(featureKey => {
                const isOn = isFeatureOn(featureKey);
                return (
                  <button key={featureKey} onClick={() => toggleFeature(featureKey, isOn)} disabled={savingFeatures}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border cursor-pointer bg-transparent transition-all ${isOn ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white text-white' : 'border-white/[0.08] border-white/[0.08] text-zinc-500 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                  >
                    <span>{FEATURE_LABELS[featureKey] || featureKey}</span>
                    {isOn ? <ToggleRight className="w-4 h-4 shrink-0" /> : <ToggleLeft className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add-ons (sin cobro)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-400 mb-3">Activa un add-on para esta empresa sin pasar por el checkout de Mercado Pago (pruebas, cortesías).</p>
            <div className="space-y-1">
              {Object.values(ADDONS).map(addon => {
                const isOn = isAddonOn(addon.id);
                return (
                  <button key={addon.id} onClick={() => toggleAddon(addon.id)} disabled={savingFeatures}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border cursor-pointer bg-transparent transition-all ${isOn ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white text-white' : 'border-white/[0.08] border-white/[0.08] text-zinc-500 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                  >
                    <span>{addon.name}</span>
                    {isOn ? <ToggleRight className="w-4 h-4 shrink-0" /> : <ToggleLeft className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email notificaciones */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email de notificaciones (override)</CardTitle>
            {!editingNotifEmail && (
              <button onClick={() => { setNotifEmail(company?.notificationEmail || ''); setEditingNotifEmail(true); }} className="text-xs text-zinc-400 hover:text-zinc-300 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors bg-transparent border-0 cursor-pointer">
                <Pencil className="w-3 h-3" /> Editar
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editingNotifEmail ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-white/[0.06] border-white/[0.06] bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.04]">
              <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
              <p className="text-sm text-zinc-300 text-zinc-300">{company?.notificationEmail || '—'}</p>
              {!company?.notificationEmail && <span className="text-xs text-zinc-400 ml-auto">Sin override — usa el email configurado por la empresa</span>}
            </div>
          ) : (
            <div className="flex gap-2">
              <Input type="email" value={notifEmail} onChange={e => setNotifEmail(e.target.value)} placeholder="correo@empresa.com" onKeyDown={e => e.key === 'Enter' && handleSaveNotifEmail()} autoFocus />
              <Button variant="icon" onClick={() => setEditingNotifEmail(false)}><X className="w-4 h-4" /></Button>
              <Button onClick={handleSaveNotifEmail} disabled={savingNotifEmail} size="sm">
                {savingNotifEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tipo de negocio — determina features como "Buscar clientes cerca"
          (solo distribuidoras/mayoristas) o "Mesas" (solo rubros de comida) */}
      <Card>
        <CardHeader>
          <CardTitle>Tipo de negocio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-400 mb-3">
            Actual: <span className="text-zinc-200 font-medium">
              {BUSINESS_TYPES.find(t => t.value === company?.businessType)?.label || 'Sin definir'}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {BUSINESS_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => handleSetBusinessType(t.value)}
                disabled={savingBusinessType}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border cursor-pointer bg-transparent transition-all disabled:opacity-50 ${
                  company?.businessType === t.value
                    ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white'
                    : 'border-white/[0.08] text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trabajadores + Inventarios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Trabajadores</CardTitle>
              <span className="text-xs text-zinc-400">{workers.length} total</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {workers.length === 0 ? (
                <p className="text-zinc-400 text-sm text-center py-6">Sin trabajadores</p>
              ) : workers.map(w => (
                <div key={w.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-white/[0.06] border-white/[0.06]">
                  <div className="w-7 h-7 rounded-full bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center text-zinc-600 text-zinc-300 text-xs font-semibold shrink-0">
                    {w.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white text-white truncate">{w.name || w.email}</p>
                    <p className="text-xs text-zinc-400 truncate">{w.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={w.active !== false ? 'active' : 'muted'}>{w.active !== false ? 'Activo' : 'Inactivo'}</Badge>
                    {w.firebaseUid && (
                      <button onClick={() => openEmailModal(w)} className="p-1 rounded hover:bg-white/[0.05]/[0.05] dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-300 dark:hover:text-zinc-200 transition-colors bg-transparent border-0 cursor-pointer">
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => { setMoveWorkerModal({ open: true, worker: w }); setTargetWorkerCompany(null); setWorkerCompanySearch(''); setWorkerCompanyResults([]); setMoveWorkerError(''); setMoveWorkerSuccess(''); }} className="p-1 rounded hover:bg-white/[0.05]/[0.05] dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-300 dark:hover:text-zinc-200 transition-colors bg-transparent border-0 cursor-pointer">
                      <MoveRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inventarios / Bodegas</CardTitle>
              <span className="text-xs text-zinc-400">{inventories.length} total</span>
            </div>
          </CardHeader>
          <CardContent>
            {inventories.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-6">Sin inventarios</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inventories.map(inv => {
                  const isExpanded = expandedInventory === inv.id;
                  const isSaving = savingInventoryFeatures[inv.id];
                  return (
                    <div key={inv.id} className="rounded-lg border border-white/[0.08] border-white/[0.08] overflow-hidden">
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Warehouse className="w-4 h-4 text-zinc-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white text-white truncate">{inv.name}</p>
                            <p className="text-xs text-zinc-400">{inv.productsCount} productos</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setMoveModal({ open: true, inv }); setTargetCompany(null); setCompanySearch(''); setCompanyResults([]); setMoveError(''); setMoveSuccess(''); }} className="text-xs px-2 py-1 rounded border border-white/[0.08] border-white/[0.08] text-zinc-500 hover:text-white dark:hover:text-white hover:border-zinc-400 transition-all bg-transparent cursor-pointer">Mover</button>
                            <button onClick={() => handleDeleteInventory(inv)} className="text-xs px-2 py-1 rounded border border-white/[0.08] border-white/[0.08] text-zinc-500 hover:text-red-600 hover:border-red-300 transition-all bg-transparent cursor-pointer">Borrar</button>
                            <button onClick={() => setExpandedInventory(isExpanded ? null : inv.id)} className={`text-xs px-2 py-1 rounded border transition-all bg-transparent cursor-pointer ${isExpanded ? 'border-zinc-900 dark:border-white text-white text-white' : 'border-white/[0.08] border-white/[0.08] text-zinc-500 hover:border-zinc-400'}`}>Features</button>
                          </div>
                        </div>
                        {inv.products.slice(0, 3).map(p => (
                          <div key={p.id} className="flex items-center justify-between py-1 border-t border-white/[0.06] border-white/[0.06]">
                            <span className="text-xs text-zinc-500 truncate flex-1">{p.name || p.code}</span>
                            <span className="text-xs text-zinc-400 ml-2 shrink-0">{p.stock ?? '—'} {p.unit || ''}</span>
                          </div>
                        ))}
                        {inv.productsCount > 3 && <p className="text-xs text-zinc-400 mt-1">+{inv.productsCount - 3} más</p>}
                      </div>
                      {isExpanded && (
                        <div className="border-t border-white/[0.08] border-white/[0.08] bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.04] p-3">
                          <p className="text-xs font-semibold text-zinc-500 text-zinc-400 mb-2">Override por sucursal</p>
                          <div className="space-y-1">
                            {CONTROLLABLE_FEATURES.map(featureKey => {
                              const isOn = isInventoryFeatureOn(inv.id, featureKey);
                              return (
                                <button key={featureKey} onClick={() => toggleInventoryFeature(inv.id, featureKey, isOn)} disabled={isSaving}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs border cursor-pointer bg-transparent disabled:opacity-50 transition-all ${isOn ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white text-white' : 'border-white/[0.08] border-white/[0.08] text-zinc-500'}`}
                                >
                                  <span>{FEATURE_LABELS[featureKey] || featureKey}</span>
                                  {isOn ? <ToggleRight className="w-4 h-4 shrink-0" /> : <ToggleLeft className="w-4 h-4 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                          {isSaving && <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</p>}
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

      {/* Actividad reciente */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle>Actividad reciente</CardTitle>
              <span className="text-xs text-zinc-400">{filteredExits.length} movimientos</span>
            </div>
            {inventories.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setSelectedInventoryFilter('all')} className={`text-xs px-3 py-1 rounded-lg font-medium border transition-all bg-transparent cursor-pointer ${selectedInventoryFilter === 'all' ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white text-white' : 'border-white/[0.08] border-white/[0.08] text-zinc-500 hover:border-zinc-400'}`}>Todos</button>
                {inventories.map(inv => (
                  <button key={inv.id} onClick={() => setSelectedInventoryFilter(inv.id)} className={`text-xs px-3 py-1 rounded-lg font-medium border transition-all bg-transparent cursor-pointer ${selectedInventoryFilter === inv.id ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white text-white' : 'border-white/[0.08] border-white/[0.08] text-zinc-500 hover:border-zinc-400'}`}>{inv.name}</button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredExits.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-8">Sin movimientos registrados</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredExits.map(exit => {
                const totalQty = exit.products?.reduce((s, p) => s + (Number(p.quantity) || 0), 0) ?? exit.quantity ?? 0;
                const firstProduct = exit.products?.[0];
                const extraProducts = (exit.products?.length || 1) - 1;
                return (
                  <div key={exit.id} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] border-white/[0.06] hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.03] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-zinc-500 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white text-white truncate">
                        {firstProduct?.productName || exit.productName || 'Movimiento'}
                        {extraProducts > 0 && <span className="text-zinc-400 font-normal"> +{extraProducts} más</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-zinc-400">{exit.workerName || exit.worker || 'Sistema'} · {REASON_LABELS[exit.reason] || exit.reason || ''}</p>
                        {exit.inventoryName && <Badge variant="muted">{exit.inventoryName}</Badge>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white text-white">{totalQty} uds</p>
                      {exit.totalValue > 0 && <p className="text-xs text-emerald-600 text-emerald-400">{formatCLP(exit.totalValue)}</p>}
                      <p className="text-xs text-zinc-400 mt-0.5">{formatDate(exit.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas CRM */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notas internas CRM</CardTitle>
            <span className="text-xs text-zinc-400">{notes.length} nota{notes.length !== 1 ? 's' : ''}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
              placeholder="Agregar nota... (Ctrl+Enter para guardar)" rows={2}
              className="flex-1 border border-white/[0.08] border-white/[0.08] rounded-lg px-3 py-2 text-sm bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 resize-none transition-all"
            />
            <Button onClick={handleAddNote} disabled={savingNote || !newNote.trim()} className="self-end">
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-6">Sin notas aún.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {notes.map(note => {
                const ts = note.createdAt?.toDate ? note.createdAt.toDate() : note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt || Date.now());
                return (
                  <div key={note.id} className="group flex gap-3 p-3 rounded-lg border border-white/[0.06] border-white/[0.06] hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.03] transition-colors">
                    <div className="w-7 h-7 rounded-full bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="w-3 h-3 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white text-white leading-relaxed whitespace-pre-wrap">{note.text}</p>
                      <p className="text-xs text-zinc-400 mt-1">{note.author} · {ts.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button onClick={() => handleDeleteNote(note.id)} disabled={deletingNote === note.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-all shrink-0 self-start bg-transparent border-0 cursor-pointer"
                    >
                      {deletingNote === note.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal email trabajador */}
      <Modal open={emailModal.open} onClose={closeEmailModal}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white text-white">Cambiar correo</h3>
              <p className="text-xs text-zinc-400 truncate max-w-[220px]">{emailModal.worker?.name}</p>
            </div>
            <Button variant="icon" onClick={closeEmailModal}><X className="w-4 h-4" /></Button>
          </div>
          <div className="mb-4 p-3 rounded-lg border border-white/[0.06] border-white/[0.06] bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.04]">
            <p className="text-xs text-zinc-400 mb-0.5">Correo actual</p>
            <p className="text-sm font-medium text-white text-white">{emailModal.worker?.email || '—'}</p>
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Nuevo correo</label>
            <Input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailError(''); }} placeholder="nuevo@correo.com" onKeyDown={e => e.key === 'Enter' && handleChangeEmail()} autoFocus />
          </div>
          {emailError && <p className="mb-4 text-xs text-red-600 text-red-400 bg-red-50 bg-red-500/[0.08] border border-red-200 border-red-500/[0.15] rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{emailError}</p>}
          {emailSuccess && <p className="mb-4 text-xs text-emerald-600 text-emerald-400 bg-emerald-50 bg-emerald-500/[0.08] border border-emerald-200 border-emerald-500/[0.15] rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{emailSuccess}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeEmailModal} className="flex-1">Cancelar</Button>
            <Button onClick={handleChangeEmail} disabled={emailChanging || !!emailSuccess} className="flex-1">
              {emailChanging ? <><Loader2 className="w-4 h-4 animate-spin" /> Actualizando...</> : <><Pencil className="w-4 h-4" /> Guardar</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal mover inventario */}
      <Modal open={moveModal.open} onClose={() => !moving && setMoveModal({ open: false, inv: null })}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white text-white">Mover inventario</h3>
              <p className="text-xs text-zinc-400">{moveModal.inv?.name}</p>
            </div>
            <Button variant="icon" onClick={() => !moving && setMoveModal({ open: false, inv: null })}><X className="w-4 h-4" /></Button>
          </div>
          {!moveSuccess ? (
            <>
              <p className="text-xs text-zinc-400 mb-3">Se moverán todos los productos, categorías, bodegas e historial.</p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <Input className="pl-9" value={companySearch} onChange={e => { setCompanySearch(e.target.value); searchCompanies(e.target.value); setTargetCompany(null); }} placeholder="Empresa destino..." disabled={moving} />
                {companySearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 animate-spin" />}
              </div>
              {companyResults.length > 0 && !targetCompany && (
                <div className="mb-3 rounded-lg border border-white/[0.08] border-white/[0.08] overflow-hidden">
                  {companyResults.map(c => (
                    <button key={c.id} onClick={() => { setTargetCompany(c); setCompanyResults([]); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] transition-colors text-left border-b border-white/[0.06] border-white/[0.06] last:border-0 bg-transparent cursor-pointer">
                      <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div><p className="text-sm font-medium text-white text-white">{c.name}</p><p className="text-xs text-zinc-400">{c.plan} · {c.status}</p></div>
                    </button>
                  ))}
                </div>
              )}
              {targetCompany && (
                <div className="mb-4 p-3 rounded-lg border border-amber-200 border-amber-500/[0.15] bg-amber-50 bg-amber-500/[0.08] flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-amber-600 text-amber-400 shrink-0" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex-1">{targetCompany.name}</p>
                  <button onClick={() => setTargetCompany(null)} className="text-zinc-400 hover:text-zinc-600 bg-transparent border-0 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {moveError && <p className="mb-4 text-xs text-red-600 text-red-400 bg-red-50 bg-red-500/[0.08] border border-red-200 border-red-500/[0.15] rounded-lg px-3 py-2">{moveError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMoveModal({ open: false, inv: null })} className="flex-1" disabled={moving}>Cancelar</Button>
                <Button onClick={handleMoveInventory} disabled={!targetCompany || moving} className="flex-1">
                  {moving ? <><Loader2 className="w-4 h-4 animate-spin" /> Moviendo...</> : <><MoveRight className="w-4 h-4" /> Mover</>}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-white text-white mb-1">¡Listo!</p>
              <p className="text-zinc-400 text-sm mb-4">{moveSuccess}</p>
              <Button onClick={() => setMoveModal({ open: false, inv: null })}>Cerrar</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal mover trabajador */}
      <Modal open={moveWorkerModal.open} onClose={() => !movingWorker && setMoveWorkerModal({ open: false, worker: null })}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white text-white">Mover trabajador</h3>
              <p className="text-xs text-zinc-400">{moveWorkerModal.worker?.name || moveWorkerModal.worker?.email}</p>
            </div>
            <Button variant="icon" onClick={() => !movingWorker && setMoveWorkerModal({ open: false, worker: null })}><X className="w-4 h-4" /></Button>
          </div>
          {!moveWorkerSuccess ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <Input className="pl-9" value={workerCompanySearch} onChange={e => { setWorkerCompanySearch(e.target.value); searchWorkerCompanies(e.target.value); setTargetWorkerCompany(null); }} placeholder="Empresa destino..." disabled={movingWorker} />
                {workerCompanySearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 animate-spin" />}
              </div>
              {workerCompanyResults.length > 0 && !targetWorkerCompany && (
                <div className="mb-3 rounded-lg border border-white/[0.08] border-white/[0.08] overflow-hidden">
                  {workerCompanyResults.map(c => (
                    <button key={c.id} onClick={() => { setTargetWorkerCompany(c); setWorkerCompanyResults([]); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] transition-colors text-left border-b border-white/[0.06] border-white/[0.06] last:border-0 bg-transparent cursor-pointer">
                      <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div><p className="text-sm font-medium text-white text-white">{c.name}</p><p className="text-xs text-zinc-400">{c.plan}</p></div>
                    </button>
                  ))}
                </div>
              )}
              {targetWorkerCompany && (
                <div className="mb-4 p-3 rounded-lg border border-amber-200 border-amber-500/[0.15] bg-amber-50 bg-amber-500/[0.08] flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-amber-600 text-amber-400 shrink-0" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex-1">{targetWorkerCompany.name}</p>
                  <button onClick={() => setTargetWorkerCompany(null)} className="text-zinc-400 bg-transparent border-0 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              {moveWorkerError && <p className="mb-4 text-xs text-red-600 text-red-400 bg-red-50 bg-red-500/[0.08] border border-red-200 border-red-500/[0.15] rounded-lg px-3 py-2">{moveWorkerError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMoveWorkerModal({ open: false, worker: null })} className="flex-1" disabled={movingWorker}>Cancelar</Button>
                <Button onClick={handleMoveWorker} disabled={!targetWorkerCompany || movingWorker} className="flex-1">
                  {movingWorker ? <><Loader2 className="w-4 h-4 animate-spin" /> Moviendo...</> : <><MoveRight className="w-4 h-4" /> Mover</>}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-white text-white mb-1">¡Listo!</p>
              <p className="text-zinc-400 text-sm mb-4">{moveWorkerSuccess}</p>
              <Button onClick={() => setMoveWorkerModal({ open: false, worker: null })}>Cerrar</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal sesión / impersonación */}
      <Modal open={sessionModal} onClose={() => setSessionModal(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white text-white">Elegir perfil</h3>
              <p className="text-xs text-zinc-400">{company?.name}</p>
            </div>
            <Button variant="icon" onClick={() => setSessionModal(false)}><X className="w-4 h-4" /></Button>
          </div>
          {workers.length === 0 ? (
            <p className="text-center text-zinc-400 text-sm py-8">No hay usuarios en esta empresa</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {[...workers].sort((a, b) => { if (a.role === 'ADMIN') return -1; if (b.role === 'ADMIN') return 1; return (a.name || '').localeCompare(b.name || ''); }).map(worker => (
                <button key={worker.id} onClick={() => handleImpersonateWorker(worker)} disabled={!!impersonatingWorker}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-white/[0.08] border-white/[0.08] hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] transition-all text-left cursor-pointer disabled:opacity-50 bg-transparent"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${worker.role === 'ADMIN' ? 'bg-amber-50 bg-amber-500/[0.08] text-amber-700 text-amber-400' : 'bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] text-zinc-600 text-zinc-300'}`}>
                    {(worker.name || worker.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white text-white truncate">{worker.name || 'Sin nombre'}</p>
                    <p className="text-xs text-zinc-400 truncate">{worker.email || worker.id}</p>
                  </div>
                  <Badge variant={worker.role === 'ADMIN' ? 'warning' : 'default'}>{worker.role || 'WORKER'}</Badge>
                  {impersonatingWorker === worker.id ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400 shrink-0" /> : <LogIn className="w-4 h-4 text-zinc-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Preview pantalla de bloqueo del cliente */}
      {previewBlock && (
        <div className="fixed inset-0 z-[300]">
          <SubscriptionExpiredScreen billingExpired={previewBlock === 'billing'} />
          {/* Bloquea clicks internos */}
          <div className="absolute inset-0 z-[350]" />
          <button
            onClick={() => setPreviewBlock(null)}
            className="fixed top-4 right-4 z-[400] w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-white/10 text-[11px] text-zinc-400 backdrop-blur-sm pointer-events-none">
            <Eye className="w-3 h-3" />
            Vista del cliente — {company?.name} · {previewBlock === 'trial' ? 'Trial expirado' : 'Suscripción vencida'}
          </div>
        </div>
      )}
    </div>
  );
}
