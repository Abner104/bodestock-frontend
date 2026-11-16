// src/components/ui/Card.jsx
import React from 'react';
import { motion } from 'framer-motion';

const Card = ({
  children,
  className = '',
  hover = true,
  ...props
}) => {
  const baseClasses = "rounded-xl p-6 shadow-lg transition-all duration-200";
  const themeClasses = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700";
  const hoverClasses = hover ? "hover:shadow-xl hover:-translate-y-1" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${baseClasses} ${themeClasses} ${hoverClasses} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
