// src/components/BodestockWorld/OfficeZone.jsx
// Área clickeable invisible sobre el edificio real del background donde
// "vive" un agente -- el edificio en sí es parte del SVG fijo (sin
// estructura propia para engancharle un evento), así que esto no dibuja el
// edificio, solo detecta el click en su lugar. En modo edición se hace
// visible (borde punteado + relleno sutil) para poder verla y arrastrarla
// hasta calzar con el dibujo; fuera de modo edición es invisible del todo,
// solo un cursor "pointer" delata que hay algo ahí -- y, al tocar, un
// destello breve confirma que el toque cayó sobre el edificio correcto
// (sin esto, tocar un área invisible no da ninguna señal de que "agarró").
import React, { useRef } from 'react';
import { Rect } from 'react-konva';

export default function OfficeZone({ office, editable, draggable, onSelect, onDragEnd }) {
  const rectRef = useRef(null);

  const handlePressStart = () => {
    if (editable) return;
    rectRef.current?.to({ opacity: 1, duration: 0.06 });
  };
  const handlePressEnd = () => {
    if (editable) return;
    rectRef.current?.to({ opacity: 0, duration: 0.25 });
  };

  return (
    <Rect
      ref={rectRef}
      x={office.x}
      y={office.y}
      width={office.width}
      height={office.height}
      offsetX={office.width / 2}
      offsetY={office.height / 2}
      fill={editable ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.18)'}
      opacity={editable ? 1 : 0}
      stroke={editable ? 'rgba(96,165,250,0.6)' : undefined}
      strokeWidth={editable ? 1.5 : 0}
      dash={editable ? [6, 4] : undefined}
      cornerRadius={6}
      draggable={draggable}
      onClick={() => onSelect?.(office.agentId)}
      onTap={() => onSelect?.(office.agentId)}
      onDragEnd={(e) => onDragEnd?.(office.id, e.target.x(), e.target.y())}
      onMouseDown={handlePressStart}
      onTouchStart={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchEnd={handlePressEnd}
      onMouseEnter={(e) => { e.target.getStage().container().style.cursor = 'pointer'; }}
      onMouseLeave={(e) => { e.target.getStage().container().style.cursor = 'default'; handlePressEnd(); }}
    />
  );
}
