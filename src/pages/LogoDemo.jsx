// src/pages/LogoDemo.jsx - Página de demostración de los componentes de logo
import { useState } from 'react';
import { motion } from 'framer-motion';
import Logo from '../components/ui/Logo';
import LoadingBodestock from '../components/ui/LoadingBodestock';
import SplashScreen from '../components/ui/SplashScreen';

const LogoDemo = () => {
  const [showSplash, setShowSplash] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-black text-white mb-4">Bodestock Logo System</h1>
          <p className="text-white/70 text-lg">
            Componentes animados con Framer Motion y Tailwind CSS
          </p>
        </motion.div>

        {/* Grid de demostración */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Sección 1: Logo en diferentes tamaños */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Logo - Tamaños</h2>
            <div className="space-y-8">
              <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl">
                <Logo size="xs" animated={true} />
                <span className="text-white/60 text-sm">Extra Small (xs)</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl">
                <Logo size="sm" animated={true} />
                <span className="text-white/60 text-sm">Small (sm)</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl">
                <Logo size="md" animated={true} />
                <span className="text-white/60 text-sm">Medium (md)</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl">
                <Logo size="lg" animated={true} />
                <span className="text-white/60 text-sm">Large (lg)</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl">
                <Logo size="xl" animated={true} />
                <span className="text-white/60 text-sm">Extra Large (xl)</span>
              </div>
            </div>
          </motion.div>

          {/* Sección 2: Logo en diferentes fondos */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Logo - Diferentes Fondos</h2>
            <div className="space-y-6">
              <div className="p-6 bg-black rounded-xl">
                <p className="text-white/60 text-sm mb-4">Fondo Negro</p>
                <Logo size="md" animated={true} />
              </div>
              <div className="p-6 bg-gradient-to-br from-slate-900 to-gray-900 rounded-xl">
                <p className="text-white/60 text-sm mb-4">Fondo Oscuro Gradient</p>
                <Logo size="md" animated={true} />
              </div>
              <div className="p-6 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-xl">
                <p className="text-white/60 text-sm mb-4">Fondo Azul</p>
                <Logo size="md" animated={true} />
              </div>
              <div className="p-6 bg-white rounded-xl">
                <p className="text-gray-600 text-sm mb-4">Fondo Blanco</p>
                <Logo size="md" animated={true} />
              </div>
            </div>
          </motion.div>

          {/* Sección 3: Loading States */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Loading - Variantes</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-black/30 rounded-xl">
                <p className="text-white/60 text-sm mb-4 text-center">Pulse</p>
                <LoadingBodestock size="sm" message="" variant="pulse" />
              </div>
              <div className="p-6 bg-black/30 rounded-xl">
                <p className="text-white/60 text-sm mb-4 text-center">Spin</p>
                <LoadingBodestock size="sm" message="" variant="spin" />
              </div>
              <div className="p-6 bg-black/30 rounded-xl">
                <p className="text-white/60 text-sm mb-4 text-center">Bounce</p>
                <LoadingBodestock size="sm" message="" variant="bounce" />
              </div>
              <div className="p-6 bg-black/30 rounded-xl">
                <p className="text-white/60 text-sm mb-4 text-center">Glow</p>
                <LoadingBodestock size="sm" message="" variant="glow" />
              </div>
            </div>
          </motion.div>

          {/* Sección 4: Loading con mensaje */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Loading - Con Mensaje</h2>
            <div className="space-y-8">
              <div className="p-6 bg-black/30 rounded-xl">
                <LoadingBodestock size="md" message="Cargando inventario..." variant="pulse" />
              </div>
              <div className="p-6 bg-black/30 rounded-xl">
                <LoadingBodestock size="md" message="Procesando datos..." variant="glow" />
              </div>
            </div>
          </motion.div>

          {/* Sección 5: Logo clickeable */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Logo - Interactivo</h2>
            <div className="space-y-6">
              <div className="p-6 bg-black/30 rounded-xl">
                <p className="text-white/60 text-sm mb-4 text-center">
                  Haz click en el logo
                </p>
                <div className="flex justify-center">
                  <Logo
                    size="lg"
                    animated={true}
                    onClick={() => alert('¡Logo clickeado! 🎉')}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sección 6: Splash Screen */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Splash Screen</h2>
            <div className="p-6 bg-black/30 rounded-xl">
              <p className="text-white/60 text-sm mb-4 text-center">
                Pantalla de carga inicial con animaciones completas
              </p>
              <button
                onClick={() => setShowSplash(true)}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                Ver Splash Screen
              </button>
            </div>
          </motion.div>
        </div>

        {/* Código de ejemplo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 bg-white/5 backdrop-blur-lg rounded-3xl border border-white/10 p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Código de Ejemplo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/50 p-6 rounded-xl">
              <p className="text-blue-400 text-sm font-mono mb-2">Logo Component</p>
              <pre className="text-white/80 text-xs overflow-x-auto">
{`import Logo from './components/ui/Logo';

<Logo
  size="md"
  animated={true}
  onClick={() => navigate('/')}
/>`}
              </pre>
            </div>
            <div className="bg-black/50 p-6 rounded-xl">
              <p className="text-blue-400 text-sm font-mono mb-2">Loading Component</p>
              <pre className="text-white/80 text-xs overflow-x-auto">
{`import LoadingBodestock from './components/ui/LoadingBodestock';

<LoadingBodestock
  size="md"
  message="Cargando..."
  variant="pulse"
  fullScreen={false}
/>`}
              </pre>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Splash Screen Modal */}
      {showSplash && (
        <SplashScreen
          onFinish={() => setShowSplash(false)}
          duration={4000}
        />
      )}
    </div>
  );
};

export default LogoDemo;
