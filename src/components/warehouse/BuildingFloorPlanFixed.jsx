import { motion } from 'framer-motion';
import { Maximize2, Minimize2, MapPin, Package, Box, Edit3, Save, Lock, Unlock } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Plano arquitectónico profesional con ubicaciones reales configurables
 * El dueño puede editar y guardar las posiciones reales de las bodegas
 */
export default function BuildingFloorPlanFixed({ warehouses = [], onWarehouseClick, onSaveLayout, canEdit = true }) {
  const [zoom, setZoom] = useState(1);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [warehousePositions, setWarehousePositions] = useState({});
  const [draggingWarehouse, setDraggingWarehouse] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Dimensiones del plano
  const BUILDING_WIDTH = 1200;
  const BUILDING_HEIGHT = 900;
  const WALL_THICKNESS = 12;
  const GRID_SIZE = 20;

  // Inicializar posiciones cuando cambian las bodegas
  useEffect(() => {
    const initialPositions = {};
    warehouses.forEach((warehouse, index) => {
      if (warehouse.position) {
        // Usar posición guardada en Firestore
        initialPositions[warehouse.id] = warehouse.position;
      } else {
        // Usar posición por defecto
        initialPositions[warehouse.id] = getWarehouseLayout(index, warehouses.length);
      }
    });
    setWarehousePositions(initialPositions);
  }, [warehouses]);

  // Layouts por defecto organizados según cantidad de bodegas
  const getWarehouseLayout = (index, total) => {
    // Layout para 1 bodega
    if (total === 1) {
      return { x: 150, y: 150, width: 900, height: 600 };
    }

    // Layout para 2 bodegas (lado a lado)
    if (total === 2) {
      const layouts = [
        { x: 100, y: 150, width: 520, height: 600 },
        { x: 640, y: 150, width: 460, height: 600 }
      ];
      return layouts[index];
    }

    // Layout para 3 bodegas (2 arriba, 1 abajo grande)
    if (total === 3) {
      const layouts = [
        { x: 100, y: 120, width: 480, height: 340 },
        { x: 600, y: 120, width: 500, height: 340 },
        { x: 100, y: 480, width: 1000, height: 340 }
      ];
      return layouts[index];
    }

    // Layout para 4 bodegas (cuadrícula 2x2)
    if (total === 4) {
      const layouts = [
        { x: 100, y: 120, width: 480, height: 340 },
        { x: 600, y: 120, width: 500, height: 340 },
        { x: 100, y: 480, width: 480, height: 340 },
        { x: 600, y: 480, width: 500, height: 340 }
      ];
      return layouts[index];
    }

    // Layout para 5-6 bodegas (grid 3x2)
    const layouts = [
      { x: 80, y: 100, width: 350, height: 320 },
      { x: 450, y: 100, width: 320, height: 320 },
      { x: 790, y: 100, width: 330, height: 320 },
      { x: 80, y: 440, width: 350, height: 320 },
      { x: 450, y: 440, width: 320, height: 320 },
      { x: 790, y: 440, width: 330, height: 320 }
    ];

    return layouts[index] || { x: 100, y: 120, width: 300, height: 280 };
  };

  // Colores profesionales con gradientes
  const warehouseColors = [
    { main: '#3b82f6', shadow: '#1e40af', light: '#dbeafe', dark: '#1e3a8a' },
    { main: '#10b981', shadow: '#059669', light: '#d1fae5', dark: '#064e3b' },
    { main: '#f59e0b', shadow: '#d97706', light: '#fef3c7', dark: '#78350f' },
    { main: '#8b5cf6', shadow: '#7c3aed', light: '#ede9fe', dark: '#5b21b6' },
    { main: '#ef4444', shadow: '#dc2626', light: '#fee2e2', dark: '#991b1b' },
    { main: '#06b6d4', shadow: '#0891b2', light: '#cffafe', dark: '#164e63' }
  ];

  // Handlers para drag & drop
  const handleMouseDown = (e, warehouseId) => {
    if (!editMode) return;

    const svg = e.currentTarget.closest('svg');
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;

    const warehousePos = warehousePositions[warehouseId];
    setDragOffset({
      x: mouseX - warehousePos.x,
      y: mouseY - warehousePos.y
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

    // Calcular nueva posición
    let newX = mouseX - dragOffset.x;
    let newY = mouseY - dragOffset.y;

    // Snap to grid
    newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
    newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

    // Límites del edificio
    newX = Math.max(60, Math.min(BUILDING_WIDTH - currentPos.width - 60, newX));
    newY = Math.max(80, Math.min(BUILDING_HEIGHT - currentPos.height - 40, newY));

    setWarehousePositions(prev => ({
      ...prev,
      [draggingWarehouse]: {
        ...prev[draggingWarehouse],
        x: newX,
        y: newY
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
    layout: warehousePositions[warehouse.id] || getWarehouseLayout(index, warehouses.length),
    colors: warehouseColors[index % warehouseColors.length]
  }));

  return (
    <div className="relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 text-white p-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <MapPin className="w-8 h-8" />
            Plano Arquitectónico del Local
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {warehouses.length} bodega{warehouses.length !== 1 ? 's' : ''} • Vista profesional
          </p>
        </div>

        {/* Controles */}
        <div className="flex gap-3">
          {/* Botón de Editar/Guardar */}
          {canEdit && (
            editMode ? (
              <button
                onClick={handleSavePositions}
                className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                <Save className="w-5 h-5" />
                <span className="hidden md:inline">Guardar Ubicaciones</span>
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                <Edit3 className="w-5 h-5" />
                <span className="hidden md:inline">Editar Ubicaciones</span>
              </button>
            )
          )}

          {/* Controles de zoom */}
          <div className="flex gap-2">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="p-3 bg-slate-600/50 hover:bg-slate-600 rounded-xl transition-all backdrop-blur-sm"
              title="Alejar"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <span className="px-5 py-3 bg-slate-600/50 rounded-xl font-bold backdrop-blur-sm">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="p-3 bg-slate-600/50 hover:bg-slate-600 rounded-xl transition-all backdrop-blur-sm"
              title="Acercar"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {editMode ? <Unlock className="w-5 h-5 text-orange-600" /> : <Lock className="w-5 h-5 text-blue-600" />}
          <span className="text-sm font-medium text-blue-900">
            {editMode ? (
              <><strong>MODO EDICIÓN:</strong> Arrastra las bodegas para ubicarlas según el plano real de tu local</>
            ) : (
              <><strong>Haz clic en una bodega</strong> para ver sus productos y gestionar el inventario</>
            )}
          </span>
        </div>
        {editMode && (
          <span className="text-xs text-orange-600 font-semibold bg-orange-100 px-3 py-1 rounded-full">
            🔧 Editando
          </span>
        )}
      </div>

      {/* Área del plano SVG con scroll */}
      <div className="relative overflow-auto bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100" style={{ height: '800px' }}>
        <svg
          width={BUILDING_WIDTH * zoom}
          height={BUILDING_HEIGHT * zoom}
          className="mx-auto"
          style={{ minWidth: '100%', minHeight: '100%', cursor: editMode ? 'move' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Definiciones SVG (filtros, gradientes, patrones) */}
          <defs>
            {/* Grid de fondo */}
            <pattern id="buildingGrid" width={30 * zoom} height={30 * zoom} patternUnits="userSpaceOnUse">
              <path
                d={`M ${30 * zoom} 0 L 0 0 0 ${30 * zoom}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.5"
                opacity="0.3"
              />
            </pattern>

            {/* Sombra para paredes (efecto 3D) */}
            <filter id="wallShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
              <feOffset dx="6" dy="8" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.6"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Sombra para bodegas */}
            <filter id="warehouseShadow">
              <feDropShadow dx="8" dy="10" stdDeviation="6" floodOpacity="0.5" floodColor="#000000"/>
            </filter>

            {/* Gradiente para el piso */}
            <linearGradient id="floorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e2e8f0"/>
              <stop offset="50%" stopColor="#f1f5f9"/>
              <stop offset="100%" stopColor="#e2e8f0"/>
            </linearGradient>

            {/* Gradientes para cada bodega */}
            {organizedWarehouses.map((wh, idx) => (
              <linearGradient key={`grad-${idx}`} id={`warehouseGrad-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={wh.colors.light}/>
                <stop offset="100%" stopColor={wh.colors.main} stopOpacity="0.3"/>
              </linearGradient>
            ))}
          </defs>

          {/* Fondo con grid */}
          <rect width="100%" height="100%" fill="url(#buildingGrid)" />

          {/* Perímetro del edificio (paredes exteriores) */}
          <g filter="url(#wallShadow)">
            {/* Pared exterior principal */}
            <rect
              x={30 * zoom}
              y={30 * zoom}
              width={(BUILDING_WIDTH - 60) * zoom}
              height={(BUILDING_HEIGHT - 60) * zoom}
              fill="url(#floorGradient)"
              stroke="#1e293b"
              strokeWidth={WALL_THICKNESS * zoom}
              rx={12 * zoom}
            />

            {/* Sombra interna (profundidad) */}
            <rect
              x={35 * zoom}
              y={35 * zoom}
              width={(BUILDING_WIDTH - 70) * zoom}
              height={(BUILDING_HEIGHT - 70) * zoom}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2 * zoom}
              rx={10 * zoom}
              opacity="0.4"
            />
          </g>

          {/* Etiqueta del edificio */}
          <g>
            <rect
              x={50 * zoom}
              y={50 * zoom}
              width={280 * zoom}
              height={40 * zoom}
              fill="white"
              stroke="#1e293b"
              strokeWidth={2 * zoom}
              rx={6 * zoom}
              opacity="0.95"
            />
            <text
              x={190 * zoom}
              y={75 * zoom}
              fill="#1e293b"
              fontSize={18 * zoom}
              fontWeight="bold"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              🏢 PLANTA ARQUITECTÓNICA
            </text>
          </g>

          {/* Entrada principal */}
          <g>
            <rect
              x={(BUILDING_WIDTH / 2 - 60) * zoom}
              y={30 * zoom}
              width={120 * zoom}
              height={WALL_THICKNESS * zoom}
              fill="#1e293b"
            />
            <rect
              x={(BUILDING_WIDTH / 2 - 50) * zoom}
              y={(30 + WALL_THICKNESS) * zoom}
              width={100 * zoom}
              height={4 * zoom}
              fill="#ef4444"
            />
            <text
              x={(BUILDING_WIDTH / 2) * zoom}
              y={(30 + WALL_THICKNESS + 20) * zoom}
              textAnchor="middle"
              fill="#64748b"
              fontSize={11 * zoom}
              fontWeight="700"
            >
              ⬇ ENTRADA PRINCIPAL
            </text>
          </g>

          {/* Bodegas como habitaciones arquitectónicas */}
          {organizedWarehouses.map((warehouse, index) => {
            const { layout, colors } = warehouse;
            const isHovered = hoveredWarehouse?.id === warehouse.id;
            const isDragging = draggingWarehouse === warehouse.id;
            const scale = isHovered && !editMode ? 1.02 : 1;

            return (
              <g
                key={warehouse.id}
                className={editMode ? "cursor-move" : "cursor-pointer"}
                onMouseEnter={() => !editMode && setHoveredWarehouse(warehouse)}
                onMouseLeave={() => !editMode && setHoveredWarehouse(null)}
                onClick={(e) => {
                  if (!editMode) {
                    onWarehouseClick(warehouse);
                  }
                }}
                onMouseDown={(e) => handleMouseDown(e, warehouse.id)}
                style={{
                  transformOrigin: 'center',
                  opacity: isDragging ? 0.7 : 1,
                  transition: isDragging ? 'none' : 'all 0.3s ease'
                }}
              >
                {/* Sombra de bodega */}
                <rect
                  x={(layout.x + 6) * zoom}
                  y={(layout.y + 8) * zoom}
                  width={layout.width * zoom * scale}
                  height={layout.height * zoom * scale}
                  fill="rgba(0,0,0,0.25)"
                  rx={6 * zoom}
                  filter="blur(6px)"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Área de la bodega (habitación) */}
                <rect
                  x={layout.x * zoom}
                  y={layout.y * zoom}
                  width={layout.width * zoom * scale}
                  height={layout.height * zoom * scale}
                  fill={`url(#warehouseGrad-${index})`}
                  stroke={editMode && isDragging ? '#f97316' : (isHovered ? colors.dark : colors.shadow)}
                  strokeWidth={editMode && isDragging ? 8 * zoom : (isHovered ? 6 * zoom : 4 * zoom)}
                  rx={6 * zoom}
                  style={{
                    filter: isHovered && !editMode ? 'brightness(1.15)' : 'brightness(1)',
                    transition: isDragging ? 'none' : 'all 0.3s ease'
                  }}
                />

                {/* Líneas internas (detalle arquitectónico) */}
                <rect
                  x={(layout.x + 4) * zoom}
                  y={(layout.y + 4) * zoom}
                  width={(layout.width - 8) * zoom * scale}
                  height={(layout.height - 8) * zoom * scale}
                  fill="none"
                  stroke={colors.shadow}
                  strokeWidth={1.5 * zoom}
                  rx={4 * zoom}
                  opacity="0.3"
                  strokeDasharray={`${8 * zoom} ${4 * zoom}`}
                />

                {/* Número de bodega (estilo arquitectónico) */}
                <g>
                  <circle
                    cx={(layout.x + 35) * zoom}
                    cy={(layout.y + 35) * zoom}
                    r={22 * zoom}
                    fill="white"
                    stroke={colors.dark}
                    strokeWidth={3 * zoom}
                  />
                  <text
                    x={(layout.x + 35) * zoom}
                    y={(layout.y + 42) * zoom}
                    textAnchor="middle"
                    fill={colors.dark}
                    fontSize={20 * zoom}
                    fontWeight="bold"
                  >
                    {index + 1}
                  </text>
                </g>

                {/* Nombre de la bodega */}
                <g>
                  <rect
                    x={(layout.x + layout.width / 2 - 120) * zoom}
                    y={(layout.y + 30) * zoom}
                    width={240 * zoom}
                    height={35 * zoom}
                    fill="white"
                    stroke={colors.main}
                    strokeWidth={2 * zoom}
                    rx={6 * zoom}
                    opacity="0.95"
                  />
                  <text
                    x={(layout.x + layout.width / 2) * zoom}
                    y={(layout.y + 53) * zoom}
                    textAnchor="middle"
                    fill="#1e293b"
                    fontSize={16 * zoom}
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    {warehouse.name}
                  </text>
                </g>

                {/* Ubicación */}
                {warehouse.location && (
                  <text
                    x={(layout.x + layout.width / 2) * zoom}
                    y={(layout.y + 75) * zoom}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={11 * zoom}
                    fontFamily="sans-serif"
                  >
                    📍 {warehouse.location}
                  </text>
                )}

                {/* Contador de productos (centro) */}
                <g>
                  <rect
                    x={(layout.x + layout.width / 2 - 70) * zoom}
                    y={(layout.y + layout.height / 2 - 35) * zoom}
                    width={140 * zoom}
                    height={70 * zoom}
                    fill="white"
                    stroke={colors.main}
                    strokeWidth={3 * zoom}
                    rx={12 * zoom}
                    filter="url(#warehouseShadow)"
                  />
                  <text
                    x={(layout.x + layout.width / 2) * zoom}
                    y={(layout.y + layout.height / 2 - 10) * zoom}
                    textAnchor="middle"
                    fill={colors.dark}
                    fontSize={36 * zoom}
                    fontWeight="bold"
                  >
                    {warehouse.productsCount || 0}
                  </text>
                  <text
                    x={(layout.x + layout.width / 2) * zoom}
                    y={(layout.y + layout.height / 2 + 18) * zoom}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={12 * zoom}
                    fontWeight="600"
                  >
                    PRODUCTOS
                  </text>
                </g>

                {/* Puerta de la bodega */}
                <g>
                  <rect
                    x={(layout.x + layout.width - 8) * zoom}
                    y={(layout.y + layout.height / 2 - 30) * zoom}
                    width={8 * zoom}
                    height={60 * zoom}
                    fill={colors.dark}
                    stroke="#000000"
                    strokeWidth={1 * zoom}
                  />
                  {/* Manija */}
                  <circle
                    cx={(layout.x + layout.width - 12) * zoom}
                    cy={(layout.y + layout.height / 2) * zoom}
                    r={4 * zoom}
                    fill="#fbbf24"
                    stroke="#92400e"
                    strokeWidth={1 * zoom}
                  />
                </g>

                {/* Decoración: estanterías internas (si hay productos) */}
                {warehouse.productsCount > 0 && (
                  <g opacity="0.25">
                    {[0, 1, 2].map((shelf) => (
                      <g key={shelf}>
                        <rect
                          x={(layout.x + 30 + shelf * (layout.width / 4)) * zoom}
                          y={(layout.y + layout.height - 80) * zoom}
                          width={60 * zoom}
                          height={30 * zoom}
                          fill="#8b6f47"
                          stroke="#654321"
                          strokeWidth={2 * zoom}
                          rx={2 * zoom}
                        />
                        {/* Cajas en estanterías */}
                        <rect
                          x={(layout.x + 35 + shelf * (layout.width / 4)) * zoom}
                          y={(layout.y + layout.height - 75) * zoom}
                          width={20 * zoom}
                          height={15 * zoom}
                          fill={colors.main}
                          stroke={colors.dark}
                          strokeWidth={1 * zoom}
                          rx={1 * zoom}
                        />
                      </g>
                    ))}
                  </g>
                )}

                {/* Indicador hover */}
                {isHovered && !editMode && (
                  <g>
                    <rect
                      x={layout.x * zoom}
                      y={layout.y * zoom}
                      width={layout.width * zoom}
                      height={layout.height * zoom}
                      fill={colors.main}
                      opacity="0.15"
                      rx={6 * zoom}
                      style={{
                        animation: 'pulse 2s infinite'
                      }}
                    />
                  </g>
                )}

                {/* Indicador de modo edición */}
                {editMode && (
                  <g style={{ pointerEvents: 'none' }}>
                    {/* Icono de movimiento */}
                    <circle
                      cx={(layout.x + layout.width / 2) * zoom}
                      cy={(layout.y + layout.height - 35) * zoom}
                      r={18 * zoom}
                      fill="white"
                      stroke="#f97316"
                      strokeWidth={3 * zoom}
                      opacity="0.95"
                    />
                    <text
                      x={(layout.x + layout.width / 2) * zoom}
                      y={(layout.y + layout.height - 27) * zoom}
                      textAnchor="middle"
                      fontSize={18 * zoom}
                    >
                      ⚡
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Medidas del plano (cotas arquitectónicas) */}
          <g opacity="0.5">
            {/* Cota horizontal */}
            <line
              x1={40 * zoom}
              y1={(BUILDING_HEIGHT - 15) * zoom}
              x2={(BUILDING_WIDTH - 40) * zoom}
              y2={(BUILDING_HEIGHT - 15) * zoom}
              stroke="#475569"
              strokeWidth={2 * zoom}
            />
            <line x1={40 * zoom} y1={(BUILDING_HEIGHT - 20) * zoom} x2={40 * zoom} y2={(BUILDING_HEIGHT - 10) * zoom} stroke="#475569" strokeWidth={2 * zoom} />
            <line x1={(BUILDING_WIDTH - 40) * zoom} y1={(BUILDING_HEIGHT - 20) * zoom} x2={(BUILDING_WIDTH - 40) * zoom} y2={(BUILDING_HEIGHT - 10) * zoom} stroke="#475569" strokeWidth={2 * zoom} />
            <text
              x={(BUILDING_WIDTH / 2) * zoom}
              y={(BUILDING_HEIGHT - 20) * zoom}
              textAnchor="middle"
              fill="#475569"
              fontSize={11 * zoom}
              fontWeight="600"
            >
              {((BUILDING_WIDTH - 80) / 100).toFixed(1)} m
            </text>

            {/* Cota vertical */}
            <line
              x1={(BUILDING_WIDTH - 15) * zoom}
              y1={40 * zoom}
              x2={(BUILDING_WIDTH - 15) * zoom}
              y2={(BUILDING_HEIGHT - 40) * zoom}
              stroke="#475569"
              strokeWidth={2 * zoom}
            />
            <line x1={(BUILDING_WIDTH - 20) * zoom} y1={40 * zoom} x2={(BUILDING_WIDTH - 10) * zoom} y2={40 * zoom} stroke="#475569" strokeWidth={2 * zoom} />
            <line x1={(BUILDING_WIDTH - 20) * zoom} y1={(BUILDING_HEIGHT - 40) * zoom} x2={(BUILDING_WIDTH - 10) * zoom} y2={(BUILDING_HEIGHT - 40) * zoom} stroke="#475569" strokeWidth={2 * zoom} />
            <text
              x={(BUILDING_WIDTH - 25) * zoom}
              y={(BUILDING_HEIGHT / 2) * zoom}
              textAnchor="middle"
              fill="#475569"
              fontSize={11 * zoom}
              fontWeight="600"
              transform={`rotate(-90, ${(BUILDING_WIDTH - 25) * zoom}, ${(BUILDING_HEIGHT / 2) * zoom})`}
            >
              {((BUILDING_HEIGHT - 80) / 100).toFixed(1)} m
            </text>
          </g>
        </svg>
      </div>

      {/* Leyenda profesional */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200 p-6">
        <div className="flex items-start justify-between gap-6">
          {/* Índice de bodegas */}
          <div className="flex-1">
            <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Box className="w-5 h-5" />
              Índice de Bodegas:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {organizedWarehouses.map((warehouse, index) => (
                <div
                  key={warehouse.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => onWarehouseClick(warehouse)}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow-md"
                    style={{ background: warehouse.colors.main }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{warehouse.name}</div>
                    <div className="text-xs text-slate-500">{warehouse.productsCount || 0} productos</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info del edificio */}
          <div className="w-64 bg-white rounded-xl border-2 border-slate-200 p-4">
            <div className="font-bold text-slate-800 mb-3">📋 Información</div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Escala:</span>
                <span className="font-semibold">1:{Math.round(100 / zoom)}</span>
              </div>
              <div className="flex justify-between">
                <span>Área total:</span>
                <span className="font-semibold">{((BUILDING_WIDTH * BUILDING_HEIGHT) / 10000).toFixed(0)} m²</span>
              </div>
              <div className="flex justify-between">
                <span>Bodegas:</span>
                <span className="font-semibold">{warehouses.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Productos totales:</span>
                <span className="font-semibold text-blue-600">
                  {warehouses.reduce((sum, w) => sum + (w.productsCount || 0), 0)}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
              Actualizado: {new Date().toLocaleDateString('es-CL')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
