// src/components/workers/SimpleWorkerForm.jsx
/**
 * Formulario SIMPLE para crear/editar trabajadores
 * TODO EN UNO: Nombre, email, rol, permisos
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Check, X } from 'lucide-react';
import { AVAILABLE_PERMISSIONS, PERMISSION_CATEGORIES, DEFAULT_ROLES } from '../../config/database-schema.js';

export default function SimpleWorkerForm({ onSubmit, onCancel, initialData = null, roles = [] }) {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    role: initialData?.role || 'CAJERA',
    customPermissions: initialData?.customPermissions || [],
    generatePassword: true,
    password: '',
    limitType: 'MONEY',
    dailyLimitMoney: 50000,
    dailyLimitUnits: 20,
    assignedWarehouses: initialData?.assignedWarehouses || []
  });

  const [expandedCategories, setExpandedCategories] = useState({});

  // Toggle permiso individual
  const togglePermission = (permission) => {
    setForm(prev => ({
      ...prev,
      customPermissions: prev.customPermissions.includes(permission)
        ? prev.customPermissions.filter(p => p !== permission)
        : [...prev.customPermissions, permission]
    }));
  };

  // Toggle categoría completa
  const toggleCategory = (category) => {
    const categoryPerms = PERMISSION_CATEGORIES[category];
    const allSelected = categoryPerms.every(p => form.customPermissions.includes(p));

    setForm(prev => ({
      ...prev,
      customPermissions: allSelected
        ? prev.customPermissions.filter(p => !categoryPerms.includes(p))
        : [...new Set([...prev.customPermissions, ...categoryPerms])]
    }));
  };

  // Cargar permisos del rol seleccionado
  const loadRolePermissions = (roleId) => {
    const roleData = DEFAULT_ROLES[roleId];
    if (roleData) {
      setForm(prev => ({
        ...prev,
        role: roleId,
        customPermissions: [...roleData.permissions]
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white rounded-xl">
      {/* Información Básica */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          Información del Trabajador
        </h3>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nombre Completo *
          </label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ej: María González"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email *
          </label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="maria@ejemplo.com"
          />
        </div>
      </div>

      {/* Rol Base */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Rol Base (opcional)
        </h3>
        <p className="text-sm text-slate-600">
          Selecciona un rol para cargar permisos predefinidos, luego personaliza abajo
        </p>
        <div className="grid grid-cols-3 gap-2">
          {roles.map(role => (
            <button
              key={role.id}
              type="button"
              onClick={() => loadRolePermissions(role.id)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                form.role === role.id
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
              }`}
            >
              {role.name}
            </button>
          ))}
        </div>
      </div>

      {/* Permisos Personalizados */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900">
          Permisos Personalizados
        </h3>
        <p className="text-sm text-slate-600">
          Marca o desmarca los permisos que quieres dar a este trabajador
        </p>

        {/* Lista de Permisos por Categoría */}
        <div className="space-y-3 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-4">
          {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
            const allSelected = permissions.every(p => form.customPermissions.includes(p));
            const someSelected = permissions.some(p => form.customPermissions.includes(p));

            return (
              <div key={category} className="border-b border-slate-200 pb-3 last:border-b-0">
                {/* Categoría Header */}
                <button
                  type="button"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                  className="w-full flex items-center justify-between py-2 hover:bg-slate-50 rounded px-2"
                >
                  <div className="flex items-center gap-2">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(category);
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                        allSelected
                          ? 'bg-blue-500 border-blue-500'
                          : someSelected
                          ? 'bg-blue-200 border-blue-400'
                          : 'border-slate-300'
                      }`}
                    >
                      {allSelected && <Check className="w-3 h-3 text-white" />}
                      {someSelected && !allSelected && <span className="w-2 h-2 bg-blue-600 rounded-sm" />}
                    </div>
                    <span className="font-semibold text-sm text-slate-900">{category}</span>
                    <span className="text-xs text-slate-500">
                      ({permissions.filter(p => form.customPermissions.includes(p)).length}/{permissions.length})
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {expandedCategories[category] ? '▼' : '▶'}
                  </span>
                </button>

                {/* Permisos de la Categoría */}
                {expandedCategories[category] && (
                  <div className="ml-7 mt-2 space-y-2">
                    {permissions.map(permId => {
                      const perm = AVAILABLE_PERMISSIONS[permId];
                      const isSelected = form.customPermissions.includes(permId);

                      return (
                        <label
                          key={permId}
                          className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                        >
                          <div
                            onClick={() => togglePermission(permId)}
                            className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{perm?.name || permId}</p>
                            <p className="text-xs text-slate-500">{perm?.description}</p>
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

        {/* Resumen de permisos seleccionados */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-semibold text-blue-900">
            ✅ Total de permisos seleccionados: {form.customPermissions.length}
          </p>
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {initialData ? 'Actualizar Trabajador' : 'Crear Trabajador'}
        </button>
      </div>
    </form>
  );
}
