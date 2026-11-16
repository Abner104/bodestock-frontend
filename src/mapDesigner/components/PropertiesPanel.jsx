// src/mapDesigner/components/PropertiesPanel.jsx
// Panel de propiedades del/de los objeto(s) seleccionado(s). Con selección
// múltiple, edita el primero (mover X/Y de a uno a la vez es lo único que
// tiene sentido para varios objetos con distintas posiciones); name/type/
// asset se muestran de solo lectura, todo lo demás es editable a mano y
// dispara updateObject de inmediato (el pedido es explícito: "Si cambio X
// de 420 a 500, el objeto debe moverse inmediatamente").
import React from 'react';
import { Trash2, Copy, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { LAYERS, LAYER_LABELS } from '../assetCatalog';

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full text-xs bg-white/[0.06] border border-white/[0.1] text-zinc-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-mono";

export default function PropertiesPanel({ objects, selectedIds, updateObject, onDelete, onDuplicate }) {
  const selected = objects.filter((o) => selectedIds.includes(o.id));
  const primary = selected[0];

  if (!primary) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-xs text-zinc-500 text-center">
          Tocá o hacé clic en cualquier objeto del mapa para ver y editar sus propiedades acá.
        </p>
      </div>
    );
  }

  const set = (patch) => updateObject(primary.id, patch);
  const num = (v, fallback = 0) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-white leading-tight">{primary.name}</p>
        <p className="text-[10.5px] text-zinc-500 font-mono">{primary.id}</p>
        {selected.length > 1 && (
          <p className="text-[10.5px] text-emerald-400 mt-1">+{selected.length - 1} objeto(s) más seleccionados</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onDuplicate}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg py-1.5"
        >
          <Copy className="w-3.5 h-3.5" /> Duplicar
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg py-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> Eliminar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Tipo">
          <input className={inputClass} value={primary.type} disabled />
        </Field>
        <Field label="Asset">
          <input className={inputClass} value={primary.asset} disabled />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Posición X">
          <input type="number" className={inputClass} value={Math.round(primary.x)} onChange={(e) => set({ x: num(e.target.value, primary.x) })} />
        </Field>
        <Field label="Posición Y">
          <input type="number" className={inputClass} value={Math.round(primary.y)} onChange={(e) => set({ y: num(e.target.value, primary.y) })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Ancho">
          <input type="number" className={inputClass} value={Math.round(primary.width)} onChange={(e) => set({ width: Math.max(4, num(e.target.value, primary.width)) })} />
        </Field>
        <Field label="Alto">
          <input type="number" className={inputClass} value={Math.round(primary.height)} onChange={(e) => set({ height: Math.max(4, num(e.target.value, primary.height)) })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Escala">
          <input type="number" step="0.05" className={inputClass} value={primary.scale} onChange={(e) => set({ scale: Math.max(0.05, num(e.target.value, primary.scale)) })} />
        </Field>
        <Field label="Rotación °">
          <input type="number" className={inputClass} value={Math.round(primary.rotation)} onChange={(e) => set({ rotation: num(e.target.value, primary.rotation) })} />
        </Field>
      </div>

      <Field label="Capa">
        <select className={inputClass} value={primary.layer} onChange={(e) => set({ layer: e.target.value })}>
          {LAYERS.map((l) => <option key={l} value={l}>{LAYER_LABELS[l] || l}</option>)}
        </select>
      </Field>

      <Field label="Orden (Z-index)">
        <input type="number" className={inputClass} value={primary.zIndex} onChange={(e) => set({ zIndex: num(e.target.value, primary.zIndex) })} />
      </Field>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => set({ visible: !primary.visible })}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg py-1.5"
        >
          {primary.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {primary.visible ? 'Visible' : 'Oculto'}
        </button>
        <button
          onClick={() => set({ locked: !primary.locked })}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg py-1.5"
        >
          {primary.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {primary.locked ? 'Bloqueado' : 'Libre'}
        </button>
      </div>
    </div>
  );
}
