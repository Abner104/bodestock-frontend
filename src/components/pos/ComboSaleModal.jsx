// src/components/pos/ComboSaleModal.jsx
import { useState, useEffect } from 'react';
import { X, ShoppingCart, Package, Loader2, Tag, Minus, Plus } from 'lucide-react';
import { getPromos } from '../../services/promos-service';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

export default function ComboSaleModal({ onClose, onAddCombo, warehouseProducts }) {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cantidades, setCantidades] = useState({});

  useEffect(() => {
    getPromos()
      .then(lista => {
        setPromos(lista);
        const init = {};
        lista.forEach(p => { init[p.id] = 1; });
        setCantidades(init);
      })
      .finally(() => setLoading(false));
  }, []);

  const getStock = (productId) => {
    const p = warehouseProducts?.find(p => p.id === productId);
    return p?.stock ?? 0;
  };

  const stockDisponible = (promo) =>
    Math.min(getStock(promo.prod1?.id), getStock(promo.prod2?.id));

  const cambiarCantidad = (id, delta) => {
    setCantidades(prev => {
      const promo = promos.find(p => p.id === id);
      const max = stockDisponible(promo);
      const next = Math.max(1, Math.min(max, (prev[id] || 1) + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleAgregar = (promo) => {
    const qty = cantidades[promo.id] || 1;
    const prod1Stock = getStock(promo.prod1?.id);
    const prod2Stock = getStock(promo.prod2?.id);

    if (qty > prod1Stock) {
      alert(`Stock insuficiente de "${promo.prod1?.name}". Disponible: ${prod1Stock}`);
      return;
    }
    if (qty > prod2Stock) {
      alert(`Stock insuficiente de "${promo.prod2?.name}". Disponible: ${prod2Stock}`);
      return;
    }

    // Precio por unidad de cada producto en el combo: mitad del precioPromo
    // El total del combo se distribuye entre los dos productos
    const precioPorProducto = Math.round(promo.precioPromo / 2);

    onAddCombo([
      {
        id: promo.prod1.id,
        name: promo.prod1.name,
        quantity: qty,
        quantityInBaseUnit: qty,
        salePrice: precioPorProducto,
        precioUnitarioAplicado: precioPorProducto,
        totalValue: precioPorProducto * qty,
        esCombo: true,
        comboNombre: promo.nombre,
      },
      {
        id: promo.prod2.id,
        name: promo.prod2.name,
        quantity: qty,
        quantityInBaseUnit: qty,
        salePrice: precioPorProducto,
        precioUnitarioAplicado: precioPorProducto,
        totalValue: precioPorProducto * qty,
        esCombo: true,
        comboNombre: promo.nombre,
      },
    ], promo.precioPromo * qty);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-zinc-900 sm:rounded-2xl rounded-t-2xl border border-white/[0.10] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-400" />
            <span className="text-[14px] font-bold text-white">Combos disponibles</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors border-none bg-transparent cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
              <p className="text-[12px] text-zinc-500">Cargando combos...</p>
            </div>
          ) : promos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Package className="w-8 h-8 text-zinc-600" />
              <p className="text-[13px] text-zinc-400 font-semibold">No hay combos activos</p>
              <p className="text-[11px] text-zinc-600">El administrador debe crear un combo<br/>desde el panel de Marketing</p>
            </div>
          ) : (
            promos.map(promo => {
              const stock = stockDisponible(promo);
              const qty = cantidades[promo.id] || 1;
              const sinStock = stock === 0;

              return (
                <div
                  key={promo.id}
                  className={`rounded-xl border p-4 ${sinStock ? 'border-white/[0.05] opacity-50' : 'border-white/[0.10] bg-white/[0.02]'}`}
                >
                  {/* Nombre y badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white leading-tight">{promo.nombre}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {promo.prod1?.name} · {promo.prod2?.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[16px] font-black text-emerald-400 tabular-nums">{CLP(promo.precioPromo)}</p>
                      <p className="text-[10px] text-zinc-500 line-through tabular-nums">{CLP(promo.precioNormal)}</p>
                    </div>
                  </div>

                  {/* Stock y cantidad */}
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-[11px] ${sinStock ? 'text-red-400' : stock <= 3 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {sinStock ? 'Sin stock' : `${stock} combos disponibles`}
                    </p>

                    {!sinStock && (
                      <div className="flex items-center gap-2">
                        {/* Selector cantidad */}
                        <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg p-0.5">
                          <button
                            onClick={() => cambiarCantidad(promo.id, -1)}
                            disabled={qty <= 1}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-none bg-transparent cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[13px] font-bold text-white tabular-nums w-6 text-center">{qty}</span>
                          <button
                            onClick={() => cambiarCantidad(promo.id, +1)}
                            disabled={qty >= stock}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-none bg-transparent cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Botón agregar */}
                        <button
                          onClick={() => handleAgregar(promo)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold transition-colors border-none cursor-pointer"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          {CLP(promo.precioPromo * qty)}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
