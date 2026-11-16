// src/mapDesigner/components/EditorCanvas.jsx
// El mundo. Un Stage de Konva mostrando una PORCIÓN del mundo (coordenadas
// de mapModel.js) a través de una cámara virtual (viewport: x, y, zoom).
// Nunca escala el DOM del editor -- solo lo que se dibuja adentro del
// Stage, que es justamente el requisito "el mundo puede ser mucho más
// grande que la pantalla" del pedido.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, RegularPolygon, Text, Group, Line, Transformer, Image as KonvaImage } from 'react-konva';
import { getAsset } from '../assetCatalog';
import { LAYERS } from '../assetCatalog';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;

// Carga un HTMLImageElement a partir de una URL/dataURL -- misma idea que
// la lib "use-image", pero sin sumar una dependencia nueva para esto solo.
// Cachea por src: varios objetos del mismo asset (subido o del catálogo
// estático) no vuelven a decodificar la imagen cada uno por su cuenta.
//
// A diferencia de la versión anterior: guarda también el estado de ERROR
// (onerror), no solo loading/loaded -- un sprite que no carga (404, ruta
// mal escrita) quedaba mostrando el placeholder gris para siempre sin
// ningún aviso ("no se ven los edificios que cargué" sin ningún error
// visible era justamente este caso). Ahora un error se ve distinto del
// "cargando" y se loguea una vez en consola.
const imageCache = new Map(); // src -> HTMLImageElement | 'error'
function useHtmlImage(src) {
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!src || imageCache.has(src)) return;
    const el = new window.Image();
    el.onload = () => { imageCache.set(src, el); forceRender((n) => n + 1); };
    el.onerror = () => {
      console.error('No se pudo cargar el sprite:', src);
      imageCache.set(src, 'error');
      forceRender((n) => n + 1);
    };
    el.src = src;
  }, [src]);
  const cached = src ? imageCache.get(src) : null;
  return cached === 'error' ? null : cached || null;
}

// Sprite real (del catálogo estático o subido por el usuario, ver
// userAssetStore.js) -- se dibuja tal cual, sin tintes ni bordes de
// selección propios (el Transformer ya marca la selección con su propio
// borde alrededor de todo el Group).
function SpriteShape({ src, width, height }) {
  const img = useHtmlImage(src);
  if (!img) {
    // Mientras carga, o si falló (404, ruta rota) -- un placeholder
    // visible en vez de dejar el objeto invisible sin ningún indicio.
    return <Rect x={-width / 2} y={-height / 2} width={width} height={height} fill="rgba(255,90,90,0.15)" stroke="rgba(255,90,90,0.4)" dash={[4, 3]} cornerRadius={4} />;
  }
  // imageSmoothingEnabled=false -- los sprites de Kenney son pixel-art
  // nativo de 16x16px estirado varias veces más grande; el suavizado por
  // defecto de Konva los veía borrosos en vez de nítidos.
  return <KonvaImage image={img} x={-width / 2} y={-height / 2} width={width} height={height} imageSmoothingEnabled={false} />;
}

// Placeholder visual por objeto -- para los assets del catálogo base, que
// no tienen sprite real todavía, cada shape se dibuja con Konva
// directamente (ver SpriteShape arriba para los assets con imagen real).
function AssetShape({ asset, width, height, selected }) {
  const stroke = selected ? '#ffffff' : 'rgba(255,255,255,0.18)';
  const strokeWidth = selected ? 2 : 1;
  const common = { fill: asset.color, stroke, strokeWidth };

  switch (asset.shape) {
    case 'building':
      return (
        <Group>
          <Rect x={-width / 2} y={-height / 2} width={width} height={height} cornerRadius={10} {...common} />
          <Rect x={-width / 2} y={-height / 2} width={width} height={14} cornerRadius={[10, 10, 0, 0]} fill="rgba(255,255,255,0.18)" />
        </Group>
      );
    case 'agent':
      return <Circle radius={width / 2} {...common} />;
    case 'circle':
      return <Circle radius={width / 2} {...common} />;
    case 'diamond':
      return <RegularPolygon sides={4} radius={width / 2} rotation={45} {...common} />;
    case 'road-h':
      return <Rect x={-width / 2} y={-height / 2} width={width} height={height} fill={asset.color} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'road-v':
      return <Rect x={-width / 2} y={-height / 2} width={width} height={height} fill={asset.color} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'road-x':
    case 'road-corner':
      return <Rect x={-width / 2} y={-height / 2} width={width} height={height} fill={asset.color} stroke={stroke} strokeWidth={strokeWidth} cornerRadius={6} />;
    case 'zone':
      return (
        <Rect
          x={-width / 2} y={-height / 2} width={width} height={height}
          stroke="rgba(255,255,255,0.4)" strokeWidth={2} dash={[10, 6]} fill="rgba(255,255,255,0.04)" cornerRadius={12}
        />
      );
    case 'rect':
    default:
      return <Rect x={-width / 2} y={-height / 2} width={width} height={height} cornerRadius={4} {...common} />;
  }
}

function WorldObject({ obj, selected, onSelect, onDragEnd, locked }) {
  if (obj.visible === false) return null;
  const asset = getAsset(obj.asset);

  return (
    <Group
      id={obj.id}
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
      scaleX={obj.scale}
      scaleY={obj.scale}
      draggable={!locked}
      onClick={(e) => { e.cancelBubble = true; onSelect(obj.id, e); }}
      onTap={(e) => { e.cancelBubble = true; onSelect(obj.id, e); }}
      onDragEnd={(e) => onDragEnd(obj.id, e.target.x(), e.target.y())}
    >
      {!asset ? (
        // Asset no encontrado en el catálogo (ni estático ni de usuario) --
        // antes esto hacía que TODO el objeto desapareciera del canvas sin
        // ningún aviso ("no se ven los edificios que cargué" sin error
        // visible era justamente este caso). Ahora se ve un placeholder de
        // error en su lugar, así se nota que algo está roto en vez de que
        // el objeto se esfume en silencio.
        <Rect x={-obj.width / 2} y={-obj.height / 2} width={obj.width} height={obj.height} fill="rgba(255,90,90,0.15)" stroke="#ff5a5a" strokeWidth={2} dash={[6, 4]} cornerRadius={4} />
      ) : asset.src ? (
        <SpriteShape src={asset.src} width={obj.width} height={obj.height} />
      ) : (
        <AssetShape asset={asset} width={obj.width} height={obj.height} selected={selected} />
      )}
      {asset?.emoji && (
        <Text
          text={asset.emoji}
          fontSize={Math.min(obj.width, obj.height) * 0.5}
          x={-Math.min(obj.width, obj.height) * 0.25}
          y={-Math.min(obj.width, obj.height) * 0.25}
          listening={false}
        />
      )}
      {asset?.category !== 'roads' && (
        <Text
          text={asset ? obj.name : `${obj.name} (asset "${obj.asset}" no encontrado)`}
          fontSize={11}
          fontStyle="600"
          fill={asset ? '#e8ecf6' : '#ff8a8a'}
          align="center"
          width={Math.max(obj.width, 80)}
          x={-Math.max(obj.width, 80) / 2}
          y={obj.height / 2 + 4}
          listening={false}
        />
      )}
    </Group>
  );
}

function GridLines({ world, viewport }) {
  const lines = [];
  const size = viewport.gridSize;
  if (!size) return null;
  const startX = 0, endX = world.width;
  const startY = 0, endY = world.height;
  for (let x = startX; x <= endX; x += size) {
    lines.push(<Line key={`v${x}`} points={[x, startY, x, endY]} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / viewport.zoom} />);
  }
  for (let y = startY; y <= endY; y += size) {
    lines.push(<Line key={`h${y}`} points={[startX, y, endX, y]} stroke="rgba(255,255,255,0.06)" strokeWidth={1 / viewport.zoom} />);
  }
  return <>{lines}</>;
}

export default function EditorCanvas({
  world,
  objects,
  viewport,
  setViewport,
  selectedIds,
  setSelectedIds,
  gridSize,
  gridVisible,
  onAddObject,
  onMoveObject,
  updateObject,
  hiddenLayers = [],
  devicePreset = null,
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [dragOverAsset, setDragOverAsset] = useState(null);
  const [cursorWorld, setCursorWorld] = useState(null);
  // Solo AssetSidebar escuchaba este evento antes -- un objeto colocado
  // ANTES de que listUserAssets() (async, IndexedDB) terminara de
  // registrar los sprites de usuario quedaba con getAsset() devolviendo
  // null para siempre, sin que nada disparara un re-render de este canvas
  // cuando el catálogo se actualizaba. Ahora también refresca acá.
  const [, forceCatalogRefresh] = useState(0);
  useEffect(() => {
    const onCatalogChange = () => forceCatalogRefresh((n) => n + 1);
    window.addEventListener('map-designer:user-assets', onCatalogChange);
    return () => window.removeEventListener('map-designer:user-assets', onCatalogChange);
  }, []);

  // El Stage llena su contenedor -- ResizeObserver en vez de window.resize
  // porque el contenedor cambia de tamaño también al abrir/cerrar los
  // drawers de mobile, no solo al redimensionar la ventana.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Conversión pantalla -> mundo, usada tanto por el drop de assets como
  // por el click-en-vacío (deseleccionar) y el tap-to-place en mobile.
  const screenToWorld = useCallback((screenX, screenY) => {
    return {
      x: (screenX - stageSize.width / 2) / viewport.zoom + viewport.x,
      y: (screenY - stageSize.height / 2) / viewport.zoom + viewport.y,
    };
  }, [stageSize, viewport]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = direction > 0 ? viewport.zoom * scaleBy : viewport.zoom / scaleBy;
    setViewport({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom)) });
  }, [viewport.zoom, setViewport]);

  const isPanning = useRef(false);
  const panStart = useRef(null);

  const handleStageMouseDown = useCallback((e) => {
    // Click en el fondo (Stage o el rect de fondo) -- inicia paneo y
    // deselecciona; click en un objeto lo maneja WorldObject y detiene la
    // propagación antes de llegar acá.
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'world-bg';
    if (clickedOnEmpty) {
      setSelectedIds([]);
      isPanning.current = true;
      panStart.current = { x: e.evt.clientX, y: e.evt.clientY, vx: viewport.x, vy: viewport.y };
    }
  }, [viewport, setSelectedIds]);

  const handleStageMouseMove = useCallback((e) => {
    const stage = stageRef.current;
    if (stage) {
      const pointer = stage.getPointerPosition();
      if (pointer) setCursorWorld(screenToWorld(pointer.x, pointer.y));
    }
    if (!isPanning.current || !panStart.current) return;
    const dx = (e.evt.clientX - panStart.current.x) / viewport.zoom;
    const dy = (e.evt.clientY - panStart.current.y) / viewport.zoom;
    setViewport({ x: panStart.current.vx - dx, y: panStart.current.vy - dy });
  }, [viewport.zoom, setViewport, screenToWorld]);

  const handleStageMouseUp = useCallback(() => {
    isPanning.current = false;
    panStart.current = null;
  }, []);

  // Pinch-to-zoom + pan de un dedo en touch -- Konva ya emite mousedown/
  // move/up sintéticos para touch de un dedo, así que solo hace falta el
  // caso especial de 2 dedos.
  const pinchRef = useRef(null);
  const handleTouchMove = useCallback((e) => {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    const [t1, t2] = touches;
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    if (pinchRef.current != null) {
      const factor = dist / pinchRef.current;
      setViewport({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor)) });
    }
    pinchRef.current = dist;
  }, [viewport.zoom, setViewport]);
  const handleTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  // Drag & drop HTML5 desde el sidebar de assets (desktop).
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    const assetId = e.dataTransfer.types.includes('application/x-asset-id') ? dragOverAsset : null;
    if (assetId) e.dataTransfer.dropEffect = 'copy';
  }, [dragOverAsset]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('application/x-asset-id');
    if (!assetId) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    onAddObject(assetId, x, y);
    setDragOverAsset(null);
  }, [screenToWorld, onAddObject]);

  // Selección de un objeto -- Transformer de Konva se adjunta al nodo
  // seleccionado para dar los handles de resize/rotate.
  const handleSelect = useCallback((id, evt) => {
    if (evt?.evt?.shiftKey) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    } else {
      setSelectedIds([id]);
    }
  }, [setSelectedIds]);

  useEffect(() => {
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;
    if (selectedIds.length === 0) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const nodes = selectedIds.map((id) => stage.findOne(`#${id}`)).filter(Boolean);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, objects]);

  const handleTransformEnd = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    selectedIds.forEach((id) => {
      const node = stage.findOne(`#${id}`);
      if (!node) return;
      updateObject(id, {
        x: node.x(),
        y: node.y(),
        scale: node.scaleX(),
        rotation: node.rotation(),
      });
    });
  }, [selectedIds, updateObject]);

  const byLayer = {};
  objects.forEach((o) => {
    if (!byLayer[o.layer]) byLayer[o.layer] = [];
    byLayer[o.layer].push(o);
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ background: '#0d1420' }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Layer
          x={stageSize.width / 2 - viewport.x * viewport.zoom}
          y={stageSize.height / 2 - viewport.y * viewport.zoom}
          scaleX={viewport.zoom}
          scaleY={viewport.zoom}
        >
          <Rect name="world-bg" x={0} y={0} width={world.width} height={world.height} fill="#141b2b" />
          {gridVisible && <GridLines world={world} viewport={{ ...viewport, gridSize }} />}
          <Rect x={0} y={0} width={world.width} height={world.height} stroke="rgba(255,255,255,0.15)" strokeWidth={2 / viewport.zoom} listening={false} />

          {LAYERS.filter((layerId) => !hiddenLayers.includes(layerId)).map((layerId) => (
            <Group key={layerId}>
              {(byLayer[layerId] || []).map((obj) => (
                <WorldObject
                  key={obj.id}
                  obj={obj}
                  selected={selectedIds.includes(obj.id)}
                  onSelect={handleSelect}
                  onDragEnd={onMoveObject}
                  locked={obj.locked}
                />
              ))}
            </Group>
          ))}

          <Transformer
            ref={trRef}
            rotateEnabled
            onTransformEnd={handleTransformEnd}
            anchorSize={9}
            borderStroke="#6ee7c2"
            anchorStroke="#6ee7c2"
            anchorFill="#0d1420"
          />
        </Layer>
      </Stage>

      {/* Marco de dispositivo -- punto 7 del pedido: mismo mundo, la cámara/
          viewport cambia según el device elegido en la Toolbar. 1 unidad de
          mundo = 1px de pantalla real a zoom 1, así que el marco mide
          preset.width/height * zoom en pantalla, siempre centrado en el
          punto que mira la cámara (viewport.x/y). Fuera del marco se sigue
          viendo el mundo (para poder seguir editando ahí), pero atenuado,
          dejando claro que ESO no entra en la pantalla de ese device. */}
      {devicePreset && (
        <div
          className="absolute pointer-events-none border-2 border-emerald-400/70"
          style={{
            left: stageSize.width / 2 - (devicePreset.width * viewport.zoom) / 2,
            top: stageSize.height / 2 - (devicePreset.height * viewport.zoom) / 2,
            width: devicePreset.width * viewport.zoom,
            height: devicePreset.height * viewport.zoom,
            boxShadow: '0 0 0 4000px rgba(0,0,0,0.55)',
          }}
        >
          <span className="absolute -top-6 left-0 text-[10.5px] font-semibold text-emerald-300 bg-black/60 rounded px-1.5 py-0.5">
            {devicePreset.label} · {devicePreset.width}×{devicePreset.height}
          </span>
        </div>
      )}

      {/* HUD de coordenadas -- punto 1 del pedido ("mostrar coordenadas
          X/Y"). Muestra la posición del mundo bajo el cursor, no la de
          pantalla, que es la que de verdad importa para posicionar. */}
      {cursorWorld && (
        <div className="absolute bottom-2 left-2 text-[10px] font-mono text-zinc-400 bg-black/50 rounded px-2 py-1 pointer-events-none">
          X {Math.round(cursorWorld.x)} · Y {Math.round(cursorWorld.y)} · zoom {viewport.zoom.toFixed(2)}
        </div>
      )}
    </div>
  );
}
