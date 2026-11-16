import { motion } from 'framer-motion';
import { Maximize2, Minimize2, MapPin } from 'lucide-react';
import { useState } from 'react';

/**
 * Plano completo del edificio/local con todas las bodegas como "habitaciones"
 */
export default function BuildingFloorPlan({ warehouses = [], onWarehouseClick }) {
  const [zoom, setZoom] = useState(1);
  const [hoveredWarehouse, setHoveredWarehouse] = useState(null);

  // Dimensiones del plano completo
  const BUILDING_WIDTH = 800;
  const BUILDING_HEIGHT = 600;

  // Organizar bodegas en el plano
  const organizeWarehouses = () => {
    const layouts = [
      // Layout para 1-2 bodegas
      [
        { x: 100, y: 100, width: 600, height: 400 }
      ],
      // Layout para 2 bodegas
      [
        { x: 50, y: 100, width: 350, height: 400 },
        { x: 420, y: 100, width: 330, height: 400 }
      ],
      // Layout para 3 bodegas
      [
        { x: 50, y: 80, width: 340, height: 200 },
        { x: 410, y: 80, width: 340, height: 200 },
        { x: 50, y: 300, width: 700, height: 220 }
      ],
      // Layout para 4 bodegas
      [
        { x: 50, y: 80, width: 340, height: 220 },
        { x: 410, y: 80, width: 340, height: 220 },
        { x: 50, y: 320, width: 340, height: 220 },
        { x: 410, y: 320, width: 340, height: 220 }
      ],
      // Layout para 5-6 bodegas
      [
        { x: 50, y: 60, width: 230, height: 160 },
        { x: 300, y: 60, width: 230, height: 160 },
        { x: 550, y: 60, width: 200, height: 160 },
        { x: 50, y: 240, width: 230, height: 160 },
        { x: 300, y: 240, width: 230, height: 160 },
        { x: 550, y: 240, width: 200, height: 160 }
      ]
    ];

    const count = Math.min(warehouses.length, 6);
    const layoutIndex = count <= 1 ? 0 : count - 1;
    const layout = layouts[layoutIndex] || layouts[layouts.length - 1];

    return warehouses.slice(0, 6).map((warehouse, index) => ({
      ...warehouse,
      layout: layout[index] || layout[0]
    }));
  };

  const organizedWarehouses = organizeWarehouses();

  // Colores para bodegas
  const warehouseColors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Orange
    '#8b5cf6', // Purple
    '#ef4444', // Red
    '#06b6d4'  // Cyan
  ];

  return (
    <div className="relative w-full bg-white rounded-lg shadow-2xl overflow-hidden border-2 border-slate-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6" />
            Plano del Local
          </h2>
          <p className="text-sm text-slate-300">{warehouses.length} bodegas totales</p>
        </div>

        {/* Controles de zoom */}
        <div className="flex gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            title="Alejar"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
          <span className="px-4 py-2 bg-slate-700 rounded-lg font-medium">
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

      {/* Instrucciones */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800">
        💡 <strong>Haz click en una bodega</strong> para ver sus productos
      </div>

      {/* Plano SVG */}
      <div className="relative overflow-auto bg-slate-100" style={{ height: '700px' }}>
        <svg
          width={BUILDING_WIDTH * zoom}
          height={BUILDING_HEIGHT * zoom}
          className="mx-auto"
          style={{ minWidth: '100%', minHeight: '100%' }}
        >
          {/* Grid de fondo */}
          <defs>
            <pattern id="buildingGrid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
              <path
                d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#buildingGrid)" />

          {/* Perímetro del edificio */}
          <rect
            x={20 * zoom}
            y={20 * zoom}
            width={(BUILDING_WIDTH - 40) * zoom}
            height={(BUILDING_HEIGHT - 40) * zoom}
            fill="#f1f5f9"
            stroke="#1e293b"
            strokeWidth={4 * zoom}
            rx={8 * zoom}
          />

          {/* Etiqueta del edificio */}
          <text
            x={40 * zoom}
            y={50 * zoom}
            fill="#1e293b"
            fontSize={18 * zoom}
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            🏢 EDIFICIO / LOCAL
          </text>

          {/* Entrada principal */}
          <g>
            <rect
              x={(BUILDING_WIDTH / 2 - 40) * zoom}
              y={20 * zoom}
              width={80 * zoom}
              height={8 * zoom}
              fill="#1e293b"
            />
            <text
              x={(BUILDING_WIDTH / 2) * zoom}
              y={40 * zoom}
              textAnchor="middle"
              fill="#64748b"
              fontSize={10 * zoom}
              fontWeight="600"
            >
              ENTRADA PRINCIPAL
            </text>
          </g>

          {/* Bodegas como "habitaciones" */}
          {organizedWarehouses.map((warehouse, index) => {
            const { layout } = warehouse;
            const color = warehouseColors[index % warehouseColors.length];
            const isHovered = hoveredWarehouse?.id === warehouse.id;

            return (
              <g
                key={warehouse.id}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredWarehouse(warehouse)}
                onMouseLeave={() => setHoveredWarehouse(null)}
                onClick={() => onWarehouseClick(warehouse)}
              >
                {/* Área de la bodega */}
                <rect
                  x={layout.x * zoom}
                  y={layout.y * zoom}
                  width={layout.width * zoom}
                  height={layout.height * zoom}
                  fill={isHovered ? color : `${color}20`}
                  stroke={color}
                  strokeWidth={isHovered ? 4 * zoom : 2 * zoom}
                  rx={4 * zoom}
                  style={{
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                    transition: 'all 0.3s'
                  }}
                />

                {/* Nombre de la bodega */}
                <text
                  x={(layout.x + layout.width / 2) * zoom}
                  y={(layout.y + 30) * zoom}
                  textAnchor="middle"
                  fill="#1e293b"
                  fontSize={16 * zoom}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {warehouse.name}
                </text>

                {/* Ubicación */}
                {warehouse.location && (
                  <text
                    x={(layout.x + layout.width / 2) * zoom}
                    y={(layout.y + 50) * zoom}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={10 * zoom}
                    fontFamily="sans-serif"
                  >
                    📍 {warehouse.location}
                  </text>
                )}

                {/* Cantidad de productos */}
                <g>
                  <rect
                    x={(layout.x + layout.width / 2 - 50) * zoom}
                    y={(layout.y + layout.height / 2 - 20) * zoom}
                    width={100 * zoom}
                    height={40 * zoom}
                    fill="white"
                    stroke={color}
                    strokeWidth={2 * zoom}
                    rx={8 * zoom}
                  />
                  <text
                    x={(layout.x + layout.width / 2) * zoom}
                    y={(layout.y + layout.height / 2 - 5) * zoom}
                    textAnchor="middle"
                    fill={color}
                    fontSize={24 * zoom}
                    fontWeight="bold"
                  >
                    {warehouse.productsCount || 0}
                  </text>
                  <text
                    x={(layout.x + layout.width / 2) * zoom}
                    y={(layout.y + layout.height / 2 + 12) * zoom}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={10 * zoom}
                  >
                    productos
                  </text>
                </g>

                {/* Puerta de la bodega */}
                <rect
                  x={(layout.x + layout.width - 15) * zoom}
                  y={(layout.y + layout.height / 2 - 20) * zoom}
                  width={10 * zoom}
                  height={40 * zoom}
                  fill="#8b5cf6"
                  stroke="#6d28d9"
                  strokeWidth={1 * zoom}
                  rx={2 * zoom}
                />

                {/* Decoración: estanterías internas (si hay productos) */}
                {warehouse.productsCount > 0 && (
                  <g opacity="0.3">
                    {[0, 1, 2].map((shelf) => (
                      <rect
                        key={shelf}
                        x={(layout.x + 20 + shelf * 60) * zoom}
                        y={(layout.y + layout.height - 60) * zoom}
                        width={40 * zoom}
                        height={20 * zoom}
                        fill="#8b6f47"
                        stroke="#654321"
                        strokeWidth={1 * zoom}
                        rx={2 * zoom}
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}

          {/* Medidas del plano */}
          <g opacity="0.6">
            {/* Cota horizontal */}
            <line
              x1={30 * zoom}
              y1={(BUILDING_HEIGHT - 10) * zoom}
              x2={(BUILDING_WIDTH - 30) * zoom}
              y2={(BUILDING_HEIGHT - 10) * zoom}
              stroke="#475569"
              strokeWidth={1 * zoom}
            />
            <text
              x={(BUILDING_WIDTH / 2) * zoom}
              y={(BUILDING_HEIGHT - 15) * zoom}
              textAnchor="middle"
              fill="#475569"
              fontSize={10 * zoom}
            >
              {((BUILDING_WIDTH - 60) / 100).toFixed(1)} m
            </text>

            {/* Cota vertical */}
            <line
              x1={(BUILDING_WIDTH - 10) * zoom}
              y1={30 * zoom}
              x2={(BUILDING_WIDTH - 10) * zoom}
              y2={(BUILDING_HEIGHT - 30) * zoom}
              stroke="#475569"
              strokeWidth={1 * zoom}
            />
            <text
              x={(BUILDING_WIDTH - 15) * zoom}
              y={(BUILDING_HEIGHT / 2) * zoom}
              textAnchor="middle"
              fill="#475569"
              fontSize={10 * zoom}
              transform={`rotate(-90, ${(BUILDING_WIDTH - 15) * zoom}, ${(BUILDING_HEIGHT / 2) * zoom})`}
            >
              {((BUILDING_HEIGHT - 60) / 100).toFixed(1)} m
            </text>
          </g>
        </svg>
      </div>

      {/* Leyenda de colores */}
      <div className="bg-white border-t border-slate-200 p-4">
        <div className="font-bold text-slate-700 mb-2">📊 Bodegas:</div>
        <div className="flex flex-wrap gap-3">
          {organizedWarehouses.map((warehouse, index) => (
            <div
              key={warehouse.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div
                className="w-4 h-4 rounded"
                style={{ background: warehouseColors[index % warehouseColors.length] }}
              ></div>
              <span className="text-sm font-medium text-slate-700">{warehouse.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
