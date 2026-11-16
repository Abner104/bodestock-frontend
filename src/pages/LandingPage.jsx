// src/pages/LandingPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Check,
  TrendingUp,
  Package,
  Users,
  BarChart3,
  Shield,
  Zap,
  Clock,
  DollarSign,
  Menu,
  X,
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Store,
  Factory,
  Sparkles,
  Target,
  XCircle,
  Bot,
  MessageSquare,
  Brain,
  TrendingDown,
  ChevronDown,
  HelpCircle,
  Calculator,
  Warehouse,
  Receipt,
  Users2,
  Plus,
} from 'lucide-react';
import Logo from '../components/ui/Logo';
import RobotSaludandoGif from '../assets/RobotSaludando.gif';
import { db } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PLAN_FEATURES, FEATURE_LABELS, ADDONS } from '../config/plan-features';

// Construir features legibles a partir de plan-features.js como fallback
const buildFeatureList = (planConfig) => {
  if (!planConfig) return [];
  const limits = [];
  if (planConfig.maxUsers === Infinity) limits.push('Usuarios ilimitados');
  else if (planConfig.maxUsers) limits.push(`${planConfig.maxUsers} usuarios`);
  if (planConfig.maxProducts === Infinity) limits.push('Productos ilimitados');
  else if (planConfig.maxProducts) limits.push(`${planConfig.maxProducts.toLocaleString('es-CL')} productos`);
  if (planConfig.maxWarehouses === Infinity) limits.push('Sucursales ilimitadas');
  else if (planConfig.maxWarehouses) limits.push(`${planConfig.maxWarehouses} bodega${planConfig.maxWarehouses > 1 ? 's' : ''} / sucursal${planConfig.maxWarehouses > 1 ? 'es' : ''}`);

  if (planConfig.features?.includes('*')) {
    return [...limits, 'Todas las funcionalidades', 'Integraciones personalizadas', 'Soporte prioritario', 'Configuración a medida'];
  }

  const featureLabels = (planConfig.features || [])
    .map(f => FEATURE_LABELS[f])
    .filter(Boolean);

  return [...limits, ...featureLabels];
};

const PLAN_COLORS = {
  basico: 'from-blue-500 to-blue-600',
  profesional: 'from-indigo-600 to-purple-700',
  personalizado: 'from-amber-500 to-purple-700'
};

const PLAN_DESCRIPTIONS = {
  basico: 'Ideal para un solo local',
  profesional: 'Para negocios en crecimiento',
  personalizado: 'Para empresas con necesidades específicas'
};

const buildDefaultPlans = () => {
  return Object.entries(PLAN_FEATURES).filter(([id]) => !['trial', 'free'].includes(id)).map(([id, config]) => ({
    id,
    name: config.name,
    subtitle: config.subtitle,
    price: config.price,
    isCustom: id === 'personalizado',
    description: PLAN_DESCRIPTIONS[id] || '',
    features: buildFeatureList(config),
    color: PLAN_COLORS[id] || 'from-blue-500 to-blue-600',
    popular: id === 'profesional'
  }));
};

const DEFAULT_PLANS = buildDefaultPlans();

const PROBLEMS = [
  {
    icon: XCircle,
    problem: 'Pierdes dinero porque no sabes cuánto te cuesta producir',
    solution: 'Calcula costos reales (PPP) automáticamente para cada producto'
  },
  {
    icon: XCircle,
    problem: 'Tu inventario está descontrolado en hojas de Excel',
    solution: 'Control en tiempo real desde cualquier dispositivo, sin errores manuales'
  },
  {
    icon: XCircle,
    problem: 'Se te acaba el stock sin darte cuenta',
    solution: 'Alertas automáticas por email cuando el stock llega al mínimo'
  },
  {
    icon: XCircle,
    problem: 'No sabes qué productos te dan más ganancia',
    solution: 'Reportes mensuales con análisis de rentabilidad y tendencias'
  }
];

const WHO_IS_FOR = [
  {
    icon: ChefHat,
    title: 'Restaurantes y Cafeterías',
    description: 'Controla ingredientes, costos de recetas y rentabilidad de cada plato'
  },
  {
    icon: Store,
    title: 'Tiendas y Retail',
    description: 'Gestiona tu stock, proveedores y márgenes de ganancia en un solo lugar'
  },
  {
    icon: Factory,
    title: 'Manufactureras y Productoras',
    description: 'Calcula costos de materias primas y productos terminados automáticamente'
  }
];

const FEATURES = [
  {
    icon: Package,
    title: 'Inventario en Tiempo Real',
    description: 'Ve tu stock actualizado al instante. Múltiples bodegas, movimientos automáticos.'
  },
  {
    icon: DollarSign,
    title: 'Costeo Inteligente (PPP)',
    description: 'Calcula el costo real de tus productos con Precio Promedio Ponderado.'
  },
  {
    icon: Users,
    title: 'Gestión de Equipo',
    description: 'Asigna permisos, controla accesos por bodega. Trabajadores y administradores.'
  },
  {
    icon: BarChart3,
    title: 'Reportes Automáticos',
    description: 'Recibe reportes mensuales por email con análisis de inventario y costos.'
  },
  {
    icon: Shield,
    title: '100% Seguro',
    description: 'Datos encriptados, multi-tenant. Tu información nunca se mezcla con otros.'
  },
  {
    icon: Zap,
    title: 'Súper Rápido',
    description: 'Interfaz moderna y veloz. No más Excel lento. Trabaja desde cualquier lugar.'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState('basico');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [extraUsers, setExtraUsers] = useState(0);
  const [extraWarehouses, setExtraWarehouses] = useState(0);

  const toggleAddon = (id) => setSelectedAddons(prev =>
    prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
  );
  const basePlanPrice = selectedPlanId === 'profesional' ? PLAN_FEATURES.profesional.price : PLAN_FEATURES.basico.price;
  const addonsTotal = selectedPlanId === 'basico' ? selectedAddons.reduce((s, id) => s + (ADDONS[id]?.price || 0), 0) : 0;
  const configuratorTotal = basePlanPrice + addonsTotal + extraUsers * 7990 + extraWarehouses * 10990;

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cargar planes dinámicos desde Firestore (precios, features, límites del SuperAdmin)
  useEffect(() => {
    const loadDynamicPlans = async () => {
      try {
        const planDoc = await getDoc(doc(db, 'config', 'plans'));
        if (planDoc.exists()) {
          const data = planDoc.data();
          setPlans(prev => prev.map(plan => {
            const remoteConfig = data[plan.id];
            if (!remoteConfig) return plan;

            // Construir features dinámicamente desde lo que el SuperAdmin configuró
            const mergedConfig = {
              ...PLAN_FEATURES[plan.id],
              ...remoteConfig,
              maxUsers: remoteConfig.maxUsers ?? PLAN_FEATURES[plan.id]?.maxUsers,
              maxProducts: remoteConfig.maxProducts ?? PLAN_FEATURES[plan.id]?.maxProducts,
              maxWarehouses: remoteConfig.maxWarehouses ?? PLAN_FEATURES[plan.id]?.maxWarehouses,
              features: remoteConfig.features ?? PLAN_FEATURES[plan.id]?.features,
            };

            return {
              ...plan,
              price: remoteConfig.price ?? plan.price,
              features: buildFeatureList(mergedConfig),
            };
          }));
        }
      } catch (err) {
        console.error('Error cargando planes dinámicos:', err);
      }
    };
    loadDynamicPlans();
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white overflow-x-hidden">
      {/* Navbar */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b transition-all duration-300"
        style={{
          backgroundColor: scrollY > 50 ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)',
          borderColor: scrollY > 50 ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'
        }}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <motion.div whileHover={{ scale: 1.05 }}>
            <Logo size="sm" showText={true} darkBg={true} />
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <motion.button
              onClick={() => scrollToSection('problems')}
              className="px-6 py-2 text-white hover:text-blue-400 transition-colors font-semibold"
              whileHover={{ y: -2 }}
            >
              ¿Por qué Bodestock?
            </motion.button>
            <motion.button
              onClick={() => scrollToSection('pricing')}
              className="px-6 py-2 text-white hover:text-blue-400 transition-colors font-semibold"
              whileHover={{ y: -2 }}
            >
              Precios
            </motion.button>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <motion.button
              onClick={() => navigate('/login')}
              className="px-6 py-2 text-white border border-blue-500 rounded-lg font-semibold hover:bg-blue-500/10 transition-all"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Iniciar Sesión
            </motion.button>
            <motion.button
              onClick={() => navigate('/register')}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-semibold shadow-lg hover:shadow-blue-500/50 transition-all"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Probar Gratis
            </motion.button>
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            className="md:hidden text-blue-500 p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileTap={{ scale: 0.95 }}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </motion.button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/95 backdrop-blur-lg"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="absolute top-[100px] left-0 right-0 bg-gradient-to-br from-slate-900 to-gray-900 border-b border-white/10 shadow-2xl overflow-hidden"
              initial={{ opacity: 0, maxHeight: 0 }}
              animate={{ opacity: 1, maxHeight: '500px' }}
              exit={{ opacity: 0, maxHeight: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <div className="p-6 space-y-4">
                <button
                  onClick={() => scrollToSection('problems')}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-lg"
                >
                  ¿Por qué Bodestock?
                </button>
                <button
                  onClick={() => scrollToSection('pricing')}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-lg"
                >
                  Precios
                </button>
                <div className="pt-4 space-y-3">
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full px-6 py-3 border border-blue-500 rounded-lg font-semibold hover:bg-blue-500/10 transition-all"
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-semibold shadow-lg"
                  >
                    Probar Gratis
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/4 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <motion.div
            className="absolute bottom-1/4 -left-32 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>

        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-400">30 días gratis • Sin tarjeta de crédito</span>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-6 leading-tight"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Deja de perder dinero{' '}
              <br />
              por no saber cuánto te cuesta{' '}
              <span className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-400 bg-clip-text text-transparent">
                producir
              </span>
            </motion.h1>

            <motion.p
              className="text-lg sm:text-xl md:text-2xl text-white/70 mb-8 max-w-3xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              Controla tu inventario, calcula costos reales (PPP) y gestiona tu equipo.
              <br />
              <span className="text-blue-400 font-semibold">Sin Excel. Sin errores. Sin perder tiempo.</span>
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
            >
              <motion.button
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-lg shadow-2xl hover:shadow-blue-500/50 transition-all flex items-center gap-2 group"
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
              >
                Probar 30 Días Gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                onClick={() => scrollToSection('problems')}
                className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white rounded-xl font-semibold text-lg hover:bg-white/10 transition-all"
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
              >
                Ver Cómo Funciona
              </motion.button>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Cancela cuando quieras</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Soporte en español</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Problems Section */}
      <section id="problems" className="py-20 px-4 bg-gradient-to-b from-transparent to-black/30">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              ¿Te suena familiar?
            </h2>
            <p className="text-xl text-white/60">
              Estos son los problemas más comunes que resolvemos
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PROBLEMS.map((item, index) => (
              <motion.div
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-red-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-red-400 font-semibold mb-2 line-through">
                      {item.problem}
                    </p>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-green-400 font-semibold">
                        {item.solution}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Is For Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              ¿Para quién es Bodestock?
            </h2>
            <p className="text-xl text-white/60">
              Perfecto para todo tipo de negocio con inventario
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHO_IS_FOR.map((item, index) => (
              <motion.div
                key={index}
                className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-8 text-center hover:scale-105 transition-transform"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
              >
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-white/70">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Personal Assistant Section - NUEVO */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-cyan-600/20 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl"
            animate={{
              y: [0, 50, 0],
              x: [0, 30, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl"
            animate={{
              y: [0, -50, 0],
              x: [0, -30, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {/* Robot Animado - Hero del Asistente */}
            <motion.div
              className="flex justify-center mb-6"
              initial={{ opacity: 0, scale: 0.5, y: -20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, type: "spring", damping: 15, stiffness: 150 }}
            >
              <motion.div
                className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center shadow-2xl border-2 border-blue-400/40 backdrop-blur-sm"
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, 3, -3, 0],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <img
                  src={RobotSaludandoGif}
                  alt="Robot AI Asistente Bodestock"
                  className="w-28 h-28 object-contain"
                />
              </motion.div>
            </motion.div>

            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 rounded-full mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Inteligencia Artificial Integrada
              </span>
            </motion.div>

            <h2 className="text-4xl md:text-6xl font-extrabold mb-6">
              Tu Asistente Personal con{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                IA
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto">
              Olvídate de buscar entre menús. Pregúntale a tu asistente y obtén respuestas instantáneas sobre tu inventario.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Chat Interface Mockup */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl">
                {/* Chat Header */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Asistente Bodestock</h3>
                    <div className="flex items-center gap-1">
                      <motion.div
                        className="w-2 h-2 bg-green-400 rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-xs text-green-400">En línea</span>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="space-y-4">
                  {/* User Message 1 */}
                  <motion.div
                    className="flex justify-end"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%]">
                      <p className="text-sm">¿Qué productos tengo con bajo stock?</p>
                    </div>
                  </motion.div>

                  {/* AI Response 1 */}
                  <motion.div
                    className="flex justify-start"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
                      <p className="text-sm mb-2">Encontré 3 productos con stock bajo:</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-3 h-3 text-red-400" />
                          <span>Harina 1kg - <span className="text-red-400 font-bold">Solo 5 unidades</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-3 h-3 text-orange-400" />
                          <span>Aceite 500ml - <span className="text-orange-400 font-bold">8 unidades</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-3 h-3 text-yellow-400" />
                          <span>Azúcar 1kg - <span className="text-yellow-400 font-bold">12 unidades</span></span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* User Message 2 */}
                  <motion.div
                    className="flex justify-end"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.7 }}
                  >
                    <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%]">
                      <p className="text-sm">Muéstrame las ventas de esta semana</p>
                    </div>
                  </motion.div>

                  {/* AI Response 2 */}
                  <motion.div
                    className="flex justify-start"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.9 }}
                  >
                    <div className="bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
                      <p className="text-sm mb-2">📊 Ventas de esta semana:</p>
                      <div className="space-y-1 text-xs">
                        <p><span className="text-green-400 font-bold">$2.450.000</span> en total</p>
                        <p><span className="text-blue-400 font-bold">87 transacciones</span></p>
                        <p>📈 <span className="text-emerald-400">+23% vs semana pasada</span></p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Input Area */}
                <motion.div
                  className="mt-6 pt-4 border-t border-white/10"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.1 }}
                >
                  <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                    <MessageSquare className="w-5 h-5 text-white/40" />
                    <span className="text-sm text-white/40 flex-1">Pregunta lo que necesites...</span>
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Floating Robot GIF */}
              <motion.div
                className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-blue-400/30 backdrop-blur-sm overflow-hidden"
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <img
                  src={RobotSaludandoGif}
                  alt="Robot AI Asistente"
                  className="w-20 h-20 object-contain"
                />
              </motion.div>
            </motion.div>

            {/* Right Side - Benefits */}
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                whileHover={{ scale: 1.02, y: -5 }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-white">Respuestas Instantáneas</h3>
                    <p className="text-white/70">
                      Pregunta en lenguaje natural y obtén información al instante. No más búsqueda en menús.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                whileHover={{ scale: 1.02, y: -5 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-white">Análisis Inteligente</h3>
                    <p className="text-white/70">
                      El asistente analiza patrones y te sugiere acciones. Órdenes de compra, alertas, tendencias.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                whileHover={{ scale: 1.02, y: -5 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-white">Disponible 24/7</h3>
                    <p className="text-white/70">
                      Tu asistente nunca duerme. Consúltalo a cualquier hora desde cualquier dispositivo.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <p className="text-white/90 italic text-center">
                  "El asistente con IA me ahorra <span className="text-blue-400 font-bold">2 horas diarias</span>.
                  Ya no pierdo tiempo buscando información en reportes."
                </p>
                <p className="text-white/60 text-sm text-center mt-2">- Usuario de Bodestock Pro</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-gradient-to-b from-black/30 to-transparent">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-xl text-white/60">
              Potente, simple y diseñado para ahorrarte tiempo
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-blue-500/30 transition-all group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-white/70">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Planes para cada etapa de tu negocio
            </h2>
            <p className="text-xl text-white/60">
              Elige el plan que se adapte a tu negocio
            </p>
          </motion.div>

          {/* Configurador interactivo */}
          <div className="max-w-4xl mx-auto">

            {/* Selector de plan */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {plans.filter(p => !p.isCustom).map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => { setSelectedPlanId(plan.id); setSelectedAddons([]); setExtraUsers(0); setExtraWarehouses(0); }}
                  className={`relative rounded-2xl p-5 border-2 text-left transition-all hover:scale-[1.02] ${
                    selectedPlanId === plan.id
                      ? 'border-blue-500 bg-blue-500/10 shadow-xl shadow-blue-500/20'
                      : 'border-white/10 bg-white/5 hover:border-blue-500/40'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                      Mas Popular
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    {selectedPlanId === plan.id && <Check className="w-5 h-5 text-blue-400" />}
                  </div>
                  {plan.subtitle && <p className="text-blue-400 text-xs font-semibold mb-1">{plan.subtitle}</p>}
                  <p className="text-white/50 text-xs mb-3">{plan.description}</p>
                  <p className="text-2xl font-bold">${plan.price.toLocaleString('es-CL')}<span className="text-sm font-normal text-white/50">/mes</span></p>
                </button>
              ))}
              {plans.filter(p => p.isCustom).map(plan => (
                <button
                  key={plan.id}
                  onClick={() => window.open('https://wa.me/56948487391?text=Hola%2C%20me%20interesa%20el%20plan%20Personalizado%20de%20Bodestock', '_blank')}
                  className="relative rounded-2xl p-5 border-2 border-amber-500/30 bg-amber-500/5 text-left transition-all hover:scale-[1.02] hover:border-amber-500/60"
                >
                  <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                  <p className="text-amber-400 text-xs font-semibold mb-1">{plan.subtitle}</p>
                  <p className="text-white/50 text-xs mb-3">{plan.description}</p>
                  <p className="text-xl font-bold text-amber-400">Conversemos</p>
                </button>
              ))}
            </div>

            {/* Panel del plan seleccionado */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Incluido en el plan</p>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(plans.find(p => p.id === selectedPlanId)?.features || []).map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-sm text-white/70">
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {selectedPlanId === 'basico' && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Add-ons opcionales</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(ADDONS).filter(a => a.id === 'invoicing').map(addon => {
                      const ICONS = { Users, Calculator, Warehouse, Receipt, Users2, Sparkles };
                      const Icon = ICONS[addon.icon] || Package;
                      const active = selectedAddons.includes(addon.id);
                      return (
                        <button
                          key={addon.id}
                          onClick={() => toggleAddon(addon.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-blue-500/10 border-blue-500/40'
                              : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${active ? 'bg-blue-500' : 'bg-white/10'}`}>
                            <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-white/60'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{addon.name}</p>
                            <p className="text-xs text-white/50">{addon.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`text-sm font-bold ${active ? 'text-blue-400' : 'text-white/70'}`}>+${addon.price.toLocaleString('es-CL')}</span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}>
                              {active && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sucursales extra */}
              {(selectedPlanId === 'basico' || selectedPlanId === 'profesional') && (
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Bodega adicional</p>
                    <p className="text-xs text-white/50">+$10.990/bodega/mes · base: {selectedPlanId === 'profesional' ? 2 : 1} bodega{selectedPlanId === 'profesional' ? 's' : ''}</p>
                    {extraWarehouses > 0 && <p className="text-xs text-blue-400">{(selectedPlanId === 'profesional' ? 2 : 1) + extraWarehouses} bodegas en total · +${(extraWarehouses * 10990).toLocaleString('es-CL')}/mes</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExtraWarehouses(v => Math.max(0, v - 1))} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all">
                      <span className="text-lg font-bold leading-none">−</span>
                    </button>
                    <span className="w-6 text-center font-bold text-white">{extraWarehouses}</span>
                    <button onClick={() => setExtraWarehouses(v => v + 1)} className="w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Usuarios extra */}
              {(selectedPlanId === 'basico' || selectedPlanId === 'profesional') && (
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Usuarios adicionales</p>
                    <p className="text-xs text-white/50">+$7.990/usuario/mes · base: {selectedPlanId === 'profesional' ? 4 : 1} usuario{selectedPlanId === 'profesional' ? 's' : ''}</p>
                    {extraUsers > 0 && <p className="text-xs text-blue-400">{(selectedPlanId === 'profesional' ? 4 : 1) + extraUsers} usuarios en total · +${(extraUsers * 7990).toLocaleString('es-CL')}/mes</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExtraUsers(v => Math.max(0, v - 1))} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all">
                      <span className="text-lg font-bold leading-none">−</span>
                    </button>
                    <span className="w-6 text-center font-bold text-white">{extraUsers}</span>
                    <button onClick={() => setExtraUsers(v => v + 1)} className="w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/10">
                <div>
                  <p className="text-white/50 text-sm">Total mensual estimado</p>
                  <p className="text-3xl font-bold">${configuratorTotal.toLocaleString('es-CL')}<span className="text-base font-normal text-white/50">/mes</span></p>
                  {selectedAddons.length > 0 && (
                    <p className="text-xs text-blue-400 mt-0.5">{selectedAddons.length} add-on{selectedAddons.length > 1 ? 's' : ''} incluido{selectedAddons.length > 1 ? 's' : ''}</p>
                  )}
                </div>
                <motion.button
                  onClick={() => navigate('/register')}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-blue-500/40 transition-all"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Empezar ahora <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>

          <motion.p
            className="text-center text-white/60 mt-8 text-sm"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            💳 Aceptamos Mercado Pago • Todos los precios en CLP (pesos chilenos)
          </motion.p>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600/10 to-cyan-600/10">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <Target className="w-16 h-16 text-blue-400 mx-auto mb-6" />
            <motion.h2
              className="text-4xl md:text-5xl font-bold mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              ¿Listo para tomar control de tu negocio?
            </motion.h2>
            <motion.p
              className="text-xl mb-8 text-white/90"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              Prueba Bodestock durante 30 días gratis. Sin tarjeta de crédito.
            </motion.p>
            <motion.button
              onClick={() => navigate('/register')}
              className="px-12 py-5 bg-white text-blue-600 rounded-xl font-bold text-xl shadow-2xl hover:shadow-white/50 transition-all inline-flex items-center gap-3 group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              Empezar Gratis Ahora
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 bg-black/50 border-t border-white/10">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            {/* Logo y Descripción */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Logo size="md" showText={true} className="mb-4" />
              <p className="text-sm text-white/60 leading-relaxed">
                Control total de inventario, costos y equipo. Desde la nube, sin complicaciones.
              </p>
            </motion.div>

            {/* Sobre Nosotros */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h4 className="font-semibold mb-4 text-blue-400">Sobre Nosotros</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Bodestock es una plataforma SaaS chilena diseñada para empresas que necesitan controlar su inventario,
                calcular costos reales (PPP) y gestionar su equipo. Todo desde la nube con máxima seguridad.
              </p>
            </motion.div>

            {/* Contacto */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h4 className="font-semibold mb-4 text-blue-400">Contacto</h4>
              <div className="space-y-2 text-sm text-white/60">
                <p>📧 soporte@bodestockgo.com</p>
                <p>🇨🇱 Hecho en Chile</p>
              </div>
            </motion.div>
          </div>

          {/* Bottom Bar */}
          <motion.div
            className="pt-8 border-t border-white/10 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <button
                onClick={() => navigate('/terminos')}
                className="text-sm text-white/60 hover:text-blue-400 transition-colors"
              >
                Términos y Condiciones
              </button>
              <span className="hidden sm:inline text-white/40">•</span>
              <button
                onClick={() => navigate('/privacidad')}
                className="text-sm text-white/60 hover:text-blue-400 transition-colors"
              >
                Política de Privacidad
              </button>
            </div>
            <p className="text-sm text-white/60">
              © 2025 Bodestock. Todos los derechos reservados.
            </p>
          </motion.div>
        </div>
      {/* ===== SECCIÓN AYUDA ===== */}
      <section className="py-20 px-4 bg-gradient-to-b from-slate-900 to-black">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
              <HelpCircle className="w-4 h-4" />
              Centro de Ayuda
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              ¿Tenés dudas?
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Tenemos respuestas para las preguntas más frecuentes sobre planes, inventario, trabajadores y más.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/ayuda')}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-base transition-all shadow-lg shadow-blue-500/25"
              >
                <HelpCircle className="w-5 h-5" />
                Ver preguntas frecuentes
              </button>
              <a
                href="https://wa.me/56948487391"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-base transition-all"
              >
                <MessageSquare className="w-5 h-5 text-green-400" />
                Contactar soporte
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      </footer>
    </div>
  );
}
