// src/components/costing/ModeSelector.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Settings } from 'lucide-react';

const ModeSelector = ({ mode, onModeChange }) => {
  return (
    <div className="flex gap-3 mb-6">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onModeChange('guiado')}
        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
          mode === 'guiado'
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 shadow-md'
            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            mode === 'guiado' ? 'bg-indigo-500' : 'bg-gray-100 dark:bg-slate-700'
          }`}>
            <Zap className={`w-5 h-5 ${mode === 'guiado' ? 'text-white' : 'text-gray-400 dark:text-slate-400'}`} />
          </div>
          <div className="text-left">
            <p className={`font-bold text-sm ${mode === 'guiado' ? 'text-indigo-900 dark:text-indigo-200' : 'text-gray-700 dark:text-slate-300'}`}>
              Modo Guiado
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Rápido y simple</p>
          </div>
        </div>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onModeChange('experto')}
        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
          mode === 'experto'
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 shadow-md'
            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300 dark:hover:border-purple-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            mode === 'experto' ? 'bg-purple-500' : 'bg-gray-100 dark:bg-slate-700'
          }`}>
            <Settings className={`w-5 h-5 ${mode === 'experto' ? 'text-white' : 'text-gray-400 dark:text-slate-400'}`} />
          </div>
          <div className="text-left">
            <p className={`font-bold text-sm ${mode === 'experto' ? 'text-purple-900 dark:text-purple-200' : 'text-gray-700 dark:text-slate-300'}`}>
              Modo Experto
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Control total</p>
          </div>
        </div>
      </motion.button>
    </div>
  );
};

export default ModeSelector;
