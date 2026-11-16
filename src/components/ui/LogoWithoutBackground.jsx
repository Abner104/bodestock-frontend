// src/components/ui/LogoWithoutBackground.jsx
// Componente que remueve el fondo azul del logo usando Canvas API
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
const logoBodestock = '/logoo.png';

const LogoWithoutBackground = ({ size = 'md', onClick = null, animated = true }) => {
  const canvasRef = useRef(null);
  const [processedImage, setProcessedImage] = useState(null);

  const sizes = {
    xs: {
      container: 'h-12 gap-2',
      logo: 'h-12 w-auto',
      width: 48,
    },
    sm: {
      container: 'h-16 gap-2',
      logo: 'h-16 w-auto',
      width: 64,
    },
    md: {
      container: 'h-20 gap-3',
      logo: 'h-20 w-auto',
      width: 80,
    },
    lg: {
      container: 'h-28 gap-3',
      logo: 'h-28 w-auto',
      width: 112,
    },
    xl: {
      container: 'h-40 gap-4',
      logo: 'h-40 w-auto',
      width: 160,
    }
  };

  const currentSize = sizes[size] || sizes.md;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = logoBodestock;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = img.width;
      canvas.height = img.height;

      // Dibujar la imagen
      ctx.drawImage(img, 0, 0);

      // Obtener los datos de píxeles
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Remover el fondo azul
      // El fondo tiene tonos azules en el rango RGB(50-100, 100-150, 150-220)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Detectar tonos azules del fondo (azul > rojo y azul > verde)
        const isBlueBackground = (
          b > r + 30 &&
          b > g + 20 &&
          b > 100 &&
          b < 230 &&
          r < 150 &&
          g < 180
        );

        // Si es fondo azul, hacerlo transparente
        if (isBlueBackground) {
          data[i + 3] = 0; // Alpha = 0 (transparente)
        }
      }

      // Aplicar los cambios
      ctx.putImageData(imageData, 0, 0);

      // Convertir a imagen
      setProcessedImage(canvas.toDataURL('image/png'));
    };
  }, []);

  // Variantes de animación
  const containerVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    },
    hover: onClick ? {
      scale: 1.05,
      transition: { duration: 0.2 }
    } : {},
    tap: onClick ? { scale: 0.95 } : {}
  };

  const logoVariants = {
    initial: { opacity: 0, y: -20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const glowVariants = {
    animate: {
      opacity: [0.5, 0.8, 0.5],
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  if (!processedImage) {
    return (
      <div className={`${currentSize.container} flex items-center justify-center`}>
        <div className="animate-pulse bg-blue-500/20 rounded-lg" style={{ width: currentSize.width, height: currentSize.width }} />
      </div>
    );
  }

  return (
    <motion.div
      variants={animated ? containerVariants : {}}
      initial={animated ? "initial" : false}
      animate={animated ? "animate" : false}
      whileHover={animated ? "hover" : {}}
      whileTap={animated ? "tap" : {}}
      onClick={onClick}
      className={`flex items-center justify-center ${currentSize.container} ${onClick ? 'cursor-pointer' : ''} relative`}
    >
      {/* Glow effect animado detrás del logo */}
      {animated && (
        <motion.div
          variants={glowVariants}
          animate="animate"
          className="absolute inset-0 rounded-full blur-2xl opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Logo procesado sin fondo */}
      <motion.img
        variants={animated ? logoVariants : {}}
        src={processedImage}
        alt="Bodestock Logo"
        className={`${currentSize.logo} object-contain relative z-10`}
        style={{
          filter: animated
            ? 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 30px rgba(59, 130, 246, 0.4))'
            : 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
        }}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </motion.div>
  );
};

export default LogoWithoutBackground;
