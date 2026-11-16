// src/pages/WorkersManagement.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Shield,
  DollarSign,
  Warehouse,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  KeyRound,
  Copy,
  X,
  Mail,
  Percent,
  ShoppingBag,
  Wallet
} from 'lucide-react';
import {
  createWorker,
  getAllWorkers,
  getAllRoles,
  updateWorker,
  deactivateWorker,
  formatCLP,
  isSystemInitialized,
  initializeSystemRoles
} from '../services/workers-service.js';
import { useTheme } from '../contexts/ThemeContext';
import GlobalLoading from '../components/GlobalLoading.jsx';
import {
  createFirebaseUser,
  generateWorkerCredentials
} from '../services/auth-service.js';
import { LIMIT_TYPES } from '../config/database-schema.js';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase.js';
import { useToast, ToastContainer } from '../components/ui/Toast.jsx';
import { getUserCompanyId, companyHasFoodBusiness } from '../services/companyService.js';
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import PermissionSelector from '../components/workers/PermissionSelector.jsx';
import RoleSelector from '../components/workers/RoleSelector.jsx';
import RolePermissionsDisplay from '../components/workers/RolePermissionsDisplay.jsx';
import CreateWorkerWizard from '../components/workers/CreateWorkerWizard.jsx';
import SendEmailModal from '../components/workers/SendEmailModal.jsx';
import { API_URL } from '../config/env';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { calculatePayroll } from '../agents/payrollAgent';

const WorkersManagement = () => {
  const { isDark } = useTheme();
  const { limits } = usePlanFeatures();
  // Estados principales
  const [workers, setWorkers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState(null);
  const [isFoodBusiness, setIsFoodBusiness] = useState(false);
  const onlineMap = useOnlineUsers(resolvedCompanyId);
  const [filterRole, setFilterRole] = useState('all');

  // Estados de modal
  const [modal, setModal] = useState({
    open: false,
    mode: 'create', // create, edit, view, credentials
    worker: null
  });

  // Estado para mostrar credenciales
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

  // Estado para enviar email a empleados
  const [emailModal, setEmailModal] = useState(false);

  // Estado para reset de contraseña
  const [resetModal, setResetModal] = useState({ open: false, worker: null });
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null); // { newPassword } o null
  const [resetErr, setResetErr] = useState('');

  // Estado para editar comisión de vendedor
  const [commissionModal, setCommissionModal] = useState({ open: false, worker: null, value: '' });
  const [commissionSaving, setCommissionSaving] = useState(false);

  // Estado para editar sueldo base -- aplica a cualquier rol (no solo
  // vendedores, a diferencia de la comisión), ver handleSaveBaseSalary.
  const [salaryModal, setSalaryModal] = useState({ open: false, worker: null, value: '' });
  const [salarySaving, setSalarySaving] = useState(false);

  // Panel "Sueldos del mes" -- resumen de calculatePayroll() (sueldo base +
  // comisión sobre ventas reales de cada persona este mes). Ver
  // src/agents/payrollAgent.js para el alcance deliberado (bruto a pagar,
  // no liquidación previsional).
  const [payrollPanel, setPayrollPanel] = useState({ open: false, loading: false, data: null, error: null });

  const [saving, setSaving] = useState(false);

  // Estado de formulario
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '', // Nueva contraseña para Firebase Auth
    generatePassword: true, // Si generar contraseña automática
    role: 'WORKER',
    limitType: 'MONEY',
    dailyLimitMoney: 10000,
    dailyLimitUnits: 5,
    assignedWarehouses: [],
    // Configuración de emails (solo para ADMIN)
    receiveAlerts: true,
    receiveReports: true,
    // Permisos personalizados
    customPermissions: []
  });

  // Toast notifications
  const toast = useToast();

  // ===== EFECTOS =====
  useEffect(() => {
    initializeAndLoadData();
  }, []);

  // ===== FUNCIONES DE INICIALIZACIÓN =====
  const initializeAndLoadData = async () => {
    try {
      setLoading(true);

      // Obtener companyId del admin actual
      const adminCompanyId = await getUserCompanyId();
      console.log('🏢 CompanyId del admin actual:', adminCompanyId);

      let foodBusiness = false;
      if (adminCompanyId) {
        setForm(prev => ({ ...prev, companyId: adminCompanyId }));
        setSelectedCompanyId(adminCompanyId);
        setResolvedCompanyId(adminCompanyId);
        setIsSuperAdmin(false);

        // Rol GARZÓN solo tiene sentido para negocios de comida (mismos rubros que usan recetas)
        foodBusiness = await companyHasFoodBusiness(adminCompanyId);
        setIsFoodBusiness(foodBusiness);
      } else {
        // Es super-admin, cargar lista de empresas
        console.warn('⚠️  Super admin sin companyId - cargando lista de empresas');
        setIsSuperAdmin(true);
        await loadCompanies();
      }

      // Verificar si el sistema está inicializado
      const initialized = await isSystemInitialized();
      if (!initialized) {
        console.log('Inicializando sistema de roles...');
        await initializeSystemRoles();
      }

      // Cargar todos los datos
      await Promise.all([
        loadWorkers(),
        loadRoles(foodBusiness),
        loadWarehouses(),
        loadInventories()
      ]);

    } catch (error) {
      console.error('Error inicializando sistema:', error);
      toast.error('Error al inicializar el sistema');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkers = async () => {
    try {
      // Si es super-admin y hay empresa seleccionada, cargar de esa empresa
      if (isSuperAdmin && selectedCompanyId) {
        const workersSnapshot = await getDocs(collection(db, `companies/${selectedCompanyId}/workers`));
        const workersData = workersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        }));
        setWorkers(workersData);
      } else if (!isSuperAdmin) {
        // Si no es super-admin, usar la función normal
        const workersData = await getAllWorkers();
        setWorkers(workersData);
      } else {
        // Super-admin sin empresa seleccionada
        setWorkers([]);
      }
    } catch (error) {
      console.error('Error cargando trabajadores:', error);
      toast.error('Error al cargar trabajadores');
    }
  };

  const loadRoles = async (foodBusiness = isFoodBusiness) => {
    try {
      const rolesData = await getAllRoles();
      // GARZÓN solo aplica a negocios de comida (heladería, cafetería, food truck, panadería, restaurante)
      const filtered = foodBusiness ? rolesData : rolesData.filter(r => r.id !== 'GARZON');
      setRoles(filtered);
    } catch (error) {
      console.error('Error cargando roles:', error);
      toast.error('Error al cargar roles');
    }
  };

  const loadWarehouses = async () => {
    try {
      const companyId = selectedCompanyId || await getUserCompanyId();
      if (!companyId) {
        console.error('No se pudo obtener companyId');
        toast.error('Error: No se pudo identificar la empresa del usuario');
        return;
      }

      const allWarehouses = [];

      // Bodegas de inventarios dinámicos (companies/{companyId}/inventories/{invId}/warehouses)
      const inventoriesSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
      for (const invDoc of inventoriesSnap.docs) {
        const invData = invDoc.data();
        const whSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/warehouses`));
        whSnap.docs.forEach(whDoc => {
          allWarehouses.push({
            id: whDoc.id,
            ...whDoc.data(),
            inventoryId: invDoc.id,
            inventoryName: invData.name || invData.nombre || invDoc.id
          });
        });
      }

      // Bodegas legacy (companies/{companyId}/warehouses)
      const legacySnap = await getDocs(collection(db, `companies/${companyId}/warehouses`));
      legacySnap.docs.forEach(doc => {
        if (!allWarehouses.find(w => w.id === doc.id)) {
          allWarehouses.push({ id: doc.id, ...doc.data(), inventoryId: null, inventoryName: 'Principal' });
        }
      });

      setWarehouses(allWarehouses);
      console.log('🏭 Bodegas cargadas:', allWarehouses.length);
    } catch (error) {
      console.error('Error cargando bodegas:', error);
      toast.error('Error al cargar bodegas');
    }
  };

  const loadInventories = async () => {
    try {
      const companyId = selectedCompanyId || await getUserCompanyId();
      if (!companyId) {
        console.error('No se pudo obtener companyId');
        return;
      }

      const allInventories = [];

      // 1. Cargar inventarios dinámicos (nueva estructura: companies/{companyId}/inventories)
      const inventoriesSnapshot = await getDocs(collection(db, `companies/${companyId}/inventories`));
      inventoriesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        allInventories.push({
          id: doc.id,
          name: data.name || data.nombre || data.displayName || data.title || doc.id,
          description: data.description || data.descripcion || '',
          ...data
        });
      });

      // 2. Incluir inventario principal (legacy: companies/{companyId}/inventory)
      const legacySnapshot = await getDocs(collection(db, `companies/${companyId}/inventory`));
      if (!legacySnapshot.empty && !allInventories.some(inv => inv.id === 'principal')) {
        allInventories.unshift({
          id: 'principal',
          name: 'Inventario Principal',
          description: 'Inventario general de la empresa',
          isLegacy: true,
          productCount: legacySnapshot.size
        });
      }

      setInventories(allInventories);
      console.log('📦 Inventarios cargados para wizard:', allInventories.length, allInventories);
    } catch (error) {
      console.error('Error cargando inventarios:', error);
      toast.error('Error al cargar inventarios');
    }
  };

  const loadCompanies = async () => {
    try {
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const companiesData = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanies(companiesData);
      console.log('🏢 Empresas cargadas:', companiesData.length);

      // Si solo hay una empresa, seleccionarla automáticamente
      if (companiesData.length === 1) {
        setSelectedCompanyId(companiesData[0].id);
      }
    } catch (error) {
      console.error('Error cargando empresas:', error);
      toast.error('Error al cargar empresas');
    }
  };

  // ===== FUNCIONES DE MODAL =====
  const openCreateModal = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      generatePassword: true,
      role: 'CAJERA',
      limitType: 'MONEY',
      dailyLimitMoney: 10000,
      dailyLimitUnits: 5,
      assignedWarehouses: [],
      receiveAlerts: true,
      receiveReports: true,
      customPermissions: []
    });
    setModal({ open: true, mode: 'create', worker: null });
  };

  const openEditModal = (worker) => {
    // Preparar datos iniciales para el wizard en modo edit
    const initialData = {
      name: worker.name,
      email: worker.email,
      role: worker.role,
      limitType: worker.limitType || 'MONEY',
      dailyLimitMoney: worker.dailyLimitMoney || 10000,
      dailyLimitUnits: worker.dailyLimitUnits || worker.dailyLimitProducts || 5,
      assignedWarehouses: worker.assignedWarehouses || [],
      customPermissions: worker.customPermissions || [],
      receiveAlerts: worker.receiveAlerts !== undefined ? worker.receiveAlerts : true,
      receiveReports: worker.receiveReports !== undefined ? worker.receiveReports : true,
      generatePassword: false, // No generar contraseña en modo edit
      password: ''
    };
    setForm(initialData);
    setModal({ open: true, mode: 'edit', worker });
  };

  const openViewModal = (worker) => {
    setModal({ open: true, mode: 'view', worker });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'create', worker: null });
  };

  const handleSaveCommission = async () => {
    const pct = parseFloat(commissionModal.value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('Ingresa un porcentaje válido entre 0 y 100');
      return;
    }
    setCommissionSaving(true);
    try {
      const companyId = selectedCompanyId || await getUserCompanyId();
      await updateDoc(doc(db, `companies/${companyId}/workers`, commissionModal.worker.id), {
        commissionPercent: pct,
        updatedAt: serverTimestamp()
      });
      toast.success(`Comisión de ${commissionModal.worker.name} actualizada a ${pct}%`);
      setCommissionModal({ open: false, worker: null, value: '' });
      await loadWorkers();
    } catch (err) {
      toast.error('Error al guardar comisión: ' + err.message);
    } finally {
      setCommissionSaving(false);
    }
  };

  const handleSaveBaseSalary = async () => {
    const amount = parseFloat(salaryModal.value);
    if (isNaN(amount) || amount < 0) {
      toast.error('Ingresa un sueldo base válido');
      return;
    }
    setSalarySaving(true);
    try {
      const companyId = selectedCompanyId || await getUserCompanyId();
      await updateDoc(doc(db, `companies/${companyId}/workers`, salaryModal.worker.id), {
        baseSalary: amount,
        updatedAt: serverTimestamp()
      });
      toast.success(`Sueldo base de ${salaryModal.worker.name} actualizado a ${formatCLP(amount)}`);
      setSalaryModal({ open: false, worker: null, value: '' });
      await loadWorkers();
    } catch (err) {
      toast.error('Error al guardar sueldo base: ' + err.message);
    } finally {
      setSalarySaving(false);
    }
  };

  const handleOpenPayroll = async () => {
    setPayrollPanel({ open: true, loading: true, data: null, error: null });
    try {
      const companyId = (isSuperAdmin && selectedCompanyId) ? selectedCompanyId : await getUserCompanyId();
      if (!companyId) throw new Error('No se pudo identificar la empresa.');
      const result = await calculatePayroll({ companyId, monthsBack: 1 });
      setPayrollPanel({ open: true, loading: false, data: result, error: null });
    } catch (err) {
      setPayrollPanel({ open: true, loading: false, data: null, error: err.message || 'No se pudo calcular el sueldo del mes.' });
    }
  };

  // ===== FUNCIONES CRUD =====
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nombre y email son obligatorios');
      return;
    }

    if (modal.mode === 'create' && !form.generatePassword && !form.password.trim()) {
      toast.error('Debes generar una contraseña o proporcionar una');
      return;
    }

    setSaving(true);
    try {
      if (modal.mode === 'create') {
        // ⭐ VERIFICAR LÍMITES DEL PLAN ANTES DE CREAR
        const activeWorkers = workers.filter(w => w.isActive !== false);
        if (limits.maxUsers && limits.maxUsers !== Infinity && activeWorkers.length >= limits.maxUsers) {
          toast.error(`Límite alcanzado: tu plan permite máximo ${limits.maxUsers} usuario${limits.maxUsers === 1 ? '' : 's'}. Puedes agregar usuarios adicionales por $10.990/usuario/mes desde Planes.`);
          return;
        }
        // Generar credenciales
        const credentials = form.generatePassword
          ? generateWorkerCredentials(form.name, form.email)
          : { email: form.email, password: form.password };

        // Crear cuenta Firebase Auth
        let firebaseUser = null;
        try {
          firebaseUser = await createFirebaseUser(credentials.email, credentials.password);
          console.log('Usuario Firebase creado:', firebaseUser.uid);
        } catch (authError) {
          console.error('Error creando usuario Firebase:', authError);
          toast.error(`Error creando cuenta Firebase: ${authError.message}`);
          return;
        }

        // Obtener companyId del usuario actual
        const currentCompanyId = await getUserCompanyId();
        if (!currentCompanyId) {
          toast.error('Error: No se pudo identificar la empresa');
          return;
        }

        // Crear trabajador en Firestore
        const workerData = { ...form };
        delete workerData.password; // No guardar password en Firestore
        delete workerData.generatePassword;

        // Agregar UID de Firebase y companyId
        workerData.firebaseUid = firebaseUser.uid;
        workerData.companyId = currentCompanyId;

        // Setear custom claims en Firebase Auth
        try {
          const customClaims = {
            role: form.role,
            companyId: currentCompanyId,
            receiveAlerts: form.role === 'ADMIN' ? form.receiveAlerts : false,
            receiveReports: form.role === 'ADMIN' ? form.receiveReports : false
          };

          console.log('📝 Intentando setear custom claims:', customClaims);

          const response = await fetch(FUNCTIONS_ENDPOINTS.SET_CUSTOM_CLAIMS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: firebaseUser.uid, claims: customClaims })
          });

          if (!response.ok) {
            console.warn('⚠️ No se pudieron setear los custom claims:', response.status);
          } else {
            console.log('✅ Custom claims seteados:', customClaims);
          }
        } catch (claimsError) {
          console.error('❌ Error seteando custom claims:', claimsError);
          // No falla la creación si los claims fallan
        }

        console.log('💾 Guardando trabajador en Firestore:', {
          name: workerData.name,
          email: workerData.email,
          role: workerData.role,
          firebaseUid: workerData.firebaseUid,
          companyId: workerData.companyId
        });

        const result = await createWorker(workerData, 'current-user-id'); // TODO: obtener ID del usuario actual

        // Mostrar credenciales generadas
        if (form.generatePassword) {
          setGeneratedCredentials(credentials);
          closeModal(); // Cerrar modal principal
        } else {
          if (result?.isOverage) {
            toast.warn(
              <div>
                <p className="font-bold">⚠️ Usuario excedente creado</p>
                <p className="text-sm mt-1">
                  Has superado el límite de tu plan. Se aplicará un cargo adicional de <strong>$10.000/mes</strong> por este usuario a partir del próximo período.
                </p>
              </div>,
              { autoClose: 8000 }
            );
          } else {
            toast.success(`Trabajador "${form.name}" creado exitosamente`);
          }
          closeModal();
        }

        await loadWorkers();

      } else {
        const workerData = { ...form };
        delete workerData.password; // No actualizar password en ediciones
        delete workerData.generatePassword;

        await updateWorker(modal.worker.id, workerData);

        // Actualizar custom claims si el trabajador tiene firebaseUid (para que el rol funcione correctamente)
        const firebaseUid = modal.worker.firebaseUid;
        if (firebaseUid) {
          try {
            const currentCompanyId = await getUserCompanyId();
            const customClaims = {
              role: form.role,
              companyId: currentCompanyId,
              receiveAlerts: form.role === 'ADMIN' ? form.receiveAlerts : false,
              receiveReports: form.role === 'ADMIN' ? form.receiveReports : false
            };
            const response = await fetch(FUNCTIONS_ENDPOINTS.SET_CUSTOM_CLAIMS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uid: firebaseUid, claims: customClaims })
            });
            if (!response.ok) {
              console.warn('⚠️ No se pudieron actualizar custom claims al editar');
            } else {
              console.log('✅ Custom claims actualizados al editar:', customClaims);
            }
          } catch (claimsError) {
            console.error('❌ Error actualizando custom claims al editar:', claimsError);
          }
        }

        toast.success(`Trabajador "${form.name}" actualizado exitosamente`);
        await loadWorkers();
        closeModal();
      }

    } catch (error) {
      console.error('Error guardando trabajador:', error);
      toast.error('Error al guardar trabajador: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (worker) => {
    if (!window.confirm(`¿Desactivar a "${worker.name}"? No podrá acceder al sistema.`)) {
      return;
    }

    try {
      await deactivateWorker(worker.id);
      toast.warning(`Trabajador "${worker.name}" desactivado`);
      await loadWorkers();
    } catch (error) {
      console.error('Error desactivando trabajador:', error);
      toast.error('Error al desactivar trabajador');
    }
  };

  const handleDelete = async (worker) => {
    if (!window.confirm(`⚠️ ¿ELIMINAR PERMANENTEMENTE a "${worker.name}"?\n\nEsta acción NO se puede deshacer.\n- Se eliminará el trabajador de la base de datos\n- Se eliminará su cuenta de Firebase Auth\n- Perderá todo acceso al sistema\n\n¿Estás seguro?`)) {
      return;
    }

    try {
      const companyId = await getUserCompanyId();
      if (!companyId) {
        toast.error('Error: No se pudo identificar la empresa');
        return;
      }

      // Eliminar cuenta de Firebase Auth si existe
      if (worker.firebaseUid) {
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || `${API_URL}`;
          const response = await fetch(`${backendUrl}/api/users/${worker.firebaseUid}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (!response.ok) {
            console.warn('No se pudo eliminar la cuenta de Firebase Auth');
          } else {
            console.log('✅ Cuenta de Firebase Auth eliminada');
          }
        } catch (authError) {
          console.error('Error eliminando cuenta de Firebase:', authError);
          // Continuar con la eliminación del trabajador aunque falle Firebase Auth
        }
      }

      // Eliminar documento de Firestore
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase/firebase.js');

      await deleteDoc(doc(db, `companies/${companyId}/workers`, worker.id));

      toast.success(`Trabajador "${worker.name}" eliminado permanentemente`);
      await loadWorkers();
    } catch (error) {
      console.error('Error eliminando trabajador:', error);
      toast.error('Error al eliminar trabajador: ' + error.message);
    }
  };

  // ===== RESET DE CONTRASEÑA =====
  const handleResetPassword = async () => {
    const worker = resetModal.worker;
    if (!worker?.firebaseUid) {
      setResetErr('Este trabajador no tiene cuenta de acceso asociada.');
      return;
    }
    setResetLoading(true);
    setResetErr('');
    setResetResult(null);
    try {
      // Generar nueva contraseña segura (misma lógica que auth-service)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      let newPassword = '';
      for (let i = 0; i < 12; i++) newPassword += chars[Math.floor(Math.random() * chars.length)];

      const res = await fetch(`${API_URL}/api/users/${worker.firebaseUid}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al resetear contraseña');
      setResetResult({ newPassword, email: worker.email, name: worker.name });
    } catch (err) {
      setResetErr(err.message || 'Error desconocido');
    } finally {
      setResetLoading(false);
    }
  };

  // ===== FILTROS Y BÚSQUEDA =====
  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         worker.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = filterRole === 'all' || worker.role === filterRole;

    return matchesSearch && matchesRole;
  });

  // ===== UTILIDADES =====
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role?.name || roleId;
  };

  const getRoleColor = (roleId) => {
    switch (roleId) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'SUPERVISOR': return 'bg-blue-100 text-blue-800';
      case 'WORKER': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getWarehouseNames = (warehouseIds) => {
    if (!warehouseIds || warehouseIds.length === 0) return 'Ninguna';

    return warehouseIds.map(id => {
      const warehouse = warehouses.find(w => w.id === id);
      return warehouse?.name || id;
    }).join(', ');
  };

  if (loading) {
    return <GlobalLoading />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-slate-50 p-3 sm:p-6"
    >
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                Gestión de Trabajadores
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Administra roles, permisos y límites de tu equipo
              </p>
            </div>

            <div className="flex gap-2 items-center">
              {/* Selector de empresa para super-admin */}
              {isSuperAdmin && (
                <select
                  value={selectedCompanyId || ''}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    loadWorkers();
                    loadWarehouses();
                  }}
                  className="px-3 py-2 border-2 border-blue-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-blue-50 text-blue-900"
                >
                  <option value="">🏢 Seleccionar Empresa</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name || company.businessName || company.id}
                    </option>
                  ))}
                </select>
              )}

              <motion.button
                onClick={async () => {
                  try {
                    await initializeSystemRoles();
                    await loadRoles();
                    toast.success('Roles actualizados correctamente');
                  } catch (error) {
                    toast.error('Error actualizando roles');
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg shadow-sm hover:bg-slate-200 transition text-sm font-medium"
                title="Sincronizar roles del sistema (CAJERA, VENDEDORA, etc.)"
              >
                <Settings className="w-4 h-4" />
                Sincronizar Roles
              </motion.button>
              {workers.length > 0 && !isSuperAdmin && (
                <motion.button
                  onClick={() => setEmailModal(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                  title="Enviar email a empleados"
                >
                  <Mail className="w-4 h-4" />
                  Enviar Email
                </motion.button>
              )}
              {workers.length > 0 && (
                <motion.button
                  onClick={handleOpenPayroll}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                  title="Ver sueldo base + comisión de este mes por persona"
                >
                  <Wallet className="w-4 h-4" />
                  Sueldos del mes
                </motion.button>
              )}
              <motion.button
                onClick={openCreateModal}
                whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(234, 88, 12, 0.3)" }}
                whileTap={{ scale: 0.98 }}
                disabled={isSuperAdmin && !selectedCompanyId}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition text-sm font-medium ${
                  isSuperAdmin && !selectedCompanyId
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={isSuperAdmin && !selectedCompanyId ? 'Selecciona una empresa primero' : 'Crear nuevo trabajador'}
              >
                <Plus className="w-4 h-4" />
                Nuevo Trabajador
                {!isSuperAdmin && limits.maxUsers && limits.maxUsers !== Infinity && limits.maxUsers > 0 && (
                  <span className="text-xs opacity-75">
                    ({workers.filter(w => w.isActive !== false).length}/{limits.maxUsers})
                  </span>
                )}
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Filtros y Búsqueda */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="sm:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="all">Todos los roles</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 text-sm text-slate-600">
            <span>Total: <strong>{workers.length}</strong> trabajadores</span>
            <span>•</span>
            <span>Activos: <strong>{workers.filter(w => w.isActive !== false).length}</strong></span>
            <span>•</span>
            <span>Mostrando: <strong>{filteredWorkers.length}</strong></span>
          </div>
        </motion.div>

        {/* Lista de Trabajadores - Vista Desktop */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="hidden lg:block bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
        >
          {filteredWorkers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {workers.length === 0 ? 'No hay trabajadores' : 'No se encontraron resultados'}
              </h3>
              <p className="text-slate-500 mb-4">
                {workers.length === 0
                  ? 'Crea tu primer trabajador para comenzar'
                  : 'Intenta ajustar los filtros de búsqueda'
                }
              </p>
              {workers.length === 0 && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primer Trabajador
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Trabajador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Límite Diario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Bodegas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredWorkers.map((worker, index) => (
                    <motion.tr
                      key={worker.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ backgroundColor: "rgb(248 250 252)" }}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Indicador presencia en línea */}
                          {(() => {
                            const presence = Object.values(onlineMap).find(p => p.email === worker.email);
                            const isOnline = presence?.isOnline;
                            return (
                              <span title={isOnline ? 'En línea ahora' : presence ? `Última vez: hace ${Math.round((Date.now() - (presence.lastSeen?.toMillis?.() || 0)) / 60000)} min` : 'Sin actividad reciente'}>
                                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]' : 'bg-slate-300'}`} />
                              </span>
                            );
                          })()}
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {worker.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {worker.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(worker.role)}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {getRoleName(worker.role)}
                        </span>
                        {(worker.role === 'VENDEDORA' || worker.role === 'VENDEDOR') && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-xs text-slate-500">
                              {worker.commissionPercent != null ? `Comisión: ${worker.commissionPercent}%` : 'Sin comisión'}
                            </span>
                            <button
                              onClick={() => setCommissionModal({ open: true, worker, value: worker.commissionPercent != null ? String(worker.commissionPercent) : '' })}
                              className="text-xs text-purple-600 hover:text-purple-800 underline"
                            >
                              {worker.commissionPercent != null ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-slate-900">
                          {worker.limitType === 'NONE' ? (
                            <>
                              <span className="text-lg mr-1">∞</span>
                              Sin límite
                            </>
                          ) : worker.limitType === 'MONEY' ? (
                            <>
                              <DollarSign className="w-4 h-4 mr-1 text-slate-400" />
                              {formatCLP(worker.dailyLimitMoney || 0)} / día
                            </>
                          ) : worker.limitType === 'UNITS' ? (
                            <>
                              <span className="mr-1">⚖️</span>
                              {worker.dailyLimitUnits || worker.dailyLimitProducts || 0} cantidad total / día
                            </>
                          ) : (
                            'No configurado'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm text-slate-500">
                          <Warehouse className="w-4 h-4 mr-1 text-slate-400" />
                          <span className="truncate max-w-xs">
                            {getWarehouseNames(worker.assignedWarehouses)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {worker.isActive !== false ? (
                          <span className="inline-flex items-center text-sm text-green-800">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-sm text-red-800">
                            <XCircle className="w-4 h-4 mr-1" />
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(worker)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {worker.firebaseUid && (
                            <button
                              onClick={() => { setResetModal({ open: true, worker }); setResetResult(null); setResetErr(''); }}
                              className="text-amber-600 hover:text-amber-900 p-1 rounded hover:bg-amber-50 transition"
                              title="Resetear contraseña"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(worker)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Lista de Trabajadores - Vista Mobile/Tablet */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="lg:hidden space-y-4"
        >
          {filteredWorkers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {workers.length === 0 ? 'No hay trabajadores' : 'No se encontraron resultados'}
              </h3>
              <p className="text-slate-500 mb-4 px-4">
                {workers.length === 0
                  ? 'Crea tu primer trabajador para comenzar'
                  : 'Intenta ajustar los filtros de búsqueda'
                }
              </p>
              {workers.length === 0 && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primer Trabajador
                </button>
              )}
            </div>
          ) : (
            filteredWorkers.map((worker, index) => (
              <motion.div
                key={worker.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)" }}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-4"
              >
                {/* Header de la Card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900 truncate">{worker.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{worker.email}</p>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(worker.role)}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {getRoleName(worker.role)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {worker.isActive ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Información del Límite */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Límite Diario</h4>
                  <div className="flex items-center text-sm text-slate-900">
                    {worker.limitType === 'NONE' ? (
                      <>
                        <span className="text-lg mr-2">∞</span>
                        Sin límite
                      </>
                    ) : worker.limitType === 'MONEY' ? (
                      <>
                        <DollarSign className="w-4 h-4 mr-2 text-slate-400" />
                        {formatCLP(worker.dailyLimitMoney || 0)} / día
                      </>
                    ) : worker.limitType === 'UNITS' ? (
                      <>
                        <span className="mr-2">⚖️</span>
                        {worker.dailyLimitUnits || worker.dailyLimitProducts || 0} cantidad total / día
                      </>
                    ) : (
                      'No configurado'
                    )}
                  </div>
                </div>

                {/* Bodegas Asignadas */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Bodegas Asignadas</h4>
                  <div className="flex items-center text-sm text-slate-500">
                    <Warehouse className="w-4 h-4 mr-2 text-slate-400" />
                    <span className="break-words">
                      {getWarehouseNames(worker.assignedWarehouses)}
                    </span>
                  </div>
                </div>

                {/* Sueldo base (cualquier rol, a diferencia de la comisión --
                    un chofer o la propia dueña pueden tener sueldo base sin
                    vender nada) */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                    Sueldo base
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-900 font-semibold">
                      {worker.baseSalary != null ? formatCLP(worker.baseSalary) : 'No configurado'}
                    </span>
                    <button
                      onClick={() => setSalaryModal({ open: true, worker, value: worker.baseSalary != null ? String(worker.baseSalary) : '' })}
                      className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                    >
                      {worker.baseSalary != null ? 'Editar' : 'Configurar'}
                    </button>
                  </div>
                </div>

                {/* Comisión (solo para VENDEDOR) */}
                {(worker.role === 'VENDEDORA' || worker.role === 'VENDEDOR') && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-purple-500" />
                      Comisión por ventas
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-900 font-semibold">
                        {worker.commissionPercent != null ? `${worker.commissionPercent}%` : 'No configurada'}
                      </span>
                      <button
                        onClick={() => setCommissionModal({ open: true, worker, value: worker.commissionPercent != null ? String(worker.commissionPercent) : '' })}
                        className="text-xs text-purple-600 hover:text-purple-800 underline"
                      >
                        {worker.commissionPercent != null ? 'Editar' : 'Configurar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Estado */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Estado</h4>
                  {worker.isActive !== false ? (
                    <span className="inline-flex items-center text-sm text-green-800">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-sm text-red-800">
                      <XCircle className="w-4 h-4 mr-2" />
                      Inactivo
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-2 pt-4 border-t border-slate-100 flex-wrap">
                  <button
                    onClick={() => openEditModal(worker)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar
                  </button>
                  {worker.firebaseUid && (
                    <button
                      onClick={() => { setResetModal({ open: true, worker }); setResetResult(null); setResetErr(''); }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition"
                    >
                      <KeyRound className="w-4 h-4" />
                      Contraseña
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(worker)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      {/* Modal para ver detalles del trabajador */}
      {modal.open && modal.mode === 'view' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-900">
                Detalles del Trabajador
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Información Personal */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-3">Información Personal</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-600">Nombre Completo</label>
                    <p className="text-sm font-medium text-slate-900">{modal.worker?.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Email</label>
                    <p className="text-sm font-medium text-slate-900">{modal.worker?.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Estado</label>
                    <p className="text-sm">
                      {modal.worker?.isActive !== false ? (
                        <span className="inline-flex items-center text-green-800">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-800">
                          <XCircle className="w-4 h-4 mr-1" />
                          Inactivo
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rol y Permisos */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-3">Rol y Permisos</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-600">Rol</label>
                    <p className="text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(modal.worker?.role)}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {getRoleName(modal.worker?.role)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Permisos</label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(modal.worker?.customPermissions || []).length > 0 ? (
                        modal.worker.customPermissions.slice(0, 5).map(perm => (
                          <span
                            key={perm}
                            className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                          >
                            {perm.replace(/_/g, ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Usando permisos por defecto del rol</span>
                      )}
                      {(modal.worker?.customPermissions || []).length > 5 && (
                        <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          +{modal.worker.customPermissions.length - 5} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Límites Diarios */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-3">Límites Diarios</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center text-sm text-slate-900">
                    {modal.worker?.limitType === 'NONE' ? (
                      <>
                        <span className="text-lg mr-2">∞</span>
                        <div>
                          <p className="font-medium">Sin límites</p>
                          <p className="text-xs text-slate-600">Puede retirar cualquier cantidad</p>
                        </div>
                      </>
                    ) : modal.worker?.limitType === 'MONEY' ? (
                      <>
                        <DollarSign className="w-5 h-5 mr-3 text-slate-400" />
                        <div>
                          <p className="font-medium">{formatCLP(modal.worker?.dailyLimitMoney || 0)} por día</p>
                          <p className="text-xs text-slate-600">Límite monetario diario</p>
                        </div>
                      </>
                    ) : modal.worker?.limitType === 'UNITS' ? (
                      <>
                        <span className="text-lg mr-3">⚖️</span>
                        <div>
                          <p className="font-medium">{modal.worker?.dailyLimitUnits || modal.worker?.dailyLimitProducts || 0} cantidad total por día</p>
                          <p className="text-xs text-slate-600">Límite basado en suma de cantidades (kg + L + unidades)</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 mr-3 text-blue-500" />
                        <div>
                          <p className="font-medium text-blue-700">No configurado</p>
                          <p className="text-xs text-blue-600">Límites sin definir</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Bodegas Asignadas */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-3">Bodegas Asignadas</h4>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-start">
                    <Warehouse className="w-5 h-5 mr-3 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {getWarehouseNames(modal.worker?.assignedWarehouses)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {modal.worker?.assignedWarehouses?.length || 0} bodega(s) asignada(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-3">Información del Sistema</h4>
                <div className="space-y-2 text-xs text-slate-600">
                  {modal.worker?.createdAt && (
                    <p>Creado: {new Date(modal.worker.createdAt.seconds * 1000).toLocaleDateString('es-CL')}</p>
                  )}
                  {modal.worker?.updatedAt && (
                    <p>Última actualización: {new Date(modal.worker.updatedAt.seconds * 1000).toLocaleDateString('es-CL')}</p>
                  )}
                  {modal.worker?.firebaseUid && (
                    <p className="font-mono">Firebase UID: {modal.worker.firebaseUid.substring(0, 10)}...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => {
                  closeModal();
                  openEditModal(modal.worker);
                }}
                className="px-4 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition"
              >
                Editar Trabajador
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear trabajador - WIZARD */}
      {modal.open && modal.mode === 'create' && (
        <div className="fixed inset-0 z-[9999] flex items-stretch sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative flex items-stretch sm:items-center justify-center w-full h-full sm:h-auto sm:max-h-[95vh]">
            <CreateWorkerWizard
              isDark={isDark}
              onSubmit={async (workerData) => {
                try {
                  // Generar credenciales (siempre con displayInfo)
                  const credentials = workerData.generatePassword
                    ? generateWorkerCredentials(workerData.name, workerData.email)
                    : {
                        email: workerData.email,
                        password: workerData.password,
                        displayInfo: {
                          title: `🔐 Credenciales para ${workerData.name}`,
                          instructions: [
                            `📧 Email: ${workerData.email}`,
                            `🔑 Contraseña: ${workerData.password}`,
                            '',
                            '⚠️ IMPORTANTE:',
                            '• Guarda estas credenciales en un lugar seguro',
                            '• Compártelas de forma segura con el trabajador',
                            '• El trabajador debería cambiar la contraseña tras el primer login'
                          ]
                        }
                      };

                  // ⭐ VERIFICAR LÍMITES DEL PLAN ANTES DE CREAR
                  const activeWorkersCount = workers.filter(w => w.isActive !== false).length;
                  if (limits.maxUsers && limits.maxUsers !== Infinity && activeWorkersCount >= limits.maxUsers) {
                    toast.error(`Límite alcanzado: tu plan permite máximo ${limits.maxUsers} usuario${limits.maxUsers === 1 ? '' : 's'}. Puedes agregar usuarios adicionales por $10.990/usuario/mes desde Planes.`);
                    return;
                  }

                  // Verificar si el email ya existe
                  const existingWorker = workers.find(w => w.email === credentials.email);
                  if (existingWorker) {
                    toast.error(`❌ El email ${credentials.email} ya está registrado en el sistema.`);
                    return;
                  }

                  // Crear cuenta Firebase Auth
                  let firebaseUser = null;
                  try {
                    firebaseUser = await createFirebaseUser(credentials.email, credentials.password);
                    console.log('✅ Usuario Firebase creado:', firebaseUser.uid);
                  } catch (authError) {
                    console.error('❌ Error creando usuario Firebase:', authError);

                    // Mensajes de error más específicos
                    if (authError.code === 'auth/email-already-in-use') {
                      toast.error(`❌ El email ${credentials.email} ya tiene una cuenta en Firebase Auth. Si no aparece en la lista, contacta al administrador del sistema.`);
                    } else if (authError.code === 'auth/invalid-email') {
                      toast.error('❌ El formato del email es inválido.');
                    } else if (authError.code === 'auth/weak-password') {
                      toast.error('❌ La contraseña es demasiado débil (mínimo 6 caracteres).');
                    } else {
                      toast.error(`❌ Error creando cuenta Firebase: ${authError.message}`);
                    }
                    return;
                  }

                  // Obtener companyId (de selectedCompanyId si es super-admin, o del usuario actual)
                  const currentCompanyId = selectedCompanyId || await getUserCompanyId();
                  if (!currentCompanyId) {
                    toast.error('❌ Error: Debes seleccionar una empresa para crear el trabajador');
                    return;
                  }

                  // Crear trabajador en Firestore
                  const finalWorkerData = { ...workerData };
                  delete finalWorkerData.password;
                  delete finalWorkerData.generatePassword;

                  finalWorkerData.firebaseUid = firebaseUser.uid;
                  finalWorkerData.companyId = currentCompanyId;

                  // Setear custom claims en Firebase Auth
                  try {
                    const customClaims = {
                      role: workerData.role,
                      companyId: currentCompanyId,
                      receiveAlerts: workerData.role === 'ADMIN' ? workerData.receiveAlerts : false,
                      receiveReports: workerData.role === 'ADMIN' ? workerData.receiveReports : false
                    };

                    console.log('📝 Intentando setear custom claims:', customClaims);

                    const backendUrl = import.meta.env.VITE_BACKEND_URL || `${API_URL}`;
                    const response = await fetch(`${backendUrl}/api/users/${firebaseUser.uid}/custom-claims`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(customClaims)
                    });

                    if (!response.ok) {
                      console.warn('⚠️  No se pudieron setear los custom claims en Firebase Auth');
                      console.warn('Response status:', response.status);
                    } else {
                      console.log('✅ Custom claims seteados correctamente:', customClaims);
                    }
                  } catch (claimsError) {
                    console.error('❌ Error seteando custom claims:', claimsError);
                  }

                  console.log('💾 Guardando trabajador en Firestore:', {
                    name: finalWorkerData.name,
                    email: finalWorkerData.email,
                    role: finalWorkerData.role,
                    firebaseUid: finalWorkerData.firebaseUid,
                    companyId: finalWorkerData.companyId
                  });

                  const wizardResult = await createWorker(finalWorkerData, 'current-user-id');

                  if (wizardResult?.isOverage) {
                    toast.warn(
                      <div>
                        <p className="font-bold">⚠️ Usuario excedente creado</p>
                        <p className="text-sm mt-1">
                          Has superado el límite de tu plan. Se aplicará un cargo adicional de <strong>$10.000/mes</strong> por este usuario a partir del próximo período.
                        </p>
                      </div>,
                      { autoClose: 8000 }
                    );
                  }

                  // Siempre mostrar las credenciales generadas
                  setGeneratedCredentials(credentials);
                  closeModal();

                  await loadWorkers();
                } catch (error) {
                  console.error('Error guardando trabajador:', error);
                  toast.error('Error al guardar trabajador: ' + error.message);
                }
              }}
              onCancel={closeModal}
              roles={roles}
              warehouses={warehouses}
              inventories={inventories}
            />
          </div>
        </div>
      )}

      {/* Modal para editar trabajador - WIZARD */}
      {modal.open && modal.mode === 'edit' && (
        <div className="fixed inset-0 z-[9999] flex items-stretch sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative flex items-stretch sm:items-center justify-center w-full h-full sm:h-auto sm:max-h-[95vh]">
            <CreateWorkerWizard
              isDark={isDark}
              mode="edit"
              initialData={form}
              onSubmit={async (workerData) => {
                try {
                  // Actualizar trabajador existente
                  await updateWorker(modal.worker.id, {
                    name: workerData.name,
                    role: workerData.role,
                    limitType: workerData.limitType,
                    dailyLimitMoney: workerData.dailyLimitMoney,
                    dailyLimitUnits: workerData.dailyLimitUnits,
                    assignedInventories: workerData.assignedInventories || [],
                    assignedWarehouses: workerData.assignedWarehouses,
                    customPermissions: workerData.customPermissions,
                    receiveAlerts: workerData.receiveAlerts,
                    receiveReports: workerData.receiveReports
                  });

                  toast.success(`✅ Trabajador ${workerData.name} actualizado correctamente`);
                  closeModal();
                  await loadWorkers();
                } catch (error) {
                  console.error('Error actualizando trabajador:', error);
                  toast.error('Error al actualizar trabajador: ' + error.message);
                }
              }}
              onCancel={closeModal}
              roles={roles}
              warehouses={warehouses}
              inventories={inventories}
            />
          </div>
        </div>
      )}

      {/* Modal para editar trabajador - FORMULARIO ANTIGUO (DEPRECATED) */}
      {false && modal.open && modal.mode === 'edit_old' && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-900">
                {modal.mode === 'create' ? 'Nuevo Trabajador' : 'Editar Trabajador'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Juan Pérez"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="juan@empresa.com"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {modal.mode === 'create'
                    ? 'Se creará automáticamente la cuenta Firebase Auth'
                    : 'Email registrado en Firebase Auth'
                  }
                </p>
              </div>

              {/* Configuración de contraseña (solo al crear) */}
              {modal.mode === 'create' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Configuración de Contraseña
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={form.generatePassword}
                          onChange={() => setForm({ ...form, generatePassword: true, password: '' })}
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm">🎲 Generar contraseña segura automáticamente (recomendado)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={!form.generatePassword}
                          onChange={() => setForm({ ...form, generatePassword: false })}
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm">✏️ Especificar contraseña manualmente</span>
                      </label>
                    </div>
                  </div>

                  {!form.generatePassword && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Contraseña *
                      </label>
                      <input
                        type="password"
                        required={!form.generatePassword}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Mínimo 6 caracteres"
                        minLength="6"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        La contraseña debe tener al menos 6 caracteres
                      </p>
                    </div>
                  )}

                  {form.generatePassword && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">🛡️</span>
                        <div>
                          <p className="text-sm font-medium text-green-800">Contraseña Segura Automática</p>
                          <p className="text-xs text-green-600">
                            Se generará una contraseña de 12 caracteres con letras, números y símbolos
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rol - Selector Visual */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-900">
                  Selecciona el Rol
                </label>
                <RoleSelector
                  selectedRole={form.role}
                  onSelect={(roleId) => {
                    const selectedRoleData = roles.find(r => r.id === roleId);
                    const updatedForm = {
                      ...form,
                      role: roleId,
                      customPermissions: selectedRoleData?.permissions || []
                    };

                    // Configurar límites por defecto según el rol
                    if (roleId === 'ADMIN' || roleId === 'SUPERVISOR' || roleId === 'ENCARGADA' || roleId === 'GERENTE') {
                      updatedForm.limitType = 'NONE';
                      updatedForm.dailyLimitMoney = 0;
                      updatedForm.dailyLimitUnits = 0;
                    } else if (roleId === 'CAJERA' || roleId === 'VENDEDORA') {
                      updatedForm.limitType = 'MONEY';
                      updatedForm.dailyLimitMoney = 50000;
                      updatedForm.dailyLimitUnits = 20;
                    } else if (roleId === 'WORKER') {
                      updatedForm.limitType = 'MONEY';
                      updatedForm.dailyLimitMoney = 10000;
                      updatedForm.dailyLimitUnits = 5;
                    }

                    setForm(updatedForm);
                  }}
                  roles={roles}
                />
              </div>

              {/* Información de permisos del rol seleccionado */}
              <div className="border-t border-slate-200 pt-4">
                <RolePermissionsDisplay roleId={form.role} />
              </div>

              {/* Configuración de Notificaciones (solo para ADMIN) */}
              {form.role === 'ADMIN' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center mb-2">
                    <span className="text-lg mr-2">📧</span>
                    <h4 className="text-sm font-semibold text-blue-900">
                      Configuración de Notificaciones por Email
                    </h4>
                  </div>
                  <p className="text-xs text-blue-700 mb-3">
                    Selecciona qué notificaciones recibirá este administrador en su correo electrónico
                  </p>

                  <label className="flex items-start space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.receiveAlerts}
                      onChange={(e) => setForm({ ...form, receiveAlerts: e.target.checked })}
                      className="mt-1 text-blue-600 focus:ring-blue-500 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition">
                          🚨 Alertas de Stock Bajo
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Recibe notificaciones automáticas cada 6 horas cuando los productos tengan stock crítico o bajo
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.receiveReports}
                      onChange={(e) => setForm({ ...form, receiveReports: e.target.checked })}
                      className="mt-1 text-blue-600 focus:ring-blue-500 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition">
                          📊 Reportes Mensuales
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Recibe reportes automáticos el día 1 de cada mes con análisis completo de movimientos y Excel adjunto
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Tipo de Límite */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Límite Diario
                </label>
                <select
                  value={form.limitType}
                  onChange={(e) => setForm({ ...form, limitType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(LIMIT_TYPES).map(([key, type]) => (
                    <option key={key} value={key}>
                      {type.icon} {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Límite en Dinero */}
              {form.limitType === 'MONEY' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Límite Diario en Dinero (CLP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={form.dailyLimitMoney}
                    onChange={(e) => setForm({ ...form, dailyLimitMoney: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="10000"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Cantidad máxima en pesos chilenos que puede retirar por día
                  </p>
                </div>
              )}

              {/* Límite en Unidades */}
              {form.limitType === 'UNITS' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Límite Diario en Unidades
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.dailyLimitUnits}
                    onChange={(e) => setForm({ ...form, dailyLimitUnits: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="18 (ej: 5kg + 3L + 10 unidades)"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Cantidad máxima total que puede retirar por día (suma de todas las cantidades: kg + litros + unidades, etc.)
                  </p>
                </div>
              )}

              {/* Información sobre límite sin restricción */}
              {form.limitType === 'NONE' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">∞</span>
                    <div>
                      <p className="text-sm font-medium text-blue-800">Sin límites</p>
                      <p className="text-xs text-blue-600">Este trabajador podrá retirar cualquier cantidad sin restricciones</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bodegas Asignadas */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bodegas Asignadas
                </label>
                <div className="space-y-3 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2">
                  {(() => {
                    // Agrupar bodegas por inventario
                    const byInventory = {};
                    warehouses.forEach(w => {
                      const invId = w.inventoryId || 'sin-inventario';
                      const invName = inventories.find(i => i.id === invId)?.name || w.inventoryName || 'Sin inventario';
                      if (!byInventory[invId]) byInventory[invId] = { name: invName, warehouses: [] };
                      byInventory[invId].warehouses.push(w);
                    });
                    return Object.entries(byInventory).map(([invId, group]) => (
                      <div key={invId}>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 px-1">
                          📦 {group.name}
                        </p>
                        {group.warehouses.map(warehouse => (
                          <label key={warehouse.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.assignedWarehouses.includes(warehouse.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm({ ...form, assignedWarehouses: [...form.assignedWarehouses, warehouse.id] });
                                } else {
                                  setForm({ ...form, assignedWarehouses: form.assignedWarehouses.filter(id => id !== warehouse.id) });
                                }
                              }}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-700">{warehouse.name}</span>
                            {warehouse.location && (
                              <span className="text-xs text-slate-400 ml-auto">{warehouse.location}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selecciona las bodegas a las que puede acceder este trabajador
                </p>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition disabled:opacity-60 flex items-center gap-2 min-w-[130px] justify-center"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      {modal.mode === 'create' ? 'Creando...' : 'Guardando...'}
                    </>
                  ) : (
                    modal.mode === 'create' ? 'Crear Trabajador' : 'Guardar Cambios'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal para mostrar credenciales generadas */}
      {generatedCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
              <h2 className="text-xl font-semibold text-slate-800">
                {generatedCredentials.displayInfo.title}
              </h2>
            </div>

            <div className="space-y-3 mb-6">
              {generatedCredentials.displayInfo.instructions.map((instruction, index) => (
                <p
                  key={index}
                  className={`text-sm ${
                    instruction.startsWith('📧') || instruction.startsWith('🔑')
                      ? 'font-mono bg-slate-100 p-2 rounded border text-slate-800'
                      : instruction.startsWith('⚠️')
                      ? 'font-semibold text-blue-600'
                      : 'text-slate-600'
                  }`}
                >
                  {instruction}
                </p>
              ))}
            </div>

            <div className="flex justify-center space-x-3">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `Email: ${generatedCredentials.email}\nContraseña: ${generatedCredentials.password}`
                  );
                  toast.addToast('Credenciales copiadas al portapapeles', 'success');
                }}
                className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition"
              >
                📋 Copiar Credenciales
              </button>
              <button
                onClick={() => {
                  setGeneratedCredentials(null);
                  toast.success('Trabajador creado exitosamente con credenciales generadas');
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
              >
                ✅ Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset de Contraseña */}
      {resetModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-sm">Resetear contraseña</h3>
                  <p className="text-slate-500 text-xs">{resetModal.worker?.name}</p>
                </div>
              </div>
              <button
                onClick={() => { setResetModal({ open: false, worker: null }); setResetResult(null); setResetErr(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!resetResult ? (
              <>
                <p className="text-slate-600 text-sm mb-5">
                  Se generará una nueva contraseña aleatoria para <span className="font-semibold text-slate-800">{resetModal.worker?.email}</span>. El trabajador deberá usarla para ingresar.
                </p>

                {resetErr && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {resetErr}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setResetModal({ open: false, worker: null }); setResetErr(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
                    ) : (
                      <><KeyRound className="w-4 h-4" /> Generar nueva contraseña</>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-green-700 text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Contraseña generada exitosamente
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-slate-500 text-[11px] mb-0.5">Correo</p>
                      <p className="font-mono text-sm text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200">{resetResult.email}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[11px] mb-0.5">Nueva contraseña</p>
                      <p className="font-mono text-sm text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 tracking-wider">{resetResult.newPassword}</p>
                    </div>
                  </div>
                </div>

                <p className="text-amber-600 text-xs mb-4 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Copia y comparte estas credenciales con el trabajador. Esta contraseña no se volverá a mostrar.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(`Correo: ${resetResult.email}\nContraseña: ${resetResult.newPassword}`);
                      toast.success('Credenciales copiadas al portapapeles');
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" /> Copiar
                  </button>
                  <button
                    onClick={() => { setResetModal({ open: false, worker: null }); setResetResult(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition"
                  >
                    Listo
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Modal Enviar Email a Empleados */}
      {emailModal && (
        <SendEmailModal
          workers={workers}
          onClose={() => setEmailModal(false)}
          senderName="Administrador"
          companyName=""
          companyId={selectedCompanyId}
        />
      )}

      {/* Modal comisión */}
      {commissionModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCommissionModal({ open: false, worker: null, value: '' })} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Comisión por ventas</h3>
            <p className="text-sm text-slate-500 mb-4">{commissionModal.worker?.name}</p>
            <label className="block text-sm font-medium text-slate-700 mb-2">Porcentaje de comisión (%)</label>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionModal.value}
                onChange={(e) => setCommissionModal(prev => ({ ...prev, value: e.target.value }))}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ej: 5"
                autoFocus
              />
              <Percent className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400 mb-5">Se aplica sobre el monto sin IVA (total ÷ 1.19)</p>
            <div className="flex gap-2">
              <button
                onClick={() => setCommissionModal({ open: false, worker: null, value: '' })}
                className="flex-1 px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >Cancelar</button>
              <button
                onClick={handleSaveCommission}
                disabled={commissionSaving}
                className="flex-1 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >{commissionSaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sueldo base */}
      {salaryModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSalaryModal({ open: false, worker: null, value: '' })} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Sueldo base</h3>
            <p className="text-sm text-slate-500 mb-4">{salaryModal.worker?.name}</p>
            <label className="block text-sm font-medium text-slate-700 mb-2">Monto mensual (CLP)</label>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <input
                type="number"
                min="0"
                step="1000"
                value={salaryModal.value}
                onChange={(e) => setSalaryModal(prev => ({ ...prev, value: e.target.value }))}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ej: 500000"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-400 mb-5">Se suma a la comisión del mes para calcular el sueldo total de esta persona.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSalaryModal({ open: false, worker: null, value: '' })}
                className="flex-1 px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >Cancelar</button>
              <button
                onClick={handleSaveBaseSalary}
                disabled={salarySaving}
                className="flex-1 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
              >{salarySaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Panel "Sueldos del mes" -- bruto a pagar (sueldo base + comisión
          sobre ventas reales), no una liquidación previsional formal. Ver
          src/agents/payrollAgent.js para el alcance deliberado. */}
      {payrollPanel.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPayrollPanel({ open: false, loading: false, data: null, error: null })} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  Sueldos del mes
                </h3>
                <p className="text-sm text-slate-500">Sueldo base + comisión sobre ventas reales de este mes</p>
              </div>
              <button
                onClick={() => setPayrollPanel({ open: false, loading: false, data: null, error: null })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {payrollPanel.loading && (
              <div className="py-10 text-center">
                <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-500">Calculando ventas del mes por persona...</p>
              </div>
            )}

            {payrollPanel.error && (
              <p className="text-sm text-red-600 py-6 text-center">{payrollPanel.error}</p>
            )}

            {!payrollPanel.loading && payrollPanel.data && (
              <>
                {payrollPanel.data.workers.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    Ningún trabajador tiene sueldo base ni comisión configurada todavía.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {payrollPanel.data.workers.map((w) => (
                      <div key={w.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{w.name}</p>
                          <p className="text-xs text-slate-500">
                            {w.baseSalary > 0 && `Base ${formatCLP(w.baseSalary)}`}
                            {w.baseSalary > 0 && w.commissionPercent > 0 && ' + '}
                            {w.commissionPercent > 0 && `${w.commissionPercent}% de ${formatCLP(w.netSales)} (${w.saleCount} ventas)`}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-700 shrink-0">{formatCLP(w.totalPay)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {payrollPanel.data.workers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Total a pagar este mes</p>
                    <p className="text-base font-bold text-slate-900">{formatCLP(payrollPanel.data.summary.totalPayroll)}</p>
                  </div>
                )}

                <p className="text-xs text-slate-400 mt-4">
                  Este monto es el bruto a pagar (sueldo base + comisión). No incluye cotizaciones previsionales, salud ni impuesto único — para eso, consulta con tu contador antes de formalizar contratos.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </motion.div>
  );
};

export default WorkersManagement;