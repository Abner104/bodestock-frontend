// src/components/QuickActions.jsx
import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  TrendingUp,
  Package,
  Calendar,
  DollarSign,
  BarChart3,
  ShoppingCart,
  Users
} from 'lucide-react';

/**
 * Componente de sugerencias proactivas para el agente AI
 * Muestra botones contextuales según la página y estado del sistema
 */

const icons = {
  AlertTriangle,
  TrendingUp,
  Package,
  Calendar,
  DollarSign,
  BarChart3,
  ShoppingCart,
  Users
};

const QuickAction = ({ icon, text, action, variant = 'default', onClick }) => {
  const Icon = icons[icon] || Package;

  const variants = {
    default: 'bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border-indigo-200',
    warning: 'bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 text-orange-700 border-orange-200',
    success: 'bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 text-green-700 border-green-200',
    info: 'bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 text-blue-700 border-blue-200'
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(action)}
      className={`
        w-full p-3 rounded-xl border-2
        ${variants[variant]}
        flex items-center gap-3 text-left
        transition-all duration-200
        shadow-sm hover:shadow-md
      `}
    >
      <div className="flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{text}</p>
      </div>
      <div className="flex-shrink-0">
        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.button>
  );
};

/**
 * Generador de sugerencias contextuales
 * @param {Object} context - Contexto del usuario (página, filtros, etc.)
 * @param {Object} data - Datos del sistema (stock, productos, etc.)
 * @returns {Array} Array de sugerencias
 */
export const generateQuickActions = (context = {}, data = {}) => {
  const suggestions = [];
  const { page, filters } = context;
  const { stockBajo = [], productosVencen = [], sinRotacion = [] } = data;

  // Sugerencias según la página
  switch (page) {
    case '/inventario':
    case 'Gestión de Inventario':
      if (stockBajo.length > 0) {
        suggestions.push({
          icon: 'AlertTriangle',
          text: `${stockBajo.length} productos con stock bajo`,
          action: 'Muéstrame los productos con stock crítico',
          variant: 'warning'
        });
      }

      if (productosVencen.length > 0) {
        suggestions.push({
          icon: 'Calendar',
          text: `${productosVencen.length} productos próximos a vencer`,
          action: 'Muéstrame los productos que vencen pronto',
          variant: 'warning'
        });
      }

      if (sinRotacion.length > 0) {
        suggestions.push({
          icon: 'Package',
          text: `${sinRotacion.length} productos sin movimiento`,
          action: 'Analiza los productos sin rotación',
          variant: 'info'
        });
      }

      suggestions.push({
        icon: 'ShoppingCart',
        text: 'Registrar nueva compra',
        action: 'Quiero registrar una compra',
        variant: 'default'
      });
      break;

    case '/dashboard':
    case 'Dashboard':
    case '/':
      suggestions.push({
        icon: 'TrendingUp',
        text: 'Analizar tendencias de ventas',
        action: '¿Cuáles son mis productos más vendidos este mes?',
        variant: 'success'
      });

      suggestions.push({
        icon: 'DollarSign',
        text: 'Revisar costos y márgenes',
        action: 'Muéstrame un análisis de costos y rentabilidad',
        variant: 'info'
      });

      if (stockBajo.length > 0) {
        suggestions.push({
          icon: 'AlertTriangle',
          text: 'Alertas de inventario',
          action: 'Muéstrame todas las alertas de inventario',
          variant: 'warning'
        });
      }
      break;

    case '/productos':
    case 'Catálogo de Productos':
      suggestions.push({
        icon: 'Package',
        text: 'Crear nuevo producto',
        action: 'Quiero crear un nuevo producto',
        variant: 'default'
      });

      suggestions.push({
        icon: 'BarChart3',
        text: 'Analizar rendimiento de productos',
        action: 'Analiza qué productos tienen mejor margen',
        variant: 'success'
      });
      break;

    case '/trabajadores':
    case 'Gestión de Trabajadores':
      suggestions.push({
        icon: 'Users',
        text: 'Crear nuevo trabajador',
        action: 'Quiero agregar un nuevo trabajador',
        variant: 'default'
      });

      suggestions.push({
        icon: 'BarChart3',
        text: 'Ver actividad de trabajadores',
        action: 'Muéstrame la actividad reciente de los trabajadores',
        variant: 'info'
      });
      break;

    case '/costeo':
    case 'Wizard de Costeo':
      suggestions.push({
        icon: 'DollarSign',
        text: 'Ayuda con el costeo',
        action: 'Ayúdame a costear este producto paso a paso',
        variant: 'default'
      });

      suggestions.push({
        icon: 'BarChart3',
        text: 'Calcular precio sugerido',
        action: 'Calcula el precio de venta óptimo para este producto',
        variant: 'success'
      });
      break;
  }

  // Sugerencias generales (siempre disponibles)
  if (suggestions.length === 0) {
    suggestions.push({
      icon: 'Package',
      text: '¿Qué puedes hacer por mí?',
      action: '¿En qué puedes ayudarme?',
      variant: 'default'
    });
  }

  return suggestions.slice(0, 4); // Máximo 4 sugerencias
};

/**
 * Componente principal de Quick Actions
 */
const QuickActions = ({ context, data, onActionClick }) => {
  const actions = generateQuickActions(context, data);

  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
        Sugerencias
      </h3>
      <div className="space-y-2">
        {actions.map((action, index) => (
          <QuickAction
            key={index}
            {...action}
            onClick={onActionClick}
          />
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
