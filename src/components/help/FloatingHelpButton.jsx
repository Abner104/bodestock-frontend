// src/components/help/FloatingHelpButton.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Lightbulb, X } from 'lucide-react';

const FloatingHelpButton = ({ onClick, showPulse = true }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-40"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", damping: 15 }}
    >
      {/* Pulse animation */}
      {showPulse && !isHovered && (
        <motion.div
          className="absolute inset-0 bg-blue-500 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute bottom-full right-0 mb-3 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-xl whitespace-nowrap"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-medium">¿Necesitas ayuda con el costeo?</span>
            </div>
            <div className="absolute bottom-0 right-6 transform translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button - Más grande en móvil */}
      <motion.button
        onClick={onClick}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-blue-500/50 transition-shadow"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.5 }}
        >
          <HelpCircle className="w-7 h-7 sm:w-8 sm:h-8" />
        </motion.div>

        {/* Notification badge (optional) */}
        {showPulse && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
            <motion.span
              className="text-xs font-bold"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ?
            </motion.span>
          </div>
        )}
      </motion.button>
    </motion.div>
  );
};

export default FloatingHelpButton;
