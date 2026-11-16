// src/components/workers/CreateRoleWizard.jsx
/**
 * Wizard para crear roles personalizados con permisos a medida
 * Paso 1: Información del rol
 * Paso 2: Selección de permisos
 * Paso 3: Configuración de límites
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Shield, Settings, Users } from 'lucide-react';
import { AVAILABLE_PERMISSIONS, PERMISSION_CATEGORIES } from '../../config/database-schema.js';

export default function CreateRoleWizard({ onSubmit, onCancel }) {
  const [step, setStep] = useState(1);
  const [roleData, setRoleData] = useState({
    id: '',
    name: '',
    description: '',
    permissions: [],
    isSystemRole: false,
    defaultLimitType: 'MONEY',
    defaultDailyLimitMoney: 50000,
    defaultDailyLimitUnits: 20
  });

  const [expandedCategories, setExpandedCategories] = useState({});

  // Toggle permiso
  const togglePermission = (permission) => {
    setRoleData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  // Toggle categoría completa
  const toggleCategory = (category) => {
    const categoryPerms = PERMISSION_CATEGORIES[category];
    const allSelected = categoryPerms.every(p => roleData.permissions.includes(p));

    setRoleData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !categoryPerms.includes(p))
        : [...new Set([...prev.permissions, ...categoryPerms])]
    }));
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    // Generar ID automático si no existe
    const finalData = {
      ...roleData,
      id: roleData.id || roleData.name.toUpperCase().replace(/\s+/g, '_')
    };
    onSubmit(finalData);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header con pasos */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-2xl font-bold text-white mb-4">Crear Rol Personalizado</h2>

        {/* Progress Steps */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(num => (
            <React.Fragment key={num}>
              <div className={`flex items-center gap-2 ${num <= step ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  num < step ? 'bg-green-400 text-white' :
                  num === step ? 'bg-white text-blue-600' :
                  'bg-blue-400 text-white'
                }`}>
                  {num < step ? <Check className="w-5 h-5" /> : num}
                </div>
                <span className="text-white text-sm font-medium hidden sm:block">
                  {num === 1 && 'Información'}
                  {num === 2 && 'Permisos'}
                  {num === 3 && 'Configuración'}
                </span>
              </div>
              {num < 3 && <div className="flex-1 h-1 bg-blue-400 rounded" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {/* PASO 1: Información del Rol */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-900">Información del Rol</h3>
              </div>

              {/* Nombre del Rol */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Nombre del Rol *
                </label>
                <input
                  required
                  type="text"
                  value={roleData.name}
                  onChange={(e) => setRoleData({ ...roleData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  placeholder="Ej: Jefe de Bodega, Contador, Operador de Caja..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Este nombre se mostrará en todo el sistema
                </p>
              </div>

              {/* ID del Rol (opcional) */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  ID del Rol (opcional)
                </label>
                <input
                  type="text"
                  value={roleData.id}
                  onChange={(e) => setRoleData({ ...roleData, id: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Ej: JEFE_BODEGA (se genera automático si lo dejas vacío)"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Identificador único interno (mayúsculas, sin espacios)
                </p>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Descripción *
                </label>
                <textarea
                  required
                  value={roleData.description}
                  onChange={(e) => setRoleData({ ...roleData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Describe qué hace este rol y sus responsabilidades..."
                />
              </div>

              {/* Preview */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Vista Previa:</p>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="font-bold text-slate-900">{roleData.name || 'Nombre del Rol'}</p>
                  <p className="text-xs text-slate-600 mt-1">{roleData.description || 'Descripción del rol'}</p>
                  {roleData.id && (
                    <p className="text-xs text-slate-400 mt-1 font-mono">ID: {roleData.id}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* PASO 2: Selección de Permisos */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-900">Permisos del Rol</h3>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Selecciona qué puede hacer este rol en el sistema. Puedes marcar permisos individuales o categorías completas.
              </p>

              {/* Contador de permisos */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-900">
                    ✅ Permisos seleccionados: {roleData.permissions.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRoleData({ ...roleData, permissions: [] })}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Limpiar todo
                  </button>
                </div>
              </div>

              {/* Lista de Permisos por Categoría */}
              <div className="space-y-3 max-h-96 overflow-y-auto border-2 border-slate-200 rounded-xl p-4">
                {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
                  const allSelected = permissions.every(p => roleData.permissions.includes(p));
                  const someSelected = permissions.some(p => roleData.permissions.includes(p));

                  return (
                    <div key={category} className="border-b border-slate-200 pb-3 last:border-b-0">
                      {/* Header de Categoría */}
                      <button
                        type="button"
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                        className="w-full flex items-center justify-between py-2 hover:bg-slate-50 rounded-lg px-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategory(category);
                            }}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                              allSelected
                                ? 'bg-blue-500 border-blue-500'
                                : someSelected
                                ? 'bg-blue-200 border-blue-400'
                                : 'border-slate-300 hover:border-blue-400'
                            }`}
                          >
                            {allSelected && <Check className="w-4 h-4 text-white" />}
                            {someSelected && !allSelected && <span className="w-2 h-2 bg-blue-600 rounded-sm" />}
                          </div>
                          <span className="font-bold text-slate-900">{category}</span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {permissions.filter(p => roleData.permissions.includes(p)).length}/{permissions.length}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {expandedCategories[category] ? '▼' : '▶'}
                        </span>
                      </button>

                      {/* Permisos */}
                      {expandedCategories[category] && (
                        <div className="ml-9 mt-3 space-y-2">
                          {permissions.map(permId => {
                            const perm = AVAILABLE_PERMISSIONS[permId];
                            const isSelected = roleData.permissions.includes(permId);

                            return (
                              <label
                                key={permId}
                                className="flex items-start gap-3 cursor-pointer hover:bg-blue-50 p-3 rounded-lg border border-transparent hover:border-blue-200 transition-all"
                              >
                                <div
                                  onClick={() => togglePermission(permId)}
                                  className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                    isSelected
                                      ? 'bg-blue-500 border-blue-500'
                                      : 'border-slate-300 hover:border-blue-400'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-slate-900">{perm?.name || permId}</p>
                                  <p className="text-xs text-slate-600 mt-0.5">{perm?.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* PASO 3: Configuración */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-900">Configuración de Límites</h3>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Define los límites diarios por defecto para trabajadores con este rol
              </p>

              {/* Tipo de Límite */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-3">
                  Tipo de Límite
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setRoleData({ ...roleData, defaultLimitType: 'NONE' })}
                    className={`p-4 rounded-xl border-2 font-medium transition-all ${
                      roleData.defaultLimitType === 'NONE'
                        ? 'border-green-500 bg-green-50 text-green-900'
                        : 'border-slate-200 hover:border-green-300'
                    }`}
                  >
                    ∞ Sin Límite
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleData({ ...roleData, defaultLimitType: 'MONEY' })}
                    className={`p-4 rounded-xl border-2 font-medium transition-all ${
                      roleData.defaultLimitType === 'MONEY'
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    💰 Por Dinero
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleData({ ...roleData, defaultLimitType: 'UNITS' })}
                    className={`p-4 rounded-xl border-2 font-medium transition-all ${
                      roleData.defaultLimitType === 'UNITS'
                        ? 'border-purple-500 bg-purple-50 text-purple-900'
                        : 'border-slate-200 hover:border-purple-300'
                    }`}
                  >
                    📦 Por Unidades
                  </button>
                </div>
              </div>

              {/* Límite de Dinero */}
              {roleData.defaultLimitType === 'MONEY' && (
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Límite Diario en Dinero (CLP)
                  </label>
                  <input
                    type="number"
                    value={roleData.defaultDailyLimitMoney}
                    onChange={(e) => setRoleData({ ...roleData, defaultDailyLimitMoney: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-lg"
                    placeholder="50000"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Máximo valor diario que puede retirar: ${roleData.defaultDailyLimitMoney?.toLocaleString('es-CL')}
                  </p>
                </div>
              )}

              {/* Límite de Unidades */}
              {roleData.defaultLimitType === 'UNITS' && (
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Límite Diario en Unidades
                  </label>
                  <input
                    type="number"
                    value={roleData.defaultDailyLimitUnits}
                    onChange={(e) => setRoleData({ ...roleData, defaultDailyLimitUnits: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-lg"
                    placeholder="20"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Máximo de productos/unidades que puede retirar por día
                  </p>
                </div>
              )}

              {/* Resumen Final */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 mt-6">
                <h4 className="font-bold text-lg text-blue-900 mb-4">📋 Resumen del Rol</h4>
                <div className="space-y-3 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <span className="text-slate-600">Nombre:</span>
                    <span className="ml-2 font-bold text-slate-900">{roleData.name}</span>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <span className="text-slate-600">Permisos:</span>
                    <span className="ml-2 font-bold text-blue-600">{roleData.permissions.length} seleccionados</span>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <span className="text-slate-600">Límite:</span>
                    <span className="ml-2 font-bold text-slate-900">
                      {roleData.defaultLimitType === 'NONE' && '∞ Sin límite'}
                      {roleData.defaultLimitType === 'MONEY' && `$${roleData.defaultDailyLimitMoney?.toLocaleString('es-CL')}/día`}
                      {roleData.defaultLimitType === 'UNITS' && `${roleData.defaultDailyLimitUnits} unidades/día`}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer con botones */}
      <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
        <button
          type="button"
          onClick={step === 1 ? onCancel : prevStep}
          className="px-6 py-2 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-white transition font-medium flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Cancelar' : 'Atrás'}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={nextStep}
            disabled={step === 1 && (!roleData.name || !roleData.description)}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Crear Rol
          </button>
        )}
      </div>
    </div>
  );
}
