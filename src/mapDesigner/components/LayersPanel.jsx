// src/mapDesigner/components/LayersPanel.jsx
// Lista de capas con el conteo de objetos en cada una y un toggle de
// visibilidad por capa (oculta todos los objetos de esa capa a la vez,
// útil para trabajar sobre "buildings" sin que "decorations" tape la
// vista). El orden de la lista ES el orden de profundidad (LAYERS ya viene
// ordenado de atrás hacia adelante en assetCatalog.js).
import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { LAYERS, LAYER_LABELS } from '../assetCatalog';

export default function LayersPanel({ objects, hiddenLayers, onToggleLayer, setSelectedIds }) {
  return (
    <div className="p-2 flex flex-col gap-1">
      {LAYERS.map((layer) => {
        const layerObjects = objects.filter((o) => o.layer === layer);
        const isHidden = hiddenLayers.includes(layer);
        return (
          <div
            key={layer}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 bg-white/[0.03] hover:bg-white/[0.06]"
          >
            <button
              className="flex-1 text-left text-xs font-medium text-zinc-200 capitalize truncate"
              onClick={() => setSelectedIds(layerObjects.map((o) => o.id))}
              title="Seleccionar todos los objetos de esta capa"
            >
              {LAYER_LABELS[layer] || layer}
              <span className="ml-1.5 text-[10px] text-zinc-500 font-mono">{layerObjects.length}</span>
            </button>
            <button onClick={() => onToggleLayer(layer)} className="text-zinc-400 hover:text-zinc-200 shrink-0">
              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
