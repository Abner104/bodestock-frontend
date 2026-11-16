// src/components/vitrina/VitrinaCard.jsx
// Card individual de la Vitrina: disco con foto/ícono + chips + stepper + estados.
// Soporta modo 'salida' (precio venta + stock, stepper, +N al carrito) y
// modo 'inventario' (chips de valor/margen en el disco, tap abre detalle).

import React, { useRef } from 'react';
import { Package } from 'lucide-react';
import { catColor } from './catColor';

const CLP = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');

export default function VitrinaCard({
  product,
  mode = 'salida',
  inCartQty = 0, // cantidad de este producto en el carrito
  canSeePrice = true, // gate por rol (el código lo controla afuera)
  renderExtra, // (product) => ReactNode  — para el layout de elaborados
  onAdd, // (product, deltaQty) => void  — sumar N al carrito (para elaborados / +)
  onSetQty, // (product, qty) => void  — fijar la cantidad exacta en el carrito (stepper − / input a 0)
  onOpenDetail, // (product) => void  — modo inventario
  onRequestFocus, // (cardEl) => void — tocar una card no enfocada la centra en el carrusel
  onNotify, // (msg) => void — aviso corto (ej. producto agotado)
  flat = false, // true en grilla simple (VitrinaGrid): no hay concepto de "card enfocada",
                // cualquier tap agrega/abre directo.
}) {
  const cardRef = useRef(null);

  const isElaborado =
    product.productType === 'ELABORADO' ||
    (Array.isArray(product.receta) && product.receta.length > 0);
  const stock = product.stock ?? 0;
  const isOut = !isElaborado && stock <= 0;
  const ppp = product.ppp || 0;
  // precio unitario — MISMA lógica que updateProductQuantity de InventoryExit:
  // elaborado con precioVenta → ese; si hay salePrice > 0 → ese; si no → PPP (costo)
  // (se prueba también el otro campo de precio: el importador y el modal de
  // elaborados los guardan por separado)
  const venta =
    isElaborado && product.precioVenta > 0
      ? product.precioVenta
      : product.salePrice > 0
      ? product.salePrice
      : product.precioVenta > 0
      ? product.precioVenta
      : ppp;
  const sinPrecioVenta = !(product.salePrice > 0) && !(product.precioVenta > 0);
  const cat = product.category || 'Producto';
  const c = catColor(cat);

  const photos = (product.photos || []).filter(Boolean);
  const single = !photos.length && product.photoURL ? [product.photoURL] : [];
  const allPhotos = photos.length ? photos : single;

  // Elaborado: no tiene stock propio, se muestran las porciones que alcanzan
  // con los insumos (calculadas en InventoryExit.jsx → porcionesDisponibles).
  const porciones = isElaborado ? product.porcionesDisponibles : undefined;
  const stockTxt = isElaborado
    ? porciones == null
      ? 'según insumos'
      : porciones <= 0
      ? 'sin insumos'
      : `${porciones} porc.`
    : isOut
    ? 'agotado'
    : `${stock} u`;
  const stockCls = isElaborado
    ? porciones === 0
      ? 'is-out'
      : porciones != null && porciones < 5
      ? 'is-lo'
      : ''
    : isOut
    ? 'is-out'
    : stock < (product.lowStockThreshold ?? 5)
    ? 'is-lo'
    : '';

  const bump = (delta = 1) => {
    const el = cardRef.current;
    if (!el) return;
    const plus = el.querySelector('.vt-plus');
    if (plus) {
      plus.textContent = (delta >= 0 ? '+' : '') + delta;
      plus.classList.remove('is-show');
      void plus.offsetWidth;
      plus.classList.add('is-show');
    }
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  };

  const shake = () => {
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove('is-nope');
    void el.offsetWidth;
    el.classList.add('is-nope');
    el.addEventListener('animationend', () => el.classList.remove('is-nope'), { once: true });
  };

  // + / − del stepper: modifican directo la cantidad en el carrito
  const step = (dir) => {
    if (isOut && dir > 0) {
      shake();
      onNotify?.(`${product.name} · sin stock`);
      return;
    }
    if (dir > 0 && stock > 0 && inCartQty + 1 > stock) {
      shake();
      onNotify?.(`Stock insuficiente. Disponible: ${stock} ${product.unit || 'u'}`);
      return;
    }
    if (dir > 0) {
      onAdd?.(product, 1);
      bump(1);
    } else if (inCartQty > 0) {
      onSetQty?.(product, inCartQty - 1);
      bump(-1);
    }
  };

  const handleClick = (e) => {
    // clicks del stepper no cuentan (tienen su propio handler)
    if (e.target.closest('.vt-qtystep')) return;

    // producto agotado (modo salida): shake + aviso
    if (mode === 'salida' && isOut && !isElaborado) {
      onRequestFocus?.(cardRef.current);
      shake();
      onNotify?.(`${product.name} · sin stock`);
      return;
    }

    // card no enfocada: el carrusel la centra (no aplica en grilla plana)
    if (!flat && !cardRef.current?.classList.contains('is-focused')) {
      onRequestFocus?.(cardRef.current);
      return;
    }

    if (mode === 'inventario') {
      onOpenDetail?.(product);
      return;
    }
    // elaborado: abre picker (si tiene presentaciones/extras) o agrega 1
    if (isElaborado) {
      onAdd?.(product, 1);
      bump(1);
      return;
    }
    // producto simple: tocar la card enfocada = +1 (igual que el botón +)
    step(1);
  };

  // chips modo inventario (valor en bodega + margen)
  const valorBodega = stock * ppp;
  // Margen sobre PRECIO DE VENTA (estándar de retail: "de cada $100 que
  // cobro, cuánto es ganancia"), no markup sobre costo -- antes dividía por
  // ppp en vez de venta, lo que infla el número varias veces para productos
  // con buen margen (ej. venta $12.000 / ppp $1.167 daba "929%" en vez del
  // ~90% real). Mismo criterio que ProductoElaboradoModal.jsx y
  // ElaboradosGrid.jsx usan para platos.
  const margen = venta > 0 ? Math.round(((venta - ppp) / venta) * 100) : 0;

  return (
    // div en vez de <button>: la card contiene botones anidados (stepper) y HTML no lo permite
    <div
      role="button"
      tabIndex={0}
      ref={cardRef}
      className={`vt-card${isOut ? ' is-out' : ''}${flat ? ' vt-flat' : ''}`}
      style={{ '--vt-cat': c, '--vt-dot': isOut ? 'var(--vt-crit)' : stock < (product.lowStockThreshold ?? 5) ? 'var(--vt-warn)' : 'var(--vt-ok)' }}
      data-pid={product.id}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      }}
    >
      <div className="vt-disc" style={{ '--vt-cat': c }}>
        {allPhotos.length >= 1 ? (
          <div className="vt-thumb-wrap">
            <img className="vt-thumb" src={allPhotos[0]} alt={product.name} loading="lazy" />
          </div>
        ) : (
          <Package className="vt-glyph" style={{ width: '38%', height: '38%', opacity: 0.35 }} />
        )}

        {(() => {
          // stock OK → solo el puntito verde. Bajo / Agotado / Elaborado → punto + texto.
          const label = isElaborado
            ? 'Elaborado'
            : isOut
            ? 'Agotado'
            : stock < (product.lowStockThreshold ?? 5)
            ? 'Bajo'
            : null;
          return (
            <span className={`vt-stockdot${label ? '' : ' vt-stockdot-dot'}`}>
              <i />
              {label}
            </span>
          );
        })()}

        {mode === 'salida' && (
          <span className={`vt-incart${inCartQty > 0 ? ' is-show' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="vt-n">{inCartQty}</span>
          </span>
        )}
        {mode === 'salida' && <span className="vt-plus">+1</span>}

        {mode === 'inventario' && canSeePrice && (
          <>
            <span className="vt-disc-chip is-left">{CLP(valorBodega)}</span>
            <span className={`vt-disc-chip is-right ${venta - ppp >= 0 ? 'is-pos' : 'is-neg'}`}>{margen}%</span>
          </>
        )}
      </div>

      <div className="vt-meta">
        <h3>{product.name}</h3>

        {renderExtra && isElaborado ? (
          renderExtra(product)
        ) : mode === 'salida' ? (
          <>
            {canSeePrice && (
              <div className="vt-price">
                {CLP(venta)}{' '}
                <small>{sinPrecioVenta ? 'al costo' : `/ ${product.unit || 'u'}`}</small>
              </div>
            )}
            <div className="vt-facts">
              <span className={`vt-fact ${stockCls}`}>
                disponible <b>{stockTxt}</b>
              </span>
            </div>
          </>
        ) : (
          <>
            {canSeePrice && (
              <div className="vt-price">
                {CLP(valorBodega)} <small>en bodega</small>
              </div>
            )}
            <div className="vt-facts">
              <span className={`vt-fact ${stockCls}`}>{stockTxt}</span>
              {canSeePrice && (
                <span className="vt-fact">
                  PPP <b>{CLP(ppp)}</b>
                </span>
              )}
              {canSeePrice && (
                <span className={`vt-fact ${venta - ppp >= 0 ? 'is-pos' : 'is-neg'}`}>
                  margen <b>{margen}%</b>
                </span>
              )}
            </div>
          </>
        )}

        {mode === 'salida' && !isElaborado && (
          <div className="vt-qtystep" aria-label="Cantidad en el carrito">
            <button
              type="button"
              aria-label="Quitar uno"
              onClick={(e) => { e.stopPropagation(); step(-1); }}
            >
              −
            </button>
            <span className="vt-n">{inCartQty}</span>
            <button
              type="button"
              aria-label="Agregar uno"
              onClick={(e) => { e.stopPropagation(); step(1); }}
            >
              +
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
