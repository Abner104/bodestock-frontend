// src/pages/SuperAdminEmpresas.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import CountUp from 'react-countup';
import {
  Building2, Users, DollarSign, CheckCircle, Search, Filter,
  Edit2, Eye, AlertCircle, XCircle, BarChart3, RefreshCw,
  Activity, Trash2, Calendar, MoreVertical, Check, X, Percent,
  CreditCard, Gift, Receipt, ChevronDown, ChevronUp, LogIn,
  Loader2, Bell, Send, ExternalLink, Sparkles, Download,
} from 'lucide-react';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import GlobalLoading from '../components/GlobalLoading';
import { SUPER_ADMIN_EMAIL, API_URL } from '../config/env.js';
import logger from '../utils/logger';
import { ADDONS } from '../config/plan-features';
import { Card, CardContent } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || API_URL;
const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
const PLAN_LABELS  = { trial: 'Trial', basico: 'Básico', profesional: 'Pro', personalizado: 'Custom', free: 'Free' };
const planVariant  = { trial: 'trial', basico: 'default', profesional: 'pro', personalizado: 'custom', free: 'free' };
const statusVariant = { active: 'active', trial: 'trial', suspended: 'suspended', cancelled: 'muted', deleted: 'muted' };

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 disabled:opacity-50 transition-all ${className}`}
      {...props}
    />
  );
}

function SelectField({ className = '', ...props }) {
  return (
    <select
      className={`w-full px-3 py-2 rounded-lg border border-white/[0.08] border-white/[0.08] bg-white/[0.05] bg-white/[0.05]/[0.06] text-white text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-zinc-600 cursor-pointer disabled:opacity-50 transition-all ${className}`}
      {...props}
    />
  );
}

function Modal({ open, onClose, children, maxWidth = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`w-full bg-white/[0.05] bg-[#13131a] border border-white/[0.08] border-white/[0.06] rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default function SuperAdminEmpresas() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPlan, setEditPlan] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editTrialDays, setEditTrialDays] = useState(14);
  const [editAddons, setEditAddons] = useState([]);
  const [editMonthlyAmount, setEditMonthlyAmount] = useState('');
  const [editNextBillingDate, setEditNextBillingDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [impersonatingId, setImpersonatingId] = useState(null);
  const [sessionModal, setSessionModal] = useState(null);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [impersonatingWorker, setImpersonatingWorker] = useState(null);
  const [workersError, setWorkersError] = useState(null);
  const [companyPayments, setCompanyPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [sendingBillingEmail, setSendingBillingEmail] = useState(false);
  const [billingLinkLoading, setBillingLinkLoading] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [changeEmailOldEmail, setChangeEmailOldEmail] = useState('');
  const [changeEmailNewEmail, setChangeEmailNewEmail] = useState('');
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState('');
  const [changeEmailSuccess, setChangeEmailSuccess] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== SUPER_ADMIN_EMAIL) { window.location.href = '/login'; return; }
    loadData();
  }, []);

  useEffect(() => {
    const close = () => setOpenDropdown(null);
    if (openDropdown) { document.addEventListener('click', close); return () => document.removeEventListener('click', close); }
  }, [openDropdown]);

  const loadData = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'companies'));
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setError('');
    } catch (err) {
      logger.error('Error cargando empresas:', err);
      setError(err.message || 'Error al cargar datos.');
    } finally { setLoading(false); }
  };

  const loadCompanyPayments = async (companyId) => {
    try {
      setLoadingPayments(true);
      setCompanyPayments([]);
      const q = query(collection(db, `companies/${companyId}/payments`), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setCompanyPayments(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        date: d.data().createdAt?.toDate?.() || (d.data().date ? new Date(d.data().date) : null),
      })));
    } catch { setCompanyPayments([]); }
    finally { setLoadingPayments(false); }
  };

  const handleOpenSessionModal = async (company) => {
    setWorkersError(null);
    setLoadingWorkers(true);
    setSessionModal({ company, workers: [] });
    try {
      const resp = await fetch(FUNCTIONS_ENDPOINTS.LIST_USERS);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error listando usuarios');
      const workers = (data.users || [])
        .filter(u => u.customClaims?.companyId === company.id)
        .map(u => ({ id: u.uid, uid: u.uid, email: u.email, name: u.displayName || u.email, role: u.customClaims?.role || 'WORKER' }))
        .sort((a, b) => {
          if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
          if (b.role === 'ADMIN' && a.role !== 'ADMIN') return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
      setSessionModal({ company, workers });
    } catch (err) {
      setWorkersError(err.message);
      setSessionModal({ company, workers: [] });
    } finally { setLoadingWorkers(false); }
  };

  const handleImpersonate = async (company, worker) => {
    try {
      setImpersonatingWorker(worker.id);
      const targetUid = worker.uid || worker.firebaseUid || worker.id;
      const superAdminUid = auth.currentUser?.uid;
      const [res, superAdminRes] = await Promise.all([
        fetch(FUNCTIONS_ENDPOINTS.IMPERSONATE_USER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUid, companyId: company.id }) }),
        fetch(FUNCTIONS_ENDPOINTS.IMPERSONATE_USER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUid: superAdminUid }) }),
      ]);
      const data = await res.json();
      const superAdminData = await superAdminRes.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Error al impersonar');
      sessionStorage.setItem('impersonation', JSON.stringify({
        active: true, companyName: company.name || 'Empresa', companyId: company.id,
        workerName: worker.name || worker.email || 'Usuario', returnPath: `/super-admin/empresas`,
        superAdminToken: superAdminData.customToken || null,
      }));
      await signInWithCustomToken(auth, data.customToken);
      window.location.href = '/';
    } catch (err) {
      alert('Error al entrar como empresa: ' + err.message);
    } finally { setImpersonatingWorker(null); }
  };

  const handleEditClick = (company) => {
    setSelectedCompany(company);
    setEditPlan(company.plan);
    setEditStatus(company.status);
    setEditDiscount(company.discount || 0);
    setEditTrialDays(company.trialDays || 14);
    setEditAddons(company.addons || []);
    setEditMonthlyAmount(company.monthlyAmount != null ? String(company.monthlyAmount) : '');
    setEditNextBillingDate(
      company.nextBillingDate
        ? (company.nextBillingDate.toDate
          ? company.nextBillingDate.toDate().toISOString().split('T')[0]
          : new Date(company.nextBillingDate).toISOString().split('T')[0])
        : ''
    );
    setShowEditModal(true);
  };

  const handleRegisterCashPayment = async () => {
    if (!selectedCompany) return;
    const amount = editMonthlyAmount || selectedCompany.monthlyAmount;
    if (!amount) { alert('Primero ingresa el monto mensual.'); return; }
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    try {
      setSaving(true);
      const { addDoc, collection: col } = await import('firebase/firestore');
      await updateDoc(doc(db, 'companies', selectedCompany.id), {
        status: 'active', plan: editPlan || selectedCompany.plan,
        monthlyAmount: parseFloat(amount),
        nextBillingDate: Timestamp.fromDate(nextMonth),
        lastPaymentMethod: 'efectivo', lastPaymentDate: Timestamp.fromDate(now),
        lastPayment: { amount: parseFloat(amount), date: now.toISOString(), method: 'efectivo' },
      });
      await addDoc(col(db, `companies/${selectedCompany.id}/payments`), {
        amount: parseFloat(amount), status: 'approved',
        planName: editPlan || selectedCompany.plan, plan: editPlan || selectedCompany.plan,
        paymentMethod: 'efectivo', date: now.toISOString(), createdAt: Timestamp.fromDate(now),
      });
      await loadData();
      setShowEditModal(false);
      setSelectedCompany(null);
      alert(`✅ Pago registrado: ${CLP(amount)}. Próximo cobro: ${nextMonth.toLocaleDateString('es-CL')}`);
    } catch (err) { alert('Error al registrar pago: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!selectedCompany) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'companies', selectedCompany.id), {
        plan: editPlan, status: editStatus,
        discount: parseFloat(editDiscount) || 0,
        trialDays: parseInt(editTrialDays) || 14,
        addons: editAddons,
        monthlyAmount: editMonthlyAmount !== '' ? parseFloat(editMonthlyAmount) : null,
        nextBillingDate: editNextBillingDate ? Timestamp.fromDate(new Date(editNextBillingDate + 'T12:00:00')) : null,
      });
      await loadData();
      setShowEditModal(false);
      setSelectedCompany(null);
    } catch (err) { alert('Error al actualizar empresa: ' + err.message); }
    finally { setSaving(false); }
  };

  const quickUpdateCompany = async (companyId, updates) => {
    try { await updateDoc(doc(db, 'companies', companyId), updates); await loadData(); }
    catch (err) { alert('Error: ' + err.message); }
  };

  const quickToggleStatus = (company) =>
    quickUpdateCompany(company.id, { status: company.status === 'active' ? 'suspended' : 'active' });

  const handleDeleteCompany = async (company) => {
    const userInput = prompt(`⚠️ Escribe el nombre de la empresa para confirmar la eliminación:\n"${company.name}"`);
    if (!userInput || userInput.trim().toLowerCase() !== company.name.toLowerCase()) { alert('Cancelado.'); return; }
    try {
      setSaving(true);
      await deleteDoc(doc(db, 'companies', company.id));
      await loadData();
      setShowDetails(false); setShowEditModal(false); setSelectedCompany(null);
    } catch (err) { alert('Error al eliminar: ' + err.message); }
    finally { setSaving(false); }
  };

  const daysUntilBilling = (company) => {
    if (!company.nextBillingDate) return null;
    const raw = company.nextBillingDate.toDate ? company.nextBillingDate.toDate() : new Date(company.nextBillingDate);
    const d = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate(), 12, 0, 0);
    return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  };

  const handleSendBillingEmail = async (company) => {
    try {
      setSendingBillingEmail(true);
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/payments/send-billing-email`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al enviar');
      alert(`✅ Email enviado a ${company.adminEmail}`);
    } catch (err) { alert('❌ Error: ' + err.message); }
    finally { setSendingBillingEmail(false); }
  };

  const handleCreateBillingLink = async (company) => {
    try {
      setBillingLinkLoading(true);
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/payments/create-billing-link`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, companyName: company.name, amount: company.monthlyAmount, adminEmail: company.adminEmail }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      const data = await res.json();
      window.open(data.paymentUrl || data.sandboxUrl, '_blank');
    } catch (err) { alert('❌ Error generando link: ' + err.message); }
    finally { setBillingLinkLoading(false); }
  };

  const handleChangeEmail = async () => {
    setChangeEmailError(''); setChangeEmailSuccess('');
    const oldEmail = changeEmailOldEmail.trim().toLowerCase();
    const newEmail = changeEmailNewEmail.trim().toLowerCase();
    if (!oldEmail || !newEmail) { setChangeEmailError('Completa ambos campos.'); return; }
    if (!newEmail.includes('@')) { setChangeEmailError('Email inválido.'); return; }
    setChangeEmailLoading(true);
    try {
      const lookupRes = await fetch(`${BACKEND_URL}/api/users/by-email/${encodeURIComponent(oldEmail)}`);
      const lookupData = await lookupRes.json();
      if (!lookupData.success) { setChangeEmailError(lookupData.error || 'Usuario no encontrado.'); return; }
      const updateRes = await fetch(`${BACKEND_URL}/api/users/${lookupData.uid}/email`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newEmail }),
      });
      const updateData = await updateRes.json();
      if (!updateData.success) { setChangeEmailError(updateData.error || 'Error actualizando.'); return; }
      setChangeEmailSuccess(`Email actualizado: ${newEmail}`);
      setChangeEmailOldEmail(''); setChangeEmailNewEmail('');
    } catch { setChangeEmailError('Error de conexión.'); }
    finally { setChangeEmailLoading(false); }
  };

  const handleExportExcel = async () => {
    try {
      const { utils, writeFile } = await import('xlsx');
      const rows = filteredCompanies.map(c => ({
        Nombre: c.name || '', Email: c.adminEmail || c.email || '',
        Plan: PLAN_LABELS[c.plan] || c.plan || '', Estado: c.status || '',
        Mensualidad: c.monthlyAmount || 0,
        'Próximo cobro': c.nextBillingDate?.toDate ? c.nextBillingDate.toDate().toLocaleDateString('es-CL') : '',
        'Código referido': c.referralCode || '', ID: c.id,
      }));
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Empresas');
      writeFile(wb, `empresas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) { console.error(err); }
  };

  if (loading) return <GlobalLoading />;

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-8 text-center max-w-sm w-full">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="font-semibold text-white text-white mb-1">Error</p>
        <p className="text-zinc-500 text-sm mb-4">{error}</p>
        <Button onClick={loadData}>Reintentar</Button>
      </Card>
    </div>
  );

  const now = new Date();
  const realMRR = companies.reduce((t, c) => {
    if (c.status !== 'active' || !c.plan || c.plan === 'free' || c.plan === 'trial') return t;
    return t + (c.monthlyAmount || 0);
  }, 0);

  const filteredCompanies = companies.filter(c => {
    const matchSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPlan   = filterPlan === 'all' || c.plan === filterPlan;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchPlan && matchStatus;
  });

  const kpis = [
    { icon: Building2,   label: 'Total',    value: companies.length },
    { icon: CheckCircle, label: 'Activas',  value: companies.filter(c => c.status === 'active').length },
    { icon: Users,       label: 'En Trial', value: companies.filter(c => c.plan === 'trial' || c.status === 'trial').length },
    { icon: DollarSign,  label: 'MRR',      value: CLP(realMRR), isText: true },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white text-white">Empresas</h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ icon: Icon, label, value, isText }) => (
          <Card key={label} className="p-4">
            <div className="w-8 h-8 rounded-lg bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center mb-3">
              <Icon className="w-4 h-4 text-zinc-500 text-zinc-400" />
            </div>
            <p className="text-xl font-bold text-white text-white leading-none mb-1">{value}</p>
            <p className="text-xs text-zinc-500 text-zinc-400">{label}</p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input className="pl-9" placeholder="Buscar empresa o email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <SelectField className="pl-9" value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
              <option value="all">Todos los planes</option>
              <option value="trial">Trial</option>
              <option value="basico">Básico</option>
              <option value="profesional">Profesional</option>
              <option value="personalizado">Personalizado</option>
            </SelectField>
          </div>
          <div className="relative">
            <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <SelectField className="pl-9" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspendido</option>
              <option value="cancelled">Cancelado</option>
            </SelectField>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] border-white/[0.06]">
          <div>
            <p className="text-sm font-semibold text-white text-white">Empresas registradas</p>
            <p className="text-xs text-zinc-400 mt-0.5">{filteredCompanies.length} de {companies.length}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setChangeEmailError(''); setChangeEmailSuccess(''); setShowChangeEmailModal(true); }}>
              Cambiar email
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
          </div>
        </div>

        {/* Mobile — lista compacta */}
        <div className="md:hidden divide-y divide-white/[0.05]">
          {filteredCompanies.map((company) => {
            const days = daysUntilBilling(company);
            const isAtRisk = ['billing_expired','trial_expired','suspended','cancelled'].includes(company.status) || (days !== null && days <= 3 && days >= 0);
            return (
              <div
                key={company.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                onClick={() => navigate(`/super-admin/empresa/${company.id}`)}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0 ${
                  isAtRisk ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.07] text-zinc-300'
                }`}>
                  {(company.name || 'E').charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-white truncate">{company.name}</p>
                    {isAtRisk && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant={planVariant[company.plan || 'free'] || 'muted'} className="text-[9px]">
                      {PLAN_LABELS[company.plan] || company.plan}
                    </Badge>
                    {company.monthlyAmount > 0 && (
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        ${company.monthlyAmount.toLocaleString('es-CL')}
                      </span>
                    )}
                    {days !== null && days <= 3 && days >= 0 && (
                      <span className="text-[10px] font-bold text-amber-400">
                        {days === 0 ? 'vence hoy' : `${days}d`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acción rápida */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSessionModal(company)}
                    className="gap-1 text-[11px] px-2.5 py-1.5"
                  >
                    <LogIn className="w-3 h-3" />
                    Entrar
                  </Button>
                  <Button variant="icon" onClick={() => handleEditClick(company)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] border-white/[0.06]">
                {['Empresa', 'Plan', 'Estado', 'Usuarios', 'Mensualidad', 'Acciones'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredCompanies.map((company) => {
                const days = daysUntilBilling(company);
                return (
                  <tr key={company.id} className="hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.03] transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center text-zinc-600 text-zinc-300 text-xs font-semibold shrink-0">
                          {(company.name || 'E').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white text-white">{company.name}</p>
                          <p className="text-xs text-zinc-400">{company.adminEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={planVariant[company.plan || 'free'] || 'muted'}>{PLAN_LABELS[company.plan || 'free']}</Badge>
                        {company.discount > 0 && <Badge variant="success">-{company.discount}%</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant[company.status] || 'muted'} dot>{company.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-500 text-zinc-400">{company.usage?.users || 0}</td>
                    <td className="px-5 py-3">
                      {company.monthlyAmount != null ? (
                        <div>
                          <p className="text-sm font-semibold text-emerald-600 text-emerald-400">{CLP(company.monthlyAmount)}</p>
                          {company.nextBillingDate && (() => {
                            const bdRaw = company.nextBillingDate.toDate ? company.nextBillingDate.toDate() : new Date(company.nextBillingDate);
                            const bd = new Date(bdRaw.getFullYear(), bdRaw.getMonth(), bdRaw.getDate(), 12, 0, 0);
                            return (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-zinc-400" />
                                <span className="text-xs text-zinc-400">{bd.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</span>
                                {days !== null && days <= 3 && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${days < 0 ? 'bg-red-50 bg-red-500/[0.08] text-red-600 text-red-400' : 'bg-amber-50 bg-amber-500/[0.08] text-amber-600 text-amber-400'}`}>
                                    {days < 0 ? `+${Math.abs(days)}d` : days === 0 ? 'hoy' : `${days}d`}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ) : <span className="text-zinc-300 text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="icon" onClick={() => { setSelectedCompany(company); setShowDetails(true); }} title="Ver detalles"><Eye className="w-3.5 h-3.5" /></Button>
                        <Button variant="icon" onClick={() => navigate(`/super-admin/empresa/${company.id}`)} title="Analytics"><BarChart3 className="w-3.5 h-3.5" /></Button>
                        <Button variant="icon" onClick={() => handleOpenSessionModal(company)} title="Entrar como empresa" className="text-amber-500 text-amber-400"><LogIn className="w-3.5 h-3.5" /></Button>
                        <Button variant="icon" onClick={() => handleEditClick(company)} title="Editar"><Edit2 className="w-3.5 h-3.5" /></Button>
                        <div className="relative">
                          <Button variant="icon" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === company.id ? null : company.id); }} title="Más">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                          {openDropdown === company.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white/[0.05] bg-[#13131a] border border-white/[0.08] border-white/[0.06] rounded-lg shadow-lg z-50 py-1">
                              <button onClick={() => { quickToggleStatus(company); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 text-zinc-300 hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] transition-colors bg-transparent border-0 cursor-pointer text-left">
                                {company.status === 'active' ? <><X className="w-4 h-4 text-amber-500" /> Suspender</> : <><Check className="w-4 h-4 text-emerald-500" /> Activar</>}
                              </button>
                              <div className="h-px mx-3 my-1 bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06]" />
                              <p className="px-3 py-1 text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">Descuento rápido</p>
                              {[10, 20, 50].map(d => (
                                <button key={d} onClick={() => { quickUpdateCompany(company.id, { discount: d }); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 text-zinc-300 hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] transition-colors bg-transparent border-0 cursor-pointer text-left">
                                  <Percent className="w-4 h-4 text-zinc-400" /> {d}% OFF
                                </button>
                              ))}
                              <div className="h-px mx-3 my-1 bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06]" />
                              <button onClick={() => { handleDeleteCompany(company); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors bg-transparent border-0 cursor-pointer text-left">
                                <Trash2 className="w-4 h-4" /> Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCompanies.length === 0 && (
            <div className="py-16 text-center text-zinc-400 text-sm">Sin resultados</div>
          )}
        </div>
      </Card>

      {/* Modal Detalles */}
      <Modal open={showDetails && !!selectedCompany} onClose={() => { setShowDetails(false); setShowPayments(false); setCompanyPayments([]); }}>
        {selectedCompany && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center text-zinc-300 text-zinc-200 font-bold text-lg">
                  {(selectedCompany.name || 'E').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white text-white">{selectedCompany.name}</h2>
                  <p className="text-xs text-zinc-400">Detalles de empresa</p>
                </div>
              </div>
              <Button variant="icon" onClick={() => { setShowDetails(false); setShowPayments(false); setCompanyPayments([]); }}><X className="w-4 h-4" /></Button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                ['Email', selectedCompany.adminEmail],
                ['Plan', <Badge variant={planVariant[selectedCompany.plan || 'free']}>{PLAN_LABELS[selectedCompany.plan] || selectedCompany.plan}</Badge>],
                ['Estado', <Badge variant={statusVariant[selectedCompany.status] || 'muted'} dot>{selectedCompany.status}</Badge>],
                ['Usuarios', selectedCompany.usage?.users || 0],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg border border-white/[0.06] border-white/[0.06] bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.04] p-3">
                  <p className="text-xs text-zinc-400 mb-1">{label}</p>
                  <p className="text-sm font-medium text-white text-white">{val}</p>
                </div>
              ))}
            </div>

            {/* Último pago */}
            {selectedCompany.lastPayment && (
              <div className="rounded-lg border border-white/[0.06] border-white/[0.06] p-3 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-zinc-500 text-zinc-400">
                  <CreditCard className="w-3.5 h-3.5" />
                  Último pago: {selectedCompany.lastPayment.date ? new Date(selectedCompany.lastPayment.date).toLocaleDateString('es-CL') : 'N/A'}
                </div>
                <span className="text-sm font-bold text-emerald-600 text-emerald-400">{CLP(selectedCompany.lastPayment.amount || 0)}</span>
              </div>
            )}

            {/* Historial pagos */}
            <div className="mb-3">
              <button
                onClick={() => { if (!showPayments) { setShowPayments(true); loadCompanyPayments(selectedCompany.id); } else setShowPayments(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-white/[0.08] border-white/[0.08] hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] transition-colors text-sm cursor-pointer bg-transparent"
              >
                <div className="flex items-center gap-2 text-zinc-300 text-zinc-300 font-medium">
                  <Receipt className="w-4 h-4" /> Historial de pagos
                </div>
                {showPayments ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </button>
              {showPayments && (
                <div className="mt-2 space-y-1.5 max-h-52 overflow-y-auto">
                  {loadingPayments ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-zinc-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
                  ) : companyPayments.length === 0 ? (
                    <div className="text-center py-6 text-zinc-400 text-sm">Sin pagos registrados</div>
                  ) : companyPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] border-white/[0.06] p-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${payment.status === 'approved' ? 'bg-emerald-50 bg-emerald-500/[0.08]' : 'bg-amber-50 bg-amber-500/[0.08]'}`}>
                          <CreditCard className={`w-4 h-4 ${payment.status === 'approved' ? 'text-emerald-600 text-emerald-400' : 'text-amber-600 text-amber-400'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white text-white">Plan {payment.planName || payment.plan}</p>
                          <p className="text-xs text-zinc-400">
                            {payment.date ? new Date(payment.date).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Sin fecha'}
                            {payment.paymentMethod && ` · ${payment.paymentMethod}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600 text-emerald-400">{CLP(payment.amount || 0)}</p>
                        <Badge variant={payment.status === 'approved' ? 'success' : 'warning'}>{payment.status === 'approved' ? 'Aprobado' : payment.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alerta cobro */}
            {(() => {
              const days = daysUntilBilling(selectedCompany);
              if (days === null || selectedCompany.monthlyAmount == null) return null;
              const isOverdue = days < 0;
              const isUrgent = days <= 3;
              return (
                <div className={`mb-4 p-4 rounded-lg border ${isOverdue ? 'bg-red-50 bg-red-500/[0.08] border-red-200 border-red-500/[0.15]' : isUrgent ? 'bg-amber-50 bg-amber-500/[0.08] border-amber-200 border-amber-500/[0.15]' : 'bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.06] border-white/[0.08] border-white/[0.08]'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className={`w-4 h-4 ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-zinc-400'}`} />
                    <span className={`text-sm font-medium ${isOverdue ? 'text-red-700 text-red-400' : isUrgent ? 'text-amber-700 text-amber-400' : 'text-zinc-600 text-zinc-400'}`}>
                      {isOverdue ? `Cobro vencido hace ${Math.abs(days)}d` : days === 0 ? 'El cobro es hoy' : `Cobro en ${days}d`}
                    </span>
                    <span className="ml-auto text-sm font-bold text-emerald-600 text-emerald-400">{CLP(selectedCompany.monthlyAmount)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSendBillingEmail(selectedCompany)} disabled={sendingBillingEmail}>
                      {sendingBillingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Email de cobro
                    </Button>
                    {selectedCompany.monthlyAmount > 0 && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleCreateBillingLink(selectedCompany)} disabled={billingLinkLoading}>
                        {billingLinkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />} Link de pago
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { setShowDetails(false); setShowPayments(false); setCompanyPayments([]); handleEditClick(selectedCompany); }}>
                <Edit2 className="w-4 h-4" /> Editar
              </Button>
              <Button variant="danger" onClick={() => handleDeleteCompany(selectedCompany)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Editar */}
      <Modal open={showEditModal && !!selectedCompany} onClose={() => !saving && setShowEditModal(false)} maxWidth="max-w-md">
        {selectedCompany && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white text-white">Editar empresa</h2>
              <Button variant="icon" onClick={() => !saving && setShowEditModal(false)} disabled={saving}><X className="w-4 h-4" /></Button>
            </div>

            <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] border-white/[0.06] bg-white/[0.05]/[0.02] bg-white/[0.05]/[0.04] p-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-white/[0.05]/[0.08] bg-zinc-700 flex items-center justify-center text-zinc-600 text-zinc-300 font-semibold text-sm">
                {(selectedCompany.name || 'E').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white text-white">{selectedCompany.name}</p>
                <p className="text-xs text-zinc-400">{selectedCompany.adminEmail}</p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Plan</label>
                <SelectField value={editPlan} onChange={(e) => setEditPlan(e.target.value)} disabled={saving}>
                  <option value="trial">Trial</option>
                  <option value="basico">Básico</option>
                  <option value="profesional">Profesional</option>
                  <option value="personalizado">Personalizado</option>
                </SelectField>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Estado</label>
                <SelectField value={editStatus} onChange={(e) => setEditStatus(e.target.value)} disabled={saving}>
                  <option value="active">Activo</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspendido</option>
                  <option value="cancelled">Cancelado</option>
                </SelectField>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Descuento (%)</label>
                <Input type="number" min="0" max="100" value={editDiscount} onChange={(e) => setEditDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} disabled={saving} placeholder="0" />
              </div>

              {editStatus === 'trial' && (
                <div>
                  <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Días de trial</label>
                  <Input type="number" min="1" max="365" value={editTrialDays} onChange={(e) => setEditTrialDays(parseInt(e.target.value) || 14)} disabled={saving} />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Add-ons</label>
                <div className="space-y-1">
                  {Object.values(ADDONS).map(addon => {
                    const active = editAddons.includes(addon.id);
                    return (
                      <button key={addon.id} type="button" disabled={saving}
                        onClick={() => setEditAddons(prev => prev.includes(addon.id) ? prev.filter(a => a !== addon.id) : [...prev, addon.id])}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border cursor-pointer bg-transparent transition-all ${active ? 'bg-zinc-900 dark:bg-white/[0.05] border-zinc-900 dark:border-white text-white text-white' : 'border-white/[0.08] border-white/[0.08] text-zinc-600 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                      >
                        <span>{addon.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs opacity-60">+{CLP(addon.price)}</span>
                          {active ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-current opacity-30" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Monto mensual</label>
                  <Input type="number" value={editMonthlyAmount} onChange={(e) => setEditMonthlyAmount(e.target.value)} disabled={saving} placeholder="29990" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Próximo cobro</label>
                  <Input type="date" value={editNextBillingDate} onChange={(e) => setEditNextBillingDate(e.target.value)} disabled={saving} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700" onClick={handleRegisterCashPayment} disabled={saving}>
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Registrando...</> : <>💵 Registrar pago en efectivo</>}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)} disabled={saving}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : <><Check className="w-4 h-4" /> Guardar</>}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Sesión */}
      <Modal open={!!sessionModal} onClose={() => setSessionModal(null)} maxWidth="max-w-md">
        {sessionModal && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-white text-white">Elegir sesión</h3>
                <p className="text-xs text-zinc-400">{sessionModal.company.name}</p>
              </div>
              <Button variant="icon" onClick={() => setSessionModal(null)}><X className="w-4 h-4" /></Button>
            </div>
            {loadingWorkers ? (
              <div className="flex items-center justify-center py-10 gap-2 text-zinc-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando usuarios...</div>
            ) : workersError ? (
              <div className="text-center py-8"><p className="text-red-500 text-sm mb-1">Error cargando usuarios</p><p className="text-zinc-400 text-xs">{workersError}</p></div>
            ) : sessionModal.workers.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-sm">No se encontraron usuarios</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {sessionModal.workers.map(worker => (
                  <button key={worker.id} onClick={() => handleImpersonate(sessionModal.company, worker)} disabled={impersonatingWorker === worker.id}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-white/[0.08] border-white/[0.08] hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] transition-all text-left cursor-pointer disabled:opacity-50 bg-transparent"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${worker.role === 'ADMIN' ? 'bg-amber-50 bg-amber-500/[0.08] text-amber-700 text-amber-400' : 'bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] text-zinc-600 text-zinc-300'}`}>
                      {(worker.name || worker.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white text-white truncate">{worker.name || 'Sin nombre'}</p>
                      <p className="text-xs text-zinc-400 truncate">{worker.email}</p>
                    </div>
                    <Badge variant={worker.role === 'ADMIN' ? 'warning' : 'default'}>{worker.role || 'WORKER'}</Badge>
                    {impersonatingWorker === worker.id ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400 shrink-0" /> : <LogIn className="w-4 h-4 text-zinc-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal cambio email */}
      <Modal open={showChangeEmailModal} onClose={() => setShowChangeEmailModal(false)} maxWidth="max-w-md">
        <div className="p-6">
          <h3 className="text-base font-semibold text-white text-white mb-1">Cambiar email de usuario</h3>
          <p className="text-sm text-zinc-400 mb-5">Actualiza el email de autenticación en Firebase Auth.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Email actual</label>
              <Input placeholder="correo@ejemplo.com" value={changeEmailOldEmail} onChange={(e) => setChangeEmailOldEmail(e.target.value)} disabled={changeEmailLoading} />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 text-zinc-400 mb-1.5 block">Nuevo email</label>
              <Input placeholder="nuevo@ejemplo.com" value={changeEmailNewEmail} onChange={(e) => setChangeEmailNewEmail(e.target.value)} disabled={changeEmailLoading} />
            </div>
            {changeEmailError && <p className="text-red-600 text-red-400 text-xs bg-red-50 bg-red-500/[0.08] border border-red-200 border-red-500/[0.15] rounded-lg px-3 py-2">{changeEmailError}</p>}
            {changeEmailSuccess && <p className="text-emerald-600 text-emerald-400 text-xs bg-emerald-50 bg-emerald-500/[0.08] border border-emerald-200 border-emerald-500/[0.15] rounded-lg px-3 py-2">{changeEmailSuccess}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowChangeEmailModal(false)} disabled={changeEmailLoading}>Cancelar</Button>
              <Button className="flex-1" onClick={handleChangeEmail} disabled={changeEmailLoading}>
                {changeEmailLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Cambiando...</> : 'Cambiar email'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
