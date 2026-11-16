// src/components/BodestockWorld/AgentTooltip.jsx
// Ficha de agente -- panel HTML (no Konva) que se abre al seleccionar un
// agente en el mapa. Diseñada como una "credencial" (avatar + acento de
// color de marca + franja lateral) en vez de una tarjeta SaaS genérica de
// esquinas cuadradas: el mundo de fondo es un diorama con carácter propio,
// y una tarjeta gris plana rompía esa identidad. Vive fuera del Stage,
// posicionado con Tailwind, no con coordenadas de canvas.
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ClipboardList, ArrowUpRight } from 'lucide-react';

const STATUS_LABELS = {
  AVAILABLE: 'Disponible',
  WORKING: 'Trabajando',
  THINKING: 'Pensando',
  WAITING: 'En espera',
  ALERT: 'Alerta',
  OFFLINE: 'Fuera de línea',
};

const STATUS_DOT = {
  AVAILABLE: '#60a5fa',
  WORKING: '#34d399',
  THINKING: '#9aa5b8',
  WAITING: '#f2b84b',
  ALERT: '#f87171',
  OFFLINE: '#52525b',
};

const DEFAULT_ACCENT = '#9aa5b8';

export default function AgentTooltip({ entity, onClose, onViewTasks, companyName }) {
  const accent = entity?.color || DEFAULT_ACCENT;

  return (
    <AnimatePresence>
      {entity && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xs z-20 mb-safe"
        >
          <div
            className="relative flex items-stretch gap-0 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(165deg, #16171f 0%, #0e0f15 100%)',
              border: `1px solid ${accent}33`,
              boxShadow: `0 12px 32px -8px ${accent}40, 0 0 0 1px rgba(255,255,255,0.03) inset`,
            }}
          >
            {/* Franja de acento -- identifica el agente por color incluso
                de reojo, mismo criterio que un separador de credencial. */}
            <div className="w-1.5 shrink-0" style={{ background: accent }} />

            <div className="flex-1 p-3.5 pr-9 flex gap-3">
              {entity.image && (
                <div
                  className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-black/30 flex items-center justify-center"
                  style={{ boxShadow: `0 0 0 2px ${accent}55` }}
                >
                  <img src={entity.image} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{entity.name}</p>
                <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                  {entity.summary || entity.role}
                </p>

                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: STATUS_DOT[entity.status] || STATUS_DOT.AVAILABLE }}
                    />
                    <span className="text-[11px] font-semibold text-zinc-300">
                      {STATUS_LABELS[entity.status] || entity.status}
                    </span>
                  </div>
                  {onViewTasks && (
                    <button
                      onClick={() => onViewTasks(entity.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold shrink-0"
                      style={{ color: accent }}
                    >
                      <ClipboardList className="w-3 h-3" /> Ver tareas
                    </button>
                  )}
                </div>

                {/* Lleva a la página completa de tablas/gráficos del
                    agente -- distinto de "Ver tareas" (alertas rápidas),
                    esto es el detalle a fondo. Texto honesto: no es un
                    chat, es un panel de datos. */}
                {entity.route && (
                  <a
                    href={companyName ? `${entity.route}?company=${encodeURIComponent(companyName)}` : entity.route}
                    className="flex items-center gap-1 text-[11px] font-semibold mt-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Ver panel completo <ArrowUpRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
