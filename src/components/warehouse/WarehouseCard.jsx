import { motion } from 'framer-motion';
import { MapPin, Package, Box } from 'lucide-react';

/**
 * Tarjeta de Bodega con diseño de Plano Arquitectónico
 */
export default function WarehouseCard({ warehouse, productsCount = 0, onClick, index = 0 }) {
  // Simular un layout simple de bodega
  const generateMiniFloorPlan = () => {
    // Crear estanterías basadas en la cantidad de productos
    const shelves = Math.min(6, Math.max(2, Math.ceil(productsCount / 5)));
    const shelfData = [];

    for (let i = 0; i < shelves; i++) {
      shelfData.push({
        x: 20 + (i % 3) * 50,
        y: 20 + Math.floor(i / 3) * 35
      });
    }

    return shelfData;
  };

  const shelves = generateMiniFloorPlan();

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all overflow-hidden group cursor-pointer"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 * index }}
      whileHover={{ y: -5, scale: 1.02 }}
      onClick={onClick}
    >
      {/* Header con nombre */}
      <div className="p-4 bg-gradient-to-r from-slate-700 to-slate-900 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{warehouse.name}</h3>
            {warehouse.location && (
              <div className="flex items-center gap-1 text-xs text-slate-300 mt-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{warehouse.location}</span>
              </div>
            )}
          </div>
          <div className="bg-white/20 px-2 py-1 rounded-lg text-xs font-medium">
            {productsCount} items
          </div>
        </div>
      </div>

      {/* Plano de bodega (SVG) */}
      <div className="relative bg-slate-50 p-4" style={{ height: '180px' }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 160 140"
          className="drop-shadow-sm"
        >
          {/* Fondo con patrón de grid */}
          <defs>
            <pattern id={`grid-${warehouse.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Grid de fondo */}
          <rect width="160" height="140" fill={`url(#grid-${warehouse.id})`} />

          {/* Perímetro de la bodega */}
          <rect
            x="5"
            y="5"
            width="150"
            height="130"
            fill="none"
            stroke="#475569"
            strokeWidth="2"
            rx="2"
          />

          {/* Puerta de entrada */}
          <rect
            x="70"
            y="5"
            width="20"
            height="3"
            fill="#475569"
          />
          <text
            x="80"
            y="12"
            textAnchor="middle"
            fontSize="5"
            fill="#64748b"
            fontWeight="600"
          >
            ENTRADA
          </text>

          {/* Estanterías */}
          {shelves.map((shelf, idx) => (
            <g key={idx}>
              {/* Estantería principal */}
              <rect
                x={shelf.x}
                y={shelf.y}
                width="30"
                height="20"
                fill="#d4a574"
                stroke="#8b6f47"
                strokeWidth="1"
                rx="1"
              />

              {/* División de la estantería */}
              <line
                x1={shelf.x + 15}
                y1={shelf.y}
                x2={shelf.x + 15}
                y2={shelf.y + 20}
                stroke="#8b6f47"
                strokeWidth="0.5"
              />

              {/* Productos en la estantería (cajas pequeñas) */}
              {[0, 1, 2].map((box) => (
                <rect
                  key={box}
                  x={shelf.x + 3 + box * 8}
                  y={shelf.y + 4}
                  width="6"
                  height="5"
                  fill="#10b981"
                  stroke="#059669"
                  strokeWidth="0.5"
                  rx="0.5"
                  opacity="0.8"
                />
              ))}
              {[0, 1, 2].map((box) => (
                <rect
                  key={box}
                  x={shelf.x + 3 + box * 8}
                  y={shelf.y + 11}
                  width="6"
                  height="5"
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth="0.5"
                  rx="0.5"
                  opacity="0.8"
                />
              ))}
            </g>
          ))}

          {/* Área de carga (si hay espacio) */}
          {shelves.length < 6 && (
            <g>
              <rect
                x="120"
                y="100"
                width="30"
                height="25"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2,2"
                rx="1"
              />
              <text
                x="135"
                y="115"
                textAnchor="middle"
                fontSize="6"
                fill="#64748b"
              >
                CARGA
              </text>
            </g>
          )}

          {/* Medidas (decorativas) */}
          <g opacity="0.5">
            {/* Línea de cota horizontal */}
            <line x1="10" y1="138" x2="150" y2="138" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="10" y1="136" x2="10" y2="140" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="150" y1="136" x2="150" y2="140" stroke="#94a3b8" strokeWidth="0.5" />
            <text x="80" y="143" textAnchor="middle" fontSize="4" fill="#64748b">
              {(Math.random() * 2 + 4).toFixed(1)}m
            </text>
          </g>
        </svg>

        {/* Overlay con info al hover */}
        <div className="absolute inset-0 bg-blue-600/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="text-center text-white p-4">
            <Package className="w-12 h-12 mx-auto mb-2" />
            <div className="font-bold text-lg mb-1">Ver Productos</div>
            <div className="text-sm text-blue-100">{productsCount} productos en stock</div>
          </div>
        </div>
      </div>

      {/* Footer con descripción y botón */}
      <div className="p-4">
        {warehouse.description && (
          <p className="text-xs text-slate-600 mb-3 line-clamp-2">{warehouse.description}</p>
        )}

        <motion.button
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 px-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Box className="w-4 h-4" />
          <span className="text-sm">Entrar a Bodega</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
