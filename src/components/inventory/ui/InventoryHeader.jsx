// src/components/inventory/ui/InventoryHeader.jsx
import React from 'react';
import { Package, Plus, Upload, Download, Camera, QrCode } from 'lucide-react';

export default function InventoryHeader({
  onAddProduct,
  onImport,
  onExportExcel,
  onExportQR,
  onOpenScanner,
  totalProducts = 0,
  totalValue = 0,
  CLP
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 sm:p-5 mb-4 border border-slate-200/80 dark:border-slate-700/80">
      {/* Top row: Title + Stats */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            Inventario
          </h2>
        </div>

        {/* Stats compactas */}
        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
          <div className="text-center">
            <div className="text-base sm:text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {totalProducts}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              Productos
            </div>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-700" />
          <div className="text-center">
            <div className="text-base sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {CLP ? CLP(totalValue) : `$${totalValue}`}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              Valor Total
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {/* Mobile: icon-only grid */}
      <div className="flex sm:hidden gap-2">
        <button
          onClick={onAddProduct}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
        <button
          onClick={onOpenScanner}
          className="w-11 h-11 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl transition border border-purple-200 dark:border-purple-700"
        >
          <Camera className="w-5 h-5" />
        </button>
        <button
          onClick={onImport}
          className="w-11 h-11 flex items-center justify-center bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition border border-slate-200 dark:border-slate-600"
        >
          <Upload className="w-5 h-5" />
        </button>
        <button
          onClick={onExportExcel}
          className="w-11 h-11 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl transition border border-emerald-200 dark:border-emerald-700"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={onExportQR}
          className="w-11 h-11 flex items-center justify-center bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-xl transition border border-orange-200 dark:border-orange-700"
        >
          <QrCode className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop: full buttons */}
      <div className="hidden sm:flex flex-wrap gap-2">
        <button
          onClick={onAddProduct}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-sm"
        >
          <Plus className="w-4.5 h-4.5" />
          Agregar Producto
        </button>

        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-700 rounded-xl font-semibold text-purple-700 dark:text-purple-300 transition"
          >
            <Camera className="w-4.5 h-4.5" />
            Escanear
          </button>
        )}

        <button
          onClick={onImport}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-xl font-semibold text-slate-700 dark:text-slate-200 transition"
        >
          <Upload className="w-4.5 h-4.5" />
          Importar Excel
        </button>

        <button
          onClick={onExportExcel}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 rounded-xl font-semibold text-emerald-700 dark:text-emerald-300 transition"
        >
          <Download className="w-4.5 h-4.5" />
          Exportar Excel
        </button>

        <button
          onClick={onExportQR}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-700 rounded-xl font-semibold text-orange-700 dark:text-orange-300 transition"
        >
          <QrCode className="w-4.5 h-4.5" />
          Etiquetas QR
        </button>
      </div>
    </div>
  );
}
