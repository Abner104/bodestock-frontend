// src/components/BodestockWorld/WorldBackground.jsx
// La imagen isométrica de fondo -- un solo elemento estático que llena el
// mundo (0,0)-(worldWidth,worldHeight) manteniendo su aspect ratio real. A
// propósito NO dibuja texto, agentes, tarjetas ni UI: eso vive en capas
// aparte (AgentSprite, OfficeZone, AgentTooltip) para poder reposicionarlas
// independientemente del fondo.
import React, { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Rect } from 'react-konva';
import Konva from 'konva';

function useImage(src) {
  const [img, setImg] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!src) { setStatus('error'); return; }
    setStatus('loading');
    const image = new window.Image();
    image.onload = () => { setImg(image); setStatus('loaded'); };
    image.onerror = () => { setStatus('error'); console.error(`No se pudo cargar el background: ${src}`); };
    image.src = src;
    return () => { image.onload = null; image.onerror = null; };
  }, [src]);

  return { img, status };
}

export default function WorldBackground({ src, width, height }) {
  const { img, status } = useImage(src);
  const rectRef = useRef(null);

  // Shimmer sutil mientras carga -- distingue "cargando" (algo va a
  // aparecer) de "error" (borde rojo punteado, sin animación), que antes
  // se veían casi idénticos y un placeholder inmóvil se leía como "algo se
  // rompió" incluso en el caso normal de carga.
  useEffect(() => {
    if (status !== 'loading' || !rectRef.current) return;
    const node = rectRef.current;
    let anim;
    const raf = requestAnimationFrame(() => {
      anim = new Konva.Animation((frame) => {
        const t = frame.time / 900;
        node.opacity(0.85 + Math.sin(t) * 0.15);
      }, node.getLayer());
      anim.start();
    });
    return () => { cancelAnimationFrame(raf); anim?.stop(); node.opacity(1); };
  }, [status]);

  if (status !== 'loaded') {
    // Placeholder mientras carga o si falta el archivo -- nunca un mundo en
    // blanco sin explicación (mismo criterio que EditorCanvas.jsx).
    return (
      <Rect
        ref={rectRef}
        name="world-background"
        x={0} y={0} width={width} height={height}
        fill="#141b2b"
        stroke={status === 'error' ? '#ff5a5a' : '#2a3348'}
        strokeWidth={2}
        dash={status === 'error' ? [8, 6] : undefined}
      />
    );
  }

  return (
    <KonvaImage
      name="world-background"
      image={img}
      x={0} y={0}
      width={width} height={height}
      listening
    />
  );
}
