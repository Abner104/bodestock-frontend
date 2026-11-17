// src/utils/salesAnalysis.js
// Análisis de ventas para decidir QUÉ COMPRAR y QUÉ NO. Funciones puras (sin
// Firebase) para poder probarlas con datos de ejemplo.
//
// Entrada:
//  - exits: salidas de inventario ya filtradas a ventas válidas, con
//    createdAt como Date y products[{ productId, productName, quantity,
//    unitValue, totalValue, receta? }].
//  - inventory: productos [{ id, name, stock, ppp, category, unit, productType, receta }].
//
// Los productos ELABORADOS (platos con receta) NO se compran, así que no
// aparecen en el análisis: cada plato vendido se convierte en consumo de sus
// INSUMOS según la receta, y son los insumos los que se reponen.
//
// El costo NO se guarda en cada venta: se usa el PPP (precio promedio
// ponderado) ACTUAL del producto, así que el margen es una estimación.

import { convertUnit } from './unitConversions.js';
import { isElaboradoProduct } from './elaboradoStock.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const STATUS = {
  REPONER: 'REPONER',        // se acaba antes de que llegue el próximo pedido
  AGOTADO: 'AGOTADO',        // se vende y ya no hay stock
  OK: 'OK',
  SOBRESTOCK: 'SOBRESTOCK',  // stock para mucho más que el período de cobertura
  SIN_MOVIMIENTO: 'SIN_MOVIMIENTO', // hay stock y no se vendió ni se usó nada en el período
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {object} opts
 * @param {Array}  opts.exits
 * @param {Array}  opts.inventory
 * @param {number} [opts.days=30]       ventana de análisis
 * @param {number} [opts.coverDays=14]  para cuántos días quieres tener stock
 * @param {Date}   [opts.now]
 */
export function analyzeSales({ exits = [], inventory = [], days = 30, coverDays = 14, now = new Date() }) {
  const since = new Date(now.getTime() - days * DAY_MS);
  const byId = new Map();
  const inventoryById = new Map(inventory.map((i) => [i.id, i]));

  const ensure = (id, fallbackName) => {
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: fallbackName || 'Producto sin nombre',
        category: '',
        unit: 'unidades',
        stock: 0,
        ppp: 0,
        inInventory: false,
        qty: 0,          // movimiento total: vendido directo + gastado en platos
        directQty: 0,    // vendido tal cual
        consumedQty: 0,  // gastado como insumo de un plato
        revenue: 0,      // ingreso de las ventas directas
        consumedValue: 0, // costo de lo gastado en platos
        value: 0,        // revenue + consumedValue: base del ranking ABC
        tickets: 0,
        lastSale: null,
      });
    }
    return byId.get(id);
  };

  // Los elaborados se registran aparte y se sacan del resultado.
  const elaboradoIds = new Set();

  inventory.forEach((item) => {
    if (isElaboradoProduct(item)) {
      elaboradoIds.add(item.id);
      return;
    }
    const row = ensure(item.id, item.name);
    row.name = item.name || row.name;
    row.category = item.category || '';
    row.unit = item.unit || 'unidades';
    row.stock = num(item.stock);
    row.ppp = num(item.ppp);
    row.inInventory = true;
  });

  let firstSale = null;
  let totalValue = 0;
  let ticketCount = 0;

  exits.forEach((exit) => {
    const when = exit.createdAt instanceof Date ? exit.createdAt : new Date(exit.createdAt);
    if (!(when >= since) || when > now) return;
    const items = Array.isArray(exit.products) ? exit.products : [];
    if (items.length === 0) return;
    ticketCount += 1;
    if (!firstSale || when < firstSale) firstSale = when;

    items.forEach((p) => {
      const id = p.productId;
      if (!id) return;
      const qty = num(p.quantity);
      if (qty <= 0) return;

      // Receta: la del inventario actual; si el plato ya no existe, la que
      // quedó guardada en la propia venta.
      const inv = inventoryById.get(id);
      const receta = (isElaboradoProduct(inv) ? inv.receta : null) || (isElaboradoProduct(p) ? p.receta : null);

      if (Array.isArray(receta) && receta.length > 0) {
        elaboradoIds.add(id);
        receta.forEach((ing) => {
          if (!ing?.insumoId) return;
          const gastado =
            convertUnit(num(ing.cantidad), ing.unidad, ing.unidadStock || ing.unidad) * qty;
          if (gastado <= 0) return;
          const row = ensure(ing.insumoId, ing.insumoNombre);
          const costo = gastado * row.ppp;
          row.qty += gastado;
          row.consumedQty += gastado;
          row.consumedValue += costo;
          row.value += costo;
          row.tickets += 1;
          totalValue += costo;
          if (!row.lastSale || when > row.lastSale) row.lastSale = when;
        });
        return;
      }

      if (elaboradoIds.has(id)) return; // plato sin receta utilizable: no se compra
      const row = ensure(id, p.productName);
      const revenue = num(p.totalValue) || qty * num(p.unitValue);
      row.qty += qty;
      row.directQty += qty;
      row.revenue += revenue;
      row.value += revenue;
      row.tickets += 1;
      totalValue += revenue;
      if (!row.lastSale || when > row.lastSale) row.lastSale = when;
    });
  });

  // Si el negocio es nuevo, dividir por los días reales con datos y no por la
  // ventana completa; si no, la tasa diaria saldría subestimada.
  const effectiveDays = firstSale
    ? Math.max(1, Math.min(days, Math.ceil((now - firstSale) / DAY_MS)))
    : days;

  const rows = Array.from(byId.values())
    .filter((r) => !elaboradoIds.has(r.id))
    .map((r) => {
      const dailyRate = r.qty / effectiveDays;
      // El margen solo tiene sentido para lo vendido directo (los insumos
      // gastados en platos no tienen ingreso propio).
      const cost = r.ppp > 0 && r.directQty > 0 ? r.directQty * r.ppp : null;
      const margin = cost === null ? null : r.revenue - cost;
      const marginPct = margin !== null && r.revenue > 0 ? (margin / r.revenue) * 100 : null;
      const daysOfStock = dailyRate > 0 ? r.stock / dailyRate : Infinity;
      const daysSinceLastSale = r.lastSale ? Math.floor((now - r.lastSale) / DAY_MS) : null;
      const suggestedQty = dailyRate > 0 ? Math.max(0, Math.ceil(dailyRate * coverDays - r.stock)) : 0;

      let status = STATUS.OK;
      if (r.qty === 0) {
        status = r.stock > 0 ? STATUS.SIN_MOVIMIENTO : STATUS.OK;
      } else if (r.stock <= 0) {
        status = STATUS.AGOTADO;
      } else if (daysOfStock < Math.min(7, coverDays)) {
        status = STATUS.REPONER;
      } else if (daysOfStock > coverDays * 4) {
        status = STATUS.SOBRESTOCK;
      }

      return {
        ...r,
        dailyRate,
        cost,
        margin,
        marginPct,
        daysOfStock,
        daysSinceLastSale,
        suggestedQty,
        status,
        tiedUpCapital: r.stock > 0 && r.ppp > 0 ? r.stock * r.ppp : 0,
        abc: null,
        share: 0,
      };
    });

  // Clasificación ABC (Pareto) sobre los productos con movimiento, por valor
  // (ingreso si se vende directo, costo si se gasta como insumo de un plato).
  const sold = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  let acc = 0;
  sold.forEach((r) => {
    r.share = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
    // Se clasifica según el acumulado ANTES de sumar el producto: el que
    // cruza el 80% todavía cuenta como A.
    const before = totalValue > 0 ? (acc / totalValue) * 100 : 100;
    r.abc = before < 80 ? 'A' : before < 95 ? 'B' : 'C';
    acc += r.value;
  });

  const toBuy = rows
    .filter((r) => r.status === STATUS.REPONER || r.status === STATUS.AGOTADO)
    .filter((r) => r.suggestedQty > 0)
    .sort((a, b) => {
      // Agotados primero, luego los que antes se acaban; empate: más valor.
      if (a.status !== b.status) return a.status === STATUS.AGOTADO ? -1 : 1;
      if (a.daysOfStock !== b.daysOfStock) return a.daysOfStock - b.daysOfStock;
      return b.value - a.value;
    });

  const dontBuy = rows
    .filter((r) => r.status === STATUS.SIN_MOVIMIENTO || r.status === STATUS.SOBRESTOCK)
    .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

  const classA = sold.filter((r) => r.abc === 'A');

  return {
    rows,
    ranking: sold,
    toBuy,
    dontBuy,
    summary: {
      days,
      effectiveDays,
      coverDays,
      ticketCount,
      totalValue,
      productsSold: sold.length,
      classACount: classA.length,
      classAShare: classA.reduce((s, r) => s + r.share, 0),
      toBuyCount: toBuy.length,
      dontBuyCount: dontBuy.length,
      tiedUpCapital: dontBuy.reduce((s, r) => s + r.tiedUpCapital, 0),
      hasSales: sold.length > 0,
    },
  };
}
