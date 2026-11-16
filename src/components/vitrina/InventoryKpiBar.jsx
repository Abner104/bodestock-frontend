// src/components/vitrina/InventoryKpiBar.jsx
// Barra compacta de KPIs para la vista de inventario con carrusel.
// Colapsada: una tira fina con los números clave + health. Expandida: muestra InventoryStats completo.

import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './vitrina.css';
import InventoryStats from '../inventory/ui/InventoryStats';

const CLP = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

export default function InventoryKpiBar({ items = [], warehouses = [] }) {
  const [open, setOpen] = useState(false);

  const s = useMemo(() => {
    const esInsumo = (it) =>
      it.productType !== 'ELABORADO' && !(Array.isArray(it.receta) && it.receta.length > 0);
    const total = items.length;
    const stock = items.reduce((a, it) => a + (it.stock || 0), 0);
    const valor = items.reduce((a, it) => a + (it.stock || 0) * (it.ppp || 0), 0);
    const out = items.filter((it) => esInsumo(it) && (it.stock || 0) === 0).length;
    const low = items.filter(
      (it) => esInsumo(it) && (it.stock || 0) > 0 && (it.stock || 0) <= (it.lowStockThreshold ?? 5),
    ).length;
    const ok = Math.max(0, total - out - low);
    const health = total ? Math.round((ok / total) * 100) : 100;
    return { total, stock, valor, out, low, ok, health };
  }, [items]);

  const healthClass = s.health >= 80 ? 'is-g' : s.health >= 60 ? 'is-y' : 'is-r';

  return (
    <div className="vt vt-kpibar">
      <button
        type="button"
        className="vt-kpibar-strip"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vt-kpi">
          <b>{CLP(s.valor)}</b> en bodega
        </span>
        <span className="vt-kpi-sep" />
        <span className="vt-kpi">
          <b>{s.total}</b> productos
        </span>
        <span className="vt-kpi-sep" />
        <span className="vt-kpi">
          <b>{Math.round(s.stock).toLocaleString('es-CL')}</b> u en stock
        </span>
        {s.low > 0 && (
          <>
            <span className="vt-kpi-sep" />
            <span className="vt-kpi is-warn">
              <b>{s.low}</b> bajo
            </span>
          </>
        )}
        {s.out > 0 && (
          <>
            <span className="vt-kpi-sep" />
            <span className="vt-kpi is-crit">
              <b>{s.out}</b> sin stock
            </span>
          </>
        )}

        <span className={`vt-kpi-health ${healthClass}`}>
          <i />
          Salud {s.health}%
        </span>
        <ChevronDown className={`vt-kpi-chev${open ? ' is-open' : ''}`} size={16} />
      </button>

      {open && (
        <div className="vt-kpibar-detail">
          <InventoryStats items={items} warehouses={warehouses} CLP={CLP} />
        </div>
      )}
    </div>
  );
}
