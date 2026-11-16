// src/components/inventory/VoiceOrderButton.jsx
// Búsqueda/agregado de platos por voz para el POS del garzón.
// Reusa el motor de reconocimiento y matching fuzzy de VoiceSaleButton, pero con
// una UI y comandos propios de "tomar pedido de mesa" — sin cobro, vuelto, ni
// conceptos de caja que no aplican acá (el pedido se cobra recién al cerrar la mesa).
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Check, AlertCircle } from 'lucide-react';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const SILENCE_WARN_MS = 4500;
const CANCEL_WORDS = ['cancelar', 'borrar todo', 'empezar de nuevo'];
const UNDO_WORDS   = ['deshacer', 'quita el ultimo', 'borra el ultimo', 'quitar ultimo', 'el ultimo no', 'ese no'];
const REMOVE_WORDS = ['quita', 'borra', 'elimina', 'saca'];

const NUMEROS = {
  'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
};

function normalizarTexto(t) {
  return (t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function extraerCantidad(fragmento) {
  const f = normalizarTexto(fragmento);
  const matchNum = f.match(/(\d+)\s*$/);
  if (matchNum) return parseInt(matchNum[1], 10);
  for (const [palabra, num] of Object.entries(NUMEROS)) {
    const re = new RegExp(`\\b${palabra}\\b`);
    if (re.test(f)) return num;
  }
  return 1;
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

function scoreSimilitud(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.95;
  const aSinEsp = a.replace(/\s+/g, ''), bSinEsp = b.replace(/\s+/g, '');
  if (aSinEsp === bSinEsp) return 0.98;
  if (aSinEsp.includes(bSinEsp) || bSinEsp.includes(aSinEsp)) return 0.92;
  const dist = levenshtein(aSinEsp, bSinEsp);
  const maxLen = Math.max(aSinEsp.length, bSinEsp.length);
  const score = 1 - dist / maxLen;
  if (score >= 0.75) return score;
  const palabrasNombre = a.split(' ').filter(p => p.length > 2);
  const palabrasTexto = b.split(' ');
  if (palabrasNombre.length > 0) {
    const matchCount = palabrasNombre.filter(pn =>
      palabrasTexto.some(pt => pt.includes(pn) || pn.includes(pt) || levenshtein(pn, pt) <= Math.max(1, Math.floor(pn.length * 0.3)))
    ).length;
    const ratio = matchCount / palabrasNombre.length;
    if (ratio >= 0.8) return 0.8 + ratio * 0.1;
  }
  return 0;
}

function matchProducto(texto, producto) {
  const t = normalizarTexto(texto);
  const nombre = normalizarTexto(producto.name || '');
  const aliases = (producto.aliases || []).map(normalizarTexto).filter(a => a.length > 1);
  const palabrasTexto = t.split(' ');
  const palabrasNombre = nombre.split(' ');
  const ventanas = [];
  for (let i = 0; i <= palabrasTexto.length - palabrasNombre.length; i++) {
    ventanas.push(palabrasTexto.slice(i, i + palabrasNombre.length + 1).join(' '));
  }
  const candidatos = [t, ...ventanas];
  const THRESHOLD = 0.72;
  for (const cand of candidatos) {
    const s = scoreSimilitud(nombre, cand);
    if (s >= THRESHOLD) return { match: true, score: s };
  }
  for (const a of aliases) {
    for (const cand of candidatos) {
      const s = scoreSimilitud(a, cand);
      if (s >= THRESHOLD) return { match: true, score: s };
    }
  }
  return { match: false, score: 0 };
}

function parsearTranscript(text, productos) {
  const texto = normalizarTexto(text);
  const resultado = [];
  const yaAgregados = new Set();
  const segmentos = texto.split(/\s+(?:y|mas|tambien|ademas|con|,)\s+/);
  const todosSegmentos = [texto, ...segmentos];

  for (const seg of todosSegmentos) {
    const candidatos = productos
      .filter(p => !yaAgregados.has(p.id))
      .map(p => ({ producto: p, ...matchProducto(seg, p) }))
      .filter(c => c.match)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    for (const { producto } of candidatos) {
      if (yaAgregados.has(producto.id)) continue;
      const nombreNorm = normalizarTexto(producto.name || '');
      const posMatch = seg.indexOf(nombreNorm);
      const fragmentoAntes = posMatch > 0 ? seg.substring(0, posMatch) : seg;
      const cantidad = extraerCantidad(fragmentoAntes || '');
      yaAgregados.add(producto.id);
      resultado.push({ producto, cantidad });
    }
  }
  return resultado;
}

function detectarRemover(texto, carrito) {
  const t = normalizarTexto(texto);
  if (!REMOVE_WORDS.some(w => t.includes(w))) return null;
  let textoSinCmd = t;
  for (const w of REMOVE_WORDS) textoSinCmd = textoSinCmd.replace(w, '').trim();
  for (const item of carrito) {
    const nombre = normalizarTexto(item.name);
    if (nombre.includes(textoSinCmd) || textoSinCmd.includes(nombre)) return item;
  }
  return null;
}

export default function VoiceOrderButton({ productos = [], onAddItems }) {
  const [state, setState] = useState('idle'); // idle | listening | error
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState(null); // último plato agregado, para feedback visual
  const [sessionCart, setSessionCart] = useState([]); // lo agregado en esta sesión de voz

  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const silenceWarnTimer = useRef(null);
  const sessionCartRef = useRef([]);
  // r.onresult se registra una sola vez cuando arranca el reconocimiento y su
  // closure queda fija — sin este ref, seguiría viendo el "productos" (a menudo
  // vacío) del primer render en vez de la lista ya cargada del inventario.
  const productosRef = useRef(productos);
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => { sessionCartRef.current = sessionCart; }, [sessionCart]);
  useEffect(() => { productosRef.current = productos; }, [productos]);

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

  const startListening = useCallback(() => {
    if (!isSupported) { setErrorMsg('Este dispositivo no soporta reconocimiento de voz.'); setState('error'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'es-CL';
    // Siempre continuo: en el POS de mesa el garzón puede pedir varios platos
    // seguidos con pausas naturales — cortar tras la primera pausa (como hacía
    // el modo no-continuo en desktop) es justo lo que rompía el efecto "en vivo".
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r._manualStop = false;

    r.onstart = () => {
      setState('listening');
      setSilenceWarning(false);
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
      if (fin) {
        const fragment = fin.trim();
        finalTextRef.current = fragment;
        setTranscript(fragment);
        processFragment(fragment);
      }
      setInterimTranscript(tmp);
      clearSilenceTimer();
      silenceWarnTimer.current = setTimeout(() => setSilenceWarning(true), SILENCE_WARN_MS);
    };

    r.onend = () => {
      setInterimTranscript('');
      clearSilenceTimer();
      if (r._manualStop) { setState('idle'); return; }
      // Se cortó solo (silencio largo) — reintentar para mantener la sesión "viva"
      // salvo que el usuario haya cerrado el modal.
      if (isOpenRef.current) {
        try { r.start(); } catch { setState('idle'); }
      }
    };

    r.onerror = (e) => {
      clearSilenceTimer();
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed') { setErrorMsg('Permiso de micrófono denegado.'); setState('error'); return; }
      setErrorMsg(`Error: ${e.error}`); setState('error');
    };

    recognitionRef.current = r;
    finalTextRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    try { r.start(); } catch { setErrorMsg('No se pudo iniciar el micrófono.'); setState('error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, clearSilenceTimer]);

  const isOpenRef = useRef(false);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Procesa cada fragmento final apenas se detecta — no espera a que el garzón
  // termine de hablar del todo, así el pedido se va armando en vivo.
  const processFragment = useCallback((text) => {
    const t = normalizarTexto(text);
    if (!t) return;

    if (CANCEL_WORDS.some(w => t.includes(w))) {
      setSessionCart([]);
      sessionCartRef.current = [];
      return;
    }

    if (UNDO_WORDS.some(w => t.includes(w))) {
      const nuevo = sessionCartRef.current.slice(0, -1);
      setSessionCart(nuevo);
      sessionCartRef.current = nuevo;
      return;
    }

    const removido = detectarRemover(text, sessionCartRef.current);
    if (removido) {
      const nuevo = sessionCartRef.current.filter(i => i.productId !== removido.productId);
      setSessionCart(nuevo);
      sessionCartRef.current = nuevo;
      return;
    }

    const encontrados = parsearTranscript(text, productosRef.current);
    if (encontrados.length === 0) return;

    const items = encontrados.map(({ producto, cantidad }) => ({
      productId: producto.id,
      name: producto.name,
      price: producto.salePrice || producto.precioVenta || 0,
      qty: cantidad,
      station: producto.printStation || 'kitchen',
    }));

    setSessionCart(prev => {
      const next = [...prev];
      for (const item of items) {
        const idx = next.findIndex(i => i.productId === item.productId);
        if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + item.qty };
        else next.push(item);
      }
      sessionCartRef.current = next;
      return next;
    });
    setLastAdded(items[items.length - 1]);
    setTimeout(() => setLastAdded(null), 1800);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setSessionCart([]);
    sessionCartRef.current = [];
    setTimeout(startListening, 250);
  };

  const handleClose = () => {
    stopListening();
    setIsOpen(false);
    if (sessionCartRef.current.length > 0) {
      onAddItems(sessionCartRef.current);
    }
    setSessionCart([]);
    sessionCartRef.current = [];
    setState('idle');
  };

  if (!isSupported) return null;

  const sessionTotal = sessionCart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpen}
        className="flex items-center justify-center w-12 h-12 flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-lg transition-all"
        title="Pedir por voz"
      >
        <Mic className="w-5 h-5" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && handleClose()}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-slate-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 sm:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <p className="text-sm font-bold text-white">Pedido por voz</p>
                  <p className="text-[11px] text-slate-500">
                    {state === 'listening' ? '🎙️ Escuchando...' : 'Decí los platos que quiere la mesa'}
                  </p>
                </div>
                <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-lg transition">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="p-4">
                {state === 'error' ? (
                  <div className="flex flex-col items-center py-6">
                    <MicOff className="w-10 h-10 text-red-400 mb-3" />
                    <p className="text-sm font-semibold text-white mb-1">Algo salió mal</p>
                    <p className="text-xs text-slate-400 text-center mb-4">{errorMsg}</p>
                    <button onClick={startListening} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition">
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Mic animado */}
                    <div className="relative flex items-center justify-center mb-4 mt-2">
                      {[1, 2, 3].map(i => (
                        <motion.div key={i}
                          className="absolute rounded-full border-2 border-violet-500/40"
                          style={{ width: 48 + i * 22, height: 48 + i * 22 }}
                          animate={interimTranscript
                            ? { scale: [1, 1 + i * 0.1, 1], opacity: [0.6, 0.15, 0.6] }
                            : { scale: [1, 1.05, 1], opacity: [0.25, 0.08, 0.25] }}
                          transition={{ duration: interimTranscript ? 0.4 : 1.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                      <div className="w-12 h-12 rounded-full flex items-center justify-center relative z-10 bg-gradient-to-br from-violet-600 to-purple-600">
                        <Mic className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    {/* Transcripción en vivo — esto es lo que se veía "trabado" antes */}
                    <div className="w-full min-h-[52px] px-4 py-3 bg-white/5 rounded-xl border border-white/10 mb-1">
                      <p className="text-sm text-slate-200 leading-relaxed">
                        <span className="text-slate-500">{transcript}</span>{' '}
                        <span className="text-white font-medium">{interimTranscript}</span>
                        {!transcript && !interimTranscript && (
                          <span className="text-slate-600">Decí, por ejemplo: "dos lomo a lo pobre y un pisco sour"...</span>
                        )}
                      </p>
                    </div>

                    {silenceWarning && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-2 text-xs text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Tocá la X cuando termines de pedir
                      </div>
                    )}

                    {/* Feedback del último plato agregado */}
                    <AnimatePresence>
                      {lastAdded && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-3"
                        >
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-xs font-semibold text-emerald-300">
                            {lastAdded.qty}× {lastAdded.name} agregado
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Lo que se lleva agregado en esta sesión de voz */}
                    {sessionCart.length > 0 && (
                      <div className="border-t border-white/10 pt-3">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Agregado ahora</p>
                        <div className="space-y-1.5 mb-2">
                          {sessionCart.map(item => (
                            <div key={item.productId} className="flex items-center justify-between text-sm">
                              <span className="text-slate-300">{item.qty}× {item.name}</span>
                              <span className="text-slate-500">{CLP(item.price * item.qty)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <span className="text-xs text-slate-500">Subtotal</span>
                          <span className="text-sm font-bold text-emerald-400">{CLP(sessionTotal)}</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleClose}
                      className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {sessionCart.length > 0 ? 'Listo, agregar al pedido' : 'Cerrar'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
