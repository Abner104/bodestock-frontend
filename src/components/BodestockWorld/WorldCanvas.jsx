// src/components/BodestockWorld/WorldCanvas.jsx
// Stage de Konva + cámara virtual (scale/offsetX/offsetY) para Bodestock
// World. Contiene zoom (wheel + pinch de 2 dedos), pan (drag) y doble click
// para zoom -- el mismo trío de gestos que ya probamos en el Map Designer,
// pero acá la cámara vive en un solo objeto simple (no el modelo de mapa
// completo) porque este canvas no edita nada, solo navega.
//
// El zoom mínimo es un HÍBRIDO entre "cover" y "contain", no uno puro:
// - cover puro (llenar toda la pantalla) en un mundo ancho-y-bajo
//   (1600x914) dentro de una pantalla angosta-y-alta como un celular
//   forzaba un scale grande para tapar el alto, mostrando de lado a lado
//   solo una franja angosta muy acercada del mapa ("no da lo suficiente
//   para mostrar todo").
// - contain puro (mundo completo siempre visible) resolvía eso pero
//   dejaba tanto espacio negro arriba/abajo en pantallas muy verticales
//   que el mapa quedaba chico y perdido ("tiene que ser más alto que
//   ancho, o dar más mapa").
// La solución: el piso de zoom nunca deja ver menos de
// MIN_VISIBLE_WIDTH_RATIO del ancho del mundo (siempre hay contexto
// horizontal suficiente), pero tampoco fuerza MÁS zoom del que ya pide
// "contain" cuando ese ya alcanza (desktop, donde cover se ve bien sin
// este límite). Queda algo de negro arriba/abajo en pantallas muy
// verticales, pero mucho menos que contain puro, y nunca tan acercado
// como cover puro.
const MIN_VISIBLE_WIDTH_RATIO = 0.7;

// TODO cambio de cámara pasa por clampCamera(), el único lugar que aplica
// el límite de zoom.
//
// Todo lo que se dibuja adentro (background, agentes, edificios, líneas) es
// hijo de un único Konva.Group cuya posición/escala refleja la cámara --
// así el resto de los componentes trabaja siempre en coordenadas de MUNDO
// (0,0)-(width,height), nunca en coordenadas de pantalla.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Stage, Layer, Group } from 'react-konva';
import Konva from 'konva';

function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

function getCenter(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

const WorldCanvas = forwardRef(function WorldCanvas({
  worldWidth,
  worldHeight,
  maxScale = 3,
  onBackgroundClick,
  children,
}, ref) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const [camera, setCamera] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const pinchRef = useRef(null); // { dist, center } del gesto de pellizco en curso

  // Piso real del zoom -- el scale híbrido de computeMinScale() (ver
  // comentario arriba) para el tamaño de pantalla actual, recalculado en
  // cada resize.
  const minScaleRef = useRef(0.5);

  // Único punto que decide un (scale, offsetX, offsetY) válido -- clampea
  // el scale al piso y centra el offset en el eje donde el mundo visible
  // (w/scale o h/scale) queda MÁS CHICO que el mundo total: ahí no hay
  // "borde" real para pegarse, así que en vez de forzar offset 0 (lo que
  // pegaría el mapa a una esquina) se reparte el espacio de sobra en partes
  // iguales a los dos lados, dejando el mundo centrado con el fondo del
  // Stage asomando parejo alrededor. En el eje donde el mundo visible es
  // MÁS GRANDE que el mundo total, se comporta como antes: el offset se
  // clampea para que el rectángulo visible no se salga de los bordes reales.
  const clampCamera = useCallback((scale, offsetX, offsetY, w, h) => {
    const clampedScale = Math.min(Math.max(scale, minScaleRef.current), maxScale);
    const visibleWidth = w / clampedScale;
    const visibleHeight = h / clampedScale;

    const clampAxis = (offset, worldSize, visibleSize) => {
      if (visibleSize >= worldSize) return -(visibleSize - worldSize) / 2; // centra, con margen a ambos lados
      return Math.min(Math.max(offset, 0), worldSize - visibleSize);
    };

    return {
      scale: clampedScale,
      offsetX: clampAxis(offsetX, worldWidth, visibleWidth),
      offsetY: clampAxis(offsetY, worldHeight, visibleHeight),
    };
  }, [worldWidth, worldHeight, maxScale]);

  // El piso real de zoom: como mínimo "contain" (nunca forzar más zoom del
  // que ya haría falta para ver todo), pero además nunca menos que el
  // scale que deja ver MIN_VISIBLE_WIDTH_RATIO del ancho del mundo -- el
  // mayor de los dos, porque un scale mayor = más acercado = menos mundo
  // visible, así que "al menos tanto zoom como haga falta para no ver de
  // más ancho de la cuenta" es el piso más alto de ambos requisitos.
  const computeMinScale = useCallback((w, h) => {
    const containScale = Math.min(w / worldWidth, h / worldHeight);
    const minWidthScale = w / (worldWidth * MIN_VISIBLE_WIDTH_RATIO);
    return Math.max(containScale, minWidthScale);
  }, [worldWidth, worldHeight]);

  const fitAndCenter = useCallback((w, h) => {
    if (!w || !h || !worldWidth || !worldHeight) return;
    const scale = computeMinScale(w, h);
    minScaleRef.current = scale;
    setCamera(clampCamera(scale, (worldWidth - w / scale) / 2, (worldHeight - h / scale) / 2, w, h));
  }, [worldWidth, worldHeight, clampCamera, computeMinScale]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-encaja en CADA resize, no solo la primera vez -- si no, al rotar el
  // celular o cambiar de mobile a desktop, minScaleRef queda con el piso
  // viejo y aparecen los bordes vacíos que se estaban viendo.
  const lastSizeRef = useRef({ width: 0, height: 0 });
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    const changed = size.width !== lastSizeRef.current.width || size.height !== lastSizeRef.current.height;
    if (!changed) return;
    lastSizeRef.current = size;
    fitAndCenter(size.width, size.height);
  }, [size, fitAndCenter]);

  const resetCamera = useCallback(() => {
    if (size.width > 0 && size.height > 0) fitAndCenter(size.width, size.height);
  }, [size, fitAndCenter]);

  // Zoom centrado en el puntero (wheel) -- ajusta offset para que el punto
  // bajo el cursor quede fijo mientras cambia la escala.
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setCamera((prev) => {
      const worldX = prev.offsetX + pointer.x / prev.scale;
      const worldY = prev.offsetY + pointer.y / prev.scale;
      const factor = e.evt.deltaY > 0 ? 0.9 : 1.1;
      const nextScale = prev.scale * factor;
      return clampCamera(nextScale, worldX - pointer.x / nextScale, worldY - pointer.y / nextScale, size.width, size.height);
    });
  }, [clampCamera, size]);

  // Doble click/tap -- zoom in centrado en el punto, o si ya está cerca del
  // máximo, vuelve a fit-to-screen (comportamiento típico de mapas).
  const handleDblClick = useCallback(() => {
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setCamera((prev) => {
      if (prev.scale >= maxScale * 0.9) {
        const scale = computeMinScale(size.width, size.height);
        return clampCamera(scale, (worldWidth - size.width / scale) / 2, (worldHeight - size.height / scale) / 2, size.width, size.height);
      }
      const worldX = prev.offsetX + pointer.x / prev.scale;
      const worldY = prev.offsetY + pointer.y / prev.scale;
      const nextScale = prev.scale * 1.6;
      return clampCamera(nextScale, worldX - pointer.x / nextScale, worldY - pointer.y / nextScale, size.width, size.height);
    });
  }, [maxScale, size, worldWidth, worldHeight, clampCamera, computeMinScale]);

  // Pan por arrastre del Stage -- solo cuando el drag empieza sobre el
  // fondo (no sobre un agente/edificio, que tienen su propio drag en modo
  // editor).
  const draggingRef = useRef(false);
  const dragStartRef = useRef(null);

  const handlePointerDown = useCallback((e) => {
    if (e.target !== e.target.getStage() && e.target.name() !== 'world-background') return;
    draggingRef.current = true;
    const pointer = stageRef.current.getPointerPosition();
    dragStartRef.current = { pointer, camera };
  }, [camera]);

  const handlePointerMove = useCallback(() => {
    const stage = stageRef.current;
    const touches = stage?.getPointersPositions() || [];

    // Pellizco de 2 dedos -- prioridad sobre el pan de 1 dedo.
    if (touches.length === 2) {
      draggingRef.current = false;
      const [p1, p2] = touches;
      const dist = getDistance(p1, p2);
      const center = getCenter(p1, p2);
      if (pinchRef.current) {
        const factor = dist / pinchRef.current.dist;
        setCamera((prev) => {
          const worldX = prev.offsetX + center.x / prev.scale;
          const worldY = prev.offsetY + center.y / prev.scale;
          const nextScale = prev.scale * factor;
          return clampCamera(nextScale, worldX - center.x / nextScale, worldY - center.y / nextScale, size.width, size.height);
        });
      }
      pinchRef.current = { dist, center };
      return;
    }
    pinchRef.current = null;

    if (!draggingRef.current || !dragStartRef.current) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const { pointer: start, camera: startCamera } = dragStartRef.current;
    const dx = (pointer.x - start.x) / startCamera.scale;
    const dy = (pointer.y - start.y) / startCamera.scale;
    setCamera(clampCamera(startCamera.scale, startCamera.offsetX - dx, startCamera.offsetY - dy, size.width, size.height));
  }, [clampCamera, size]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    dragStartRef.current = null;
    pinchRef.current = null;
  }, []);

  const zoomBy = useCallback((factor) => {
    setCamera((prev) => {
      const cx = size.width / 2;
      const cy = size.height / 2;
      const worldX = prev.offsetX + cx / prev.scale;
      const worldY = prev.offsetY + cy / prev.scale;
      const nextScale = prev.scale * factor;
      return clampCamera(nextScale, worldX - cx / nextScale, worldY - cy / nextScale, size.width, size.height);
    });
  }, [size, clampCamera]);

  // Anima la cámara suavemente hacia un punto del MUNDO (en vez de un salto
  // instantáneo) -- usado al seleccionar un agente, para que el mapa se
  // sienta como si "mirara hacia" lo elegido en vez de solo abrir un
  // tooltip. targetScale opcional: si no se pasa, mantiene el zoom actual.
  const cameraAnimRef = useRef(null);
  const panTo = useCallback((worldX, worldY, targetScale) => {
    if (size.width <= 0 || size.height <= 0) return;
    cameraAnimRef.current?.stop();

    setCamera((prev) => {
      const nextScale = targetScale ?? prev.scale;
      const target = clampCamera(
        nextScale,
        worldX - size.width / 2 / nextScale,
        worldY - size.height / 2 / nextScale,
        size.width,
        size.height
      );
      const start = { ...prev };
      const startTime = Date.now();
      const duration = 420;

      const anim = new Konva.Animation(() => {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        const eased = 1 - (1 - t) * (1 - t); // ease-out cuadrático -- llega rápido y frena suave, no rebota
        setCamera({
          scale: start.scale + (target.scale - start.scale) * eased,
          offsetX: start.offsetX + (target.offsetX - start.offsetX) * eased,
          offsetY: start.offsetY + (target.offsetY - start.offsetY) * eased,
        });
        if (t >= 1) anim.stop();
      });
      cameraAnimRef.current = anim;
      anim.start();
      return prev; // el propio Animation ya llama setCamera en cada frame
    });
  }, [size, clampCamera]);

  useEffect(() => () => cameraAnimRef.current?.stop(), []);

  // Expone control de cámara al padre (WorldControls.jsx vive fuera de este
  // componente, como UI HTML flotante) sin acoplar el layout de los botones
  // a este archivo.
  useImperativeHandle(ref, () => ({ resetCamera, zoomIn: () => zoomBy(1.3), zoomOut: () => zoomBy(1 / 1.3), panTo }), [resetCamera, zoomBy, panTo]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden touch-none">
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onWheel={handleWheel}
          onDblClick={handleDblClick}
          onDblTap={handleDblClick}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchEnd={handlePointerUp}
          onClick={(e) => { if (e.target === e.target.getStage()) onBackgroundClick?.(); }}
        >
          <Layer>
            <Group x={-camera.offsetX * camera.scale} y={-camera.offsetY * camera.scale} scaleX={camera.scale} scaleY={camera.scale}>
              {children({ camera, worldWidth, worldHeight })}
            </Group>
          </Layer>
        </Stage>
      )}
    </div>
  );
});

export default WorldCanvas;
