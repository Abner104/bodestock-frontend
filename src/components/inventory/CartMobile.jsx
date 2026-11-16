// src/components/inventory/CartMobile.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronUp, ChevronDown, X, Minus, Plus } from 'lucide-react';

const CartMobile = ({
  selectedProducts,
  onUpdateQuantity,
  onRemoveProduct,
  formatCLP,
  currentWorker,
  totalQuantity,
  totalValue,
  isVisible = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cartItemCount = selectedProducts.length;
  const isEmpty = cartItemCount === 0;

  if (!isVisible || isEmpty) return null;

  return (
    <>
      {/* Overlay cuando está expandido */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Carrito móvil */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 xl:hidden"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Header colapsado */}
        <motion.div
          className="bg-white border-t border-slate-200 shadow-xl"
          whileTap={{ scale: 0.98 }}
        >
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="relative"
                animate={{
                  rotate: isEmpty ? 0 : [0, -10, 10, -10, 0],
                  scale: isEmpty ? 1 : [1, 1.1, 1]
                }}
                transition={{ duration: 0.5 }}
              >
                <ShoppingCart className="w-6 h-6 text-orange-600" />
                <motion.div
                  className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  key={cartItemCount}
                >
                  {cartItemCount}
                </motion.div>
              </motion.div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">
                  {cartItemCount} {cartItemCount === 1 ? 'producto' : 'productos'}
                </p>
                {currentWorker?.role === 'ADMIN' && (
                  <p className="text-sm text-orange-600 font-medium">
                    {formatCLP(totalValue)}
                  </p>
                )}
              </div>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronUp className="w-5 h-5 text-slate-600" />
            </motion.div>
          </button>
        </motion.div>

        {/* Contenido expandido */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="bg-white border-t border-slate-200 max-h-[60vh] overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Límites para trabajadores */}
              {currentWorker?.limitType === 'UNITS' && currentWorker?.role === 'WORKER' && (
                <div className="p-4 bg-blue-50 border-b border-blue-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700 font-medium">Cantidad total:</span>
                    <span className={`font-bold ${
                      totalQuantity > ((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0)
                        ? 'text-red-600'
                        : totalQuantity >= ((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0) * 0.8
                        ? 'text-orange-600'
                        : 'text-blue-600'
                    }`}>
                      {totalQuantity.toFixed(2)} / {(currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0}
                    </span>
                  </div>
                  <motion.div
                    className="mt-2 w-full bg-blue-200 rounded-full h-2"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                  >
                    <motion.div
                      className={`h-2 rounded-full transition-all ${
                        totalQuantity > ((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0)
                          ? 'bg-red-500'
                          : totalQuantity >= ((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 0) * 0.8
                          ? 'bg-orange-500'
                          : 'bg-blue-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          (totalQuantity / Math.max((currentWorker.dailyLimitUnits || currentWorker.dailyLimitProducts) || 1, 1)) * 100,
                          100
                        )}%`
                      }}
                      transition={{ duration: 0.7, type: "spring" }}
                    />
                  </motion.div>
                </div>
              )}

              {/* Lista de productos */}
              <div className="max-h-60 overflow-y-auto">
                <AnimatePresence>
                  {selectedProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      className="p-4 border-b border-slate-100 last:border-b-0"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      layout
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 text-sm truncate">
                            {product.name}
                          </h4>
                          <p className="text-xs text-slate-600">
                            {product.code} • {product.unit}
                          </p>
                          {currentWorker?.role === 'ADMIN' && (
                            <p className="text-xs text-slate-500">
                              {formatCLP(product.ppp)} c/u
                            </p>
                          )}
                        </div>

                        <motion.button
                          onClick={() => onRemoveProduct(product.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </div>

                      {/* Controles de cantidad */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={() => onUpdateQuantity(product.id, Math.max(0, product.quantity - 1))}
                            className="p-1.5 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            disabled={product.quantity <= 1}
                          >
                            <Minus className="w-3 h-3" />
                          </motion.button>

                          <motion.input
                            type="number"
                            min="0"
                            max={product.stock}
                            step="0.01"
                            value={product.quantity}
                            onChange={(e) => onUpdateQuantity(product.id, parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                            whileFocus={{ scale: 1.05 }}
                          />

                          <motion.button
                            onClick={() => onUpdateQuantity(product.id, Math.min(product.stock, product.quantity + 1))}
                            className="p-1.5 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            disabled={product.quantity >= product.stock}
                          >
                            <Plus className="w-3 h-3" />
                          </motion.button>
                        </div>

                        {currentWorker?.role === 'ADMIN' && (
                          <motion.div
                            className="text-sm font-medium text-slate-700"
                            key={product.totalValue}
                            initial={{ scale: 1.2, color: "#10b981" }}
                            animate={{ scale: 1, color: "#374151" }}
                            transition={{ duration: 0.3 }}
                          >
                            {formatCLP(product.totalValue)}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Resumen total */}
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total productos:</span>
                    <motion.span
                      className="font-medium"
                      key={cartItemCount}
                      initial={{ scale: 1.2, color: "#10b981" }}
                      animate={{ scale: 1, color: "#374151" }}
                    >
                      {cartItemCount}
                    </motion.span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cantidad total:</span>
                    <motion.span
                      className="font-medium"
                      key={totalQuantity}
                      initial={{ scale: 1.2, color: "#10b981" }}
                      animate={{ scale: 1, color: "#374151" }}
                    >
                      {totalQuantity.toFixed(2)}
                    </motion.span>
                  </div>
                  {currentWorker?.role === 'ADMIN' && (
                    <div className="flex justify-between pt-2 border-t border-slate-200">
                      <span className="text-slate-900 font-medium">Valor total:</span>
                      <motion.span
                        className="font-bold text-orange-600"
                        key={totalValue}
                        initial={{ scale: 1.3, color: "#10b981" }}
                        animate={{ scale: 1, color: "#ea580c" }}
                        transition={{ duration: 0.4 }}
                      >
                        {formatCLP(totalValue)}
                      </motion.span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default CartMobile;