// src/components/inventory/grid/ProductCard.jsx
/**
 * Card de producto para vista mobile
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Edit3, Trash2, ShoppingCart, History, ArrowRightLeft, AlertTriangle, Warehouse, Package, Printer } from 'lucide-react';
import { SensitiveInfoGuard } from '../../PermissionGuard';

export default function ProductCard({
  item,
  index,
  onEdit,
  onDelete,
  onPurchase,
  onHistory,
  onTransfer,
  onShrinkage,
  onPrintLabel,
  getWarehouseName,
  getExpiryStatus,
  CLP
}) {
  const isElaborado = item.productType === 'ELABORADO' || (Array.isArray(item.receta) && item.receta.length > 0);
  const isOutOfStock = !isElaborado && (item.stock || 0) === 0;
  const expiryStatus = getExpiryStatus(item.expiryDate);
  const totalValue = (item.stock || 0) * (item.ppp || 0);
  const thumbnailUrl = item.photos?.[0] || item.photoURL || null;

  return (
    <motion.div
      key={item.id}
      className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border ${
        isOutOfStock ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/60' : 'border-slate-200 dark:border-slate-700'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Foto del producto */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : (
            <Package className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          )}
          <Package className="w-8 h-8 text-slate-400 dark:text-slate-500" style={{ display: 'none' }} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-slate-900 dark:text-white text-base truncate">{item.name}</h4>
          {item.sku && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">SKU: {item.sku}</p>
          )}

          {/* Alerta de vencimiento */}
          {expiryStatus && expiryStatus.status !== 'ok' && (
            <div className={`mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
              expiryStatus.status === 'expired' ? 'bg-red-100 border-red-300 text-red-800' :
              expiryStatus.status === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
              'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              <span className="mr-1">{expiryStatus.icon}</span>
              {expiryStatus.status === 'expired'
                ? `Vencido hace ${expiryStatus.days} días`
                : `Vence en ${expiryStatus.days} días`
              }
            </div>
          )}

          {/* Campos personalizados */}
          {item.customFields && Object.keys(item.customFields).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(item.customFields).slice(0, 3).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          )}

          {/* Categoría badge */}
          <span className="mt-2 inline-block px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-full font-medium">
            {item.category}
          </span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
        {/* Stock */}
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Stock</div>
          {isElaborado ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
              🍳 Bajo pedido
            </span>
          ) : (
            <>
              <div className={`text-base font-bold ${isOutOfStock ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                {(item.stock ?? 0).toLocaleString('es-CL')} {item.unit}
              </div>
              {item.presentations && item.presentations.length > 0 && (() => {
                const presentation = item.presentations[0];
                const stockInPresentation = (item.stock ?? 0) / presentation.factor;
                return (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    ≈ {stockInPresentation.toFixed(1)} {presentation.name}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Valor Total - Solo para roles con permiso */}
        <SensitiveInfoGuard type="costs">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{isElaborado ? 'Costo producción' : 'Valor Total'}</div>
            <div className={`text-base font-bold ${isElaborado ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {isElaborado ? CLP(item.costoProduccion || item.ppp || 0) : CLP(totalValue)}
            </div>
            {!isElaborado && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                PPP: {CLP(item.ppp || 0)}/{item.unit}
              </div>
            )}
          </div>
        </SensitiveInfoGuard>

        {/* Ganancia — solo si tiene precio de venta cargado */}
        {!isElaborado && item.salePrice > 0 && item.ppp > 0 && (
          <SensitiveInfoGuard type="costs">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ganancia</div>
              {(() => {
                const gananciaUnit = item.salePrice - item.ppp;
                // Margen sobre precio de venta, no markup sobre costo --
                // mismo fix que VitrinaCard.jsx (ver su comentario).
                const margen = item.salePrice > 0 ? (gananciaUnit / item.salePrice) * 100 : 0;
                const gananciaTotal = gananciaUnit * (item.stock || 0);
                return (
                  <>
                    <div className={`text-base font-bold ${gananciaUnit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {CLP(gananciaTotal)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {margen.toFixed(0)}% · {CLP(gananciaUnit)}/{item.unit}
                    </div>
                  </>
                );
              })()}
            </div>
          </SensitiveInfoGuard>
        )}

        {/* Bodega */}
        <div className="col-span-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bodega</div>
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Warehouse className="w-4 h-4 text-slate-400" />
            {getWarehouseName(item.warehouseId)}
          </div>
        </div>
      </div>

      {/* Acciones - Grid de 2 columnas para evitar sobreposición */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onEdit(item)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-xs font-medium"
        >
          <Edit3 className="w-3 h-3" />
          <span>Editar</span>
        </button>
        <button
          onClick={() => onPurchase(item)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition text-xs font-medium"
        >
          <ShoppingCart className="w-3 h-3" />
          <span>Comprar</span>
        </button>
        <button
          onClick={() => onHistory(item)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-xs font-medium"
        >
          <History className="w-3 h-3" />
          <span>Historial</span>
        </button>
        <button
          onClick={() => onTransfer(item)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition text-xs font-medium"
        >
          <ArrowRightLeft className="w-3 h-3" />
          <span>Transferir</span>
        </button>
        <button
          onClick={() => onShrinkage(item)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition text-xs font-medium"
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Merma</span>
        </button>
        {/* Imprimir etiqueta — solo si tiene SKU */}
        {item.sku && onPrintLabel && (
          <button
            onClick={() => onPrintLabel(item)}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition text-xs font-medium"
            title="Imprimir etiqueta con código de barras"
          >
            <Printer className="w-3 h-3" />
            <span>Etiqueta</span>
          </button>
        )}
        <button
          onClick={() => onDelete(item)}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition text-xs font-medium"
        >
          <Trash2 className="w-3 h-3" />
          <span>Eliminar</span>
        </button>
      </div>
    </motion.div>
  );
}
