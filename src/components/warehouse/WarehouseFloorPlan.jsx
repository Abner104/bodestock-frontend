import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, MapPin, Maximize2, Minimize2 } from 'lucide-react';

/**
 * Componente de Plano de Bodega 2D (Vista desde arriba)
 * Similar a planos arquitectónicos
 */
export default function WarehouseFloorPlan({ products = [], warehouseName = 'Bodega', onProductClick }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredProduct, setHoveredProduct] = useState(null);

  // Dimensiones del plano (en metros virtuales)
  const WAREHOUSE_WIDTH = 600; // 6 metros = 600px
  const WAREHOUSE_HEIGHT = 400; // 4 metros = 400px
  const SHELF_WIDTH = 80;
  const SHELF_HEIGHT = 40;

  // Organizar productos en estanterías (grid layout)
  const organizeProducts = () => {
    const PRODUCTS_PER_SHELF = 6;
    const SHELVES_PER_ROW = 3;
    const organized = [];

    products.forEach((product, index) => {
      const shelfNumber = Math.floor(index / PRODUCTS_PER_SHELF);
      const positionInShelf = index % PRODUCTS_PER_SHELF;
      const row = Math.floor(shelfNumber / SHELVES_PER_ROW);
      const col = shelfNumber % SHELVES_PER_ROW;

      // Calcular posición en el plano
      const x = 60 + col * 180; // Espacio entre estanterías
      const y = 60 + row * 120;
      const offsetX = (positionInShelf % 3) * 25;
      const offsetY = Math.floor(positionInShelf / 3) * 18;

      organized.push({
        product,
        shelf: shelfNumber + 1,
        position: { x: x + offsetX, y: y + offsetY },
        shelfPosition: { x, y }
      });
    });

    return organized;
  };

  const organizedProducts = organizeProducts();
  const numberOfShelves = Math.ceil(products.length / 6);

  // Determinar color según nivel de stock
  const getStockColor = (product) => {
    const stockPercentage = (product.stock / (product.minStock || 10)) * 100;

    if (stockPercentage > 50) return '#10b981'; // Verde
    if (stockPercentage > 20) return '#f59e0b'; // Amarillo
    return '#ef4444'; // Rojo
  };

  const handleProductClick = (productData) => {
    setSelectedProduct(productData.product);
    if (onProductClick) {
      onProductClick(productData.product);
    }
  };

  // Obtener estanterías únicas
  const shelves = [...new Set(organizedProducts.map(p => p.shelf))];

  return (
    <div className="relative w-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header con controles */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white p-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Plano de {warehouseName}
          </h3>
          <p className="text-sm text-slate-300">{products.length} productos en {numberOfShelves} estanterías</p>
        </div>

        {/* Controles de zoom */}
        <div className="flex gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
            title="Alejar"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <span className="px-3 py-2 bg-slate-600 rounded-lg text-sm font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
            className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
            title="Acercar"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="absolute top-20 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm">
        <div className="font-bold mb-2 text-slate-700">📊 Stock</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 rounded-sm" style={{ background: '#10b981' }}></div>
          <span className="text-slate-600">Alto (&gt;50%)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 rounded-sm" style={{ background: '#f59e0b' }}></div>
          <span className="text-slate-600">Medio (20-50%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm" style={{ background: '#ef4444' }}></div>
          <span className="text-slate-600">Bajo (&lt;20%)</span>
        </div>
      </div>

      {/* Área del plano con scroll */}
      <div className="relative overflow-auto" style={{ height: '600px' }}>
        <svg
          width={WAREHOUSE_WIDTH * zoom}
          height={WAREHOUSE_HEIGHT * zoom}
          className="bg-slate-50"
          style={{ minWidth: '100%', minHeight: '100%' }}
        >
          {/* Grid de fondo (opcional) */}
          <defs>
            <pattern id="grid" width={50 * zoom} height={50 * zoom} patternUnits="userSpaceOnUse">
              <path
                d={`M ${50 * zoom} 0 L 0 0 0 ${50 * zoom}`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Perímetro de la bodega */}
          <rect
            x={20 * zoom}
            y={20 * zoom}
            width={(WAREHOUSE_WIDTH - 40) * zoom}
            height={(WAREHOUSE_HEIGHT - 40) * zoom}
            fill="none"
            stroke="#334155"
            strokeWidth={4 * zoom}
            rx={4 * zoom}
          />

          {/* Etiqueta del nombre de la bodega */}
          <text
            x={30 * zoom}
            y={15 * zoom}
            fill="#334155"
            fontSize={12 * zoom}
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {warehouseName}
          </text>

          {/* Estanterías */}
          {shelves.map((shelfNum) => {
            const shelfProducts = organizedProducts.filter(p => p.shelf === shelfNum);
            if (shelfProducts.length === 0) return null;

            const { x, y } = shelfProducts[0].shelfPosition;

            return (
              <g key={`shelf-${shelfNum}`}>
                {/* Rectángulo de la estantería */}
                <rect
                  x={x * zoom}
                  y={y * zoom}
                  width={SHELF_WIDTH * zoom}
                  height={SHELF_HEIGHT * zoom}
                  fill="#d4a574"
                  stroke="#8b6f47"
                  strokeWidth={2 * zoom}
                  rx={2 * zoom}
                />

                {/* Etiqueta de número de estantería */}
                <text
                  x={(x + 5) * zoom}
                  y={(y - 5) * zoom}
                  fill="#64748b"
                  fontSize={9 * zoom}
                  fontWeight="600"
                  fontFamily="sans-serif"
                >
                  Estantería {shelfNum}
                </text>

                {/* Líneas divisorias de la estantería */}
                <line
                  x1={(x + SHELF_WIDTH / 2) * zoom}
                  y1={y * zoom}
                  x2={(x + SHELF_WIDTH / 2) * zoom}
                  y2={(y + SHELF_HEIGHT) * zoom}
                  stroke="#8b6f47"
                  strokeWidth={1 * zoom}
                />
              </g>
            );
          })}

          {/* Productos */}
          {organizedProducts.map(({ product, position, shelf }, index) => {
            const isHovered = hoveredProduct?.id === product.id;
            const isSelected = selectedProduct?.id === product.id;
            const color = getStockColor(product);

            return (
              <g
                key={product.id || index}
                className="cursor-pointer transition-transform"
                style={{ transformOrigin: `${position.x * zoom}px ${position.y * zoom}px` }}
                onMouseEnter={() => setHoveredProduct(product)}
                onMouseLeave={() => setHoveredProduct(null)}
                onClick={() => handleProductClick({ product, shelf, position })}
              >
                {/* Sombra si está seleccionado */}
                {isSelected && (
                  <rect
                    x={(position.x - 2) * zoom}
                    y={(position.y - 2) * zoom}
                    width={24 * zoom}
                    height={16 * zoom}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={3 * zoom}
                    rx={2 * zoom}
                  />
                )}

                {/* Caja del producto */}
                <rect
                  x={position.x * zoom}
                  y={position.y * zoom}
                  width={20 * zoom}
                  height={12 * zoom}
                  fill={color}
                  stroke={isHovered ? '#1e293b' : '#475569'}
                  strokeWidth={(isHovered ? 2 : 1) * zoom}
                  rx={1 * zoom}
                  opacity={isHovered ? 1 : 0.85}
                  style={{
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                />

                {/* Indicador de cantidad (opcional) */}
                {product.stock < 10 && (
                  <circle
                    cx={(position.x + 16) * zoom}
                    cy={(position.y + 2) * zoom}
                    r={3 * zoom}
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth={0.5 * zoom}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip flotante para producto hover */}
        <AnimatePresence>
          {hoveredProduct && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute pointer-events-none z-20"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl max-w-xs">
                <div className="font-bold text-sm mb-1">{hoveredProduct.name}</div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>📦 Stock: {hoveredProduct.stock} {hoveredProduct.unit}</div>
                  <div>🏷️ SKU: {hoveredProduct.sku || 'N/A'}</div>
                  {hoveredProduct.category && (
                    <div>📂 {hoveredProduct.category}</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Panel lateral de producto seleccionado */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl border-l border-slate-200 z-30"
          >
            <div className="p-4 bg-gradient-to-r from-slate-700 to-slate-900 text-white flex justify-between items-center">
              <h4 className="font-bold">Detalles del Producto</h4>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 hover:bg-slate-600 rounded transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-2xl font-bold text-slate-800 mb-1">{selectedProduct.name}</div>
                <div className="text-sm text-slate-500">{selectedProduct.sku || 'Sin SKU'}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Stock Actual</div>
                  <div className="text-xl font-bold text-slate-800">
                    {selectedProduct.stock}
                    <span className="text-sm text-slate-500 ml-1">{selectedProduct.unit}</span>
                  </div>
                </div>

                {selectedProduct.ppp && (
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Precio</div>
                    <div className="text-lg font-bold text-slate-800">
                      ${parseInt(selectedProduct.ppp).toLocaleString('es-CL')}
                    </div>
                  </div>
                )}
              </div>

              {selectedProduct.category && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Categoría</div>
                  <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {selectedProduct.category}
                  </div>
                </div>
              )}

              {selectedProduct.provider && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Proveedor</div>
                  <div className="text-sm text-slate-700">{selectedProduct.provider}</div>
                </div>
              )}

              <button
                onClick={() => {
                  if (onProductClick) {
                    onProductClick(selectedProduct);
                  }
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" />
                Agregar al Carrito
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
