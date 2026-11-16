import { motion } from 'framer-motion';
import { Maximize2, Minimize2, MapPin, Move, Edit3, Save } from 'lucide-react';
import { useState } from 'react';

/**
 * Plano arquitectónico profesional con drag & drop de bodegas
 * Estilo: Vista isométrica con sombras y profundidad
 */
export default function BuildingFloorPlanPro({ warehouses = [], onWarehouseClick, onSaveLayout }) {
  const [zoom, setZoom] = useState(1);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [warehousePositions, setWarehousePositions] = useState(() => {
    // Inicializar posiciones de bodegas
    return warehouses.reduce((acc, warehouse, index) => {
      acc[warehouse.id] = warehouse.position || getDefaultPosition(index, warehouses.length);
      return acc;
    }, {});
  });
  const [draggingWarehouse, setDraggingWarehouse] = useState(null);

  // Dimensiones del plano
  const BUILDING_WIDTH = 1000;
  const BUILDING_HEIGHT = 800;
  const GRID_SIZE = 20;

  // Obtener posición por defecto
  function getDefaultPosition(index, total) {
    const layouts = [
      [{ x: 150, y: 150, width: 700, height: 500 }],
      [
        { x: 100, y: 150, width: 400, height: 500 },
        { x: 520, y: 150, width: 380, height: 500 }
      ],
      [
        { x: 100, y: 120, width: 380, height: 300 },
        { x: 500, y: 120, width: 400, height: 300 },
        { x: 100, y: 440, width: 800, height: 280 }
      ],
      [
        { x: 100, y: 120, width: 380, height: 280 },
        { x: 500, y: 120, width: 400, height: 280 },
        { x: 100, y: 420, width: 380, height: 300 },
        { x: 500, y: 420, width: 400, height: 300 }
      ]
    ];

    const layoutIndex = Math.min(total - 1, 3);
    return layouts[layoutIndex]?.[index] || { x: 100 + (index % 3) * 300, y: 120 + Math.floor(index / 3) * 300, width: 280, height: 260 };
  }

  // Colores profesionales
  const warehouseColors = [
    { main: '#3b82f6', shadow: '#1e3a8a', light: '#93c5fd' },
    { main: '#10b981', shadow: '#064e3b', light: '#6ee7b7' },
    { main: '#f59e0b', shadow: '#78350f', light: '#fcd34d' },
    { main: '#8b5cf6', shadow: '#4c1d95', light: '#c4b5fd' },
    { main: '#ef4444', shadow: '#7f1d1d', light: '#fca5a5' },
    { main: '#06b6d4', shadow: '#164e63', light: '#67e8f9' }
  ];

  // Manejar inicio de arrastre
  const handleDragStart = (e, warehouseId) => {
    if (!editMode) return;
    setDraggingWarehouse(warehouseId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Manejar arrastre
  const handleDrag = (e, warehouseId) => {
    if (!editMode || !draggingWarehouse) return;

    const svg = e.target.closest('svg');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Snap to grid
    const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

    // Límites
    const currentPos = warehousePositions[warehouseId];
    const newX = Math.max(60, Math.min(BUILDING_WIDTH - currentPos.width - 60, snappedX));
    const newY = Math.max(80, Math.min(BUILDING_HEIGHT - currentPos.height - 40, snappedY));

    setWarehousePositions(prev => ({
      ...prev,
      [warehouseId]: {
        ...prev[warehouseId],
        x: newX,
        y: newY
      }
    }));
  };

  // Finalizar arrastre
  const handleDragEnd = () => {
    setDraggingWarehouse(null);
  };

  // Guardar layout
  const handleSaveLayout = () => {
    if (onSaveLayout) {
      onSaveLayout(warehousePositions);
    }
    setEditMode(false);
  };

  return (
    <div className="relative w-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden border-4 border-slate-700">
      {/* Header profesional */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 border-b-2 border-slate-700">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
              <MapPin className="w-8 h-8" />
              PLANO ARQUITECTÓNICO
            </h2>
            <p className="text-sm text-slate-300">Layout del edificio • {warehouses.length} bodegas</p>
          </div>

          {/* Controles */}
          <div className="flex gap-3">
            {/* Modo edición */}
            <button
              onClick={() => editMode ? handleSaveLayout() : setEditMode(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                editMode
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {editMode ? (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Layout
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Editar Layout
                </>
              )}
            </button>

            {/* Zoom */}
            <div className="flex gap-2">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                title="Alejar"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
              <span className="px-4 py-2 bg-slate-700 rounded-lg font-medium min-w-[80px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                title="Acercar"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Instrucciones en modo edición */}
        {editMode && (
          <div className="mt-4 bg-blue-600/20 border border-blue-500 rounded-lg px-4 py-3 text-sm">
            <Move className="w-4 h-4 inline mr-2" />
            <strong>Modo Edición:</strong> Arrastra las bodegas para reorganizar el layout. Los cambios se ajustan automáticamente a la cuadrícula.
          </div>
        )}
      </div>

      {/* Plano SVG con estilo isométrico */}
      <div
        className="relative overflow-auto"
        style={{
          height: '800px',
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
        }}
      >
        <svg
          width={BUILDING_WIDTH * zoom}
          height={BUILDING_HEIGHT * zoom}
          className="mx-auto drop-shadow-2xl"
          style={{ minWidth: '100%', minHeight: '100%' }}
        >
          {/* Definiciones (sombras, gradientes, patrones) */}
          <defs>
            {/* Grid profesional */}
            <pattern id="professionalGrid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse">
              <path
                d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`}
                fill="none"
                stroke="#475569"
                strokeWidth="0.5"
                opacity="0.3"
              />
            </pattern>

            {/* Sombra para paredes */}
            <filter id="wallShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="4" dy="4" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Sombra para bodegas (efecto 3D) */}
            <filter id="warehouseShadow">
              <feDropShadow dx="6" dy="8" stdDeviation="4" floodOpacity="0.4"/>
            </filter>

            {/* Gradiente para piso */}
            <linearGradient id="floorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#cbd5e1"/>
              <stop offset="50%" stopColor="#e2e8f0"/>
              <stop offset="100%" stopColor="#cbd5e1"/>
            </linearGradient>
          </defs>

          {/* Grid de fondo */}
          <rect width="100%" height="100%" fill="url(#professionalGrid)" />

          {/* Perímetro del edificio con efecto 3D */}
          <g filter="url(#wallShadow)">
            {/* Sombra externa */}
            <rect
              x={25 * zoom}
              y={25 * zoom}
              width={(BUILDING_WIDTH - 50) * zoom}
              height={(BUILDING_HEIGHT - 50) * zoom}
              fill="#0f172a"
              rx={12 * zoom}
            />

            {/* Pared principal */}
            <rect
              x={20 * zoom}
              y={20 * zoom}
              width={(BUILDING_WIDTH - 40) * zoom}
              height={(BUILDING_HEIGHT - 40) * zoom}
              fill="url(#floorGradient)"
              stroke="#1e293b"
              strokeWidth={8 * zoom}
              rx={12 * zoom}
            />

            {/* Borde interno */}
            <rect
              x={30 * zoom}
              y={30 * zoom}
              width={(BUILDING_WIDTH - 60) * zoom}
              height={(BUILDING_HEIGHT - 60) * zoom}
              fill="none"
              stroke="#64748b"
              strokeWidth={2 * zoom}
              strokeDasharray={`${10 * zoom},${5 * zoom}`}
              rx={8 * zoom}
              opacity="0.5"
            />
          </g>

          {/* Título del edificio */}
          <text
            x={50 * zoom}
            y={60 * zoom}
            fill="#1e293b"
            fontSize={24 * zoom}
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            🏢 EDIFICIO PRINCIPAL
          </text>

          {/* Entrada principal con diseño profesional */}
          <g>
            <rect
              x={(BUILDING_WIDTH / 2 - 60) * zoom}
              y={20 * zoom}
              width={120 * zoom}
              height={12 * zoom}
              fill="#1e293b"
            />
            <rect
              x={(BUILDING_WIDTH / 2 - 50) * zoom}
              y={22 * zoom}
              width={100 * zoom}
              height={8 * zoom}
              fill="#3b82f6"
            />
            <text
              x={(BUILDING_WIDTH / 2) * zoom}
              y={45 * zoom}
              textAnchor="middle"
              fill="#475569"
              fontSize={11 * zoom}
              fontWeight="600"
            >
              ↓ ENTRADA PRINCIPAL ↓
            </text>
          </g>

          {/* Bodegas con estilo isométrico y drag & drop */}
          {warehouses.map((warehouse, index) => {
            const position = warehousePositions[warehouse.id] || getDefaultPosition(index, warehouses.length);
            const colorScheme = warehouseColors[index % warehouseColors.length];
            const isHovered = hoveredWarehouse?.id === warehouse.id;
            const isDragging = draggingWarehouse === warehouse.id;

            return (
              <g
                key={warehouse.id}
                className={editMode ? 'cursor-move' : 'cursor-pointer'}
                style={{ transition: isDragging ? 'none' : 'all 0.3s' }}
                onMouseEnter={() => setHoveredWarehouse(warehouse)}
                onMouseLeave={() => setHoveredWarehouse(null)}
                onClick={() => !editMode && onWarehouseClick(warehouse)}
                draggable={editMode}
                onDragStart={(e) => handleDragStart(e, warehouse.id)}
                onDrag={(e) => handleDrag(e, warehouse.id)}
                onDragEnd={handleDragEnd}
              >
                {/* Sombra de la bodega (efecto 3D) */}
                <rect
                  x={(position.x + 8) * zoom}
                  y={(position.y + 8) * zoom}
                  width={position.width * zoom}
                  height={position.height * zoom}
                  fill={colorScheme.shadow}
                  rx={6 * zoom}
                  opacity="0.4"
                />

                {/* Pared de la bodega */}
                <rect
                  x={position.x * zoom}
                  y={position.y * zoom}
                  width={position.width * zoom}
                  height={position.height * zoom}
                  fill={isHovered || isDragging ? colorScheme.main : colorScheme.light}
                  stroke={colorScheme.shadow}
                  strokeWidth={(isHovered || isDragging ? 4 : 2) * zoom}
                  rx={6 * zoom}
                  filter="url(#warehouseShadow)"
                  style={{ transition: 'all 0.3s' }}
                />

                {/* Gradiente interno */}
                <rect
                  x={(position.x + 5) * zoom}
                  y={(position.y + 5) * zoom}
                  width={(position.width - 10) * zoom}
                  height={(position.height - 10) * zoom}
                  fill="white"
                  opacity="0.1"
                  rx={4 * zoom}
                />

                {/* Número de la bodega (estilo arquitectónico) */}
                <circle
                  cx={(position.x + 30) * zoom}
                  cy={(position.y + 30) * zoom}
                  r={18 * zoom}
                  fill="white"
                  stroke={colorScheme.shadow}
                  strokeWidth={2 * zoom}
                />
                <text
                  x={(position.x + 30) * zoom}
                  y={(position.y + 36) * zoom}
                  textAnchor="middle"
                  fill={colorScheme.shadow}
                  fontSize={16 * zoom}
                  fontWeight="bold"
                >
                  {index + 1}
                </text>

                {/* Nombre de la bodega */}
                <text
                  x={(position.x + position.width / 2) * zoom}
                  y={(position.y + 50) * zoom}
                  textAnchor="middle"
                  fill="#1e293b"
                  fontSize={18 * zoom}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {warehouse.name}
                </text>

                {/* Ubicación */}
                {warehouse.location && (
                  <text
                    x={(position.x + position.width / 2) * zoom}
                    y={(position.y + 72) * zoom}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize={11 * zoom}
                    fontFamily="sans-serif"
                  >
                    📍 {warehouse.location}
                  </text>
                )}

                {/* Badge de cantidad de productos (centro) */}
                <g>
                  <rect
                    x={(position.x + position.width / 2 - 70) * zoom}
                    y={(position.y + position.height / 2 - 30) * zoom}
                    width={140 * zoom}
                    height={60 * zoom}
                    fill="white"
                    stroke={colorScheme.shadow}
                    strokeWidth={3 * zoom}
                    rx={12 * zoom}
                    filter="url(#warehouseShadow)"
                  />
                  <text
                    x={(position.x + position.width / 2) * zoom}
                    y={(position.y + position.height / 2 - 5) * zoom}
                    textAnchor="middle"
                    fill={colorScheme.main}
                    fontSize={32 * zoom}
                    fontWeight="bold"
                  >
                    {warehouse.productsCount || 0}
                  </text>
                  <text
                    x={(position.x + position.width / 2) * zoom}
                    y={(position.y + position.height / 2 + 18) * zoom}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={12 * zoom}
                    fontWeight="600"
                  >
                    PRODUCTOS
                  </text>
                </g>

                {/* Puerta de la bodega (lado derecho) */}
                <g>
                  <rect
                    x={(position.x + position.width - 10) * zoom}
                    y={(position.y + position.height / 2 - 30) * zoom}
                    width={8 * zoom}
                    height={60 * zoom}
                    fill="#64748b"
                    stroke="#1e293b"
                    strokeWidth={2 * zoom}
                    rx={2 * zoom}
                  />
                  <circle
                    cx={(position.x + position.width - 6) * zoom}
                    cy={(position.y + position.height / 2) * zoom}
                    r={3 * zoom}
                    fill="#fbbf24"
                  />
                </g>

                {/* Decoración: estanterías internas (solo si hay productos) */}
                {warehouse.productsCount > 0 && position.width > 200 && (
                  <g opacity="0.2">
                    {[0, 1, 2].map((shelf) => (
                      <g key={shelf}>
                        <rect
                          x={(position.x + 20 + shelf * Math.min(80, position.width / 4)) * zoom}
                          y={(position.y + position.height - 70) * zoom}
                          width={Math.min(60, position.width / 5) * zoom}
                          height={30 * zoom}
                          fill="#8b6f47"
                          stroke="#654321"
                          strokeWidth={1 * zoom}
                          rx={2 * zoom}
                        />
                        {/* Cajitas en estantería */}
                        <rect
                          x={(position.x + 25 + shelf * Math.min(80, position.width / 4)) * zoom}
                          y={(position.y + position.height - 65) * zoom}
                          width={15 * zoom}
                          height={10 * zoom}
                          fill="#10b981"
                          opacity="0.8"
                        />
                      </g>
                    ))}
                  </g>
                )}

                {/* Icono de arrastre en modo edición */}
                {editMode && (
                  <g>
                    <circle
                      cx={(position.x + position.width - 40) * zoom}
                      cy={(position.y + 40) * zoom}
                      r={20 * zoom}
                      fill="white"
                      stroke={colorScheme.main}
                      strokeWidth={2 * zoom}
                    />
                    <text
                      x={(position.x + position.width - 40) * zoom}
                      y={(position.y + 46) * zoom}
                      textAnchor="middle"
                      fontSize={16 * zoom}
                    >
                      ↔
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Medidas arquitectónicas */}
          <g opacity="0.6">
            {/* Cota horizontal */}
            <line
              x1={40 * zoom}
              y1={(BUILDING_HEIGHT - 12) * zoom}
              x2={(BUILDING_WIDTH - 40) * zoom}
              y2={(BUILDING_HEIGHT - 12) * zoom}
              stroke="#94a3b8"
              strokeWidth={1.5 * zoom}
            />
            <line x1={40 * zoom} y1={(BUILDING_HEIGHT - 15) * zoom} x2={40 * zoom} y2={(BUILDING_HEIGHT - 9) * zoom} stroke="#94a3b8" strokeWidth={1.5 * zoom} />
            <line x1={(BUILDING_WIDTH - 40) * zoom} y1={(BUILDING_HEIGHT - 15) * zoom} x2={(BUILDING_WIDTH - 40) * zoom} y2={(BUILDING_HEIGHT - 9) * zoom} stroke="#94a3b8" strokeWidth={1.5 * zoom} />
            <text
              x={(BUILDING_WIDTH / 2) * zoom}
              y={(BUILDING_HEIGHT - 20) * zoom}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={12 * zoom}
              fontWeight="600"
            >
              {((BUILDING_WIDTH - 80) / 100).toFixed(1)} m
            </text>

            {/* Cota vertical */}
            <line
              x1={(BUILDING_WIDTH - 12) * zoom}
              y1={40 * zoom}
              x2={(BUILDING_WIDTH - 12) * zoom}
              y2={(BUILDING_HEIGHT - 40) * zoom}
              stroke="#94a3b8"
              strokeWidth={1.5 * zoom}
            />
            <text
              x={(BUILDING_WIDTH - 20) * zoom}
              y={(BUILDING_HEIGHT / 2) * zoom}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={12 * zoom}
              fontWeight="600"
              transform={`rotate(-90, ${(BUILDING_WIDTH - 20) * zoom}, ${(BUILDING_HEIGHT / 2) * zoom})`}
            >
              {((BUILDING_HEIGHT - 80) / 100).toFixed(1)} m
            </text>
          </g>
        </svg>
      </div>

      {/* Leyenda profesional estilo arquitectónico */}
      <div className="bg-slate-900 border-t-2 border-slate-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lista de bodegas */}
          <div>
            <div className="font-bold text-white mb-3 text-lg">📋 ÍNDICE DE BODEGAS:</div>
            <div className="space-y-2">
              {warehouses.map((warehouse, index) => {
                const colorScheme = warehouseColors[index % warehouseColors.length];
                return (
                  <div
                    key={warehouse.id}
                    className="flex items-center gap-3 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-750 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm border-2"
                        style={{
                          background: colorScheme.main,
                          borderColor: colorScheme.shadow
                        }}
                      >
                        {index + 1}
                      </div>
                      <div
                        className="w-6 h-6 rounded"
                        style={{ background: colorScheme.light }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{warehouse.name}</div>
                      {warehouse.location && (
                        <div className="text-xs text-slate-400">{warehouse.location}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{warehouse.productsCount || 0}</div>
                      <div className="text-xs text-slate-400">items</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Información del plano */}
          <div>
            <div className="font-bold text-white mb-3 text-lg">ℹ️ INFORMACIÓN DEL PLANO:</div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Escala:</span>
                <span className="font-mono font-bold text-white">1:{Math.round(100 / zoom)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Área Total:</span>
                <span className="font-mono font-bold text-white">{((BUILDING_WIDTH * BUILDING_HEIGHT) / 10000).toFixed(0)} m²</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Bodegas:</span>
                <span className="font-mono font-bold text-white">{warehouses.length}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Productos:</span>
                <span className="font-mono font-bold text-white">
                  {warehouses.reduce((sum, w) => sum + (w.productsCount || 0), 0)}
                </span>
              </div>
              <div className="border-t border-slate-700 pt-2 mt-2 text-slate-400 text-xs">
                Plano generado: {new Date().toLocaleDateString('es-CL')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
