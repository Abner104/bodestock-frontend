// src/pages/ProductCostingWizardV2.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';


import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Trash2,
  Plus,
  Sparkles,
  Check,
  AlertCircle,
  Zap,
  Wine,
  UtensilsCrossed,
  Coffee,
  Cake,
  Calculator,
  ShoppingCart
} from 'lucide-react';
import CostingPreview from '../components/costing/CostingPreview';
import ImprovedInsumoSearch from '../components/costing/ImprovedInsumoSearch';
import PriceScenarios from '../components/costing/PriceScenarios';
import CostingAssistant from '../components/costing/CostingAssistant';
import { useRegionContext } from '../contexts/RegionContext';

const PLANTILLAS = {
  ninguna:    { nombre: 'Desde cero', emoji: '⚡', extras: [], manoDeObra: 0, utilidad: 0, icon: Zap },
  bar:        { nombre: 'Bar',        emoji: '🍹', extras: [], manoDeObra: 0, utilidad: 150, icon: Wine },
  restaurante:{ nombre: 'Restaurant', emoji: '🍽️', extras: [], manoDeObra: 0, utilidad: 200, icon: UtensilsCrossed },
  cafeteria:  { nombre: 'Cafetería',  emoji: '☕', extras: [], manoDeObra: 0, utilidad: 180, icon: Coffee },
  panaderia:  { nombre: 'Panadería',  emoji: '🥐', extras: [], manoDeObra: 0, utilidad: 180, icon: Cake },
  minimarket: { nombre: 'Minimarket', emoji: '🛒', extras: [], manoDeObra: 0, utilidad: 30,  icon: ShoppingCart },
  custom:     { nombre: 'Personalizado', emoji: '✏️', extras: [], manoDeObra: 0, utilidad: 0, icon: Calculator },
};

const STEPS = [
  'Nombre',
  'Insumos',
  'Extras',
  'División',
  'Precio'
];

const ProductCostingWizardV2 = () => {
  const navigate = useNavigate();
  const { formatPrice, currency } = useRegionContext();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const handleResize = () => {
      setKeyboardVisible(viewport.height < window.innerHeight * 0.75);
    };
    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  // AI Assistant
  const [showAssistant, setShowAssistant] = useState(false);
  const [companyId, setCompanyId] = useState(null);

  // Form data
  const [nombreProducto, setNombreProducto] = useState('');
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('ninguna');
  const [insumos, setInsumos] = useState([]);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [manoDeObra, setManoDeObra] = useState(0);
  const [costosIndirectos, setCostosIndirectos] = useState(0);
  const [utilidadDeseada, setUtilidadDeseada] = useState(0);
  const [extras, setExtras] = useState([]);

  // Modo precio directo (sin receta: mouse, KitKat, etc.)
  const [modoDirecto, setModoDirecto] = useState(false);
  const [costoDirecto, setCostoDirecto] = useState('');

  // División de producto
  const [seDivide, setSeDivide] = useState(false);
  const [cantidadDivisiones, setCantidadDivisiones] = useState('');
  const [tipoDivision, setTipoDivision] = useState('porciones');
  const [unidadDivision, setUnidadDivision] = useState('porción');

  // Cargar insumos desde Firebase
  useEffect(() => {
    const fetchInsumos = async () => {
      try {
        // Obtener usuario actual
        const currentUser = auth.currentUser;

        if (!currentUser) {
          console.error('❌ No hay usuario autenticado');
          setError('Por favor inicia sesión para continuar.');
          return;
        }

        // Obtener companyId desde los custom claims de Firebase Auth
        const idTokenResult = await currentUser.getIdTokenResult();
        const companyIdFromClaims = idTokenResult.claims.companyId;

        console.log('🔑 CompanyId desde Firebase Auth claims:', companyIdFromClaims);

        if (!companyIdFromClaims) {
          console.error('❌ No se encontró companyId en los claims del usuario');
          setError('No se pudo identificar la empresa. Por favor contacta al administrador.');
          return;
        }

        // Guardar companyId en el estado
        setCompanyId(companyIdFromClaims);

        const cid = companyIdFromClaims;

        const mapDoc = (doc) => {
          const data = doc.data();
          const costo = data.ppp || data.cost || data.costoUnitario || data.price || data.precio || 0;
          return {
            id: doc.id,
            nombre: data.name || data.nombre || '',
            precio: costo,
            costoUnitario: costo,
            unidad: data.unit || data.unidad || 'unidad',
            stock: data.stock || 0,
            sku: data.sku || '',
            categoria: data.category || data.categoria || '',
          };
        };

        // Colección legacy
        const legacySnap = await getDocs(collection(db, `companies/${cid}/inventory`));
        const legacyList = legacySnap.docs.map(mapDoc);

        // Inventarios v2
        const inventoriesSnap = await getDocs(collection(db, `companies/${cid}/inventories`));
        const v2List = (await Promise.all(
          inventoriesSnap.docs.map(invDoc =>
            getDocs(collection(db, `companies/${cid}/inventories/${invDoc.id}/products`))
              .then(s => s.docs.map(mapDoc))
          )
        )).flat();

        // Unir y deduplicar por id
        const seen = new Set();
        const insumosList = [...legacyList, ...v2List].filter(r => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));

        setInsumosDisponibles(insumosList);
        console.log('✅ Insumos cargados correctamente:', insumosList.length);
        console.log('📋 Lista de insumos:', insumosList);
      } catch (err) {
        console.error('❌ Error cargando insumos:', err);
        console.error('❌ Error completo:', err.message, err.code);
        setError(`Error cargando inventario: ${err.message}`);
      }
    };
    fetchInsumos();
  }, []);

  // Aplicar plantilla (no tocar utilidad si es custom, ya la maneja Paso0)
  useEffect(() => {
    const plantilla = PLANTILLAS[plantillaSeleccionada];
    if (plantilla && plantillaSeleccionada !== 'custom') {
      setExtras(plantilla.extras);
      setManoDeObra(plantilla.manoDeObra);
      setUtilidadDeseada(plantilla.utilidad);
    }
  }, [plantillaSeleccionada]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calcular costos
  const calcularCostoInsumos = () => {
    return insumos.reduce((total, insumo) => {
      return total + (insumo.precioUnitario * insumo.cantidad);
    }, 0);
  };

  const calcularCostoExtras = () => {
    return extras.reduce((total, extra) => total + (extra.valor || 0), 0);
  };

  const calcularCostoTotal = () => {
    const base = modoDirecto ? (parseFloat(costoDirecto) || 0) : calcularCostoInsumos();
    return base + manoDeObra + costosIndirectos + calcularCostoExtras();
  };

  const calcularPrecioVenta = () => {
    return calcularCostoTotal() * (1 + utilidadDeseada / 100);
  };

  // Manejo de insumos
  const agregarInsumo = (producto) => {
    // Si el producto ya tiene cantidad y unidad definidas (viene del modal), usarlas
    const cantidadFinal = producto.cantidad !== undefined ? producto.cantidad : 1;
    const unidadFinal = producto.unidad || 'unidad';

    // Convertir el precio si la unidad es diferente a la original
    let precioUnitarioFinal = producto.costoUnitario || producto.precio || producto.precioUnitario || 0;

    const insumoExistente = insumos.find(i => i.id === producto.id);

    if (insumoExistente) {
      // Si ya existe, incrementar cantidad
      setInsumos(insumos.map(i =>
        i.id === producto.id
          ? { ...i, cantidad: i.cantidad + cantidadFinal }
          : i
      ));
    } else {
      // Si no existe, agregarlo
      setInsumos([...insumos, {
        id: producto.id,
        nombre: producto.nombre,
        precioUnitario: precioUnitarioFinal,
        cantidad: cantidadFinal,
        unidad: unidadFinal,
      }]);
    }
  };

  const actualizarCantidadInsumo = (id, cantidad) => {
    setInsumos(insumos.map(i =>
      i.id === id ? { ...i, cantidad: parseFloat(cantidad) || 0 } : i
    ));
  };

  const eliminarInsumo = (id) => {
    setInsumos(insumos.filter(i => i.id !== id));
  };

  // Manejo de extras
  const agregarExtra = () => {
    setExtras([...extras, { nombre: '', valor: 0 }]);
  };

  const actualizarExtra = (index, field, value) => {
    const nuevosExtras = [...extras];
    nuevosExtras[index][field] = field === 'valor' ? parseFloat(value) || 0 : value;
    setExtras(nuevosExtras);
  };

  const eliminarExtra = (index) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  // Navegación
  const nextStep = () => {
    setError('');

    if (activeStep === 0 && !nombreProducto.trim()) {
      setError('Por favor ingresa un nombre para el producto');
      return;
    }

    if (activeStep === 0 && modoDirecto && (!costoDirecto || parseFloat(costoDirecto) <= 0)) {
      setError('Ingresa el costo de compra del producto');
      return;
    }

    // En modo directo saltar el paso de insumos (paso 1)
    if (activeStep === 0 && modoDirecto) {
      setActiveStep(2); // saltar a Extras
      return;
    }

    if (activeStep === 1 && insumos.length === 0) {
      setError('Agrega al menos un insumo para continuar');
      return;
    }

    if (activeStep < STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const prevStep = () => {
    setError('');
    // En modo directo volver desde Extras al paso 0 directamente
    if (activeStep === 2 && modoDirecto) {
      setActiveStep(0);
      return;
    }
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Guardar producto
  const guardarProducto = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔍 Iniciando guardado de producto...');
      console.log('📍 CompanyId actual:', companyId);

      if (!companyId) {
        setError('No se pudo identificar la empresa. Por favor recarga la página.');
        setLoading(false);
        return;
      }

      const costoTotal = calcularCostoTotal();
      const currentUser = auth.currentUser;

      console.log('👤 Usuario actual:', currentUser?.email);
      console.log('🔑 UID:', currentUser?.uid);

      const productoData = {
        nombre: nombreProducto,
        plantilla: plantillaSeleccionada,
        insumos: insumos,
        manoDeObra: manoDeObra,
        costosIndirectos: costosIndirectos,
        extras: extras,
        costoTotal: costoTotal,
        utilidadDeseada: utilidadDeseada,
        precioSugerido: calcularPrecioVenta(),
        currency: currency.code,
        // Datos de división
        seDivide: seDivide,
        cantidadDivisiones: seDivide ? parseFloat(cantidadDivisiones) || 0 : 0,
        tipoDivision: seDivide ? tipoDivision : '',
        unidadDivision: seDivide ? unidadDivision : '',
        photoURL: '',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown',
      };

      console.log('📦 Datos a guardar:', productoData);

      const collectionPath = `companies/${companyId}/productos_terminados`;
      console.log('📍 Guardando en:', collectionPath);

      // Guardar en la ruta correcta: companies/{companyId}/productos_terminados
      const docRef = await addDoc(collection(db, collectionPath), productoData);
      console.log('✅ Producto guardado correctamente con ID:', docRef.id);
      console.log('✅ Ruta completa:', `${collectionPath}/${docRef.id}`);

      // Resetear formulario y volver al inicio del wizard
      setNombreProducto('');
      setPlantillaSeleccionada('ninguna');
      setInsumos([]);
      setManoDeObra(0);
      setCostosIndirectos(0);
      setExtras([]);
      setSeDivide(false);
      setCantidadDivisiones('');
      setTipoDivision('porciones');
      setUnidadDivision('porción');
      setActiveStep(0);
      setError('');

      // Mostrar mensaje de éxito
      alert('✅ Producto guardado correctamente. Puedes crear otro producto.');
    } catch (err) {
      console.error('❌ Error al guardar producto:', err);
      console.error('❌ Código de error:', err.code);
      console.error('❌ Mensaje:', err.message);
      console.error('❌ Stack:', err.stack);
      setError(`Error al guardar el producto: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manejar datos del asistente IA
  const handleFillFromAssistant = (actionData) => {
    console.log('🤖 Llenando wizard con datos del asistente:', actionData);

    // 1. Llenar nombre del producto
    if (actionData.nombre) {
      console.log('📝 Nombre:', actionData.nombre);
      setNombreProducto(actionData.nombre);
    }

    // 2. Llenar insumos
    if (actionData.insumos && Array.isArray(actionData.insumos)) {
      console.log('🥘 Procesando', actionData.insumos.length, 'insumos...');

      // Mapear insumos sugeridos por IA con búsqueda flexible
      const insumosMapeados = actionData.insumos.map(insumoIA => {
        console.log('🔍 Buscando:', insumoIA.nombre);

        // Buscar en inventario (búsqueda flexible)
        const insumoReal = insumosDisponibles.find(i => {
          const nombreInsumo = i.nombre.toLowerCase();
          const nombreBuscado = insumoIA.nombre.toLowerCase();

          // Búsqueda flexible: contiene o es similar
          return nombreInsumo.includes(nombreBuscado) || nombreBuscado.includes(nombreInsumo);
        });

        if (insumoReal) {
          console.log('✅ Encontrado:', insumoReal.nombre);
          return {
            id: insumoReal.id,
            nombre: insumoReal.nombre,
            precioUnitario: insumoReal.costoUnitario,
            cantidad: insumoIA.cantidad || 1,
            unidad: insumoReal.unidad
          };
        } else {
          console.log('⚠️ No encontrado en inventario:', insumoIA.nombre);
          // Si no está en inventario, crear insumo temporal con costo estimado
          return {
            id: `temp-${Date.now()}-${Math.random()}`,
            nombre: insumoIA.nombre,
            precioUnitario: 1000, // Costo estimado por defecto
            cantidad: insumoIA.cantidad || 1,
            unidad: insumoIA.unidad || 'unidades',
            temporal: true // Marcar como temporal
          };
        }
      });

      console.log('📦 Insumos mapeados:', insumosMapeados);
      setInsumos(insumosMapeados);

      // Ir automáticamente al paso de insumos (paso 1)
      setActiveStep(1);
    }

    // 3. Llenar utilidad sugerida
    if (actionData.utilidadSugerida) {
      console.log('💰 Utilidad sugerida:', actionData.utilidadSugerida);
      setUtilidadDeseada(actionData.utilidadSugerida);
    }

    // Mostrar mensaje de éxito
    alert(`✅ ¡Wizard llenado con éxito!\n\n📝 Producto: ${actionData.nombre}\n🥘 Ingredientes: ${actionData.insumos?.length || 0}\n\nRevisa y ajusta los datos si es necesario.`);
  };

  // Renderizar pasos
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Paso0Nombre
            nombreProducto={nombreProducto}
            setNombreProducto={setNombreProducto}
            plantillaSeleccionada={plantillaSeleccionada}
            setPlantillaSeleccionada={setPlantillaSeleccionada}
            utilidadDeseada={utilidadDeseada}
            setUtilidadDeseada={setUtilidadDeseada}
            modoDirecto={modoDirecto}
            setModoDirecto={setModoDirecto}
            costoDirecto={costoDirecto}
            setCostoDirecto={setCostoDirecto}
            formatPrice={formatPrice}
            currency={currency}
          />
        );

      case 1:
        return (
          <Paso1Insumos
            insumos={insumos}
            insumosDisponibles={insumosDisponibles}
            agregarInsumo={agregarInsumo}
            actualizarCantidadInsumo={actualizarCantidadInsumo}
            eliminarInsumo={eliminarInsumo}
            formatPrice={formatPrice}
          />
        );

      case 2:
        return (
          <Paso3Extras
            manoDeObra={manoDeObra}
            setManoDeObra={setManoDeObra}
            costosIndirectos={costosIndirectos}
            setCostosIndirectos={setCostosIndirectos}
            formatPrice={formatPrice}
            currency={currency}
          />
        );

      case 3:
        return (
          <Paso4Division
            seDivide={seDivide}
            setSeDivide={setSeDivide}
            cantidadDivisiones={cantidadDivisiones}
            setCantidadDivisiones={setCantidadDivisiones}
            tipoDivision={tipoDivision}
            setTipoDivision={setTipoDivision}
            unidadDivision={unidadDivision}
            setUnidadDivision={setUnidadDivision}
            costoTotal={calcularCostoTotal()}
            formatPrice={formatPrice}
          />
        );

      case 4:
        return (
          <Paso5PrecioFinal
            costoTotal={calcularCostoTotal()}
            utilidadDeseada={utilidadDeseada}
            setUtilidadDeseada={setUtilidadDeseada}
            seDivide={seDivide}
            cantidadDivisiones={cantidadDivisiones}
            unidadDivision={unidadDivision}
            formatPrice={formatPrice}
            currency={currency}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-slate-950 ${keyboardVisible ? 'pb-4' : 'pb-32 lg:pb-6'}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-5 md:pt-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-3 sm:mb-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              Nuevo Producto
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Paso {activeStep + 1} de {STEPS.length} · {STEPS[activeStep]}
            </p>
          </div>
          <button
            onClick={() => setShowAssistant(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-md text-xs font-semibold shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Costear con IA</span>
            <span className="sm:hidden">IA</span>
          </button>
        </motion.div>

        {/* ── Stepper visual ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-5"
        >
          {/* Barra de progreso continua */}
          <div className="relative h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mb-3 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              animate={{ width: `${((activeStep) / (STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          {/* Dots + labels */}
          <div className="flex items-start justify-between">
            {STEPS.map((step, index) => {
              const done = activeStep > index;
              const current = activeStep === index;
              return (
                <div key={step} className="flex flex-col items-center" style={{ width: `${100 / STEPS.length}%` }}>
                  <motion.div
                    animate={{
                      backgroundColor: done ? '#4F46E5' : current ? '#6366f1' : 'transparent',
                      borderColor: done || current ? '#6366f1' : '#d1d5db',
                      scale: current ? 1.15 : 1,
                    }}
                    transition={{ duration: 0.25 }}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs mb-1 shadow-sm"
                    style={{ color: done || current ? 'white' : '#9ca3af' }}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : <span>{index + 1}</span>}
                  </motion.div>
                  <span className={`text-[10px] sm:text-[11px] text-center leading-tight font-medium ${
                    current ? 'text-indigo-600 dark:text-indigo-400' :
                    done    ? 'text-indigo-400 dark:text-indigo-500' :
                              'text-gray-400 dark:text-slate-500'
                  }`}>{step}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Layout 2 cols desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          {/* Wizard principal */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pt-4"
                  >
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-red-800 font-medium text-sm flex-1">{error}</p>
                      <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step Content */}
              <div className="p-4 sm:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22 }}
                  >
                    {renderStepContent()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 gap-2">
                <button
                  onClick={prevStep}
                  disabled={activeStep === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition font-semibold text-sm border border-gray-200 dark:border-slate-700 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                {activeStep === STEPS.length - 1 ? (
                  <button
                    onClick={guardarProducto}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl disabled:opacity-50 transition font-semibold text-sm shadow-md"
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Guardando...</span></>
                    ) : (
                      <><Save className="w-4 h-4" /><span>Guardar Producto</span></>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={nextStep}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition font-semibold text-sm shadow-md"
                  >
                    <span>Siguiente</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Preview lateral — solo desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-4">
              <CostingPreview
                nombreProducto={nombreProducto}
                costoInsumos={calcularCostoInsumos()}
                costoExtras={calcularCostoExtras()}
                costoManoObra={manoDeObra}
                costosIndirectos={costosIndirectos}
                costoTotal={calcularCostoTotal()}
                precioVenta={calcularPrecioVenta()}
                utilidadPorcentaje={utilidadDeseada}
                formatPrice={formatPrice}
              />
            </div>
          </div>
        </div>

        {/* ── Bottom bar mobile (resumen flotante) ── */}
        {!keyboardVisible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="lg:hidden fixed bottom-[56px] left-0 right-0 z-40"
          >
            <div className="mx-3 mb-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium leading-none mb-0.5">Costo total</p>
                <p className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {formatPrice(calcularCostoTotal())}
                </p>
              </div>
              {utilidadDeseada > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium leading-none mb-0.5">Precio venta</p>
                  <p className="text-base font-bold text-emerald-500 leading-tight">
                    {formatPrice(calcularPrecioVenta())}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Assistant Modal */}
      <CostingAssistant
        isOpen={showAssistant}
        onClose={() => setShowAssistant(false)}
        onFillWizard={handleFillFromAssistant}
        companyId={companyId}
        currentStep={activeStep}
        plantilla={plantillaSeleccionada}
      />
    </div>
  );
};

// ==================== COMPONENTES DE PASOS ====================

const Paso0Nombre = ({ nombreProducto, setNombreProducto, plantillaSeleccionada, setPlantillaSeleccionada, utilidadDeseada, setUtilidadDeseada, modoDirecto, setModoDirecto, costoDirecto, setCostoDirecto, currency }) => {
  const stepCosto = currency.decimals > 0 ? '0.01' : '1';
  const handleSelectPlantilla = (key) => {
    setPlantillaSeleccionada(key);
    if (key !== 'custom') {
      setUtilidadDeseada(PLANTILLAS[key].utilidad);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Información Básica</h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">Nombre del producto y tipo de negocio</p>
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
          Nombre del Producto <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={nombreProducto}
          onChange={(e) => setNombreProducto(e.target.value)}
          placeholder="Ej: KitKat, Mouse Logitech..."
          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/50 outline-none transition text-base font-medium"
          autoFocus
        />
      </div>

      {/* Toggle modo directo vs con receta */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setModoDirecto(false)}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
            !modoDirecto
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-slate-400'
          }`}
        >
          <span>🧾</span> Con receta / insumos
        </button>
        <button
          onClick={() => setModoDirecto(true)}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
            modoDirecto
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-slate-400'
          }`}
        >
          <span>💰</span> Precio de compra directo
        </button>
      </div>

      {/* Input costo directo — solo en modo directo */}
      <AnimatePresence>
        {modoDirecto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-2xl">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-3">
                💰 ¿Cuánto te costó comprarlo? (precio neto sin IVA)
              </p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 font-bold text-lg">{currency.symbol}</span>
                <input
                  type="number"
                  value={costoDirecto}
                  onChange={(e) => setCostoDirecto(e.target.value)}
                  placeholder="Ej: 1200"
                  min="0"
                  step={stepCosto}
                  className="w-full pl-9 pr-4 py-3.5 border-2 border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:border-amber-500 outline-none text-2xl font-black text-center"
                />
              </div>
              <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70 mt-2 text-center">
                Saltarás el paso de insumos — vas directo a margen y precio de venta
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plantillas scroll horizontal */}
      <div>
        <p className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-2.5 uppercase tracking-widest">Tipo de negocio</p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {Object.entries(PLANTILLAS).filter(([k]) => k !== 'custom').map(([key, plantilla]) => {
            const isSelected = plantillaSeleccionada === key;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.94 }}
                onClick={() => handleSelectPlantilla(key)}
                className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
                }`}
              >
                <span className="text-base">{plantilla.emoji}</span>
                <span>{plantilla.nombre}</span>
                {isSelected && <span className="opacity-75 font-bold">{plantilla.utilidad}%</span>}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Margen */}
      <div className="bg-gray-50 dark:bg-slate-800/60 border-2 border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">Margen de ganancia</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Lo podés cambiar en cualquier momento</p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl px-3 py-2">
            <input
              type="number"
              value={utilidadDeseada}
              onChange={(e) => {
                setUtilidadDeseada(parseFloat(e.target.value) || 0);
                setPlantillaSeleccionada('custom');
              }}
              min="0"
              step="5"
              className="w-14 text-center text-base font-bold bg-transparent text-gray-900 dark:text-white outline-none"
            />
            <span className="text-sm font-bold text-indigo-500">%</span>
          </div>
        </div>
        {/* Presets rápidos */}
        <div className="flex gap-2 flex-wrap">
          {[20, 30, 50, 100, 150, 200].map(pct => (
            <button
              key={pct}
              onClick={() => { setUtilidadDeseada(pct); setPlantillaSeleccionada('custom'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                utilidadDeseada === pct
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Tabla de conversiones: de unidad inventario → unidades de uso disponibles
const UNIT_CONVERSIONS = {
  kg:     { label: 'kg',     opciones: [{ u: 'kg', factor: 1 }, { u: 'g', factor: 1000 }] },
  g:      { label: 'g',      opciones: [{ u: 'g', factor: 1 }, { u: 'kg', factor: 0.001 }] },
  litros: { label: 'litros', opciones: [{ u: 'litros', factor: 1 }, { u: 'ml', factor: 1000 }] },
  ml:     { label: 'ml',     opciones: [{ u: 'ml', factor: 1 }, { u: 'litros', factor: 0.001 }] },
  L:      { label: 'L',      opciones: [{ u: 'L', factor: 1 }, { u: 'ml', factor: 1000 }] },
};

const Paso1Insumos = ({ insumos, insumosDisponibles, agregarInsumo, actualizarCantidadInsumo, eliminarInsumo, formatPrice }) => {
  const [showModal, setShowModal] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [unidadUso, setUnidadUso] = useState('');

  const formatCurrency = formatPrice;

  // Opciones de unidad disponibles según la unidad del inventario
  const opcionesUnidad = productoSeleccionado
    ? (UNIT_CONVERSIONS[productoSeleccionado.unidad]?.opciones || [{ u: productoSeleccionado.unidad, factor: 1 }])
    : [];

  const handleSelectProducto = (producto) => {
    setProductoSeleccionado(producto);
    setCantidad('');
    // Por defecto usar la unidad del inventario
    setUnidadUso(producto.unidad);
    setShowModal(true);
  };

  // Costo por unidad de uso (convirtiendo si es necesario)
  const costoPorUnidadUso = () => {
    if (!productoSeleccionado) return 0;
    const conv = UNIT_CONVERSIONS[productoSeleccionado.unidad];
    if (!conv) return productoSeleccionado.costoUnitario;
    const opcion = conv.opciones.find(o => o.u === unidadUso);
    if (!opcion) return productoSeleccionado.costoUnitario;
    // factor = cuántas unidades de uso hay en 1 unidad de inventario
    return productoSeleccionado.costoUnitario / opcion.factor;
  };

  const subtotal = costoPorUnidadUso() * (parseFloat(cantidad) || 0);

  const handleConfirmarAgregar = () => {
    if (!productoSeleccionado || !cantidad || parseFloat(cantidad) <= 0) return;

    const insumoExistente = insumos.find(i => i.id === productoSeleccionado.id && i.unidad === unidadUso);
    if (insumoExistente) {
      actualizarCantidadInsumo(productoSeleccionado.id, insumoExistente.cantidad + parseFloat(cantidad));
    } else {
      agregarInsumo({
        ...productoSeleccionado,
        cantidad: parseFloat(cantidad),
        unidad: unidadUso,
        costoUnitario: costoPorUnidadUso(),
      });
    }

    setShowModal(false);
    setProductoSeleccionado(null);
    setCantidad('');
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Insumos del Producto</h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">Buscá y agregá los ingredientes o materiales</p>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <ImprovedInsumoSearch
          insumosDisponibles={insumosDisponibles}
          onSelectInsumo={handleSelectProducto}
        />
      </div>

      {/* Modal agregar insumo con conversión de unidades */}
      <AnimatePresence>
        {showModal && productoSeleccionado && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ zIndex: 99999 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6"
            >
              {/* Handle bar móvil */}
              <div className="w-10 h-1 bg-gray-200 dark:bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {productoSeleccionado.nombre}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Stock en inventario: <span className="font-bold text-gray-700 dark:text-slate-300">{formatCurrency(productoSeleccionado.costoUnitario)} / {productoSeleccionado.unidad}</span>
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition">
                  <AlertCircle className="w-4 h-4 text-gray-400 rotate-45" />
                </button>
              </div>

              {/* Selector de unidad — solo si hay conversiones disponibles */}
              {opcionesUnidad.length > 1 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">¿En qué unidad lo usás?</p>
                  <div className="flex gap-2">
                    {opcionesUnidad.map(({ u }) => (
                      <button
                        key={u}
                        onClick={() => { setUnidadUso(u); setCantidad(''); }}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                          unidadUso === u
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  {unidadUso !== productoSeleccionado.unidad && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                      Inventario en {productoSeleccionado.unidad} → se convierte automáticamente a {unidadUso}
                    </p>
                  )}
                </div>
              )}

              {/* Input cantidad */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  Cantidad en {unidadUso}
                </label>
                <input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  min="0"
                  step="0.1"
                  autoFocus
                  placeholder={unidadUso === 'g' ? 'Ej: 200' : unidadUso === 'ml' ? 'Ej: 250' : 'Ej: 1'}
                  className="w-full px-4 py-3.5 border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-xl focus:border-indigo-500 outline-none text-2xl font-black text-center"
                />
              </div>

              {/* Preview costo */}
              {cantidad > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl"
                >
                  <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                    <span>{formatCurrency(costoPorUnidadUso())} / {unidadUso} × {cantidad} {unidadUso}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Subtotal</span>
                    <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">{formatCurrency(subtotal)}</span>
                  </div>
                </motion.div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarAgregar}
                  disabled={!cantidad || parseFloat(cantidad) <= 0}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Agregar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de insumos — scroll interno para no desbordar en móvil */}
      {insumos.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">
              Agregados <span className="text-indigo-500 ml-1">{insumos.length}</span>
            </h3>
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
              Total: <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(insumos.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0))}</span>
            </span>
          </div>
          <div className="space-y-2 max-h-[260px] sm:max-h-[340px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700">
            <AnimatePresence>
              {insumos.map((insumo) => (
                <motion.div
                  key={insumo.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl"
                >
                  {/* Fila superior: nombre + (mobile) subtotal/borrar */}
                  <div className="flex items-center gap-2">
                    {/* Nombre + precio unitario */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate leading-tight">{insumo.nombre}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                        {formatCurrency(insumo.precioUnitario)}/{insumo.unidad}
                      </p>
                    </div>

                    {/* Subtotal — visible solo en mobile aquí, duplicado abajo para desktop */}
                    <div className="text-right shrink-0 min-w-[64px] sm:hidden">
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(insumo.precioUnitario * insumo.cantidad)}
                      </p>
                    </div>

                    {/* Borrar — visible solo en mobile aquí, duplicado abajo para desktop */}
                    <button
                      onClick={() => eliminarInsumo(insumo.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition shrink-0 sm:hidden"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Fila inferior (mobile) / resto de la fila (desktop): cantidad, unidad, subtotal, borrar */}
                  <div className="flex items-center gap-2 sm:contents">
                    {/* Cantidad editable */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        value={insumo.cantidad}
                        onChange={(e) => actualizarCantidadInsumo(insumo.id, e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-20 sm:w-16 px-2 py-2 sm:py-1.5 text-sm font-bold border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:border-indigo-500 outline-none text-center"
                      />
                      <span className="text-xs text-gray-500 dark:text-slate-400 w-8 truncate">{insumo.unidad}</span>
                    </div>

                    {/* Subtotal — visible solo en desktop aquí */}
                    <div className="hidden sm:block text-right shrink-0 min-w-[64px] ml-auto">
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(insumo.precioUnitario * insumo.cantidad)}
                      </p>
                    </div>

                    {/* Borrar — visible solo en desktop aquí */}
                    <button
                      onClick={() => eliminarInsumo(insumo.id)}
                      className="hidden sm:block p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center mb-3">
            <ShoppingCart className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-gray-600 dark:text-slate-400 text-center">Sin insumos todavía</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-1">Usá el buscador de arriba para agregar</p>
        </div>
      )}
    </div>
  );
};

const Paso3Extras = ({
  manoDeObra,
  setManoDeObra,
  costosIndirectos,
  setCostosIndirectos,
  formatPrice,
  currency,
}) => {
  const [calculadoraValues, setCalculadoraValues] = useState({
    manoDeObra: { total: 0, cantidad: 1 },
    costosIndirectos: { total: 0, cantidad: 1 }
  });

  const formatCurrency = formatPrice;

  const updateCalculadora = (tipo, campo, valor) => {
    const newValues = {
      ...calculadoraValues,
      [tipo]: {
        ...calculadoraValues[tipo],
        [campo]: parseFloat(valor) || 0
      }
    };
    setCalculadoraValues(newValues);

    // Calcular automáticamente el resultado
    const { total, cantidad } = newValues[tipo];
    if (cantidad > 0) {
      const resultado = Math.round(total / cantidad);
      if (tipo === 'manoDeObra') {
        setManoDeObra(resultado || 0);
      } else {
        setCostosIndirectos(resultado || 0);
      }
    }
  };

  // Calcular totales
  const totalExtras = manoDeObra + costosIndirectos;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Costos Adicionales</h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">Mano de obra y gastos operativos por producto</p>
      </div>

      <div className="space-y-4">

        {/* Calculadora Mano de Obra */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/60">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Mano de Obra</p>
              <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70">Costo mensual ÷ cantidad de productos</p>
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-800/50">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-1.5 uppercase tracking-wide">Costo Total {currency.symbol}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 font-bold text-sm">{currency.symbol}</span>
                  <input
                    type="number"
                    value={calculadoraValues.manoDeObra.total || ''}
                    onChange={(e) => updateCalculadora('manoDeObra', 'total', e.target.value)}
                    min="0"
                    className="w-full pl-7 pr-2 py-2.5 text-center text-base font-bold border-2 border-indigo-200 dark:border-indigo-700 rounded-xl focus:border-indigo-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="50000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-1.5 uppercase tracking-wide">Cant. Productos</label>
                <input
                  type="number"
                  value={calculadoraValues.manoDeObra.cantidad || ''}
                  onChange={(e) => updateCalculadora('manoDeObra', 'cantidad', e.target.value)}
                  min="1"
                  className="w-full px-2 py-2.5 text-center text-base font-bold border-2 border-indigo-200 dark:border-indigo-700 rounded-xl focus:border-indigo-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="100"
                />
              </div>
            </div>
            <div className="flex items-center justify-between bg-indigo-600 rounded-xl px-4 py-2.5">
              <span className="text-xs text-indigo-200 font-medium">Por producto</span>
              <span className="text-xl font-black text-white">{formatCurrency(manoDeObra)}</span>
            </div>
          </div>
        </motion.div>

        {/* Calculadora Costos Indirectos */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="border-2 border-purple-200 dark:border-purple-800 rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-4 py-3 bg-purple-50 dark:bg-purple-950/60">
            <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-purple-900 dark:text-purple-200">Costos Indirectos</p>
              <p className="text-[11px] text-purple-600/70 dark:text-purple-400/70">Luz, gas, agua, arriendo, etc.</p>
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-800/50">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-400 mb-1.5 uppercase tracking-wide">Costo Total {currency.symbol}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-bold text-sm">{currency.symbol}</span>
                  <input
                    type="number"
                    value={calculadoraValues.costosIndirectos.total || ''}
                    onChange={(e) => updateCalculadora('costosIndirectos', 'total', e.target.value)}
                    min="0"
                    className="w-full pl-7 pr-2 py-2.5 text-center text-base font-bold border-2 border-purple-200 dark:border-purple-700 rounded-xl focus:border-purple-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="20000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-400 mb-1.5 uppercase tracking-wide">Cant. Productos</label>
                <input
                  type="number"
                  value={calculadoraValues.costosIndirectos.cantidad || ''}
                  onChange={(e) => updateCalculadora('costosIndirectos', 'cantidad', e.target.value)}
                  min="1"
                  className="w-full px-2 py-2.5 text-center text-base font-bold border-2 border-purple-200 dark:border-purple-700 rounded-xl focus:border-purple-500 outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="100"
                />
              </div>
            </div>
            <div className="flex items-center justify-between bg-purple-600 rounded-xl px-4 py-2.5">
              <span className="text-xs text-purple-200 font-medium">Por producto</span>
              <span className="text-xl font-black text-white">{formatCurrency(costosIndirectos)}</span>
            </div>
          </div>
        </motion.div>

        {/* Resumen Total */}
        {totalExtras > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between bg-gray-900 dark:bg-slate-950 rounded-2xl px-4 py-3"
          >
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Total costos adicionales</p>
              <div className="flex gap-3 mt-0.5 text-[11px] text-gray-500 dark:text-slate-400">
                <span>MdO: {formatCurrency(manoDeObra)}</span>
                <span>·</span>
                <span>Ind: {formatCurrency(costosIndirectos)}</span>
              </div>
            </div>
            <p className="text-2xl font-black text-white">{formatCurrency(totalExtras)}</p>
          </motion.div>
        ) : (
          <div className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
            <span className="text-xl">💡</span>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Si no tenés costos adicionales, podés saltarte este paso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const Paso4Division = ({
  seDivide,
  setSeDivide,
  cantidadDivisiones,
  setCantidadDivisiones,
  tipoDivision,
  setTipoDivision,
  unidadDivision,
  setUnidadDivision,
  costoTotal,
  formatPrice
}) => {
  const formatCurrency = formatPrice;

  // Opciones de tipo de división
  const tiposDivision = [
    { value: 'porciones', label: 'Porciones/Trozos', unidad: 'porción', icon: '🍰', ejemplo: 'torta de 8 porciones' },
    { value: 'unidades', label: 'Unidades', unidad: 'unidad', icon: '📦', ejemplo: 'bandeja de 12 empanadas' },
    { value: 'peso_g', label: 'Peso en gramos', unidad: 'g', icon: '⚖️', ejemplo: 'dividir en paquetes de 100g' },
    { value: 'peso_kg', label: 'Peso en kilogramos', unidad: 'kg', icon: '⚖️', ejemplo: 'dividir en paquetes de 1kg' },
    { value: 'volumen_ml', label: 'Volumen en ml', unidad: 'ml', icon: '🥤', ejemplo: 'dividir en porciones de 250ml' },
    { value: 'volumen_L', label: 'Volumen en litros', unidad: 'L', icon: '🥤', ejemplo: 'dividir en botellas de 1L' },
  ];

  // Actualizar unidad cuando cambia el tipo
  const handleTipoDivisionChange = (tipo) => {
    setTipoDivision(tipo);
    const tipoSeleccionado = tiposDivision.find(t => t.value === tipo);
    if (tipoSeleccionado) {
      setUnidadDivision(tipoSeleccionado.unidad);
    }
  };

  // Calcular precio por división
  const precioPorDivision = cantidadDivisiones > 0 ? costoTotal / parseFloat(cantidadDivisiones) : 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">División del Producto</h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">¿Este producto se divide en porciones o unidades más pequeñas?</p>
      </div>

      {/* Toggle principal */}
      <button
        onClick={() => { setSeDivide(!seDivide); if (seDivide) setCantidadDivisiones(''); }}
        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all mb-4 text-left ${
          seDivide
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50'
            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
        }`}
      >
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          seDivide ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-slate-500'
        }`}>
          {seDivide && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold transition-colors ${seDivide ? 'text-indigo-900 dark:text-indigo-200' : 'text-gray-900 dark:text-white'}`}>
            ✂️ Sí, este producto se divide
          </p>
          <p className={`text-xs mt-0.5 ${seDivide ? 'text-indigo-700/70 dark:text-indigo-400/70' : 'text-gray-500 dark:text-slate-400'}`}>
            Calcula el costo por porción, trozo o unidad individual
          </p>
        </div>
      </button>

      <AnimatePresence>
        {seDivide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Tipos — scroll horizontal en móvil */}
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2.5">¿Cómo se divide?</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {tiposDivision.map((tipo) => {
                  const sel = tipoDivision === tipo.value;
                  return (
                    <motion.button
                      key={tipo.value}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTipoDivisionChange(tipo.value)}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 px-3.5 py-3 rounded-xl border-2 transition-all min-w-[90px] ${
                        sel
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <span className="text-xl">{tipo.icon}</span>
                      <span className={`text-[11px] font-bold text-center leading-tight ${sel ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-slate-300'}`}>
                        {tipo.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 px-1">
                Ej: {tiposDivision.find(t => t.value === tipoDivision)?.ejemplo}
              </p>
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm font-bold text-gray-800 dark:text-slate-200 mb-2">
                ¿En cuánto se divide?
              </label>
              <input
                type="number"
                value={cantidadDivisiones}
                onChange={(e) => setCantidadDivisiones(e.target.value)}
                min="1"
                step={tipoDivision.includes('peso') || tipoDivision.includes('volumen') ? '0.01' : '1'}
                className="w-full px-4 py-3.5 border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:border-indigo-500 outline-none text-2xl font-black text-center"
                placeholder={tipoDivision === 'porciones' ? '8' : tipoDivision === 'unidades' ? '12' : '100'}
              />
            </div>

            {/* Preview compacto */}
            {cantidadDivisiones > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl"
              >
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Costo por {unidadDivision}</p>
                  <p className="text-[11px] text-emerald-600/60 dark:text-emerald-500/60 mt-0.5">{formatCurrency(costoTotal)} ÷ {cantidadDivisiones}</p>
                </div>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(precioPorDivision)}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!seDivide && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800/60 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
          <span className="text-2xl">📦</span>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            El precio final mostrará el costo del producto completo.
          </p>
        </div>
      )}
    </div>
  );
};

const Paso5PrecioFinal = ({ costoTotal, utilidadDeseada, setUtilidadDeseada, seDivide, cantidadDivisiones, unidadDivision, formatPrice, currency }) => {
  const formatCurrency = formatPrice;
  const stepPrecio = currency.decimals > 0 ? '0.01' : '100';

  const [modo, setModo] = useState('precio'); // 'precio' o 'margen'
  const [precioVentaInput, setPrecioVentaInput] = useState('');
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState('recomendado');

  const handleSelectScenario = (scenarioId, utilidad) => {
    setEscenarioSeleccionado(scenarioId);
    setUtilidadDeseada(utilidad);
    setModo('margen');
  };

  // Cuando cambia el precio de venta manualmente, calcular el margen
  const handlePrecioVentaChange = (value) => {
    setPrecioVentaInput(value);
    const precio = parseFloat(value) || 0;
    if (costoTotal > 0 && precio > 0) {
      const costoRef = seDivide && cantidadDivisiones > 0 ? costoTotal / parseFloat(cantidadDivisiones) : costoTotal;
      const margen = ((precio - costoRef) / costoRef) * 100;
      setUtilidadDeseada(Math.round(margen * 10) / 10);
    }
  };

  // Calcular precios considerando división
  const precioVentaCompleto = costoTotal * (1 + utilidadDeseada / 100);
  const costoPorDivision = seDivide && cantidadDivisiones > 0 ? costoTotal / parseFloat(cantidadDivisiones) : costoTotal;
  const precioVentaPorDivision = seDivide && cantidadDivisiones > 0 ? precioVentaCompleto / parseFloat(cantidadDivisiones) : precioVentaCompleto;
  const ganancia = (seDivide ? precioVentaPorDivision : precioVentaCompleto) - (seDivide ? costoPorDivision : costoTotal);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Precio Final</h2>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">Definí tu precio de venta</p>
      </div>

      {/* Costo base — compacto */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 dark:bg-slate-950 rounded-2xl">
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">
            {seDivide ? `Costo total (${cantidadDivisiones} ${unidadDivision}s)` : 'Costo total del producto'}
          </p>
          {seDivide && cantidadDivisiones > 0 && (
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Por {unidadDivision}: {formatCurrency(costoPorDivision)}</p>
          )}
        </div>
        <p className="text-xl font-black text-white">{formatCurrency(costoTotal)}</p>
      </div>

      {/* Toggle modo */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setModo('precio')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            modo === 'precio'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-slate-400'
          }`}
        >
          Precio de venta
        </button>
        <button
          onClick={() => setModo('margen')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            modo === 'margen'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-slate-400'
          }`}
        >
          % de margen
        </button>
      </div>

      {modo === 'precio' ? (
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
            {seDivide ? `¿En cuánto vendés cada ${unidadDivision}?` : '¿En cuánto vendés este producto?'}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 font-bold text-lg">{currency.symbol}</span>
            <input
              type="number"
              value={precioVentaInput}
              onChange={(e) => handlePrecioVentaChange(e.target.value)}
              placeholder="Ej: 5990"
              min="0"
              step={stepPrecio}
              className="w-full pl-9 pr-4 py-3.5 border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-xl focus:border-indigo-500 outline-none text-2xl font-black"
            />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5">Ingresá el precio y calculamos el margen automáticamente</p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
            Margen de utilidad (%)
          </label>
          <input
            type="number"
            value={utilidadDeseada}
            onChange={(e) => setUtilidadDeseada(parseFloat(e.target.value) || 0)}
            min="0"
            step="1"
            className="w-full px-4 py-3.5 border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-xl focus:border-indigo-500 outline-none text-2xl font-black text-center"
          />
        </div>
      )}

      {/* Precio de venta resultante — card principal */}
      <motion.div
        animate={{ scale: [1, 1.01, 1] }}
        transition={{ duration: 0.3 }}
        key={seDivide ? precioVentaPorDivision : precioVentaCompleto}
        className="p-5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl text-white shadow-xl"
      >
        <p className="text-xs font-semibold opacity-80 mb-1">
          Precio de Venta {seDivide ? `(por ${unidadDivision})` : ''}
        </p>
        <p className="text-4xl sm:text-5xl font-black leading-none mb-3">
          {formatCurrency(seDivide ? precioVentaPorDivision : precioVentaCompleto)}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium opacity-90">
          <span>Costo {formatCurrency(seDivide ? costoPorDivision : costoTotal)}</span>
          <span>·</span>
          <span className={ganancia >= 0 ? 'text-emerald-100' : 'text-red-200 font-bold'}>
            Ganancia {formatCurrency(ganancia)}
          </span>
          <span>·</span>
          <span>Margen {Math.round(utilidadDeseada)}%</span>
        </div>
        {seDivide && cantidadDivisiones > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
            <span className="text-xs opacity-70">Producto completo ({cantidadDivisiones} {unidadDivision}s)</span>
            <span className="text-lg font-bold">{formatCurrency(precioVentaCompleto)}</span>
          </div>
        )}
      </motion.div>

      {/* Escenarios de precio */}
      <PriceScenarios
        costoTotal={costoTotal}
        onSelectScenario={handleSelectScenario}
        selectedScenario={escenarioSeleccionado}
        formatPrice={formatPrice}
      />
    </div>
  );
};

export default ProductCostingWizardV2;
