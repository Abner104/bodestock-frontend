// src/components/vitrina/ProductDetailSheet.jsx
// Panel de detalle de producto para el carrusel en modo inventario.
// Réplica de ProductCard.jsx (métricas + 7 acciones), como sheet/lateral.
// El stock NO se edita acá: solo cambia al crear el producto o al Comprar.

import React, { useEffect } from 'react';
import './vitrina.css';
import { catColor } from './catColor';

const iconStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const ACTIONS = [
  {
    key: 'edit',
    label: 'Editar',
    path: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z',
  },
  {
    key: 'purchase',
    label: 'Comprar',
    path: 'M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M20 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
  },
  {
    key: 'history',
    label: 'Historial',
    path: 'M3 3v5h5 M3.05 13A9 9 0 1 0 6 5.3L3 8 M12 7v5l4 2',
  },
  {
    key: 'transfer',
    label: 'Transferir',
    path: 'm16 3 4 4-4 4 M20 7H4 m8 21-4-4 4-4 M4 17h16',
  },
  {
    key: 'shrinkage',
    label: 'Merma',
    path: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z M12 9v4 M12 17h.01',
  },
  {
    key: 'label',
    label: 'Etiqueta',
    path: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
    onlyWithSku: true,
  },
  {
    key: 'delete',
    label: 'Eliminar',
    path: 'M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    danger: true,
  },
];

const CLP = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');

export default function ProductDetailSheet({
  product, // null = cerrado
  onClose,
  getWarehouseName,
  getExpiryStatus,
  onAction, // (key, product) => void
}) {
  useEffect(() => {
    if (!product) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  if (!product) return null;

  const p = product;
  const isElaborado =
    p.productType === 'ELABORADO' || (Array.isArray(p.receta) && p.receta.length > 0);
  const stock = p.stock ?? 0;
  const ppp = p.ppp || 0;
  const venta = p.salePrice || p.precioVenta || 0;
  const valorTotal = isElaborado ? p.costoProduccion || ppp : stock * ppp;
  const gUnit = venta - ppp;
  const margen = ppp > 0 ? Math.round((gUnit / ppp) * 100) : 0;
  const gTotal = gUnit * stock;
  const photo = p.photos?.[0] || p.photoURL || null;
  const expiry = getExpiryStatus?.(p.expiryDate);
  const pres = p.presentations?.[0];
  const cat = p.category || 'Producto';

  return (
    <div
      className="vt vt-pd-back is-show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="vt-pd" role="dialog" aria-label={`Detalle de ${p.name}`}>
        <div className="vt-pd-grab" onClick={onClose} />

        <div className="vt-pd-head">
          <div className="vt-pd-photo">
            {photo ? <img src={photo} alt="" /> : <span style={{ fontSize: 24 }}>📦</span>}
          </div>
          <div className="vt-pd-id">
            <div className="vt-pd-name">{p.name}</div>
            <div className="vt-pd-sku">{p.sku || p.code ? `SKU ${p.sku || p.code}` : 'sin SKU'}</div>
            <div className="vt-pd-tags">
              <span className="vt-pd-tag" style={{ '--vt-cat': catColor(cat) }}>
                {cat}
              </span>
              {expiry && expiry.status !== 'ok' && (
                <span className={`vt-pd-tag ${expiry.status === 'expired' ? 'is-expd' : 'is-exp'}`}>
                  {expiry.icon} {expiry.status === 'expired' ? `Vencido hace ${expiry.days} d` : `Vence en ${expiry.days} d`}
                </span>
              )}
              {getWarehouseName && p.warehouseId && (
                <span className="vt-pd-tag">🏬 {getWarehouseName(p.warehouseId)}</span>
              )}
            </div>
          </div>
          <button type="button" className="vt-pd-x" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" {...iconStroke} strokeWidth="2.4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="vt-pd-body">
          <div className="vt-pd-mgrid">
            <div className={`vt-pd-m${stock <= 0 && !isElaborado ? ' is-crit' : ''}`}>
              <div className="vt-pd-m-l">Stock</div>
              <div className="vt-pd-m-v">
                {isElaborado ? 'Bajo pedido' : `${stock.toLocaleString('es-CL')} ${p.unit || 'u'}`}
              </div>
              <div className="vt-pd-m-s">
                {pres && !isElaborado
                  ? `≈ ${(stock / pres.factor).toFixed(1)} ${pres.name}`
                  : `mín ${p.lowStockThreshold ?? 5} ${p.unit || 'u'}`}
              </div>
            </div>

            <div className="vt-pd-m">
              <div className="vt-pd-m-l">{isElaborado ? 'Costo producción' : 'Valor en bodega'}</div>
              <div className="vt-pd-m-v">{CLP(valorTotal)}</div>
              <div className="vt-pd-m-s">PPP {CLP(ppp)}/{p.unit || 'u'}</div>
            </div>

            {!isElaborado && venta > 0 && ppp > 0 && (
              <div className={`vt-pd-m ${gTotal >= 0 ? 'is-pos' : 'is-neg'}`}>
                <div className="vt-pd-m-l">Ganancia</div>
                <div className="vt-pd-m-v">{CLP(gTotal)}</div>
                <div className="vt-pd-m-s">{margen}% · {CLP(gUnit)}/{p.unit || 'u'}</div>
              </div>
            )}

            <div className="vt-pd-m">
              <div className="vt-pd-m-l">Precio de venta</div>
              <div className="vt-pd-m-v">{venta > 0 ? CLP(venta) : '—'}</div>
              <div className="vt-pd-m-s">costo {CLP(p.costo || ppp)}</div>
            </div>

            {p.customFields && Object.keys(p.customFields).length > 0 && (
              <div className="vt-pd-m is-wide">
                <div className="vt-pd-m-l">Detalles</div>
                <div className="vt-pd-m-v is-sm">
                  {Object.entries(p.customFields)
                    .filter(([, v]) => v)
                    .slice(0, 4)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </div>
              </div>
            )}
          </div>

          <div className="vt-pd-acts">
            {ACTIONS.filter((a) => !a.onlyWithSku || p.sku || p.code).map((a) => (
              <button
                key={a.key}
                type="button"
                className={`vt-pd-act is-${a.key}${a.danger ? ' is-danger' : ''}`}
                onClick={() => onAction?.(a.key, p)}
              >
                <svg viewBox="0 0 24 24" {...iconStroke}>
                  <path d={a.path} />
                </svg>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
