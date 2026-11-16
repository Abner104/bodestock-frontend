// src/components/vitrina/VitrinaGrid.jsx
// Grilla simple de productos: cuadrícula normal (2-6 columnas según el ancho), SIN scroll
// horizontal ni loop infinito. Reemplaza al carrusel: con inventarios grandes (400+
// productos), el carrusel por categoría era pesado de renderizar y su scroll horizontal +
// centrado automático hacía frágil llevar al usuario a un producto específico. Acá solo
// scrollea la página hacia abajo, como cualquier grilla de tienda online — navbar, buscador
// y chips de categoría se quedan siempre fijos arriba.

import React from 'react';
import './vitrina.css';
import VitrinaCard from './VitrinaCard';

export default function VitrinaGrid({
  items = [],
  mode = 'salida',
  loading = false,
  cartQtyOf,
  canSeePrice = true,
  renderExtra,
  onAdd,
  onSetQty,
  onOpenDetail,
  onNotify,
  emptyText = 'Esta bodega está vacía',
  noResultsText = 'Sin resultados',
}) {
  if (loading) {
    return (
      <div className={`vt vt-mode-${mode}`}>
        <div className="vt-grid">
          {Array.from({ length: 10 }).map((_, k) => (
            <div className="vt-sk-card" key={k}>
              <div className="vt-sk-disc vt-shimmer" />
              <div className="vt-sk-line vt-shimmer" style={{ width: '70%' }} />
              <div className="vt-sk-line vt-shimmer" style={{ width: '45%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={`vt vt-mode-${mode}`}>
        <div className="vt-noresults">
          <h2>{noResultsText || emptyText}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`vt vt-mode-${mode}`}>
      <div className="vt-grid">
        {items.map((p) => (
          <VitrinaCard
            key={p.id}
            product={p}
            mode={mode}
            flat
            inCartQty={cartQtyOf?.(p.id) || 0}
            canSeePrice={canSeePrice}
            renderExtra={renderExtra}
            onNotify={onNotify}
            onAdd={onAdd}
            onSetQty={onSetQty}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    </div>
  );
}
