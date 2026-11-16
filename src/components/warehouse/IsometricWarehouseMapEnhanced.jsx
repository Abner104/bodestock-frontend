import { useState, useEffect } from 'react';
import { Maximize2, Minimize2, MapPin, Edit3, Save, Package, AlertTriangle, TrendingUp, Navigation, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Mapa isométrico MEJORADO con todas las funcionalidades:
 * - Tooltips informativos
 * - Indicadores de estado
 * - Animaciones de entrada
 * - Mini-mapa
 * - Búsqueda visual
 * - Centrado y pantalla completa
 */
export default function IsometricWarehouseMapEnhanced({ warehouses = [], onWarehouseClick, onSaveLayout, canEdit = true }) {
  const [zoom, setZoom] = useState(1);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [warehousePositions, setWarehousePositions] = useState({});
  const [draggingWarehouse, setDraggingWarehouse] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [searchHighlight, setSearchHighlight] = useState(null);

  // Dimensiones del canvas isométrico - CENTRADO Y MÁS GRANDE
  const MAP_WIDTH = 1800;
  const MAP_HEIGHT = 1100;
  const TILE_SIZE = 140;
  const GRID_SIZE = 40;

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

  // Posiciones por defecto centradas
  const getDefaultPosition = (index, total) => {
    const layouts = [
      [{ gridX: 5, gridY: 4, width: 6, height: 5 }],
      [
        { gridX: 3, gridY: 3, width: 4, height: 5 },
        { gridX: 8, gridY: 3, width: 4, height: 5 }
      ],
      [
        { gridX: 2, gridY: 2, width: 4, height: 3 },
        { gridX: 7, gridY: 2, width: 4, height: 3 },
        { gridX: 2, gridY: 6, width: 9, height: 3 }
      ],
      [
        { gridX: 2, gridY: 2, width: 4, height: 3 },
        { gridX: 7, gridY: 2, width: 4, height: 3 },
        { gridX: 2, gridY: 6, width: 4, height: 3 },
        { gridX: 7, gridY: 6, width: 4, height: 3 }
      ],
      [
        { gridX: 1, gridY: 2, width: 3, height: 3 },
        { gridX: 5, gridY: 2, width: 3, height: 3 },
        { gridX: 9, gridY: 2, width: 3, height: 3 },
        { gridX: 1, gridY: 6, width: 3, height: 3 },
        { gridX: 5, gridY: 6, width: 3, height: 3 },
        { gridX: 9, gridY: 6, width: 3, height: 3 }
      ]
    ];

    const layoutIndex = Math.min(total - 1, 4);
    return layouts[layoutIndex]?.[index] || { gridX: index * 3 + 2, gridY: 2, width: 3, height: 3 };
  };

  // Convertir grid a isométrico
  const gridToIso = (gridX, gridY) => {
    const x = (gridX - gridY) * (TILE_SIZE / 2) + MAP_WIDTH / 2;
    const y = (gridX + gridY) * (TILE_SIZE / 6) + 200;
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

  // Calcular estado de stock
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
    setDragOffset({
      x: mouseX - isoPos.x,
      y: mouseY - isoPos.y
    });
    setDraggingWarehouse(warehouseId);
  };

  const handleMouseMove = (e) => {
    if (!editMode || !draggingWarehouse) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;
    const currentPos = warehousePositions[draggingWarehouse];
    const gridX = Math.round(((mouseX - dragOffset.x - MAP_WIDTH / 2) / (TILE_SIZE / 2) + (mouseY - dragOffset.y - 200) / (TILE_SIZE / 6)) / 2);
    const gridY = Math.round(((mouseY - dragOffset.y - 200) / (TILE_SIZE / 6) - (mouseX - dragOffset.x - MAP_WIDTH / 2) / (TILE_SIZE / 2)) / 2);
    const clampedGridX = Math.max(0, Math.min(12 - currentPos.width, gridX));
    const clampedGridY = Math.max(0, Math.min(10 - currentPos.height, gridY));
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

  // Renderizar bodega
  const renderIsometricWarehouse = (warehouse, index) => {
    const { position, colors, status } = warehouse;
    const { gridX, gridY, width, height } = position;
    const isHovered = hoveredWarehouse?.id === warehouse.id;
    const isDragging = draggingWarehouse === warehouse.id;
    const isHighlighted = searchHighlight === warehouse.id;

    const topLeft = gridToIso(gridX, gridY);
    const topRight = gridToIso(gridX + width, gridY);
    const bottomLeft = gridToIso(gridX, gridY + height);
    const bottomRight = gridToIso(gridX + width, gridY + height);
    const WALL_HEIGHT = 40;

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

        {isHovered && (
          <polygon
            points={`${topLeft.x + 15},${topLeft.y + WALL_HEIGHT + 20} ${topRight.x + 15},${topRight.y + WALL_HEIGHT + 20} ${bottomRight.x + 15},${bottomRight.y + WALL_HEIGHT + 20} ${bottomLeft.x + 15},${bottomLeft.y + WALL_HEIGHT + 20}`}
            fill="rgba(0,0,0,0.2)"
            filter="blur(16px)"
          />
        )}

        {/* Paredes */}
        <polygon
          points={`${topLeft.x},${topLeft.y} ${topLeft.x},${topLeft.y + WALL_HEIGHT} ${bottomLeft.x},${bottomLeft.y + WALL_HEIGHT} ${bottomLeft.x},${bottomLeft.y}`}
          fill={colors.wall}
          stroke="#1e293b"
          strokeWidth={2}
          opacity="0.8"
        />
        <polygon
          points={`${topRight.x},${topRight.y} ${topRight.x},${topRight.y + WALL_HEIGHT} ${bottomRight.x},${bottomRight.y + WALL_HEIGHT} ${bottomRight.x},${bottomRight.y}`}
          fill={colors.dark}
          stroke="#1e293b"
          strokeWidth={2}
          opacity="0.7"
        />

        {/* Techo */}
        <polygon
          points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
          fill={isHovered ? colors.light : colors.roof}
          stroke={isDragging ? '#f97316' : (isHighlighted ? '#fbbf24' : (isHovered ? '#fbbf24' : '#1e293b'))}
          strokeWidth={isDragging ? 5 : (isHighlighted || isHovered ? 4 : 2)}
          style={{
            filter: isHovered ? 'brightness(1.3) drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'brightness(1)',
            transition: 'all 0.3s ease',
            transform: isHovered && !editMode ? 'translateY(-5px)' : 'translateY(0)',
            transformOrigin: 'center'
          }}
        />

        {/* Efecto de búsqueda/ping */}
        {isHighlighted && (
          <>
            <polygon
              points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
              fill="#fbbf24"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite"/>
            </polygon>
            <polygon
              points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={3}
            >
              <animate attributeName="stroke-width" values="3;6;3" dur="1.5s" repeatCount="indefinite"/>
            </polygon>
          </>
        )}

        {(isHovered || isHighlighted) && !editMode && (
          <polygon
            points={`${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${bottomRight.x},${bottomRight.y} ${bottomLeft.x},${bottomLeft.y}`}
            fill="none"
            stroke="white"
            strokeWidth={2}
            opacity="0.6"
            style={{ filter: 'blur(1px)', animation: 'pulse 1.5s infinite' }}
          />
        )}

        {/* Divisiones internas */}
        {Array.from({ length: Math.floor(width) }).map((_, i) => {
          const lineStart = gridToIso(gridX + i + 1, gridY);
          const lineEnd = gridToIso(gridX + i + 1, gridY + height);
          return (
            <line
              key={`divx-${i}`}
              x1={lineStart.x}
              y1={lineStart.y}
              x2={lineEnd.x}
              y2={lineEnd.y}
              stroke="#1e293b"
              strokeWidth={2}
              opacity={isHovered ? 0.5 : 0.3}
              strokeDasharray="6,3"
            />
          );
        })}

        {Array.from({ length: Math.floor(height) }).map((_, i) => {
          const lineStart = gridToIso(gridX, gridY + i + 1);
          const lineEnd = gridToIso(gridX + width, gridY + i + 1);
          return (
            <line
              key={`divy-${i}`}
              x1={lineStart.x}
              y1={lineStart.y}
              x2={lineEnd.x}
              y2={lineEnd.y}
              stroke="#1e293b"
              strokeWidth={2}
              opacity={isHovered ? 0.5 : 0.3}
              strokeDasharray="6,3"
            />
          );
        })}

        {/* Información central */}
        <g style={{ transition: 'all 0.3s' }}>
          {/* Número */}
          <circle
            cx={(topLeft.x + bottomRight.x) / 2}
            cy={(topLeft.y + bottomRight.y) / 2 - 40}
            r={isHovered ? 26 : 22}
            fill="white"
            stroke={colors.main}
            strokeWidth={isHovered ? 4 : 3}
            style={{
              filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
              transition: 'all 0.3s'
            }}
          />
          <text
            x={(topLeft.x + bottomRight.x) / 2}
            y={(topLeft.y + bottomRight.y) / 2 - 32}
            textAnchor="middle"
            fontSize={isHovered ? 24 : 20}
            fontWeight="bold"
            fill={colors.dark}
            style={{ transition: 'all 0.3s' }}
          >
            {index + 1}
          </text>

          {/* Nombre */}
          <rect
            x={(topLeft.x + bottomRight.x) / 2 - 80}
            y={(topLeft.y + bottomRight.y) / 2 - 15}
            width={160}
            height={28}
            fill="white"
            fillOpacity={isHovered ? 0.95 : 0.85}
            stroke={colors.main}
            strokeWidth={isHovered ? 2.5 : 2}
            rx={6}
            style={{
              filter: isHovered ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' : 'none',
              transition: 'all 0.3s'
            }}
          />
          <text
            x={(topLeft.x + bottomRight.x) / 2}
            y={(topLeft.y + bottomRight.y) / 2 + 4}
            textAnchor="middle"
            fontSize={isHovered ? 16 : 14}
            fontWeight="bold"
            fill="#1e293b"
            style={{ transition: 'all 0.3s' }}
          >
            {warehouse.name}
          </text>

          {/* Contador */}
          <rect
            x={(topLeft.x + bottomRight.x) / 2 - 60}
            y={(topLeft.y + bottomRight.y) / 2 + 18}
            width={120}
            height={46}
            fill={colors.main}
            fillOpacity={isHovered ? 0.95 : 0.85}
            stroke="white"
            strokeWidth={2}
            rx={8}
            style={{
              filter: isHovered ? 'drop-shadow(0 3px 8px rgba(0,0,0,0.3))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              transition: 'all 0.3s'
            }}
          />
          <text
            x={(topLeft.x + bottomRight.x) / 2}
            y={(topLeft.y + bottomRight.y) / 2 + 42}
            textAnchor="middle"
            fontSize={isHovered ? 28 : 24}
            fontWeight="bold"
            fill="white"
            style={{
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
              transition: 'all 0.3s'
            }}
          >
            {warehouse.productsCount || 0}
          </text>
          <text
            x={(topLeft.x + bottomRight.x) / 2}
            y={(topLeft.y + bottomRight.y) / 2 + 60}
            textAnchor="middle"
            fontSize={10}
            fontWeight="600"
            fill="white"
            opacity={0.9}
          >
            productos
          </text>
        </g>

        {/* Indicador de estado */}
        <g>
          <circle
            cx={topRight.x - 25}
            cy={topRight.y + 15}
            r={12}
            fill={status.color}
            stroke="white"
            strokeWidth={2}
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          >
            {status.type === 'critical' && (
              <animate attributeName="r" values="12;15;12" dur="1s" repeatCount="indefinite"/>
            )}
          </circle>
        </g>

        {editMode && (
          <circle
            cx={topRight.x - 20}
            cy={topRight.y + 10}
            r={12}
            fill="#f97316"
            stroke="white"
            strokeWidth={2}
          />
        )}
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
            Mapa Isométrico del Local
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {warehouses.length} bodega{warehouses.length !== 1 ? 's' : ''} • Vista estratégica mejorada
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
                <span className="hidden md:inline">Guardar</span>
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                <Edit3 className="w-5 h-5" />
                <span className="hidden md:inline">Editar</span>
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
            🔧 MODO EDICIÓN: Arrastra las bodegas para reorganizar el mapa
          </span>
        </div>
      )}

      {/* Mapa SVG - MÁS ALTO para cubrir más pantalla */}
      <div className="relative overflow-auto" style={{ height: '850px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' }}>
        {/* Tooltip flotante */}
        <AnimatePresence>
          {hoveredWarehouse && !editMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-6 py-4 rounded-xl shadow-2xl border border-slate-700 min-w-[300px]"
            >
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-lg mb-2">{hoveredWarehouse.name}</div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ubicación:</span>
                      <span className="font-semibold">{hoveredWarehouse.location || 'No especificada'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Productos:</span>
                      <span className="font-semibold text-blue-400">{hoveredWarehouse.productsCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Estado:</span>
                      <span className="flex items-center gap-1">
                        {hoveredWarehouse.status.icon}
                        <span className="font-semibold">{hoveredWarehouse.status.type === 'healthy' ? 'Saludable' : hoveredWarehouse.status.type === 'warning' ? 'Alerta' : hoveredWarehouse.status.type === 'critical' ? 'Crítico' : 'Vacío'}</span>
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-400">
                    💡 Haz clic para ver productos
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <svg
          width={MAP_WIDTH * zoom}
          height={MAP_HEIGHT * zoom}
          className="mx-auto"
          style={{ minWidth: '100%', minHeight: '100%' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid */}
          {Array.from({ length: 16 }).map((_, gx) =>
            Array.from({ length: 14 }).map((_, gy) => {
              const pos = gridToIso(gx, gy);
              return (
                <polygon
                  key={`tile-${gx}-${gy}`}
                  points={`${pos.x},${pos.y} ${pos.x + TILE_SIZE / 2},${pos.y + TILE_SIZE / 6} ${pos.x},${pos.y + TILE_SIZE / 3} ${pos.x - TILE_SIZE / 2},${pos.y + TILE_SIZE / 6}`}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="0.8"
                  opacity="0.2"
                />
              );
            })
          )}

          {/* Líneas principales */}
          {Array.from({ length: 4 }).map((_, i) => {
            const startPos = gridToIso(i * 4, 0);
            const endPos = gridToIso(i * 4, 14);
            return (
              <line
                key={`gridV-${i}`}
                x1={startPos.x}
                y1={startPos.y}
                x2={endPos.x}
                y2={endPos.y}
                stroke="#475569"
                strokeWidth="1.5"
                opacity="0.3"
              />
            );
          })}
          {Array.from({ length: 4 }).map((_, i) => {
            const startPos = gridToIso(0, i * 4);
            const endPos = gridToIso(16, i * 4);
            return (
              <line
                key={`gridH-${i}`}
                x1={startPos.x}
                y1={startPos.y}
                x2={endPos.x}
                y2={endPos.y}
                stroke="#475569"
                strokeWidth="1.5"
                opacity="0.3"
              />
            );
          })}

          {/* Bodegas con animación de entrada */}
          {organizedWarehouses.map((warehouse, index) => renderIsometricWarehouse(warehouse, index))}
        </svg>
      </div>

      {/* Leyenda mejorada */}
      <div className="bg-slate-800 border-t border-slate-700 p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="font-bold text-white mb-3 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Bodegas del Local:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {organizedWarehouses.map((warehouse, index) => (
                <div
                  key={warehouse.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all cursor-pointer group"
                  onClick={() => {
                    setSearchHighlight(warehouse.id);
                    setTimeout(() => setSearchHighlight(null), 3000);
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform"
                    style={{ background: warehouse.colors.main }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{warehouse.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      {warehouse.status.icon} {warehouse.productsCount || 0} items
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-56 space-y-3">
            <div className="bg-slate-700 rounded-xl p-4">
              <div className="font-bold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Estado
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🟢</span>
                  <span className="text-slate-300">Saludable</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🟡</span>
                  <span className="text-slate-300">Alerta</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔴</span>
                  <span className="text-slate-300">Crítico</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-700 rounded-xl p-4">
              <div className="font-bold text-white mb-3">📊 Resumen</div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Total bodegas:</span>
                  <span className="font-semibold text-white">{warehouses.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Productos:</span>
                  <span className="font-semibold text-blue-400">
                    {warehouses.reduce((sum, w) => sum + (w.productsCount || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
