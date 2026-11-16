// src/services/inventory/inventoryService.js
/**
 * Servicio de inventario - CRUD de productos en Firestore
 * Maneja la lógica de negocio para crear, leer, actualizar y eliminar productos
 */

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, storage, auth } from '../../firebase/firebase.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getUserCompanyId, checkResourceLimit, getUserRole, isUserSuperAdmin } from '../companyService.js';
import { validateProduct } from '../../utils/inventory/inventoryValidators.js';
import { toNum } from '../../utils/inventory/inventoryHelpers.js';
import { createPresentation, convertToBaseUnit } from './presentationsService.js';

/**
 * Helper: Obtiene la ruta de la colección de inventario
 * @param {string} companyId - ID de la empresa
 * @param {string} inventoryId - ID del inventario (opcional)
 * @returns {string} - Ruta de la colección
 */
function getInventoryPath(companyId, inventoryId = null) {
  return inventoryId
    ? `companies/${companyId}/inventories/${inventoryId}/products`
    : `companies/${companyId}/inventory`;
}

/**
 * Sube hasta 4 fotos de producto a Storage y devuelve sus URLs de descarga, en orden.
 * @param {string} companyId - ID de la empresa
 * @param {File[]} files - Archivos a subir (ya validados en tamaño/tipo por la UI)
 * @param {string} [folderId] - Subcarpeta para agrupar las fotos de un mismo producto
 *   (usar el productId cuando exista; si no, un identificador temporal único)
 * @returns {Promise<string[]>} - URLs de descarga, en el mismo orden que `files`
 */
async function uploadProductPhotos(companyId, files, folderId = Date.now()) {
  const uploads = files.map(async (file) => {
    // Limpiar nombre de archivo: remover caracteres especiales y espacios
    const cleanFileName = file.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Eliminar acentos
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Reemplazar caracteres especiales con _
      .toLowerCase();

    const storageRef = ref(storage, `companies/${companyId}/products/${folderId}/${Date.now()}_${cleanFileName}`);
    const uploadResult = await uploadBytes(storageRef, file);
    return getDownloadURL(uploadResult.ref);
  });

  return Promise.all(uploads);
}

/**
 * Borra una foto de producto de Storage a partir de su URL de descarga.
 * No lanza si el archivo ya no existe (evita romper el guardado por un huérfano ya limpiado).
 * @param {string} url - URL de descarga de Firebase Storage
 */
async function deleteProductPhoto(url) {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (error) {
    console.warn('⚠️ No se pudo borrar la foto de Storage (puede que ya no exista):', error.message);
  }
}

/**
 * Servicio de inventario
 */
export const inventoryService = {
  /**
   * Crea un nuevo producto en el inventario
   *
   * @param {Object} formData - Datos del formulario del producto
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<string>} - ID del producto creado
   * @throws {Error} - Si falla la validación o la creación
   */
  async createProduct(formData, options = {}) {
    try {
      const { inventoryId = null } = options;

      // 1. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa. Por favor, cierra sesión y vuelve a entrar.');
      }

      // 2. Verificar límites del plan
      const limitCheck = await checkResourceLimit('products');
      if (!limitCheck.allowed) {
        throw new Error(
          `Límite alcanzado: Tu plan permite un máximo de ${limitCheck.limit} productos. ` +
          `Actualmente tienes ${limitCheck.current}. Actualiza tu plan para crear más productos.`
        );
      }

      // 3. Procesar datos del producto
      const processedData = await this._processProductData(formData);

      // 4. Validar datos procesados
      const validation = validateProduct(processedData);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join(', ');
        throw new Error(`Datos inválidos: ${errorMessages}`);
      }

      // 5. Subir fotos si existen (hasta 4, formData.photoFiles: File[] nuevos a subir)
      const existingPhotos = formData.photos || (formData.photoURL ? [formData.photoURL] : []);
      const newFiles = formData.photoFiles || [];
      if (newFiles.length > 0) {
        const uploadedUrls = await uploadProductPhotos(companyId, newFiles);
        processedData.photos = [...existingPhotos, ...uploadedUrls].slice(0, 4);
      } else if (existingPhotos.length > 0) {
        processedData.photos = existingPhotos;
      }

      // 6. Crear documento en Firestore
      const productData = {
        ...processedData,
        createdAt: serverTimestamp()
      };

      const inventoryPath = getInventoryPath(companyId, inventoryId);
      const docRef = await addDoc(
        collection(db, inventoryPath),
        productData
      );

      console.log(`✅ Producto creado: ${processedData.name} (ID: ${docRef.id})`);

      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating product:', error);
      throw error;
    }
  },

  /**
   * Actualiza un producto existente
   *
   * @param {string} productId - ID del producto
   * @param {Object} formData - Datos del formulario actualizados
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<void>}
   * @throws {Error} - Si falla la actualización
   */
  async updateProduct(productId, formData, options = {}) {
    try {
      const { inventoryId = null } = options;

      if (!productId) {
        throw new Error('ID de producto es requerido');
      }

      // 1. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa. Por favor, cierra sesión y vuelve a entrar.');
      }

      // 2. Preparar datos de actualización
      // formData.ppp viene como TOTAL (precio × cantidad) desde el wizard
      // Necesitamos guardar como PPP unitario (= total / stock)
      const stockValue = toNum(formData.stock);
      const pppTotal = toNum(formData.ppp);
      const pppUnitario = stockValue > 0 ? pppTotal / stockValue : pppTotal;

      const updateData = {
        name: String(formData.name).trim(),
        sku: String(formData.sku || '').trim() || null,
        category: formData.category,
        unit: formData.unit,
        description: String(formData.description || '').trim() || null,
        stock: stockValue,
        ppp: pppUnitario,
        provider: formData.provider || "",
        warehouseId: formData.warehouseId,
        updatedAt: serverTimestamp(),
      };

      // 3. Agregar campos opcionales

      // Campos de producto elaborado
      if (formData.productType) {
        updateData.productType = formData.productType;
      }
      if (formData.receta !== undefined) {
        updateData.receta = formData.receta;
      }
      if (formData.costoProduccion !== undefined) {
        updateData.costoProduccion = formData.costoProduccion;
      }
      if (formData.precioVenta !== undefined) {
        updateData.precioVenta = formData.precioVenta ? Number(formData.precioVenta) : null;
      }

      // Precio de venta real (para calcular margen real vs costo)
      if (formData.salePrice !== undefined) {
        updateData.salePrice = formData.salePrice ? Number(formData.salePrice) : null;
      }

      if (formData.customFields && Object.keys(formData.customFields).length > 0) {
        updateData.customFields = formData.customFields;
      }

      if (formData.expiryDate) {
        updateData.expiryDate = new Date(formData.expiryDate);
      } else {
        updateData.expiryDate = null;
      }

      if (formData.presentations && formData.presentations.length > 0) {
        updateData.presentations = formData.presentations;
      } else {
        updateData.presentations = [];
      }

      // Promociones por volumen
      updateData.promociones = (formData.promociones || [])
        .filter(p => p.desde > 0 && p.precioUnitario > 0)
        .map(p => ({
          id: p.id,
          desde: Number(p.desde),
          precioUnitario: Number(p.precioUnitario),
          etiqueta: p.etiqueta || '',
        }));

      // Alias de voz
      updateData.aliases = (formData.aliases || []).map(a => a.toLowerCase().trim()).filter(Boolean);

      // 4. Leer el documento previo — necesario para saber qué fotos había antes
      //    (y así poder borrar de Storage las que el usuario haya quitado) y para
      //    detectar cambios manuales de stock.
      const inventoryPath = getInventoryPath(companyId, inventoryId);
      const docRef = doc(db, inventoryPath, productId);
      const prevSnap = await getDoc(docRef);
      const prevData = prevSnap.exists() ? prevSnap.data() : {};
      const prevStock = prevData.stock ?? 0;
      const stockDiff = stockValue - prevStock;
      const prevPhotos = prevData.photos || (prevData.photoURL ? [prevData.photoURL] : []);

      // 5. Subir fotos nuevas (si hay) y componer el array final, hasta 4
      const keptPhotos = formData.photos || (formData.photoURL !== undefined ? (formData.photoURL ? [formData.photoURL] : []) : prevPhotos);
      const newFiles = formData.photoFiles || [];
      if (newFiles.length > 0) {
        const uploadedUrls = await uploadProductPhotos(companyId, newFiles, productId);
        updateData.photos = [...keptPhotos, ...uploadedUrls].slice(0, 4);
      } else {
        updateData.photos = keptPhotos;
      }

      // Borrar de Storage las fotos que estaban antes y ya no están en el resultado final
      const removedPhotos = prevPhotos.filter(url => !updateData.photos.includes(url));
      await Promise.all(removedPhotos.map(deleteProductPhoto));

      // 6. Validar datos
      const validation = validateProduct(updateData);
      if (!validation.isValid) {
        const errorMessages = Object.values(validation.errors).join(', ');
        throw new Error(`Datos inválidos: ${errorMessages}`);
      }

      // 7. Actualizar documento
      await updateDoc(docRef, updateData);

      // Registrar en historial si el stock cambió manualmente
      if (stockDiff !== 0) {
        const historyEntry = {
          type: 'manual_adjustment',
          productId,
          productName: updateData.name,
          previousStock: prevStock,
          newStock: stockValue,
          difference: stockDiff,
          adjustedBy: auth.currentUser?.email || 'desconocido',
          adjustedAt: serverTimestamp(),
          reason: formData.adjustmentReason || 'Ajuste manual de inventario',
        };
        const historyPath = inventoryId
          ? `companies/${companyId}/inventories/${inventoryId}/stock_adjustments`
          : `companies/${companyId}/stock_adjustments`;
        await addDoc(collection(db, historyPath), historyEntry);
        console.log(`📋 Ajuste de stock registrado: ${prevStock} → ${stockValue} (${stockDiff > 0 ? '+' : ''}${stockDiff})`);
      }

      console.log(`✅ Producto actualizado: ${updateData.name} (ID: ${productId})`);
    } catch (error) {
      console.error('❌ Error updating product:', error);
      throw error;
    }
  },

  /**
   * Elimina un producto del inventario
   *
   * @param {string} productId - ID del producto a eliminar
   * @param {Object} currentItem - Datos actuales del producto (para validaciones)
   * @param {Object} options - Opciones adicionales (inventoryId, etc.)
   * @returns {Promise<void>}
   * @throws {Error} - Si el usuario no tiene permisos o falla la eliminación
   */
  async deleteProduct(productId, currentItem = {}, options = {}) {
    try {
      const { inventoryId = null } = options;

      if (!productId) {
        throw new Error('ID de producto es requerido');
      }

      // 1. Verificar permisos (solo ADMIN o Super Admin)
      const userRole = await getUserRole();
      const isSuperAdmin = await isUserSuperAdmin();

      if (userRole !== 'ADMIN' && !isSuperAdmin) {
        throw new Error('Solo los administradores pueden eliminar productos del inventario');
      }

      // 2. Obtener contexto de empresa
      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo identificar la empresa');
      }

      // 3. Eliminar documento
      const inventoryPath = getInventoryPath(companyId, inventoryId);
      await deleteDoc(doc(db, inventoryPath, productId));

      console.log(`✅ Producto eliminado: ${currentItem.name || productId}`);
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      throw error;
    }
  },

  /**
   * Procesa los datos del formulario antes de guardar
   * Maneja conversiones de presentaciones, cálculo de PPP, historial inicial, etc.
   *
   * @private
   * @param {Object} formData - Datos del formulario
   * @returns {Promise<Object>} - Datos procesados listos para guardar
   */
  async _processProductData(formData) {
    let stockInicial = toNum(formData.stock);
    let presentationToSave = null;

    // CONVERSIÓN: Si definió presentación temporal, convertir y guardar
    if (formData.tempPresentationName && toNum(formData.tempPresentationFactor) > 0) {
      presentationToSave = createPresentation(
        formData.tempPresentationName,
        formData.tempPresentationFactor
      );

      const originalStock = stockInicial;
      stockInicial = convertToBaseUnit(
        stockInicial,
        presentationToSave.id,
        [presentationToSave]
      );

      console.log(
        `🔄 Conversión inicial: ${originalStock} ${presentationToSave.name} × ${presentationToSave.factor} = ${stockInicial} ${formData.unit}`
      );
    }

    // Calcular PPP (Precio Promedio Ponderado) = Valor Total / Stock (en unidad base)
    const valorTotal = toNum(formData.ppp);
    const pppCalculado = stockInicial > 0 ? valorTotal / stockInicial : valorTotal;

    // Crear registro inicial en historial si hay stock
    const historialInicial = stockInicial > 0 && valorTotal > 0 ? [{
      id: Date.now().toString(36),
      date: new Date().toISOString(),
      qty: stockInicial,
      price: pppCalculado, // Precio por unidad
      totalPrice: valorTotal, // Precio total de la compra
      ppp: pppCalculado, // PPP después de esta compra
      by: "inicial"
    }] : [];

    // Construir objeto de producto
    const productData = {
      name: String(formData.name).trim(),
      sku: String(formData.sku || '').trim() || null,
      category: formData.category,
      unit: formData.unit,
      description: String(formData.description || '').trim() || null,
      stock: stockInicial,
      ppp: pppCalculado,
      provider: formData.provider || "",
      warehouseId: formData.warehouseId,
      history: historialInicial,
    };

    // Solo agregar customFields si tiene datos
    if (formData.customFields && Object.keys(formData.customFields).length > 0) {
      productData.customFields = formData.customFields;
    }

    // Agregar fecha de vencimiento si está definida
    if (formData.expiryDate) {
      productData.expiryDate = new Date(formData.expiryDate);
    }

    // Campos de producto elaborado
    if (formData.productType) {
      productData.productType = formData.productType;
    }
    if (formData.receta) {
      productData.receta = formData.receta;
    }
    if (formData.costoProduccion !== undefined) {
      productData.costoProduccion = formData.costoProduccion;
    }
    if (formData.precioVenta !== undefined && formData.precioVenta !== '') {
      productData.precioVenta = Number(formData.precioVenta);
    }

    // Precio de venta real (para calcular margen real vs costo)
    if (formData.salePrice !== undefined && formData.salePrice !== '') {
      productData.salePrice = Number(formData.salePrice);
    }

    // Agregar presentaciones: combinar las que ya existen + la nueva (si hay)
    const finalPresentations = [...(formData.presentations || [])];
    if (presentationToSave) {
      finalPresentations.push(presentationToSave);
    }

    if (finalPresentations.length > 0) {
      productData.presentations = finalPresentations;
    }

    // Promociones por volumen
    if (formData.promociones && formData.promociones.length > 0) {
      productData.promociones = formData.promociones
        .filter(p => p.desde > 0 && p.precioUnitario > 0)
        .map(p => ({
          id: p.id,
          desde: Number(p.desde),
          precioUnitario: Number(p.precioUnitario),
          etiqueta: p.etiqueta || '',
        }));
    } else {
      productData.promociones = [];
    }

    // Alias de voz
    productData.aliases = (formData.aliases || []).map(a => a.toLowerCase().trim()).filter(Boolean);

    return productData;
  },

  /**
   * Obtiene las categorías únicas de todos los productos
   *
   * @param {Array} items - Array de productos
   * @returns {Array<string>} - Categorías únicas
   */
  getUniqueCategories(items) {
    return [...new Set(items.map(item => item.category).filter(Boolean))];
  },

  /**
   * Obtiene los proveedores únicos de todos los productos
   *
   * @param {Array} items - Array de productos
   * @returns {Array<string>} - Proveedores únicos
   */
  getUniqueProviders(items) {
    return [...new Set(items.map(item => item.provider).filter(Boolean))];
  }
};
