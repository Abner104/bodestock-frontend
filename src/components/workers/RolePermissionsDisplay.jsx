// src/components/workers/RolePermissionsDisplay.jsx
/**
 * Muestra los permisos de un rol de forma clara y visual
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Shield } from 'lucide-react';

const PERMISSIONS_INFO = {
  CAJERA: {
    allowed: [
      'Registrar ventas únicamente',
      'Ver precios de VENTA (para cobrar)',
      'Ver lista de productos y stock',
      'Acceso limitado a salidas/ventas'
    ],
    denied: [
      'Ver Dashboard (ganancias/inversión total)',
      'Ver Reportes financieros',
      'Ver precios de COSTO y PPP',
      'Ver ganancias por producto',
      'Ver valor total invertido',
      'Acceder a sección Inventario',
      'Usar otros motivos de salida',
      'Gestionar productos'
    ]
  },
  VENDEDORA: {
    allowed: [
      'Acceso a Inventario (sin costos)',
      'Ver precios de venta al público',
      'Registrar ventas y transferencias',
      'Ver stock completo'
    ],
    denied: [
      'Ver Dashboard (ganancias/inversión)',
      'Ver Reportes financieros',
      'Ver precios de costo y PPP',
      'Ver valor total del inventario',
      'Gestionar productos',
      'Eliminar productos'
    ]
  },
  ENCARGADA: {
    allowed: [
      'Gestión completa de la tienda',
      'Ver costos y ganancias',
      'Supervisar equipo',
      'Aprobar mermas',
      'Acceso a reportes'
    ],
    denied: []
  },
  ADMIN: {
    allowed: [
      'Acceso total al sistema',
      'Gestionar trabajadores',
      'Configurar sistema',
      'Ver todos los reportes'
    ],
    denied: []
  },
  SUPERVISOR: {
    allowed: [
      'Supervisión de bodegas',
      'Aprobar salidas',
      'Ver actividad del equipo',
      'Acceso a reportes'
    ],
    denied: [
      'Gestionar trabajadores',
      'Configurar sistema'
    ]
  },
  WORKER: {
    allowed: [
      'Registro de salidas básico',
      'Acceso a bodegas asignadas'
    ],
    denied: [
      'Ver costos',
      'Gestionar inventario'
    ]
  },
  GERENTE: {
    allowed: [
      'Gestión completa del negocio',
      'Ver costos y ganancias',
      'Acceso a todos los reportes',
      'Gestionar inventario',
      'Acceso a todas las bodegas',
      'Sin límites de retiro'
    ],
    denied: [
      'Gestionar trabajadores (solo ADMIN)'
    ]
  }
};

export default function RolePermissionsDisplay({ roleId }) {
  const info = PERMISSIONS_INFO[roleId] || PERMISSIONS_INFO.WORKER;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200"
    >
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-600" />
        <h4 className="font-bold text-slate-900">Permisos del Rol</h4>
      </div>

      {/* Permisos permitidos */}
      {info.allowed.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
            ✅ Puede hacer
          </p>
          <div className="space-y-2">
            {info.allowed.map((perm, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3"
              >
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-green-900">{perm}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Permisos denegados */}
      {info.denied.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
            ❌ NO puede hacer
          </p>
          <div className="space-y-2">
            {info.denied.map((perm, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (info.allowed.length + idx) * 0.05 }}
                className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3"
              >
                <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-900">{perm}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
