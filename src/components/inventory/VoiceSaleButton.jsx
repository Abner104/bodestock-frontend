// src/components/inventory/VoiceSaleButton.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Check, AlertCircle, Volume2, Radio, ShoppingBag, Undo2 } from 'lucide-react';
import { API_URL } from '../../config/env';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);
const NUM_CL = (n) => new Intl.NumberFormat('es-CL').format(n);

// ── CONSTANTES ─────────────────────────────────────────────────────────────

const SILENCE_WARN_MS = 4500;
const WAKE_WORDS     = ['a vender', 'avender', 'vender', '¡a vender'];
const CLOSE_WORDS    = ['cobrar', 'cobro', 'listo cobrar', 'terminar', 'finalizar', 'cerrar venta', 'fin', 'eso es todo', 'listo ya'];
const CANCEL_WORDS   = ['cancelar', 'borrar todo', 'empezar de nuevo'];
const TOTAL_WORDS    = ['cuanto va', 'cuánto va', 'cuanto es', 'cuánto es', 'cuanto lleva', 'cuánto lleva', 'total'];
const UNDO_WORDS     = ['deshacer', 'quita el ultimo', 'borra el ultimo', 'quitar ultimo', 'el ultimo no', 'ese no'];
const REMOVE_WORDS   = ['quita', 'borra', 'elimina', 'saca'];

const NUMEROS = {
  'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
  'once': 11, 'doce': 12, 'quince': 15, 'veinte': 20, 'treinta': 30,
  'media': 0.5, 'medio': 0.5,
};

const UNIDADES = {
  'kilo': 'kg', 'kilos': 'kg', 'kg': 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg',
  'gramo': 'g', 'gramos': 'g', 'gr': 'g', 'grs': 'g', 'g': 'g',
  'litro': 'L', 'litros': 'L', 'lt': 'L', 'lts': 'L',
  'mililitro': 'ml', 'mililitros': 'ml', 'ml': 'ml', 'cc': 'ml',
  'unidad': 'u', 'unidades': 'u',
};

const FRACCIONES = [
  { frase: 'medio kilo',   cantidad: 0.5,  unidad: 'kg' },
  { frase: 'media kilo',   cantidad: 0.5,  unidad: 'kg' },
  { frase: 'cuarto kilo',  cantidad: 0.25, unidad: 'kg' },
  { frase: 'un cuarto de kilo', cantidad: 0.25, unidad: 'kg' },
  { frase: '500 gramos',   cantidad: 500,  unidad: 'g' },
  { frase: '250 gramos',   cantidad: 250,  unidad: 'g' },
  { frase: '100 gramos',   cantidad: 100,  unidad: 'g' },
  { frase: 'medio litro',  cantidad: 0.5,  unidad: 'L' },
  { frase: 'un litro',     cantidad: 1,    unidad: 'L' },
];

// ── NLP ────────────────────────────────────────────────────────────────────

function normalizarTexto(t) {
  return (t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extraerCantidadYUnidad(fragmento) {
  const f = normalizarTexto(fragmento);

  for (const { frase, cantidad, unidad } of FRACCIONES) {
    if (f.includes(frase)) return { cantidad, unidad };
  }

  const matchNumUnidad = f.match(/(\d+(?:[.,]\d+)?)\s*(kilogramo[s]?|kilo[s]?|kg|gramo[s]?|grs?|litro[s]?|lts?|ml|cc|\bg\b)/i);
  if (matchNumUnidad) {
    return {
      cantidad: parseFloat(matchNumUnidad[1].replace(',', '.')),
      unidad: UNIDADES[matchNumUnidad[2].toLowerCase()] || matchNumUnidad[2],
    };
  }

  const matchNum = f.match(/(\d+(?:[.,]\d+)?)\s*$/);
  if (matchNum) return { cantidad: parseFloat(matchNum[1].replace(',', '.')), unidad: null };

  for (const [palabra, num] of Object.entries(NUMEROS)) {
    const re = new RegExp(`\\b${palabra}\\b`);
    if (re.test(f)) return { cantidad: num, unidad: null };
  }

  return { cantidad: 1, unidad: null };
}

// Score de similitud entre dos strings normalizados (0-1)
function scoreSimilitud(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.95;

  // Comparar sin espacios: "red bull" vs "rebull"
  const aSinEsp = a.replace(/\s+/g, '');
  const bSinEsp = b.replace(/\s+/g, '');
  if (aSinEsp === bSinEsp) return 0.98;
  if (aSinEsp.includes(bSinEsp) || bSinEsp.includes(aSinEsp)) return 0.92;

  // Levenshtein sobre el string completo (sin espacios)
  const distTotal = levenshtein(aSinEsp, bSinEsp);
  const maxLen = Math.max(aSinEsp.length, bSinEsp.length);
  const scoreTotal = 1 - distTotal / maxLen;
  if (scoreTotal >= 0.75) return scoreTotal;

  // Match por palabras: todas las palabras del nombre están en el texto
  const palabrasNombre = a.split(' ').filter(p => p.length > 2);
  const palabrasTexto = b.split(' ');
  if (palabrasNombre.length > 0) {
    const matchCount = palabrasNombre.filter(pn =>
      palabrasTexto.some(pt => {
        if (pt.includes(pn) || pn.includes(pt)) return true;
        return levenshtein(pn, pt) <= Math.max(1, Math.floor(pn.length * 0.3));
      })
    ).length;
    const ratio = matchCount / palabrasNombre.length;
    if (ratio >= 0.8) return 0.8 + ratio * 0.1;
  }

  return 0;
}

function matchProducto(texto, producto) {
  const t = normalizarTexto(texto);
  const nombre = normalizarTexto(producto.name || producto.nombre || '');
  const aliases = (producto.aliases || []).map(normalizarTexto).filter(a => a.length > 1);

  // Buscar en cada segmento del texto (ventana deslizante del tamaño del nombre)
  const palabrasTexto = t.split(' ');
  const palabrasNombre = nombre.split(' ');
  const ventanas = [];
  for (let i = 0; i <= palabrasTexto.length - palabrasNombre.length; i++) {
    ventanas.push(palabrasTexto.slice(i, i + palabrasNombre.length + 1).join(' '));
  }
  // Agregar el texto completo y substrings
  const candidatos = [t, ...ventanas];

  const THRESHOLD = 0.72;

  for (const cand of candidatos) {
    if (scoreSimilitud(nombre, cand) >= THRESHOLD) return { match: true, matchedAlias: null, score: scoreSimilitud(nombre, cand) };
  }
  for (const a of aliases) {
    for (const cand of candidatos) {
      if (scoreSimilitud(a, cand) >= THRESHOLD) return { match: true, matchedAlias: a, score: scoreSimilitud(a, cand) };
    }
  }

  return { match: false, score: 0 };
}

function parsearTranscript(text, productos) {
  const texto = normalizarTexto(text);
  const resultado = [];
  const yaAgregados = new Set();

  // Separar por conectores naturales
  const segmentos = texto.split(/\s+(?:y|mas|tambien|ademas|con|,)\s+/);
  const todosSegmentos = [texto, ...segmentos];

  for (const seg of todosSegmentos) {
    // Para cada segmento, rankear todos los productos por score
    const candidatos = productos
      .filter(p => !yaAgregados.has(p.id))
      .map(p => ({ producto: p, ...matchProducto(seg, p) }))
      .filter(c => c.match)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    for (const { producto, matchedAlias } of candidatos) {
      if (yaAgregados.has(producto.id)) continue;

      const nombreNorm = matchedAlias || normalizarTexto(producto.name || producto.nombre || '');
      const posMatch = seg.indexOf(nombreNorm);
      const fragmentoAntes = posMatch > 0 ? seg.substring(0, posMatch) : seg;

      const { cantidad, unidad } = extraerCantidadYUnidad(fragmentoAntes || '');
      const stockDisponible = producto.stock ?? 9999;
      const cantidadFinal = Math.min(cantidad, stockDisponible > 0 ? stockDisponible : 9999);
      const stockWarning = stockDisponible > 0 && cantidad > stockDisponible;

      yaAgregados.add(producto.id);
      resultado.push({ producto, cantidad: cantidadFinal, unidad, stockWarning, stockDisponible });
    }
  }

  return resultado;
}

// Encuentra el producto con mejor score aunque no supere el threshold fuerte
function mejorCandidatoDebil(text, productos) {
  const texto = normalizarTexto(text);
  let mejor = null;
  let mejorScore = 0;

  for (const p of productos) {
    const nombre = normalizarTexto(p.name || p.nombre || '');
    const aliases = (p.aliases || []).map(normalizarTexto);
    const candidatos = [nombre, ...aliases];
    for (const c of candidatos) {
      const s = scoreSimilitud(c, texto);
      if (s > mejorScore) { mejorScore = s; mejor = p; }
      // También probar contra cada ventana del texto
      const palabras = texto.split(' ');
      for (let i = 0; i < palabras.length; i++) {
        const ventana = palabras.slice(i, i + c.split(' ').length + 1).join(' ');
        const sv = scoreSimilitud(c, ventana);
        if (sv > mejorScore) { mejorScore = sv; mejor = p; }
      }
    }
  }
  return mejorScore >= 0.55 ? { producto: mejor, score: mejorScore } : null;
}

// ── FORMATO NATURAL PARA TTS ───────────────────────────────────────────────
function formatearCantidadNatural(cantidad, unidad, nombre) {
  const u = (unidad || '').toLowerCase();
  const n = parseFloat(cantidad);

  // Peso en gramos → decir "gramos"
  if (u === 'g' && n >= 1) return `${Math.round(n)} gramos de ${nombre}`;
  // Peso en kg
  if ((u === 'kg' || u === 'kilo' || u === 'kilos') && n > 0) {
    if (n === 0.5) return `medio kilo de ${nombre}`;
    if (n === 0.25) return `un cuarto de kilo de ${nombre}`;
    if (n < 1) return `${Math.round(n * 1000)} gramos de ${nombre}`;
    return `${n} kilo${n !== 1 ? 's' : ''} de ${nombre}`;
  }
  // Volumen
  if (u === 'ml' && n >= 1) return `${Math.round(n)} mililitros de ${nombre}`;
  if ((u === 'l' || u === 'litro' || u === 'litros') && n > 0) {
    if (n === 0.5) return `medio litro de ${nombre}`;
    return `${n} litro${n !== 1 ? 's' : ''} de ${nombre}`;
  }
  // Unidades — evitar "uno pepsi", decir "una Pepsi" o "dos Pepsi"
  if (n === 1) return `una ${nombre}`;
  if (n === 2) return `dos ${nombre}`;
  if (n === 3) return `tres ${nombre}`;
  return `${n} ${nombre}`;
}

function resumenTTS(items) {
  return items.map(i => formatearCantidadNatural(
    i.cantidadMostrar ?? i.cantidadVoz,
    i.unidadMostrar ?? i.unidad,
    i.nombre
  )).join(', ');
}
// ──────────────────────────────────────────────────────────────────────────

// ── CONVERSIÓN DE UNIDADES ─────────────────────────────────────────────────
// Convierte cantidad de unidadVoz a unidadInventario
// Retorna { cantidadConvertida, factorPrecio }
// factorPrecio: multiplicador para el precio unitario del inventario
function round6(n) { return Math.round(n * 1000000) / 1000000; }

function normalizarUnidad(u) {
  const m = (u || '').toLowerCase().trim();
  // Normalizar variantes comunes
  if (['kilogramo', 'kilogramos', 'kilo', 'kilos', 'kg'].includes(m)) return 'kg';
  if (['gramo', 'gramos', 'gr', 'grs', 'g'].includes(m)) return 'g';
  if (['litro', 'litros', 'lt', 'lts', 'l'].includes(m)) return 'litro';
  if (['mililitro', 'mililitros', 'ml', 'cc'].includes(m)) return 'ml';
  return m;
}

function convertirUnidad(cantidad, unidadVoz, unidadInventario) {
  const u1 = normalizarUnidad(unidadVoz);
  const u2 = normalizarUnidad(unidadInventario);

  if (!u1 || u1 === u2) {
    return { cantidadConvertida: cantidad, factorPrecio: 1 };
  }

  // Peso — todo a gramos internamente para evitar flotantes
  // Peso — todo a gramos internamente (usando unidades ya normalizadas)
  const PESO_G = { 'kg': 1000, 'g': 1 };
  if (PESO_G[u1] !== undefined && PESO_G[u2] !== undefined) {
    const cantidadEnGramos = cantidad * PESO_G[u1];
    const cantidadConvertida = round6(cantidadEnGramos / PESO_G[u2]);
    const factorPrecio = round6(PESO_G[u1] / PESO_G[u2]);
    return { cantidadConvertida, factorPrecio };
  }

  // Volumen — todo a ml internamente
  const VOL_ML = { 'litro': 1000, 'ml': 1 };
  if (VOL_ML[u1] !== undefined && VOL_ML[u2] !== undefined) {
    const cantidadEnML = cantidad * VOL_ML[u1];
    const cantidadConvertida = round6(cantidadEnML / VOL_ML[u2]);
    const factorPrecio = round6(VOL_ML[u1] / VOL_ML[u2]);
    return { cantidadConvertida, factorPrecio };
  }

  return { cantidadConvertida: cantidad, factorPrecio: 1 };
}
// ──────────────────────────────────────────────────────────────────────────

// Detectar si el texto pide eliminar un producto por nombre
// Distancia de Levenshtein simplificada para fuzzy match
function similarTexto(a, b) {
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // Palabras del nombre — si el texto contiene la mitad de las palabras clave, es match
  const palabrasNombre = a.split(' ').filter(p => p.length > 2);
  const palabrasTexto = b.split(' ');
  if (palabrasNombre.length === 0) return false;
  const matches = palabrasNombre.filter(p =>
    palabrasTexto.some(pt => pt.includes(p) || p.includes(pt) || levenshtein(p, pt) <= 2)
  );
  return matches.length >= Math.ceil(palabrasNombre.length * 0.6);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function detectarRemover(texto, carrito) {
  const t = normalizarTexto(texto);
  if (!REMOVE_WORDS.some(w => t.includes(w))) return null;

  // Quitar la palabra de remoción para quedarnos solo con el nombre del producto
  let textoSinCmd = t;
  for (const w of REMOVE_WORDS) textoSinCmd = textoSinCmd.replace(w, '').trim();

  for (const item of carrito) {
    const nombre = normalizarTexto(item.nombre);
    const aliases = (item.aliases || []).map(normalizarTexto);

    if (similarTexto(nombre, textoSinCmd)) return item;
    if (aliases.some(a => similarTexto(a, textoSinCmd))) return item;
  }
  return null;
}

// ── TTS ────────────────────────────────────────────────────────────────────

let _mejorVoz = null;

function getMejorVoz() {
  if (_mejorVoz) return _mejorVoz;
  const voces = window.speechSynthesis?.getVoices() || [];
  const prioridad = [
    v => v.lang === 'es-CL',
    v => v.lang === 'es-MX',
    v => v.lang === 'es-AR',
    v => v.lang === 'es-US',
    v => v.lang?.startsWith('es') && v.localService,
    v => v.lang?.startsWith('es'),
  ];
  for (const filtro of prioridad) {
    const voz = voces.find(filtro);
    if (voz) { _mejorVoz = voz; return voz; }
  }
  return null;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => { _mejorVoz = null; getMejorVoz(); };
}

// Flag global — true mientras el sistema está hablando
let _hablando = false;

// onDone se llama cuando el TTS realmente terminó
// Chrome bug: SpeechSynthesis se cuelga en textos largos y no dispara onend
// Solución: dividir en frases cortas + keepalive + safety timeout
function hablar(texto, onDone) {
  if (!window.speechSynthesis) { onDone?.(); return; }
  window.speechSynthesis.cancel();
  _hablando = true;

  // Dividir en frases por comas y puntos para evitar el bug de Chrome
  const frases = texto
    .split(/(?<=[,.])\s+/)
    .map(f => f.trim())
    .filter(Boolean);

  let idx = 0;

  const hablarFrase = () => {
    if (idx >= frases.length) {
      _hablando = false;
      onDone?.();
      return;
    }

    const u = new SpeechSynthesisUtterance(frases[idx]);
    u.lang = 'es-CL';
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 0.95;
    const voz = getMejorVoz();
    if (voz) u.voice = voz;

    // Safety timeout por frase: ~75ms por caracter + 400ms buffer
    const duracion = Math.max(800, frases[idx].length * 75 + 400);
    const safetyTimer = setTimeout(() => {
      if (_hablando) { idx++; hablarFrase(); }
    }, duracion);

    u.onend = () => { clearTimeout(safetyTimer); idx++; hablarFrase(); };
    u.onerror = () => { clearTimeout(safetyTimer); idx++; hablarFrase(); };

    window.speechSynthesis.speak(u);

    // Keepalive: Chrome pausa el TTS si el tab pierde foco
    // Resumir cada 10 segundos si sigue hablando
    if (idx === 0) {
      const keepAlive = setInterval(() => {
        if (!_hablando) { clearInterval(keepAlive); return; }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 10000);
    }
  };

  hablarFrase();
}

function estaHablando() { return _hablando; }

// ── HELPERS CARRITO ────────────────────────────────────────────────────────

function mergeCarrito(prev, items) {
  const nuevo = [...prev];
  items.forEach(item => {
    const idx = nuevo.findIndex(i => i.id === item.id);
    if (idx >= 0) nuevo[idx] = { ...nuevo[idx], cantidadVoz: nuevo[idx].cantidadVoz + item.cantidadVoz };
    else nuevo.push({ ...item });
  });
  return nuevo;
}

function totalCarrito(carrito) {
  return carrito.reduce((s, i) => s + (i.precio || 0) * (i.cantidadVoz || 0), 0);
}

// ──────────────────────────────────────────────────────────────────────────

export default function VoiceSaleButton({ companyId, inventoryId, warehouseId, onAddProducts, productos = [] }) {
  const [state, setState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [cartAcumulado, setCartAcumulado] = useState([]);
  const cartRef = useRef([]);
  const [saludarAlAbrir, setSaludarAlAbrir] = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);

  // Ambigüedad
  const [ambiguo, setAmbiguo] = useState(null);
  const [vueltoInfo, setVueltoInfo] = useState(null);
  const [hayVoz, setHayVoz] = useState(false); // true cuando llega interim transcript

  const wakeRecognitionRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const silenceWarnTimer = useRef(null);
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Sincronizar ref con state
  useEffect(() => { cartRef.current = cartAcumulado; }, [cartAcumulado]);

  // Ref para startListening — evita stale closures en reanudarEscucha
  const startListeningRef = useRef(null);

  const resetState = useCallback((clearCart = false) => {
    setState('idle');
    setTranscript('');
    setInterimTranscript('');
    setResults(null);
    setErrorMsg('');
    setSilenceWarning(false);
    setAmbiguo(null);
    setVueltoInfo(null);
    finalTextRef.current = '';
    if (clearCart) { setCartAcumulado([]); cartRef.current = []; }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceWarnTimer.current) { clearTimeout(silenceWarnTimer.current); silenceWarnTimer.current = null; }
    setSilenceWarning(false);
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current._manualStop = true;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [clearSilenceTimer]);

  const stopWakeWord = useCallback(() => {
    if (wakeRecognitionRef.current) {
      wakeRecognitionRef.current._stopped = true;
      wakeRecognitionRef.current.stop();
      wakeRecognitionRef.current = null;
    }
    setWakeWordActive(false);
  }, []);

  // ── Procesar comando/producto ──────────────────────────────────────────

  const reanudarEscucha = useCallback((ttsTexto) => {
    // Limpiar TODO antes de hablar o arrancar micrófono
    finalTextRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setResults(null);
    setState('idle');

    const arrancarMic = () => {
      // Doble check — asegurar que finalText sigue vacío antes de arrancar
      finalTextRef.current = '';
      startListeningRef.current?.();
    };

    if (ttsTexto) {
      hablar(ttsTexto, () => setTimeout(arrancarMic, 350));
    } else {
      setTimeout(arrancarMic, 500);
    }
  }, []);

  const processTranscript = useCallback(async (text) => {
    if (!text.trim()) { setState('idle'); return; }
    const t = normalizarTexto(text);
    const carrito = cartRef.current;

    // ── CANCELAR ──
    if (CANCEL_WORDS.some(w => t.includes(w))) {
      hablar('Listo, pedido cancelado');
      resetState(true);
      return;
    }

    // ── DESHACER último ──
    if (UNDO_WORDS.some(w => t.includes(w))) {
      if (carrito.length === 0) {
        reanudarEscucha('No hay nada para deshacer');
        return;
      }
      const ultimo = carrito[carrito.length - 1];
      const nuevo = carrito.slice(0, -1);
      setCartAcumulado(nuevo);
      cartRef.current = nuevo;
      reanudarEscucha(`Quité ${ultimo.nombre}`);
      return;
    }

    // ── QUITAR producto por nombre ──
    const tieneComandoRemover = REMOVE_WORDS.some(w => t.includes(w));
    if (tieneComandoRemover) {
      const itemARemover = detectarRemover(text, carrito);
      if (itemARemover) {
        const nuevo = carrito.filter(i => i.id !== itemARemover.id);
        setCartAcumulado(nuevo);
        cartRef.current = nuevo;
        reanudarEscucha(`Quité ${itemARemover.nombre}`);
      } else {
        reanudarEscucha('No encontré ese producto en el pedido');
      }
      return;
    }

    // ── COBRAR ──
    if (CLOSE_WORDS.some(w => t.includes(w))) {
      const total = totalCarrito(carrito);
      if (carrito.length > 0) {
        stopListening();
        // Resumen completo: productos + total
        const resumenItems = carrito.map(i =>
          formatearCantidadNatural(
            i.cantidadMostrar ?? i.cantidadVoz,
            i.unidadMostrar ?? i.unidad,
            i.nombre
          )
        ).join(', ');
        const msgCobro = `${resumenItems}. Total: ${NUM_CL(total)} pesos`;
        hablar(msgCobro, () => {
          setTimeout(() => {
            onAddProducts(carrito);
            setIsOpen(false);
            resetState(true);
          }, 400);
        });
      } else {
        reanudarEscucha('El pedido está vacío');
      }
      return;
    }

    // ── TOTAL ──
    if (TOTAL_WORDS.some(w => t.includes(w))) {
      const total = totalCarrito(carrito);
      reanudarEscucha(total > 0 ? `Van ${NUM_CL(total)} pesos` : 'El pedido está vacío todavía');
      return;
    }

    // ── VUELTO / PAGO ──
    const matchPago = t.match(/recib[ií]\s*(\d[\d.]*)\s*(mil)?/);
    if (matchPago) {
      let recibido = parseFloat(matchPago[1].replace(/\./g, ''));
      if (matchPago[2] === 'mil' || recibido < 1000) recibido *= 1000;
      const total = totalCarrito(carrito);
      if (total <= 0) {
        reanudarEscucha('Primero agrega productos al pedido');
        return;
      }
      if (recibido < total) {
        reanudarEscucha(`Faltan ${NUM_CL(total - recibido)} pesos`);
        return;
      }
      const vuelto = recibido - total;
      const msgVuelto = vuelto > 0 ? `El vuelto es ${NUM_CL(vuelto)} pesos` : 'Monto exacto, sin vuelto';
      hablar(msgVuelto);
      setVueltoInfo({ recibido, total, vuelto });
      setState('idle');
      return;
    }

    setState('processing');

    // ── BÚSQUEDA LOCAL ──
    if (productos.length > 0) {
      const encontrados = parsearTranscript(text, productos);

      // Ambigüedad: múltiples candidatos con nombre muy similar
      const candidatosDudosos = productos.filter(p => {
        const { match } = matchProducto(text, p);
        return match;
      });
      if (candidatosDudosos.length > 1 && encontrados.length === 0) {
        setAmbiguo({ candidatos: candidatosDudosos.slice(0, 3), texto: text });
        setState('idle');
        const nombres = candidatosDudosos.slice(0, 2).map(p => p.name || p.nombre).join(' o ');
        hablar(`¿Cuál querés? ${nombres}`);
        return;
      }

      if (encontrados.length > 0) {
        const items = encontrados.map(({ producto, cantidad, unidad, stockWarning, stockDisponible }) => {
          const unidadInventario = producto.unit || producto.unidad || 'unidad';
          const unidadVoz = unidad || unidadInventario;
          const precioBase = producto.precioVenta || producto.ppp || 0;

          // Convertir cantidad a unidad del inventario
          const { cantidadConvertida, factorPrecio } = convertirUnidad(cantidad, unidadVoz, unidadInventario);

          const stockReal = producto.stock ?? 9999;
          const cantidadFinalConv = Math.min(cantidadConvertida, stockReal > 0 ? stockReal : 9999);
          const stockWarnReal = stockReal > 0 && cantidadConvertida > stockReal;

          // Para mostrar en UI: cantidad en unidad que dijo el usuario (ej: 125g)
          // Para el carrito real: cantidadVoz en unidad del inventario (ej: 0.125kg)
          // El precio siempre en unidad del inventario ($/kg)
          return {
            id: producto.id,
            nombre: producto.name || producto.nombre,
            precio: precioBase,          // precio por unidad del INVENTARIO ($/kg)
            unidad: unidadInventario,    // unidad del inventario para cálculos
            unidadMostrar: unidadVoz,   // unidad que dijo el usuario (para mostrar)
            cantidadMostrar: cantidad,   // cantidad que dijo el usuario (para mostrar)
            stock: stockReal,
            cantidadVoz: cantidadFinalConv, // en unidad del inventario (para el carrito)
            stockWarning: stockWarnReal,
            stockDisponible,
            promociones: producto.promociones || [],
            ppp: producto.ppp || 0,
            productType: producto.productType,
            precioVenta: producto.precioVenta,
            warehouseId: producto.warehouseId,
            inventoryId: producto.inventoryId,
            aliases: producto.aliases || [],
            // Guardar unidad original del inventario para el carrito
            unidadInventario,
          };
        });

        // Agregar al carrito
        setCartAcumulado(prev => {
          const nuevo = mergeCarrito(prev, items);
          cartRef.current = nuevo;
          return nuevo;
        });

        setResults({ items, noEncontrados: [], mensaje: items.map(i =>
          i.stockWarning ? `⚠️ ${i.nombre} — solo hay ${i.stockDisponible}` : `✅ ${i.cantidadVoz}× ${i.nombre}`
        ).join(' · ') });
        setState('results');

        const sinStock = items.filter(i => i.stockWarning);
        const resumenVoz = resumenTTS(items);

        if (sinStock.length > 0) {
          // Decir confirmación, cuando termine decir aviso de stock, cuando termine reanudar
          hablar(`Listo, ${resumenVoz}`, () => {
            hablar(`Ojo, solo quedan ${sinStock[0].stockDisponible} de ${sinStock[0].nombre}`, () => {
              reanudarEscucha();
            });
          });
        } else {
          // Decir confirmación, cuando termine reanudar
          hablar(`Listo, ${resumenVoz}`, () => reanudarEscucha());
        }
        return;
      }
    }

    // ── CANDIDATO DÉBIL (fuzzy con score bajo) ──
    // Antes de ir a Claude, ver si hay algún producto que suene parecido
    if (productos.length > 0) {
      const debil = mejorCandidatoDebil(text, productos);
      if (debil) {
        const p = debil.producto;
        const item = {
          id: p.id,
          nombre: p.name || p.nombre,
          precio: p.precioVenta || p.ppp || 0,
          unidad: p.unit || p.unidad || 'unidad',
          unidadMostrar: p.unit || p.unidad || 'unidad',
          cantidadMostrar: 1,
          cantidadVoz: 1,
          stock: p.stock ?? 9999,
          ppp: p.ppp || 0,
          promociones: p.promociones || [],
          productType: p.productType,
          precioVenta: p.precioVenta,
          warehouseId: p.warehouseId,
          inventoryId: p.inventoryId,
          aliases: p.aliases || [],
          unidadInventario: p.unit || p.unidad || 'unidad',
        };
        setCartAcumulado(prev => { const n = mergeCarrito(prev, [item]); cartRef.current = n; return n; });
        setResults({ items: [item], noEncontrados: [], mensaje: `✅ ${item.nombre}` });
        setState('results');
        hablar(`Listo, una ${item.nombre}`, () => reanudarEscucha());
        return;
      }
    }

    // ── FALLBACK CLAUDE ──
    try {
      // Enviar catálogo simplificado para que Claude matchee por nombre
      const catalogoSimple = productos.map(p => ({
        id: p.id,
        name: p.name || p.nombre,
        aliases: p.aliases || [],
        unit: p.unit || p.unidad,
        stock: p.stock,
        precioVenta: p.precioVenta,
        ppp: p.ppp,
      }));
      const res = await fetch(`${API_URL}/api/assistant/voice-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, companyId, inventoryId, warehouseId, catalogo: catalogoSimple }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (data.items?.length > 0) {
        // Enriquecer items con datos completos del producto local
        const itemsEnriquecidos = data.items.map(di => {
          const pLocal = productos.find(p => p.id === di.id) || {};
          return {
            ...di,
            promociones: pLocal.promociones || [],
            aliases: pLocal.aliases || [],
            productType: pLocal.productType,
            warehouseId: pLocal.warehouseId || di.warehouseId,
            inventoryId: pLocal.inventoryId || di.inventoryId,
          };
        });
        setCartAcumulado(prev => {
          const nuevo = mergeCarrito(prev, itemsEnriquecidos);
          cartRef.current = nuevo;
          return nuevo;
        });
        setResults({ items: itemsEnriquecidos, noEncontrados: data.noEncontrados || [], mensaje: data.mensaje });
        setState('results');
        const resumenVoz = resumenTTS(itemsEnriquecidos);
        hablar(`Listo, ${resumenVoz}`, () => reanudarEscucha());
      } else {
        reanudarEscucha('No lo encontré, ¿puedes repetirlo?');
      }
    } catch (err) {
      reanudarEscucha('No lo encontré, ¿puedes repetirlo?');
    }
  }, [companyId, inventoryId, warehouseId, productos, onAddProducts, resetState, reanudarEscucha]);

  // ── RECONOCIMIENTO PRINCIPAL ───────────────────────────────────────────

  const startListening = useCallback(() => {
    if (!isSupported) { setErrorMsg('Usá Chrome para reconocimiento de voz.'); setState('error'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'es-CL';
    r.continuous = /Android|iPhone|iPad/i.test(navigator.userAgent);
    r.interimResults = true;
    r.maxAlternatives = 1;
    r._manualStop = false;

    r.onstart = () => {
      setState('listening');
      setSilenceWarning(false);
      setAmbiguo(null);
      if (!finalTextRef.current) { setTranscript(''); setInterimTranscript(''); }
      clearSilenceTimer();
      silenceWarnTimer.current = setTimeout(() => setSilenceWarning(true), SILENCE_WARN_MS);
    };

    r.onresult = (e) => {
      let fin = '', tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += txt; else tmp += txt;
      }
      if (fin) { finalTextRef.current += (finalTextRef.current ? ' ' : '') + fin; setTranscript(finalTextRef.current); }
      setInterimTranscript(tmp);
      clearSilenceTimer();
      silenceWarnTimer.current = setTimeout(() => setSilenceWarning(true), SILENCE_WARN_MS);
    };

    r.onend = () => {
      setInterimTranscript(''); clearSilenceTimer();
      if (r._manualStop) return;
      if (finalTextRef.current.trim()) processTranscript(finalTextRef.current);
      else setState('idle');
    };

    r.onerror = (e) => {
      clearSilenceTimer();
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') { setErrorMsg('Permiso de micrófono denegado.'); setState('error'); return; }
      setErrorMsg(`Error: ${e.error}`); setState('error');
    };

    recognitionRef.current = r;
    // Siempre limpiar al arrancar — evita reprocesar texto de ciclo anterior
    finalTextRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    try { r.start(); } catch { setErrorMsg('No se pudo iniciar el micrófono.'); setState('error'); }
  }, [isSupported, processTranscript, clearSilenceTimer]);

  // Mantener ref actualizado con la última versión de startListening
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  // ── WAKE WORD ──────────────────────────────────────────────────────────

  const startWakeWord = useCallback(() => {
    if (!isSupported || wakeRecognitionRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'es-CL'; r.continuous = true; r.interimResults = true; r._stopped = false;

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript.toLowerCase().trim();
        if (WAKE_WORDS.some(w => txt.includes(w))) {
          setWakeWordDetected(true);
          setTimeout(() => setWakeWordDetected(false), 800);
          stopWakeWord();
          setSaludarAlAbrir(true);
          setIsOpen(true);
          return;
        }
      }
    };
    r.onend = () => {
      if (!r._stopped && wakeWordEnabledRef.current) {
        wakeRecognitionRef.current = null;
        setTimeout(startWakeWord, 300);
      } else {
        wakeRecognitionRef.current = null;
      }
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wakeRecognitionRef.current = null;
      if (wakeWordEnabledRef.current) setTimeout(startWakeWord, 1000);
    };
    wakeRecognitionRef.current = r;
    setWakeWordActive(true);
    try { r.start(); } catch {}
  }, [isSupported, stopWakeWord]);

  // Wake word desactivado por defecto — se activa solo si el usuario lo habilita manualmente
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const wakeWordEnabledRef = useRef(false);

  useEffect(() => {
    wakeWordEnabledRef.current = wakeWordEnabled;
    if (!isSupported || !wakeWordEnabled) {
      stopWakeWord();
      return;
    }
    const t = setTimeout(startWakeWord, 1000);
    return () => { clearTimeout(t); stopWakeWord(); };
  }, [wakeWordEnabled]); // eslint-disable-line

  useEffect(() => {
    if (isOpen) {
      stopWakeWord();
      if (saludarAlAbrir) {
        setSaludarAlAbrir(false);
        hablar('Listo, ¿qué vas a vender?');
        setTimeout(() => startListeningRef.current?.(), 1600);
      }
    } else if (isSupported && wakeWordEnabled) {
      const t = setTimeout(startWakeWord, 800);
      return () => clearTimeout(t);
    }
  }, [isOpen]); // eslint-disable-line

  useEffect(() => {
    if (!isOpen) { stopListening(); resetState(true); }
  }, [isOpen, stopListening, resetState]);

  // NO arrancar micrófono automáticamente desde idle
  // El arranque lo controla el callback onDone del TTS en reanudarEscucha

  // hayVoz se activa cuando llega interim transcript — anima las ondas
  useEffect(() => {
    if (interimTranscript) {
      setHayVoz(true);
      const t = setTimeout(() => setHayVoz(false), 400);
      return () => clearTimeout(t);
    }
  }, [interimTranscript]);

  // ── HANDLERS UI ────────────────────────────────────────────────────────

  const handleQuitarDelCart = (id) => {
    setCartAcumulado(prev => { const n = prev.filter(i => i.id !== id); cartRef.current = n; return n; });
  };

  const handleConfirmarTodo = () => {
    const carrito = cartRef.current;
    if (!carrito.length) return;
    onAddProducts(carrito);
    setIsOpen(false);
    resetState(true);
  };

  const handleSeleccionarAmbiguo = (producto) => {
    setAmbiguo(null);
    const item = {
      id: producto.id,
      nombre: producto.name || producto.nombre,
      precio: producto.precioVenta || producto.ppp || 0,
      unidad: producto.unit || 'unidad',
      stock: producto.stock || 0,
      cantidadVoz: 1,
      ppp: producto.ppp || 0,
    };
    setCartAcumulado(prev => { const n = mergeCarrito(prev, [item]); cartRef.current = n; return n; });
    hablar(`Agregué ${item.nombre}`);
    reanudarEscucha(1200);
  };

  if (!isSupported) return null;

  const totalActual = totalCarrito(cartAcumulado);

  return (
    <>
      {/* ── BOTÓN + INDICADOR ── */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={wakeWordDetected ? { scale: [1, 1.12, 1] } : {}}
          onClick={() => { setIsOpen(true); setTimeout(startListening, 300); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-white rounded-xl shadow-lg font-semibold text-sm transition-all ${
            wakeWordDetected ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700'
          }`}
          title='Venta por voz'
        >
          <Mic className="w-4 h-4" />
          <span>Voz</span>
        </motion.button>

        {/* Activar wake word manualmente — solo muestra si el usuario lo habilita */}
        {!wakeWordEnabled && !isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            onClick={() => setWakeWordEnabled(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/60 border border-white/10 rounded-xl text-[10px] text-slate-500 hover:text-violet-400 hover:border-violet-500/30 transition"
            title='Activar escucha automática "A vender"'
          >
            <Radio className="w-3 h-3" />
            <span className="hidden sm:inline">Wake word</span>
          </motion.button>
        )}

        {wakeWordEnabled && wakeWordActive && !isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-xl cursor-pointer"
            onClick={() => { stopWakeWord(); setWakeWordEnabled(false); }}
            title='Click para desactivar'
          >
            <motion.div className="w-1.5 h-1.5 rounded-full bg-violet-500"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="text-[10px] font-bold text-violet-400 hidden sm:inline">di "A VENDER"</span>
            <Radio className="w-3 h-3 text-violet-400 sm:hidden" />
          </motion.div>
        )}
      </div>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-slate-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 sm:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-xl flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Venta por voz</p>
                    <p className="text-[11px] text-slate-500">
                      {state === 'listening' ? '🎙️ Escuchando...' :
                       state === 'processing' ? '⏳ Procesando...' :
                       'Di productos · "cuánto va" · "cobrar"'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {totalActual > 0 && (
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                      {CLP(totalActual)}
                    </span>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[75vh] overflow-y-auto">

                {/* ── ESCUCHANDO ── */}
                {state === 'listening' && (
                  <div className="flex flex-col items-center">
                    <div className="relative flex items-center justify-center mb-4 mt-2">
                      {/* Ondas — se activan cuando detecta voz (interim transcript) */}
                      {[1, 2, 3].map(i => (
                        <motion.div key={i}
                          className="absolute rounded-full border-2 border-violet-500/40"
                          style={{ width: 56 + i * 26, height: 56 + i * 26 }}
                          animate={
                            silenceWarning
                              ? { scale: 1, opacity: 0.08 }
                              : hayVoz
                                ? { scale: [1, 1 + i * 0.12, 1], opacity: [0.6, 0.15, 0.6] }
                                : { scale: [1, 1.06, 1], opacity: [0.3, 0.08, 0.3] }
                          }
                          transition={
                            hayVoz
                              ? { duration: 0.35, repeat: 0 }
                              : { duration: 1.6, repeat: Infinity, delay: i * 0.2 }
                          }
                        />
                      ))}
                      {/* Círculo central */}
                      <motion.div
                        className={`w-14 h-14 rounded-full flex items-center justify-center relative z-10 ${
                          silenceWarning
                            ? 'bg-slate-700'
                            : 'bg-gradient-to-br from-violet-600 to-purple-600'
                        }`}
                        animate={
                          silenceWarning ? {} :
                          hayVoz
                            ? { scale: [1, 1.15, 1], boxShadow: '0 0 30px 8px rgba(139,92,246,0.5)' }
                            : { scale: [1, 1.04, 1], boxShadow: '0 0 12px 2px rgba(139,92,246,0.2)' }
                        }
                        transition={
                          hayVoz
                            ? { duration: 0.3 }
                            : { duration: 0.9, repeat: Infinity }
                        }
                      >
                        <Mic className={`w-6 h-6 ${silenceWarning ? 'text-slate-400' : 'text-white'}`} />
                      </motion.div>
                    </div>

                    <AnimatePresence>
                      {silenceWarning && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-2 text-xs text-amber-400"
                        >
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          ¿Terminaste? Di "cobrar" o tocá "Listo"
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Ambigüedad */}
                    {ambiguo && (
                      <div className="w-full mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <p className="text-xs text-blue-400 font-bold mb-2">¿Cuál de estos?</p>
                        <div className="space-y-1.5">
                          {ambiguo.candidatos.map(p => (
                            <button key={p.id} onClick={() => handleSeleccionarAmbiguo(p)}
                              className="w-full flex items-center justify-between p-2.5 bg-white/5 hover:bg-blue-500/20 border border-white/10 rounded-xl text-left transition"
                            >
                              <span className="text-sm font-semibold text-white">{p.name || p.nombre}</span>
                              <span className="text-xs text-slate-400">{CLP(p.precioVenta || p.ppp)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="w-full min-h-[44px] px-4 py-3 bg-white/5 rounded-xl border border-white/10 mb-4">
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {transcript}
                        <span className="text-slate-500 italic">{interimTranscript}</span>
                        {!transcript && !interimTranscript && <span className="text-slate-600">Tu voz aparecerá aquí...</span>}
                      </p>
                    </div>

                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => { stopListening(); finalTextRef.current && processTranscript(finalTextRef.current); }}
                        disabled={!transcript && !interimTranscript}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-30 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" /> Listo
                      </button>
                      <button
                        onClick={() => { stopListening(); resetState(false); }}
                        className="py-3 px-4 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm hover:bg-white/10 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── PROCESANDO ── */}
                {state === 'processing' && (
                  <div className="flex flex-col items-center py-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 rounded-full mb-4"
                      style={{ borderWidth: 3, borderStyle: 'solid', borderColor: '#7c3aed transparent transparent transparent' }}
                    />
                    <p className="text-sm font-semibold text-white mb-1">Buscando...</p>
                    <p className="text-xs text-slate-500 italic text-center">"{transcript}"</p>
                  </div>
                )}

                {/* ── RESULTADOS ── */}
                {state === 'results' && results && (
                  <div>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg mb-3"
                    >
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-violet-500"
                        animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                      <span className="text-[11px] text-violet-400 font-medium">Volviendo a escuchar...</span>
                    </motion.div>

                    {results.items?.map(item => (
                      <motion.div key={item.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-2"
                      >
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{item.nombre}</p>
                          {item.stockWarning && <p className="text-[11px] text-amber-400">⚠️ Solo quedan {item.stockDisponible}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-emerald-400">
                            × {item.cantidadMostrar ?? item.cantidadVoz} {item.unidadMostrar ?? item.unidad}
                          </p>
                          <p className="text-[11px] text-slate-500">{CLP(item.precio * item.cantidadVoz)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* ── ERROR ── */}
                {state === 'error' && (
                  <div className="flex flex-col items-center py-6">
                    <MicOff className="w-10 h-10 text-red-400 mb-3" />
                    <p className="text-sm font-semibold text-white mb-1">Algo salió mal</p>
                    <p className="text-xs text-slate-400 text-center mb-4">{errorMsg}</p>
                    <button onClick={() => { resetState(false); setTimeout(startListening, 300); }}
                      className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition">
                      Reintentar
                    </button>
                  </div>
                )}

                {/* ── PANTALLA VUELTO ── */}
                {vueltoInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 p-4 bg-slate-800 border border-white/10 rounded-2xl"
                  >
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Resumen de cobro</p>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total</span>
                        <span className="font-bold text-white">{CLP(vueltoInfo.total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Recibido</span>
                        <span className="font-bold text-white">{CLP(vueltoInfo.recibido)}</span>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-slate-300">Vuelto</span>
                        <span className={`text-xl font-black ${vueltoInfo.vuelto > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {vueltoInfo.vuelto > 0 ? CLP(vueltoInfo.vuelto) : 'Sin vuelto'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setVueltoInfo(null); reanudarEscucha(300); }}
                        className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-sm font-semibold hover:bg-white/10 transition"
                      >
                        Corregir
                      </button>
                      <button
                        onClick={() => {
                          onAddProducts(cartRef.current);
                          setIsOpen(false);
                          resetState(true);
                        }}
                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-black text-sm shadow-md transition"
                      >
                        ✓ Confirmar cobro
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── CARRITO ACUMULADO (siempre visible) ── */}
                {cartAcumulado.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Pedido</p>
                      <button onClick={() => {
                          const ultimo = cartAcumulado[cartAcumulado.length - 1];
                          handleQuitarDelCart(ultimo.id);
                          hablar(`Quité ${ultimo.nombre}`);
                        }}
                        className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-amber-400 transition"
                      >
                        <Undo2 className="w-3 h-3" /> Deshacer último
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {cartAcumulado.map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-2.5 bg-white/5 border border-white/10 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{item.nombre}</p>
                            <p className="text-[10px] text-slate-500">{CLP(item.precio)}/{item.unidad}</p>
                          </div>
                          <p className="text-sm font-black text-slate-400 shrink-0">
                            × {item.cantidadMostrar ?? item.cantidadVoz} {item.unidadMostrar ?? ''}
                          </p>
                          <p className="text-sm font-bold text-emerald-500 shrink-0 min-w-[64px] text-right">{CLP(item.precio * item.cantidadVoz)}</p>
                          <button onClick={() => handleQuitarDelCart(item.id)} className="p-1 text-slate-600 hover:text-red-400 transition shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Total + Cobrar */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                      <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-xl font-black text-emerald-400">{CLP(totalActual)}</p>
                      </div>
                      <button onClick={handleConfirmarTodo}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-black text-sm shadow-md transition"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Cobrar {CLP(totalActual)}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── IDLE sin carrito ── */}
                {state === 'idle' && cartAcumulado.length === 0 && (
                  <div className="flex flex-col items-center py-6">
                    <button onClick={startListening}
                      className="w-14 h-14 bg-gradient-to-br from-violet-600 to-purple-600 rounded-full flex items-center justify-center shadow-xl mb-3"
                    >
                      <Mic className="w-6 h-6 text-white" />
                    </button>
                    <p className="text-sm font-semibold text-white">Tocá para hablar</p>
                    <div className="mt-3 text-center space-y-1">
                      {['🛒 "3 Pepsi y 2 empanadas"', '💰 "cuánto va"', '✅ "cobrar"', '↩️ "deshacer"'].map(tip => (
                        <p key={tip} className="text-[11px] text-slate-500">{tip}</p>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
