// src/mapDesigner/components/MobileSheet.jsx
// Bottom sheet genérico -- lo usan tanto el drawer de Assets como el de
// Properties en mobile (punto 9 del pedido: "Assets mediante drawer/bottom
// sheet, Properties mediante bottom sheet"). Un solo componente en vez de
// dos implementaciones para no duplicar la mecánica de abrir/cerrar.
import React from 'react';
import { X } from 'lucide-react';

export default function MobileSheet({ open, onClose, title, children, heightClass = 'h-[60vh]' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-[#131a29] border-t border-white/[0.1] rounded-t-2xl ${heightClass} flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] shrink-0">
          <span className="text-sm font-semibold text-white">{title}</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
