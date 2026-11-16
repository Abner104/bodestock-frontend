// src/components/inventory/ProductCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, ShoppingCart, Package, Zap, Tag, BarChart3 } from 'lucide-react';

const ProductCard = ({
  product,
  isSelected,
  isBlocked,
  selectedQuantity = 0,
  onUpdateQuantity,
  currentWorker,
  formatCLP,
  index = 0,
  disableConversion = false // Nueva prop: cuando es true, NO se muestra la conversión de unidades
}) => {

  const quickAddAmounts = [1, 5, 10];
  const maxStock = product.stock;

  const handleQuickAdd = (amount) => {
    const newQuantity = Math.min(maxStock, selectedQuantity + amount);
    onUpdateQuantity(product.id, newQuantity);
  };

  const handleMaxAdd = () => {
    onUpdateQuantity(product.id, maxStock);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        delay: index * 0.05,
        type: "spring",
        damping: 25,
        stiffness: 300
      }
    },
    hover: {
      scale: isBlocked ? 1 : 1.02,
      y: isBlocked ? 0 : -4,
      boxShadow: isBlocked
        ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        : "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      transition: { duration: 0.2 }
    },
    tap: {
      scale: isBlocked ? 1 : 0.98
    }
  };

  return (
    <motion.div
      className={`rounded-xl overflow-visible transition-all duration-300 ${
        isSelected
          ? 'bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-2 border-blue-500 shadow-lg'
          : isBlocked
          ? 'bg-red-50 border-2 border-red-200 opacity-60 cursor-not-allowed'
          : 'bg-white border-2 border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md'
      }`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={!isBlocked ? "hover" : undefined}
      whileTap={!isBlocked ? "tap" : undefined}
      layout
    >
      {/* Header con información del producto */}
      <div className="p-4 border-b-2 border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <motion.h4
              className="font-bold text-slate-900 text-base md:text-lg leading-tight mb-1"
              layoutId={`product-name-${product.id}`}
              title={product.name}
            >
              {product.name}
            </motion.h4>

            {/* Código y categoría */}
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-slate-700 font-medium">
                <Tag className="w-3 h-3" />
                {product.code}
              </span>
              {product.category && (
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">
                  <BarChart3 className="w-3 h-3" />
                  {product.category}
                </span>
              )}
            </div>

            {/* Precio unitario para ADMIN y roles con view_sale_prices */}
            {(currentWorker?.role === 'ADMIN' || currentWorker?.role === 'VENDEDORA' || currentWorker?.permissions?.includes('view_sale_prices')) && (product.salePrice > 0 || product.precioVenta > 0) && (
              <p className="text-sm font-bold text-blue-600 mt-2">
                {formatCLP(product.salePrice > 0 ? product.salePrice : product.precioVenta)}<span className="text-slate-500 font-normal"> / {product.unit}</span>
              </p>
            )}
          </div>

          {/* Stock badge - más prominente */}
          <motion.div
            className={`px-3 py-2 rounded-lg text-sm font-bold flex flex-col items-center gap-0.5 min-w-[70px] ${
              product.stock <= 5
                ? 'bg-red-100 text-red-700 border-2 border-red-200'
                : product.stock <= 10
                ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-200'
                : 'bg-green-100 text-green-700 border-2 border-green-200'
            }`}
            whileHover={{ scale: 1.05 }}
          >
            <Package className="w-4 h-4" />
            <span className="text-lg font-extrabold">{product.stock}</span>
            <span className="text-[10px] uppercase font-medium opacity-80">{product.unit}</span>
          </motion.div>
        </div>

        {/* Campos personalizados */}
        {product.customFields && Object.keys(product.customFields).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(product.customFields).slice(0, 3).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-orange-50 text-orange-700 border border-orange-200 font-medium"
                title={`${key}: ${value}`}
              >
                {key}: {value}
              </span>
            ))}
            {Object.keys(product.customFields).length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-600 font-medium">
                +{Object.keys(product.customFields).length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controles de cantidad */}
      <div className="p-4">
        {!isBlocked ? (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 + 0.2 }}
          >
            {/* Selector de presentación SI tiene presentaciones */}
            {product.presentations && product.presentations.length > 0 && (
              <div className="mb-2">
                <label className="block text-xs font-medium text-slate-600 uppercase mb-1.5">
                  Presentación
                </label>
                <select
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  defaultValue=""
                  onChange={(e) => {
                    // Guardar la presentación seleccionada en el producto
                    product.selectedPresentationId = e.target.value || null;
                    // Re-calcular el precio con la nueva presentación
                    if (selectedQuantity > 0) {
                      onUpdateQuantity(product.id, selectedQuantity);
                    }
                  }}
                >
                  <option value="">Por {product.unit}</option>
                  {product.presentations.map((pres) => (
                    <option key={pres.id} value={pres.id}>
                      Por {pres.name} (1 = {pres.factor} {product.unit})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Input principal de cantidad */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 uppercase">
                <span>Cantidad</span>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => onUpdateQuantity(product.id, Math.max(0, selectedQuantity - 1))}
                  className="p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: selectedQuantity > 0 ? 1.1 : 1 }}
                  whileTap={{ scale: selectedQuantity > 0 ? 0.9 : 1 }}
                  disabled={selectedQuantity <= 0}
                >
                  <Minus className="w-5 h-5 text-slate-700" />
                </motion.button>

                <div className="flex-1 relative">
                  <motion.input
                    type="number"
                    min="0"
                    max={product.stock}
                    step="0.01"
                    placeholder="0.00"
                    value={selectedQuantity || ''}
                    onChange={(e) => onUpdateQuantity(product.id, parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-bold text-lg bg-white"
                    whileFocus={{ scale: 1.02 }}
                  />
                  {selectedQuantity > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg"
                    >
                      ✓
                    </motion.div>
                  )}
                </div>

                <motion.button
                  onClick={() => onUpdateQuantity(product.id, Math.min(product.stock, selectedQuantity + 1))}
                  className="p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: selectedQuantity < product.stock ? 1.1 : 1 }}
                  whileTap={{ scale: selectedQuantity < product.stock ? 0.9 : 1 }}
                  disabled={selectedQuantity >= product.stock}
                >
                  <Plus className="w-5 h-5 text-slate-700" />
                </motion.button>
              </div>
            </div>

            {/* Botones de acción rápida - mejorados */}
            <div className="grid grid-cols-4 gap-2">
              {quickAddAmounts.map((amount) => (
                <motion.button
                  key={amount}
                  onClick={() => handleQuickAdd(amount)}
                  className="px-2 py-2 text-sm font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border-2 border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: selectedQuantity < product.stock ? 1.05 : 1 }}
                  whileTap={{ scale: selectedQuantity < product.stock ? 0.95 : 1 }}
                  disabled={selectedQuantity >= product.stock}
                >
                  +{amount}
                </motion.button>
              ))}

              <motion.button
                onClick={handleMaxAdd}
                className="px-2 py-2 text-sm font-bold bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border-2 border-green-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: selectedQuantity < product.stock ? 1.05 : 1 }}
                whileTap={{ scale: selectedQuantity < product.stock ? 0.95 : 1 }}
                disabled={selectedQuantity >= product.stock}
              >
                <Zap className="w-3 h-3" />
                <span>MAX</span>
              </motion.button>
            </div>

            {/* Indicador visual de selección */}
            {selectedQuantity > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-3 shadow-md"
              >
                {/* Conversión si hay presentación seleccionada */}
                {product.selectedPresentationId && product.presentations && (
                  <div className="mb-2 pb-2 border-b border-white/30">
                    <p className="text-xs opacity-90 mb-1">🔄 Conversión</p>
                    <p className="text-sm font-medium">
                      {selectedQuantity} {product.presentations.find(p => p.id === product.selectedPresentationId)?.name} × {product.presentations.find(p => p.id === product.selectedPresentationId)?.factor} = <strong>{selectedQuantity * (product.presentations.find(p => p.id === product.selectedPresentationId)?.factor || 1)} {product.unit}</strong>
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <div className="text-left">
                      <p className="text-xs opacity-90">En carrito</p>
                      <p className="font-bold text-lg leading-tight">
                        {product.selectedPresentationId && product.presentations
                          ? `${selectedQuantity * (product.presentations.find(p => p.id === product.selectedPresentationId)?.factor || 1)} ${product.unit}`
                          : `${selectedQuantity} ${product.unit}`
                        }
                      </p>
                    </div>
                  </div>

                  {(currentWorker?.role === 'ADMIN' || currentWorker?.role === 'VENDEDORA' || currentWorker?.permissions?.includes('view_sale_prices')) && (
                    <div className="text-right">
                      <p className="text-xs opacity-90">Subtotal</p>
                      <motion.p
                        className="font-bold text-lg leading-tight"
                        key={selectedQuantity * product.ppp * (product.selectedPresentationId ? (product.presentations.find(p => p.id === product.selectedPresentationId)?.factor || 1) : 1)}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {formatCLP(selectedQuantity * product.ppp * (product.selectedPresentationId && product.presentations ? (product.presentations.find(p => p.id === product.selectedPresentationId)?.factor || 1) : 1))}
                      </motion.p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* Mensaje de límite alcanzado */
          <motion.div
            className="p-4 bg-red-100 border-2 border-red-200 rounded-lg"
            initial={{ opacity: 0, x: -10 }}
            animate={{
              opacity: 1,
              x: 0,
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 0.5,
              scale: { repeat: 3, duration: 0.2 }
            }}
          >
            <p className="text-sm text-red-700 font-bold text-center flex items-center justify-center gap-2">
              <Package className="w-5 h-5" />
              Límite de cantidad alcanzado
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default ProductCard;
