// src/components/costing/PriceScenarios.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Target, Check } from 'lucide-react';

const COLOR_STYLES = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    iconBg: 'bg-blue-500',
    check: 'bg-blue-500',
    title: 'text-blue-900 dark:text-blue-200',
    price: 'text-blue-600 dark:text-blue-300',
    gain: 'text-blue-600 dark:text-blue-300',
    divider: 'border-blue-200 dark:border-blue-700',
    label: 'text-blue-800 dark:text-blue-300',
  },
  emerald: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconBg: 'bg-emerald-500',
    check: 'bg-emerald-500',
    title: 'text-emerald-900 dark:text-emerald-200',
    price: 'text-emerald-600 dark:text-emerald-300',
    gain: 'text-emerald-600 dark:text-emerald-300',
    divider: 'border-emerald-200 dark:border-emerald-700',
    label: 'text-emerald-800 dark:text-emerald-300',
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    iconBg: 'bg-purple-500',
    check: 'bg-purple-500',
    title: 'text-purple-900 dark:text-purple-200',
    price: 'text-purple-600 dark:text-purple-300',
    gain: 'text-purple-600 dark:text-purple-300',
    divider: 'border-purple-200 dark:border-purple-700',
    label: 'text-purple-800 dark:text-purple-300',
  },
};

const PriceScenarios = ({ costoTotal, onSelectScenario, selectedScenario, formatPrice }) => {
  const formatCurrency = formatPrice;

  const scenarios = [
    {
      id: 'conservador',
      name: 'Conservador',
      utilidad: 100,
      icon: TrendingDown,
      color: 'blue',
      description: 'Margen bajo, competitivo'
    },
    {
      id: 'recomendado',
      name: 'Recomendado',
      utilidad: 150,
      icon: Target,
      color: 'emerald',
      description: 'Balance ideal precio-ganancia',
      recommended: true
    },
    {
      id: 'agresivo',
      name: 'Agresivo',
      utilidad: 200,
      icon: TrendingUp,
      color: 'purple',
      description: 'Máxima rentabilidad'
    }
  ];

  const calcularPrecio = (utilidadPorcentaje) => {
    return costoTotal * (1 + utilidadPorcentaje / 100);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Estrategias de precio</h3>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Tocá una para aplicarla</p>
      </div>

      {/* Cards en scroll horizontal en móvil, grid en desktop */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
        {scenarios.map((scenario, index) => {
          const precio = calcularPrecio(scenario.utilidad);
          const ganancia = precio - costoTotal;
          const isSelected = selectedScenario === scenario.id;
          const Icon = scenario.icon;
          const cs = COLOR_STYLES[scenario.color];

          return (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectScenario(scenario.id, scenario.utilidad)}
              className={`relative cursor-pointer rounded-2xl p-4 border-2 transition-all flex-shrink-0 w-[160px] md:w-auto ${
                isSelected
                  ? `${cs.border} ${cs.bg} shadow-md`
                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              {scenario.recommended && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[10px] font-bold rounded-full shadow whitespace-nowrap">
                  ⭐ RECOMENDADO
                </div>
              )}
              {isSelected && (
                <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 ${cs.check} rounded-full flex items-center justify-center shadow`}>
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${isSelected ? cs.iconBg : 'bg-gray-100 dark:bg-slate-700'}`}>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
              </div>

              <h4 className={`text-sm font-bold mb-0.5 ${isSelected ? cs.title : 'text-gray-900 dark:text-white'}`}>
                {scenario.name}
              </h4>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-3">{scenario.description}</p>

              <p className={`text-lg font-black mb-2 ${isSelected ? cs.price : 'text-gray-900 dark:text-white'}`}>
                {formatCurrency(precio)}
              </p>

              <div className={`pt-2 border-t space-y-1 ${isSelected ? cs.divider : 'border-gray-100 dark:border-slate-700'}`}>
                <div className="flex justify-between text-[11px]">
                  <span className={isSelected ? cs.label : 'text-gray-500 dark:text-slate-400'}>Margen</span>
                  <span className={`font-bold ${isSelected ? cs.title : 'text-gray-800 dark:text-white'}`}>+{scenario.utilidad}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className={isSelected ? cs.label : 'text-gray-500 dark:text-slate-400'}>Ganancia</span>
                  <span className={`font-bold ${isSelected ? cs.gain : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(ganancia)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tip compacto */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
        <span className="text-base shrink-0">💡</span>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          El 150% es el margen estándar en gastronomía. Ajustá según tu competencia.
        </p>
      </div>
    </div>
  );
};

export default PriceScenarios;
