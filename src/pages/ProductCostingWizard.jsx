// src/pages/ProductCostingWizard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Plus, Trash2, Calculator, Package, DollarSign, TrendingUp, Save, ArrowLeft, Check, ShoppingCart, FileText, Scissors, PieChart, Search, X, Edit2, Sparkles, Coffee } from 'lucide-react';
import { db } from '../firebase/firebase.js';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';

// Importar componentes nuevos
import CostingPreview from '../components/costing/CostingPreview';
import StepHelpButton from '../components/costing/StepHelpButton';

const ProductCostingWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);

  // Estados para el buscador
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Estados para notificaciones
  const [savedProductInfo, setSavedProductInfo] = useState(null);

  // NUEVO: Estados para múltiples insumos
  const [insumos, setInsumos] = useState([]);
  const [editingInsumo, setEditingInsumo] = useState(null);

  // Estado para plantilla seleccionada
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('personalizado');

  // Plantillas predefinidas por tipo de negocio
  const PLANTILLAS = {
    bar: {
      nombre: "🍹 Bar / Coctelería",
      icon: "🍹",
      extras: [
        { id: 1, nombre: "Copa/Vaso", valor: 500 },
        { id: 2, nombre: "Hielo", valor: 200 },
        { id: 3, nombre: "Decoración (limón, cereza)", valor: 300 },
        { id: 4, nombre: "Pitillo/Servilleta", valor: 100 }
      ],
      manoDeObra: 800,
      utilidad: 150
    },
    restaurante: {
      nombre: "🍽️ Restaurante",
      icon: "🍽️",
      extras: [
        { id: 1, nombre: "Plato/Envase", valor: 800 },
        { id: 2, nombre: "Guarniciones", valor: 1200 },
        { id: 3, nombre: "Condimentos/Salsas", valor: 300 }
      ],
      manoDeObra: 2000,
      utilidad: 200
    },
    cafeteria: {
      nombre: "☕ Cafetería",
      icon: "☕",
      extras: [
        { id: 1, nombre: "Vaso/Taza", valor: 600 },
        { id: 2, nombre: "Tapa", valor: 200 },
        { id: 3, nombre: "Agitador/Servilleta", valor: 100 }
      ],
      manoDeObra: 1000,
      utilidad: 200
    },
    panaderia: {
      nombre: "🥐 Panadería",
      icon: "🥐",
      extras: [
        { id: 1, nombre: "Empaque/Bolsa", valor: 300 },
        { id: 2, nombre: "Etiqueta", valor: 100 }
      ],
      manoDeObra: 500,
      utilidad: 180
    },
    personalizado: {
      nombre: "⚙️ Personalizado",
      icon: "⚙️",
      extras: [],
      manoDeObra: 0,
      utilidad: 150
    }
  };

  const [productData, setProductData] = useState({
    nombre: '',
    cantidad: 1,
    unidad: 'unidades',
    // Nuevos campos simplificados para costos
    extras: [], // Array de { nombre, valor }
    manoDeObra: 0,
    utilidad: 150,
    utilidadTipo: 'porcentaje',
    iva: 19,
    fecha: new Date().toISOString().split('T')[0],
    // Campos para porciones
    seDividePorPorciones: null,
    numeroPorciones: 1,
    tipoPortionado: 'manual',
    pesoPorcion: 0,
    unidadPesoPortionado: 'g',
    // Costos fijos/indirectos
    costosIndirectos: {
      agua: 0,
      luz: 0,
      gas: 0,
      arriendo: 0
    }
  });

  // Estado para descontar del inventario
  const [descontarInventario, setDescontarInventario] = useState(false);

  // Estado para calculadora de costos indirectos
  const [showCalculadoraIndirectos, setShowCalculadoraIndirectos] = useState(false);
  const [calculadoraValues, setCalculadoraValues] = useState({
    aguaMensual: '',
    luzMensual: '',
    gasMensual: '',
    arriendoMensual: '',
    sueldosMensual: '',
    productosAlMes: ''
  });

  const [costoFinal, setCostoFinal] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const unidades = ['unidades', 'ml', 'g', 'kg', 'litros', 'paquetes'];
  // Ahora todas las unidades pueden usarse para portionar
  const unidadesPorcion = ['unidades', 'ml', 'g', 'kg', 'litros', 'paquetes'];

  // ===== Helpers numéricos seguros =====
  const toNum = (v) => Number(String(v).toString().replace(',', '.')) || 0;

  // ===== Helper para conversiones de unidades =====
  const CONVERSIONES = {
    // Conversiones de volumen
    ml: { ml: 1, l: 1000, oz: 29.5735 },
    l: { ml: 0.001, l: 1, oz: 0.0295735 },
    oz: { ml: 0.033814, l: 33.814, oz: 1 },
    // Conversiones de peso
    gr: { gr: 1, kg: 1000, lb: 453.592 },
    kg: { gr: 0.001, kg: 1, lb: 0.453592 },
    lb: { gr: 0.00220462, kg: 2.20462, lb: 1 }
  };

  // Calcular costo unitario basado en la presentación y unidad de trabajo
  const calcularCostoConvertido = (insumo) => {
    if (!insumo.presentation) {
      return insumo.costoUnitario;
    }

    // Si está usando la unidad de inventario (botella, bolsa, etc), usar costo directo
    if (insumo.unidadTrabajo === insumo.unidad) {
      return insumo.costoUnitario;
    }

    // Calcular costo por unidad de presentación
    const costoPorUnidadPresentacion = insumo.costoUnitario / insumo.presentation.qty;

    // Si la unidad de trabajo es la misma que la de presentación, retornar directo
    if (insumo.unidadTrabajo === insumo.presentation.unit) {
      return costoPorUnidadPresentacion;
    }

    // Si hay conversión entre unidades (ej: ml a oz)
    const unidadPres = insumo.presentation.unit;
    const unidadTrab = insumo.unidadTrabajo;

    if (CONVERSIONES[unidadPres] && CONVERSIONES[unidadPres][unidadTrab]) {
      const factor = CONVERSIONES[unidadPres][unidadTrab];
      return costoPorUnidadPresentacion * factor;
    }

    // Si no hay conversión disponible, retornar el costo de presentación
    return costoPorUnidadPresentacion;
  };

  // ===== Filtrado de productos para el buscador =====
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return insumosDisponibles.slice(0, 10);

    const query = searchQuery.toLowerCase().trim();
    return insumosDisponibles.filter(producto => {
      return (
        producto.nombre.toLowerCase().includes(query) ||
        (producto.sku && producto.sku.toLowerCase().includes(query)) ||
        (producto.categoria && producto.categoria.toLowerCase().includes(query))
      );
    }).slice(0, 10);
  }, [searchQuery, insumosDisponibles]);

  // ===== Métodos para gestión de insumos =====
  const agregarInsumoDesdeInventario = (producto) => {
    const nuevoInsumo = {
      id: Date.now().toString(),
      tipo: 'inventario',
      productoInventarioId: producto.id,
      nombre: producto.nombre,
      sku: producto.sku,
      cantidadUsada: 1,
      unidad: producto.unidad,
      costoUnitario: producto.costoUnitario,
      stockDisponible: producto.stock,
      subtotal: producto.costoUnitario * 1
    };
    setInsumos([...insumos, nuevoInsumo]);
    setSearchQuery('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const agregarInsumoManual = (datos) => {
    const nuevoInsumo = {
      id: Date.now().toString(),
      tipo: 'manual',
      productoInventarioId: null,
      nombre: datos.nombre,
      sku: '', // Sin SKU en la nueva versión
      cantidadUsada: toNum(datos.cantidadUsada),
      unidad: datos.unidad,
      costoUnitario: toNum(datos.costoUnitario),
      stockDisponible: 0,
      subtotal: toNum(datos.cantidadUsada) * toNum(datos.costoUnitario)
    };
    setInsumos([...insumos, nuevoInsumo]);
    setEditingInsumo(null);
  };

  const actualizarInsumo = (id, campo, valor) => {
    setInsumos(insumos.map(insumo => {
      if (insumo.id === id) {
        const updated = { ...insumo, [campo]: valor };

        // Recalcular subtotal: cantidad × costo unitario
        if (campo === 'cantidadUsada') {
          updated.subtotal = toNum(valor) * toNum(updated.costoUnitario);
        }

        // Si cambia el costo unitario, recalcular subtotal
        if (campo === 'costoUnitario') {
          updated.subtotal = toNum(updated.cantidadUsada) * toNum(valor);
        }

        return updated;
      }
      return insumo;
    }));
  };

  const eliminarInsumo = (id) => {
    setInsumos(insumos.filter(insumo => insumo.id !== id));
  };

  // Aplicar plantilla seleccionada
  const aplicarPlantilla = (key) => {
    const plantilla = PLANTILLAS[key];
    setPlantillaSeleccionada(key);
    setProductData({
      ...productData,
      extras: plantilla.extras.map(e => ({ ...e })), // Clonar array
      manoDeObra: plantilla.manoDeObra,
      utilidad: plantilla.utilidad
    });

    // Hacer scroll automático a la sección de especificaciones
    setTimeout(() => {
      const especificacionesElement = document.getElementById('especificaciones-seccion');
      if (especificacionesElement) {
        especificacionesElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Agregar/eliminar extras
  const agregarExtra = () => {
    setProductData({
      ...productData,
      extras: [...productData.extras, { id: Date.now(), nombre: '', valor: 0 }]
    });
  };

  const actualizarExtra = (id, campo, valor) => {
    setProductData({
      ...productData,
      extras: productData.extras.map(extra =>
        extra.id === id ? { ...extra, [campo]: valor } : extra
      )
    });
  };

  const eliminarExtra = (id) => {
    setProductData({
      ...productData,
      extras: productData.extras.filter(extra => extra.id !== id)
    });
  };

  // Calcular costo base total de todos los insumos
  const costoBaseTotal = useMemo(() => {
    return insumos.reduce((acc, insumo) => acc + toNum(insumo.subtotal), 0);
  }, [insumos]);

  // ===== Métodos para el buscador =====
  const handleProductSelect = (producto) => {
    agregarInsumoDesdeInventario(producto);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredProducts.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredProducts.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredProducts.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredProducts.length) {
          handleProductSelect(filteredProducts[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // ===== Cargar companyId y productos del inventario desde Firestore =====
  useEffect(() => {
    (async () => {
      try {
        const cid = await getUserCompanyId();
        if (!cid) {
          console.error('No se pudo obtener companyId');
          return;
        }
        setCompanyId(cid);

        const qy = query(collection(db, `companies/${cid}/inventory`), orderBy('name', 'asc'));
        const snap = await getDocs(qy);
        const rows = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            nombre: data.name ?? '',
            sku: data.sku ?? '',
            unidad: data.unit ?? 'unidades',
            costoUnitario: toNum(data.ppp),
            stock: toNum(data.stock),
            categoria: data.category ?? '',
            warehouseId: data.warehouseId ?? '',
            proveedor: data.provider ?? '',
            // NUEVO: Sistema de presentaciones múltiples
            presentations: data.presentations || [] // Array de {id, name, factor}
          };
        });
        setInsumosDisponibles(rows);
      } catch (err) {
        console.error('Error leyendo productos del inventario:', err);
      }
    })();
  }, []);

  // ===== Recalcular costos =====
  useEffect(() => {
    calcularCostos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productData, costoBaseTotal]);


  // ===== CÁLCULOS PARA PORCIONES =====
  const calcularPorciones = () => {
    if (!productData.seDividePorPorciones) {
      return { numeroPorciones: 1, esAutomatico: false };
    }

    if (productData.tipoPortionado === 'automatico') {
      const cantidadTotal = toNum(productData.cantidad);
      const cantidadPorPorcion = toNum(productData.pesoPorcion);

      if (cantidadPorPorcion > 0) {
        let totalEnUnidadBase = cantidadTotal;
        let porcionEnUnidadBase = cantidadPorPorcion;

        // Convertir a unidad base según el tipo
        // kg -> g, litros -> ml
        const convertirAUnidadBase = (valor, unidad) => {
          if (unidad === 'kg') return valor * 1000; // kg a g
          if (unidad === 'litros') return valor * 1000; // litros a ml
          return valor; // g, ml, unidades, paquetes se quedan igual
        };

        totalEnUnidadBase = convertirAUnidadBase(cantidadTotal, productData.unidad);
        porcionEnUnidadBase = convertirAUnidadBase(cantidadPorPorcion, productData.unidadPesoPortionado);

        const porciones = Math.floor(totalEnUnidadBase / porcionEnUnidadBase);
        return { numeroPorciones: Math.max(1, porciones), esAutomatico: true };
      }
    }

    return {
      numeroPorciones: Math.max(1, toNum(productData.numeroPorciones)),
      esAutomatico: false
    };
  };

  const { numeroPorciones, esAutomatico } = calcularPorciones();

  // ===== Función para calcular costos indirectos desde valores mensuales =====
  const calcularCostosIndirectos = () => {
    const productosAlMes = toNum(calculadoraValues.productosAlMes);

    if (productosAlMes <= 0) {
      alert('Debes ingresar cuántos productos haces al mes');
      return;
    }

    const aguaPorProducto = toNum(calculadoraValues.aguaMensual) / productosAlMes;
    const luzPorProducto = toNum(calculadoraValues.luzMensual) / productosAlMes;
    const gasPorProducto = toNum(calculadoraValues.gasMensual) / productosAlMes;
    const arriendoPorProducto = toNum(calculadoraValues.arriendoMensual) / productosAlMes;
    const sueldosPorProducto = toNum(calculadoraValues.sueldosMensual) / productosAlMes;

    // Actualizar los valores en productData (sueldos va a manoDeObra)
    setProductData({
      ...productData,
      manoDeObra: Math.round(sueldosPorProducto),
      costosIndirectos: {
        agua: Math.round(aguaPorProducto),
        luz: Math.round(luzPorProducto),
        gas: Math.round(gasPorProducto),
        arriendo: Math.round(arriendoPorProducto)
      }
    });

    // Cerrar el modal
    setShowCalculadoraIndirectos(false);
  };

  const calcularCostos = () => {
    const base = costoBaseTotal; // Costo base de todos los insumos

    // Calcular total de extras
    const totalExtras = productData.extras.reduce((sum, extra) => sum + toNum(extra.valor), 0);
    const manoDeObra = toNum(productData.manoDeObra);

    // Calcular total de costos indirectos/fijos
    const totalCostosIndirectos = toNum(productData.costosIndirectos.agua) +
      toNum(productData.costosIndirectos.luz) +
      toNum(productData.costosIndirectos.gas) +
      toNum(productData.costosIndirectos.arriendo);

    // Costo total = base + extras + mano de obra + costos indirectos
    const costoTotal = base + totalExtras + manoDeObra + totalCostosIndirectos;

    // Calcular utilidad
    const getCostoAdicional = (valor, tipo, baseRef) => {
      const v = toNum(valor);
      return tipo === 'porcentaje' ? (v / 100) * baseRef : v;
    };

    const utilidadMonto = getCostoAdicional(productData.utilidad, productData.utilidadTipo, costoTotal);
    const subtotal = costoTotal + utilidadMonto;
    const ivaMonto = (toNum(productData.iva) / 100) * subtotal;

    setCostoFinal(costoTotal);
    setPrecioVenta(subtotal + ivaMonto);
  };

  // Cálculos por porción
  const costoPorPorcion = costoFinal / numeroPorciones;
  const precioPorPorcion = precioVenta / numeroPorciones;


  // ===== Validaciones antes de guardar =====
  const validarDatos = () => {
    const errores = [];

    if (insumos.length === 0) {
      errores.push('Debes agregar al menos un insumo');
    }

    if (!productData.nombre?.trim()) {
      errores.push('El nombre del producto es requerido');
    }

    if (toNum(productData.cantidad) <= 0) {
      errores.push('La cantidad debe ser mayor a 0');
    }

    if (costoBaseTotal <= 0) {
      errores.push('El costo base debe ser mayor a 0');
    }

    if (productData.seDividePorPorciones && numeroPorciones <= 0) {
      errores.push('El número de porciones debe ser mayor a 0');
    }

    return errores;
  };

  const guardarProducto = async () => {
    try {
      setSaving(true);

      // Obtener companyId
      const companyId = await getUserCompanyId();
      if (!companyId) {
        alert('Error: No se pudo identificar la empresa del usuario');
        setSaving(false);
        return;
      }

      // Validar datos antes de guardar
      const errores = validarDatos();
      if (errores.length > 0) {
        alert('Errores encontrados:\n' + errores.join('\n'));
        return;
      }

      // Preparar los datos del producto con estructura mejorada
      const productoData = {
        // Información básica del producto
        nombre: productData.nombre.trim(),
        cantidad: toNum(productData.cantidad),
        unidad: productData.unidad,
        plantillaUsada: plantillaSeleccionada,

        // NUEVO: Insumos utilizados (receta)
        insumos: insumos.map(insumo => ({
          id: insumo.id,
          tipo: insumo.tipo,
          productoInventarioId: insumo.productoInventarioId,
          nombre: insumo.nombre,
          sku: insumo.sku,
          cantidadUsada: toNum(insumo.cantidadUsada),
          unidad: insumo.unidad,
          unidadTrabajo: insumo.unidadTrabajo || insumo.unidad, // Unidad usada en el costeo
          costoUnitario: toNum(insumo.costoUnitario),
          subtotal: toNum(insumo.subtotal),
          presentation: insumo.presentation // Info de presentación para referencia
        })),

        // Costos base
        costoBase: costoBaseTotal,

        // Extras y mano de obra (Nueva estructura simplificada)
        extras: productData.extras.map(e => ({
          nombre: e.nombre,
          valor: toNum(e.valor)
        })),
        manoDeObra: toNum(productData.manoDeObra),

        // Costos indirectos/fijos
        costosIndirectos: {
          agua: toNum(productData.costosIndirectos.agua),
          luz: toNum(productData.costosIndirectos.luz),
          gas: toNum(productData.costosIndirectos.gas),
          arriendo: toNum(productData.costosIndirectos.arriendo)
        },

        // Utilidad e impuestos
        utilidad: toNum(productData.utilidad),
        utilidadTipo: productData.utilidadTipo,
        iva: toNum(productData.iva),

        // Porciones
        seDividePorPorciones: !!productData.seDividePorPorciones,
        numeroPorciones,
        tipoPortionado: productData.tipoPortionado,
        pesoPorcion: productData.seDividePorPorciones ? toNum(productData.pesoPorcion) : 0,
        unidadPesoPortionado: productData.unidadPesoPortionado,

        // Precios calculados
        costoFinal: toNum(costoFinal),
        precioVenta: toNum(precioVenta),
        costoPorPorcion: toNum(costoPorPorcion),
        precioPorPorcion: toNum(precioPorPorcion),

        // Margen de ganancia
        margenPorcentaje: precioVenta > 0 ? ((precioVenta - costoFinal) / precioVenta) * 100 : 0,

        // Metadatos
        activo: true,
        fecha: productData.fecha || new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        // Información adicional para reportes
        version: '3.0', // Nueva versión con plantillas y estructura simplificada
        calculadoAutomaticamente: productData.tipoPortionado === 'automatico'
      };

      console.log('Guardando producto:', productoData);

      // Guardar en Firestore en la colección de productos terminados
      const docRef = await addDoc(collection(db, `companies/${companyId}/productos_terminados`), productoData);

      console.log('Producto guardado con ID:', docRef.id);

      // Descontar del inventario si el toggle está activado
      if (descontarInventario) {
        console.log('Descontando insumos del inventario...');

        for (const insumo of insumos) {
          // Solo descontar si es del inventario (no manual)
          if (insumo.tipo === 'inventario' && insumo.productoInventarioId) {
            try {
              const inventarioRef = doc(db, `companies/${companyId}/inventory`, insumo.productoInventarioId);
              const inventarioSnap = await getDoc(inventarioRef);

              if (inventarioSnap.exists()) {
                const currentStock = toNum(inventarioSnap.data().stock || 0);
                const cantidadADescontar = toNum(insumo.cantidadUsada);

                // Calcular nuevo stock
                const nuevoStock = Math.max(0, currentStock - cantidadADescontar);

                // Actualizar el inventario
                await updateDoc(inventarioRef, {
                  stock: nuevoStock,
                  updatedAt: serverTimestamp()
                });

                console.log(`Descontado ${cantidadADescontar} ${insumo.unidad} de ${insumo.nombre}. Stock anterior: ${currentStock}, nuevo stock: ${nuevoStock}`);
              } else {
                console.warn(`Producto de inventario ${insumo.productoInventarioId} no encontrado`);
              }
            } catch (err) {
              console.error(`Error al descontar insumo ${insumo.nombre}:`, err);
              // No detenemos el proceso si falla un descuento individual
            }
          }
        }
      }

      // Guardar información del producto para la notificación
      setSavedProductInfo({
        id: docRef.id,
        nombre: productData.nombre,
        precioVenta: formatCurrency(precioVenta),
        precioPorPorcion: productData.seDividePorPorciones ? formatCurrency(precioPorPorcion) : null,
        numeroPorciones: productData.seDividePorPorciones ? numeroPorciones : null
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSavedProductInfo(null);
      }, 4000);

      // Reset completo del formulario
      resetFormulario();

    } catch (err) {
      console.error('Error guardando producto:', err);

      // Mensajes de error más específicos
      let errorMessage = 'No se pudo guardar el producto.';

      if (err.code === 'permission-denied') {
        errorMessage = 'No tienes permisos para guardar productos. Verifica tu autenticación.';
      } else if (err.code === 'unavailable') {
        errorMessage = 'El servicio no está disponible temporalmente. Intenta nuevamente en unos momentos.';
      } else if (err.code === 'unauthenticated') {
        errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
      } else if (err.code === 'invalid-argument') {
        errorMessage = 'Los datos del producto no son válidos. Revisa la información ingresada.';
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }

      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // ===== Reset completo del formulario =====
  const resetFormulario = () => {
    setCurrentStep(0);

    // Limpiar datos del producto
    setProductData({
      nombre: '',
      cantidad: 1,
      unidad: 'unidades',
      extras: [],
      manoDeObra: 0,
      utilidad: 150,
      utilidadTipo: 'porcentaje',
      iva: 19,
      fecha: new Date().toISOString().split('T')[0],
      seDividePorPorciones: null,
      numeroPorciones: 1,
      tipoPortionado: 'manual',
      pesoPorcion: 0,
      unidadPesoPortionado: 'g',
      costosIndirectos: {
        agua: 0,
        luz: 0,
        gas: 0,
        arriendo: 0
      }
    });

    // Limpiar insumos
    setInsumos([]);

    // Restablecer plantilla a personalizado
    setPlantillaSeleccionada('personalizado');

    // Restablecer toggle de descuento
    setDescontarInventario(false);

    // Limpiar estados del buscador
    setSearchQuery('');
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Limpiar precios calculados
    setCostoFinal(0);
    setPrecioVenta(0);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(toNum(amount));

  // ===== ANIMACIONES FRAMER MOTION =====
  const pageVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  const pageTransition = {
    type: 'spring',
    stiffness: 260,
    damping: 20
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <motion.div
            key="step0"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="relative"
          >
            {/* Botón de ayuda contextual */}
            <StepHelpButton
              stepNumber={0}
              stepName="Información básica del producto"
              onClick={() => alert('Asistente IA próximamente - Te ayudaré a nombrar y configurar tu producto')}
            />

            <div className="text-center mb-8 sm:mb-10">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl mb-5 shadow-xl"
              >
                <Coffee className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3"
              >
                ¿Qué producto quieres costear?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-600 text-base sm:text-lg"
              >
                Agrega los insumos necesarios para tu receta
              </motion.p>
            </div>

            {/* Nombre del producto */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-6 mb-8"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-gray-900 text-lg placeholder-gray-400"
                  placeholder="Ej: Mojito Cubano, Pizza Margarita..."
                  value={productData.nombre}
                  onChange={(e) => setProductData({ ...productData, nombre: e.target.value })}
                />
              </div>

              {/* Selector de tipo de negocio / Plantilla */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Tipo de negocio
                  <span className="text-xs font-normal text-gray-500 ml-2">(Opcional - pre-configura costos típicos)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {Object.keys(PLANTILLAS).map(key => (
                    <motion.button
                      key={key}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => aplicarPlantilla(key)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        plantillaSeleccionada === key
                          ? 'border-indigo-500 bg-indigo-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-indigo-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{PLANTILLAS[key].icon}</div>
                      <div className="text-xs font-medium text-gray-700">
                        {PLANTILLAS[key].nombre.replace(/^.+ /, '')}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div id="especificaciones-seccion">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  ¿Cuántas porciones produces?
                  <span className="text-xs font-normal text-gray-500 ml-2">(Ej: 1 trago, 8 porciones, 1 torta)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="w-24 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-gray-900"
                    value={productData.cantidad}
                    onChange={(e) => setProductData({ ...productData, cantidad: e.target.value })}
                  />
                  <select
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-gray-900"
                    value={productData.unidad}
                    onChange={(e) => setProductData({ ...productData, unidad: e.target.value })}
                  >
                    <option value="unidades">unidades</option>
                    <option value="trago">trago(s)</option>
                    <option value="porción">porción/porciones</option>
                    <option value="plato">plato(s)</option>
                    <option value="vaso">vaso(s)</option>
                    <option value="taza">taza(s)</option>
                    <option value="ml">ml</option>
                    <option value="litros">litros</option>
                  </select>
                </div>
              </div>
            </motion.div>

            {/* Sección de insumos - MEJORADA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 border-2 border-indigo-100 dark:border-slate-700 mb-8 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mr-3">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Insumos de la receta</h3>
                    <p className="text-sm text-gray-600">{insumos.length} agregado{insumos.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {insumos.length > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center bg-white dark:bg-slate-700 px-4 py-2 rounded-xl shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2" />
                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(costoBaseTotal)}</span>
                  </motion.div>
                )}
              </div>

              {/* Buscador de insumos - MEJORADO */}
              <div className="relative mb-4">
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="relative"
                >
                  <input
                    type="text"
                    className="w-full px-5 py-4 pl-14 pr-12 border-2 border-indigo-200 dark:border-slate-600 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all text-gray-900 dark:text-white bg-white dark:bg-slate-700 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="🔍 Buscar en inventario..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                  />
                  <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-400" />
                  {searchQuery && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={clearSearch}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </motion.button>
                  )}
                </motion.div>

                {/* Lista de sugerencias - MEJORADA */}
                <AnimatePresence>
                  {showSuggestions && filteredProducts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 rounded-xl shadow-2xl max-h-80 overflow-y-auto"
                    >
                      {filteredProducts.map((producto, index) => (
                        <motion.button
                          key={producto.id}
                          className={`w-full px-5 py-4 text-left transition-colors border-b border-gray-100 dark:border-slate-700 last:border-b-0 ${
                            index === selectedIndex ? 'bg-indigo-50 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                          onClick={() => handleProductSelect(producto)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 mb-1">
                                {producto.nombre}
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                {producto.sku && (
                                  <div className="font-mono text-xs bg-gray-100 inline-block px-2 py-0.5 rounded">
                                    {producto.sku}
                                  </div>
                                )}
                                <div className="text-xs">Stock: {producto.stock} {producto.unidad}</div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-bold text-indigo-600 text-lg">
                                {formatCurrency(producto.costoUnitario)}
                              </div>
                              <div className="text-xs text-gray-500">PPP</div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Lista de insumos agregados - MEJORADA */}
              <AnimatePresence>
                {insumos.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Package className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-gray-500 text-sm">Aún no has agregado insumos</p>
                    <p className="text-gray-400 text-xs mt-1">Busca en el inventario o agrega uno manual</p>
                  </motion.div>
                ) : (
                  insumos.map((insumo, index) => (
                    <motion.div
                      key={insumo.id}
                      initial={{ opacity: 0, height: 0, scale: 0.8 }}
                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white rounded-xl p-5 mb-3 border-2 border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-lg mb-1">{insumo.nombre}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-1 rounded-lg font-medium ${
                              insumo.tipo === 'inventario'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {insumo.tipo === 'inventario' ? '📦 Inventario' : '✍️ Manual'}
                            </span>
                            {insumo.sku && (
                              <span className="px-2 py-1 bg-gray-100 rounded-lg text-gray-600 font-mono">
                                {insumo.sku}
                              </span>
                            )}
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => eliminarInsumo(insumo.id)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </motion.button>
                      </div>

                      {/* Grid responsive: 1 columna en mobile, 3 en desktop */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-2">Cantidad</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors text-gray-900 font-semibold"
                            value={insumo.cantidadUsada}
                            onChange={(e) => actualizarInsumo(insumo.id, 'cantidadUsada', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-2">Unidad</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-gray-900 bg-gray-50 font-semibold"
                            value={insumo.unidad}
                            disabled
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-2">Costo/{insumo.unidad}</label>
                          <input
                            type="number"
                            step="0.01"
                            className={`w-full px-3 py-2 border-2 rounded-lg focus:outline-none transition-colors text-gray-900 font-semibold ${
                              insumo.tipo === 'inventario'
                                ? 'border-gray-200 bg-gray-50'
                                : 'border-gray-200 focus:border-indigo-500'
                            }`}
                            value={insumo.costoUnitario}
                            onChange={(e) => actualizarInsumo(insumo.id, 'costoUnitario', e.target.value)}
                            disabled={insumo.tipo === 'inventario'}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t-2 border-gray-100 flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-600">Subtotal:</span>
                        <span className="text-xl font-bold text-indigo-600">{formatCurrency(insumo.subtotal)}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>

              {/* Total de insumos - MEJORADO */}
              <AnimatePresence>
                {insumos.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-6 mt-6 shadow-lg"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-indigo-200 text-sm font-medium mb-1">Costo base total</p>
                        <p className="text-3xl font-bold">{formatCurrency(costoBaseTotal)}</p>
                      </div>
                      <div className="w-14 h-14 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                        <Calculator className="w-7 h-7 text-black" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toggle para descontar del inventario */}
              <AnimatePresence>
                {insumos.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mt-6 p-5 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl shadow-sm"
                  >
                    <label className="flex items-start cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={descontarInventario}
                          onChange={(e) => setDescontarInventario(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 rounded-full peer peer-checked:bg-emerald-500 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-7 shadow-md"></div>
                      </div>
                      <div className="ml-4 flex-1">
                        <span className="font-bold text-gray-900 text-base group-hover:text-emerald-700 transition-colors flex items-center">
                          <Package className="w-5 h-5 mr-2 text-emerald-600" />
                          Descontar estos insumos del inventario
                        </span>
                        <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                          Al guardar el costeo, se descontará automáticamente la cantidad usada de cada ingrediente del inventario
                        </p>
                      </div>
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentStep(1)}
              disabled={insumos.length === 0 || !productData.nombre.trim()}
              className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-base sm:text-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg disabled:shadow-none"
            >
              <span className="hidden sm:inline">Continuar al siguiente paso</span>
              <span className="sm:hidden">Continuar</span>
              <ChevronRight className="ml-2 w-5 h-5 sm:w-6 sm:h-6" />
            </motion.button>
          </motion.div>
        );

      case 1:
        return (
          <motion.div
            key="step1"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <motion.button
              whileHover={{ x: -5 }}
              onClick={() => setCurrentStep(0)}
              className="mb-6 flex items-center text-gray-600 hover:text-gray-800 font-medium"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Volver
            </motion.button>

            <div className="text-center mb-8 sm:mb-10">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 rounded-2xl mb-5 shadow-xl"
              >
                <Scissors className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">¿Se divide en porciones?</h2>
              <p className="text-gray-600 text-base sm:text-lg px-4 sm:px-0">
                ¿Tu producto <span className="font-bold text-indigo-600">"{productData.nombre}"</span> se puede partir?
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(236, 72, 153, 0.2)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setProductData({ ...productData, seDividePorPorciones: true })}
                className={`w-full p-6 sm:p-8 border-2 rounded-2xl transition-all text-left ${
                  productData.seDividePorPorciones === true
                    ? 'border-pink-500 bg-pink-50 shadow-lg'
                    : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50'
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
                    productData.seDividePorPorciones === true ? 'bg-pink-500' : 'bg-gray-200'
                  }`}>
                    <PieChart className={`w-6 h-6 ${
                      productData.seDividePorPorciones === true ? 'text-white' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-gray-900 mb-1">Sí, se divide</h3>
                    <p className="text-sm text-gray-600">Tortas, pizzas, pasteles, bebidas, etc.</p>
                  </div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(156, 163, 175, 0.2)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setProductData({ ...productData, seDividePorPorciones: false })}
                className={`w-full p-6 sm:p-8 border-2 rounded-2xl transition-all text-left ${
                  productData.seDividePorPorciones === false
                    ? 'border-gray-800 bg-gray-100 shadow-lg'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
                    productData.seDividePorPorciones === false ? 'bg-gray-800' : 'bg-gray-200'
                  }`}>
                    <Package className={`w-6 h-6 ${
                      productData.seDividePorPorciones === false ? 'text-white' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-gray-900 mb-1">No se divide</h3>
                    <p className="text-sm text-gray-600">Producto unitario completo</p>
                  </div>
                </div>
              </motion.button>
            </div>


            {/* Configuración de porciones */}
            <AnimatePresence>
              {productData.seDividePorPorciones && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 sm:p-8 mb-8 border-2 border-pink-100"
                >
                  <h3 className="font-bold text-lg text-gray-900 mb-6">Configurar porciones</h3>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-4">¿Cómo quieres calcular las porciones?</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setProductData({ ...productData, tipoPortionado: 'manual' })}
                          className={`p-4 border-2 rounded-xl text-left transition-all ${productData.tipoPortionado === 'manual'
                              ? 'border-pink-500 bg-white shadow-md'
                              : 'border-gray-200 hover:border-pink-300'
                            }`}
                        >
                          <div className="font-semibold text-gray-900 mb-1">✋ Manual</div>
                          <div className="text-sm text-gray-600">Yo defino el número</div>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setProductData({ ...productData, tipoPortionado: 'automatico' })}
                          className={`p-4 border-2 rounded-xl text-left transition-all ${productData.tipoPortionado === 'automatico'
                              ? 'border-pink-500 bg-white shadow-md'
                              : 'border-gray-200 hover:border-pink-300'
                            }`}
                        >
                          <div className="font-semibold text-gray-900 mb-1">⚖️ Por peso</div>
                          <div className="text-sm text-gray-600">Según peso de cada porción</div>
                        </motion.button>
                      </div>
                    </div>

                    {productData.tipoPortionado === 'manual' ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <label className="block text-sm font-semibold text-gray-900 mb-3">Número de porciones</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all text-gray-900 text-lg"
                          placeholder="Ej: 8 pedazos"
                          value={productData.numeroPorciones}
                          onChange={(e) => setProductData({ ...productData, numeroPorciones: toNum(e.target.value) || 1 })}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-3">Cantidad por porción</label>
                          <input
                            type="number"
                            className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all text-gray-900 text-lg"
                            placeholder="150"
                            value={productData.pesoPorcion}
                            onChange={(e) => setProductData({ ...productData, pesoPorcion: toNum(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-3">Unidad</label>
                          <select
                            className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all text-gray-900 text-lg"
                            value={productData.unidadPesoPortionado}
                            onChange={(e) => setProductData({ ...productData, unidadPesoPortionado: e.target.value })}
                          >
                            {unidadesPorcion.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </motion.div>
                    )}

                    {productData.tipoPortionado === 'automatico' && productData.pesoPorcion > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white p-5 rounded-xl border-2 border-pink-200 shadow-md"
                      >
                        <div className="text-sm text-gray-600 mb-2">Porciones calculadas automáticamente:</div>
                        <div className="text-3xl font-bold text-pink-600">{numeroPorciones} porciones</div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(236, 72, 153, 0.3)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentStep(2)}
              disabled={productData.seDividePorPorciones === null}
              className="w-full py-5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-bold text-base sm:text-lg hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg disabled:shadow-none"
            >
              <span className="hidden sm:inline">Continuar al siguiente paso</span>
              <span className="sm:hidden">Continuar</span>
              <ChevronRight className="ml-2 w-5 h-5 sm:w-6 sm:h-6" />
            </motion.button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <motion.button
              whileHover={{ x: -5 }}
              onClick={() => setCurrentStep(1)}
              className="mb-6 flex items-center text-gray-600 hover:text-gray-800 font-medium"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Volver
            </motion.button>

            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0, rotate: 360 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl mb-5 shadow-xl"
              >
                <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Costos adicionales</h2>
              <p className="text-gray-600 text-base sm:text-lg">Agrega los extras y define tu utilidad</p>
            </div>

            {/* Mostrar información del producto seleccionado */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-indigo-100 mb-8"
            >
              <h3 className="font-bold text-lg text-gray-900 mb-3">{PLANTILLAS[plantillaSeleccionada].icon} {productData.nombre}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Costo ingredientes</div>
                  <div className="text-2xl font-bold text-indigo-600">{formatCurrency(costoBaseTotal)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Insumos usados</div>
                  <div className="text-2xl font-bold text-gray-900">{insumos.length}</div>
                </div>
              </div>
            </motion.div>

            <div className="space-y-6">
              {/* Sección de Extras */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-5 border-2 border-gray-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-bold text-gray-900">🎁 Extras (vaso, decoración, etc.)</label>
                  <button
                    type="button"
                    onClick={agregarExtra}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
                  >
                    + Agregar
                  </button>
                </div>

                {productData.extras.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No hay extras. Haz clic en "+ Agregar" para añadir.</p>
                )}

                <div className="space-y-2">
                  {productData.extras.map((extra, index) => (
                    <div key={extra.id} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej: Copa, Hielo..."
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-gray-900"
                        value={extra.nombre}
                        onChange={(e) => actualizarExtra(extra.id, 'nombre', e.target.value)}
                      />
                      <input
                        type="number"
                        step="1"
                        placeholder="$0"
                        className="w-28 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-gray-900"
                        value={extra.valor}
                        onChange={(e) => actualizarExtra(extra.id, 'valor', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => eliminarExtra(extra.id)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {productData.extras.length > 0 && (
                  <div className="mt-3 pt-3 border-t flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Total extras:</span>
                    <span className="text-sm font-bold text-indigo-600">
                      {formatCurrency(productData.extras.reduce((sum, e) => sum + toNum(e.valor), 0))}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Costos Indirectos / Fijos (incluye mano de obra) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border-2 border-orange-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-1">⚡ Costos Fijos + Mano de Obra</label>
                    <p className="text-xs text-gray-500">Agua, Luz, Gas, Arriendo, Sueldos</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCalculadoraIndirectos(true)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium transition-colors flex-shrink-0"
                  >
                    <Calculator className="w-4 h-4" />
                    Calculadora
                  </button>
                </div>
                <p className="text-xs text-gray-600">💡 Usa la calculadora para distribuir tus costos mensuales entre tus productos</p>

                {/* Resumen de valores calculados */}
                {(toNum(productData.manoDeObra) > 0 ||
                  toNum(productData.costosIndirectos.agua) + toNum(productData.costosIndirectos.luz) +
                  toNum(productData.costosIndirectos.gas) + toNum(productData.costosIndirectos.arriendo) > 0) && (
                  <div className="mt-4 p-4 bg-orange-100 rounded-lg border border-orange-200">
                    <div className="space-y-2 text-sm">
                      {toNum(productData.manoDeObra) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-700">👨‍🍳 Mano de obra:</span>
                          <span className="font-bold text-orange-700">{formatCurrency(productData.manoDeObra)}</span>
                        </div>
                      )}
                      {(toNum(productData.costosIndirectos.agua) + toNum(productData.costosIndirectos.luz) +
                        toNum(productData.costosIndirectos.gas) + toNum(productData.costosIndirectos.arriendo)) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-700">⚡ Costos indirectos:</span>
                          <span className="font-bold text-orange-700">
                            {formatCurrency(
                              toNum(productData.costosIndirectos.agua) +
                              toNum(productData.costosIndirectos.luz) +
                              toNum(productData.costosIndirectos.gas) +
                              toNum(productData.costosIndirectos.arriendo)
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Utilidad */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border-2 border-emerald-200"
              >
                <label className="block text-sm font-bold text-gray-900 mb-3">💰 Utilidad esperada</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="1"
                    className="flex-1 px-5 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all text-gray-900 text-lg font-semibold"
                    value={productData.utilidad}
                    onChange={(e) => setProductData({ ...productData, utilidad: e.target.value })}
                  />
                  <select
                    className="px-5 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all text-gray-900 font-semibold"
                    value={productData.utilidadTipo}
                    onChange={(e) => setProductData({ ...productData, utilidadTipo: e.target.value })}
                  >
                    <option value="porcentaje">%</option>
                    <option value="monto">$</option>
                  </select>
                </div>
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  {productData.utilidadTipo === 'porcentaje'
                    ? `Agregarás un ${toNum(productData.utilidad)}% sobre tus costos totales`
                    : `Agregarás ${formatCurrency(toNum(productData.utilidad))} de ganancia`
                  }
                </p>
              </motion.div>

              {/* IVA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl p-5 border-2 border-gray-200"
              >
                <label className="block text-sm font-bold text-gray-900 mb-3">🧾 IVA (%)</label>
                <input
                  type="number"
                  step="1"
                  className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-gray-900 text-lg font-semibold"
                  value={productData.iva}
                  onChange={(e) => setProductData({ ...productData, iva: e.target.value })}
                />
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(16, 185, 129, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentStep(3)}
                className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-base sm:text-lg hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center justify-center shadow-lg"
              >
                <span className="hidden sm:inline">Ver resumen final</span>
                <span className="sm:hidden">Ver resumen</span>
                <ChevronRight className="ml-2 w-5 h-5 sm:w-6 sm:h-6" />
              </motion.button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <motion.button
              whileHover={{ x: -5 }}
              onClick={() => setCurrentStep(2)}
              className="mb-6 flex items-center text-gray-600 hover:text-gray-800 font-medium"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Volver
            </motion.button>

            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0, rotate: -360 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl mb-5 shadow-xl"
              >
                <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">¡Listo! 🎉</h2>
              <p className="text-gray-600 text-base sm:text-lg">Aquí está el precio final de tu producto</p>
            </div>

            <div className="space-y-5">
              {/* Header del producto */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl"
              >
                <h3 className="text-2xl font-bold mb-2">{productData.nombre}</h3>
                <div className="flex items-center gap-4 text-gray-300">
                  <span>📦 {productData.cantidad} {productData.unidad}</span>
                  <span>•</span>
                  <span>🧪 {insumos.length} insumo(s)</span>
                </div>
              </motion.div>

              {/* SECCIÓN DE PORCIONES */}
              <AnimatePresence>
                {productData.seDividePorPorciones && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 border-2 border-pink-200 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <PieChart className="w-6 h-6 text-pink-600 mr-3" />
                        <span className="font-bold text-gray-900">División por porciones</span>
                      </div>
                      <span className="text-3xl font-bold text-pink-600">{numeroPorciones}</span>
                    </div>
                    {esAutomatico && (
                      <div className="text-sm text-gray-600 mt-2">
                        ⚖️ Calculado automáticamente: {productData.pesoPorcion}{productData.unidadPesoPortionado} por porción
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desglose de costos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md"
              >
                <h4 className="font-bold text-lg text-gray-900 mb-5 flex items-center">
                  <Calculator className="w-5 h-5 mr-2 text-indigo-600" />
                  Desglose de costos
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ingredientes:</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(costoBaseTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Extras:</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(productData.extras.reduce((sum, e) => sum + toNum(e.valor), 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mano de obra:</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(toNum(productData.manoDeObra))}
                    </span>
                  </div>
                  {(toNum(productData.costosIndirectos.agua) + toNum(productData.costosIndirectos.luz) +
                    toNum(productData.costosIndirectos.gas) + toNum(productData.costosIndirectos.arriendo)) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Costos indirectos:</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(
                          toNum(productData.costosIndirectos.agua) +
                          toNum(productData.costosIndirectos.luz) +
                          toNum(productData.costosIndirectos.gas) +
                          toNum(productData.costosIndirectos.arriendo)
                        )}
                      </span>
                    </div>
                  )}
                  <div className="border-t-2 border-gray-200 pt-3 flex justify-between">
                    <span className="text-gray-700 font-semibold">Costo total:</span>
                    <span className="font-bold text-xl text-red-600">{formatCurrency(costoFinal)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-3">
                    <span className="text-emerald-700 font-semibold">Tu ganancia ({productData.utilidad}{productData.utilidadTipo === 'porcentaje' ? '%' : ''}):</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(precioVenta - costoFinal - (toNum(productData.iva) / 100) * (precioVenta / (1 + toNum(productData.iva) / 100)))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA ({productData.iva}%):</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency((toNum(productData.iva) / 100) * (precioVenta / (1 + toNum(productData.iva) / 100)))}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* PRECIO FINAL */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-8 text-white shadow-2xl"
              >
                <div className="text-center">
                  <p className="text-emerald-100 text-sm mb-2">💵 Precio de venta sugerido</p>
                  <p className="text-6xl font-bold mb-3">{formatCurrency(precioVenta)}</p>
                  <p className="text-emerald-100 text-base">Incluye IVA • {productData.cantidad} {productData.unidad}</p>
                </div>
              </motion.div>

              {/* PRECIO POR PORCIÓN */}
              <AnimatePresence>
                {productData.seDividePorPorciones && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-8 text-white shadow-2xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
                      <div className="text-center sm:text-left">
                        <p className="text-pink-200 text-sm mb-2">🍰 Precio por porción</p>
                        <p className="text-5xl font-bold mb-1 text-white">{formatCurrency(precioPorPorcion)}</p>
                        <p className="text-pink-200 text-sm">Cada porción individual</p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-pink-200 text-sm mb-2">💸 Ganancia</p>
                        <div className="inline-block bg-white px-6 py-3 rounded-xl">
                          <p className="text-2xl font-bold text-pink-600">{formatCurrency(precioPorPorcion - costoPorPorcion)}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* TABLA COMPARATIVA */}
              <AnimatePresence>
                {productData.seDividePorPorciones && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-md"
                  >
                    <h4 className="font-bold text-lg text-gray-900 mb-5">📋 Resumen comparativo</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                        <div className="text-3xl font-bold text-blue-600 mb-1">{numeroPorciones}</div>
                        <div className="text-sm text-gray-600 font-medium">Porciones</div>
                      </div>
                      <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                        <div className="text-2xl font-bold text-purple-600 mb-1">{formatCurrency(precioPorPorcion)}</div>
                        <div className="text-sm text-gray-600 font-medium">Precio c/u</div>
                      </div>
                      <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200">
                        <div className="text-2xl font-bold text-emerald-600 mb-1">{formatCurrency(costoPorPorcion)}</div>
                        <div className="text-sm text-gray-600 font-medium">Costo c/u</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 20px 50px rgba(59, 130, 246, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              onClick={guardarProducto}
              disabled={saving}
              className="w-full mt-8 py-5 sm:py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg sm:text-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center disabled:opacity-60 shadow-2xl disabled:shadow-none"
            >
              {saving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white border-t-transparent rounded-full mr-3"
                  />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 sm:mr-3 w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="hidden sm:inline">Guardar producto</span>
                  <span className="sm:hidden">Guardar</span>
                </>
              )}
            </motion.button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-6 sm:py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Progress bar - MEJORADO */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-12"
        >
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Sistema de Costeo
            </h1>
            <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-4 py-2 rounded-full">
              Paso {currentStep + 1} de 4
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
            <motion.div
              className="h-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / 4) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>

        {/* Layout de 2 columnas: Wizard + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal: Wizard */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-6 sm:p-10 relative">
              <AnimatePresence mode="wait">
                {renderStep()}
              </AnimatePresence>
            </div>
          </div>

          {/* Columna lateral: Preview en tiempo real - Solo visible en desktop */}
          <div className="hidden lg:block">
            <CostingPreview
              costoInsumos={costoBaseTotal}
              costoExtras={productData.extras.reduce((sum, e) => sum + toNum(e.valor), 0)}
              costoManoObra={toNum(productData.manoDeObra)}
              costosIndirectos={
                toNum(productData.costosIndirectos.agua) +
                toNum(productData.costosIndirectos.luz) +
                toNum(productData.costosIndirectos.gas) +
                toNum(productData.costosIndirectos.arriendo)
              }
              costoTotal={costoFinal}
              precioVenta={precioVenta}
              utilidadPorcentaje={
                productData.utilidadTipo === 'porcentaje'
                  ? toNum(productData.utilidad)
                  : ((precioVenta - costoFinal) / costoFinal) * 100
              }
              numeroPorciones={numeroPorciones}
              precioPorPorcion={precioPorPorcion}
              nombreProducto={productData.nombre}
            />
          </div>
        </div>

        {/* Success notification - MEJORADA */}
        <AnimatePresence>
          {showSuccess && savedProductInfo && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="fixed bottom-6 sm:bottom-8 right-6 sm:right-8 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-6 rounded-2xl shadow-2xl max-w-sm border-2 border-emerald-400"
            >
              <div className="flex items-start">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="flex-shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center mr-4"
                >
                  <Check className="w-6 h-6 text-emerald-600" />
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-lg">¡Producto guardado!</p>
                    <button
                      onClick={() => { setShowSuccess(false); setSavedProductInfo(null); }}
                      className="text-emerald-100 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-emerald-50">
                      {savedProductInfo.nombre}
                    </p>
                    <div className="text-sm text-emerald-100 space-y-1">
                      <div>Precio: <span className="font-bold text-white">{savedProductInfo.precioVenta}</span></div>
                      {savedProductInfo.precioPorPorcion && (
                        <div>
                          {savedProductInfo.numeroPorciones} porciones × <span className="font-bold text-white">{savedProductInfo.precioPorPorcion}</span>
                        </div>
                      )}
                      <div className="text-xs opacity-75 mt-2 font-mono">ID: {savedProductInfo.id.slice(-8)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Calculadora de Costos Indirectos */}
        <AnimatePresence>
          {showCalculadoraIndirectos && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
              onClick={() => setShowCalculadoraIndirectos(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">Calculadora de Costos</h3>
                      <p className="text-xs text-gray-500 hidden sm:block">Costos mensuales ÷ Productos al mes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCalculadoraIndirectos(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Costos mensuales */}
                  <div className="bg-orange-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900 text-sm mb-3">💰 Costos mensuales</h4>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">💧 Agua (mensual)</label>
                      <input
                        type="number"
                        step="1"
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-gray-900"
                        value={calculadoraValues.aguaMensual}
                        onChange={(e) => setCalculadoraValues({ ...calculadoraValues, aguaMensual: e.target.value })}
                        placeholder="Ej: 50000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">💡 Luz (mensual)</label>
                      <input
                        type="number"
                        step="1"
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-gray-900"
                        value={calculadoraValues.luzMensual}
                        onChange={(e) => setCalculadoraValues({ ...calculadoraValues, luzMensual: e.target.value })}
                        placeholder="Ej: 80000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">🔥 Gas (mensual)</label>
                      <input
                        type="number"
                        step="1"
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-gray-900"
                        value={calculadoraValues.gasMensual}
                        onChange={(e) => setCalculadoraValues({ ...calculadoraValues, gasMensual: e.target.value })}
                        placeholder="Ej: 30000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">🏠 Arriendo (mensual)</label>
                      <input
                        type="number"
                        step="1"
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-gray-900"
                        value={calculadoraValues.arriendoMensual}
                        onChange={(e) => setCalculadoraValues({ ...calculadoraValues, arriendoMensual: e.target.value })}
                        placeholder="Ej: 400000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">👨‍🍳 Sueldos/Personal (mensual)</label>
                      <input
                        type="number"
                        step="1"
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-gray-900"
                        value={calculadoraValues.sueldosMensual}
                        onChange={(e) => setCalculadoraValues({ ...calculadoraValues, sueldosMensual: e.target.value })}
                        placeholder="Ej: 600000"
                      />
                    </div>
                  </div>

                  {/* Cantidad de productos */}
                  <div className="bg-blue-50 rounded-xl p-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">📊 ¿Cuántos productos de este tipo haces al mes?</label>
                    <input
                      type="number"
                      step="1"
                      className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 font-semibold text-lg"
                      value={calculadoraValues.productosAlMes}
                      onChange={(e) => setCalculadoraValues({ ...calculadoraValues, productosAlMes: e.target.value })}
                      placeholder="Ej: 1000"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Ejemplo: Si haces 1000 tragos/platos de este producto al mes
                    </p>
                  </div>

                  {/* Vista previa del resultado */}
                  {toNum(calculadoraValues.productosAlMes) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border-2 border-emerald-200"
                    >
                      <h4 className="font-semibold text-gray-900 text-sm mb-3">✨ Costo por producto</h4>
                      <div className="space-y-2 text-sm">
                        {toNum(calculadoraValues.aguaMensual) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">💧 Agua:</span>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(Math.round(toNum(calculadoraValues.aguaMensual) / toNum(calculadoraValues.productosAlMes)))}
                            </span>
                          </div>
                        )}
                        {toNum(calculadoraValues.luzMensual) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">💡 Luz:</span>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(Math.round(toNum(calculadoraValues.luzMensual) / toNum(calculadoraValues.productosAlMes)))}
                            </span>
                          </div>
                        )}
                        {toNum(calculadoraValues.gasMensual) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">🔥 Gas:</span>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(Math.round(toNum(calculadoraValues.gasMensual) / toNum(calculadoraValues.productosAlMes)))}
                            </span>
                          </div>
                        )}
                        {toNum(calculadoraValues.arriendoMensual) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">🏠 Arriendo:</span>
                            <span className="font-bold text-gray-900">
                              {formatCurrency(Math.round(toNum(calculadoraValues.arriendoMensual) / toNum(calculadoraValues.productosAlMes)))}
                            </span>
                          </div>
                        )}
                        {toNum(calculadoraValues.sueldosMensual) > 0 && (
                          <div className="flex justify-between border-t border-emerald-300 pt-2 mt-2">
                            <span className="text-gray-700 font-semibold">👨‍🍳 Mano de obra:</span>
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(Math.round(toNum(calculadoraValues.sueldosMensual) / toNum(calculadoraValues.productosAlMes)))}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={() => setShowCalculadoraIndirectos(false)}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={calcularCostosIndirectos}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg order-1 sm:order-2"
                  >
                    Aplicar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default ProductCostingWizard;
