// src/components/help/CostingHelpModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  HelpCircle,
  ChevronRight,
  Lightbulb,
  Coffee,
  Wine,
  Calculator,
  TrendingUp,
  Package,
  Scissors,
  DollarSign,
  PlayCircle,
  Smartphone,
  MessageCircle,
  Youtube
} from 'lucide-react';

const CostingHelpModal = ({ isOpen, onClose, currentStep = 0, onApplyTemplate }) => {
  const [selectedExample, setSelectedExample] = useState('piscoSour');
  const [activeTab, setActiveTab] = useState('ejemplos'); // 'ejemplos', 'videos', 'contacto'

  // Ejemplos específicos por industria - AMPLIADOS
  const EXAMPLES = {
    piscoSour: {
      id: 'piscoSour',
      industria: 'bar',
      icon: <Wine className="w-5 h-5 sm:w-6 sm:h-6" />,
      nombre: 'Pisco Sour',
      color: 'from-amber-500 to-orange-500',
      descripcion: 'Cocktail clásico de bar',
      videoUrl: null, // Placeholder para futuro
      insumos: [
        { nombre: 'Pisco 35°', cantidad: '60 ml', costo: 800 },
        { nombre: 'Limón (jugo)', cantidad: '30 ml', costo: 300 },
        { nombre: 'Clara de huevo', cantidad: '1 unidad', costo: 200 },
        { nombre: 'Jarabe de goma', cantidad: '20 ml', costo: 150 },
        { nombre: 'Amargo angostura', cantidad: '3 gotas', costo: 50 }
      ],
      extras: [
        { nombre: 'Copa/Vaso', valor: 500 },
        { nombre: 'Hielo', valor: 200 },
        { nombre: 'Decoración', valor: 300 },
        { nombre: 'Pitillo/Servilleta', valor: 100 }
      ],
      manoObra: 800,
      margen: 150,
      tip: '💡 El margen estándar en bares es 100-200%. Considera ubicación y competencia.'
    },
    packCervezas: {
      id: 'packCervezas',
      industria: 'botilleria',
      icon: <Package className="w-5 h-5 sm:w-6 sm:h-6" />,
      nombre: 'Pack 6 Cervezas',
      color: 'from-yellow-500 to-amber-600',
      descripcion: 'Pack de 6 cervezas artesanales',
      videoUrl: null,
      insumos: [
        { nombre: 'Cerveza Artesanal IPA 330ml', cantidad: '6 unidades', costo: 6000 }
      ],
      extras: [
        { nombre: 'Caja cartón', valor: 400 },
        { nombre: 'Plástico termocontraíble', valor: 200 },
        { nombre: 'Etiqueta/Sticker', valor: 100 }
      ],
      manoObra: 300,
      margen: 30,
      tip: '💡 En botillerías el margen es menor (25-40%) pero el volumen es mayor.'
    },
    pastelesPersonalizados: {
      id: 'pastelesPersonalizados',
      industria: 'pasteleria',
      icon: <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />,
      nombre: 'Torta 1 Kg',
      color: 'from-pink-500 to-rose-500',
      descripcion: 'Torta decorada personalizada',
      videoUrl: null,
      insumos: [
        { nombre: 'Harina', cantidad: '500 g', costo: 600 },
        { nombre: 'Azúcar', cantidad: '400 g', costo: 400 },
        { nombre: 'Huevos', cantidad: '6 unidades', costo: 1200 },
        { nombre: 'Mantequilla', cantidad: '250 g', costo: 1500 },
        { nombre: 'Leche', cantidad: '200 ml', costo: 300 },
        { nombre: 'Crema para decorar', cantidad: '300 g', costo: 2000 },
        { nombre: 'Colorantes/Decoración', cantidad: '1 set', costo: 1000 }
      ],
      extras: [
        { nombre: 'Caja para torta', valor: 800 },
        { nombre: 'Base de cartón', valor: 300 },
        { nombre: 'Velas', valor: 200 }
      ],
      manoObra: 3000,
      margen: 180,
      tip: '💡 Las tortas personalizadas tienen alto valor agregado. Considera tu tiempo de decoración.'
    },
    comboAlmuerzo: {
      id: 'comboAlmuerzo',
      industria: 'restaurante',
      icon: <Package className="w-5 h-5 sm:w-6 sm:h-6" />,
      nombre: 'Menú del Día',
      color: 'from-green-500 to-emerald-500',
      descripcion: 'Almuerzo ejecutivo completo',
      videoUrl: null,
      insumos: [
        { nombre: 'Arroz', cantidad: '150 g', costo: 200 },
        { nombre: 'Pollo', cantidad: '200 g', costo: 1200 },
        { nombre: 'Ensalada (mix)', cantidad: '100 g', costo: 400 },
        { nombre: 'Papa', cantidad: '150 g', costo: 300 },
        { nombre: 'Aceite/Condimentos', cantidad: '1 porción', costo: 200 }
      ],
      extras: [
        { nombre: 'Plato/Envase', valor: 800 },
        { nombre: 'Cubiertos/Servilleta', valor: 200 },
        { nombre: 'Bebida', valor: 500 }
      ],
      manoObra: 1500,
      margen: 180,
      tip: '💡 Los menús del día deben tener buen margen pero precio competitivo.'
    },
    cafeEspecialidad: {
      id: 'cafeEspecialidad',
      industria: 'cafeteria',
      icon: <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />,
      nombre: 'Café Latte 12oz',
      color: 'from-orange-500 to-red-500',
      descripcion: 'Café con leche especialidad',
      videoUrl: null,
      insumos: [
        { nombre: 'Café molido (espresso)', cantidad: '18 g', costo: 400 },
        { nombre: 'Leche', cantidad: '250 ml', costo: 300 },
        { nombre: 'Jarabe (opcional)', cantidad: '15 ml', costo: 150 }
      ],
      extras: [
        { nombre: 'Vaso 12oz + tapa', valor: 600 },
        { nombre: 'Manga térmica', valor: 100 },
        { nombre: 'Agitador', valor: 50 }
      ],
      manoObra: 600,
      margen: 200,
      tip: '💡 El café tiene uno de los márgenes más altos en cafeterías (200-300%).'
    },
    empanadaQueso: {
      id: 'empanadaQueso',
      industria: 'panaderia',
      icon: <Package className="w-5 h-5 sm:w-6 sm:h-6" />,
      nombre: 'Empanada Queso',
      color: 'from-yellow-600 to-orange-600',
      descripcion: 'Empanada de queso horneada',
      videoUrl: null,
      insumos: [
        { nombre: 'Masa para empanadas', cantidad: '1 unidad', costo: 150 },
        { nombre: 'Queso', cantidad: '80 g', costo: 400 },
        { nombre: 'Huevo (barniz)', cantidad: '5 g', costo: 30 }
      ],
      extras: [
        { nombre: 'Bolsa papel', valor: 50 },
        { nombre: 'Servilleta', valor: 20 }
      ],
      manoObra: 200,
      margen: 150,
      tip: '💡 Las empanadas tienen bajo costo pero alto volumen de venta.'
    }
  };

  const example = EXAMPLES[selectedExample];

  // Calcular totales
  const costoInsumos = example.insumos.reduce((sum, i) => sum + i.costo, 0);
  const costoExtras = example.extras.reduce((sum, e) => sum + e.valor, 0);
  const costoTotal = costoInsumos + costoExtras + example.manoObra;
  const precioVenta = Math.round(costoTotal * (1 + example.margen / 100));
  const ganancia = precioVenta - costoTotal;

  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Consejos por paso del wizard
  const STEP_TIPS = [
    {
      step: 0,
      title: 'Información Básica',
      tips: [
        { icon: <Wine />, text: 'Nombre descriptivo y fácil de reconocer' },
        { icon: <Package />, text: 'Define si es 1 unidad, pack, porción, etc.' },
        { icon: <Coffee />, text: 'Usa plantillas para tu tipo de negocio' }
      ]
    },
    {
      step: 1,
      title: 'Selección de Insumos',
      tips: [
        { icon: <Calculator />, text: 'Busca todos los ingredientes necesarios' },
        { icon: <Scissors />, text: 'Cantidades exactas por unidad final' },
        { icon: <TrendingUp />, text: 'El costo se calcula automáticamente' }
      ]
    },
    {
      step: 2,
      title: 'Costos Adicionales',
      tips: [
        { icon: <Package />, text: 'Empaque, vasos, platos, decoración' },
        { icon: <DollarSign />, text: 'Tiempo del empleado para preparar' },
        { icon: <TrendingUp />, text: 'Tu margen de ganancia deseado' }
      ]
    }
  ];

  const currentStepTips = STEP_TIPS.find(s => s.step === currentStep);

  // Videos tutoriales (placeholder)
  const VIDEOS = [
    {
      id: 1,
      title: '¿Cómo costear un producto?',
      duration: '2:30',
      thumbnail: '🎥',
      description: 'Tutorial completo paso a paso'
    },
    {
      id: 2,
      title: 'Calculando tu margen ideal',
      duration: '1:45',
      thumbnail: '📊',
      description: 'Aprende a definir precios'
    },
    {
      id: 3,
      title: 'Tips para reducir costos',
      duration: '3:10',
      thumbnail: '💰',
      description: 'Optimiza tus gastos'
    }
  ];

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300
      }
    },
    exit: { opacity: 0, scale: 0.9, y: 20 }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-5xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
          variants={modalVariants}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Mobile optimized */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-6 text-white relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-white/10 rounded-full -mr-16 sm:-mr-32 -mt-16 sm:-mt-32" />

            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-2 sm:gap-3 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-bold truncate">¿Necesitas Ayuda?</h2>
                  <p className="text-blue-100 text-xs sm:text-sm truncate">Aprende con ejemplos reales</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs - Mobile friendly */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
              {[
                { id: 'ejemplos', label: 'Ejemplos', icon: <PlayCircle className="w-4 h-4" /> },
                { id: 'videos', label: 'Videos', icon: <Youtube className="w-4 h-4" /> },
                { id: 'contacto', label: 'Soporte', icon: <MessageCircle className="w-4 h-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="overflow-y-auto flex-1">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

              {/* TAB: Ejemplos */}
              {activeTab === 'ejemplos' && (
                <>
                  {/* Tips del paso actual */}
                  {currentStepTips && (
                    <motion.div
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">{currentStepTips.title}</h3>
                      </div>
                      <div className="space-y-2">
                        {currentStepTips.tips.map((tip, idx) => (
                          <motion.div
                            key={idx}
                            className="flex items-start gap-2 sm:gap-3 bg-white p-2 sm:p-3 rounded-lg"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-600">
                              {React.cloneElement(tip.icon, { className: 'w-4 h-4' })}
                            </div>
                            <p className="text-slate-700 text-xs sm:text-sm flex-1">{tip.text}</p>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Selector de ejemplos - Grid responsive */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      <span>Ejemplos por Industria</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {Object.values(EXAMPLES).map((ex) => (
                        <motion.button
                          key={ex.id}
                          onClick={() => {
                            setSelectedExample(ex.id);
                            // Hacer scroll al detalle del ejemplo
                            setTimeout(() => {
                              const detalleElement = document.getElementById('detalle-ejemplo');
                              if (detalleElement) {
                                detalleElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                              }
                            }, 100);
                          }}
                          className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-left ${
                            selectedExample === ex.id
                              ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md'
                              : 'border-slate-200 bg-white hover:border-blue-300'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${ex.color} rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                              {ex.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate">{ex.nombre}</h4>
                              <p className="text-xs text-slate-600 truncate">{ex.descripcion}</p>
                            </div>
                            {selectedExample === ex.id && (
                              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              </div>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Detalle del ejemplo */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      id="detalle-ejemplo"
                      key={selectedExample}
                      className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      {/* Header del ejemplo */}
                      <div className="flex items-center gap-2 sm:gap-3 mb-4">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br ${example.color} rounded-lg flex items-center justify-center text-white`}>
                          {example.icon}
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900">{example.nombre}</h3>
                      </div>

                      {/* Insumos */}
                      <div className="mb-4">
                        <h4 className="font-bold text-slate-800 mb-2 text-sm sm:text-base">📦 Insumos / Ingredientes</h4>
                        <div className="bg-white rounded-lg p-3 space-y-1.5">
                          {example.insumos.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-slate-900 text-xs sm:text-sm block truncate">{item.nombre}</span>
                                <span className="text-xs text-slate-500">{item.cantidad}</span>
                              </div>
                              <span className="font-bold text-blue-600 text-xs sm:text-sm flex-shrink-0">{formatCLP(item.costo)}</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t-2 border-blue-200 flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-sm">Total:</span>
                            <span className="text-lg sm:text-xl font-bold text-blue-600">{formatCLP(costoInsumos)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Extras */}
                      <div className="mb-4">
                        <h4 className="font-bold text-slate-800 mb-2 text-sm sm:text-base">✨ Costos Extras</h4>
                        <div className="bg-white rounded-lg p-3 space-y-1.5">
                          {example.extras.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                              <span className="font-medium text-slate-900 text-xs sm:text-sm flex-1 truncate">{item.nombre}</span>
                              <span className="font-bold text-slate-700 text-xs sm:text-sm flex-shrink-0">{formatCLP(item.valor)}</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t-2 border-blue-200 flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-sm">Total:</span>
                            <span className="text-lg sm:text-xl font-bold text-blue-600">{formatCLP(costoExtras)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Mano de obra */}
                      <div className="mb-4">
                        <h4 className="font-bold text-slate-800 mb-2 text-sm sm:text-base">👨‍🍳 Mano de Obra</h4>
                        <div className="bg-white rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 text-xs sm:text-sm">Costo de preparación:</span>
                            <span className="text-lg sm:text-xl font-bold text-blue-600">{formatCLP(example.manoObra)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Resumen y precio */}
                      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-4 text-white">
                        <h4 className="font-bold text-base sm:text-lg mb-3 flex items-center gap-2">
                          <Calculator className="w-5 h-5" />
                          <span>Resumen Final</span>
                        </h4>
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-100">Costo Total:</span>
                            <span className="font-bold">{formatCLP(costoTotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-100">Margen:</span>
                            <span className="font-bold">{example.margen}%</span>
                          </div>
                          <div className="border-t border-white/30 pt-2 mt-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-sm sm:text-base">Precio Venta:</span>
                              <span className="text-xl sm:text-2xl font-bold">{formatCLP(precioVenta)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-green-200 text-sm">Ganancia:</span>
                              <span className="text-lg sm:text-xl font-bold text-green-300">{formatCLP(ganancia)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tip */}
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs sm:text-sm text-amber-800">{example.tip}</p>
                      </div>

                      {/* Botón para aplicar plantilla */}
                      {onApplyTemplate && (
                        <motion.button
                          onClick={() => onApplyTemplate(example.industria)}
                          className="mt-3 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition shadow-lg flex items-center justify-center gap-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <ChevronRight className="w-5 h-5" />
                          <span>Usar esta plantilla de {example.industria}</span>
                        </motion.button>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              )}

              {/* TAB: Videos */}
              {activeTab === 'videos' && (
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-600" />
                    <span>Tutoriales en Video</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {VIDEOS.map((video) => (
                      <motion.div
                        key={video.id}
                        className="bg-white rounded-xl border-2 border-slate-200 p-4 hover:border-blue-300 transition-all cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0">
                            {video.thumbnail}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm sm:text-base mb-1">{video.title}</h4>
                            <p className="text-xs sm:text-sm text-slate-600 mb-2">{video.description}</p>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">
                                ⏱️ {video.duration}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">Próximamente</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-blue-800 mb-2">📹 Videos tutoriales en desarrollo</p>
                    <p className="text-xs text-blue-600">Pronto tendrás acceso a tutoriales paso a paso en video</p>
                  </div>
                </div>
              )}

              {/* TAB: Contacto/Soporte */}
              {activeTab === 'contacto' && (
                <div className="space-y-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    <span>¿Necesitas más ayuda?</span>
                  </h3>

                  <motion.a
                    href="https://wa.me/56948487391?text=Hola!%20Necesito%20ayuda%20con%20Bodestock"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 sm:p-6 text-white shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-base sm:text-lg mb-1">Chatea con Nosotros</h4>
                        <p className="text-xs sm:text-sm text-green-100 mb-2">Respuesta en menos de 5 minutos</p>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium">En línea ahora</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                    </div>
                  </motion.a>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl border-2 border-slate-200 p-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                        <Smartphone className="w-5 h-5 text-blue-600" />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1 text-sm sm:text-base">Horario de Atención</h4>
                      <p className="text-xs sm:text-sm text-slate-600">Lun - Vie: 9:00 - 18:00</p>
                      <p className="text-xs sm:text-sm text-slate-600">Sáb: 10:00 - 14:00</p>
                    </div>

                    <div className="bg-white rounded-xl border-2 border-slate-200 p-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                        <HelpCircle className="w-5 h-5 text-purple-600" />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1 text-sm sm:text-base">Preguntas Frecuentes</h4>
                      <p className="text-xs sm:text-sm text-slate-600">Encuentra respuestas rápidas</p>
                      <button className="text-xs sm:text-sm text-purple-600 font-medium mt-2">Ver FAQ →</button>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                    <h4 className="font-bold text-slate-900 mb-2 text-sm sm:text-base">💡 ¿Tienes una sugerencia?</h4>
                    <p className="text-xs sm:text-sm text-slate-700 mb-3">
                      Nos encantaría escuchar tus ideas para mejorar Bodestock
                    </p>
                    <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-blue-700 transition">
                      Enviar Sugerencia
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer - Mobile optimized */}
          <div className="border-t border-slate-200 p-3 sm:p-4 bg-slate-50 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 sm:px-6 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition shadow-lg text-sm sm:text-base"
            >
              Entendido, volver al costeo
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CostingHelpModal;
