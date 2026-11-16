// src/components/workers/PermissionSelector.jsx
/**
 * Componente para seleccionar permisos granulares de un trabajador
 * Agrupa permisos por categorías y muestra descripciones
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Eye,
  Lock,
  Edit,
  Trash2,
  Users,
  BarChart3,
  Warehouse,
  Infinity
} from 'lucide-react';
import { AVAILABLE_PERMISSIONS, PERMISSION_CATEGORIES } from '../../config/database-schema.js';

const CATEGORY_ICONS = {
  "Lectura": Eye,
  "Información Sensible": Lock,
  "Escritura": Edit,
  "Eliminación": Trash2,
  "Gestión": Users,
  "Acceso a Secciones": BarChart3,
  "Acceso a Bodegas": Warehouse,
  "Límites": Infinity
};

const CATEGORY_COLORS = {
  "Lectura": "bg-blue-50 border-blue-200 text-blue-800",
  "Información Sensible": "bg-red-50 border-red-200 text-red-800",
  "Escritura": "bg-green-50 border-green-200 text-green-800",
  "Eliminación": "bg-orange-50 border-orange-200 text-orange-800",
  "Gestión": "bg-purple-50 border-purple-200 text-purple-800",
  "Acceso a Secciones": "bg-indigo-50 border-indigo-200 text-indigo-800",
  "Acceso a Bodegas": "bg-cyan-50 border-cyan-200 text-cyan-800",
  "Límites": "bg-yellow-50 border-yellow-200 text-yellow-800"
};

export default function PermissionSelector({
  selectedPermissions = [],
  onChange,
  disabled = false
}) {
  const [expandedCategories, setExpandedCategories] = useState([
    "Acceso a Secciones",
    "Información Sensible"
  ]);

  const toggleCategory = (category) => {
    if (expandedCategories.includes(category)) {
      setExpandedCategories(expandedCategories.filter(c => c !== category));
    } else {
      setExpandedCategories([...expandedCategories, category]);
    }
  };

  const handlePermissionToggle = (permissionId) => {
    if (disabled) return;

    if (selectedPermissions.includes(permissionId)) {
      onChange(selectedPermissions.filter(p => p !== permissionId));
    } else {
      onChange([...selectedPermissions, permissionId]);
    }
  };

  const isAllCategorySelected = (category) => {
    const categoryPermissions = PERMISSION_CATEGORIES[category];
    return categoryPermissions.every(p => selectedPermissions.includes(p));
  };

  const toggleAllCategory = (category) => {
    if (disabled) return;

    const categoryPermissions = PERMISSION_CATEGORIES[category];

    if (isAllCategorySelected(category)) {
      // Desmarcar todos
      onChange(selectedPermissions.filter(p => !categoryPermissions.includes(p)));
    } else {
      // Marcar todos
      const newPermissions = [...new Set([...selectedPermissions, ...categoryPermissions])];
      onChange(newPermissions);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          Permisos Personalizados
        </h4>
        <span className="text-xs text-slate-500">
          {selectedPermissions.length} permisos seleccionados
        </span>
      </div>

      <div className="space-y-2">
        {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
          const Icon = CATEGORY_ICONS[category];
          const isExpanded = expandedCategories.includes(category);
          const colorClass = CATEGORY_COLORS[category];

          return (
            <div
              key={category}
              className={`border-2 rounded-lg overflow-hidden ${colorClass}`}
            >
              {/* Header de la categoría */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:opacity-80 transition"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-2 flex-1">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{category}</span>
                  <span className="text-xs opacity-75">
                    ({permissions.filter(p => selectedPermissions.includes(p)).length}/{permissions.length})
                  </span>
                </div>

                {/* Botón seleccionar todos */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllCategory(category);
                  }}
                  disabled={disabled}
                  className="text-xs px-2 py-1 rounded hover:bg-white/50 transition"
                >
                  {isAllCategorySelected(category) ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>

              {/* Lista de permisos */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t-2 bg-white"
                  >
                    <div className="p-2 space-y-1">
                      {permissions.map(permissionId => {
                        const permission = AVAILABLE_PERMISSIONS[permissionId];
                        const isSelected = selectedPermissions.includes(permissionId);

                        return (
                          <label
                            key={permissionId}
                            className={`flex items-start gap-3 p-2 rounded cursor-pointer transition ${
                              disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handlePermissionToggle(permissionId)}
                              disabled={disabled}
                              className="mt-0.5 text-blue-600 focus:ring-blue-500 rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">
                                {permission.name}
                              </p>
                              <p className="text-xs text-slate-600">
                                {permission.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Resumen de permisos seleccionados */}
      {selectedPermissions.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-800 mb-2">
            📋 Resumen de permisos:
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedPermissions.map(permId => (
              <span
                key={permId}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
              >
                {AVAILABLE_PERMISSIONS[permId]?.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handlePermissionToggle(permId)}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
