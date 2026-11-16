import { useState, useEffect } from 'react';
import { Maximize2, Minimize2, MapPin, Edit3, Save, Package, Navigation, ArrowRight, Users, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Mapa isométrico CON ESTRUCTURA:
 * - Caminos/pasillos entre bodegas
 * - Señalización (flechas, indicadores)
 * - Áreas definidas (recepción, zona de carga, etc.)
 * - Organización clara con edificio estructurado
 */
export default function IsometricWarehouseWithPaths({ warehouses = [], onWarehouseClick, onSaveLayout, canEdit = true }) {
  const [zoom, setZoom] = useState(1);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [warehousePositions, setWarehousePositions] = useState({});
  const [draggingWarehouse, setDraggingWarehouse] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Dimensiones del canvas - EDIFICIO ESTRUCTURADO
  const MAP_WIDTH = 1800;
  const MAP_HEIGHT = 1200;
  const TILE_SIZE = 100;

  // Inicializar posiciones
  useEffect(() => {
    const initialPositions = {};
    warehouses.forEach((warehouse, index) => {
      if (warehouse.position) {
        initialPositions[warehouse.id] = warehouse.position;
      } else {
        initialPositions[warehouse.id] = getDefaultPosition(index, warehouses.length);
      }
    });
    setWarehousePositions(initialPositions);
  }, [warehouses]);

  // Posiciones por defecto - ORGANIZADAS CON PASILLOS
  const getDefaultPosition = (index, total) => {
    // Layout con pasillo central horizontal y vertical
    const layouts = [
      // 1 bodega - Centro
      [{ gridX: 6, gridY: 5, width: 5, height: 4 }],

      // 2 bodegas - Lados del pasillo vertical
      [
        { gridX: 2, gridY: 4, width: 4, height: 4 },
        { gridX: 10, gridY: 4, width: 4, height: 4 }
      ],

      // 3 bodegas - 2 arriba, 1 abajo
      [
        { gridX: 2, gridY: 2, width: 4, height: 3 },
        { gridX: 10, gridY: 2, width: 4, height: 3 },
        { gridX: 6, gridY: 9, width: 4, height: 3 }
      ],

      // 4 bodegas - Cuadrante
      [
        { gridX: 2, gridY: 2, width: 4, height: 3 },
        { gridX: 10, gridY: 2, width: 4, height: 3 },
        { gridX: 2, gridY: 9, width: 4, height: 3 },
        { gridX: 10, gridY: 9, width: 4, height: 3 }
      ],

      // 5+ bodegas - Grid completo
      [
        { gridX: 1, gridY: 1, width: 3, height: 3 },
        { gridX: 6, gridY: 1, width: 3, height: 3 },
        { gridX: 11, gridY: 1, width: 3, height: 3 },
        { gridX: 1, gridY: 6, width: 3, height: 3 },
        { gridX: 6, gridY: 6, width: 3, height: 3 },
        { gridX: 11, gridY: 6, width: 3, height: 3 }
      ]
    ];

    const layoutIndex = Math.min(total - 1, 4);
    return layouts[layoutIndex]?.[index] || { gridX: (index % 3) * 5 + 1, gridY: Math.floor(index / 3) * 5 + 1, width: 3, height: 3 };
  };

  // Convertir grid a isométrico
  const gridToIso = (gridX, gridY) => {
    const x = (gridX - gridY) * (TILE_SIZE / 2) + MAP_WIDTH / 2;
    const y = (gridX + gridY) * (TILE_SIZE / 4) + 200;
    return { x, y };
  };

  // Colores
  const warehouseColors = [
    { main: '#3b82f6', dark: '#1e40af', light: '#93c5fd', roof: '#2563eb', wall: '#1d4ed8' },
    { main: '#10b981', dark: '#047857', light: '#6ee7b7', roof: '#059669', wall: '#047857' },
    { main: '#f59e0b', dark: '#d97706', light: '#fbbf24', roof: '#f59e0b', wall: '#d97706' },
    { main: '#8b5cf6', dark: '#7c3aed', light: '#c4b5fd', roof: '#8b5cf6', wall: '#7c3aed' },
    { main: '#ef4444', dark: '#dc2626', light: '#fca5a5', roof: '#ef4444', wall: '#dc2626' },
    { main: '#06b6d4', dark: '#0891b2', light: '#67e8f9', roof: '#06b6d4', wall: '#0891b2' }
  ];

  // Calcular estado
  const getWarehouseStatus = (warehouse) => {
    const count = warehouse.productsCount || 0;
    if (count === 0) return { type: 'empty', color: '#94a3b8', icon: '⚪' };
    if (count < 5) return { type: 'critical', color: '#ef4444', icon: '🔴' };
    if (count < 15) return { type: 'warning', color: '#f59e0b', icon: '🟡' };
    return { type: 'healthy', color: '#10b981', icon: '🟢' };
  };

  // Drag handlers
  const handleMouseDown = (e, warehouseId) => {
    if (!editMode) return;
    const svg = e.currentTarget.closest('svg');
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;
    const warehousePos = warehousePositions[warehouseId];
    const isoPos = gridToIso(warehousePos.gridX, warehousePos.gridY);
    setDragOffset({ x: mouseX - isoPos.x, y: mouseY - isoPos.y });
    setDraggingWarehouse(warehouseId);
  };

  const handleMouseMove = (e) => {
    if (!editMode || !draggingWarehouse) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;
    const currentPos = warehousePositions[draggingWarehouse];
    const gridX = Math.round(((mouseX - dragOffset.x - MAP_WIDTH / 2) / (TILE_SIZE / 2) + (mouseY - dragOffset.y - 200) / (TILE_SIZE / 4)) / 2);
    const gridY = Math.round(((mouseY - dragOffset.y - 200) / (TILE_SIZE / 4) - (mouseX - dragOffset.x - MAP_WIDTH / 2) / (TILE_SIZE / 2)) / 2);
    const clampedGridX = Math.max(0, Math.min(16 - currentPos.width, gridX));
    const clampedGridY = Math.max(0, Math.min(14 - currentPos.height, gridY));
    setWarehousePositions(prev => ({
      ...prev,
      [draggingWarehouse]: {
        ...prev[draggingWarehouse],
        gridX: clampedGridX,
        gridY: clampedGridY
      }
    }));
  };

  const handleMouseUp = () => {
    setDraggingWarehouse(null);
  };

  const handleSavePositions = () => {
    if (onSaveLayout) {
      onSaveLayout(warehousePositions);
    }
    setEditMode(false);
  };

  const organizedWarehouses = warehouses.slice(0, 6).map((warehouse, index) => ({
    ...warehouse,
    position: warehousePositions[warehouse.id] || getDefaultPosition(index, warehouses.length),
    colors: warehouseColors[index % warehouseColors.length],
    status: getWarehouseStatus(warehouse)
  }));

  // Renderizar CAMINO/PASILLO
  const renderPath = (startGrid, endGrid, width = 2) => {
    const start = gridToIso(startGrid.x, startGrid.y);
    const end = gridToIso(endGrid.x, endGrid.y);

    return (
      <g key={`path-${startGrid.x}-${startGrid.y}-${endGrid.x}-${endGrid.y}`}>
        {/* Camino base */}
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#fbbf24"
          strokeWidth={width * 8}
          opacity="0.3"
          strokeLinecap="round"
        />
        {/* Línea central amarilla */}
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#fbbf24"
          strokeWidth={width * 2}
          opacity="0.8"
          strokeLinecap="round"
          strokeDasharray="10,10"
        />
        {/* Borde del camino */}
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#92400e"
          strokeWidth={width * 8 + 2}
          opacity="0.2"
          strokeLinecap="round"
        />
      </g>
    );
  };

  // Renderizar SEÑAL/FLECHA
  const renderSignal = (gridX, gridY, direction, label) => {
    const pos = gridToIso(gridX, gridY);
    const angle = direction === 'right' ? 0 : direction === 'left' ? 180 : direction === 'down' ? 90 : -90;

    return (
      <g key={`signal-${gridX}-${gridY}-${direction}`}>
        {/* Poste */}
        <line
          x1={pos.x}
          y1={pos.y}
          x2={pos.x}
          y2={pos.y + 40}
          stroke="#64748b"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* Señal */}
        <rect
          x={pos.x - 30}
          y={pos.y - 20}
          width={60}
          height={25}
          fill="#fbbf24"
          stroke="#78350f"
          strokeWidth={2}
          rx={4}
        />
        {/* Flecha */}
        <g transform={`translate(${pos.x}, ${pos.y - 7.5}) rotate(${angle})`}>
          <polygon
            points="10,0 0,5 0,-5"
            fill="#78350f"
          />
        </g>
        {/* Texto */}
        {label && (
          <text
            x={pos.x}
            y={pos.y + 60}
            textAnchor="middle"
            fontSize={10}
            fontWeight="bold"
            fill="#fbbf24"
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  // Renderizar ÁREA ESPECIAL (recepción, carga, etc.)
  const renderSpecialArea = (gridX, gridY, width, height, label, icon, color = '#10b981') => {
    const topLeft = gridToIso(gridX, gridY);
    const topRight = gridToIso(gridX + width, gridY);
    const bottomLeft = gridToIso(gridX, gridY + height);
    const bottomRight = gridToIso(gridX + width, gridY + height);

    return (
      <g key={`area-${gridX}-${gridY}`}>
        {/* Piso del área */}
        <polygon
          points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
          fill={color}
          opacity="0.2"
          stroke={color}
          strokeWidth={3}
          strokeDasharray="8,4"
        />
        {/* Icono y label */}
        <rect
          x={(topLeft.x + bottomRight.x) / 2 - 50}
          y={(topLeft.y + bottomRight.y) / 2 - 15}
          width={100}
          height={30}
          fill="white"
          stroke={color}
          strokeWidth={2}
          rx={6}
          opacity="0.95"
        />
        <text
          x={(topLeft.x + bottomRight.x) / 2}
          y={(topLeft.y + bottomRight.y) / 2 + 5}
          textAnchor="middle"
          fontSize={12}
          fontWeight="bold"
          fill={color}
        >
          {icon} {label}
        </text>
      </g>
    );
  };

  // Renderizar bodega
  const renderIsometricWarehouse = (warehouse, index) => {
    const { position, colors, status } = warehouse;
    const { gridX, gridY, width, height } = position;
    const isHovered = hoveredWarehouse?.id === warehouse.id;
    const isDragging = draggingWarehouse === warehouse.id;

    const topLeft = gridToIso(gridX, gridY);
    const topRight = gridToIso(gridX + width, gridY);
    const bottomLeft = gridToIso(gridX, gridY + height);
    const bottomRight = gridToIso(gridX + width, gridY + height);
    const WALL_HEIGHT = 50;

    return (
      <motion.g
        key={warehouse.id}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.15, type: 'spring', stiffness: 200 }}
        className={editMode ? "cursor-move" : "cursor-pointer"}
        onMouseEnter={() => !editMode && setHoveredWarehouse(warehouse)}
        onMouseLeave={() => !editMode && setHoveredWarehouse(null)}
        onClick={() => !editMode && onWarehouseClick(warehouse)}
        onMouseDown={(e) => handleMouseDown(e, warehouse.id)}
        style={{ opacity: isDragging ? 0.7 : 1 }}
      >
        {/* Sombra */}
        <polygon
          points={`${topLeft.x + 15},${topLeft.y + WALL_HEIGHT + 20} ${topRight.x + 15},${topRight.y + WALL_HEIGHT + 20} ${bottomRight.x + 15},${bottomRight.y + WALL_HEIGHT + 20} ${bottomLeft.x + 15},${bottomLeft.y + WALL_HEIGHT + 20}`}
          fill="rgba(0,0,0,0.4)"
          filter="blur(12px)"
        />

        {/* Paredes */}
        <polygon
          points={`${topLeft.x},${topLeft.y} ${topLeft.x},${topLeft.y + WALL_HEIGHT} ${bottomLeft.x},${bottomLeft.y + WALL_HEIGHT} ${bottomLeft.x},${bottomLeft.y}`}
          fill={colors.wall}
          stroke="#1e293b"
          strokeWidth={2}
          opacity="0.9"
        />
        <polygon
          points={`${topRight.x},${topRight.y} ${topRight.x},${topRight.y + WALL_HEIGHT} ${bottomRight.x},${bottomRight.y + WALL_HEIGHT} ${bottomRight.x},${bottomRight.y}`}
          fill={colors.dark}
          stroke="#1e293b"
          strokeWidth={2}
          opacity="0.8"
        />

        {/* Techo */}
        <polygon
          points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
          fill={isHovered ? colors.light : colors.roof}
          stroke={isDragging ? '#f97316' : (isHovered ? '#fbbf24' : '#1e293b')}
          strokeWidth={isDragging ? 5 : (isHovered ? 4 : 2)}
          style={{
            filter: isHovered ? 'brightness(1.3) drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'brightness(1)',
            transition: 'all 0.3s ease',
            transform: isHovered && !editMode ? 'translateY(-5px)' : 'translateY(0)',
            transformOrigin: 'center'
          }}
        />

        {/* Información central */}
        <g>
          <circle
            cx={(topLeft.x + bottomRight.x) / 2}
            cy={(topLeft.y + bottomRight.y) / 2 - 25}
            r={isHovered ? 22 : 18}
            fill="white"
            stroke={colors.main}
            strokeWidth={3}
          />
          <text
            x={(topLeft.x + bottomRight.x) / 2}
            y={(topLeft.y + bottomRight.y) / 2 - 18}
            textAnchor="middle"
            fontSize={isHovered ? 20 : 16}
            fontWeight="bold"
            fill={colors.dark}
          >
            {index + 1}
          </text>

          <rect
            x={(topLeft.x + bottomRight.x) / 2 - 60}
            y={(topLeft.y + bottomRight.y) / 2 - 10}
            width={120}
            height={24}
            fill="white"
            fillOpacity={0.95}
            stroke={colors.main}
            strokeWidth={2}
            rx={4}
          />
          <text
            x={(topLeft.x + bottomRight.x) / 2}
            y={(topLeft.y + bottomRight.y) / 2 + 6}
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
            fill="#1e293b"
          >
            {warehouse.name}
          </text>

          <rect
            x={(topLeft.x + bottomRight.x) / 2 - 40}
            y={(topLeft.y + bottomRight.y) / 2 + 18}
            width={80}
            height={32}
            fill={colors.main}
            stroke="white"
            strokeWidth={2}
            rx={6}
          />
          <text
            x={(topLeft.x + bottomRight.x) / 2}
            y={(topLeft.y + bottomRight.y) / 2 + 38}
            textAnchor="middle"
            fontSize={18}
            fontWeight="bold"
            fill="white"
          >
            {warehouse.productsCount || 0}
          </text>
        </g>

        {/* Indicador estado */}
        <circle
          cx={topRight.x - 20}
          cy={topRight.y + 15}
          r={10}
          fill={status.color}
          stroke="white"
          strokeWidth={2}
        />
      </motion.g>
    );
  };

  return (
    <div className="relative w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 flex justify-between items-center border-b border-slate-700">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <MapPin className="w-8 h-8" />
            Plano del Local con Caminos
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {warehouses.length} bodega{warehouses.length !== 1 ? 's' : ''} • Vista estratégica organizada
          </p>
        </div>

        <div className="flex gap-3">
          {canEdit && (
            editMode ? (
              <button
                onClick={handleSavePositions}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                <Save className="w-5 h-5" />
                Guardar
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                <Edit3 className="w-5 h-5" />
                Editar
              </button>
            )
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <span className="px-5 py-3 bg-slate-700 rounded-xl font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {editMode && (
        <div className="bg-orange-600 text-white px-6 py-3 flex items-center gap-2">
          <span className="text-sm font-semibold">
            🔧 MODO EDICIÓN: Arrastra las bodegas para reorganizar
          </span>
        </div>
      )}

      {/* Mapa SVG */}
      <div className="relative overflow-auto" style={{ height: '850px', background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)' }}>
        <svg
          width={MAP_WIDTH * zoom}
          height={MAP_HEIGHT * zoom}
          className="mx-auto"
          style={{ minWidth: '100%', minHeight: '100%' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Fondo de piso */}
          <defs>
            <pattern id="floorPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="#475569" opacity="0.1"/>
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#floorPattern)"/>

          {/* ESTRUCTURA: Paredes exteriores del edificio */}
          <g opacity="0.3">
            {/* Pared exterior */}
            {(() => {
              const buildingOutline = [
                gridToIso(0, 0),
                gridToIso(16, 0),
                gridToIso(16, 14),
                gridToIso(0, 14)
              ];
              return (
                <polygon
                  points={buildingOutline.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={6}
                  strokeDasharray="20,10"
                />
              );
            })()}
          </g>

          {/* CAMINOS PRINCIPALES - Pasillo central en cruz */}
          {/* Pasillo horizontal */}
          {renderPath({ x: 0, y: 7 }, { x: 16, y: 7 }, 2.5)}

          {/* Pasillo vertical */}
          {renderPath({ x: 8, y: 0 }, { x: 8, y: 14 }, 2.5)}

          {/* ÁREAS ESPECIALES */}
          {/* Área de recepción/entrada */}
          {renderSpecialArea(7, 0, 2, 1, 'ENTRADA', '🚪', '#3b82f6')}

          {/* Zona de carga */}
          {renderSpecialArea(0, 13, 3, 1, 'ZONA CARGA', '🚛', '#f59e0b')}

          {/* Oficina */}
          {renderSpecialArea(13, 13, 3, 1, 'OFICINA', '🏢', '#8b5cf6')}

          {/* SEÑALIZACIÓN - Flechas direccionales */}
          {renderSignal(4, 7, 'left', 'A1-A3')}
          {renderSignal(12, 7, 'right', 'B1-B3')}
          {renderSignal(8, 3, 'up', 'C1-C2')}
          {renderSignal(8, 11, 'down', 'SALIDA')}

          {/* Bodegas */}
          {organizedWarehouses.map((warehouse, index) => renderIsometricWarehouse(warehouse, index))}
        </svg>
      </div>

      {/* Leyenda */}
      <div className="bg-slate-800 border-t border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bodegas */}
          <div>
            <div className="font-bold text-white mb-3 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Bodegas:
            </div>
            <div className="space-y-2">
              {organizedWarehouses.map((warehouse, index) => (
                <div
                  key={warehouse.id}
                  className="flex items-center gap-3 px-3 py-2 bg-slate-700 rounded-lg"
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: warehouse.colors.main }}
                  >
                    {index + 1}
                  </div>
                  <span className="text-sm text-white flex-1">{warehouse.name}</span>
                  <span className="text-xs">{warehouse.status.icon}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Señalización */}
          <div>
            <div className="font-bold text-white mb-3 flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Señalización:
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 bg-yellow-500 rounded"/>
                <span>Caminos principales</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-yellow-500"/>
                <span>Señales direccionales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 border-2 border-dashed border-slate-400"/>
                <span>Perímetro edificio</span>
              </div>
            </div>
          </div>

          {/* Áreas */}
          <div>
            <div className="font-bold text-white mb-3">🏢 Áreas:</div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded opacity-50"/>
                <span>Entrada principal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded opacity-50"/>
                <span>Zona de carga</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded opacity-50"/>
                <span>Oficina administrativa</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
