// src/pages/PublicStore.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, Scale,
  Package, CheckCircle, Clock, Store, X, Loader,
  Camera, VideoOff, ChevronLeft, CreditCard, Banknote, AlertTriangle,
  Truck, MapPin, Bike, Landmark,
} from 'lucide-react';
import ImprovedBarcodeScanner from '../components/inventory/ImprovedBarcodeScanner';
import ProductImageCarousel from '../components/ProductImageCarousel';
import {
  collection, doc, getDoc, getDocs, addDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import { GOOGLE_MAPS_KEY } from '../config/env';
import { convertUnit } from '../utils/unitConversions';
import { PRODUCTION_BUSINESS_TYPES } from '../config/business-types';

// Carga el script de Google Maps/Places una sola vez por página, sin
// importar cuántas veces se monte/desmonte el checkout -- reutiliza la
// misma promesa si ya se pidió antes, y la cachea en window para que
// sobreviva incluso a un remount de este módulo (HMR en dev).
//
// Usa importLibrary (el loader "async" recomendado por Google) en vez de
// esperar el evento onload del script: el proyecto de Google Cloud tiene
// habilitada "Places API (New)", no la legacy -- por eso se usa
// PlaceAutocompleteElement (Web Component) en vez de la clase
// google.maps.places.Autocomplete legacy, que esta key rechaza con
// LegacyApiNotActivatedMapError.
let googleMapsPromise = null;
function loadGoogleMapsScript() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('VITE_GOOGLE_MAPS_KEY no configurada'));

  googleMapsPromise = new Promise((resolve, reject) => {
    // Bootstrap loader oficial de Google (patrón "loading=async" recomendado).
    (g => {
      let h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
      b = b[c] || (b[c] = {});
      const d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams,
        u = () => h || (h = new Promise(async (f, n) => {
          await (a = m.createElement("script"));
          e.set("libraries", [...r] + "");
          for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]);
          e.set("callback", c + ".maps." + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => h = n(Error(p + " could not load."));
          a.nonce = m.querySelector("script[nonce]")?.nonce || "";
          m.head.append(a);
        }));
      d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
    })({ key: GOOGLE_MAPS_KEY, v: "weekly", language: "es", region: "CL" });

    window.google.maps.importLibrary("places")
      .then(() => resolve(window.google))
      .catch(reject);
  });
  return googleMapsPromise;
}

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n ?? 0);

// Último pedido activo por tienda, para reengancharse al seguimiento si el
// cliente recarga la página o cierra y vuelve a abrir el navegador -- antes
// el pedido se "perdía" (volvía siempre al catálogo) aunque siguiera activo
// en Firestore, porque orderId/step solo vivían en memoria del componente.
const lastOrderKey = (companyId) => `bodestock:lastOrder:${companyId}`;
function saveLastOrder(companyId, orderId) {
  try { localStorage.setItem(lastOrderKey(companyId), orderId); } catch {}
}
function loadLastOrder(companyId) {
  try { return localStorage.getItem(lastOrderKey(companyId)); } catch { return null; }
}
function clearLastOrder(companyId) {
  try { localStorage.removeItem(lastOrderKey(companyId)); } catch {}
}

const CAT_COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
];

export default function PublicStore() {
  const { companyId, inventoryId } = useParams();

  const [company, setCompany]         = useState(null);
  const [inventoryType, setInventoryType] = useState(null);
  // Branding configurado por el negocio en InventoriesManagement.jsx
  // (logo, banner, color, mensaje de bienvenida, mostrar/ocultar stock,
  // forma de las tarjetas) -- existe hace tiempo en Firestore pero la
  // tienda pública nunca lo leía: el dueño configuraba todo esto y sus
  // clientes nunca veían el cambio, siempre la vitrina genérica azul.
  const [theme, setTheme] = useState(null);
  // Derivados de theme, usados en varios returns tempranos (checkout
  // incluido) -- deben declararse acá arriba, no junto al JSX del
  // catálogo más abajo: ese bloque corre después de los returns
  // tempranos en el orden del archivo, y un const referenciado antes de
  // su declaración revienta el componente entero con "Cannot access
  // before initialization" (bug real que tumbó la tienda en producción).
  const accent = theme?.primaryColor || '#3b82f6';
  const hasBanner = Boolean(theme?.bannerUrl);
  const [products, setProducts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [category, setCategory]       = useState('TODOS');
  const [cart, setCart]               = useState([]);
  const [clientName, setClientName]   = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  // 'pickup' (retiro en mostrador, el flujo de siempre) o 'delivery'
  // (despacho a domicilio -- necesario para negocios sin local físico,
  // como una cocina puertas adentro que solo despacha).
  // Sub-pasos DENTRO de step === 'checkout': antes era un solo formulario
  // largo (carrito + entrega + datos + pago + botón, todo apilado en una
  // pantalla). Separado en pasos para reducir la carga cognitiva por
  // pantalla -- una decisión a la vez, con una barra de progreso y el
  // resumen del pedido siempre visible y compacto arriba (mismo patrón que
  // Uber Eats/Rappi). Se reinicia a 'entrega' cada vez que se entra al
  // checkout (ver botón del carrito / "Enviar pedido" más abajo).
  const [checkoutStep, setCheckoutStep] = useState('entrega'); // 'entrega' | 'datos' | 'confirmar'
  // Scroll automático al tope al cambiar de paso del wizard -- sin esto, si
  // el cliente había bajado en "Entrega" (ej. con despacho + carrito largo),
  // el siguiente paso ("Datos") aparecía con el scroll en esa misma
  // posición, cortando el inicio del contenido nuevo. Declarado acá arriba
  // (no dentro del bloque "if (step === 'checkout')" más abajo) porque los
  // hooks no pueden vivir detrás de un return condicional.
  const checkoutScrollRef = useRef(null);
  useEffect(() => {
    checkoutScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [checkoutStep]);
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [addressApiError, setAddressApiError] = useState(false);
  const addressContainerRef = useRef(null);
  const addressAutocompleteRef = useRef(null);
  const [ordering, setOrdering]       = useState(false);
  const [orderId, setOrderId]         = useState(null);
  const [orderData, setOrderData]     = useState(null);
  const [step, setStep]               = useState('browse'); // browse | checkout | waiting | done
  const [showCamera, setShowCamera]   = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  // Toast propio de la tienda pública -- antes los avisos de validación
  // (teléfono/correo/dirección faltante, error al enviar) usaban alert()
  // nativo del navegador: un popup gris del sistema que interrumpe todo y
  // desentona totalmente con una tienda ya personalizada con marca propia.
  // El sistema de toasts del panel admin (ToastContainer/useToast en
  // components/ui/Toast.jsx) está armado para su fondo claro -- acá se
  // necesita una versión oscura, mobile-first, sin traer esa dependencia.
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);
  // id del producto recién agregado al carrito -- muestra un check breve en
  // el botón "+" de su tarjeta (reemplaza el ícono por un instante) como
  // confirmación de que la acción realmente ocurrió. Antes el único
  // feedback era el contador del carrito arriba, lejos del dedo que tocó.
  const [justAddedId, setJustAddedId] = useState(null);
  const justAddedTimerRef = useRef(null);
  // Producto con el detalle abierto (modal con fotos en grande + descripción)
  // -- antes tocar una tarjeta no hacía nada, solo el botón "+" agregaba
  // directo; sin forma de ver más fotos ni leer la descripción del producto.
  const [detailProduct, setDetailProduct] = useState(null);
  // Texto del comentario para cocina mientras se edita en el modal de
  // detalle (ej. "sin cebolla") -- vive aparte del carrito hasta que el
  // cliente realmente agrega el producto, para no escribir directo sobre un
  // item que todavía no existe en cart.
  const [detailNote, setDetailNote] = useState('');
  const [outOfStock, setOutOfStock]   = useState([]);
  // Si la tienda conectó Mercado Pago (companies/{id}.mpConnected, flag
  // público -- el cliente nunca lee el Access Token real), se ofrece pagar
  // online; si no, el flujo sigue siendo "paga en caja al retirar".
  const [payOnline, setPayOnline]     = useState(false);
  // Método elegido cuando NO se paga online (payOnline === false): efectivo
  // o tarjeta en el mostrador ('presencial', el de siempre) o transferencia
  // bancaria ('transferencia', nuevo) -- solo se ofrece esta última si la
  // tienda cargó sus datos bancarios (ver catalogTheme.bankTransferEnabled).
  const [paymentMethod, setPaymentMethod] = useState('presencial');
  const [creatingPayment, setCreatingPayment] = useState(false);
  // Si el cliente eligió pagar online y falla la creación del link de MP,
  // el pedido igual queda guardado (sigue a "paga en caja") -- pero sin
  // avisar, el cliente que esperaba ir a Mercado Pago se encontraba de
  // golpe en la pantalla de "pagar al retirar" sin entender qué pasó.
  const [paymentFailedNotice, setPaymentFailedNotice] = useState(false);
  const [companyNotFound, setCompanyNotFound] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    loadCompany();
    loadProducts();

    // Reengancharse al pedido activo si el cliente recargó la página o
    // volvió a entrar más tarde -- antes orderId/step solo vivían en
    // memoria del componente, así que un simple F5 "perdía" el pedido
    // aunque siguiera activo en Firestore (el cliente no tenía forma de
    // saber si ya iba en camino).
    const saved = loadLastOrder(companyId);
    if (saved) {
      setOrderId(saved);
      setStep('waiting');
    }
  }, [companyId, inventoryId]);

  // Autocompletado de dirección (Google Places) -- solo se activa cuando el
  // cliente elige despacho, para no cargar el script de Google si nunca lo
  // necesita (la mayoría de los pedidos son retiro en local).
  //
  // PlaceAutocompleteElement es un Web Component (Places API New): no se
  // "adjunta" a un <input> existente como la clase Autocomplete legacy, se
  // inserta como elemento propio dentro de un contenedor. Por eso acá se
  // crea a mano y se monta en addressContainerRef, en vez de usar JSX.
  useEffect(() => {
    if (deliveryMethod !== 'delivery' || !addressContainerRef.current) return;

    let cancelled = false;
    loadGoogleMapsScript()
      .then(async (google) => {
        if (cancelled || !addressContainerRef.current || addressAutocompleteRef.current) return;
        const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');
        const el = new PlaceAutocompleteElement({ includedRegionCodes: ['cl'] });
        el.style.width = '100%';
        // El widget es un Web Component con su propio shadow DOM -- se
        // tematiza vía estas CSS custom properties (documentadas por
        // Google), no con clases Tailwind normales, para que calce con el
        // resto del checkout oscuro.
        el.style.setProperty('--gmpx-color-surface', '#1a1a24');
        el.style.setProperty('--gmpx-color-on-surface', '#ffffff');
        el.style.setProperty('--gmpx-color-on-surface-variant', '#6b7280');
        el.style.setProperty('--gmpx-color-primary', '#3b82f6');
        el.style.setProperty('--gmpx-font-family', 'inherit');
        el.style.setProperty('--gmpx-font-size-base', '14px');
        addressContainerRef.current.appendChild(el);
        addressAutocompleteRef.current = el;

        el.addEventListener('gmp-select', async ({ placePrediction }) => {
          const place = placePrediction.toPlace();
          await place.fetchFields({ fields: ['formattedAddress', 'location'] });
          if (place.formattedAddress) setDeliveryAddress(place.formattedAddress);
          if (place.location) {
            setDeliveryCoords({ lat: place.location.lat(), lng: place.location.lng() });
          }
        });
      })
      .catch((e) => {
        console.warn('Google Places no disponible, se usa dirección en texto libre:', e.message);
        if (!cancelled) setAddressApiError(true);
      });

    return () => {
      cancelled = true;
      if (addressAutocompleteRef.current) {
        addressAutocompleteRef.current.remove();
        addressAutocompleteRef.current = null;
      }
    };
  }, [deliveryMethod]);

  useEffect(() => {
    if (!orderId || !companyId) return;
    const unsub = onSnapshot(
      doc(db, `companies/${companyId}/orders`, orderId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setOrderData(data);
        // El negocio aprueba el pedido desde OrdersManagement.jsx, que
        // escribe el status oficial en mayúscula ('APPROVED', ver
        // orders-service.js) -- 'listo' era el valor viejo que esta misma
        // pantalla escribía antes de que existiera esa gestión real, ya
        // no lo pone nadie.
        //
        // Para RETIRO, "aprobado" ya es el final (el cliente pasa a
        // buscarlo). Para DESPACHO, "aprobado" todavía no significa nada
        // para el cliente -- el tramo real es Aprobado → En camino →
        // Entregado, y recién "Entregado" es el final. Sin esta rama, un
        // pedido de despacho se mostraba como "¡Listo para retirar!" con
        // instrucciones de ir al mostrador, que no aplica.
        const isDelivery = data.deliveryMethod === 'delivery';
        if (!isDelivery && (data.status === 'APPROVED' || data.status === 'listo')) setStep('done');
        if (isDelivery && data.status === 'DELIVERING') setStep('delivering');
        if (isDelivery && data.status === 'DELIVERED') setStep('done');
        // Pedido rechazado/cancelado: ya no tiene sentido seguir
        // "esperando" -- se limpia el pedido guardado y vuelve al catálogo.
        if (data.status === 'REJECTED' || data.status === 'CANCELLED' || data.status === 'rechazado' || data.status === 'cancelado') {
          clearLastOrder(companyId);
          setOrderId(null);
          setOrderData(null);
          setStep('browse');
        }
      }
    );
    return () => unsub();
  }, [orderId, companyId]);

  const loadCompany = async () => {
    try {
      const snap = await getDoc(doc(db, 'companies', companyId));
      if (snap.exists()) {
        setCompany({ id: snap.id, ...snap.data() });
      } else {
        setCompanyNotFound(true);
      }
    } catch {
      setCompanyNotFound(true);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);

      // Tipo de negocio del inventario (RESTAURANT, HELADERIA, etc.) --
      // decide si el escáner de código de barras tiene sentido en esta
      // tienda. Sirve para "escanear un producto físico en el pasillo"
      // (retail/minimarket); en un negocio de comida preparada el cliente
      // nunca tiene el producto en mano antes de pedirlo, así que el botón
      // quedaba ahí sin ningún uso real.
      if (inventoryId) {
        try {
          const metaSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`));
          if (!metaSnap.empty) {
            const meta = metaSnap.docs[0].data();
            setInventoryType(meta.type || null);
            if (meta.catalogTheme) setTheme(meta.catalogTheme);
          }
        } catch {}
      }

      const path = inventoryId
        ? `companies/${companyId}/inventories/${inventoryId}/products`
        : `companies/${companyId}/inventory`;
      const snap = await getDocs(collection(db, path));

      // Mapa id -> stock de TODOS los docs del inventario (insumos incluidos,
      // aunque luego se filtren del listado público) -- lo necesita el
      // cálculo de disponibilidad de ELABORADO de abajo, que depende del
      // stock de los insumos de la receta, no de un stock propio.
      const stockById = {};
      snap.docs.forEach(d => { stockById[d.id] = d.data().stock ?? 0; });

      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Sin nombre',
          category: data.category || 'General',
          price: data.precioVenta || data.salePrice || data.price || data.ppp || 0,
          pricePerKg: data.pricePerKg || null,
          priceUnit: data.priceUnit || 'kg',
          byWeight: data.byWeight === true,
          stock: data.stock ?? 999,
          receta: data.receta || [],
          unit: data.unit || 'unidad',
          images: data.photos || (data.photoURL || data.image ? [data.photoURL || data.image] : []),
          description: data.description || '',
          productType: data.productType || 'SIMPLE',
          showInCatalog: data.showInCatalog,
          barcode: data.barcode || data.ean || null,
          sku: data.sku || null,
          code: data.code || null,
          promociones: data.promociones || [],
        };
      }).filter(p => {
        if (p.productType === 'INSUMO') return false;
        if (p.showInCatalog === false) return false;
        if (p.productType === 'ELABORADO') return p.price > 0;
        if (p.byWeight) return (p.pricePerKg || 0) > 0;
        return p.price > 0;
      });
      setProducts(list);

      // Disponibilidad: un ELABORADO se prepara al vender descontando sus
      // insumos (ver registerInventoryExit en inventory-exits-service.js),
      // nunca lleva stock propio -- queda siempre en 0 al crearlo (ver
      // ProductoElaboradoModal.jsx), así que usar su campo "stock" como
      // antes marcaba TODO plato nuevo como "Agotado" apenas se creaba, sin
      // relación con si realmente había insumos para prepararlo. Un plato
      // sin receta cargada (ingredientes no registrados) se asume siempre
      // disponible, igual que antes de este fix.
      const sinStock = list.filter(p => {
        if (p.byWeight) return false;
        if (p.productType === 'ELABORADO') {
          if (!p.receta.length) return false;
          return p.receta.some(ing => {
            const stockInsumo = stockById[ing.insumoId] ?? 0;
            // La receta puede pedir el ingrediente en una unidad distinta a
            // la del stock (ej. receta en "g", stock del insumo en "kg" --
            // ver el selector de unidad en ProductoElaboradoModal.jsx).
            // Comparar los números crudos sin convertir (250 vs 3) daba
            // falsos "sin stock" para cualquier receta en gramos con el
            // insumo guardado en kilos.
            const cantidadNecesaria = convertUnit(Number(ing.cantidad || 0), ing.unidad, ing.unidadStock || ing.unidad);
            return stockInsumo < cantidadNecesaria;
          });
        }
        return p.stock === 0;
      }).map(p => p.id);
      setOutOfStock(sinStock);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getPrecioConPromo = useCallback((item) => {
    const promos = item.promociones || [];
    if (!promos.length) return item.price;
    const mejor = [...promos]
      .filter(p => p.desde > 0 && p.precioUnitario > 0 && item.qty >= p.desde)
      .sort((a, b) => b.desde - a.desde)[0];
    return mejor ? mejor.precioUnitario : item.price;
  }, []);

  // note: comentario del cliente para la cocina (ej. "sin cebolla", "bien
  // cocido") -- opcional, por producto. Solo se aplica al CREAR el item en
  // el carrito (si ya existe y se suma +1 más, se mantiene la nota que ya
  // tenía; no tiene sentido pedir una nota distinta por unidad del mismo
  // producto en un mismo pedido).
  const addToCart = useCallback((product, note = '') => {
    if (outOfStock.includes(product.id)) return;
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (product.byWeight) return prev;
        const maxQty = product.stock > 0 ? product.stock : 999;
        if (existing.qty >= maxQty) return prev;
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        ...product,
        qty: 1,
        note: note.trim() || null,
        requestedGrams: product.byWeight ? 200 : null,
        confirmedGrams: null,
        confirmedPrice: null,
        status: product.byWeight ? 'pending_weight' : 'ready',
      }];
    });
    if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
    setJustAddedId(product.id);
    justAddedTimerRef.current = setTimeout(() => setJustAddedId(null), 900);
  }, [outOfStock]);

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const updateNote = (id, note) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, note: note.trim() || null } : i));
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const maxQty = i.stock > 0 ? i.stock : 999;
      return { ...i, qty: Math.min(maxQty, Math.max(1, i.qty + delta)) };
    }));
  };

  const updateGrams = (id, grams) => {
    setCart(prev => prev.map(i =>
      i.id === id ? { ...i, requestedGrams: Math.max(50, grams) } : i
    ));
  };

  const handleScan = useCallback((barcode) => {
    const trimmed = barcode?.trim();
    if (!trimmed) return;
    const product = products.find(p =>
      p.sku === trimmed || p.barcode === trimmed || p.code === trimmed || p.id === trimmed
    );
    if (product) {
      addToCart(product);
      if (navigator.vibrate) navigator.vibrate(100);
      setScanFeedback({ type: 'success', message: `✓ ${product.name}` });
    } else {
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      setScanFeedback({ type: 'error', message: 'Producto no encontrado' });
    }
    setTimeout(() => setScanFeedback(null), 2000);
  }, [products, addToCart]);

  const cartTotal = cart.reduce((sum, i) => {
    if (i.byWeight) return sum;
    return sum + (getPrecioConPromo(i) * i.qty);
  }, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const hasWeightItems = cart.some(i => i.byWeight);

  const finalTotal = (orderData?.items || []).reduce((sum, i) => {
    if (i.byWeight) return sum + (i.confirmedPrice || 0);
    return sum + ((i.price || 0) * (i.qty || 1));
  }, 0);

  const allWeightConfirmed = (orderData?.items || [])
    .filter(i => i.byWeight)
    .every(i => i.confirmedPrice != null);

  const goToCheckout = () => { setCheckoutStep('entrega'); setStep('checkout'); };

  const categories = ['TODOS', ...new Set(products.map(p => p.category))];
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'TODOS' || p.category === category;
    return matchSearch && matchCat;
  });

  const handleOrder = async () => {
    if (!clientPhone.trim()) {
      showToast('Ingresa tu teléfono para que podamos avisarte cuando tu pedido esté listo.');
      return;
    }
    if (!clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      showToast('Ingresa un correo válido para avisarte por email cuando tu pedido avance.');
      return;
    }
    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      showToast('Ingresa tu dirección de despacho.');
      return;
    }
    try {
      setOrdering(true);
      const items = cart.map(i => ({
        productId: i.id,
        name: i.name,
        byWeight: i.byWeight,
        qty: i.byWeight ? null : i.qty,
        note: i.note || null,
        requestedGrams: i.byWeight ? i.requestedGrams : null,
        confirmedGrams: null,
        price: i.byWeight ? null : getPrecioConPromo(i),
        pricePerKg: i.byWeight ? i.pricePerKg : null,
        confirmedPrice: null,
        status: i.byWeight ? 'pending_weight' : 'ready',
      }));
      const ref = await addDoc(
        collection(db, `companies/${companyId}/orders`),
        {
          clientName: clientName.trim() || 'Cliente',
          clientPhone: clientPhone.trim() || null,
          clientEmail: clientEmail.trim() || null,
          deliveryMethod,
          deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() : null,
          deliveryCoords: deliveryMethod === 'delivery' ? deliveryCoords : null,
          items,
          paymentMethod: payOnline ? 'mercadopago' : paymentMethod,
          status: 'pendiente',
          source: 'tienda_publica',
          inventoryId: inventoryId || null,
          subtotal: cartTotal,
          createdAt: serverTimestamp(),
        }
      );
      setOrderId(ref.id);
      saveLastOrder(companyId, ref.id);

      // Si el cliente eligió pagar online, se crea la preferencia de MP
      // (con el token DE ESTA EMPRESA, ver createStoreOrderPreference) y
      // se redirige al checkout de Mercado Pago -- el pedido ya quedó
      // guardado, así que si algo falla acá el negocio igual lo ve en
      // Pedidos y puede cobrarlo en caja.
      if (payOnline && !hasWeightItems) {
        setCreatingPayment(true);
        try {
          const resp = await fetch(FUNCTIONS_ENDPOINTS.CREATE_STORE_ORDER_PREFERENCE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId, orderId: ref.id }),
          });
          const data = await resp.json();
          if (resp.ok && data.initPoint) {
            window.location.href = data.initPoint;
            return; // el navegador se va a Mercado Pago, no sigas acá
          }
          console.error('No se pudo crear el link de pago:', data.error);
          setPaymentFailedNotice(true);
        } catch (e) {
          console.error('Error creando el link de pago:', e);
          setPaymentFailedNotice(true);
        } finally {
          setCreatingPayment(false);
        }
        // Si el pago online falló por lo que sea, el pedido ya existe:
        // seguimos al flujo normal de "paga en caja" en vez de trabarlo,
        // pero avisando (ver paymentFailedNotice en la pantalla "waiting").
      }

      setStep('waiting');
    } catch (e) {
      console.error(e);
      showToast('Error al enviar el pedido. Intenta nuevamente.');
    } finally {
      setOrdering(false);
    }
  };

  // ── TIENDA NO ENCONTRADA ──
  if (companyNotFound) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <Store className="w-12 h-12 mx-auto mb-4 text-gray-700" />
        <h2 className="text-white text-lg font-bold mb-2">Tienda no encontrada</h2>
        <p className="text-gray-500 text-sm">Este link no corresponde a ninguna tienda activa. Verifica que esté bien copiado.</p>
      </div>
    </div>
  );

  // ── LOADING ──
  // Skeleton con la forma real del catálogo (header + grid de tarjetas) en
  // vez de un spinner genérico centrado -- se siente más rápido y menos
  // "pantalla vacía" mientras carga. No puede usar el color de marca
  // (accent) porque en este punto `theme` todavía no llegó de Firestore.
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="px-4 py-3 border-b border-white/[0.05]">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] animate-pulse" />
              <div>
                <div className="h-3.5 w-28 rounded bg-white/[0.06] animate-pulse mb-1.5" />
                <div className="h-2.5 w-16 rounded bg-white/[0.04] animate-pulse" />
              </div>
            </div>
            <div className="h-9 w-20 rounded-xl bg-white/[0.06] animate-pulse" />
          </div>
          <div className="h-10 w-full rounded-xl bg-white/[0.04] animate-pulse mb-2" />
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-6 w-20 rounded-full bg-white/[0.04] animate-pulse" />
            <div className="h-6 w-14 rounded-full bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="aspect-square bg-white/[0.04] animate-pulse" />
            <div className="p-2.5 space-y-2">
              <div className="h-3 w-4/5 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-3.5 w-2/5 rounded bg-white/[0.05] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── PEDIDO LISTO ──
  if (step === 'done') return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="w-20 h-20 bg-green-500/15 rounded-3xl flex items-center justify-center mx-auto mb-5"
          animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.6 }}
        >
          <CheckCircle className="w-10 h-10 text-green-400" />
        </motion.div>
        {orderData?.deliveryMethod === 'delivery' ? (
          <>
            <h2 className="text-white text-2xl font-black mb-2">¡Pedido entregado!</h2>
            <p className="text-gray-400 text-sm mb-6">Que lo disfrutes.</p>
          </>
        ) : (
          <>
            <h2 className="text-white text-2xl font-black mb-2">¡Listo para retirar!</h2>
            <p className="text-gray-400 text-sm mb-6">Acércate al mostrador con este código.</p>
          </>
        )}
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5 mb-4">
          <p className="text-gray-500 text-xs mb-1">Código de pedido</p>
          <p className="text-white text-4xl font-black tracking-widest">{orderId?.slice(-6).toUpperCase()}</p>
        </div>
        {finalTotal > 0 && <p className="text-white text-xl font-black mb-1">Total: {CLP(finalTotal)}</p>}
        {orderData?.deliveryMethod !== 'delivery' && (
          <p className="text-gray-600 text-sm mb-6">
            {orderData?.paymentStatus === 'approved' ? 'Ya pagaste · nada que pagar al retirar' : 'Paga en caja al retirar'}
          </p>
        )}
        <button
          onClick={() => {
            clearLastOrder(companyId);
            setOrderId(null);
            setOrderData(null);
            setCart([]);
            setStep('browse');
          }}
          className="text-blue-400 hover:text-blue-300 text-sm font-semibold underline"
        >
          Hacer otro pedido
        </button>
      </motion.div>
    </div>
  );

  // ── EN CAMINO (solo despacho) ──
  if (step === 'delivering') return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="w-20 h-20 bg-indigo-500/15 rounded-3xl flex items-center justify-center mx-auto mb-5"
          animate={{ x: [-4, 4, -4] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Bike className="w-10 h-10 text-indigo-400" />
        </motion.div>
        <h2 className="text-white text-2xl font-black mb-2">Tu pedido está en camino 🚴</h2>
        <p className="text-gray-400 text-sm mb-6">
          {orderData?.deliveryAddress ? `Va para: ${orderData.deliveryAddress}` : 'Ya salió del local.'}
        </p>
        <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-5 mb-4">
          <p className="text-gray-500 text-xs mb-1">Código de pedido</p>
          <p className="text-white text-4xl font-black tracking-widest">{orderId?.slice(-6).toUpperCase()}</p>
        </div>
        {finalTotal > 0 && (
          <p className="text-gray-600 text-sm">
            {orderData?.paymentStatus === 'approved' ? 'Ya pagaste · nada que pagar al recibir' : `Paga ${CLP(finalTotal)} al repartidor`}
          </p>
        )}
      </motion.div>
    </div>
  );

  // ── ESPERANDO PREPARACIÓN ──
  if (step === 'waiting') return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
      <motion.div className="w-full max-w-md" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {paymentFailedNotice && (
          <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-xs leading-relaxed">
              No pudimos abrir Mercado Pago, pero tu pedido se guardó igual.
              {deliveryMethod === 'delivery' ? ' Paga al repartidor.' : ' Paga en caja al retirar.'}
            </p>
          </div>
        )}
        <div className="bg-[#111118] border border-white/[0.07] rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-500/15 rounded-2xl flex items-center justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                <Clock className="w-5 h-5 text-blue-400" />
              </motion.div>
            </div>
            <div>
              <p className="text-white font-bold">Pedido enviado ✅</p>
              <p className="text-gray-500 text-xs">#{orderId?.slice(-6).toUpperCase()}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-blue-400"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="text-blue-400 text-[11px] font-semibold">En preparación</span>
            </div>
          </div>

          {/* Si el dispositivo es compartido (ej. tablet del local) y quedó
              enganchado al pedido de otra persona desde una sesión previa. */}
          <button
            onClick={() => {
              clearLastOrder(companyId);
              setOrderId(null);
              setOrderData(null);
              setStep('browse');
            }}
            className="text-gray-600 hover:text-gray-400 text-[11px] underline mb-4 -mt-2"
          >
            ¿No es tu pedido? Empezar de nuevo
          </button>

          <div className="space-y-2 mb-5">
            {(orderData?.items || []).map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white/[0.03] rounded-2xl px-4 py-3 border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  {item.byWeight
                    ? <Scale className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    : <Package className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  }
                  <div>
                    <p className="text-white text-sm font-medium">{item.name}</p>
                    {item.byWeight && (
                      <p className="text-gray-500 text-xs">
                        ~{item.requestedGrams}g{item.confirmedGrams ? ` · Pesado: ${item.confirmedGrams}g` : ''}
                      </p>
                    )}
                    {!item.byWeight && <p className="text-gray-600 text-xs">x{item.qty}</p>}
                  </div>
                </div>
                <div>
                  {item.byWeight ? (
                    item.confirmedPrice != null ? (
                      <motion.span className="text-green-400 text-sm font-bold" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        {CLP(item.confirmedPrice)}
                      </motion.span>
                    ) : (
                      <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
                        <Loader className="w-3 h-3 animate-spin" /> Pesando...
                      </span>
                    )
                  ) : (
                    <span className="text-white text-sm font-bold">{CLP((item.price || 0) * (item.qty || 1))}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(!hasWeightItems || allWeightConfirmed) && finalTotal > 0 && (
            <motion.div className="pt-4 border-t border-white/[0.06]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm">{orderData?.paymentStatus === 'approved' ? 'Total pagado' : 'Total a pagar'}</span>
                <span className="text-white text-2xl font-black">{CLP(finalTotal)}</span>
              </div>
              <p className="text-gray-600 text-xs text-center">
                {orderData?.paymentStatus === 'approved'
                  ? (orderData?.deliveryMethod === 'delivery' ? 'Ya pagaste · nada que pagar al recibir' : 'Ya pagaste · nada que pagar al retirar')
                  : orderData?.paymentMethod === 'transferencia'
                    ? 'Paga por transferencia · ver datos abajo'
                    : (orderData?.deliveryMethod === 'delivery' ? 'Paga al repartidor cuando llegue' : 'Paga en caja al retirar tu pedido')}
              </p>
            </motion.div>
          )}

          {orderData?.paymentMethod === 'transferencia' && orderData?.paymentStatus !== 'approved' && (
            <div className="mt-4 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3.5 space-y-1.5">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Datos para transferir</p>
              {theme?.bankName && <p className="text-gray-300 text-xs"><span className="text-gray-500">Banco:</span> {theme.bankName}</p>}
              {theme?.bankAccountType && <p className="text-gray-300 text-xs"><span className="text-gray-500">Tipo:</span> {theme.bankAccountType}</p>}
              {theme?.bankAccountNumber && <p className="text-gray-300 text-xs"><span className="text-gray-500">N° cuenta:</span> {theme.bankAccountNumber}</p>}
              {theme?.bankAccountRut && <p className="text-gray-300 text-xs"><span className="text-gray-500">RUT:</span> {theme.bankAccountRut}</p>}
              {theme?.bankAccountHolder && <p className="text-gray-300 text-xs"><span className="text-gray-500">Titular:</span> {theme.bankAccountHolder}</p>}
              {theme?.bankAccountEmail && <p className="text-gray-300 text-xs"><span className="text-gray-500">Enviar comprobante a:</span> {theme.bankAccountEmail}</p>}
            </div>
          )}
          {hasWeightItems && !allWeightConfirmed && (
            <p className="text-amber-400/70 text-xs text-center">
              El total se mostrará cuando el empleado pese los productos
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );

  // ── CHECKOUT ──
  if (step === 'checkout') {
    const stepIndex = { entrega: 0, datos: 1, confirmar: 2 }[checkoutStep];
    const canPayOnline = company?.mpConnected && !hasWeightItems;
    const canPayByTransfer = Boolean(theme?.bankTransferEnabled);

    const goNextFromEntrega = () => {
      if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
        showToast('Ingresa tu dirección de despacho.');
        return;
      }
      setCheckoutStep('datos');
    };
    const goNextFromDatos = () => {
      if (!clientPhone.trim()) {
        showToast('Ingresa tu teléfono para que podamos avisarte cuando tu pedido esté listo.');
        return;
      }
      if (!clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
        showToast('Ingresa un correo válido para avisarte por email cuando tu pedido avance.');
        return;
      }
      setCheckoutStep('confirmar');
    };

    return (
    // h-screen (no min-h-screen): el layout es header fijo arriba + contenido
    // scrolleable en medio + botón fijo abajo. Con min-h-screen el div
    // "flex-1 overflow-y-auto" nunca queda realmente acotado a la altura de
    // la ventana -- crece con su contenido y el scroll real termina
    // ocurriendo en el document/window, no en ese div, por lo que el auto-
    // scroll-to-top al cambiar de paso (checkoutScrollRef) no hacía nada
    // (bug real encontrado al probar en vivo con contenido largo).
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header fijo: volver + barra de progreso de 3 pasos */}
      <div className="flex-shrink-0 px-4 pt-5 pb-3.5 border-b border-white/[0.06]">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3.5">
            <button
              onClick={() => checkoutStep === 'entrega' ? setStep('browse') : setCheckoutStep(checkoutStep === 'confirmar' ? 'datos' : 'entrega')}
              className="flex items-center gap-1.5 text-gray-400 text-sm hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> {checkoutStep === 'entrega' ? 'Seguir comprando' : 'Volver'}
            </button>
            <span className="text-gray-500 text-xs font-semibold">Paso {stepIndex + 1} de 3</span>
          </div>
          <div className="flex items-center gap-1.5">
            {['entrega', 'datos', 'confirmar'].map((s, i) => (
              <div
                key={s}
                className="flex-1 h-1 rounded-full transition-colors"
                style={{ background: i <= stepIndex ? accent : 'rgba(255,255,255,0.1)' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Resumen compacto del pedido, siempre visible */}
      <div className="flex-shrink-0 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}26` }}>
              <Package className="w-3.5 h-3.5" style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{cartCount} producto{cartCount !== 1 ? 's' : ''}</p>
              <p className="text-gray-500 text-[10.5px] truncate">{cart.map(i => i.name).join(', ')}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <p className="text-white text-sm font-black">{CLP(cartTotal)}</p>
            {checkoutStep === 'entrega' && (
              <button onClick={() => setStep('browse')} className="text-[10.5px] font-semibold" style={{ color: accent }}>Editar ›</button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido del paso actual */}
      <div ref={checkoutScrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto">

          {checkoutStep === 'entrega' && (
            <>
              {/* Carrito editable -- el resumen compacto de arriba no
                  permite ajustar cantidad/gramos, así que el primer paso
                  del wizard sigue siendo el lugar para hacerlo sin tener
                  que volver al catálogo completo. */}
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2.5">Tu pedido</p>
              <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-4 mb-5 space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {item.byWeight
                        ? <Scale className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        : <Package className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                      }
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.name}</p>
                        {item.note && (
                          <p className="text-gray-500 text-xs italic truncate">"{item.note}"</p>
                        )}
                        {item.byWeight ? (
                          <div className="flex items-center gap-1 mt-1">
                            <button onClick={() => updateGrams(item.id, item.requestedGrams - 50)} className="w-5 h-5 bg-white/10 rounded-md text-white text-xs flex items-center justify-center">−</button>
                            <span className="text-amber-400 text-xs font-bold w-14 text-center">~{item.requestedGrams}g</span>
                            <button onClick={() => updateGrams(item.id, item.requestedGrams + 50)} className="w-5 h-5 bg-white/10 rounded-md text-white text-xs flex items-center justify-center">+</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 mt-1">
                            <button onClick={() => item.qty === 1 ? removeFromCart(item.id) : updateQty(item.id, -1)} className="w-5 h-5 bg-white/10 rounded-md text-white flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button>
                            <span className="text-gray-300 text-xs w-6 text-center">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 bg-white/10 rounded-md text-white flex items-center justify-center"><Plus className="w-2.5 h-2.5" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-white text-sm font-bold">
                        {item.byWeight ? <span className="text-amber-400 text-xs">a pesar</span> : CLP(getPrecioConPromo(item) * item.qty)}
                      </span>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-white/[0.06] flex justify-between">
                  <span className="text-gray-400 text-sm">Subtotal{hasWeightItems ? ' (sin peso)' : ''}</span>
                  <span className="text-white font-bold">{CLP(cartTotal)}</span>
                </div>
              </div>

              {hasWeightItems && (
                <p className="text-amber-400/70 text-xs mb-4">* Los productos por peso se pesan en el mostrador</p>
              )}

              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2.5">Cómo quieres recibirlo</p>
              <div className="space-y-2 mb-5">
                <button
                  onClick={() => setDeliveryMethod('pickup')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors"
                  style={deliveryMethod === 'pickup' ? { borderColor: accent, background: `${accent}1a` } : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <Store className="w-5 h-5" style={{ color: deliveryMethod === 'pickup' ? accent : '#6b7280' }} />
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">Retiro en el local</p>
                    <p className="text-gray-500 text-xs">Pasas a buscarlo cuando esté listo</p>
                  </div>
                </button>
                <button
                  onClick={() => setDeliveryMethod('delivery')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors"
                  style={deliveryMethod === 'delivery' ? { borderColor: accent, background: `${accent}1a` } : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <Bike className="w-5 h-5" style={{ color: deliveryMethod === 'delivery' ? accent : '#6b7280' }} />
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">Despacho a domicilio</p>
                    <p className="text-gray-500 text-xs">Te lo llevamos a tu dirección</p>
                  </div>
                </button>
                {deliveryMethod === 'delivery' && (
                  <div className="pt-1">
                    {/* Contenedor del Web Component de Google Places -- se monta
                        a mano vía JS (ver useEffect), no es JSX controlado por
                        React. Se oculta si falla la carga (red, key, API no
                        habilitada) y se muestra el input de texto libre debajo. */}
                    <div ref={addressContainerRef} className={addressApiError ? 'hidden' : 'bodestock-place-autocomplete-wrap'} />
                    {addressApiError && (
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-600" />
                        <input
                          value={deliveryAddress}
                          onChange={e => { setDeliveryAddress(e.target.value); setDeliveryCoords(null); }}
                          placeholder="Dirección completa (calle, número, depto, comuna) *"
                          required
                          autoComplete="off"
                          className="w-full bg-white/[0.05] border border-white/[0.07] rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
                        />
                      </div>
                    )}
                    {deliveryAddress && (
                      <p className="text-emerald-400/80 text-xs mt-1.5 pl-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {deliveryAddress}
                      </p>
                    )}
                    {!addressApiError && !deliveryAddress && (
                      <p className="text-gray-600 text-[11px] mt-1 pl-1">Elige tu dirección de la lista para que el despacho sea más preciso.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Método de pago -- "pagar online" solo si la tienda conectó
                  Mercado Pago y el carrito no tiene productos por peso (esos
                  se cobran recién cuando se pesan en caja); "transferencia"
                  solo si la tienda cargó sus datos bancarios. Si ninguna de
                  las dos está activa, no se muestra nada acá y se asume pago
                  presencial (efectivo/tarjeta), igual que antes. */}
              {(canPayOnline || canPayByTransfer) && (
                <>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2.5">Cómo quieres pagar</p>
                  <div className="space-y-2">
                    {canPayOnline && (
                      <button
                        onClick={() => setPayOnline(true)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors"
                        style={payOnline ? { borderColor: accent, background: `${accent}1a` } : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                      >
                        <CreditCard className="w-5 h-5" style={{ color: payOnline ? accent : '#6b7280' }} />
                        <div className="text-left">
                          <p className="text-white text-sm font-semibold">Pagar ahora online</p>
                          <p className="text-gray-500 text-xs">Tarjeta o transferencia por Mercado Pago</p>
                        </div>
                      </button>
                    )}
                    <button
                      onClick={() => { setPayOnline(false); setPaymentMethod('presencial'); }}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors"
                      style={!payOnline && paymentMethod === 'presencial' ? { borderColor: accent, background: `${accent}1a` } : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                    >
                      <Banknote className="w-5 h-5" style={{ color: !payOnline && paymentMethod === 'presencial' ? accent : '#6b7280' }} />
                      <div className="text-left">
                        <p className="text-white text-sm font-semibold">Pagar al {deliveryMethod === 'delivery' ? 'entregar' : 'retirar'}</p>
                        <p className="text-gray-500 text-xs">Efectivo o tarjeta en el mostrador</p>
                      </div>
                    </button>
                    {canPayByTransfer && (
                      <button
                        onClick={() => { setPayOnline(false); setPaymentMethod('transferencia'); }}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors"
                        style={!payOnline && paymentMethod === 'transferencia' ? { borderColor: accent, background: `${accent}1a` } : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                      >
                        <Landmark className="w-5 h-5" style={{ color: !payOnline && paymentMethod === 'transferencia' ? accent : '#6b7280' }} />
                        <div className="text-left">
                          <p className="text-white text-sm font-semibold">Transferencia bancaria</p>
                          <p className="text-gray-500 text-xs">Te mostramos los datos para transferir</p>
                        </div>
                      </button>
                    )}
                  </div>

                  {!payOnline && paymentMethod === 'transferencia' && (
                    <div className="mt-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3.5 space-y-1.5">
                      {theme.bankName && <p className="text-gray-300 text-xs"><span className="text-gray-500">Banco:</span> {theme.bankName}</p>}
                      {theme.bankAccountType && <p className="text-gray-300 text-xs"><span className="text-gray-500">Tipo:</span> {theme.bankAccountType}</p>}
                      {theme.bankAccountNumber && <p className="text-gray-300 text-xs"><span className="text-gray-500">N° cuenta:</span> {theme.bankAccountNumber}</p>}
                      {theme.bankAccountRut && <p className="text-gray-300 text-xs"><span className="text-gray-500">RUT:</span> {theme.bankAccountRut}</p>}
                      {theme.bankAccountHolder && <p className="text-gray-300 text-xs"><span className="text-gray-500">Titular:</span> {theme.bankAccountHolder}</p>}
                      {theme.bankAccountEmail && <p className="text-gray-300 text-xs"><span className="text-gray-500">Enviar comprobante a:</span> {theme.bankAccountEmail}</p>}
                      <p className="text-amber-400/80 text-[11px] pt-1">Envía el comprobante para que confirmemos tu pedido.</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {checkoutStep === 'datos' && (
            <>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2.5">Tus datos</p>
              <div className="space-y-3">
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Tu nombre (opcional)"
                  className="w-full bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
                />
                <input
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  placeholder="Teléfono *"
                  type="tel"
                  required
                  className="w-full bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
                />
                <input
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="Correo *"
                  type="email"
                  required
                  className="w-full bg-white/[0.05] border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
                />
                <p className="text-gray-600 text-[11px] -mt-1">* Te avisamos por correo cuando tu pedido avance</p>
              </div>
            </>
          )}

          {checkoutStep === 'confirmar' && (
            <>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2.5">Resumen del pedido</p>
              <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-4 space-y-2.5">
                {cart.map(item => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-gray-300 text-sm truncate">
                        {item.name}{!item.byWeight && ` × ${item.qty}`}
                      </p>
                      <p className="text-white text-sm font-semibold flex-shrink-0">
                        {item.byWeight ? <span className="text-amber-400 text-xs">a pesar</span> : CLP(getPrecioConPromo(item) * item.qty)}
                      </p>
                    </div>
                    {item.note && (
                      <p className="text-gray-500 text-xs mt-0.5 italic">"{item.note}"</p>
                    )}
                  </div>
                ))}
                <div className="pt-2.5 border-t border-white/[0.06] flex items-center gap-1.5">
                  {deliveryMethod === 'delivery'
                    ? <Bike className="w-3.5 h-3.5" style={{ color: accent }} />
                    : <Store className="w-3.5 h-3.5" style={{ color: accent }} />
                  }
                  <p className="text-gray-400 text-xs truncate">
                    {deliveryMethod === 'delivery' ? `Despacho a ${deliveryAddress}` : 'Retiro en el local'}
                  </p>
                </div>
                {(canPayOnline || canPayByTransfer) && (
                  <div className="flex items-center gap-1.5">
                    {payOnline
                      ? <CreditCard className="w-3.5 h-3.5" style={{ color: accent }} />
                      : paymentMethod === 'transferencia'
                        ? <Landmark className="w-3.5 h-3.5" style={{ color: accent }} />
                        : <Banknote className="w-3.5 h-3.5" style={{ color: accent }} />
                    }
                    <p className="text-gray-400 text-xs">
                      {payOnline
                        ? 'Pago online · Mercado Pago'
                        : paymentMethod === 'transferencia'
                          ? 'Transferencia bancaria'
                          : `Pago al ${deliveryMethod === 'delivery' ? 'entregar' : 'retirar'}`}
                    </p>
                  </div>
                )}
                <div className="pt-2.5 border-t border-white/[0.06] flex justify-between items-baseline">
                  <p className="text-gray-400 text-sm">Total</p>
                  <p className="text-white text-xl font-black">{CLP(cartTotal)}</p>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Botón de acción fijo abajo */}
      <div className="flex-shrink-0 px-4 pt-3.5 pb-5 border-t border-white/[0.06]">
        <div className="max-w-md mx-auto">
          <motion.button
            onClick={checkoutStep === 'entrega' ? goNextFromEntrega : checkoutStep === 'datos' ? goNextFromDatos : handleOrder}
            disabled={ordering || creatingPayment || cart.length === 0}
            className="w-full py-4 disabled:opacity-40 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg"
            style={{ background: accent, boxShadow: `0 10px 15px -3px ${accent}40` }}
            whileTap={{ scale: 0.98 }}
          >
            {ordering || creatingPayment ? (
              <><Loader className="w-5 h-5 animate-spin" /> {creatingPayment ? 'Abriendo Mercado Pago...' : 'Enviando pedido...'}</>
            ) : checkoutStep !== 'confirmar' ? (
              <>Continuar <ChevronLeft className="w-4 h-4 rotate-180" /></>
            ) : payOnline && canPayOnline ? (
              <><CreditCard className="w-5 h-5" /> Pagar {CLP(cartTotal)}</>
            ) : (
              <><CheckCircle className="w-5 h-5" /> Enviar pedido · {CLP(cartTotal)}</>
            )}
          </motion.button>
        </div>
      </div>

      {/* Toast de validación -- reemplaza los alert() nativos del navegador
          (teléfono/correo/dirección faltante, error al enviar) por un aviso
          propio, oscuro, consistente con el resto de la tienda. */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed left-4 right-4 z-50 flex justify-center"
            style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="max-w-md w-full flex items-center gap-2.5 bg-red-500/95 backdrop-blur-sm text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl shadow-black/30">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    );
  }

  // ── CATÁLOGO ──
  // accent/hasBanner se declaran arriba, junto al resto de los estados
  // (ver nota ahí) -- este return es solo el JSX.
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Banner + logo + mensaje de bienvenida -- catalogTheme, configurado
          por el negocio en Inventarios → Personalizar tienda. No se renderiza
          nada si el negocio nunca lo configuró (theme null), igual que hoy. */}
      {hasBanner && (
        <div className="relative h-36 overflow-hidden">
          <img src={theme.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/30 to-black/20" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
            {theme.logoUrl && (
              <img src={theme.logoUrl} alt="" className="w-13 h-13 rounded-2xl object-cover border-2 border-[#0a0a0f] flex-shrink-0" style={{ width: 52, height: 52 }} onError={e => { e.target.style.display = 'none'; }} />
            )}
            <div className="min-w-0">
              <p className="text-white text-lg font-black leading-tight truncate">{company?.name || 'Tienda'}</p>
              {theme.welcomeText && (
                <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: accent }}>{theme.welcomeText}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/[0.05] px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            {/* Sin banner, se mantiene el header compacto original (logo
                chico inline); con banner, esa info ya se mostró arriba más
                grande, así que acá solo queda el contador de productos. */}
            {hasBanner ? (
              <p className="text-gray-500 text-xs">{products.length} productos</p>
            ) : (
              <div className="flex items-center gap-2.5">
                {theme?.logoUrl ? (
                  <img src={theme.logoUrl} alt="" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}26` }}>
                    <Store className="w-4 h-4" style={{ color: accent }} />
                  </div>
                )}
                <div>
                  <p className="text-white text-sm font-bold leading-tight">{company?.name || 'Tienda'}</p>
                  <p className="text-gray-600 text-[10px]">{products.length} productos</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!PRODUCTION_BUSINESS_TYPES.includes(inventoryType) && (
                <motion.button
                  onClick={() => setShowCamera(v => !v)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showCamera ? 'bg-amber-500 text-black' : 'bg-white/[0.07] text-gray-400 hover:text-white'}`}
                  whileTap={{ scale: 0.9 }}
                >
                  {showCamera ? <VideoOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                </motion.button>
              )}
              <motion.button
                onClick={() => cartCount > 0 && goToCheckout()}
                className="relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                style={{ background: accent }}
                whileTap={{ scale: 0.97 }}
              >
                <ShoppingCart className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-bold">{CLP(cartTotal)}</span>
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center"
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    >
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full bg-white/[0.05] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-600 outline-none"
            />
          </div>

          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={categories.length > 5 ? { WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)', maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)' } : undefined}
          >
            {categories.map((cat, i) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={category === cat
                  // "TODOS" (i=0) usa el color de marca del negocio -- es el
                  // chip que más se ve por defecto. Las demás categorías
                  // mantienen el arcoíris de CAT_COLORS para que sigan
                  // distinguiéndose visualmente entre sí.
                  ? { background: i === 0 ? accent : CAT_COLORS[i % CAT_COLORS.length], color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#6b7280' }
                }
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product, i) => {
              const inCart = cart.find(c => c.id === product.id);
              const sinStock = outOfStock.includes(product.id);
              return (
                <motion.div
                  key={product.id}
                  onClick={() => { setDetailProduct(product); setDetailNote(inCart?.note || ''); }}
                  className={`bg-[#111118] border rounded-2xl overflow-hidden cursor-pointer ${sinStock ? 'border-white/[0.03]' : 'border-white/[0.06]'}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: sinStock ? 0.45 : 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="aspect-square bg-white/[0.03] flex items-center justify-center relative overflow-hidden group">
                    <ProductImageCarousel
                      images={product.images}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      iconClassName="w-10 h-10 text-gray-700"
                    />
                    {product.byWeight && (
                      <div className="absolute top-2 right-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Scale className="w-2.5 h-2.5 text-amber-400" />
                        <span className="text-amber-400 text-[10px] font-bold">Peso</span>
                      </div>
                    )}
                    {sinStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-[11px] font-bold bg-red-500/80 px-2 py-1 rounded-lg">Sin stock</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-white text-sm font-bold leading-tight mb-0.5 truncate">{product.name}</p>
                    <p className="text-gray-600 text-[10px] mb-2 truncate">{product.category}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        {product.byWeight
                          ? <p className="text-amber-400 text-xs font-bold">{CLP(product.pricePerKg)}/{product.priceUnit || 'kg'}</p>
                          : <p className="text-white text-sm font-black">{CLP(getPrecioConPromo({ ...product, qty: inCart?.qty || 1 }))}</p>
                        }
                      </div>
                      {sinStock ? (
                        <span className="text-gray-600 text-[10px]">Agotado</span>
                      ) : inCart ? (
                        <div className="flex items-center gap-1.5">
                          {!product.byWeight && (
                            <button
                              onClick={(e) => { e.stopPropagation(); inCart.qty === 1 ? removeFromCart(product.id) : updateQty(product.id, -1); }}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${inCart.qty === 1 ? 'bg-red-500/20 hover:bg-red-500/40' : 'bg-white/10 hover:bg-white/20'}`}
                            >
                              {inCart.qty === 1 ? <Trash2 className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-white" />}
                            </button>
                          )}
                          <span className="text-blue-400 text-xs font-bold min-w-[16px] text-center">
                            {product.byWeight ? '✓' : inCart.qty}
                          </span>
                          {!product.byWeight && (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateQty(product.id, 1); }}
                              disabled={product.stock > 0 && inCart.qty >= product.stock}
                              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 overflow-hidden"
                              style={{ background: accent }}
                            >
                              {/* Mismo check breve que el botón "+" de abajo,
                                  pero ACÁ -- en cuanto se agrega un producto,
                                  inCart pasa a ser verdadero en el mismo
                                  render y este stepper reemplaza al botón
                                  "+" de agregar, así que ese otro check
                                  nunca llegaba a verse en el primer agregado
                                  (bug real encontrado al probar en vivo). */}
                              <AnimatePresence mode="wait" initial={false}>
                                {justAddedId === product.id ? (
                                  <motion.span key="check" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}>
                                    <CheckCircle className="w-3 h-3 text-white" />
                                  </motion.span>
                                ) : (
                                  <motion.span key="plus" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}>
                                    <Plus className="w-3 h-3 text-white" />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </button>
                          )}
                        </div>
                      ) : (
                        <motion.button
                          onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                          className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors overflow-hidden"
                          style={{ background: accent }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Botón flotante */}
      <AnimatePresence>
        {cartCount > 0 && step === 'browse' && !showCamera && (
          <motion.div
            className="fixed bottom-6 left-0 right-0 px-4 z-40"
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          >
            <motion.button
              onClick={goToCheckout}
              className="w-full max-w-md mx-auto flex items-center justify-between text-white px-5 py-4 rounded-2xl shadow-xl transition-all"
              style={{ background: accent, boxShadow: `0 20px 25px -5px ${accent}4d` }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <span className="font-bold">{cartCount} {cartCount === 1 ? 'producto' : 'productos'}</span>
              </div>
              <span className="font-black text-lg">{CLP(cartTotal)}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal scanner */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            className="fixed inset-0 z-50 bg-black flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-black/80">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                <span className="text-white font-bold text-sm">Escanear producto</span>
              </div>
              <button onClick={() => setShowCamera(false)} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ImprovedBarcodeScanner onScanSuccess={handleScan} onClose={() => setShowCamera(false)} inline={true} rawMode={true} />
            </div>
            <AnimatePresence>
              {scanFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className={`absolute bottom-28 left-4 right-4 px-5 py-3 rounded-2xl text-sm font-bold text-center shadow-xl ${scanFeedback.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                >
                  {scanFeedback.message}
                </motion.div>
              )}
            </AnimatePresence>
            {cartCount > 0 ? (
              <div className="px-4 pb-6 pt-3 bg-black/80">
                <button
                  onClick={() => { setShowCamera(false); goToCheckout(); }}
                  className="w-full flex items-center justify-between bg-blue-600 text-white px-5 py-4 rounded-2xl shadow-xl"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-bold">{cartCount} {cartCount === 1 ? 'producto' : 'productos'}</span>
                  </div>
                  <span className="font-black text-lg">{CLP(cartTotal)}</span>
                </button>
              </div>
            ) : (
              <div className="px-4 pb-6 pt-3 bg-black/80 text-center">
                <p className="text-gray-500 text-sm">Apunta al código de barras del producto</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de detalle de producto -- fotos en grande + descripción.
          Antes tocar una tarjeta no hacía nada, solo el botón "+" agregaba
          directo al carrito, sin forma de ver más fotos ni leer la
          descripción (campo que existía en los datos pero nunca se
          mostraba en ningún lado de esta pantalla). */}
      <AnimatePresence>
        {detailProduct && (() => {
          const p = detailProduct;
          const inCart = cart.find(c => c.id === p.id);
          const sinStock = outOfStock.includes(p.id);
          return (
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetailProduct(null)}
            >
              {/* Modal casi a pantalla completa (92vh) en vez del tamaño
                  "recortado" de antes, que se sentía chico para una vista
                  de detalle protagonista. */}
              <motion.div
                className="w-full sm:max-w-md sm:rounded-3xl bg-[#111118] rounded-t-3xl overflow-hidden h-[92vh] sm:max-h-[640px] flex flex-col"
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Foto a sangre completa con degradado oscuro hacia el
                    contenido -- antes la foto quedaba como un cuadrado
                    "pegado" con su fondo blanco original cortando abrupto
                    contra el panel oscuro de abajo; el degradado la funde
                    con el resto del modal en vez de verse como un sticker. */}
                <div className="relative flex-shrink-0" style={{ height: '52%' }}>
                  <ProductImageCarousel
                    images={p.images}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    iconClassName="w-16 h-16 text-gray-700"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, #111118 0%, rgba(17,17,24,0) 35%, rgba(17,17,24,0) 70%, rgba(0,0,0,0.2) 100%)' }}
                  />
                  <button
                    onClick={() => setDetailProduct(null)}
                    className="absolute top-3 right-3 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                  {p.byWeight && (
                    <div className="absolute top-3 left-3 bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-1 flex items-center gap-1">
                      <Scale className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-400 text-xs font-bold">A pesar</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 pt-1 pb-5">
                  <p className="text-gray-500 text-xs mb-1">{p.category}</p>
                  <h3 className="text-white text-2xl font-black mb-2.5">{p.name}</h3>
                  {p.description && (
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">{p.description}</p>
                  )}

                  {/* Comentario para cocina -- por producto, no por pedido
                      completo: cada plato puede tener su propia instrucción
                      (ej. "sin cebolla" en el Lomo Saltado), y la cocina
                      necesita saber exactamente a cuál aplica. Se guarda en
                      el item del carrito (order.items[].note) y se muestra
                      en el ticket/comanda del negocio. No aplica a productos
                      por peso (se pesan y preparan en el mostrador). */}
                  {!p.byWeight && (
                    <div>
                      <label className="text-gray-500 text-xs font-bold uppercase tracking-wider block mb-1.5">
                        Comentario para cocina <span className="text-gray-600 font-normal normal-case">(opcional)</span>
                      </label>
                      <textarea
                        value={detailNote}
                        onChange={(e) => {
                          setDetailNote(e.target.value);
                          if (inCart) updateNote(p.id, e.target.value);
                        }}
                        placeholder="Ej: Sin cebolla, bien cocido, sin picante..."
                        rows={2}
                        maxLength={140}
                        className="w-full bg-white/[0.05] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors resize-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 p-5 pt-0 border-t border-white/[0.06]">
                  <div className="flex items-baseline justify-between mb-3 pt-4">
                    <span className="text-gray-500 text-xs">Precio</span>
                    {p.byWeight
                      ? <p style={{ color: accent }} className="text-2xl font-black">{CLP(p.pricePerKg)}<span className="text-sm font-semibold text-gray-500">/{p.priceUnit || 'kg'}</span></p>
                      : <p className="text-white text-2xl font-black">{CLP(getPrecioConPromo({ ...p, qty: inCart?.qty || 1 }))}</p>
                    }
                  </div>
                  {sinStock ? (
                    <div className="w-full py-4 bg-white/[0.05] text-gray-500 font-bold rounded-2xl text-center">
                      Sin stock
                    </div>
                  ) : inCart && !p.byWeight ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => inCart.qty === 1 ? removeFromCart(p.id) : updateQty(p.id, -1)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${inCart.qty === 1 ? 'bg-red-500/20 hover:bg-red-500/40' : 'bg-white/10 hover:bg-white/20'}`}
                      >
                        {inCart.qty === 1 ? <Trash2 className="w-5 h-5 text-red-400" /> : <Minus className="w-5 h-5 text-white" />}
                      </button>
                      <span className="flex-1 text-center text-white text-xl font-black">{inCart.qty}</span>
                      <button
                        onClick={() => updateQty(p.id, 1)}
                        disabled={p.stock > 0 && inCart.qty >= p.stock}
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-30"
                        style={{ background: accent }}
                      >
                        <Plus className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <motion.button
                      onClick={() => { addToCart(p, detailNote); if (p.byWeight) setDetailProduct(null); }}
                      className="w-full py-4 text-white font-bold rounded-2xl flex items-center justify-center gap-2"
                      style={{ background: accent }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus className="w-5 h-5" /> Agregar al pedido
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
