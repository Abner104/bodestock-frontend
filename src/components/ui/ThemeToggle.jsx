// src/components/ui/ThemeToggle.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = ({ size = 'md', className = '' }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  const sizes = {
    sm: 'w-12 h-6',
    md: 'w-14 h-7',
    lg: 'w-16 h-8'
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  };

  return (
    <motion.button
      onClick={toggleTheme}
      className={`
        ${sizes[size]}
        relative
        rounded-full
        p-1
        transition-colors
        ${isDark ? 'bg-slate-700' : 'bg-blue-100'}
        ${className}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
    >
      {/* Switch animado */}
      <motion.div
        className={`
          absolute
          top-1
          w-5 h-5
          rounded-full
          ${isDark ? 'bg-blue-500' : 'bg-blue-600'}
          shadow-lg
          flex items-center justify-center
        `}
        animate={{
          x: isDark ? 'calc(100% + 4px)' : '0px'
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30
        }}
      >
        {isDark ? (
          <Moon size={iconSizes[size]} className="text-white" />
        ) : (
          <Sun size={iconSizes[size]} className="text-white" />
        )}
      </motion.div>

      {/* Iconos de fondo */}
      <div className="flex items-center justify-between h-full px-1.5">
        <Sun
          size={iconSizes[size]}
          className={`transition-opacity ${isDark ? 'opacity-40' : 'opacity-0'}`}
        />
        <Moon
          size={iconSizes[size]}
          className={`transition-opacity ${isDark ? 'opacity-0' : 'opacity-40'}`}
        />
      </div>
    </motion.button>
  );
};

export default ThemeToggle;
