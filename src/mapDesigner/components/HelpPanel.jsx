// src/mapDesigner/components/HelpPanel.jsx
// Guía rápida de uso -- el usuario pidió explícitamente "más UI/UX para
// saber usar esto". No reemplaza tooltips (que siguen en cada botón), es
// para la primera vez que alguien abre el editor y no sabe por dónde
// arrancar: cómo mover la cámara, agregar un objeto, editarlo y guardar.
import React from 'react';
import { X, MousePointer2, Move, ZoomIn, Hand } from 'lucide-react';

const STEPS = [
  {
    icon: MousePointer2,
    title: '1. Agregá un objeto',
    body: 'En la barra de Objetos (izquierda en escritorio, botón "Objetos" abajo en celular) arrastrá un edificio o agente hacia el mapa. En celular, tocalo y se agrega solo al centro.',
  },
  {
    icon: Hand,
    title: '2. Moverlo',
    body: 'Hacé clic y arrastrá cualquier objeto para reposicionarlo. Con la cuadrícula (ícono de grilla) y el imán (snap) activados, se acomoda solo a las líneas.',
  },
  {
    icon: Move,
    title: '3. Editarlo',
    body: 'Seleccionalo (clic o toque) y aparecen los tiradores para cambiar su tamaño y rotarlo directo en el mapa, o escribí valores exactos en el panel de Propiedades (derecha, o abajo en celular).',
  },
  {
    icon: ZoomIn,
    title: '4. Moverte por el mapa',
    body: 'Rueda del mouse (o pellizcar con dos dedos en celular) para hacer zoom. Hacé clic y arrastrá sobre el fondo vacío para desplazar la cámara.',
  },
];

const SHORTCUTS = [
  ['Ctrl + Z', 'Deshacer'],
  ['Ctrl + Y', 'Rehacer'],
  ['Ctrl + D', 'Duplicar selección'],
  ['Supr / Backspace', 'Eliminar selección'],
  ['Shift + clic', 'Sumar a la selección'],
];

export default function HelpPanel({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#131a29] border border-white/[0.1] rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">Cómo usar el Map Designer</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          {STEPS.map((step) => {
            const StepIcon = step.icon;
            return (
              <div key={step.title} className="flex gap-3 items-start rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <StepIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white mb-0.5">{step.title}</p>
                  <p className="text-[11.5px] text-zinc-400 leading-relaxed">{step.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Atajos de teclado (escritorio)</p>
        <div className="flex flex-col gap-1 mb-5">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between text-[11.5px] py-1 border-b border-white/[0.05] last:border-0">
              <span className="text-zinc-400">{desc}</span>
              <kbd className="font-mono text-[10.5px] bg-white/[0.08] text-zinc-200 rounded px-1.5 py-0.5">{keys}</kbd>
            </div>
          ))}
        </div>

        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Vistas de dispositivo</p>
        <p className="text-[11.5px] text-zinc-400 leading-relaxed">
          Los botones de Escritorio/Tablet/Celular en la barra superior dibujan un marco verde del tamaño real de esa
          pantalla sobre el mismo mapa, para revisar qué se ve y qué queda afuera en cada tamaño. No crean mapas
          separados: es el mismo mundo visto con distintas cámaras.
        </p>
      </div>
    </div>
  );
}
