// src/mapDesigner/useMapEditorState.js
// Estado central del Map Designer: objetos del mundo, selección, cámara,
// grid/snap, y una pila de undo/redo. Vive en un hook (no Context/Redux)
// porque hoy solo lo consume SuperAdminMapDesigner.jsx -- si en el futuro
// el árbol de componentes crece lo suficiente como para que pasar props se
// vuelva incómodo, es el momento de envolverlo en Context, no antes.
import { useCallback, useRef, useState } from 'react';
import { createEmptyWorld, createMapObject, snapToGrid, serializeMap, deserializeMap } from './mapModel';

const HISTORY_LIMIT = 100;

// Snapshot mínimo que entra al historial de undo/redo -- solo "objects"
// cambia con las acciones de edición (mover/agregar/borrar/escalar/rotar/
// propiedades); world/viewport/metadata no forman parte del undo porque no
// son "ediciones de contenido" en el sentido que pide el punto 10 del
// pedido (mover, eliminar, agregar, escalar, rotar, cambiar propiedades).
function snapshotOf(objects) {
  return objects;
}

export function useMapEditorState() {
  const [doc, setDoc] = useState(() => createEmptyWorld());
  const [selectedIds, setSelectedIds] = useState([]);
  const [gridSize, setGridSize] = useState(32);
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [device, setDevice] = useState('desktop');

  const historyRef = useRef({ past: [], future: [] });
  const [historyTick, setHistoryTick] = useState(0); // fuerza re-render cuando cambia can-undo/redo

  const pushHistory = useCallback((prevObjects) => {
    historyRef.current.past.push(snapshotOf(prevObjects));
    if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
    historyRef.current.future = [];
    setHistoryTick((t) => t + 1);
  }, []);

  // Todas las mutaciones de "objects" pasan por acá para no repetir el
  // push-al-historial en cada acción de edición.
  const mutateObjects = useCallback((updater) => {
    setDoc((prev) => {
      const nextObjects = typeof updater === 'function' ? updater(prev.objects) : updater;
      pushHistory(prev.objects);
      return { ...prev, objects: nextObjects };
    });
  }, [pushHistory]);

  const addObject = useCallback((assetId, worldX, worldY, overrides) => {
    const x = snapEnabled ? snapToGrid(worldX, gridSize) : worldX;
    const y = snapEnabled ? snapToGrid(worldY, gridSize) : worldY;
    const obj = createMapObject(assetId, x, y, overrides);
    mutateObjects((objs) => [...objs, obj]);
    setSelectedIds([obj.id]);
    return obj.id;
  }, [gridSize, snapEnabled, mutateObjects]);

  const updateObject = useCallback((id, patch) => {
    mutateObjects((objs) => objs.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, [mutateObjects]);

  const updateObjectPosition = useCallback((id, worldX, worldY) => {
    const x = snapEnabled ? snapToGrid(worldX, gridSize) : worldX;
    const y = snapEnabled ? snapToGrid(worldY, gridSize) : worldY;
    updateObject(id, { x, y });
  }, [snapEnabled, gridSize, updateObject]);

  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    mutateObjects((objs) => objs.filter((o) => !selectedIds.includes(o.id)));
    setSelectedIds([]);
  }, [selectedIds, mutateObjects]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    mutateObjects((objs) => {
      const toDup = objs.filter((o) => selectedIds.includes(o.id));
      const dups = toDup.map((o) => ({
        ...o,
        id: `${o.asset}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
        x: o.x + gridSize,
        y: o.y + gridSize,
      }));
      setSelectedIds(dups.map((d) => d.id));
      return [...objs, ...dups];
    });
  }, [selectedIds, gridSize, mutateObjects]);

  const undo = useCallback(() => {
    setDoc((prev) => {
      const { past, future } = historyRef.current;
      if (past.length === 0) return prev;
      const previousObjects = past.pop();
      future.push(snapshotOf(prev.objects));
      setHistoryTick((t) => t + 1);
      return { ...prev, objects: previousObjects };
    });
  }, []);

  const redo = useCallback(() => {
    setDoc((prev) => {
      const { past, future } = historyRef.current;
      if (future.length === 0) return prev;
      const nextObjects = future.pop();
      past.push(snapshotOf(prev.objects));
      setHistoryTick((t) => t + 1);
      return { ...prev, objects: nextObjects };
    });
  }, []);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const setViewport = useCallback((patch) => {
    setDoc((prev) => ({ ...prev, viewport: { ...prev.viewport, ...patch } }));
  }, []);

  const exportJson = useCallback(() => serializeMap(doc), [doc]);

  const importJson = useCallback((jsonString) => {
    const parsed = deserializeMap(jsonString);
    setDoc(parsed);
    setSelectedIds([]);
    historyRef.current = { past: [], future: [] };
    setHistoryTick((t) => t + 1);
  }, []);

  // Reemplaza el doc entero por uno ya armado afuera (ej. SuperAdminMapDesigner
  // combinando "mapa restaurado de localStorage" + "agentes reales
  // sembrados que faltaban" en un solo objeto antes de aplicarlo) -- mismo
  // efecto que importJson pero sin pasar por serializeMap/deserializeMap,
  // para poder construir el estado inicial en una sola escritura en vez de
  // encadenar varias llamadas async (que es lo que causaba una carrera:
  // leer editor.objects para calcular qué falta sembrar ANTES de que el
  // setDoc de la restauración se hubiera aplicado).
  const loadDoc = useCallback((nextDoc) => {
    setDoc(nextDoc);
    setSelectedIds([]);
    historyRef.current = { past: [], future: [] };
    setHistoryTick((t) => t + 1);
  }, []);

  const resetMap = useCallback(() => {
    setDoc(createEmptyWorld());
    setSelectedIds([]);
    historyRef.current = { past: [], future: [] };
    setHistoryTick((t) => t + 1);
  }, []);

  return {
    doc,
    objects: doc.objects,
    world: doc.world,
    viewport: doc.viewport,
    metadata: doc.metadata,
    selectedIds,
    setSelectedIds,
    gridSize,
    setGridSize,
    gridVisible,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
    device,
    setDevice,
    addObject,
    updateObject,
    updateObjectPosition,
    removeSelected,
    duplicateSelected,
    undo,
    redo,
    canUndo,
    canRedo,
    setViewport,
    exportJson,
    importJson,
    loadDoc,
    resetMap,
    historyTick,
  };
}
