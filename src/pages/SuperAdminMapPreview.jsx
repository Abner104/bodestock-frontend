// src/pages/SuperAdminMapPreview.jsx
// Fase 2: "Map Designer -> JSON -> Phaser Renderer" (punto 14 del pedido
// original). Esta página NO edita nada -- carga un mapa (el último
// guardado desde el Map Designer, o uno importado a mano) y lo muestra
// jugable con Phaser: cámara con pan/zoom sobre el mundo real. Sin lógica
// de agentes IA ni dashboard todavía, eso es Fase 3/4.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, Pencil, RefreshCw } from 'lucide-react';
import { deserializeMap } from '../mapDesigner/mapModel';
import { registerUserAssets } from '../mapDesigner/assetCatalog';
import { listUserAssets } from '../mapDesigner/userAssetStore';
import PhaserMapPreview from '../mapDesigner/components/PhaserMapPreview';

const MAP_STORAGE_KEY = 'bodestockMapDesigner:lastMap';

export default function SuperAdminMapPreview() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [mapDoc, setMapDoc] = useState(null);
  const [error, setError] = useState('');
  const [assetsReady, setAssetsReady] = useState(false);
  // Fuerza un remount completo de PhaserMapPreview (ver comentario en ese
  // archivo: el juego no reacciona solo a un mapDoc nuevo) cada vez que se
  // carga un mapa distinto.
  const [instanceKey, setInstanceKey] = useState(0);

  useEffect(() => {
    listUserAssets().then((assets) => {
      registerUserAssets(assets);
      setAssetsReady(true);
    });
  }, []);

  const loadFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY);
      if (!saved) {
        setError('Todavía no guardaste ningún mapa desde el Map Designer en este navegador.');
        return;
      }
      const parsed = deserializeMap(saved);
      setMapDoc(parsed);
      setError('');
      setInstanceKey((k) => k + 1);
    } catch (e) {
      setError('El último mapa guardado no se pudo leer: ' + e.message);
    }
  }, []);

  // Carga automática al entrar -- el caso de uso principal es "vengo del
  // Map Designer después de tocar Guardar", así que el preview debe
  // aparecer solo, sin un paso extra de "cargar".
  useEffect(() => {
    if (assetsReady) loadFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsReady]);

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = deserializeMap(reader.result);
        setMapDoc(parsed);
        setError('');
        setInstanceKey((k) => k + 1);
      } catch (err) {
        setError('El archivo no tiene un formato de mapa válido: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto lg:h-[calc(100vh-5rem)] flex flex-col bg-[#0d1420]">
      <div className="hidden lg:flex items-center justify-between gap-3 px-3 py-2 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-white">Vista previa del mapa</h1>
          {mapDoc && <span className="text-[10.5px] text-zinc-500">— {mapDoc.metadata?.name || 'Sin nombre'} · {mapDoc.objects.length} objetos</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadFromStorage} title="Recargar el último mapa guardado" className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg px-2.5 py-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Recargar
          </button>
          <button onClick={handleImportClick} className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 rounded-lg px-2.5 py-1.5">
            <Upload className="w-3.5 h-3.5" /> Importar JSON
          </button>
          <button onClick={() => navigate('/super-admin/map-designer')} className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg px-2.5 py-1.5">
            <Pencil className="w-3.5 h-3.5" /> Editar mapa
          </button>
          <button onClick={() => navigate('/super-admin')} className="text-xs text-zinc-400 hover:text-zinc-200 ml-1">Cerrar</button>
        </div>
      </div>

      <button
        onClick={() => navigate('/super-admin')}
        aria-label="Cerrar vista previa"
        className="lg:hidden absolute top-3 left-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.12] text-zinc-300"
      >
        <X className="w-4 h-4" />
      </button>
      <button
        onClick={() => navigate('/super-admin/map-designer')}
        aria-label="Editar mapa"
        className="lg:hidden absolute top-3 right-3 z-20 flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 text-black rounded-lg px-2.5 py-1.5"
      >
        <Pencil className="w-3.5 h-3.5" /> Editar
      </button>

      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />

      <div className="flex-1 relative min-h-0">
        {mapDoc && assetsReady ? (
          <PhaserMapPreview key={instanceKey} mapDoc={mapDoc} />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <p className="text-sm text-zinc-300 mb-2">
                {error || 'Cargando...'}
              </p>
              {error && (
                <button onClick={() => navigate('/super-admin/map-designer')} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                  Ir al Map Designer para crear uno →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
