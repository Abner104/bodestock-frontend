// src/components/BodestockWorld/AgentSprite.jsx
// Un agente sobre el mundo: imagen PNG/WebP transparente + indicador visual
// de estado + nombre. Coordenadas de entrada (x, y) ya vienen en unidades
// de MUNDO (normalizado * worldWidth/Height), convertidas por el padre --
// este componente no sabe nada de cámara ni de pantalla.
//
// El estado/selección se leen como luz sobre el PISO (una elipse ancha bajo
// el personaje, como una sombra proyectada de color) en vez de un círculo
// de UI flotando pegado al sprite -- el fondo es un diorama isométrico con
// volumen, y un badge plano de dashboard rompía esa ilusión.
import React, { useEffect, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Circle, Ellipse, Text, Rect } from 'react-konva';
import Konva from 'konva';

function useImage(src) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.onerror = () => console.error(`No se pudo cargar el agente: ${src}`);
    image.src = src;
  }, [src]);
  return img;
}

const SIZE = 72;

export default function AgentSprite({ agent, selected, draggable, unreadCount, onSelect, onDragEnd }) {
  const img = useImage(agent.image);
  const groupRef = useRef(null);
  const glowRef = useRef(null);

  // WORKING: flota suavemente + glow pulsante. La animación corre en un
  // Konva.Animation nativo (no React state) para no re-renderizar en cada
  // frame -- mismo motivo que cualquier animación de canvas.
  useEffect(() => {
    if (agent.status !== 'WORKING' || !groupRef.current) return;
    const node = groupRef.current;
    const baseY = node.y();
    let anim;
    const raf = requestAnimationFrame(() => {
      anim = new Konva.Animation((frame) => {
        const t = frame.time / 600;
        node.y(baseY + Math.sin(t) * 3);
      }, node.getLayer());
      anim.start();
    });
    return () => { cancelAnimationFrame(raf); anim?.stop(); node.y(baseY); };
  }, [agent.status]);

  const opacity = agent.status === 'OFFLINE' ? 0.4 : 1;
  const accent = agent.color || '#9aa5b8';
  const groundY = SIZE / 2 - 6; // el "piso" bajo el personaje, no el centro del sprite

  // Feedback táctil -- un "squash" breve al presionar/tocar, como el que ya
  // tienen los botones de WorldControls (active:scale-95). Konva no tiene
  // equivalente CSS, así que se anima el scale del propio nodo con un Tween
  // corto en vez de re-renderizar React en cada toque.
  const handlePressStart = () => {
    if (draggable) return; // en modo edición el "squash" competiría visualmente con el drag
    groupRef.current?.to({ scaleX: 0.92, scaleY: 0.92, duration: 0.08 });
  };
  const handlePressEnd = () => {
    if (draggable) return;
    groupRef.current?.to({ scaleX: 1, scaleY: 1, duration: 0.15, easing: Konva.Easings.BackEaseOut });
  };

  return (
    <Group
      ref={groupRef}
      x={agent.x}
      y={agent.y}
      draggable={draggable}
      onClick={() => onSelect?.(agent.id)}
      onTap={() => onSelect?.(agent.id)}
      onDragEnd={(e) => onDragEnd?.(agent.id, e.target.x(), e.target.y())}
      onMouseDown={handlePressStart}
      onTouchStart={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchEnd={handlePressEnd}
      onMouseLeave={handlePressEnd}
      opacity={opacity}
    >
      {/* Sombra proyectada del color de marca del agente -- siempre
          presente y sutil, se intensifica en foco (seleccionado) o activo
          (WORKING/ALERT), como luz ambiental real del diorama en vez de un
          ícono de UI. */}
      <Ellipse
        ref={glowRef}
        y={groundY}
        radiusX={SIZE / 2 + (selected ? 14 : 4)}
        radiusY={(SIZE / 2 + (selected ? 14 : 4)) * 0.32}
        fill={accent}
        opacity={selected ? 0.35 : agent.status === 'WORKING' || agent.status === 'ALERT' ? 0.22 : 0.12}
      />

      {img ? (
        <KonvaImage image={img} width={SIZE} height={SIZE} offsetX={SIZE / 2} offsetY={SIZE / 2} />
      ) : (
        // Placeholder para agentes sin sprite propio todavía (ej. recién
        // agregados, antes de generar su avatar con Spriteship) -- círculo
        // del color de marca del agente + su emoji, en vez del gris
        // genérico de antes que no distinguía un agente de otro.
        <>
          <Circle radius={SIZE / 2} fill={accent} opacity={0.25} stroke={accent} strokeWidth={2} />
          {agent.emoji && (
            <Text text={agent.emoji} width={SIZE} height={SIZE} offsetX={SIZE / 2} offsetY={SIZE / 2} align="center" verticalAlign="middle" fontSize={32} />
          )}
        </>
      )}

      <StatusBadge status={agent.status} />
      {unreadCount > 0 && <UnreadBadge count={unreadCount} />}

      {/* Placa de fondo detrás del nombre -- los sprites de Spriteship
          llegan casi hasta el borde del lienzo (poco margen inferior), así
          que el texto queda muy cerca del personaje sin importar cuánto se
          baje; una placa oscura lo separa visualmente del cuerpo en vez de
          quedar "flotando" encima de él, ilegible. */}
      <Rect
        x={-52} y={SIZE / 2 + 10}
        width={104} height={16}
        cornerRadius={8}
        fill="rgba(13,20,32,0.75)"
      />
      <Text
        text={agent.name}
        x={-80} y={SIZE / 2 + 10}
        width={160}
        height={16}
        align="center"
        verticalAlign="middle"
        wrap="none"
        fontSize={12.5}
        fontStyle="700"
        fill="#f2f4f8"
      />
    </Group>
  );
}

// Cuántas tareas/alertas sin leer tiene el agente -- antes un puntito de
// radio 9 casi imperceptible; ahora un badge más grande con anillo
// pulsante (mismo lenguaje que una notificación real de app) para que se
// note de verdad que hay algo pendiente, no solo un número chico perdido
// en la esquina del sprite.
function UnreadBadge({ count }) {
  const x = SIZE / 2 - 6;
  const y = -SIZE / 2 + 2;
  const label = count > 9 ? '9+' : String(count);
  const ringRef = useRef(null);

  useEffect(() => {
    const node = ringRef.current;
    if (!node) return;
    let anim;
    const raf = requestAnimationFrame(() => {
      anim = new Konva.Animation((frame) => {
        const t = (frame.time / 900) % 1;
        node.scale({ x: 1 + t * 0.7, y: 1 + t * 0.7 });
        node.opacity(0.5 * (1 - t));
      }, node.getLayer());
      anim.start();
    });
    return () => { cancelAnimationFrame(raf); anim?.stop(); };
  }, []);

  return (
    <Group x={x} y={y}>
      <Circle ref={ringRef} radius={12} stroke="#f87171" strokeWidth={2} />
      <Circle radius={12} fill="#f87171" stroke="#0d1420" strokeWidth={2} />
      <Text text={label} width={24} height={24} offsetX={12} offsetY={12} align="center" verticalAlign="middle" fontSize={12} fontStyle="800" fill="#ffffff" />
    </Group>
  );
}

// Estado del agente -- antes un punto de 5px casi invisible; ahora una
// placa con texto corto, del mismo lenguaje que un chip de estado real
// (fondo oscuro semitransparente + texto + punto de color), legible de
// un vistazo sin tener que acercar el zoom.
const STATUS_CHIP = {
  WORKING: { label: 'Trabajando', color: '#34d399' },
  THINKING: { label: 'Pensando', color: '#9aa5b8' },
  ALERT: { label: 'Alerta', color: '#f87171' },
  WAITING: { label: 'En espera', color: '#f2b84b' },
  AVAILABLE: { label: 'Disponible', color: '#60a5fa' },
};

function StatusBadge({ status }) {
  const chip = STATUS_CHIP[status];
  const isAlert = status === 'ALERT';
  const isPulsing = isAlert || status === 'THINKING';
  const dotRef = useRef(null);
  const groupRef = useRef(null);

  useEffect(() => {
    if (!isPulsing || !dotRef.current) return;
    const node = dotRef.current;
    let anim;
    const raf = requestAnimationFrame(() => {
      anim = new Konva.Animation((frame) => {
        const t = frame.time / 450;
        node.opacity(0.55 + Math.abs(Math.sin(t)) * 0.45);
      }, node.getLayer());
      anim.start();
    });
    return () => { cancelAnimationFrame(raf); anim?.stop(); };
  }, [isPulsing]);

  // ALERT además "respira" entero (scale), no solo el punto -- es la única
  // señal del mapa que exige atención real, y debe notarse sin tener que
  // leer el texto para distinguirla del resto de los estados normales.
  useEffect(() => {
    if (!isAlert || !groupRef.current) return;
    const node = groupRef.current;
    let anim;
    const raf = requestAnimationFrame(() => {
      anim = new Konva.Animation((frame) => {
        const t = frame.time / 500;
        const s = 1 + Math.abs(Math.sin(t)) * 0.08;
        node.scale({ x: s, y: s });
      }, node.getLayer());
      anim.start();
    });
    return () => { cancelAnimationFrame(raf); anim?.stop(); node.scale({ x: 1, y: 1 }); };
  }, [isAlert]);

  if (!chip) return null; // OFFLINE -- ya se lee por la opacidad general del sprite

  const label = chip.label;
  const textWidth = label.length * 6.2 + (isAlert ? 30 : 18);
  const chipY = -SIZE / 2 - 16;

  return (
    <Group ref={groupRef} y={chipY}>
      <Rect
        x={-textWidth / 2} y={-10}
        width={textWidth} height={20}
        cornerRadius={10}
        fill={isAlert ? chip.color : 'rgba(13,20,32,0.88)'}
        stroke={isAlert ? '#ffffff' : `${chip.color}66`}
        strokeWidth={isAlert ? 1.5 : 1}
        shadowColor={isAlert ? chip.color : undefined}
        shadowBlur={isAlert ? 10 : 0}
        shadowOpacity={isAlert ? 0.9 : 0}
      />
      {isAlert ? (
        <Text text="⚠" x={-textWidth / 2 + 7} y={-10} width={16} height={20} verticalAlign="middle" fontSize={12} fill="#1a0a0a" />
      ) : (
        <Circle ref={dotRef} x={-textWidth / 2 + 11} y={0} radius={3.5} fill={chip.color} />
      )}
      <Text
        text={label}
        x={-textWidth / 2 + (isAlert ? 22 : 18)} y={-10}
        width={textWidth - (isAlert ? 28 : 22)}
        height={20}
        verticalAlign="middle"
        fontSize={isAlert ? 11.5 : 10.5}
        fontStyle="800"
        fill={isAlert ? '#1a0a0a' : '#e8ecf6'}
      />
    </Group>
  );
}

