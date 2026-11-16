// src/components/BodestockWorld/WorldControls.jsx
// Controles táctiles grandes (zoom in/out, reset cámara) -- UI HTML
// flotando sobre el canvas, controla la cámara de WorldCanvas vía ref.
import React from 'react';
import { Plus, Minus, Maximize } from 'lucide-react';

export default function WorldControls({ canvasRef, raised }) {
  const btnClass = 'w-11 h-11 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur-sm border border-white/[0.12] text-zinc-200 active:scale-95 transition-transform';

  return (
    <div
      className={`absolute right-4 z-20 flex flex-col gap-2 mb-safe transition-[bottom] duration-200 ${raised ? 'bottom-28' : 'bottom-4'}`}
    >
      <button aria-label="Acercar" className={btnClass} onClick={() => canvasRef.current?.zoomIn()}>
        <Plus className="w-5 h-5" />
      </button>
      <button aria-label="Alejar" className={btnClass} onClick={() => canvasRef.current?.zoomOut()}>
        <Minus className="w-5 h-5" />
      </button>
      <button aria-label="Restablecer vista" className={btnClass} onClick={() => canvasRef.current?.resetCamera()}>
        <Maximize className="w-5 h-5" />
      </button>
    </div>
  );
}
