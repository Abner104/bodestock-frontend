// src/components/ui/LoadingBodestock.jsx
import { motion } from 'framer-motion';
const logoBodestock = '/logoo.png';

const LoadingBodestock = ({
  size = 'md',
  message = 'Cargando...',
  fullScreen = false,
  variant = 'pulse' // 'pulse', 'spin', 'bounce', 'glow'
}) => {
  const sizes = {
    sm: { logo: 'h-16 w-auto', text: 'text-sm', container: 'gap-3' },
    md: { logo: 'h-24 w-auto', text: 'text-base', container: 'gap-4' },
    lg: { logo: 'h-32 w-auto', text: 'text-lg', container: 'gap-5' },
    xl: { logo: 'h-48 w-auto', text: 'text-xl', container: 'gap-6' },
  };

  const currentSize = sizes[size] || sizes.md;

  // Variantes de animación para el logo
  const logoAnimations = {
    pulse: {
      scale: [1, 1.1, 1],
      opacity: [0.8, 1, 0.8],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    spin: {
      rotate: [0, 360],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "linear"
      }
    },
    bounce: {
      y: [0, -20, 0],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    glow: {
      filter: [
        'drop-shadow(0 0 20px rgba(59, 130, 246, 0.8))',
        'drop-shadow(0 0 40px rgba(59, 130, 246, 1))',
        'drop-shadow(0 0 20px rgba(59, 130, 246, 0.8))',
      ],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // Animación de los puntos
  const dotVariants = {
    animate: (i) => ({
      opacity: [0.2, 1, 0.2],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        delay: i * 0.2,
        ease: "easeInOut"
      }
    })
  };

  // Animación del glow circular
  const glowVariants = {
    animate: {
      opacity: [0.3, 0.6, 0.3],
      scale: [1, 1.2, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  // Animación de la barra de progreso
  const progressVariants = {
    animate: {
      x: ['-100%', '200%'],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const content = (
    <div className={`flex flex-col items-center justify-center ${currentSize.container}`}>
      {/* Contenedor del logo con efectos */}
      <div className="relative">
        {/* Glow circular animado */}
        <motion.div
          variants={glowVariants}
          animate="animate"
          className="absolute inset-0 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, transparent 70%)',
          }}
        />

        {/* Anillos concéntricos giratorios */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 -m-8"
        >
          <div className="w-full h-full rounded-full border-4 border-blue-500/20 border-t-blue-500/60" />
        </motion.div>

        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 -m-12"
        >
          <div className="w-full h-full rounded-full border-2 border-cyan-500/20 border-r-cyan-500/60" />
        </motion.div>

        {/* Logo animado */}
        <motion.img
          src={logoBodestock}
          alt="Loading..."
          className={`${currentSize.logo} object-contain relative z-10`}
          animate={logoAnimations[variant]}
        />
      </div>

      {/* Mensaje de carga */}
      {message && (
        <div className="flex flex-col items-center gap-2">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`${currentSize.text} font-semibold text-white/90 text-center`}
          >
            {message}
          </motion.p>

          {/* Puntos animados */}
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                custom={i}
                variants={dotVariants}
                animate="animate"
                className="w-2 h-2 rounded-full bg-blue-500"
              />
            ))}
          </div>

          {/* Barra de progreso animada */}
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-2">
            <motion.div
              variants={progressVariants}
              animate="animate"
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-black"
      >
        {/* Grid pattern de fondo */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

        {/* Orbes flotantes */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full mix-blend-multiply filter blur-xl opacity-20"
            style={{
              background: i % 2 === 0
                ? "linear-gradient(135deg, #3B82F6, #60A5FA)"
                : "linear-gradient(135deg, #60A5FA, #06B6D4)",
              width: Math.random() * 300 + 200,
              height: Math.random() * 300 + 200,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, 100, 0],
              y: [0, -100, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 10 + Math.random() * 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        <div className="relative z-10">
          {content}
        </div>
      </motion.div>
    );
  }

  return content;
};

export default LoadingBodestock;
