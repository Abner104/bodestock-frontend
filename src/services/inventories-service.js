// src/services/inventories-service.js
/**
 * Servicio para gestionar múltiples inventarios dinámicamente
 * Permite crear inventarios ilimitados (minimarket-1, distribuidora, restaurante, etc.)
 */

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId, checkResourceLimit } from './companyService';

/**
 * Crear un nuevo inventario
 * @param {Object} inventoryData - {
 *   name: string,
 *   type: 'RETAIL' | 'WHOLESALE' | 'RESTAURANT' | 'WAREHOUSE' | 'OTHER',
 *   description: string,
 *   catalogEnabled: boolean
 * }
 * @returns {Promise<string>} - ID del inventario creado
 */
export const createInventory = async (inventoryData) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Validar datos obligatorios
    if (!inventoryData.name) {
      throw new Error('El nombre del inventario es obligatorio');
    }

    // Verificar límite de inventarios del plan
    const limitCheck = await checkResourceLimit('inventories');
    if (!limitCheck.allowed) {
      throw new Error(
        `Límite alcanzado: Tu plan permite un máximo de ${limitCheck.limit} sucursal${limitCheck.limit > 1 ? 'es' : ''}. ` +
        `Actualmente tienes ${limitCheck.current}. ` +
        `Actualiza al plan Profesional ($59.990/mes) para tener hasta 2 sucursales, o al plan Personalizado para sucursales ilimitadas.`
      );
    }

    // Generar ID amigable basado en el nombre
    const inventoryId = inventoryData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9]+/g, '-') // Reemplazar espacios y símbolos por guiones
      .replace(/^-+|-+$/g, ''); // Quitar guiones al inicio/fin

    // Verificar si ya existe un inventario con ese ID
    const existingDoc = await getDoc(doc(db, `companies/${companyId}/inventories`, inventoryId));
    if (existingDoc.exists()) {
      throw new Error(`Ya existe un inventario con ese nombre. Usa un nombre diferente.`);
    }

    // Crear documento del inventario con ID personalizado
    const inventoryRef = doc(db, `companies/${companyId}/inventories`, inventoryId);

    // IMPORTANTE: Crear el documento padre primero (vacío está OK en Firestore)
    await setDoc(inventoryRef, {
      createdAt: serverTimestamp()
    });

    // Luego crear la metadata en la subcolección
    await addDoc(collection(inventoryRef, 'metadata'), {
      ...inventoryData,
      inventoryId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Si es un inventario de producción, crear bodegas por defecto
    const PRODUCTION_TYPES = ['HELADERIA', 'CAFETERIA', 'FOODTRUCK', 'PANADERIA', 'RESTAURANT'];
    if (PRODUCTION_TYPES.includes(inventoryData.type)) {
      const warehousesRef = collection(inventoryRef, 'warehouses');
      await addDoc(warehousesRef, {
        name: 'Insumos',
        description: 'Bodega de materias primas e insumos',
        createdAt: serverTimestamp()
      });
      await addDoc(warehousesRef, {
        name: 'Mostrador',
        description: 'Productos elaborados listos para vender',
        createdAt: serverTimestamp()
      });
    }

    console.log('✅ Inventario creado:', inventoryId);
    return inventoryId;
  } catch (error) {
    console.error('❌ Error creando inventario:', error);
    throw error;
  }
};

/**
 * Obtener todos los inventarios de la empresa
 * @returns {Promise<Array>} - Lista de inventarios
 */
export const getAllInventories = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
    const snapshot = await getDocs(inventoriesRef);

    // Traer la metadata de cada inventario en paralelo en vez de uno por uno —
    // con varios inventarios, el for...of secuencial se sentía lento (ej. en
    // el POS del garzón, que necesita esta lista antes de mostrar el catálogo).
    const inventories = await Promise.all(snapshot.docs.map(async (inventoryDoc) => {
      const inventoryId = inventoryDoc.id;

      const metadataRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`);
      const metadataSnapshot = await getDocs(metadataRef);

      if (!metadataSnapshot.empty) {
        const metadata = metadataSnapshot.docs[0].data();
        return {
          id: inventoryId,
          metadataId: metadataSnapshot.docs[0].id,
          ...metadata
        };
      }
      // Inventario sin metadata (legacy), usar ID como nombre
      return {
        id: inventoryId,
        name: inventoryId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'OTHER',
        description: 'Inventario sin configuración',
        catalogEnabled: false
      };
    }));

    return inventories.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('❌ Error obteniendo inventarios:', error);
    throw error;
  }
};

/**
 * Obtener un inventario por ID
 * @param {string} inventoryId - ID del inventario
 * @returns {Promise<Object|null>} - Inventario encontrado o null
 */
export const getInventoryById = async (inventoryId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Leer doc raíz del inventario (contiene type, name, etc.)
    const invDocRef = doc(db, `companies/${companyId}/inventories/${inventoryId}`);
    const invDoc = await getDoc(invDocRef);
    const invRootData = invDoc.exists() ? invDoc.data() : {};

    const metadataRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`);
    const metadataSnapshot = await getDocs(metadataRef);

    if (metadataSnapshot.empty) {
      // Retornar datos del doc raíz aunque no haya metadata
      if (invDoc.exists()) return { id: inventoryId, ...invRootData };
      return null;
    }

    return {
      id: inventoryId,
      metadataId: metadataSnapshot.docs[0].id,
      ...invRootData,
      ...metadataSnapshot.docs[0].data()
    };
  } catch (error) {
    console.error('❌ Error obteniendo inventario:', error);
    throw error;
  }
};

/**
 * Actualizar datos de un inventario
 * @param {string} inventoryId - ID del inventario
 * @param {Object} updates - Datos a actualizar
 * @returns {Promise<void>}
 */
export const updateInventory = async (inventoryId, updates) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Verificar que el inventario exista (algunos inventarios legacy no tienen
    // documento raíz en companies/{id}/inventories, solo la subcolección products)
    const inventoryRootRef = doc(db, `companies/${companyId}/inventories`, inventoryId);
    const inventoryRootSnap = await getDoc(inventoryRootRef);

    // Obtener el documento de metadata
    const metadataRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`);
    const metadataSnapshot = await getDocs(metadataRef);

    if (metadataSnapshot.empty) {
      // Inventario legacy sin metadata (creado antes de que existiera esta
      // subcolección) — se crea ahora en vez de fallar, igual que hace
      // createInventory() para uno nuevo.
      if (!inventoryRootSnap.exists()) {
        await setDoc(inventoryRootRef, { createdAt: serverTimestamp() });
      }
      await addDoc(collection(inventoryRootRef, 'metadata'), {
        name: inventoryId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'OTHER',
        description: '',
        catalogEnabled: false,
        ...updates,
        inventoryId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('✅ Inventario actualizado (metadata creada por primera vez):', inventoryId);
      return;
    }

    const metadataDocId = metadataSnapshot.docs[0].id;

    await updateDoc(
      doc(db, `companies/${companyId}/inventories/${inventoryId}/metadata`, metadataDocId),
      {
        ...updates,
        updatedAt: serverTimestamp()
      }
    );

    console.log('✅ Inventario actualizado:', inventoryId);
  } catch (error) {
    console.error('❌ Error actualizando inventario:', error);
    throw error;
  }
};

/**
 * Eliminar un inventario (solo si no tiene productos)
 * @param {string} inventoryId - ID del inventario
 * @returns {Promise<void>}
 */
export const deleteInventory = async (inventoryId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Verificar que no tenga productos
    const productsRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/products`);
    const productsSnapshot = await getDocs(productsRef);

    if (!productsSnapshot.empty) {
      throw new Error('No se puede eliminar un inventario que tiene productos. Elimina los productos primero.');
    }

    // Eliminar warehouses del inventario
    const warehousesRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/warehouses`);
    const warehousesSnapshot = await getDocs(warehousesRef);
    for (const whDoc of warehousesSnapshot.docs) {
      await deleteDoc(whDoc.ref);
    }

    // Eliminar metadata
    const metadataRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`);
    const metadataSnapshot = await getDocs(metadataRef);
    for (const metadataDoc of metadataSnapshot.docs) {
      await deleteDoc(metadataDoc.ref);
    }

    // Eliminar el documento del inventario
    await deleteDoc(doc(db, `companies/${companyId}/inventories`, inventoryId));

    console.log('✅ Inventario eliminado:', inventoryId);
  } catch (error) {
    console.error('❌ Error eliminando inventario:', error);
    throw error;
  }
};

/**
 * Obtener inventarios habilitados para catálogo público
 * @returns {Promise<Array>} - Lista de inventarios con catalogEnabled: true
 */
export const getCatalogEnabledInventories = async () => {
  try {
    const allInventories = await getAllInventories();
    return allInventories.filter(inv => inv.catalogEnabled === true);
  } catch (error) {
    console.error('❌ Error obteniendo inventarios de catálogo:', error);
    throw error;
  }
};

/**
 * Contar productos en un inventario
 * @param {string} inventoryId - ID del inventario (null para inventario legacy)
 * @returns {Promise<number>} - Número de productos
 */
export const countProductsInInventory = async (inventoryId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Si inventoryId es null, usar la estructura legacy
    const productsPath = inventoryId
      ? `companies/${companyId}/inventories/${inventoryId}/products`
      : `companies/${companyId}/inventory`;

    const productsRef = collection(db, productsPath);
    const productsSnapshot = await getDocs(productsRef);

    return productsSnapshot.size;
  } catch (error) {
    console.error('❌ Error contando productos:', error);
    return 0;
  }
};

/**
 * Cuenta productos VENDIBLES (no INSUMO, no ocultos del catálogo) de un
 * inventario -- usado para bloquear "tienda con carrito" en inventarios que
 * son puramente de insumos/materias primas (ej. un inventario "Insumos"
 * separado del "Mostrador" en una cocina), donde activar la tienda pública
 * expondría ingredientes crudos como si fueran productos a la venta.
 */
export const countSellableProductsInInventory = async (inventoryId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const productsPath = inventoryId
      ? `companies/${companyId}/inventories/${inventoryId}/products`
      : `companies/${companyId}/inventory`;

    const productsRef = collection(db, productsPath);
    const productsSnapshot = await getDocs(productsRef);

    return productsSnapshot.docs.filter(d => {
      const data = d.data();
      return data.productType !== 'INSUMO' && data.showInCatalog !== false;
    }).length;
  } catch (error) {
    console.error('❌ Error contando productos vendibles:', error);
    return 0;
  }
};

export default {
  createInventory,
  getAllInventories,
  getInventoryById,
  updateInventory,
  deleteInventory,
  getCatalogEnabledInventories,
  countProductsInInventory,
  countSellableProductsInInventory
};
