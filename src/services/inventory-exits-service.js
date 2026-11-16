// src/services/inventory-exits-service.js
// Servicio para gestión de salidas de inventario

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { createPermissionRequest } from './permission-requests-service.js';
import { getUserCompanyId } from './companyService.js';
import { convertUnit } from '../utils/unitConversions.js';

// La receta de un producto ELABORADO puede pedir un ingrediente en una
// unidad distinta a la que tiene el stock del insumo (ej. receta en "g",
// insumo guardado en "kg" -- ver el selector de unidad en
// ProductoElaboradoModal.jsx, que guarda unidad + unidadStock por
// separado). Sin convertir, comparar/descontar la cantidad cruda contra el
// stock real (250 vs 3) rompía tanto la validación de stock insuficiente
// como el descuento real al vender.
const cantidadRecetaEnUnidadStock = (ingrediente) =>
  convertUnit(Number(ingrediente.cantidad) || 0, ingrediente.unidad, ingrediente.unidadStock || ingrediente.unidad);

// ======== REGISTRO DE SALIDAS ========

/**
 * Registra una salida de inventario y actualiza el stock
 */
export const registerInventoryExit = async (exitData) => {
  const batch = writeBatch(db);

  try {
    console.log('Registrando salida de inventario...', exitData);

    // Obtener companyId
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    // Validar que tengamos los datos necesarios
    if (!exitData.workerId || !exitData.warehouseId || !exitData.products || exitData.products.length === 0) {
      throw new Error('Datos de salida incompletos');
    }

    // Helper para obtener la ruta correcta del producto
    const getProductRef = (productId) => {
      if (exitData.inventoryId) {
        return doc(db, `companies/${companyId}/inventories/${exitData.inventoryId}/products`, productId);
      }
      return doc(db, `companies/${companyId}/inventory`, productId);
    };

    // Separar productos simples de elaborados
    const productosSimples = [];
    const productosElaborados = [];

    for (const productExit of exitData.products) {
      const productRef = getProductRef(productExit.productId);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        const fallbackRef = exitData.inventoryId
          ? doc(db, `companies/${companyId}/inventory`, productExit.productId)
          : null;
        if (fallbackRef) {
          const fallbackSnap = await getDoc(fallbackRef);
          if (!fallbackSnap.exists()) {
            throw new Error(`Producto ${productExit.productName} no encontrado`);
          }
        } else {
          throw new Error(`Producto ${productExit.productName} no encontrado`);
        }
      }

      const productData = productSnap.data();

      console.log(`🔍 [Stock] Producto: ${productExit.productName} | tipo: ${productData.productType} | receta items: ${productData.receta?.length ?? 0} | qty: ${productExit.quantity}`);

      // Con receta cuenta como elaborado aunque productType no diga 'ELABORADO'
      // (mismo criterio que el POS en InventoryExit.jsx); si no, se descontaba el
      // stock del propio producto y los insumos quedaban intactos.
      const tieneReceta = Array.isArray(productData.receta) && productData.receta.length > 0;
      if (tieneReceta) {
        // Producto elaborado: verificar stock de cada insumo de la receta
        for (const ingrediente of productData.receta) {
          const cantidadNecesaria = cantidadRecetaEnUnidadStock(ingrediente) * productExit.quantity;
          const insumoRef = getProductRef(ingrediente.insumoId);
          const insumoSnap = await getDoc(insumoRef);

          console.log(`  🧂 Insumo: "${ingrediente.insumoNombre}" | id: ${ingrediente.insumoId} | cantidad/unidad: ${ingrediente.cantidad} | necesario: ${cantidadNecesaria} | existe: ${insumoSnap.exists()} | stock: ${insumoSnap.exists() ? insumoSnap.data().stock : 'N/A'}`);

          if (!insumoSnap.exists()) {
            throw new Error(`Insumo "${ingrediente.insumoNombre}" no encontrado en inventario`);
          }

          const stockDisponible = insumoSnap.data().stock || 0;
          if (stockDisponible < cantidadNecesaria) {
            throw new Error(
              `Stock insuficiente de "${ingrediente.insumoNombre}" para preparar "${productExit.productName}". ` +
              `Necesario: ${cantidadNecesaria} ${ingrediente.unidad}, Disponible: ${stockDisponible} ${ingrediente.unidad}`
            );
          }
        }
        productosElaborados.push({ productExit, productData });
      } else {
        // Producto simple: verificar stock normal
        const availableStock = productData.stock || 0;
        if (availableStock < productExit.quantity) {
          throw new Error(`Stock insuficiente para ${productExit.productName}. Disponible: ${availableStock}, Solicitado: ${productExit.quantity}`);
        }
        productosSimples.push({ productExit, productData });
      }
    }

    // Crear el documento de salida (eliminar undefined recursivamente para evitar error de Firestore)
    const removeUndefined = (obj) => {
      if (Array.isArray(obj)) return obj.map(removeUndefined);
      if (obj !== null && typeof obj === 'object' && !(obj.constructor?.name === 'Timestamp')) {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, removeUndefined(v)])
        );
      }
      return obj;
    };
    const cleanExitData = removeUndefined(exitData);
    const exitRef = doc(collection(db, `companies/${companyId}/inventory_exits`));
    batch.set(exitRef, {
      ...cleanExitData,
      id: exitRef.id,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Actualizar stock de productos SIMPLES
    for (const { productExit, productData } of productosSimples) {
      const productRef = getProductRef(productExit.productId);

      batch.update(productRef, {
        stock: increment(-productExit.quantity),
        updatedAt: serverTimestamp()
      });

      const currentHistory = productData?.history || [];
      const historyEntry = {
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        type: 'exit',
        quantity: -productExit.quantity,
        reason: exitData.reason,
        reasonName: exitData.reasonName,
        exitId: exitRef.id,
        workerId: exitData.workerId,
        workerName: exitData.workerName,
        notes: exitData.notes || ''
      };

      batch.update(productRef, {
        history: [...currentHistory, historyEntry]
      });
    }

    // Actualizar stock de INSUMOS de productos ELABORADOS
    for (const { productExit, productData } of productosElaborados) {
      for (const ingrediente of productData.receta) {
        const cantidadDescontar = cantidadRecetaEnUnidadStock(ingrediente) * productExit.quantity;
        const insumoRef = getProductRef(ingrediente.insumoId);
        const insumoSnap = await getDoc(insumoRef);
        const insumoData = insumoSnap.data();

        batch.update(insumoRef, {
          stock: increment(-cantidadDescontar),
          updatedAt: serverTimestamp()
        });

        // Historial en el insumo
        const currentHistory = insumoData?.history || [];
        batch.update(insumoRef, {
          history: [...currentHistory, {
            id: Date.now().toString(36) + ingrediente.insumoId,
            date: new Date().toISOString(),
            type: 'exit',
            quantity: -cantidadDescontar,
            reason: 'PRODUCTION',
            reasonName: `Elaboración: ${productExit.productName}`,
            exitId: exitRef.id,
            workerId: exitData.workerId,
            workerName: exitData.workerName,
          }]
        });
      }
    }

    // Actualizar límites diarios del trabajador
    await updateDailyUsage(exitData.workerId, exitData, companyId);

    // Ejecutar todas las operaciones
    await batch.commit();

    console.log('Salida registrada exitosamente:', exitRef.id);
    return { id: exitRef.id };

  } catch (error) {
    console.error('Error registrando salida:', error);
    throw error;
  }
};

/**
 * Actualiza el uso diario del trabajador
 */
const updateDailyUsage = async (workerId, exitData, companyId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const limitId = `${workerId}-${today}`;

    // Obtener datos del trabajador para saber su tipo de límite
    const workerRef = doc(db, `companies/${companyId}/workers`, workerId);
    const workerSnap = await getDoc(workerRef);

    if (!workerSnap.exists()) {
      console.warn('Trabajador no encontrado para actualizar límites (probablemente es super admin)');
      // Si no existe el trabajador (super admin), simplemente salir sin error
      return;
    }

    const worker = workerSnap.data();

    // Si no tiene límites, no hay nada que actualizar
    if (worker.limitType === 'NONE' || worker.role === 'ADMIN') {
      console.log('Trabajador sin límites o admin, no se actualizan límites diarios');
      return;
    }

    const limitRef = doc(db, `companies/${companyId}/daily_limits`, limitId);
    const limitSnap = await getDoc(limitRef);

    const transactionId = Date.now().toString(36);

    if (!limitSnap.exists()) {
      // Crear nuevo registro de límite diario
      const newLimitData = {
        workerId: workerId,
        workerName: exitData.workerName,
        date: today,
        limitType: worker.limitType || 'NONE',
        usedAmountMoney: worker.limitType === 'MONEY' ? exitData.totalValue : 0,
        usedAmountUnits: worker.limitType === 'UNITS' ? exitData.totalUnits : 0,
        transactions: [transactionId],
        lastUpdated: serverTimestamp()
      };

      await setDoc(limitRef, newLimitData);
      console.log('✅ Límite diario CREADO:', limitId, newLimitData);
    } else {
      // Actualizar registro existente
      const currentData = limitSnap.data();

      const updateData = {
        lastUpdated: serverTimestamp(),
        transactions: [...(currentData.transactions || []), transactionId]
      };

      if (worker.limitType === 'MONEY') {
        updateData.usedAmountMoney = (currentData.usedAmountMoney || 0) + exitData.totalValue;
      } else if (worker.limitType === 'UNITS') {
        updateData.usedAmountUnits = (currentData.usedAmountUnits || 0) + exitData.totalUnits;
      }

      await updateDoc(limitRef, updateData);
      console.log('✅ Límite diario ACTUALIZADO:', limitId, updateData);
    }

    console.log('✅ Límites diarios procesados para trabajador:', workerId);

  } catch (error) {
    console.error('Error actualizando límites diarios:', error);
    // No lanzar error aquí para no afectar el registro de la salida principal
  }
};

// ======== CONSULTAS DE SALIDAS ========

/**
 * Obtiene todas las salidas de inventario
 */
export const getAllInventoryExits = async (filters = {}) => {
  try {
    // Obtener companyId
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    let q = collection(db, `companies/${companyId}/inventory_exits`);

    // Aplicar filtros
    const constraints = [orderBy('createdAt', 'desc')];

    if (filters.workerId) {
      constraints.unshift(where('workerId', '==', filters.workerId));
    }

    if (filters.warehouseId) {
      constraints.unshift(where('warehouseId', '==', filters.warehouseId));
    }

    if (filters.reason) {
      constraints.unshift(where('reason', '==', filters.reason));
    }

    if (filters.limit) {
      constraints.push(limit(filters.limit));
    }

    q = query(q, ...constraints);

    const snapshot = await getDocs(q);
    const exits = [];

    snapshot.forEach(doc => {
      exits.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      });
    });

    return exits;

  } catch (error) {
    console.error('Error obteniendo salidas:', error);
    throw error;
  }
};

/**
 * Obtiene salidas por trabajador
 */
export const getExitsByWorker = async (workerId, limitResults = 50) => {
  try {
    console.log('🔍 Buscando salidas para trabajador:', workerId);

    // Obtener companyId
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    // Simplificar consulta para evitar problema de índice
    const q = query(
      collection(db, `companies/${companyId}/inventory_exits`),
      where('workerId', '==', workerId),
      limit(limitResults)
    );

    const snapshot = await getDocs(q);
    const exits = [];

    snapshot.forEach(doc => {
      exits.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      });
    });

    // Ordenar por fecha en JavaScript (más reciente primero)
    exits.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    console.log('✅ Encontradas', exits.length, 'salidas para el trabajador');
    return exits;

  } catch (error) {
    console.error('Error obteniendo salidas por trabajador:', error);
    throw error;
  }
};

/**
 * Obtiene salidas por bodega
 */
export const getExitsByWarehouse = async (warehouseId, limitResults = 50) => {
  try {
    // Obtener companyId
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const q = query(
      collection(db, `companies/${companyId}/inventory_exits`),
      where('warehouseId', '==', warehouseId),
      orderBy('createdAt', 'desc'),
      limit(limitResults)
    );

    const snapshot = await getDocs(q);
    const exits = [];

    snapshot.forEach(doc => {
      exits.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      });
    });

    return exits;

  } catch (error) {
    console.error('Error obteniendo salidas por bodega:', error);
    throw error;
  }
};

/**
 * Obtiene estadísticas de salidas
 */
export const getExitsStatistics = async (filters = {}) => {
  try {
    const exits = await getAllInventoryExits(filters);

    const stats = {
      totalExits: exits.length,
      totalValue: 0,
      totalUnits: 0,
      reasonBreakdown: {},
      workerBreakdown: {},
      warehouseBreakdown: {},
      dailyExits: {}
    };

    exits.forEach(exit => {
      // Totales
      stats.totalValue += exit.totalValue || 0;
      stats.totalUnits += exit.totalUnits || 0;

      // Por motivo
      const reason = exit.reason || 'OTHER';
      stats.reasonBreakdown[reason] = (stats.reasonBreakdown[reason] || 0) + 1;

      // Por trabajador
      const worker = exit.workerName || 'Desconocido';
      stats.workerBreakdown[worker] = (stats.workerBreakdown[worker] || 0) + 1;

      // Por bodega
      const warehouse = exit.warehouseName || 'Desconocida';
      stats.warehouseBreakdown[warehouse] = (stats.warehouseBreakdown[warehouse] || 0) + 1;

      // Por día
      const date = exit.createdAt?.toISOString().split('T')[0] || 'unknown';
      stats.dailyExits[date] = (stats.dailyExits[date] || 0) + 1;
    });

    return stats;

  } catch (error) {
    console.error('Error calculando estadísticas:', error);
    throw error;
  }
};

/**
 * Verifica si un trabajador puede realizar una salida
 * @param {string} workerId - ID del trabajador
 * @param {object} exitData - Datos de la salida
 * @param {boolean} createPermissionRequest - Si crear solicitud de permiso cuando exceda límites
 */
export const canWorkerMakeExit = async (workerId, exitData, createPermissionRequest = false) => {
  try {
    console.log('🔍 canWorkerMakeExit - Iniciando verificación para worker:', workerId);
    console.log('🔍 canWorkerMakeExit - Datos de salida:', exitData);

    // Obtener companyId
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    // Obtener datos del trabajador
    const workerRef = doc(db, `companies/${companyId}/workers`, workerId);
    const workerSnap = await getDoc(workerRef);

    if (!workerSnap.exists()) {
      console.log('❌ canWorkerMakeExit - Trabajador no encontrado en BD');
      return { canExit: false, reason: 'Trabajador no encontrado' };
    }

    const worker = workerSnap.data();
    console.log('🔍 canWorkerMakeExit - Datos del trabajador desde BD:', {
      id: workerId,
      name: worker.name,
      role: worker.role,
      limitType: worker.limitType,
      dailyLimitMoney: worker.dailyLimitMoney,
      dailyLimitUnits: worker.dailyLimitUnits || worker.dailyLimitProducts || 0
    });
    console.log('🔍 canWorkerMakeExit - Trabajador COMPLETO desde BD:', worker);

    // Si no tiene límites o es admin
    if (worker.limitType === 'NONE' || worker.role === 'ADMIN') {
      console.log('✅ canWorkerMakeExit - Sin límites (NONE o ADMIN) - Permitido');
      return { canExit: true };
    }

    // Obtener uso diario actual
    const today = new Date().toISOString().split('T')[0];
    const limitId = `${workerId}-${today}`;
    console.log('🔍 canWorkerMakeExit - Buscando uso diario:', limitId);

    const limitRef = doc(db, `companies/${companyId}/daily_limits`, limitId);
    const limitSnap = await getDoc(limitRef);

    const currentUsage = limitSnap.exists() ? limitSnap.data() : {
      usedAmountMoney: 0,
      usedAmountUnits: 0
    };

    console.log('🔍 canWorkerMakeExit - Uso diario actual:', currentUsage);

    // Verificar límite según tipo
    if (worker.limitType === 'MONEY') {
      console.log('💰 canWorkerMakeExit - Verificando límite MONEY');
      const newTotal = (currentUsage.usedAmountMoney || 0) + exitData.totalValue;
      const limit = worker.dailyLimitMoney || 0;
      const available = Math.max(0, limit - (currentUsage.usedAmountMoney || 0));

      console.log('💰 canWorkerMakeExit - Cálculo MONEY:', {
        usado: currentUsage.usedAmountMoney || 0,
        solicitado: exitData.totalValue,
        nuevoTotal: newTotal,
        limite: limit,
        disponible: available,
        excede: newTotal > limit
      });

      if (newTotal > limit) {
        // Crear solicitud de permiso automáticamente si está habilitado
        if (createPermissionRequest && exitData.warehouseId && exitData.warehouseName) {
          try {
            const permissionRequestId = await createPermissionRequest({
              workerId: workerId,
              workerName: worker.name,
              workerEmail: worker.email,
              warehouseId: exitData.warehouseId,
              warehouseName: exitData.warehouseName,
              limitType: 'MONEY',
              dailyLimit: limit,
              usedAmount: currentUsage.usedAmountMoney || 0,
              availableAmount: available,
              requestedAmount: exitData.totalValue,
              products: exitData.products || [],
              totalValue: exitData.totalValue,
              reason: exitData.reason,
              reasonName: exitData.reasonName,
              notes: exitData.notes || ''
            });

            return {
              canExit: false,
              reason: `Límite diario excedido. Se ha enviado una solicitud de permiso al administrador.`,
              permissionRequestId: permissionRequestId,
              requiresPermission: true
            };
          } catch (error) {
            console.error('Error creating permission request:', error);
          }
        }

        return {
          canExit: false,
          reason: `Límite diario excedido. Disponible: $${available.toLocaleString()}`
        };
      }
    } else if (worker.limitType === 'UNITS') {
      console.log('⚖️ canWorkerMakeExit - Verificando límite UNITS');
      const newTotal = (currentUsage.usedAmountUnits || 0) + exitData.totalUnits;
      const limit = worker.dailyLimitUnits || worker.dailyLimitProducts || 0;
      const available = Math.max(0, limit - (currentUsage.usedAmountUnits || 0));

      console.log('⚖️ canWorkerMakeExit - Cálculo UNITS:', {
        usado: currentUsage.usedAmountUnits || 0,
        solicitado: exitData.totalUnits,
        nuevoTotal: newTotal,
        limite: limit,
        disponible: available,
        excede: newTotal > limit
      });

      if (newTotal > limit) {
        // Crear solicitud de permiso automáticamente si está habilitado
        if (createPermissionRequest && exitData.warehouseId && exitData.warehouseName) {
          try {
            const permissionRequestId = await createPermissionRequest({
              workerId: workerId,
              workerName: worker.name,
              workerEmail: worker.email,
              warehouseId: exitData.warehouseId,
              warehouseName: exitData.warehouseName,
              limitType: 'UNITS',
              dailyLimit: limit,
              usedAmount: currentUsage.usedAmountUnits || 0,
              availableUnits: available,
              requestedUnits: exitData.totalUnits,
              products: exitData.products || [],
              totalValue: exitData.totalValue || 0,
              reason: exitData.reason,
              reasonName: exitData.reasonName,
              notes: exitData.notes || ''
            });

            return {
              canExit: false,
              reason: `Límite diario excedido. Se ha enviado una solicitud de permiso al administrador.`,
              permissionRequestId: permissionRequestId,
              requiresPermission: true
            };
          } catch (error) {
            console.error('Error creating permission request:', error);
          }
        }

        return {
          canExit: false,
          reason: `Límite diario excedido. Productos disponibles: ${available}`
        };
      }
    }

    console.log('✅ canWorkerMakeExit - Todos los límites pasaron - Permitido');
    return { canExit: true };

  } catch (error) {
    console.error('🚨 canWorkerMakeExit - Error verificando capacidad de salida:', error);
    return { canExit: false, reason: 'Error del sistema' };
  }
};

/**
 * Obtiene el uso diario actual de un trabajador
 */
export const getWorkerDailyUsage = async (workerId, date = null) => {
  try {
    // Obtener companyId
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const limitId = `${workerId}-${targetDate}`;

    const limitRef = doc(db, `companies/${companyId}/daily_limits`, limitId);
    const limitSnap = await getDoc(limitRef);

    if (!limitSnap.exists()) {
      return {
        workerId,
        date: targetDate,
        usedAmountMoney: 0,
        usedAmountUnits: 0,
        transactions: []
      };
    }

    return {
      id: limitSnap.id,
      ...limitSnap.data()
    };

  } catch (error) {
    console.error('Error obteniendo uso diario:', error);
    throw error;
  }
};

/**
 * Formatea un valor en CLP
 */
export const formatCLP = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(Number(amount) || 0));
};

// ======== ANULACIÓN DE SALIDAS ========

/**
 * Anula una salida de inventario
 * - Marca el exit como 'cancelled'
 * - Restaura el stock de los productos
 * - Revierte los límites diarios del trabajador
 * - Registra la anulación en el historial de productos
 *
 * @param {string} exitId - ID de la salida a anular
 * @param {string} cancelledBy - Email/ID del usuario que anula
 * @param {string} cancellationReason - Motivo de la anulación
 * @returns {Promise<void>}
 */

/**
 * Marca un fiado/crédito como pagado
 */
export const markCreditAsPaid = async (exitId) => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');

  const exitRef = doc(db, `companies/${companyId}/inventory_exits`, exitId);
  await updateDoc(exitRef, {
    creditStatus: 'paid',
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const annulInventoryExit = async (exitId, cancelledBy, cancellationReason = '') => {
  const batch = writeBatch(db);

  try {
    console.log('🚫 Anulando salida de inventario:', exitId);

    // Obtener companyId
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    // Obtener datos de la salida
    const exitRef = doc(db, `companies/${companyId}/inventory_exits`, exitId);
    const exitSnap = await getDoc(exitRef);

    if (!exitSnap.exists()) {
      throw new Error('Salida no encontrada');
    }

    const exitData = exitSnap.data();

    // Verificar que no esté ya anulada
    if (exitData.status === 'cancelled') {
      throw new Error('Esta salida ya fue anulada anteriormente');
    }

    // Marcar la salida como anulada
    batch.update(exitRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy: cancelledBy,
      cancellationReason: cancellationReason,
      updatedAt: serverTimestamp()
    });

    // Helper para obtener la ruta correcta del producto
    const getProductRefForAnnul = (productId) => {
      if (exitData.inventoryId) {
        return doc(db, `companies/${companyId}/inventories/${exitData.inventoryId}/products`, productId);
      }
      return doc(db, `companies/${companyId}/inventory`, productId);
    };

    // Restaurar stock de cada producto
    for (const productExit of exitData.products) {
      let productRef = getProductRefForAnnul(productExit.productId);
      let productSnap = await getDoc(productRef);

      // Fallback: si no se encuentra, intentar la otra ruta
      if (!productSnap.exists() && exitData.inventoryId) {
        productRef = doc(db, `companies/${companyId}/inventory`, productExit.productId);
        productSnap = await getDoc(productRef);
      }

      if (!productSnap.exists()) {
        console.warn(`⚠️ Producto ${productExit.productId} no encontrado, se omite restauración de stock`);
        continue;
      }

      // Incrementar stock (sumar lo que se había restado)
      batch.update(productRef, {
        stock: increment(productExit.quantity),
        updatedAt: serverTimestamp()
      });

      // Agregar entrada de anulación al historial del producto
      const currentHistory = productSnap.data()?.history || [];

      const historyEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        date: new Date().toISOString(),
        type: 'cancellation',
        quantity: productExit.quantity, // Positivo porque se restaura
        reason: 'CANCELLATION',
        reasonName: 'Anulación de venta',
        exitId: exitId,
        cancelledBy: cancelledBy,
        notes: cancellationReason || 'Venta anulada'
      };

      batch.update(productRef, {
        history: [...currentHistory, historyEntry]
      });
    }

    // Revertir límites diarios del trabajador (si aplica)
    await revertDailyUsage(exitData.workerId, exitData, companyId, batch);

    // Ejecutar todas las operaciones
    await batch.commit();

    console.log('✅ Salida anulada exitosamente:', exitId);
    return { success: true };

  } catch (error) {
    console.error('❌ Error anulando salida:', error);
    throw error;
  }
};

/**
 * Revierte el uso diario del trabajador al anular una salida
 */
const revertDailyUsage = async (workerId, exitData, companyId, batch) => {
  try {
    // Obtener la fecha de la salida original
    const exitDate = exitData.createdAt?.toDate
      ? exitData.createdAt.toDate().toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const limitId = `${workerId}-${exitDate}`;

    // Obtener datos del trabajador
    const workerRef = doc(db, `companies/${companyId}/workers`, workerId);
    const workerSnap = await getDoc(workerRef);

    if (!workerSnap.exists()) {
      console.warn('⚠️ Trabajador no encontrado (probablemente super admin), no se revierten límites');
      return;
    }

    const worker = workerSnap.data();

    // Si no tiene límites, no hay nada que revertir
    if (worker.limitType === 'NONE' || worker.role === 'ADMIN') {
      console.log('ℹ️ Trabajador sin límites o admin, no se revierten límites diarios');
      return;
    }

    const limitRef = doc(db, `companies/${companyId}/daily_limits`, limitId);
    const limitSnap = await getDoc(limitRef);

    if (!limitSnap.exists()) {
      console.warn('⚠️ No se encontró registro de límite diario para revertir');
      return;
    }

    const currentData = limitSnap.data();
    const updateData = {
      lastUpdated: serverTimestamp()
    };

    // Restar el monto usado (revertir)
    if (worker.limitType === 'MONEY') {
      const newUsed = Math.max(0, (currentData.usedAmountMoney || 0) - (exitData.totalValue || 0));
      updateData.usedAmountMoney = newUsed;
    } else if (worker.limitType === 'UNITS') {
      const newUsed = Math.max(0, (currentData.usedAmountUnits || 0) - (exitData.totalUnits || 0));
      updateData.usedAmountUnits = newUsed;
    }

    batch.update(limitRef, updateData);
    console.log('✅ Límites diarios revertidos:', limitId);

  } catch (error) {
    console.error('❌ Error revirtiendo límites diarios:', error);
    // No lanzar error, solo loguear (no queremos que falle toda la anulación por esto)
  }
};

/**
 * Anula UN producto específico de una venta existente.
 * Restaura solo el stock de ese producto y recalcula el total de la venta.
 * Si era el único producto, anula la venta completa.
 *
 * @param {string} exitId - ID de la salida
 * @param {string} productId - ID del producto a quitar
 * @param {string} cancelledBy - Email/nombre del que anula
 */
export const annulInventoryExitItem = async (exitId, productId, cancelledBy = '') => {
  const batch = writeBatch(db);

  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const exitRef = doc(db, `companies/${companyId}/inventory_exits`, exitId);
    const exitSnap = await getDoc(exitRef);
    if (!exitSnap.exists()) throw new Error('Venta no encontrada');

    const exitData = exitSnap.data();
    if (exitData.status === 'cancelled') throw new Error('Esta venta ya fue anulada');

    const targetItem = exitData.products?.find(p => p.productId === productId);
    if (!targetItem) throw new Error('Producto no encontrado en esta venta');

    // Si es el único producto → anular toda la venta
    const remainingProducts = (exitData.products || []).filter(p => p.productId !== productId);
    if (remainingProducts.length === 0) {
      return await annulInventoryExit(exitId, cancelledBy, 'Anulación del único producto de la venta');
    }

    // Calcular nuevo total
    const removedValue = targetItem.totalValue || (targetItem.salePrice || 0) * (targetItem.quantity || 1);
    const newTotal = Math.max(0, (exitData.totalValue || 0) - removedValue);

    // Actualizar la venta quitando el producto
    batch.update(exitRef, {
      products: remainingProducts,
      totalValue: newTotal,
      updatedAt: serverTimestamp(),
      partialCancellations: [
        ...(exitData.partialCancellations || []),
        {
          productId,
          productName: targetItem.productName || targetItem.name,
          quantity: targetItem.quantity,
          value: removedValue,
          cancelledBy,
          cancelledAt: new Date().toISOString(),
        }
      ]
    });

    // Restaurar stock del producto eliminado
    const getProductRef = (pid) => exitData.inventoryId
      ? doc(db, `companies/${companyId}/inventories/${exitData.inventoryId}/products`, pid)
      : doc(db, `companies/${companyId}/inventory`, pid);

    const productRef = getProductRef(productId);
    const productSnap = await getDoc(productRef);

    if (productSnap.exists()) {
      const currentHistory = productSnap.data()?.history || [];
      batch.update(productRef, {
        stock: increment(targetItem.quantity || 1),
        updatedAt: serverTimestamp(),
        history: [...currentHistory, {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          date: new Date().toISOString(),
          type: 'cancellation',
          quantity: targetItem.quantity || 1,
          reason: 'PARTIAL_CANCELLATION',
          reasonName: 'Anulación parcial de venta',
          exitId,
          cancelledBy,
        }]
      });
    }

    await batch.commit();
    console.log(`✅ Producto ${productId} eliminado de venta ${exitId}`);
    return { success: true, newTotal, remainingProducts };

  } catch (error) {
    console.error('❌ Error anulando item de venta:', error);
    throw error;
  }
};
