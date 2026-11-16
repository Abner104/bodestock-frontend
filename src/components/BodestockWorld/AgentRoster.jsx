// src/components/BodestockWorld/AgentRoster.jsx
// Barra fija con los 4 agentes -- selector rápido para ir directo a uno sin
// tener que ubicarlo a ojo entre los edificios del mapa. Al tocar uno,
// dispara el mismo comportamiento que tocarlo en el mapa (cámara + ficha).
//
// Mobile: solo avatares circulares, sin nombre -- un chip con nombre
// completo (ver versión desktop) no entra 4 veces en una pantalla angosta
// sin recortarse o depender de scroll horizontal poco obvio ("no se ven
// todos", reporte real). El nombre se ve al tocar uno, en la ficha que ya
// se abre. Desktop sí tiene el ancho de sobra para el chip con nombre, que
// da más contexto sin costo ahí.
import React from 'react';

export default function AgentRoster({ agents, selectedId, unreadByAgent = {}, onSelect, hidden }) {
  if (hidden) return null; // con la ficha de un agente abierta, no hace falta el selector -- evita competir por el mismo espacio abajo
  return (
    <div className="absolute bottom-4 left-0 right-0 z-20 px-3 mb-safe">
      <div className="flex items-center justify-center gap-3 lg:gap-2">
        {agents.map((agent) => {
          const unread = unreadByAgent[agent.id] || 0;
          const isSelected = selectedId === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              aria-label={agent.name}
              className="relative flex items-center gap-2 rounded-full backdrop-blur-sm transition-colors shrink-0
                p-1 lg:pl-1.5 lg:pr-3 lg:py-1.5"
              style={{
                background: isSelected ? `${agent.color}26` : 'rgba(13,20,32,0.7)',
                border: `1px solid ${isSelected ? agent.color : 'rgba(255,255,255,0.12)'}`,
              }}
            >
              <div
                className="w-10 h-10 lg:w-7 lg:h-7 rounded-full overflow-hidden bg-black/30 shrink-0"
                style={{ boxShadow: `0 0 0 1.5px ${agent.color}88` }}
              >
                {agent.image && <img src={agent.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <span className="hidden lg:inline text-xs font-semibold text-zinc-100 whitespace-nowrap">{agent.name}</span>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 lg:static flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-[#0a0b0e] lg:border-0">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
