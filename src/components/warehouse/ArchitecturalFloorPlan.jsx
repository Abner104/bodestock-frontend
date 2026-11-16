import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Circle, Text, Line, Group, Path } from 'react-konva';
import { motion } from 'framer-motion';
import { Maximize2, Minimize2, MapPin, Edit3, Save, Package, ZoomIn, ZoomOut, Search } from 'lucide-react';

/**
 * Plano arquitectónico realista (como las imágenes de referencia)
 * Estilo: Plano profesional de construcción con paredes gruesas, puertas, ventanas
 */
export default function ArchitecturalFloorPlan({ warehouses = [], onWarehouseClick, onSaveLayout, canEdit = true }) {
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);
  const [warehousePositions, setWarehousePositions] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const stageRef = useRef(null);

  const MAP_WIDTH = 2200;
  const MAP_HEIGHT = 1200;
  const WALL_THICKNESS = 20; // Paredes gruesas como plano real

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

  // Layout por defecto con diseño arquitectónico - MÁS DISPERSO en el canvas más grande
  const getDefaultPosition = (index, total) => {
    const layouts = [
      [{ x: 650, y: 350, width: 900, height: 500 }], // 1 bodega - centro
      [
        { x: 100, y: 300, width: 800, height: 600 },
        { x: 1300, y: 300, width: 800, height: 600 }
      ], // 2 bodegas - extremos izq/der
      [
        { x: 100, y: 100, width: 650, height: 450 },
        { x: 1450, y: 100, width: 650, height: 450 },
        { x: 800, y: 680, width: 600, height: 420 }
      ], // 3 bodegas - 2 arriba, 1 abajo centro
      [
        { x: 100, y: 100, width: 700, height: 450 },
        { x: 1400, y: 100, width: 700, height: 450 },
        { x: 100, y: 680, width: 700, height: 420 },
        { x: 1400, y: 680, width: 700, height: 420 }
      ], // 4 bodegas - esquinas
      [
        { x: 80, y: 80, width: 520, height: 400 },
        { x: 840, y: 80, width: 520, height: 400 },
        { x: 1600, y: 80, width: 520, height: 400 },
        { x: 240, y: 700, width: 520, height: 400 },
        { x: 1360, y: 700, width: 520, height: 400 }
      ], // 5 bodegas - dispersas
      [
        { x: 80, y: 80, width: 500, height: 400 },
        { x: 840, y: 80, width: 500, height: 400 },
        { x: 1600, y: 80, width: 500, height: 400 },
        { x: 80, y: 700, width: 500, height: 400 },
        { x: 840, y: 700, width: 500, height: 400 },
        { x: 1600, y: 700, width: 500, height: 400 }
      ] // 6 bodegas - grid completo
    ];

    const layoutIndex = Math.min(total - 1, 5);
    return layouts[layoutIndex]?.[index] || {
      x: 80 + (index % 4) * 760,
      y: 80 + Math.floor(index / 4) * 620,
      width: 500,
      height: 400
    };
  };

  // Colores arquitectónicos realistas
  const warehouseColors = [
    { fill: '#e8f4f8', wall: '#2c3e50', door: '#8b4513', label: '#1e3a8a' },
    { fill: '#e8f5e9', wall: '#2c3e50', door: '#8b4513', label: '#065f46' },
    { fill: '#fff3e0', wall: '#2c3e50', door: '#8b4513', label: '#92400e' },
    { fill: '#f3e5f5', wall: '#2c3e50', door: '#8b4513', label: '#6b21a8' },
    { fill: '#ffebee', wall: '#2c3e50', door: '#8b4513', label: '#991b1b' },
    { fill: '#e0f2f1', wall: '#2c3e50', door: '#8b4513', label: '#065f46' }
  ];

  const getWarehouseStatus = (warehouse) => {
    const count = warehouse.productsCount || 0;
    if (count === 0) return { color: '#94a3b8', icon: '○', text: 'Vacío' };
    if (count < 5) return { color: '#ef4444', icon: '●', text: 'Crítico' };
    if (count < 15) return { color: '#f59e0b', icon: '●', text: 'Medio' };
    return { color: '#10b981', icon: '●', text: 'OK' };
  };

  // Filtrar bodegas por búsqueda
  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    warehouse.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const organizedWarehouses = filteredWarehouses.slice(0, 6).map((warehouse, index) => ({
    ...warehouse,
    position: warehousePositions[warehouse.id] || getDefaultPosition(index, filteredWarehouses.length),
    colors: warehouseColors[index % warehouseColors.length],
    status: getWarehouseStatus(warehouse),
    index
  }));

  const handleDragEnd = (warehouseId, e) => {
    if (!editMode) return;
    const node = e.target;
    setWarehousePositions(prev => ({
      ...prev,
      [warehouseId]: {
        ...prev[warehouseId],
        x: node.x(),
        y: node.y()
      }
    }));
  };

  const handleSavePositions = () => {
    if (onSaveLayout) {
      onSaveLayout(warehousePositions);
    }
    setEditMode(false);
  };

  // Componente: Habitación/Bodega estilo arquitectónico
  const ArchitecturalRoom = ({ warehouse }) => {
    const { position, colors, status, index } = warehouse;
    const { x, y, width, height } = position;
    const isHovered = hoveredWarehouse?.id === warehouse.id;

    return (
      <Group
        x={x}
        y={y}
        draggable={editMode}
        onDragEnd={(e) => handleDragEnd(warehouse.id, e)}
        onMouseEnter={() => !editMode && setHoveredWarehouse(warehouse)}
        onMouseLeave={() => !editMode && setHoveredWarehouse(null)}
        onClick={() => !editMode && onWarehouseClick(warehouse)}
      >
        {/* Piso de la habitación */}
        <Rect
          width={width}
          height={height}
          fill={colors.fill}
          stroke="none"
        />

        {/* Patrón de piso (líneas de baldosas) */}
        {Array.from({ length: Math.floor(height / 50) + 1 }).map((_, i) => (
          <Line
            key={`floor-h-${i}`}
            points={[0, i * 50, width, i * 50]}
            stroke="#d1d5db"
            strokeWidth={0.5}
            opacity={0.3}
          />
        ))}
        {Array.from({ length: Math.floor(width / 50) + 1 }).map((_, i) => (
          <Line
            key={`floor-v-${i}`}
            points={[i * 50, 0, i * 50, height]}
            stroke="#d1d5db"
            strokeWidth={0.5}
            opacity={0.3}
          />
        ))}

        {/* PAREDES (gruesas como plano arquitectónico) */}
        {/* Pared superior */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={WALL_THICKNESS}
          fill={colors.wall}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* Pared derecha */}
        <Rect
          x={width - WALL_THICKNESS}
          y={0}
          width={WALL_THICKNESS}
          height={height}
          fill={colors.wall}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* Pared inferior */}
        <Rect
          x={0}
          y={height - WALL_THICKNESS}
          width={width}
          height={WALL_THICKNESS}
          fill={colors.wall}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* Pared izquierda */}
        <Rect
          x={0}
          y={0}
          width={WALL_THICKNESS}
          height={height}
          fill={colors.wall}
          stroke="#000000"
          strokeWidth={2}
        />

        {/* PUERTA (abertura en pared inferior) */}
        <Group>
          {/* Abertura de puerta */}
          <Rect
            x={width / 2 - 40}
            y={height - WALL_THICKNESS}
            width={80}
            height={WALL_THICKNESS}
            fill={colors.fill}
          />
          {/* Marco de puerta */}
          <Rect
            x={width / 2 - 40}
            y={height - WALL_THICKNESS - 2}
            width={80}
            height={WALL_THICKNESS + 4}
            stroke="#000000"
            strokeWidth={2}
            fill="transparent"
          />
          {/* Hoja de puerta (línea curva) */}
          <Path
            data={`M ${width / 2 - 40} ${height - WALL_THICKNESS} Q ${width / 2 - 40} ${height - WALL_THICKNESS - 50} ${width / 2 + 10} ${height - WALL_THICKNESS - 50}`}
            stroke="#8b4513"
            strokeWidth={3}
            lineCap="round"
          />
          {/* Indicador de apertura */}
          <Line
            points={[width / 2 - 40, height - WALL_THICKNESS, width / 2 + 10, height - WALL_THICKNESS - 50]}
            stroke="#8b4513"
            strokeWidth={1}
            dash={[5, 5]}
            opacity={0.5}
          />
        </Group>

        {/* VENTANA (en pared superior) */}
        <Group>
          <Rect
            x={width - 100}
            y={0}
            width={60}
            height={WALL_THICKNESS}
            fill="white"
            stroke="#000000"
            strokeWidth={2}
          />
          {/* División de ventana */}
          <Line
            points={[width - 70, 0, width - 70, WALL_THICKNESS]}
            stroke="#000000"
            strokeWidth={1}
          />
        </Group>

        {/* Etiqueta principal (nombre de bodega) */}
        <Group>
          <Rect
            x={30}
            y={30}
            width={Math.min(width - 60, 200)}
            height={50}
            fill="white"
            stroke={colors.label}
            strokeWidth={3}
            cornerRadius={4}
            shadowColor="black"
            shadowBlur={5}
            shadowOpacity={0.2}
          />
          <Text
            x={35}
            y={40}
            width={Math.min(width - 70, 190)}
            text={warehouse.name}
            fontSize={16}
            fontStyle="bold"
            fontFamily="Arial"
            fill={colors.label}
            align="center"
            ellipsis={true}
          />
          <Text
            x={35}
            y={58}
            width={Math.min(width - 70, 190)}
            text={`BODEGA ${index + 1}`}
            fontSize={11}
            fontFamily="Arial"
            fill="#64748b"
            align="center"
          />
        </Group>

        {/* Contador de productos (estilo arquitectónico) */}
        <Group>
          <Circle
            x={width - 60}
            y={height - 60}
            radius={35}
            fill="white"
            stroke={status.color}
            strokeWidth={4}
            shadowColor="black"
            shadowBlur={6}
            shadowOpacity={0.3}
          />
          <Text
            x={width - 85}
            y={height - 75}
            width={50}
            text={`${warehouse.productsCount || 0}`}
            fontSize={24}
            fontStyle="bold"
            fontFamily="Arial"
            fill={status.color}
            align="center"
          />
          <Text
            x={width - 85}
            y={height - 48}
            width={50}
            text="items"
            fontSize={9}
            fontFamily="Arial"
            fill="#64748b"
            align="center"
          />
        </Group>

        {/* Indicador de ubicación */}
        {warehouse.location && (
          <Group>
            <Rect
              x={30}
              y={height - 50}
              width={Math.min(width - 120, 180)}
              height={25}
              fill="#1e293b"
              cornerRadius={3}
              opacity={0.85}
            />
            <Text
              x={35}
              y={height - 43}
              width={Math.min(width - 130, 170)}
              text={`📍 ${warehouse.location}`}
              fontSize={11}
              fontFamily="Arial"
              fill="white"
              ellipsis={true}
            />
          </Group>
        )}

        {/* Indicador de estado */}
        <Circle
          x={width / 2}
          y={35}
          radius={8}
          fill={status.color}
          stroke="white"
          strokeWidth={2}
        />

        {/* Medidas arquitectónicas (cotas) */}
        <Group opacity={0.4}>
          {/* Cota horizontal */}
          <Line
            points={[10, -15, width - 10, -15]}
            stroke="#000000"
            strokeWidth={1}
          />
          <Line points={[10, -20, 10, -10]} stroke="#000000" strokeWidth={1} />
          <Line points={[width - 10, -20, width - 10, -10]} stroke="#000000" strokeWidth={1} />
          <Text
            x={width / 2 - 30}
            y={-28}
            text={`${(width / 10).toFixed(1)}m`}
            fontSize={10}
            fontFamily="Arial"
            fill="#000000"
          />

          {/* Cota vertical */}
          <Line
            points={[-15, 10, -15, height - 10]}
            stroke="#000000"
            strokeWidth={1}
          />
          <Line points={[-20, 10, -10, 10]} stroke="#000000" strokeWidth={1} />
          <Line points={[-20, height - 10, -10, height - 10]} stroke="#000000" strokeWidth={1} />
          <Text
            x={-60}
            y={height / 2 - 5}
            text={`${(height / 10).toFixed(1)}m`}
            fontSize={10}
            fontFamily="Arial"
            fill="#000000"
            rotation={-90}
          />
        </Group>

        {/* Efecto hover */}
        {isHovered && (
          <Rect
            width={width}
            height={height}
            stroke="#3b82f6"
            strokeWidth={4}
            fill="transparent"
            dash={[10, 5]}
          />
        )}

        {/* Indicador de edición */}
        {editMode && (
          <Circle
            x={width / 2}
            y={height / 2}
            radius={20}
            fill="#f97316"
            opacity={0.7}
            stroke="white"
            strokeWidth={3}
          />
        )}
      </Group>
    );
  };

  return (
    <div className="relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white p-6 border-b-4 border-slate-400">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <MapPin className="w-8 h-8" />
              Plano Arquitectónico
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              {warehouses.length} bodega{warehouses.length !== 1 ? 's' : ''} • Plano de planta profesional
            </p>
          </div>

          <div className="flex gap-3">
            {canEdit && (
              editMode ? (
                <button
                  onClick={handleSavePositions}
                  className="flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  Guardar Plano
                </button>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg"
                >
                  <Edit3 className="w-5 h-5" />
                  Editar Plano
                </button>
              )
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="p-3 bg-slate-600 hover:bg-slate-500 rounded-xl"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="px-4 py-3 bg-slate-600 rounded-xl font-bold min-w-[70px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                className="p-3 bg-slate-600 hover:bg-slate-500 rounded-xl"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Buscador integrado */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar bodega por nombre o ubicación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/10 border-2 border-slate-500 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      {editMode && (
        <div className="bg-orange-500 text-white px-6 py-3 border-b-2 border-orange-600">
          <span className="text-sm font-semibold">
            ✏️ MODO EDICIÓN: Arrastra las habitaciones para reorganizar el plano arquitectónico
          </span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative overflow-auto flex items-center justify-center" style={{ height: '900px', background: '#f8f9fa' }}>
        {/* Título del plano */}
        <div className="absolute top-4 left-4 bg-white p-4 border-2 border-slate-800 rounded-lg shadow-lg z-10">
          <div className="text-xs font-bold text-slate-900 mb-1">PLANO DE PLANTA</div>
          <div className="text-xs text-slate-600">Escala 1:100</div>
          <div className="text-xs text-slate-600">Fecha: {new Date().toLocaleDateString()}</div>
        </div>

        <Stage
          ref={stageRef}
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          scaleX={zoom}
          scaleY={zoom}
          style={{ background: 'white', border: '2px solid #000', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
        >
          <Layer>
            {/* Fondo blanco */}
            <Rect
              x={0}
              y={0}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill="#ffffff"
            />

            {/* Grid arquitectónico MÁS DENSO - más líneas de división */}
            {Array.from({ length: 111 }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[i * 20, 0, i * 20, MAP_HEIGHT]}
                stroke="#e5e7eb"
                strokeWidth={i % 5 === 0 ? 1.5 : 0.5}
                opacity={i % 5 === 0 ? 0.5 : 0.25}
              />
            ))}
            {Array.from({ length: 61 }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[0, i * 20, MAP_WIDTH, i * 20]}
                stroke="#e5e7eb"
                strokeWidth={i % 5 === 0 ? 1.5 : 0.5}
                opacity={i % 5 === 0 ? 0.5 : 0.25}
              />
            ))}

            {/* Título en el plano */}
            <Text
              x={MAP_WIDTH / 2 - 150}
              y={30}
              text="PLANO DE DISTRIBUCIÓN DE BODEGAS"
              fontSize={24}
              fontStyle="bold"
              fontFamily="Arial"
              fill="#1e293b"
            />

            {/* Indicador de norte */}
            <Group x={MAP_WIDTH - 100} y={50}>
              <Circle radius={30} stroke="#000000" strokeWidth={2} fill="white" />
              <Text x={-8} y={-35} text="N" fontSize={20} fontStyle="bold" fill="#000000" />
              <Path
                data="M 0 -20 L -8 5 L 0 0 L 8 5 Z"
                fill="#000000"
              />
            </Group>

            {/* BODEGAS/HABITACIONES */}
            {organizedWarehouses.map((warehouse) => (
              <ArchitecturalRoom key={warehouse.id} warehouse={warehouse} />
            ))}

            {/* Leyenda */}
            <Group x={50} y={MAP_HEIGHT - 150}>
              <Rect width={300} height={120} fill="white" stroke="#000000" strokeWidth={2} />
              <Text x={10} y={10} text="LEYENDA" fontSize={14} fontStyle="bold" fontFamily="Arial" />

              <Line points={[10, 30, 30, 30]} stroke="#2c3e50" strokeWidth={8} />
              <Text x={40} y={25} text="Pared estructural" fontSize={11} fontFamily="Arial" />

              <Rect x={10} y={45} width={20} height={15} stroke="#000000" strokeWidth={2} fill="white" />
              <Text x={40} y={47} text="Puerta" fontSize={11} fontFamily="Arial" />

              <Rect x={10} y={70} width={20} height={8} stroke="#000000" strokeWidth={2} fill="white" />
              <Text x={40} y={69} text="Ventana" fontSize={11} fontFamily="Arial" />

              <Circle x={20} y={100} radius={8} fill="#10b981" stroke="white" strokeWidth={2} />
              <Text x={40} y={95} text="Stock disponible" fontSize={11} fontFamily="Arial" />
            </Group>
          </Layer>
        </Stage>

        {/* Tooltip */}
        {hoveredWarehouse && !editMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-slate-700 min-w-[320px]"
          >
            <div className="font-bold text-lg mb-3 text-blue-400">{hoveredWarehouse.name}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Productos:</span>
                <span className="font-bold text-blue-400">{hoveredWarehouse.productsCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Estado:</span>
                <span style={{ color: hoveredWarehouse.status.color }}>{hoveredWarehouse.status.text}</span>
              </div>
              {hoveredWarehouse.location && (
                <div className="flex justify-between">
                  <span>Ubicación:</span>
                  <span>{hoveredWarehouse.location}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Lista de bodegas */}
      <div className="bg-slate-50 border-t-2 border-slate-300 p-6">
        <div className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-lg">
          <Package className="w-5 h-5" />
          Índice de Bodegas:
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {organizedWarehouses.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border-2 border-slate-300 hover:border-blue-500 cursor-pointer transition-all"
              onClick={() => onWarehouseClick(w)}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: w.colors.label }}>
                {w.index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{w.name}</div>
                <div className="text-xs text-slate-600">{w.productsCount || 0} productos</div>
              </div>
              <Circle radius={6} fill={w.status.color} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
