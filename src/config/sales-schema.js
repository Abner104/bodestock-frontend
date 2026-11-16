// src/config/sales-schema.js - Esquema de datos para ventas

export const PAYMENT_METHODS = {
  CASH: {
    id: 'CASH',
    name: 'Efectivo',
    icon: '💵'
  },
  CARD: {
    id: 'CARD',
    name: 'Tarjeta',
    icon: '💳'
  },
  TRANSFER: {
    id: 'TRANSFER',
    name: 'Transferencia',
    icon: '🏦'
  },
  OTHER: {
    id: 'OTHER',
    name: 'Otro',
    icon: '💰'
  }
};

export const SALE_STATUS = {
  COMPLETED: {
    id: 'COMPLETED',
    name: 'Completada',
    color: 'green'
  },
  PENDING: {
    id: 'PENDING',
    name: 'Pendiente',
    color: 'yellow'
  },
  CANCELLED: {
    id: 'CANCELLED',
    name: 'Cancelada',
    color: 'red'
  }
};

/**
 * Estructura de una venta en Firestore
 */
export const SaleSchema = {
  // Identificación
  id: 'string',                    // ID auto-generado
  companyId: 'string',             // ID de la empresa (multi-tenant)

  // Producto vendido
  productId: 'string',             // Referencia al producto_terminado
  productName: 'string',           // Nombre del producto

  // Cantidades y precios
  quantity: 'number',              // Cantidad vendida
  unitPrice: 'number',             // Precio unitario de venta
  totalPrice: 'number',            // Precio total (quantity * unitPrice)

  // Costos y ganancias
  unitCost: 'number',              // Costo unitario
  totalCost: 'number',             // Costo total (quantity * unitCost)
  profit: 'number',                // Ganancia (totalPrice - totalCost)
  profitMargin: 'number',          // % de margen ((profit / totalPrice) * 100)

  // Información de la venta
  saleDate: 'string',              // Fecha de venta (YYYY-MM-DD)
  paymentMethod: 'string',         // CASH, CARD, TRANSFER, OTHER
  status: 'string',                // COMPLETED, PENDING, CANCELLED

  // Usuario que registró la venta
  soldBy: 'string',                // UID del usuario
  soldByName: 'string',            // Nombre del usuario

  // Opcional
  notes: 'string',                 // Notas adicionales
  customerName: 'string',          // Nombre del cliente (opcional)

  // Metadata
  createdAt: 'timestamp',          // Timestamp de creación
  updatedAt: 'timestamp',          // Timestamp de última actualización

  // Si se desconta del inventario
  inventoryDeducted: 'boolean',    // Si se descontó del inventario
  inventoryItems: 'array'          // [{ insumoId, quantity, warehouseId }]
};

/**
 * Crear objeto de venta
 */
export function createSaleObject({
  productId,
  productName,
  quantity,
  unitPrice,
  unitCost,
  paymentMethod = 'CASH',
  soldBy,
  soldByName,
  notes = '',
  customerName = '',
  companyId = 'default'
}) {
  const totalPrice = quantity * unitPrice;
  const totalCost = quantity * unitCost;
  const profit = totalPrice - totalCost;
  const profitMargin = totalPrice > 0 ? ((profit / totalPrice) * 100) : 0;

  return {
    productId,
    productName,
    quantity: Number(quantity),
    unitPrice: Number(unitPrice),
    totalPrice: Number(totalPrice),
    unitCost: Number(unitCost),
    totalCost: Number(totalCost),
    profit: Number(profit),
    profitMargin: Number(profitMargin),
    saleDate: new Date().toISOString().split('T')[0],
    paymentMethod,
    status: 'COMPLETED',
    soldBy,
    soldByName,
    notes,
    customerName,
    companyId,
    inventoryDeducted: false,
    inventoryItems: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Validar datos de venta
 */
export function validateSale(sale) {
  const errors = [];

  if (!sale.productId) errors.push('Se requiere un producto');
  if (!sale.productName) errors.push('Se requiere el nombre del producto');
  if (!sale.quantity || sale.quantity <= 0) errors.push('La cantidad debe ser mayor a 0');
  if (!sale.unitPrice || sale.unitPrice <= 0) errors.push('El precio debe ser mayor a 0');
  if (!sale.soldBy) errors.push('Se requiere identificar quién vendió');

  return {
    valid: errors.length === 0,
    errors
  };
}
