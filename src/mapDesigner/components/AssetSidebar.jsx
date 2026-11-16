// src/mapDesigner/components/AssetSidebar.jsx
// Biblioteca de assets. En desktop se arrastra (HTML5 drag&drop) hacia el
// canvas; en mobile ese gesto no existe de forma confiable, así que un tap
// llama a onQuickAdd, que el contenedor resuelve agregando el objeto al
// centro de la cámara actual.
//
// Además de los assets del catálogo (formas/emoji placeholder), cada
// categoría tiene un botón "Subir imagen" para cargar los propios kits del
// usuario (Kenney, spritesheets recortados, etc.) -- ver userAssetStore.js.
// Suben a IndexedDB de este navegador y quedan disponibles para arrastrar
// exactamente igual que cualquier asset del catálogo.
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { CATEGORIES, getAssetsByCategory, registerUserAssets } from '../assetCatalog';
import { saveUserAsset, listUserAssets } from '../userAssetStore';

export default function AssetSidebar({ onQuickAdd, compact = false }) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [refreshTick, setRefreshTick] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Carga inicial de los sprites que el usuario ya había subido antes (de
  // sesiones previas en este mismo navegador) y se suscribe a cambios --
  // sin esto, subir una imagen no aparecía hasta recargar la página.
  useEffect(() => {
    let cancelled = false;
    listUserAssets().then((assets) => {
      if (cancelled) return;
      registerUserAssets(assets);
      setRefreshTick((t) => t + 1);
    });
    const onChange = () => setRefreshTick((t) => t + 1);
    window.addEventListener('map-designer:user-assets', onChange);
    return () => { cancelled = true; window.removeEventListener('map-designer:user-assets', onChange); };
  }, []);

  const assets = getAssetsByCategory(activeCategory);

  const handleDragStart = (e, assetId) => {
    e.dataTransfer.setData('application/x-asset-id', assetId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Elegí un archivo de imagen (PNG, JPG o WebP).');
      return;
    }
    setUploading(true);
    try {
      const saved = await saveUserAsset({ file, category: activeCategory });
      const all = await listUserAssets();
      registerUserAssets(all);
      setRefreshTick((t) => t + 1);
      onQuickAdd?.(saved.id, { skipAdd: true }); // no agrega al mapa, solo confirma que quedó disponible
    } catch (err) {
      console.error('No se pudo subir la imagen:', err.message);
      window.alert('No se pudo guardar la imagen. Probá con un archivo más liviano.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex ${compact ? 'flex-col h-full' : 'flex-col h-full'}`}>
      <div className="flex gap-1 overflow-x-auto px-2 pt-2 pb-1 shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-emerald-500 text-black'
                : 'bg-white/[0.06] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="px-2 pt-1.5 shrink-0">
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-dashed border-emerald-500/40 rounded-lg py-1.5 disabled:opacity-50"
          title={`Subir una imagen propia (tu kit) a la categoría "${CATEGORIES.find((c) => c.id === activeCategory)?.label}"`}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {uploading ? 'Subiendo…' : 'Subir imagen'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      <div key={refreshTick} className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
        {assets.map((asset) => (
          <button
            key={asset.id}
            draggable
            onDragStart={(e) => handleDragStart(e, asset.id)}
            onClick={() => onQuickAdd?.(asset.id)}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] p-2.5 cursor-grab active:cursor-grabbing transition-colors text-left"
            title={`Arrastrar "${asset.name}" al mapa (o tocar para agregarlo al centro)`}
          >
            <div
              className="w-full aspect-square rounded-lg flex items-center justify-center text-xl overflow-hidden"
              style={{ background: `${asset.color}33`, border: `1px solid ${asset.color}66` }}
            >
              {asset.src ? (
                <img src={asset.src} alt="" className="w-full h-full object-contain" />
              ) : (
                <span>{asset.emoji || '▫️'}</span>
              )}
            </div>
            <span className="text-[10.5px] text-zinc-300 leading-tight text-center truncate w-full">{asset.name}</span>
          </button>
        ))}
        {assets.length === 0 && (
          <p className="col-span-2 text-xs text-zinc-500 text-center py-6">Sin assets en esta categoría todavía. Subí una imagen o elegí otra categoría.</p>
        )}
      </div>
    </div>
  );
}
