// src/components/workers/RoleSelector.jsx
/**
 * Selector visual de roles con iconos y descripciones
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Crown, Briefcase, DollarSign, ShoppingBag, Eye, Wrench } from 'lucide-react';

const ROLE_CONFIG = {
  ADMIN: {
    icon: Crown,
    emoji: '⚡',
    name: 'Administrador',
    description: 'Acceso total al sistema',
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600'
  },
  ENCARGADA: {
    icon: Briefcase,
    emoji: '💼',
    name: 'Encargado/a de Tienda',
    description: 'Gestión completa y supervisión',
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600'
  },
  CAJERA: {
    icon: DollarSign,
    emoji: '💰',
    name: 'Cajero/a',
    description: 'Solo registro de ventas',
    color: 'green',
    gradient: 'from-green-500 to-green-600'
  },
  VENDEDORA: {
    icon: ShoppingBag,
    emoji: '🛍️',
    name: 'Vendedor',
    description: 'Ventas e inventario (sin costos)',
    color: 'pink',
    gradient: 'from-pink-500 to-pink-600'
  },
  SUPERVISOR: {
    icon: Eye,
    emoji: '👁️',
    name: 'Supervisor',
    description: 'Supervisión de bodegas',
    color: 'orange',
    gradient: 'from-orange-500 to-orange-600'
  },
  WORKER: {
    icon: Wrench,
    emoji: '🔧',
    name: 'Trabajador',
    description: 'Registro básico con límites',
    color: 'slate',
    gradient: 'from-slate-500 to-slate-600'
  },
  GERENTE: {
    icon: Briefcase,
    emoji: '💼',
    name: 'Gerente',
    description: 'Gestión completa y reportes',
    color: 'indigo',
    gradient: 'from-indigo-500 to-indigo-600'
  }
};

export default function RoleSelector({ selectedRole, onSelect, roles = [] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {roles.map(role => {
        const config = ROLE_CONFIG[role.id] || ROLE_CONFIG.WORKER;
        const Icon = config.icon;
        const isSelected = selectedRole === role.id;

        return (
          <motion.button
            key={role.id}
            onClick={() => onSelect(role.id)}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative p-6 rounded-2xl border-2 text-left transition-all
              ${isSelected
                ? `border-${config.color}-500 bg-${config.color}-50 shadow-lg shadow-${config.color}-200/50`
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }
            `}
          >
            {/* Badge seleccionado */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`absolute top-3 right-3 w-6 h-6 bg-gradient-to-br ${config.gradient} rounded-full flex items-center justify-center`}
              >
                <Shield className="w-4 h-4 text-white" />
              </motion.div>
            )}

            {/* Icono y emoji */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center
                ${isSelected
                  ? `bg-gradient-to-br ${config.gradient}`
                  : `bg-${config.color}-100`
                }
              `}>
                {isSelected ? (
                  <Icon className="w-6 h-6 text-white" />
                ) : (
                  <span className="text-2xl">{config.emoji}</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className={`font-bold text-sm ${isSelected ? `text-${config.color}-900` : 'text-slate-900'}`}>
                  {config.name}
                </h4>
              </div>
            </div>

            {/* Descripción */}
            <p className={`text-xs ${isSelected ? `text-${config.color}-700` : 'text-slate-600'}`}>
              {config.description}
            </p>

            {/* Permisos clave */}
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 3).map(perm => (
                  <span
                    key={perm}
                    className={`
                      inline-block px-2 py-0.5 rounded text-xs font-medium
                      ${isSelected
                        ? `bg-${config.color}-100 text-${config.color}-700`
                        : 'bg-slate-100 text-slate-600'
                      }
                    `}
                  >
                    {perm.replace(/_/g, ' ').slice(0, 12)}...
                  </span>
                ))}
                {role.permissions.length > 3 && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                    +{role.permissions.length - 3}
                  </span>
                )}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
