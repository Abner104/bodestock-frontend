// src/utils/elaboradoStock.js
// Un producto elaborado (plato con receta) no tiene stock propio: su stock
// siempre es 0 y lo que se puede vender depende de cuántas veces alcanza CADA
// insumo de la receta. Este helper calcula esas "porciones disponibles" para
// mostrarlas en las tarjetas de Inventario y de Salidas.

import { convertUnit } from './unitConversions.js';

export const isElaboradoProduct = (p) =>
  p?.productType === 'ELABORADO' || (Array.isArray(p?.receta) && p.receta.length > 0);

/**
 * Agrega `porcionesDisponibles` a los elaborados de `items` (sin tocar el resto).
 * @param {Array} items        productos a mostrar
 * @param {Array} sourceItems  productos donde buscar el stock de los insumos
 *                             (normalmente todo el inventario, no solo la página)
 * @returns {Array} porcionesDisponibles = número entero (>= 0) o null si no se
 *                  puede calcular (receta sin cantidades válidas)
 */
export function addPorcionesDisponibles(items = [], sourceItems = []) {
  const stockById = new Map();
  (sourceItems.length ? sourceItems : items).forEach((p) => stockById.set(p.id, Number(p.stock) || 0));

  return items.map((p) => {
    if (!isElaboradoProduct(p) || !p.receta?.length) return p;
    let porciones = Infinity;
    for (const ing of p.receta) {
      const necesario = convertUnit(Number(ing.cantidad) || 0, ing.unidad, ing.unidadStock || ing.unidad);
      if (necesario <= 0) continue;
      porciones = Math.min(porciones, Math.floor((stockById.get(ing.insumoId) ?? 0) / necesario));
    }
    return { ...p, porcionesDisponibles: Number.isFinite(porciones) ? porciones : null };
  });
}
