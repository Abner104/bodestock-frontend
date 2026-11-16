import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Circle, Text, Line, Group, Arrow, RegularPolygon } from 'react-konva';
import { motion } from 'framer-motion';
import { Maximize2, Minimize2, MapPin, Edit3, Save, Package, Navigation } from 'lucide-react';

/**
 * Mapa isométrico de bodegas usando Konva.js
 * Librería profesional para canvas 2D con mejor rendimiento y organización
 */
export default function WarehouseMapKonva({ warehouses = [], onWarehouseClick, onSaveLayout, canEdit = true }) {
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);
  const [warehousePositions, setWarehousePositions] = useState({});
  const stageRef = useRef(null);

  const MAP_WIDTH = 1400;
  const MAP_HEIGHT = 900;
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

  // Posiciones por defecto organizadas con pasillos
  const getDefaultPosition = (index, total) => {
    const layouts = [
      [{ x: 600, y: 350, width: 200, height: 200 }],
      [
        { x: 300, y: 350, width: 180, height: 180 },
        { x: 920, y: 350, width: 180, height: 180 }
      ],
      [
        { x: 200, y: 200, width: 160, height: 160 },
        { x: 620, y: 200, width: 160, height: 160 },
        { x: 410, y: 540, width: 180, height: 160 }
      ],
      [
        { x: 200, y: 180, width: 150, height: 150 },
        { x: 1050, y: 180, width: 150, height: 150 },
        { x: 200, y: 570, width: 150, height: 150 },
        { x: 1050, y: 570, width: 150, height: 150 }
      ],
      [
        { x: 120, y: 150, width: 140, height: 140 },
        { x: 520, y: 150, width: 140, height: 140 },
        { x: 1140, y: 150, width: 140, height: 140 },
        { x: 120, y: 610, width: 140, height: 140 },
        { x: 520, y: 610, width: 140, height: 140 },
        { x: 1140, y: 610, width: 140, height: 140 }
      ]
    ];

    const layoutIndex = Math.min(total - 1, 4);
    return layouts[layoutIndex]?.[index] || {
      x: 200 + (index % 3) * 400,
      y: 200 + Math.floor(index / 3) * 400,
      width: 150,
      height: 150
    };
  };

  // Colores
  const warehouseColors = [
    { main: '#3b82f6', dark: '#1e40af', light: '#93c5fd' },
    { main: '#10b981', dark: '#047857', light: '#6ee7b7' },
    { main: '#f59e0b', dark: '#d97706', light: '#fbbf24' },
    { main: '#8b5cf6', dark: '#7c3aed', light: '#c4b5fd' },
    { main: '#ef4444', dark: '#dc2626', light: '#fca5a5' },
    { main: '#06b6d4', dark: '#0891b2', light: '#67e8f9' }
  ];

  // Calcular estado
  const getWarehouseStatus = (warehouse) => {
    const count = warehouse.productsCount || 0;
    if (count === 0) return { type: 'empty', color: '#94a3b8', icon: '⚪' };
    if (count < 5) return { type: 'critical', color: '#ef4444', icon: '🔴' };
    if (count < 15) return { type: 'warning', color: '#f59e0b', icon: '🟡' };
    return { type: 'healthy', color: '#10b981', icon: '🟢' };
  };

  const organizedWarehouses = warehouses.slice(0, 6).map((warehouse, index) => ({
    ...warehouse,
    position: warehousePositions[warehouse.id] || getDefaultPosition(index, warehouses.length),
    colors: warehouseColors[index % warehouseColors.length],
    status: getWarehouseStatus(warehouse),
    index
  }));

  // Drag handlers
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

  // Componente de camino/pasillo
  const PathLine = ({ points, color = '#fbbf24', width = 30 }) => (
    <>
      {/* Sombra del camino */}
      <Line
        points={points}
        stroke="#1e293b"
        strokeWidth={width + 4}
        opacity={0.3}
        lineCap="round"
        lineJoin="round"
      />
      {/* Camino base */}
      <Line
        points={points}
        stroke={color}
        strokeWidth={width}
        opacity={0.4}
        lineCap="round"
        lineJoin="round"
      />
      {/* Línea central */}
      <Line
        points={points}
        stroke="#ffffff"
        strokeWidth={3}
        opacity={0.6}
        dash={[15, 15]}
        lineCap="round"
      />
    </>
  );

  // Componente de señal/flecha
  const SignalArrow = ({ x, y, rotation = 0, label = '' }) => (
    <Group x={x} y={y} rotation={rotation}>
      {/* Poste */}
      <Line
        points={[0, 0, 0, 30]}
        stroke="#64748b"
        strokeWidth={4}
        lineCap="round"
      />
      {/* Señal */}
      <Rect
        x={-30}
        y={-20}
        width={60}
        height={20}
        fill="#fbbf24"
        stroke="#78350f"
        strokeWidth={2}
        cornerRadius={4}
      />
      {/* Flecha */}
      <Arrow
        points={[-10, -10, 10, -10]}
        fill="#78350f"
        pointerLength={8}
        pointerWidth={8}
      />
      {/* Label */}
      {label && (
        <Text
          x={-30}
          y={35}
          width={60}
          text={label}
          fontSize={9}
          fontStyle="bold"
          fill="#fbbf24"
          align="center"
        />
      )}
    </Group>
  );

  // Componente de área especial
  const SpecialArea = ({ x, y, width, height, label, icon, color = '#10b981' }) => (
    <Group x={x} y={y}>
      {/* Fondo del área */}
      <Rect
        width={width}
        height={height}
        fill={color}
        opacity={0.15}
        stroke={color}
        strokeWidth={3}
        dash={[10, 5]}
        cornerRadius={8}
      />
      {/* Label con fondo */}
      <Rect
        x={width / 2 - 60}
        y={height / 2 - 15}
        width={120}
        height={30}
        fill="white"
        stroke={color}
        strokeWidth={2}
        cornerRadius={6}
        opacity={0.95}
      />
      <Text
        x={width / 2 - 60}
        y={height / 2 - 5}
        width={120}
        text={`${icon} ${label}`}
        fontSize={12}
        fontStyle="bold"
        fill={color}
        align="center"
      />
    </Group>
  );

  // Componente de bodega
  const WarehouseBuilding = ({ warehouse }) => {
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
        {/* Sombra */}
        <Rect
          x={8}
          y={8}
          width={width}
          height={height}
          fill="black"
          opacity={0.3}
          cornerRadius={8}
          blur={12}
        />

        {/* Edificio principal */}
        <Rect
          width={width}
          height={height}
          fill={isHovered ? colors.light : colors.main}
          stroke={isHovered ? '#fbbf24' : colors.dark}
          strokeWidth={isHovered ? 4 : 3}
          cornerRadius={8}
          shadowColor="black"
          shadowBlur={isHovered ? 15 : 10}
          shadowOpacity={0.3}
        />

        {/* Techo/detalles */}
        <Rect
          x={8}
          y={8}
          width={width - 16}
          height={height - 16}
          stroke={colors.dark}
          strokeWidth={2}
          opacity={0.3}
          cornerRadius={6}
        />

        {/* Divisiones internas (cuadrícula) */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Line
            key={`h-${i}`}
            points={[15, 15 + i * (height - 30) / 3, width - 15, 15 + i * (height - 30) / 3]}
            stroke={colors.dark}
            strokeWidth={1}
            opacity={0.2}
            dash={[5, 5]}
          />
        ))}
        {Array.from({ length: 3 }).map((_, i) => (
          <Line
            key={`v-${i}`}
            points={[15 + i * (width - 30) / 3, 15, 15 + i * (width - 30) / 3, height - 15]}
            stroke={colors.dark}
            strokeWidth={1}
            opacity={0.2}
            dash={[5, 5]}
          />
        ))}

        {/* Número de bodega */}
        <Circle
          x={width / 2}
          y={height / 2 - 30}
          radius={isHovered ? 20 : 16}
          fill="white"
          stroke={colors.main}
          strokeWidth={3}
        />
        <Text
          x={width / 2 - 15}
          y={height / 2 - 38}
          width={30}
          text={`${index + 1}`}
          fontSize={isHovered ? 20 : 16}
          fontStyle="bold"
          fill={colors.dark}
          align="center"
        />

        {/* Nombre */}
        <Rect
          x={width / 2 - 60}
          y={height / 2 - 12}
          width={120}
          height={24}
          fill="white"
          stroke={colors.main}
          strokeWidth={2}
          cornerRadius={4}
          opacity={0.95}
        />
        <Text
          x={width / 2 - 58}
          y={height / 2 - 5}
          width={116}
          text={warehouse.name}
          fontSize={11}
          fontStyle="bold"
          fill="#1e293b"
          align="center"
          ellipsis={true}
        />

        {/* Contador de productos */}
        <Rect
          x={width / 2 - 40}
          y={height / 2 + 18}
          width={80}
          height={36}
          fill={colors.main}
          stroke="white"
          strokeWidth={2}
          cornerRadius={6}
        />
        <Text
          x={width / 2 - 40}
          y={height / 2 + 24}
          width={80}
          text={`${warehouse.productsCount || 0}`}
          fontSize={20}
          fontStyle="bold"
          fill="white"
          align="center"
        />

        {/* Indicador de estado */}
        <Circle
          x={width - 15}
          y={15}
          radius={8}
          fill={status.color}
          stroke="white"
          strokeWidth={2}
        />

        {/* Indicador de edición */}
        {editMode && (
          <RegularPolygon
            x={width / 2}
            y={height - 15}
            sides={4}
            radius={10}
            fill="#f97316"
            stroke="white"
            strokeWidth={2}
            rotation={45}
          />
        )}

        {/* Efecto hover */}
        {isHovered && (
          <Rect
            width={width}
            height={height}
            stroke="#fbbf24"
            strokeWidth={3}
            cornerRadius={8}
            opacity={0.6}
          />
        )}
      </Group>
    );
  };

  return (
    <div className="relative w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 flex justify-between items-center border-b border-slate-700">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <MapPin className="w-8 h-8" />
            Plano Interactivo del Local
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {warehouses.length} bodega{warehouses.length !== 1 ? 's' : ''} • Mapa con Konva.js
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

      {/* Canvas con Konva */}
      <div
        className="relative overflow-auto"
        style={{
          height: '850px',
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)'
        }}
      >
        <Stage
          ref={stageRef}
          width={MAP_WIDTH * zoom}
          height={MAP_HEIGHT * zoom}
          scaleX={zoom}
          scaleY={zoom}
          style={{ margin: '0 auto', display: 'block' }}
        >
          <Layer>
            {/* Fondo con patrón de piso */}
            <Rect
              x={0}
              y={0}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill="#334155"
            />

            {/* Grid de fondo */}
            {Array.from({ length: 30 }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[i * 50, 0, i * 50, MAP_HEIGHT]}
                stroke="#475569"
                strokeWidth={0.5}
                opacity={0.2}
              />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[0, i * 50, MAP_WIDTH, i * 50]}
                stroke="#475569"
                strokeWidth={0.5}
                opacity={0.2}
              />
            ))}

            {/* Perímetro del edificio */}
            <Rect
              x={50}
              y={50}
              width={MAP_WIDTH - 100}
              height={MAP_HEIGHT - 100}
              stroke="#94a3b8"
              strokeWidth={4}
              dash={[20, 10]}
              opacity={0.4}
              cornerRadius={12}
            />

            {/* CAMINOS PRINCIPALES */}
            {/* Pasillo horizontal central */}
            <PathLine
              points={[80, MAP_HEIGHT / 2, MAP_WIDTH - 80, MAP_HEIGHT / 2]}
              width={40}
            />

            {/* Pasillo vertical central */}
            <PathLine
              points={[MAP_WIDTH / 2, 80, MAP_WIDTH / 2, MAP_HEIGHT - 80]}
              width={40}
            />

            {/* ÁREAS ESPECIALES */}
            <SpecialArea
              x={MAP_WIDTH / 2 - 70}
              y={60}
              width={140}
              height={60}
              label="ENTRADA"
              icon="🚪"
              color="#3b82f6"
            />

            <SpecialArea
              x={80}
              y={MAP_HEIGHT - 140}
              width={180}
              height={70}
              label="ZONA CARGA"
              icon="🚛"
              color="#f59e0b"
            />

            <SpecialArea
              x={MAP_WIDTH - 260}
              y={MAP_HEIGHT - 140}
              width={180}
              height={70}
              label="OFICINA"
              icon="🏢"
              color="#8b5cf6"
            />

            {/* SEÑALIZACIÓN */}
            <SignalArrow x={350} y={MAP_HEIGHT / 2 - 60} rotation={-90} label="A1-A3" />
            <SignalArrow x={1050} y={MAP_HEIGHT / 2 - 60} rotation={-90} label="B1-B3" />
            <SignalArrow x={MAP_WIDTH / 2 + 60} y={250} rotation={0} label="C1-C2" />
            <SignalArrow x={MAP_WIDTH / 2 + 60} y={MAP_HEIGHT - 180} rotation={180} label="SALIDA" />

            {/* BODEGAS */}
            {organizedWarehouses.map((warehouse) => (
              <WarehouseBuilding key={warehouse.id} warehouse={warehouse} />
            ))}
          </Layer>
        </Stage>

        {/* Tooltip hover */}
        {hoveredWarehouse && !editMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-6 py-4 rounded-xl shadow-2xl border border-slate-700 min-w-[300px]"
          >
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
                <span>{hoveredWarehouse.status.icon}</span>
              </div>
            </div>
          </motion.div>
        )}
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
              {organizedWarehouses.map((warehouse) => (
                <div
                  key={warehouse.id}
                  className="flex items-center gap-3 px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer"
                  onClick={() => onWarehouseClick(warehouse)}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: warehouse.colors.main }}
                  >
                    {warehouse.index + 1}
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
              Infraestructura:
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-6 h-2 bg-yellow-500 rounded opacity-60"/>
                <span>Caminos principales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded opacity-30 border-2 border-blue-500"/>
                <span>Áreas especiales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-2 border-2 border-dashed border-slate-400 rounded"/>
                <span>Perímetro edificio</span>
              </div>
            </div>
          </div>

          {/* Estados */}
          <div>
            <div className="font-bold text-white mb-3">📊 Estados:</div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟢</span>
                <span>Saludable (15+ productos)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🟡</span>
                <span>Alerta (5-14 productos)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🔴</span>
                <span>Crítico (&lt;5 productos)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⚪</span>
                <span>Vacío (sin productos)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
