// src/components/ui/SplashScreen.jsx
import { motion, AnimatePresence } from 'framer-motion';
const logoBodestock = '/logoo.png';

const SplashScreen = ({ onFinish, duration = 3000 }) => {
  // Después del tiempo especificado, llamar a onFinish
  if (onFinish) {
    setTimeout(onFinish, duration);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-950 via-gray-900 to-black overflow-hidden"
      >
        {/* Grid pattern de fondo */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

        {/* Orbes flotantes animados en el fondo */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full mix-blend-screen filter blur-3xl"
            style={{
              background: i % 2 === 0
                ? "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(96, 165, 250, 0.3) 0%, transparent 70%)",
              width: Math.random() * 400 + 200,
              height: Math.random() * 400 + 200,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50, 0],
              y: [0, Math.random() * 100 - 50, 0],
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Contenedor central del logo */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Glow principal detrás del logo */}
          <motion.div
            animate={{
              opacity: [0.4, 0.8, 0.4],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 -m-20 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, transparent 70%)',
            }}
          />

          {/* Anillos concéntricos giratorios */}
          <div className="relative">
            {/* Anillo exterior */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 -m-16"
            >
              <div className="w-full h-full rounded-full border-4 border-blue-500/20 border-t-blue-500" />
            </motion.div>

            {/* Anillo medio */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 -m-20"
            >
              <div className="w-full h-full rounded-full border-2 border-cyan-500/20 border-r-cyan-500" />
            </motion.div>

            {/* Anillo externo */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 -m-24"
            >
              <div className="w-full h-full rounded-full border border-blue-400/10 border-b-blue-400/50" />
            </motion.div>

            {/* Logo principal con animaciones */}
            <motion.div
              initial={{ scale: 0, rotate: -180, opacity: 0 }}
              animate={{
                scale: 1,
                rotate: 0,
                opacity: 1,
              }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                duration: 1,
              }}
              className="relative"
            >
              <motion.img
                src={logoBodestock}
                alt="Bodestock"
                className="h-48 w-auto object-contain relative z-10"
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.8))',
                }}
              />
            </motion.div>
          </div>

          {/* Texto animado */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-col items-center gap-4"
          >
            {/* Mensaje de bienvenida */}
            <motion.h1
              className="text-4xl font-black text-white tracking-tight"
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

            {/* Subtítulo */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="text-white/70 text-lg font-medium"
            >
              Gestión inteligente de inventario
            </motion.p>

            {/* Barra de carga animada */}
            <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden mt-4">
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

            {/* Puntos de carga */}
            <div className="flex gap-2 mt-2">
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
                  className="w-3 h-3 rounded-full bg-blue-500"
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Partículas flotantes decorativas */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-blue-400/50 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, -200],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeOut",
            }}
          />
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
