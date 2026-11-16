// src/components/inventory/modals/PromoVolumenEditor.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-react';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

export default function PromoVolumenEditor({ promociones = [], onChange, precioBase = 0 }) {
  const [expanded, setExpanded] = useState(false);

  const agregar = () => {
    const nuevas = [
      ...promociones,
      { id: Date.now(), desde: '', precioUnitario: '', etiqueta: '' }
    ];
    onChange(nuevas);
    setExpanded(true);
  };

  const actualizar = (id, campo, valor) => {
    onChange(promociones.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  };

  const eliminar = (id) => {
    onChange(promociones.filter(p => p.id !== id));
  };

  // Ordenar para el preview
  const promoOrdenadas = [...promociones]
    .filter(p => p.desde > 0 && p.precioUnitario > 0)
    .sort((a, b) => a.desde - b.desde);

  return (
    <div className="border-2 border-orange-200 dark:border-orange-800 rounded-xl overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-950/60 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <Tag className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-orange-900 dark:text-orange-200">Promociones por volumen</p>
            <p className="text-[11px] text-orange-600/70 dark:text-orange-400/70">
              {promociones.length === 0
                ? 'A partir de X unidades, precio especial'
                : `${promociones.length} promo${promociones.length > 1 ? 's' : ''} configurada${promociones.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-orange-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-orange-500 shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 bg-white dark:bg-slate-800/50">

              {/* Precio base referencia */}
              {precioBase > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Precio normal:</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{CLP(precioBase)} / unidad</span>
                </div>
              )}

              {/* Lista de promos */}
              <AnimatePresence>
                {promociones.map((promo, idx) => (
                  <motion.div
                    key={promo.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3 border border-orange-200 dark:border-orange-800 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 space-y-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-orange-700 dark:text-orange-400">
                        Promo #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminar(promo.id)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Desde X unidades */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                          Desde (unidades)
                        </label>
                        <input
                          type="number"
                          min="2"
                          step="1"
                          value={promo.desde}
                          onChange={(e) => actualizar(promo.id, 'desde', parseInt(e.target.value) || '')}
                          placeholder="Ej: 3"
                          className="w-full px-3 py-2 text-sm font-bold text-center border-2 border-orange-200 dark:border-orange-800 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:border-orange-500 outline-none"
                        />
                      </div>

                      {/* Precio unitario especial */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                          Precio c/u ($)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={promo.precioUnitario}
                            onChange={(e) => actualizar(promo.id, 'precioUnitario', parseInt(e.target.value) || '')}
                            placeholder="Ej: 1500"
                            className="w-full pl-7 pr-2 py-2 text-sm font-bold text-center border-2 border-orange-200 dark:border-orange-800 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:border-orange-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Etiqueta opcional */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                        Etiqueta (opcional)
                      </label>
                      <input
                        type="text"
                        value={promo.etiqueta}
                        onChange={(e) => actualizar(promo.id, 'etiqueta', e.target.value)}
                        placeholder='Ej: "Pack x3", "Precio mayorista"'
                        className="w-full px-3 py-2 text-sm border-2 border-orange-200 dark:border-orange-800 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:border-orange-500 outline-none"
                      />
                    </div>

                    {/* Preview del ahorro */}
                    {promo.desde >= 2 && promo.precioUnitario > 0 && precioBase > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                          Ahorro por unidad
                        </span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                          {CLP(precioBase - promo.precioUnitario)}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Botón agregar */}
              <button
                type="button"
                onClick={agregar}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Agregar promoción
              </button>

              {/* Preview final de escalera de precios */}
              {promoOrdenadas.length > 0 && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Escalera de precios
                  </p>
                  <div className="space-y-1.5">
                    {precioBase > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-slate-400">1 unidad</span>
                        <span className="font-bold text-gray-800 dark:text-slate-200">{CLP(precioBase)}</span>
                      </div>
                    )}
                    {promoOrdenadas.map((p, i) => {
                      const siguiente = promoOrdenadas[i + 1];
                      const rango = siguiente
                        ? `${p.desde} – ${siguiente.desde - 1} unidades`
                        : `${p.desde}+ unidades`;
                      return (
                        <div key={p.id} className="flex justify-between text-xs">
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            {rango} {p.etiqueta ? `· ${p.etiqueta}` : ''}
                          </span>
                          <span className="font-black text-orange-700 dark:text-orange-300">{CLP(p.precioUnitario)} c/u</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
