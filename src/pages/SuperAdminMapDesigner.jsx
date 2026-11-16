// src/pages/SuperAdminMapDesigner.jsx
// Map Designer -- Fase 1 del mundo de la empresa-ciudad de agentes IA.
// Editor visual puro: posiciona edificios/agentes/caminos/decoración en
// coordenadas de mundo y exporta/importa ese mapa como JSON. A propósito
// NO contiene lógica de agentes IA ni dashboard -- ver el pedido original:
// "NO construyas todavía la lógica de los agentes IA / el dashboard
// empresarial completo". El JSON que produce está pensado para que un
// futuro renderer de Phaser 3 lo consuma tal cual (ver mapModel.js).
//
// Desktop (lg+): sidebar de assets a la izquierda, canvas al centro, panel
// de propiedades + capas a la derecha -- todo visible a la vez.
// Mobile/tablet (< lg): el canvas ocupa toda la pantalla, y Assets/
// Properties/Layers viven en bottom sheets que se abren desde la toolbar
// compacta, como pide el punto 9 del prompt ("no reduzcas el desktop,
// adaptá la interfaz").
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, PanelLeft, SlidersHorizontal, Layers as LayersIcon, HelpCircle, Play } from 'lucide-react';
import { useMapEditorState } from '../mapDesigner/useMapEditorState';
import { DEVICE_PRESETS, createMapObject, deserializeMap, createEmptyWorld } from '../mapDesigner/mapModel';
import { registerUserAssets, getAsset } from '../mapDesigner/assetCatalog';
import { listUserAssets } from '../mapDesigner/userAssetStore';
import { getRealAgentSeedPositions } from '../components/agents3d/mapDesignerBridge';
import EditorCanvas from '../mapDesigner/components/EditorCanvas';
import AssetSidebar from '../mapDesigner/components/AssetSidebar';
import PropertiesPanel from '../mapDesigner/components/PropertiesPanel';
import LayersPanel from '../mapDesigner/components/LayersPanel';
import Toolbar from '../mapDesigner/components/Toolbar';
import MobileSheet from '../mapDesigner/components/MobileSheet';
import HelpPanel from '../mapDesigner/components/HelpPanel';
import { downloadJson } from '../mapDesigner/mapModel';

const MAP_STORAGE_KEY = 'bodestockMapDesigner:lastMap';
const HELP_SEEN_KEY = 'bodestockMapDesigner:helpSeen';

export default function SuperAdminMapDesigner() {
  const navigate = useNavigate();
  const editor = useMapEditorState();
  const [hiddenLayers, setHiddenLayers] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');
  const [mobileSheet, setMobileSheet] = useState(null); // 'assets' | 'properties' | 'layers' | null
  // Se abre sola la primera vez que alguien entra a esta herramienta en
  // este navegador (pedido explícito: "dame más UI/UX para saber usar
  // esto") -- después queda disponible bajo demanda desde el botón "?" de
  // la Toolbar, sin volver a interrumpir.
  const [helpOpen, setHelpOpen] = useState(() => {
    try { return !localStorage.getItem(HELP_SEEN_KEY); } catch { return false; }
  });
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch { /* no crítico */ }
  }, []);

  // Carga los sprites que el usuario ya había subido en sesiones previas de
  // este navegador (IndexedDB) ANTES de que el canvas intente dibujar
  // ningún objeto -- si un mapa restaurado/importado referencia un asset
  // de usuario y este registro todavía no corrió, getAsset() no lo
  // encuentra y ese objeto no se dibuja.
  useEffect(() => {
    listUserAssets().then(registerUserAssets);
  }, []);

  const toggleLayer = useCallback((layer) => {
    setHiddenLayers((prev) => (prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]));
  }, []);

  // Cambiar de device (botones Desktop/Tablet/Mobile de la Toolbar) además
  // reencuadra la cámara para que el marco de ese tamaño quede visible
  // entero en pantalla -- antes solo cambiaba una etiqueta de texto en el
  // header y el zoom seguía siendo el que hubiera antes, así que el marco
  // de Mobile (390px) a un zoom pensado para el mundo de 3000px quedaba
  // microscópico o directamente fuera de vista ("las vistas no funcionan").
  const handleDeviceChange = useCallback((deviceKey) => {
    editor.setDevice(deviceKey);
    const preset = DEVICE_PRESETS[deviceKey];
    const availableW = window.innerWidth - (window.innerWidth >= 1024 ? 56 * 2 + 256 : 0);
    const availableH = window.innerHeight - 140;
    const fitZoom = Math.min(availableW / preset.width, availableH / preset.height) * 0.82;
    editor.setViewport({ zoom: Math.max(0.15, Math.min(3, fitZoom)) });
  }, [editor]);

  const handleQuickAdd = useCallback((assetId, opts) => {
    // skipAdd: true lo usa AssetSidebar justo después de subir una imagen
    // nueva -- subir un sprite solo debe guardarlo en la biblioteca, no
    // colocarlo en el mapa (eso lo decide el usuario arrastrándolo o
    // tocándolo después, como cualquier otro asset).
    if (opts?.skipAdd) return;
    editor.addObject(assetId, editor.viewport.x, editor.viewport.y);
    setMobileSheet(null);
  }, [editor]);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(MAP_STORAGE_KEY, editor.exportJson());
      setSaveStatus('Guardado');
      setTimeout(() => setSaveStatus(''), 1500);
    } catch (e) {
      console.error('No se pudo guardar el mapa:', e.message);
      setSaveStatus('Error al guardar');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, [editor]);

  const handleExport = useCallback(() => {
    const name = (editor.metadata?.name || 'bodestock-map').replace(/[^a-z0-9-_]+/gi, '-');
    downloadJson(`${name}.json`, editor.exportJson());
  }, [editor]);

  const handleImport = useCallback((jsonString) => {
    try {
      editor.importJson(jsonString);
    } catch (e) {
      console.error('No se pudo importar el mapa:', e.message);
      window.alert('El archivo no tiene un formato de mapa válido.');
    }
  }, [editor]);

  // Carga automática del último mapa guardado localmente (si existe) y
  // siembra los 4 agentes reales en sus posiciones ACTUALES del mundo 3D
  // si todavía no están puestos en el mapa (pedido explícito: "debería
  // tener la posición real de cada agente en vivo en el Map Designer").
  //
  // Todo el cálculo (restaurar + qué falta sembrar) se hace acá, sobre
  // variables locales, ANTES de tocar el estado del editor una sola vez
  // con loadDoc() -- la versión anterior llamaba editor.importJson(saved)
  // y después leía editor.objects para decidir qué faltaba sembrar, pero
  // importJson es un setState async: en el mismo tick, editor.objects
  // todavía reflejaba el mapa vacío anterior, no el recién restaurado. Esa
  // carrera (sembrar sobre datos viejos) era la causa real de que
  // aparecieran 2 copias de "Agente de Pricing" y faltaran Inventario/
  // Marketing -- no un error en los datos en sí. useRef como guardia
  // (no useState) porque no dispara un re-render al escribirlo, así que no
  // compite consigo mismo si el efecto se re-dispara en el mismo montaje.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let doc;
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY);
      doc = saved ? deserializeMap(saved) : createEmptyWorld();
    } catch (e) {
      console.error('El mapa guardado no se pudo leer, se arranca vacío:', e.message);
      doc = createEmptyWorld();
    }

    // Objetos ya guardados en localStorage llevan grabado el width/height
    // que tenía el catálogo el día que se sembraron -- si después el
    // catálogo cambia (ej. sprite real de Spriteship con otro tamaño
    // natural), un mapa viejo se queda con el tamaño anterior para
    // siempre, porque deserializeMap respeta el valor guardado. Se
    // resincroniza acá el tamaño (no la posición/rotación, que sí son
    // ediciones del usuario) de cualquier objeto cuyo asset siga existiendo
    // en el catálogo, así un cambio de sprite se refleja al recargar sin
    // tener que borrar el mapa guardado.
    const resizedObjects = doc.objects.map((o) => {
      const asset = getAsset(o.asset);
      if (!asset) return o;
      if (o.width === asset.width && o.height === asset.height) return o;
      return { ...o, width: asset.width, height: asset.height };
    });

    const existingAssetIds = new Set(resizedObjects.map((o) => o.asset));
    const seeds = getRealAgentSeedPositions(doc.world).filter((s) => !existingAssetIds.has(s.assetId));
    const seededObjects = seeds.map((seed) =>
      createMapObject(seed.assetId, seed.x, seed.y, { rotation: seed.rotation, name: seed.name })
    );

    editor.loadDoc({ ...doc, objects: [...resizedObjects, ...seededObjects] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- corre una sola vez al montar, a propósito
  }, []);

  // Delete/Backspace para borrar selección, Ctrl/Cmd+Z para undo, Ctrl/Cmd+
  // Shift+Z (o Ctrl+Y) para redo -- solo cuando el foco no está en un input
  // del panel de propiedades (si no, "Backspace" al editar X/Y borraría el
  // objeto en vez de un dígito).
  const handleKeyDown = useCallback((e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selectedIds.length > 0) {
      e.preventDefault();
      editor.removeSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      editor.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      editor.redo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && editor.selectedIds.length > 0) {
      e.preventDefault();
      editor.duplicateSelected();
    }
  }, [editor]);

  const devicePreview = DEVICE_PRESETS[editor.device];

  return (
    <div
      className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto lg:h-[calc(100vh-5rem)] flex flex-col bg-[#0d1420]"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header -- oculto en mobile/tablet (el canvas es fullscreen ahí, ver
          mismo patrón que SuperAdminAgentRoom.jsx). */}
      <div className="hidden lg:flex items-center justify-between gap-3 px-3 py-2 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2">
          <PanelLeft className="w-4 h-4 text-emerald-400" />
          <h1 className="text-sm font-bold text-white">Map Designer</h1>
          <span className="text-[10.5px] text-zinc-500">— vista previa {devicePreview.label} ({devicePreview.width}×{devicePreview.height})</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { handleSave(); navigate('/super-admin/agentes'); }}
            title="Guardar y ver el mundo 3D real (Sala de Agentes)"
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg px-2.5 py-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Vista previa
          </button>
          <button
            onClick={() => navigate('/super-admin')}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Botón cerrar flotante -- solo mobile/tablet, mismo patrón que
          BodestockHQ (esquina opuesta a cualquier otro botón flotante para
          no repetir el bug ya conocido de botones superpuestos). */}
      <button
        onClick={() => navigate('/super-admin')}
        aria-label="Cerrar Map Designer"
        className="lg:hidden absolute top-3 left-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.12] text-zinc-300"
      >
        <X className="w-4 h-4" />
      </button>
      <button
        onClick={() => setHelpOpen(true)}
        aria-label="Cómo usar el Map Designer"
        className="lg:hidden absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.12] text-zinc-300"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <Toolbar
        viewport={editor.viewport}
        setViewport={editor.setViewport}
        gridVisible={editor.gridVisible}
        setGridVisible={editor.setGridVisible}
        snapEnabled={editor.snapEnabled}
        setSnapEnabled={editor.setSnapEnabled}
        gridSize={editor.gridSize}
        setGridSize={editor.setGridSize}
        device={editor.device}
        setDevice={handleDeviceChange}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        undo={editor.undo}
        redo={editor.redo}
        onSave={handleSave}
        onExport={handleExport}
        onImport={handleImport}
        saveStatus={saveStatus}
        onHelp={() => setHelpOpen(true)}
      />

      <div className="flex-1 flex min-h-0">
        {/* Sidebar de assets -- desktop only */}
        <div className="hidden lg:block w-56 border-r border-white/[0.08] shrink-0">
          <AssetSidebar onQuickAdd={handleQuickAdd} />
        </div>

        {/* Canvas -- el mundo se recorta visualmente al frame del device
            elegido (punto 7: "Desktop ejemplo 1920×1080 / Mobile ejemplo
            390×844", mismo mundo, cambia el viewport) mediante un marco
            centrado; fuera de ese marco se sigue viendo el resto del mundo
            atenuado, para dejar claro que el mapa es más grande que la
            pantalla del device. */}
        <div className="flex-1 relative min-w-0">
          <EditorCanvas
            world={editor.world}
            objects={editor.objects}
            viewport={editor.viewport}
            setViewport={editor.setViewport}
            selectedIds={editor.selectedIds}
            setSelectedIds={editor.setSelectedIds}
            gridSize={editor.gridSize}
            gridVisible={editor.gridVisible}
            onAddObject={editor.addObject}
            onMoveObject={editor.updateObjectPosition}
            updateObject={editor.updateObject}
            hiddenLayers={hiddenLayers}
            devicePreset={devicePreview}
          />
        </div>

        {/* Panel derecho -- desktop only: propiedades arriba, capas abajo */}
        <div className="hidden lg:flex flex-col w-64 border-l border-white/[0.08] shrink-0">
          <div className="flex-1 min-h-0 border-b border-white/[0.08]">
            <PropertiesPanel
              objects={editor.objects}
              selectedIds={editor.selectedIds}
              updateObject={editor.updateObject}
              onDelete={editor.removeSelected}
              onDuplicate={editor.duplicateSelected}
            />
          </div>
          <div className="h-56 shrink-0 overflow-y-auto">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500 px-3 pt-2">Capas</p>
            <LayersPanel
              objects={editor.objects}
              hiddenLayers={hiddenLayers}
              onToggleLayer={toggleLayer}
              selectedIds={editor.selectedIds}
              setSelectedIds={editor.setSelectedIds}
            />
          </div>
        </div>
      </div>

      {/* Toolbar inferior compacta -- mobile/tablet only, abre los bottom
          sheets. Reemplaza al sidebar+panel fijos de desktop. */}
      <div className="lg:hidden flex items-center justify-around border-t border-white/[0.08] bg-[#131a29] py-2 shrink-0">
        <button onClick={() => setMobileSheet('assets')} className="flex flex-col items-center gap-0.5 text-zinc-300">
          <PanelLeft className="w-5 h-5" />
          <span className="text-[10px]">Objetos</span>
        </button>
        <button onClick={() => setMobileSheet('properties')} className="flex flex-col items-center gap-0.5 text-zinc-300 relative">
          <SlidersHorizontal className="w-5 h-5" />
          <span className="text-[10px]">Propiedades</span>
          {editor.selectedIds.length > 0 && <span className="absolute -top-0.5 right-1 w-2 h-2 rounded-full bg-emerald-400" />}
        </button>
        <button onClick={() => setMobileSheet('layers')} className="flex flex-col items-center gap-0.5 text-zinc-300">
          <LayersIcon className="w-5 h-5" />
          <span className="text-[10px]">Capas</span>
        </button>
      </div>

      <MobileSheet open={mobileSheet === 'assets'} onClose={() => setMobileSheet(null)} title="Objetos">
        <AssetSidebar onQuickAdd={handleQuickAdd} compact />
      </MobileSheet>

      <MobileSheet open={mobileSheet === 'properties'} onClose={() => setMobileSheet(null)} title="Propiedades">
        <PropertiesPanel
          objects={editor.objects}
          selectedIds={editor.selectedIds}
          updateObject={editor.updateObject}
          onDelete={() => { editor.removeSelected(); setMobileSheet(null); }}
          onDuplicate={editor.duplicateSelected}
        />
      </MobileSheet>

      <MobileSheet open={mobileSheet === 'layers'} onClose={() => setMobileSheet(null)} title="Capas" heightClass="h-[50vh]">
        <LayersPanel
          objects={editor.objects}
          hiddenLayers={hiddenLayers}
          onToggleLayer={toggleLayer}
          selectedIds={editor.selectedIds}
          setSelectedIds={(ids) => { editor.setSelectedIds(ids); setMobileSheet(null); }}
        />
      </MobileSheet>

      <HelpPanel open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
