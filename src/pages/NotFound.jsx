// src/pages/NotFound.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search, Package } from 'lucide-react';
import Logo from '../components/ui/Logo';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex justify-center"
        >
          <Logo size="lg" showText={true} />
        </motion.div>

        {/* 404 Ilustración */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            {/* El "404" grande */}
            <h1 className="text-9xl md:text-[200px] font-black text-white/10 select-none">
              404
            </h1>

            {/* Icono flotante */}
            <motion.div
              animate={{
                y: [0, -20, 0],
                rotate: [0, 10, -10, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="bg-blue-500 p-6 rounded-3xl shadow-2xl">
                <Package className="w-16 h-16 text-white" strokeWidth={2} />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Texto */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            ¡Ups! Página no encontrada
          </h2>
          <p className="text-lg text-white/70 mb-8 max-w-md mx-auto">
            Parece que esta página se perdió en el inventario.
            No te preocupes, te ayudamos a volver al camino correcto.
          </p>
        </motion.div>

        {/* Botones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <motion.button
            onClick={() => navigate(-1)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold border-2 border-white/20 hover:bg-white/20 transition-all flex items-center gap-2 min-w-[200px] justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver Atrás
          </motion.button>

          <motion.button
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold shadow-2xl hover:shadow-blue-500/50 transition-all flex items-center gap-2 min-w-[200px] justify-center"
          >
            <Home className="w-5 h-5" />
            Ir al Inicio
          </motion.button>
        </motion.div>

        {/* Links útiles */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 pt-8 border-t border-white/10"
        >
          <p className="text-white/50 text-sm mb-4">¿Buscabas algo específico?</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Mis Inventarios', path: '/mis-inventarios' },
              { label: 'Costeo', path: '/costeo' },
              { label: 'Trabajadores', path: '/trabajadores' }
            ].map((link) => (
              <motion.button
                key={link.path}
                onClick={() => navigate(link.path)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-sm transition-all"
              >
                {link.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-white/30 text-xs"
        >
          Si crees que esto es un error, contacta a soporte@bodestockgo.com
        </motion.p>
      </div>
    </div>
  );
};

export default NotFound;
