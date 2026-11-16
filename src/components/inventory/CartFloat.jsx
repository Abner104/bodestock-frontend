// src/components/inventory/CartFloat.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Minus, Plus, Trash2 } from 'lucide-react';

const CartFloat = ({
  selectedProducts,
  onUpdateQuantity,
  onRemoveProduct,
  formatCLP,
  currentWorker,
  totalQuantity,
  totalValue,
  isVisible = true
}) => {

  const cartItemCount = selectedProducts.length;
  const isEmpty = cartItemCount === 0;

  if (!isVisible) return null;

  return (
    <motion.div
      className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-80 max-h-[70vh] flex flex-col hidden xl:flex"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      {/* Header del Carrito */}
      <motion.div
        className="bg-white rounded-t-2xl shadow-xl border border-slate-200 p-4"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", damping: 25 }}
      >
        <div className="flex items-center justify-between">
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
              <AnimatePresence>
                {cartItemCount > 0 && (
                  <motion.div
                    className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    whileHover={{ scale: 1.2 }}
                  >
                    {cartItemCount}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <div>
              <h3 className="font-semibold text-slate-900">Mi Carrito</h3>
              <p className="text-xs text-slate-600">
                {cartItemCount} {cartItemCount === 1 ? 'producto' : 'productos'}
              </p>
            </div>
          </div>
        </div>

        {/* Indicador de límites para trabajadores */}
        {currentWorker?.limitType === 'UNITS' && currentWorker?.role === 'WORKER' && (
          <motion.div
            className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between text-xs">
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
              className="mt-1 w-full bg-blue-200 rounded-full h-1.5"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <motion.div
                className={`h-1.5 rounded-full transition-all ${
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
                transition={{ delay: 0.4, duration: 0.7, type: "spring" }}
              />
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      {/* Lista de Productos */}
      <motion.div
        className="bg-white shadow-xl border-x border-slate-200 flex-1 overflow-hidden"
        layout
      >
        <AnimatePresence mode="wait">
          {isEmpty ? (
            <motion.div
              key="empty"
              className="p-6 text-center text-slate-500"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              </motion.div>
              <p className="text-sm">Tu carrito está vacío</p>
              <p className="text-xs text-slate-400 mt-1">Selecciona productos para continuar</p>
            </motion.div>
          ) : (
            <motion.div
              key="products"
              className="p-3 space-y-2 max-h-60 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AnimatePresence>
                {selectedProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    className="bg-slate-50 rounded-lg p-3 border border-slate-100"
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.9 }}
                    whileHover={{ scale: 1.02, backgroundColor: "#f8fafc" }}
                    layout
                  >
                    <div className="flex items-start justify-between gap-2">
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
                        {product.tienePromoActiva && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 mt-0.5">
                            🏷️ Promo aplicada
                          </span>
                        )}
                      </div>

                      <motion.button
                        onClick={() => onRemoveProduct(product.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <X className="w-3 h-3" />
                      </motion.button>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <motion.button
                          onClick={() => onUpdateQuantity(product.id, Math.max(0, product.quantity - 1))}
                          className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50"
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
                          className="w-16 px-2 py-1 text-center text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                          whileFocus={{ scale: 1.05 }}
                        />

                        <motion.button
                          onClick={() => onUpdateQuantity(product.id, Math.min(product.stock, product.quantity + 1))}
                          className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          disabled={product.quantity >= product.stock}
                        >
                          <Plus className="w-3 h-3" />
                        </motion.button>
                      </div>

                      {currentWorker?.role === 'ADMIN' && (
                        <motion.div
                          className="text-xs font-medium text-slate-700"
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer del carrito */}
      {!isEmpty && (
        <motion.div
          className="bg-white rounded-b-2xl shadow-xl border border-slate-200 p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
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
              <div className="flex justify-between pt-2 border-t border-slate-100">
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
        </motion.div>
      )}
    </motion.div>
  );
};

export default CartFloat;