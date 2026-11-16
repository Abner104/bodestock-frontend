// src/components/inventory/VoiceStockQuery.jsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, AlertCircle, Package } from 'lucide-react';
import { API_URL } from '../../config/env';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

const SILENCE_WARN_MS = 3500;

// Fallback local (sin backend): fuzzy match del texto dicho contra nombre/categoría/alias/SKU.
// Se usa si /api/assistant/voice-stock no responde (offline, endpoint caído, etc.).
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function matchLocal(text, products) {
  const s = norm(text);
  if (!s) return null;
  let best = null;
  let bestScore = 0;
  for (const p of products) {
    const cands = [
      norm(p.name),
      norm(p.category),
      ...(p.aliases || []).map(norm),
      (p.sku || '').toLowerCase(),
      (p.code || '').toLowerCase(),
    ];
    for (const c of cands) {
      if (!c) continue;
      let sc = 0;
      if (s.includes(c) || c.includes(s)) sc = 0.9;
      else {
        const words = c.split(' ').filter((w) => w.length > 2);
        const hit = words.filter((w) => s.includes(w)).length;
        if (words.length) sc = (hit / words.length) * 0.85;
      }
      if (sc > bestScore) {
        bestScore = sc;
        best = p;
      }
    }
  }
  return bestScore >= 0.5 ? best : null;
}

export default function VoiceStockQuery({ companyId, inventoryId, onSearch, products = [] }) {
  const [state, setState] = useState('idle'); // idle | listening | processing | result | error
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const silenceTimer = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const clearTimer = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    setSilenceWarning(false);
  }, []);

  const resetState = useCallback(() => {
    setState('idle');
    setTranscript('');
    setInterim('');
    setResult(null);
    setErrorMsg('');
    setSilenceWarning(false);
    finalTextRef.current = '';
  }, []);

  const stopListening = useCallback(() => {
    clearTimer();
    if (recognitionRef.current) {
      recognitionRef.current._manual = true;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [clearTimer]);

  const processQuery = useCallback(async (text) => {
    if (!text.trim()) { setState('idle'); return; }
    setState('processing');
    try {
      const res = await fetch(`${API_URL}/api/assistant/voice-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, companyId, inventoryId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
      setState('result');
      // Si hay un solo producto encontrado, hacer búsqueda en el inventario
      if (data.productos?.length === 1) {
        onSearch?.(data.productos[0].nombre);
      }
    } catch (err) {
      console.warn('[voz-stock] backend no disponible, usando match local:', err.message);
      // Fallback local: sin backend, buscamos el producto por texto entre los ya cargados
      const local = matchLocal(text, products);
      if (local) {
        setResult({
          respuesta: `${local.name}: ${local.stock ?? 0} ${local.unit || 'u'} en stock${local.salePrice > 0 ? ` · ${CLP(local.salePrice)}` : ''}`,
          productos: [{ nombre: local.name, stock: local.stock ?? 0, unidad: local.unit || 'u', precio: local.salePrice || local.precioVenta || 0 }],
        });
        setState('result');
        onSearch?.(local.name);
      } else {
        setErrorMsg(`No encontré "${text}" en el inventario`);
        setState('error');
      }
    }
  }, [companyId, inventoryId, onSearch, products]);

  const handleStop = useCallback(() => {
    stopListening();
    processQuery(finalTextRef.current);
  }, [stopListening, processQuery]);

  const startListening = useCallback(() => {
    if (!isSupported) { setErrorMsg('Usá Chrome para reconocimiento de voz.'); setState('error'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'es-CL';
    r.continuous = true;
    r.interimResults = true;
    r._manual = false;

    r.onstart = () => { setState('listening'); finalTextRef.current = ''; setTranscript(''); setInterim(''); setSilenceWarning(false); };

    r.onresult = (e) => {
      let fin = '', tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else tmp += t;
      }
      if (fin) { finalTextRef.current += fin; setTranscript(finalTextRef.current); }
      setInterim(tmp);
      clearTimer();
      silenceTimer.current = setTimeout(() => setSilenceWarning(true), SILENCE_WARN_MS);
    };

    r.onend = () => {
      setInterim(''); clearTimer();
      if (!r._manual && finalTextRef.current.trim()) processQuery(finalTextRef.current);
      else if (!r._manual) setState('idle');
    };

    r.onerror = (e) => {
      clearTimer();
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setErrorMsg(`Error: ${e.error}`); setState('error');
    };

    recognitionRef.current = r;
    r.start();
  }, [isSupported, processQuery, clearTimer]);

  useEffect(() => {
    if (!isOpen) { stopListening(); resetState(); }
  }, [isOpen, stopListening, resetState]);

  if (!isSupported) return null;

  return (
    <>
      {/* Botón micrófono al lado del buscador */}
      <button
        onClick={() => { setIsOpen(true); setTimeout(startListening, 300); }}
        className="flex items-center gap-1.5 px-3 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition shadow-sm text-sm font-medium"
        title="Consultar stock por voz"
      >
        <Mic className="w-4 h-4" />
        <span className="hidden sm:inline">Voz</span>
      </button>

      {/* Panel resultado */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden"
            >
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 sm:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-xl flex items-center justify-center">
                    <Package className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Consulta de stock</p>
                    <p className="text-[11px] text-slate-500">Preguntá por cualquier producto</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="p-5">

                {/* Escuchando */}
                {state === 'listening' && (
                  <div className="flex flex-col items-center">
                    <div className="relative flex items-center justify-center mb-5 mt-2">
                      {[1, 2, 3].map(i => (
                        <motion.div
                          key={i}
                          className="absolute rounded-full border-2 border-violet-500/30"
                          style={{ width: 55 + i * 25, height: 55 + i * 25 }}
                          animate={silenceWarning ? { opacity: 0.1 } : { scale: [1, 1.1, 1], opacity: [0.5, 0.1, 0.5] }}
                          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                      <motion.div
                        className={`w-14 h-14 rounded-full flex items-center justify-center relative z-10 ${silenceWarning ? 'bg-slate-700' : 'bg-gradient-to-br from-violet-600 to-purple-600'}`}
                        animate={silenceWarning ? {} : { scale: [1, 1.04, 1] }}
                        transition={{ duration: 0.9, repeat: Infinity }}
                      >
                        <Mic className={`w-6 h-6 ${silenceWarning ? 'text-slate-400' : 'text-white'}`} />
                      </motion.div>
                    </div>

                    <AnimatePresence>
                      {silenceWarning && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-3 text-xs text-amber-400"
                        >
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          ¿Terminaste? Tocá "Consultar"
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="text-xs text-slate-500 mb-4 text-center">
                      Ej: "¿Cuánto stock queda de Pepsi?" · "¿Cuál es el precio del Ron?"
                    </p>

                    <div className="w-full min-h-[44px] px-4 py-3 bg-white/5 rounded-xl border border-white/10 mb-4">
                      <p className="text-sm text-slate-200">
                        {transcript}
                        <span className="text-slate-500 italic">{interim}</span>
                        {!transcript && !interim && <span className="text-slate-600">Tu pregunta aparecerá aquí...</span>}
                      </p>
                    </div>

                    <button
                      onClick={handleStop}
                      disabled={!transcript && !interim}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-30 text-white rounded-xl font-bold text-sm transition"
                    >
                      Consultar
                    </button>
                    <button onClick={() => { stopListening(); resetState(); }} className="mt-2 text-xs text-slate-600 hover:text-slate-400 transition">
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Procesando */}
                {state === 'processing' && (
                  <div className="flex flex-col items-center py-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 rounded-full mb-4"
                      style={{ borderWidth: 3, borderStyle: 'solid', borderColor: '#7c3aed transparent transparent transparent' }}
                    />
                    <p className="text-sm text-white font-semibold mb-1">Consultando...</p>
                    <p className="text-xs text-slate-500 italic text-center">"{transcript}"</p>
                  </div>
                )}

                {/* Resultado */}
                {state === 'result' && result && (
                  <div>
                    {/* Respuesta principal */}
                    <div className="p-4 bg-violet-600/10 border border-violet-500/30 rounded-xl mb-4">
                      <p className="text-sm text-violet-200 font-medium leading-relaxed">{result.respuesta}</p>
                    </div>

                    {/* Productos encontrados */}
                    {result.productos?.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Detalle</p>
                        {result.productos.map((p, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
                              p.stock <= 5 ? 'bg-red-500/20 text-red-400' :
                              p.stock <= 15 ? 'bg-amber-500/20 text-amber-400' :
                              'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {p.stock}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{p.nombre}</p>
                              <p className="text-[11px] text-slate-500">{p.unidad} · {p.precio > 0 ? CLP(p.precio) : 'sin precio'}</p>
                            </div>
                            {/* Badge stock */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.stock <= 5 ? 'bg-red-500/15 text-red-400' :
                              p.stock <= 15 ? 'bg-amber-500/15 text-amber-400' :
                              'bg-emerald-500/15 text-emerald-400'
                            }`}>
                              {p.stock <= 5 ? 'Crítico' : p.stock <= 15 ? 'Bajo' : 'OK'}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Buscar en inventario si hay un producto */}
                    {result.productos?.length === 1 && (
                      <p className="text-[11px] text-slate-500 text-center mb-3">
                        El inventario ya está filtrado por "{result.productos[0].nombre}"
                      </p>
                    )}

                    <button
                      onClick={() => { resetState(); setTimeout(startListening, 300); }}
                      className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl font-semibold text-sm hover:bg-white/10 transition flex items-center justify-center gap-2"
                    >
                      <Mic className="w-4 h-4" />
                      Nueva consulta
                    </button>
                  </div>
                )}

                {/* Error */}
                {state === 'error' && (
                  <div className="flex flex-col items-center py-6">
                    <div className="w-11 h-11 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mb-3">
                      <MicOff className="w-5 h-5 text-red-400" />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">Algo salió mal</p>
                    <p className="text-xs text-slate-400 text-center mb-4">{errorMsg}</p>
                    <button onClick={() => { resetState(); setTimeout(startListening, 300); }} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition">
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Idle */}
                {state === 'idle' && (
                  <div className="flex flex-col items-center py-6">
                    <button onClick={startListening} className="w-14 h-14 bg-gradient-to-br from-violet-600 to-purple-600 rounded-full flex items-center justify-center shadow-xl mb-3">
                      <Mic className="w-6 h-6 text-white" />
                    </button>
                    <p className="text-sm font-semibold text-white">Tocá para preguntar</p>
                    <p className="text-xs text-slate-500 mt-1 text-center">
                      "¿Cuánto stock de Pepsi?" · "¿Precio del Ron?"
                    </p>
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
