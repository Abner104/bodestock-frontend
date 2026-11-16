// src/mapDesigner/components/Toolbar.jsx
// Barra de herramientas superior: zoom, grid/snap, device preview,
// undo/redo, guardar/exportar/importar. Un solo componente para desktop Y
// mobile -- en mobile compact=true reduce texto a solo íconos y dos filas
// se acomodan por flex-wrap en vez de mantener layouts separados.
import React, { useRef } from 'react';
import {
  ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, Undo2, Redo2,
  Save, Download, Upload, Monitor, Tablet, Smartphone, HelpCircle,
} from 'lucide-react';
import { DEVICE_PRESETS } from '../mapModel';

const DEVICE_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

function IconButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? 'bg-emerald-500 border-emerald-500 text-black'
          : 'bg-white/[0.05] border-white/[0.08] text-zinc-300 hover:bg-white/[0.1]'
      }`}
    >
      {children}
    </button>
  );
}

export default function Toolbar({
  viewport, setViewport,
  gridVisible, setGridVisible,
  snapEnabled, setSnapEnabled,
  gridSize, setGridSize,
  device, setDevice,
  canUndo, canRedo, undo, redo,
  onSave, onExport, onImport,
  saveStatus,
  onHelp,
}) {
  const fileInputRef = useRef(null);

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImport(reader.result);
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 bg-[#131a29] border-b border-white/[0.08]">
      <div className="flex items-center gap-1">
        <IconButton title="Alejar" onClick={() => setViewport({ zoom: Math.max(0.15, viewport.zoom / 1.2) })}>
          <ZoomOut className="w-4 h-4" />
        </IconButton>
        <span className="text-[10.5px] font-mono text-zinc-400 w-10 text-center">{Math.round(viewport.zoom * 100)}%</span>
        <IconButton title="Acercar" onClick={() => setViewport({ zoom: Math.min(3, viewport.zoom * 1.2) })}>
          <ZoomIn className="w-4 h-4" />
        </IconButton>
        <IconButton title="Centrar mapa" onClick={() => setViewport({ x: 1500, y: 1000, zoom: 1 })}>
          <Maximize className="w-4 h-4" />
        </IconButton>
      </div>

      <div className="w-px h-5 bg-white/[0.1]" />

      <div className="flex items-center gap-1">
        <IconButton title="Mostrar/ocultar cuadrícula" active={gridVisible} onClick={() => setGridVisible((v) => !v)}>
          <Grid3x3 className="w-4 h-4" />
        </IconButton>
        <IconButton title="Ajustar a la cuadrícula al mover objetos" active={snapEnabled} onClick={() => setSnapEnabled((v) => !v)}>
          <Magnet className="w-4 h-4" />
        </IconButton>
        <select
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          className="text-[10.5px] bg-white/[0.05] border border-white/[0.08] text-zinc-300 rounded-lg px-1.5 py-1.5 h-8"
          title="Tamaño de la cuadrícula"
        >
          {[8, 16, 32, 64].map((s) => <option key={s} value={s}>{s}px</option>)}
        </select>
      </div>

      <div className="w-px h-5 bg-white/[0.1]" />

      <div className="flex items-center gap-1">
        <IconButton title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="w-4 h-4" />
        </IconButton>
        <IconButton title="Rehacer (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="w-4 h-4" />
        </IconButton>
      </div>

      <div className="w-px h-5 bg-white/[0.1]" />

      <div className="flex items-center gap-1">
        {Object.entries(DEVICE_PRESETS).map(([key, preset]) => {
          const Icon = DEVICE_ICONS[key];
          return (
            <IconButton key={key} title={`Vista previa ${preset.label} (${preset.width}×${preset.height}px)`} active={device === key} onClick={() => setDevice(key)}>
              <Icon className="w-4 h-4" />
            </IconButton>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <IconButton title="Cómo usar el Map Designer" onClick={onHelp}>
          <HelpCircle className="w-4 h-4" />
        </IconButton>
        {saveStatus && <span className="text-[10.5px] text-emerald-400">{saveStatus}</span>}
        <button onClick={onSave} title="Guardar el mapa en este navegador" className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg px-2.5 py-1.5">
          <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Guardar</span>
        </button>
        <button onClick={onExport} title="Descargar el mapa como archivo .json" className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg px-2.5 py-1.5">
          <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Exportar</span>
        </button>
        <button onClick={handleImportClick} title="Cargar un mapa desde un archivo .json" className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg px-2.5 py-1.5">
          <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importar</span>
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
}
