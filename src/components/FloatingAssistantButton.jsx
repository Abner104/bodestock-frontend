// src/components/FloatingAssistantButton.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';

const FloatingAssistantButton = ({ onClick, showPulse = true }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="fixed bottom-20 right-4 sm:bottom-6 sm:left-6 z-40 w-14 h-14 sm:w-16 sm:h-16"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring", damping: 15 }}
    >
      {/* Pulse animation */}
      {showPulse && !isHovered && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full pointer-events-none"
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

      {/* Tooltip - Solo visible en desktop */}
      <motion.div
        initial={{ opacity: 0, x: -10, scale: 0.9 }}
        animate={{
          opacity: isHovered ? 1 : 0,
          x: isHovered ? 0 : -10,
          scale: isHovered ? 1 : 0.9
        }}
        transition={{ duration: 0.2 }}
        className="hidden sm:block absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-xl whitespace-nowrap pointer-events-none"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span className="text-sm font-medium">Asistente de Inventario IA</span>
        </div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 rotate-45 w-2 h-2 bg-slate-900" />
      </motion.div>

      {/* Button */}
      <motion.button
        onClick={onClick}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-indigo-500/50 transition-shadow active:shadow-indigo-500/70"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Bot className="w-6 h-6 sm:w-7 sm:h-7" />
        </motion.div>

        {/* Sparkle badge */}
        {showPulse && (
          <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-600" />
            </motion.div>
          </div>
        )}
      </motion.button>
    </motion.div>
  );
};

export default FloatingAssistantButton;
