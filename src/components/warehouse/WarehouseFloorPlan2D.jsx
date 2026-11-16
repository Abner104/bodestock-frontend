import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Circle, Text, Line, Group, Arrow, Path } from 'react-konva';
import { motion } from 'framer-motion';
import { Maximize2, Minimize2, MapPin, Edit3, Save, Package, Navigation, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Plano 2D estilo arquitectónico (vista desde arriba)
 * Como un plano real de edificio con bodegas, pasillos y señalización
 */
export default function WarehouseFloorPlan2D({ warehouses = [], onWarehouseClick, onSaveLayout, canEdit = true }) {
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);
  const [warehousePositions, setWarehousePositions] = useState({});
  const stageRef = useRef(null);

  const MAP_WIDTH = 1600;
  const MAP_HEIGHT = 1000;

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

  // Posiciones por defecto - layout con pasillo central
  const getDefaultPosition = (index, total) => {
    // Diseño con pasillo central vertical
    const layouts = [
      // 1 bodega
      [{ x: 600, y: 300, width: 400, height: 400 }],

      // 2 bodegas - izquierda y derecha del pasillo
      [
        { x: 150, y: 250, width: 500, height: 500 },
        { x: 950, y: 250, width: 500, height: 500 }
      ],

      // 3 bodegas - 2 arriba, 1 abajo
      [
        { x: 150, y: 150, width: 450, height: 350 },
        { x: 1000, y: 150, width: 450, height: 350 },
        { x: 550, y: 600, width: 500, height: 300 }
      ],

      // 4 bodegas - cuadrante
      [
        { x: 150, y: 150, width: 450, height: 350 },
        { x: 1000, y: 150, width: 450, height: 350 },
        { x: 150, y: 600, width: 450, height: 300 },
        { x: 1000, y: 600, width: 450, height: 300 }
      ],

      // 5-6 bodegas - grid 3x2
      [
        { x: 100, y: 120, width: 380, height: 320 },
        { x: 610, y: 120, width: 380, height: 320 },
        { x: 1120, y: 120, width: 380, height: 320 },
        { x: 100, y: 560, width: 380, height: 320 },
        { x: 610, y: 560, width: 380, height: 320 },
        { x: 1120, y: 560, width: 380, height: 320 }
      ]
    ];

    const layoutIndex = Math.min(total - 1, 4);
    return layouts[layoutIndex]?.[index] || {
      x: 150 + (index % 3) * 500,
      y: 150 + Math.floor(index / 3) * 450,
      width: 400,
      height: 350
    };
  };

  // Colores profesionales
  const warehouseColors = [
    { main: '#3b82f6', dark: '#1e40af', light: '#dbeafe', stroke: '#2563eb' },
    { main: '#10b981', dark: '#047857', light: '#d1fae5', stroke: '#059669' },
    { main: '#f59e0b', dark: '#d97706', light: '#fef3c7', stroke: '#f59e0b' },
    { main: '#8b5cf6', dark: '#7c3aed', light: '#ede9fe', stroke: '#7c3aed' },
    { main: '#ef4444', dark: '#dc2626', light: '#fee2e2', stroke: '#dc2626' },
    { main: '#06b6d4', dark: '#0891b2', light: '#cffafe', stroke: '#0891b2' }
  ];

  // Calcular estado
  const getWarehouseStatus = (warehouse) => {
    const count = warehouse.productsCount || 0;
    if (count === 0) return { type: 'empty', color: '#94a3b8', icon: '⚪', text: 'Vacío' };
    if (count < 5) return { type: 'critical', color: '#ef4444', icon: '🔴', text: 'Crítico' };
    if (count < 15) return { type: 'warning', color: '#f59e0b', icon: '🟡', text: 'Alerta' };
    return { type: 'healthy', color: '#10b981', icon: '🟢', text: 'OK' };
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

  // Componente de pasillo/camino
  const Hallway = ({ points, width = 80, label = '' }) => (
    <Group>
      {/* Piso del pasillo */}
      <Line
        points={points}
        stroke="#e2e8f0"
        strokeWidth={width}
        lineCap="square"
        lineJoin="miter"
      />
      {/* Bordes del pasillo */}
      <Line
        points={points}
        stroke="#94a3b8"
        strokeWidth={width + 4}
        lineCap="square"
        lineJoin="miter"
        opacity={0.4}
      />
      {/* Línea central amarilla */}
      <Line
        points={points}
        stroke="#fbbf24"
        strokeWidth={4}
        dash={[20, 15]}
        lineCap="round"
        opacity={0.8}
      />
      {/* Label del pasillo */}
      {label && (
        <Text
          x={(points[0] + points[2]) / 2 - 40}
          y={(points[1] + points[3]) / 2 - 10}
          text={label}
          fontSize={14}
          fontStyle="bold"
          fill="#64748b"
          align="center"
        />
      )}
    </Group>
  );

  // Componente de señal direccional
  const DirectionalSign = ({ x, y, text, rotation = 0 }) => (
    <Group x={x} y={y} rotation={rotation}>
      {/* Poste */}
      <Rect
        x={-3}
        y={0}
        width={6}
        height={40}
        fill="#64748b"
        cornerRadius={3}
      />
      {/* Señal */}
      <Rect
        x={-50}
        y={-25}
        width={100}
        height={30}
        fill="#fbbf24"
        stroke="#78350f"
        strokeWidth={2}
        cornerRadius={4}
        shadowColor="black"
        shadowBlur={5}
        shadowOpacity={0.3}
      />
      {/* Texto */}
      <Text
        x={-45}
        y={-15}
        width={90}
        text={text}
        fontSize={11}
        fontStyle="bold"
        fill="#78350f"
        align="center"
      />
      {/* Flecha */}
      <Arrow
        points={[35, -10, 55, -10]}
        fill="#78350f"
        stroke="#78350f"
        strokeWidth={2}
        pointerLength={8}
        pointerWidth={8}
      />
    </Group>
  );

  // Componente de área especial
  const SpecialZone = ({ x, y, width, height, label, icon, color }) => (
    <Group x={x} y={y}>
      {/* Fondo del área */}
      <Rect
        width={width}
        height={height}
        fill={color}
        opacity={0.15}
        cornerRadius={8}
      />
      {/* Borde */}
      <Rect
        width={width}
        height={height}
        stroke={color}
        strokeWidth={4}
        dash={[15, 10]}
        cornerRadius={8}
      />
      {/* Etiqueta */}
      <Rect
        x={width / 2 - 80}
        y={height / 2 - 20}
        width={160}
        height={40}
        fill="white"
        stroke={color}
        strokeWidth={3}
        cornerRadius={8}
        shadowColor="black"
        shadowBlur={8}
        shadowOpacity={0.2}
      />
      <Text
        x={width / 2 - 75}
        y={height / 2 - 8}
        width={150}
        text={`${icon} ${label}`}
        fontSize={16}
        fontStyle="bold"
        fill={color}
        align="center"
      />
    </Group>
  );

  // Componente de bodega (habitación)
  const WarehouseRoom = ({ warehouse }) => {
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
          x={6}
          y={6}
          width={width}
          height={height}
          fill="black"
          opacity={0.15}
          cornerRadius={4}
          blur={10}
        />

        {/* Piso de la bodega */}
        <Rect
          width={width}
          height={height}
          fill={colors.light}
          cornerRadius={4}
        />

        {/* Borde/paredes */}
        <Rect
          width={width}
          height={height}
          stroke={isHovered ? '#fbbf24' : colors.stroke}
          strokeWidth={isHovered ? 6 : 4}
          cornerRadius={4}
          shadowColor={colors.dark}
          shadowBlur={isHovered ? 12 : 6}
          shadowOpacity={0.3}
        />

        {/* Patrón de piso (líneas diagonales) */}
        {Array.from({ length: Math.floor(width / 30) }).map((_, i) => (
          <Line
            key={`diag-${i}`}
            points={[i * 30, 0, i * 30, height]}
            stroke={colors.main}
            strokeWidth={1}
            opacity={0.1}
          />
        ))}

        {/* Indicador de puerta */}
        <Rect
          x={width / 2 - 25}
          y={height - 8}
          width={50}
          height={8}
          fill={colors.dark}
          cornerRadius={2}
        />

        {/* Número de bodega */}
        <Circle
          x={30}
          y={30}
          radius={isHovered ? 24 : 20}
          fill="white"
          stroke={colors.main}
          strokeWidth={3}
          shadowColor="black"
          shadowBlur={5}
          shadowOpacity={0.2}
        />
        <Text
          x={15}
          y={20}
          width={30}
          text={`${index + 1}`}
          fontSize={isHovered ? 20 : 16}
          fontStyle="bold"
          fill={colors.dark}
          align="center"
        />

        {/* Nombre de la bodega */}
        <Rect
          x={width / 2 - 100}
          y={height / 2 - 40}
          width={200}
          height={35}
          fill="white"
          stroke={colors.main}
          strokeWidth={2}
          cornerRadius={6}
          opacity={0.95}
        />
        <Text
          x={width / 2 - 95}
          y={height / 2 - 28}
          width={190}
          text={warehouse.name}
          fontSize={14}
          fontStyle="bold"
          fill="#1e293b"
          align="center"
          ellipsis={true}
        />

        {/* Contador de productos */}
        <Rect
          x={width / 2 - 60}
          y={height / 2 + 5}
          width={120}
          height={45}
          fill={colors.main}
          stroke="white"
          strokeWidth={3}
          cornerRadius={8}
          shadowColor="black"
          shadowBlur={6}
          shadowOpacity={0.3}
        />
        <Text
          x={width / 2 - 60}
          y={height / 2 + 13}
          width={120}
          text={`${warehouse.productsCount || 0}`}
          fontSize={24}
          fontStyle="bold"
          fill="white"
          align="center"
        />
        <Text
          x={width / 2 - 60}
          y={height / 2 + 33}
          width={120}
          text="productos"
          fontSize={9}
          fill="white"
          align="center"
          opacity={0.9}
        />

        {/* Indicador de estado */}
        <Circle
          x={width - 20}
          y={20}
          radius={12}
          fill={status.color}
          stroke="white"
          strokeWidth={3}
          shadowColor="black"
          shadowBlur={4}
          shadowOpacity={0.4}
        />

        {/* Badge de ubicación */}
        {warehouse.location && (
          <Group>
            <Rect
              x={10}
              y={height - 35}
              width={Math.min(width - 20, 120)}
              height={25}
              fill={colors.dark}
              cornerRadius={4}
              opacity={0.9}
            />
            <Text
              x={15}
              y={height - 27}
              width={Math.min(width - 30, 110)}
              text={`📍 ${warehouse.location}`}
              fontSize={10}
              fill="white"
              ellipsis={true}
            />
          </Group>
        )}

        {/* Indicador de modo edición */}
        {editMode && (
          <Circle
            x={width / 2}
            y={height / 2}
            radius={15}
            fill="#f97316"
            stroke="white"
            strokeWidth={3}
            opacity={0.8}
          />
        )}

        {/* Efecto hover */}
        {isHovered && (
          <Rect
            width={width}
            height={height}
            fill={colors.main}
            opacity={0.1}
            cornerRadius={4}
          />
        )}
      </Group>
    );
  };

  return (
    <div className="relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white p-6 flex justify-between items-center border-b-4 border-blue-500">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <MapPin className="w-8 h-8" />
            Plano del Local
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {warehouses.length} bodega{warehouses.length !== 1 ? 's' : ''} • Vista arquitectónica 2D
          </p>
        </div>

        <div className="flex gap-3">
          {canEdit && (
            editMode ? (
              <button
                onClick={handleSavePositions}
                className="flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                <Save className="w-5 h-5" />
                Guardar Layout
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                <Edit3 className="w-5 h-5" />
                Editar Posiciones
              </button>
            )
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="p-3 bg-slate-600 hover:bg-slate-500 rounded-xl transition-all"
              title="Alejar"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="px-4 py-3 bg-slate-600 rounded-xl font-bold min-w-[70px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
              className="p-3 bg-slate-600 hover:bg-slate-500 rounded-xl transition-all"
              title="Acercar"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {editMode && (
        <div className="bg-orange-500 text-white px-6 py-3 flex items-center gap-2 border-b-2 border-orange-600">
          <span className="text-sm font-semibold">
            ✏️ MODO EDICIÓN ACTIVO: Arrastra las bodegas para reorganizar el plano
          </span>
        </div>
      )}

      {/* Canvas */}
      <div
        className="relative overflow-auto bg-gradient-to-br from-slate-50 to-slate-100"
        style={{ height: '850px' }}
      >
        <Stage
          ref={stageRef}
          width={MAP_WIDTH * zoom}
          height={MAP_HEIGHT * zoom}
          scaleX={zoom}
          scaleY={zoom}
          style={{ margin: '20px auto', display: 'block', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
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

            {/* Grid arquitectónico */}
            {Array.from({ length: 40 }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[i * 40, 0, i * 40, MAP_HEIGHT]}
                stroke="#e2e8f0"
                strokeWidth={i % 5 === 0 ? 1.5 : 0.5}
                opacity={i % 5 === 0 ? 0.4 : 0.2}
              />
            ))}
            {Array.from({ length: 25 }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[0, i * 40, MAP_WIDTH, i * 40]}
                stroke="#e2e8f0"
                strokeWidth={i % 5 === 0 ? 1.5 : 0.5}
                opacity={i % 5 === 0 ? 0.4 : 0.2}
              />
            ))}

            {/* Perímetro del edificio */}
            <Rect
              x={50}
              y={50}
              width={MAP_WIDTH - 100}
              height={MAP_HEIGHT - 100}
              stroke="#1e293b"
              strokeWidth={6}
              dash={[25, 15]}
              opacity={0.5}
              cornerRadius={8}
            />

            {/* PASILLOS PRINCIPALES */}
            {/* Pasillo horizontal superior */}
            <Hallway points={[70, 100, MAP_WIDTH - 70, 100]} width={60} label="PASILLO NORTE" />

            {/* Pasillo vertical central */}
            <Hallway points={[MAP_WIDTH / 2, 70, MAP_WIDTH / 2, MAP_HEIGHT - 70]} width={80} label="PASILLO CENTRAL" />

            {/* Pasillo horizontal inferior */}
            <Hallway points={[70, MAP_HEIGHT - 100, MAP_WIDTH - 70, MAP_HEIGHT - 100]} width={60} label="PASILLO SUR" />

            {/* ÁREAS ESPECIALES */}
            <SpecialZone
              x={MAP_WIDTH / 2 - 100}
              y={20}
              width={200}
              height={50}
              label="ENTRADA"
              icon="🚪"
              color="#3b82f6"
            />

            <SpecialZone
              x={70}
              y={MAP_HEIGHT - 150}
              width={220}
              height={80}
              label="ZONA DE CARGA"
              icon="🚛"
              color="#f59e0b"
            />

            <SpecialZone
              x={MAP_WIDTH - 290}
              y={MAP_HEIGHT - 150}
              width={220}
              height={80}
              label="OFICINAS"
              icon="🏢"
              color="#8b5cf6"
            />

            {/* SEÑALIZACIÓN */}
            <DirectionalSign x={300} y={100} text="ZONA A" rotation={0} />
            <DirectionalSign x={1100} y={100} text="ZONA B" rotation={0} />
            <DirectionalSign x={MAP_WIDTH / 2} y={500} text="SALIDA ⬇" rotation={90} />

            {/* BODEGAS */}
            {organizedWarehouses.map((warehouse) => (
              <WarehouseRoom key={warehouse.id} warehouse={warehouse} />
            ))}
          </Layer>
        </Stage>

        {/* Tooltip hover */}
        {hoveredWarehouse && !editMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-slate-700 min-w-[320px]"
          >
            <div className="font-bold text-lg mb-3 text-blue-400">{hoveredWarehouse.name}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Ubicación:</span>
                <span className="font-semibold text-white">{hoveredWarehouse.location || 'No especificada'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Productos:</span>
                <span className="font-bold text-blue-400 text-lg">{hoveredWarehouse.productsCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Estado:</span>
                <span className="flex items-center gap-2">
                  <span>{hoveredWarehouse.status.icon}</span>
                  <span className="font-semibold" style={{ color: hoveredWarehouse.status.color }}>
                    {hoveredWarehouse.status.text}
                  </span>
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-400 text-center">
              👆 Haz clic para gestionar inventario
            </div>
          </motion.div>
        )}
      </div>

      {/* Leyenda */}
      <div className="bg-slate-100 border-t-2 border-slate-300 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bodegas */}
          <div>
            <div className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-blue-600" />
              Bodegas del Local:
            </div>
            <div className="space-y-2">
              {organizedWarehouses.map((warehouse) => (
                <div
                  key={warehouse.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg hover:bg-blue-50 transition-colors cursor-pointer border border-slate-200 hover:border-blue-300"
                  onClick={() => onWarehouseClick(warehouse)}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                    style={{ background: warehouse.colors.main }}
                  >
                    {warehouse.index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{warehouse.name}</div>
                    <div className="text-xs text-slate-600">{warehouse.productsCount || 0} productos</div>
                  </div>
                  <span className="text-lg">{warehouse.status.icon}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Infraestructura */}
          <div>
            <div className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-lg">
              <Navigation className="w-5 h-5 text-blue-600" />
              Infraestructura:
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div className="w-8 h-3 bg-gradient-to-r from-slate-300 to-slate-200 rounded border-2 border-slate-400"/>
                <span className="font-medium">Pasillos principales</span>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div className="w-8 h-8 bg-blue-100 rounded border-2 border-dashed border-blue-400"/>
                <span className="font-medium">Áreas especiales</span>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div className="w-8 h-3 border-2 border-dashed border-slate-700 rounded"/>
                <span className="font-medium">Límite del edificio</span>
              </div>
            </div>
          </div>

          {/* Estados */}
          <div>
            <div className="font-bold text-slate-900 mb-3 text-lg">📊 Estado del Stock:</div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="text-2xl">🟢</span>
                <div>
                  <div className="font-bold text-green-800">Saludable</div>
                  <div className="text-xs text-green-600">15+ productos</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <span className="text-2xl">🟡</span>
                <div>
                  <div className="font-bold text-yellow-800">Alerta</div>
                  <div className="text-xs text-yellow-600">5-14 productos</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-200">
                <span className="text-2xl">🔴</span>
                <div>
                  <div className="font-bold text-red-800">Crítico</div>
                  <div className="text-xs text-red-600">&lt;5 productos</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-2xl">⚪</span>
                <div>
                  <div className="font-bold text-slate-800">Vacío</div>
                  <div className="text-xs text-slate-600">Sin productos</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
