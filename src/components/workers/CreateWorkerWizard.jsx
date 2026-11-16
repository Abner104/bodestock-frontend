// src/components/workers/CreateWorkerWizard.jsx
/**
 * Wizard completo para crear trabajadores
 * Paso 1: Información básica
 * Paso 2: Seleccionar rol
 * Paso 3: Personalizar permisos
 * Paso 4: Configurar límites y bodegas
 * Paso 5: Resumen y confirmar
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Mail,
  Lock,
  Shield,
  Settings,
  Warehouse,
  Eye,
  EyeOff,
  AlertCircle,
  BookOpen,
  DollarSign,
  Edit3,
  Trash2,
  Users,
  Layout,
  MapPin,
  Infinity,
  Package
} from 'lucide-react';
import { AVAILABLE_PERMISSIONS, PERMISSION_CATEGORIES, DEFAULT_ROLES } from '../../config/database-schema.js';
import { getPermissionUnlocks } from '../../config/permissions-routes-map.js';

// Un único acento (azul) para todas las categorías — evita el efecto "arcoíris"
// y mantiene la jerarquía visual a través de los íconos, no del color.
const ACCENT_COLORS = {
  border: "border-blue-500",
  borderLight: "border-blue-300",
  bg: "bg-blue-50",
  bgDark: "bg-blue-500/10",
  icon: "bg-blue-100",
  iconDark: "bg-blue-500/20",
  iconText: "text-blue-600",
  iconTextDark: "text-blue-400",
  badge: "bg-blue-500 text-white",
  badgePartial: "bg-blue-200 text-blue-900",
  badgePartialDark: "bg-blue-500/30 text-blue-300",
  checkbox: "bg-blue-500 border-blue-500",
  checkboxPartial: "bg-blue-200 border-blue-400",
  dot: "bg-blue-600",
  hover: "hover:bg-blue-100",
  hoverDark: "hover:bg-blue-500/15"
};

// Mapeo de categorías con iconos para mejor UX — todas comparten el mismo acento de color
const CATEGORY_DISPLAY = {
  "Lectura": { icon: BookOpen, colors: ACCENT_COLORS, description: "Consultar información" },
  "Información Sensible": { icon: DollarSign, colors: ACCENT_COLORS, description: "Ver costos y precios" },
  "Escritura": { icon: Edit3, colors: ACCENT_COLORS, description: "Crear y modificar datos" },
  "Eliminación": { icon: Trash2, colors: ACCENT_COLORS, description: "Eliminar registros" },
  "Gestión": { icon: Users, colors: ACCENT_COLORS, description: "Administrar equipo" },
  "Acceso a Secciones": { icon: Layout, colors: ACCENT_COLORS, description: "Navegar entre páginas" },
  "Acceso a Bodegas": { icon: MapPin, colors: ACCENT_COLORS, description: "Acceder a ubicaciones" },
  "Límites": { icon: Infinity, colors: ACCENT_COLORS, description: "Permisos especiales" }
};

export default function CreateWorkerWizard({
  onSubmit,
  onCancel,
  roles = [],
  warehouses = [],
  inventories = [],
  mode = 'create',
  initialData = null,
  isDark = false
}) {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  const [workerData, setWorkerData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        assignedInventories: initialData.assignedInventories || [],
        assignedWarehouses: initialData.assignedWarehouses || [],
        customPermissions: initialData.customPermissions || []
      };
    }
    return {
      name: '',
      email: '',
      generatePassword: true,
      password: '',
      role: 'CAJERA',
      customPermissions: [],
      limitType: 'MONEY',
      dailyLimitMoney: 50000,
      dailyLimitUnits: 20,
      assignedInventories: [],
      assignedWarehouses: [],
      receiveAlerts: true,
      receiveReports: true
    };
  });

  const [errors, setErrors] = useState({});

  const validateStep = () => {
    const newErrors = {};
    if (step === 1) {
      if (!workerData.name.trim()) newErrors.name = 'El nombre es obligatorio';
      if (!workerData.email.trim()) newErrors.email = 'El email es obligatorio';
      if (mode === 'create') {
        if (!workerData.generatePassword && !workerData.password) {
          newErrors.password = 'La contraseña es obligatoria';
        }
        if (!workerData.generatePassword && workerData.password && workerData.password.length < 6) {
          newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
        }
      }
    }
    if (step === 3 && workerData.customPermissions.length === 0) {
      newErrors.permissions = 'Debes seleccionar al menos un permiso';
    }
    if (step === 4 && workerData.assignedInventories.length === 0 && workerData.assignedWarehouses.length === 0) {
      newErrors.warehouses = 'Debes asignar al menos un inventario o una bodega';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => { if (!validateStep()) return; if (step < 5) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); setErrors({}); };

  const loadRolePermissions = (roleId) => {
    const roleData = roles.find(r => r.id === roleId);
    const defaultRole = DEFAULT_ROLES[roleId] || DEFAULT_ROLES[roleId.toUpperCase()];
    const permissions = (roleData?.permissions && roleData.permissions.length > 0)
      ? roleData.permissions
      : (defaultRole?.permissions || []);
    setWorkerData(prev => ({ ...prev, role: roleId, customPermissions: [...permissions] }));
  };

  const togglePermission = (permission) => {
    setWorkerData(prev => ({
      ...prev,
      customPermissions: prev.customPermissions.includes(permission)
        ? prev.customPermissions.filter(p => p !== permission)
        : [...prev.customPermissions, permission]
    }));
  };

  const toggleCategory = (category) => {
    const categoryPerms = PERMISSION_CATEGORIES[category];
    const allSelected = categoryPerms.every(p => workerData.customPermissions.includes(p));
    setWorkerData(prev => ({
      ...prev,
      customPermissions: allSelected
        ? prev.customPermissions.filter(p => !categoryPerms.includes(p))
        : [...new Set([...prev.customPermissions, ...categoryPerms])]
    }));
  };

  const toggleInventory = (inventoryId) => {
    setWorkerData(prev => ({
      ...prev,
      assignedInventories: prev.assignedInventories.includes(inventoryId)
        ? prev.assignedInventories.filter(i => i !== inventoryId)
        : [...prev.assignedInventories, inventoryId]
    }));
  };

  const toggleWarehouse = (warehouseId) => {
    setWorkerData(prev => ({
      ...prev,
      assignedWarehouses: prev.assignedWarehouses.includes(warehouseId)
        ? prev.assignedWarehouses.filter(w => w !== warehouseId)
        : [...prev.assignedWarehouses, warehouseId]
    }));
  };

  const handleSubmit = () => { if (!validateStep()) return; onSubmit(workerData); };

  // Dark mode helper classes
  const cls = {
    card: isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200',
    cardHover: isDark ? 'hover:border-slate-600' : 'hover:border-slate-300',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSub: isDark ? 'text-slate-400' : 'text-slate-600',
    textMuted: isDark ? 'text-slate-500' : 'text-slate-500',
    input: isDark
      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-blue-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-blue-500',
    inputError: 'border-red-500',
    surface: isDark ? 'bg-slate-700/50' : 'bg-slate-50',
    surfaceBorder: isDark ? 'border-slate-600' : 'border-slate-200',
  };

  return (
    <div className={`sm:rounded-2xl shadow-2xl sm:max-w-5xl w-full h-[100dvh] sm:h-auto sm:max-h-[95vh] overflow-hidden flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Header con Progress Bar */}
      <div className={`px-4 py-4 sm:px-6 sm:py-5 border-b pt-safe ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-800 border-slate-700'}`}>
        <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">
          {mode === 'edit' ? `Editar Trabajador: ${initialData?.name || ''}` : 'Crear Nuevo Trabajador'}
        </h2>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(num => (
            <React.Fragment key={num}>
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  num < step ? 'bg-blue-500 text-white' :
                  num === step ? 'bg-white text-slate-900 shadow' :
                  'bg-white/10 text-white/50'
                }`}>
                  {num < step ? <Check className="w-4 h-4" /> : num}
                </div>
                <span className={`text-xs mt-1 font-medium hidden sm:block ${num === step ? 'text-white font-bold' : 'text-white/50'}`}>
                  {num === 1 && 'Básico'}
                  {num === 2 && 'Rol'}
                  {num === 3 && 'Permisos'}
                  {num === 4 && 'Límites'}
                  {num === 5 && 'Confirmar'}
                </span>
              </div>
              {num < 5 && (
                <div className={`flex-1 h-0.5 rounded transition-all ${num < step ? 'bg-blue-500' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {/* PASO 1: Información Básica */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-7 h-7 text-blue-600" />
                <div>
                  <h3 className={`text-xl sm:text-2xl font-bold ${cls.text}`}>Información Básica</h3>
                  <p className={`text-sm ${cls.textSub}`}>Datos personales del trabajador</p>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-bold ${cls.text} mb-2`}>Nombre Completo *</label>
                <input
                  required type="text" value={workerData.name}
                  onChange={(e) => setWorkerData({ ...workerData, name: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 text-lg ${cls.input} ${errors.name ? cls.inputError : ''}`}
                  placeholder="Ej: María González Pérez"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.name}</p>}
              </div>

              <div>
                <label className={`block text-sm font-bold ${cls.text} mb-2 flex items-center gap-2`}>
                  <Mail className="w-4 h-4 text-blue-600" /> Email *
                </label>
                <input
                  required type="email" value={workerData.email}
                  onChange={(e) => setWorkerData({ ...workerData, email: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 text-lg ${cls.input} ${errors.email ? cls.inputError : ''}`}
                  placeholder="maria@ejemplo.com" disabled={mode === 'edit'}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.email}</p>}
                {mode === 'edit' && <p className={`text-xs ${cls.textMuted} mt-1`}>El email no se puede cambiar después de crear el trabajador</p>}
              </div>

              {mode === 'create' && (
                <div className={`border-2 rounded-xl p-4 space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={workerData.generatePassword}
                      onChange={(e) => setWorkerData({ ...workerData, generatePassword: e.target.checked, password: '' })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className={`text-sm font-semibold ${cls.text}`}>Generar contraseña segura automáticamente (Recomendado)</span>
                  </label>

                  {!workerData.generatePassword && (
                    <div>
                      <label className={`block text-sm font-bold ${cls.text} mb-2 flex items-center gap-2`}>
                        <Lock className="w-4 h-4 text-blue-600" /> Contraseña Manual *
                      </label>
                      <div className="relative">
                        <input
                          required={!workerData.generatePassword} type={showPassword ? 'text' : 'password'}
                          value={workerData.password}
                          onChange={(e) => setWorkerData({ ...workerData, password: e.target.value })}
                          className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:ring-2 ${cls.input} ${errors.password ? cls.inputError : ''}`}
                          placeholder="Mínimo 6 caracteres" minLength={6}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-red-500 text-sm mt-1 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.password}</p>}
                    </div>
                  )}

                  {workerData.generatePassword && (
                    <div className={`border rounded-lg p-3 ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                      <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                        Se generará una contraseña segura de 12 caracteres automáticamente
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* PASO 2: Seleccionar Rol */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-7 h-7 text-blue-600" />
                <div>
                  <h3 className={`text-xl sm:text-2xl font-bold ${cls.text}`}>Seleccionar Rol</h3>
                  <p className={`text-sm ${cls.textSub}`}>Elige un rol base para cargar permisos predefinidos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map(role => {
                  const isSelected = workerData.role === role.id;
                  return (
                    <motion.button key={role.id} type="button" onClick={() => loadRolePermissions(role.id)}
                      whileTap={{ scale: 0.97 }}
                      className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                        isSelected
                          ? isDark ? 'border-blue-500 bg-blue-500/15 shadow-lg shadow-blue-500/20' : 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-200/50'
                          : isDark ? 'border-slate-700 bg-slate-800 hover:border-blue-500/40' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                      }`}>
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="text-3xl mb-3">{getRoleEmoji(role.id)}</div>
                      <h4 className={`font-bold text-lg mb-1 ${cls.text}`}>{role.name}</h4>
                      <p className={`text-xs ${cls.textSub}`}>{role.description}</p>
                      {role.permissions && (
                        <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                          <p className={`text-xs ${cls.textMuted}`}>{role.permissions.length} permisos incluidos</p>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className={`border-2 rounded-xl p-4 ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                  <strong>Tip:</strong> En el siguiente paso podrás personalizar los permisos según tus necesidades
                </p>
              </div>
            </motion.div>
          )}

          {/* PASO 3: Personalizar Permisos */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-7 h-7 text-blue-600 flex-shrink-0" />
                  <div>
                    <h3 className={`text-xl sm:text-2xl font-bold ${cls.text}`}>Permisos Personalizados</h3>
                    <p className={`text-sm ${cls.textSub}`}>Ajusta los permisos según necesites</p>
                  </div>
                </div>
                <div className={`border-2 rounded-xl px-4 py-2 self-start sm:self-auto ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-300'}`}>
                  <p className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                    {workerData.customPermissions.length} permisos
                  </p>
                </div>
              </div>

              {errors.permissions && (
                <div className={`border-2 rounded-xl p-4 flex items-center gap-2 ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-300'}`}>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className={`font-medium ${isDark ? 'text-red-400' : 'text-red-900'}`}>{errors.permissions}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:max-h-[500px] sm:overflow-y-auto">
                {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
                  const allSelected = permissions.every(p => workerData.customPermissions.includes(p));
                  const someSelected = permissions.some(p => workerData.customPermissions.includes(p));
                  const categoryInfo = CATEGORY_DISPLAY[category] || {
                    icon: Shield,
                    colors: { border: "border-slate-500", borderLight: "border-slate-300", bg: "bg-slate-50", bgDark: "bg-slate-500/10", icon: "bg-slate-100", iconDark: "bg-slate-500/20", iconText: "text-slate-600", iconTextDark: "text-slate-400", badge: "bg-slate-500 text-white", badgePartial: "bg-slate-200 text-slate-900", badgePartialDark: "bg-slate-500/30 text-slate-300", checkbox: "bg-slate-500 border-slate-500", checkboxPartial: "bg-slate-200 border-slate-400", dot: "bg-slate-600", hover: "hover:bg-slate-100", hoverDark: "hover:bg-slate-500/15" },
                    description: ""
                  };
                  const Icon = categoryInfo.icon;
                  const c = categoryInfo.colors;

                  return (
                    <div key={category}
                      className={`border-2 rounded-xl overflow-hidden transition-all ${
                        allSelected ? `${c.border} ${isDark ? c.bgDark : c.bg}` :
                        someSelected ? `${c.borderLight} ${isDark ? 'bg-slate-800/50' : ''}` :
                        isDark ? 'border-slate-700 bg-slate-800 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}>
                      <button type="button"
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                        className={`w-full transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-750' : 'bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200'}`}>
                        <div className="flex items-center gap-3 p-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? c.iconDark : c.icon}`}>
                            <Icon className={`w-5 h-5 ${isDark ? c.iconTextDark : c.iconText}`} />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-bold text-sm ${cls.text}`}>{category}</h4>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                allSelected ? c.badge :
                                someSelected ? (isDark ? c.badgePartialDark : c.badgePartial) :
                                isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {permissions.filter(p => workerData.customPermissions.includes(p)).length}/{permissions.length}
                              </span>
                            </div>
                            <p className={`text-xs mt-0.5 ${cls.textSub}`}>{categoryInfo.description}</p>
                          </div>
                          <div onClick={(e) => { e.stopPropagation(); toggleCategory(category); }}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${
                              allSelected ? c.checkbox :
                              someSelected ? c.checkboxPartial :
                              isDark ? 'border-slate-600 hover:border-slate-500' : 'border-slate-300 hover:border-slate-400'
                            }`}>
                            {allSelected && <Check className="w-4 h-4 text-white" />}
                            {someSelected && !allSelected && <span className={`w-2 h-2 ${c.dot} rounded-sm`} />}
                          </div>
                          <span className={`text-xs ${cls.textMuted}`}>{expandedCategories[category] ? '▼' : '▶'}</span>
                        </div>
                      </button>

                      {expandedCategories[category] && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className={`border-t-2 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
                          <div className="p-3 space-y-2">
                            {permissions.map(permId => {
                              const perm = AVAILABLE_PERMISSIONS[permId];
                              const isSelected = workerData.customPermissions.includes(permId);
                              const unlocks = getPermissionUnlocks(permId);
                              if (!perm) return null;

                              return (
                                <label key={permId}
                                  className={`flex items-start gap-3 cursor-pointer p-2 rounded-lg transition-all ${
                                    isSelected ? (isDark ? c.bgDark + ' ' + c.hoverDark : c.bg + ' ' + c.hover) : (isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50')
                                  }`}>
                                  <div onClick={() => togglePermission(permId)}
                                    className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                      isSelected ? c.checkbox : isDark ? 'border-slate-600' : 'border-slate-300'
                                    }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`text-xs font-semibold ${cls.text}`}>{perm.name}</p>
                                    {perm.description && <p className={`text-[10px] mt-0.5 ${cls.textSub}`}>{perm.description}</p>}
                                    {unlocks && (
                                      <p className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded inline-block ${isDark ? 'text-green-400 bg-green-500/10' : 'text-green-600 bg-green-50'}`}>
                                        {unlocks}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* PASO 4: Límites y Bodegas */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-7 h-7 text-blue-600" />
                <div>
                  <h3 className={`text-xl sm:text-2xl font-bold ${cls.text}`}>Límites y Bodegas</h3>
                  <p className={`text-sm ${cls.textSub}`}>Configura restricciones y accesos</p>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-bold ${cls.text} mb-3`}>Tipo de Límite Diario</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { type: 'NONE', label: '∞ Sin Límite' },
                    { type: 'MONEY', label: 'Por Dinero' },
                    { type: 'UNITS', label: 'Por Unidades' }
                  ].map(({ type, label }) => (
                    <button key={type} type="button"
                      onClick={() => setWorkerData({ ...workerData, limitType: type })}
                      className={`px-2 py-3 sm:p-4 rounded-xl border-2 font-medium text-xs sm:text-base text-center leading-tight transition-all ${
                        workerData.limitType === type
                          ? isDark ? 'border-blue-500 bg-blue-500/15 text-blue-300' : 'border-blue-500 bg-blue-50 text-blue-900'
                          : isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 hover:border-blue-300'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {workerData.limitType === 'MONEY' && (
                <div>
                  <label className={`block text-sm font-bold ${cls.text} mb-2`}>Límite Diario en Dinero (CLP)</label>
                  <input type="number" value={workerData.dailyLimitMoney}
                    onChange={(e) => setWorkerData({ ...workerData, dailyLimitMoney: parseInt(e.target.value) || 0 })}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 text-lg ${cls.input}`}
                  />
                  <p className={`text-sm ${cls.textSub} mt-1`}>Límite: ${workerData.dailyLimitMoney?.toLocaleString('es-CL')} por día</p>
                </div>
              )}

              {workerData.limitType === 'UNITS' && (
                <div>
                  <label className={`block text-sm font-bold ${cls.text} mb-2`}>Límite Diario en Unidades</label>
                  <input type="number" value={workerData.dailyLimitUnits}
                    onChange={(e) => setWorkerData({ ...workerData, dailyLimitUnits: parseInt(e.target.value) || 0 })}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 text-lg ${cls.input}`}
                  />
                </div>
              )}

              {/* Inventarios */}
              <div>
                <label className={`block text-sm font-bold ${cls.text} mb-3 flex items-center gap-2`}>
                  <Package className="w-5 h-5 text-blue-600" /> Inventarios Asignados
                </label>
                <p className={`text-xs ${cls.textSub} mb-3`}>Selecciona los inventarios a los que tendrá acceso</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {inventories.map(inventory => {
                    const isSelected = workerData.assignedInventories.includes(inventory.id);
                    return (
                      <button key={inventory.id} type="button" onClick={() => toggleInventory(inventory.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? isDark ? 'border-blue-500 bg-blue-500/15' : 'border-blue-500 bg-blue-50'
                            : isDark ? 'border-slate-700 hover:border-blue-500/40' : 'border-slate-200 hover:border-blue-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-blue-500 border-blue-500' : isDark ? 'border-slate-600' : 'border-slate-300'
                          }`}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
                          <div className="flex-1">
                            <p className={`font-semibold text-sm ${cls.text}`}>{inventory.name || 'Sin nombre'}</p>
                            {inventory.description && <p className={`text-xs ${cls.textMuted}`}>{inventory.description}</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {inventories.length === 0 && (
                  <div className={`border-2 rounded-xl p-4 text-center ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`}>
                    <AlertCircle className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                    <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>No hay inventarios disponibles</p>
                  </div>
                )}
              </div>

              {/* Bodegas */}
              <div>
                <label className={`block text-sm font-bold ${cls.text} mb-3 flex items-center gap-2`}>
                  <Warehouse className="w-5 h-5 text-blue-600" /> Bodegas Asignadas (Opcional)
                </label>
                <p className={`text-xs ${cls.textSub} mb-3`}>O selecciona bodegas específicas del sistema principal</p>

                {errors.warehouses && (
                  <div className={`border-2 rounded-xl p-3 mb-3 flex items-center gap-2 ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-300'}`}>
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-900'}`}>{errors.warehouses}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {warehouses.map(warehouse => {
                    const isSelected = workerData.assignedWarehouses.includes(warehouse.id);
                    return (
                      <button key={warehouse.id} type="button" onClick={() => toggleWarehouse(warehouse.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? isDark ? 'border-blue-500 bg-blue-500/15' : 'border-blue-500 bg-blue-50'
                            : isDark ? 'border-slate-700 hover:border-blue-500/40' : 'border-slate-200 hover:border-blue-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-blue-500 border-blue-500' : isDark ? 'border-slate-600' : 'border-slate-300'
                          }`}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
                          <div className="flex-1">
                            <p className={`font-semibold text-sm ${cls.text}`}>{warehouse.name}</p>
                            {warehouse.location && <p className={`text-xs ${cls.textMuted}`}>{warehouse.location}</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* PASO 5: Resumen */}
          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Check className="w-7 h-7 text-green-600" />
                <div>
                  <h3 className={`text-xl sm:text-2xl font-bold ${cls.text}`}>Resumen Final</h3>
                  <p className={`text-sm ${cls.textSub}`}>Verifica la información antes de crear</p>
                </div>
              </div>

              <div className={`border-2 rounded-2xl p-6 space-y-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50/60 border-blue-200'}`}>
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-200'}`}>
                  <h4 className={`font-bold mb-3 flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-900'}`}>
                    <User className="w-5 h-5" /> Información Personal
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className={cls.textSub}>Nombre:</span><span className={`font-bold ${cls.text}`}>{workerData.name}</span></div>
                    <div className="flex justify-between"><span className={cls.textSub}>Email:</span><span className={`font-medium ${cls.text}`}>{workerData.email}</span></div>
                    <div className="flex justify-between">
                      <span className={cls.textSub}>Contraseña:</span>
                      <span className="text-green-500 font-medium">{workerData.generatePassword ? 'Generada automáticamente' : 'Manual'}</span>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-200'}`}>
                  <h4 className={`font-bold mb-3 flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-900'}`}>
                    <Shield className="w-5 h-5" /> Rol y Permisos
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={cls.textSub}>Rol:</span>
                      <span className={`font-bold ${cls.text}`}>{roles.find(r => r.id === workerData.role)?.name || workerData.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={cls.textSub}>Permisos:</span>
                      <span className="font-bold text-blue-500">{workerData.customPermissions.length} seleccionados</span>
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-200'}`}>
                  <h4 className={`font-bold mb-3 flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-900'}`}>
                    <Settings className="w-5 h-5" /> Configuración
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={cls.textSub}>Límite:</span>
                      <span className={`font-bold ${cls.text}`}>
                        {workerData.limitType === 'NONE' && '∞ Sin límite'}
                        {workerData.limitType === 'MONEY' && `$${workerData.dailyLimitMoney?.toLocaleString('es-CL')}/día`}
                        {workerData.limitType === 'UNITS' && `${workerData.dailyLimitUnits} unidades/día`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={cls.textSub}>Bodegas:</span>
                      <span className="font-bold text-blue-500">{workerData.assignedWarehouses.length} asignadas</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`border-2 rounded-xl p-4 ${isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-300'}`}>
                <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-900'}`}>
                  <strong>Importante:</strong> Al confirmar se enviará un email al trabajador con sus credenciales de acceso
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className={`flex-shrink-0 border-t-2 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-2 pb-safe ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
        <button type="button" onClick={step === 1 ? onCancel : prevStep}
          className={`px-4 sm:px-6 py-3 border-2 rounded-xl font-medium flex items-center gap-2 transition-all ${
            isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-white'
          }`}>
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Cancelar' : 'Atrás'}
        </button>

        {step < 5 ? (
          <button type="button" onClick={nextStep}
            className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium flex items-center gap-2 shadow-lg shadow-blue-600/25">
            Siguiente <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit}
            className="px-4 sm:px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-medium flex items-center gap-2 shadow-lg shadow-green-600/25">
            <Check className="w-5 h-5" />
            {mode === 'edit' ? 'Guardar Cambios' : 'Crear Trabajador'}
          </button>
        )}
      </div>
    </div>
  );
}

function getRoleEmoji(roleId) {
  const emojis = {
    ADMIN: '⚡',
    ENCARGADA: '👩‍💼',
    CAJERA: '💰',
    VENDEDORA: '🛍️',
    SUPERVISOR: '👁️',
    WORKER: '🔧',
    GERENTE: '💼'
  };
  return emojis[roleId] || '👤';
}
