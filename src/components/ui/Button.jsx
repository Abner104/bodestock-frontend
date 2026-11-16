// src/components/ui/Button.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

const Button = ({
  children,
  variant = 'primary', // primary, secondary, outline, ghost
  size = 'md', // sm, md, lg
  className = '',
  icon,
  disabled = false,
  ...props
}) => {
  const { isDark } = useTheme();

  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg"
  };

  const variantClasses = {
    primary: isDark
      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50"
      : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30",
    secondary: isDark
      ? "bg-slate-700 hover:bg-slate-600 text-slate-100"
      : "bg-slate-200 hover:bg-slate-300 text-slate-900",
    outline: isDark
      ? "border-2 border-blue-500 text-blue-400 hover:bg-blue-500/10"
      : "border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
    ghost: isDark
      ? "text-slate-300 hover:bg-slate-800"
      : "text-slate-700 hover:bg-slate-100"
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span>{icon}</span>}
      {children}
    </motion.button>
  );
};

export default Button;
