// src/components/ui/BodestockLoadingAnimation.jsx
import { motion } from 'framer-motion';
import { Package, Warehouse, User } from 'lucide-react';

const BodestockLoadingAnimation = ({ message = "Cargando componentes..." }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950">
      {/* Grid pattern de fondo */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

      {/* Contenedor central */}
      <div className="relative z-10 flex flex-col items-center gap-8">

        {/* Animación de bodega con persianas */}
        <div className="relative w-64 h-48">
          {/* Bodega base */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute inset-0"
          >
            <svg viewBox="0 0 200 150" className="w-full h-full">
              {/* Estructura de la bodega */}
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                d="M 20 140 L 20 50 L 100 20 L 180 50 L 180 140 Z"
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3B82F6"
                strokeWidth="2"
              />

              {/* Techo */}
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                d="M 10 50 L 100 15 L 190 50"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="3"
              />

              {/* Persianas - 5 líneas horizontales que se abren */}
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.rect
                  key={i}
                  x="60"
                  y={70 + i * 14}
                  width="80"
                  height="10"
                  fill="#3B82F6"
                  initial={{ scaleY: 1, opacity: 1 }}
                  animate={{
                    scaleY: [1, 1, 0],
                    opacity: [1, 1, 0],
                  }}
                  transition={{
                    duration: 0.6,
                    delay: 1.5 + i * 0.1,
                    times: [0, 0.7, 1],
                  }}
                  style={{ transformOrigin: 'center' }}
                />
              ))}

              {/* Marco de la puerta */}
              <motion.rect
                x="60"
                y="70"
                width="80"
                height="70"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              />
            </svg>
          </motion.div>

          {/* Trabajador con carrito entrando */}
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 70, opacity: 1 }}
            transition={{
              delay: 2.2,
              duration: 1.5,
              ease: "easeInOut"
            }}
            className="absolute bottom-8 left-0"
          >
            {/* Trabajador simple */}
            <div className="flex items-end gap-1">
              {/* Carrito */}
              <motion.div
                animate={{ y: [0, -2, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Package className="w-6 h-6 text-blue-400" />
              </motion.div>

              {/* Persona */}
              <motion.div
                animate={{ rotate: [0, -5, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <User className="w-8 h-8 text-blue-300" />
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Texto Bodestock */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.h1
            className="text-5xl font-black text-white tracking-tight"
            animate={{
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            Bodestock
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="text-white/70 text-base font-medium"
          >
            Sistema de Gestión de Inventario
          </motion.p>
        </motion.div>

        {/* Mensaje de carga */}
        {message && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="flex flex-col items-center gap-3"
          >
            <p className="text-white/80 text-sm font-medium">{message}</p>

            {/* Puntos animados */}
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    opacity: [0.2, 1, 0.2],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                  className="w-2 h-2 rounded-full bg-blue-500"
                />
              ))}
            </div>

            {/* Barra de progreso */}
            <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden mt-2">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
              />
            </div>
          </motion.div>
        )}

        {/* Iconos de productos, bodegas y reportes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.5 }}
          className="flex gap-12 mt-4"
        >
          {[
            { icon: Package, label: 'Productos', delay: 2.6 },
            { icon: Warehouse, label: 'Bodegas', delay: 2.7 },
            { icon: User, label: 'Reportes', delay: 2.8 },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: item.delay, type: "spring" }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <item.icon className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-xs text-white/60 font-medium">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default BodestockLoadingAnimation;
