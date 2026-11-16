// src/services/customers-service.js
/**
 * Servicio para gestionar clientes recurrentes (para facturación electrónica)
 */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from './companyService';

/**
 * Crear un nuevo cliente
 * @param {Object} customerData - { rut, razonSocial, giro, direccion, comuna }
 * @returns {Promise<string>} - ID del cliente creado
 */
export const createCustomer = async (customerData) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    // Validar datos obligatorios
    if (!customerData.rut || !customerData.razonSocial) {
      throw new Error('RUT y Razón Social son obligatorios');
    }

    // Normalizar RUT: siempre guardar con formato X.XXX.XXX-X
    const rawRut = customerData.rut.replace(/\./g, '').replace(/-/g, '');
    if (rawRut.length >= 7) {
      const dv = rawRut.slice(-1);
      const num = rawRut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      customerData = { ...customerData, rut: `${num}-${dv}` };
    }

    // Verificar si ya existe un cliente con el mismo RUT
    const existingCustomer = await getCustomerByRut(customerData.rut);
    if (existingCustomer) {
      throw new Error('Ya existe un cliente con este RUT. Usa la función de editar.');
    }

    const docRef = await addDoc(
      collection(db, `companies/${companyId}/customers`),
      {
        ...customerData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    console.log('✅ Cliente creado:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creando cliente:', error);
    throw error;
  }
};

/**
 * Obtener todos los clientes de la empresa
 * @returns {Promise<Array>} - Lista de clientes
 */
export const getAllCustomers = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const q = query(
      collection(db, `companies/${companyId}/customers`),
      orderBy('razonSocial', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Error obteniendo clientes:', error);
    throw error;
  }
};

/**
 * Buscar cliente por RUT (retorna el primero si hay varios con mismo RUT)
 * @param {string} rut - RUT del cliente
 * @returns {Promise<Object|null>} - Cliente encontrado o null
 */
export const getCustomerByRut = async (rut) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const q = query(
      collection(db, `companies/${companyId}/customers`),
      where('rut', '==', rut)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
  } catch (error) {
    console.error('❌ Error buscando cliente por RUT:', error);
    throw error;
  }
};

/**
 * Buscar todos los clientes con un RUT dado (puede haber varios con distinto giro)
 * @param {string} rut - RUT del cliente
 * @returns {Promise<Array>} - Lista de clientes con ese RUT
 */
export const getCustomersByRut = async (rut) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const q = query(
      collection(db, `companies/${companyId}/customers`),
      where('rut', '==', rut)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('❌ Error buscando clientes por RUT:', error);
    throw error;
  }
};

/**
 * Buscar cliente por RUT + Razón Social exactos
 * @param {string} rut
 * @param {string} razonSocial
 * @returns {Promise<Object|null>}
 */
export const getCustomerByRutAndRazonSocial = async (rut, razonSocial) => {
  try {
    const customers = await getCustomersByRut(rut);
    const match = customers.find(
      c => c.razonSocial?.trim().toLowerCase() === razonSocial?.trim().toLowerCase()
    );
    return match || null;
  } catch (error) {
    console.error('❌ Error buscando cliente por RUT+RazonSocial:', error);
    throw error;
  }
};

/**
 * Buscar clientes por texto (RUT o Razón Social)
 * @param {string} searchText - Texto a buscar
 * @returns {Promise<Array>} - Clientes que coinciden
 */
export const searchCustomers = async (searchText) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const allCustomers = await getAllCustomers();

    // Filtrar localmente (Firestore no soporta búsqueda por texto completo)
    const searchLower = searchText.toLowerCase();
    return allCustomers.filter(customer =>
      customer.rut.toLowerCase().includes(searchLower) ||
      customer.razonSocial.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error('❌ Error buscando clientes:', error);
    throw error;
  }
};

/**
 * Actualizar datos de un cliente
 * @param {string} customerId - ID del cliente
 * @param {Object} updates - Datos a actualizar
 * @returns {Promise<void>}
 */
export const updateCustomer = async (customerId, updates) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    await updateDoc(
      doc(db, `companies/${companyId}/customers`, customerId),
      {
        ...updates,
        updatedAt: serverTimestamp()
      }
    );

    console.log('✅ Cliente actualizado:', customerId);
  } catch (error) {
    console.error('❌ Error actualizando cliente:', error);
    throw error;
  }
};

/**
 * Eliminar un cliente
 * @param {string} customerId - ID del cliente
 * @returns {Promise<void>}
 */
export const deleteCustomer = async (customerId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    await deleteDoc(doc(db, `companies/${companyId}/customers`, customerId));
    console.log('✅ Cliente eliminado:', customerId);
  } catch (error) {
    console.error('❌ Error eliminando cliente:', error);
    throw error;
  }
};

/**
 * Guardar o actualizar cliente desde datos de emisión
 * (Guarda automáticamente el cliente cuando emites un documento)
 * @param {Object} customerData - Datos del cliente
 * @returns {Promise<string>} - ID del cliente (creado o actualizado)
 */
export const saveOrUpdateFromEmission = async (customerData) => {
  try {
    // Buscar por RUT + Razón Social para no mezclar distintos giros del mismo RUT
    const existing = await getCustomerByRutAndRazonSocial(customerData.rut, customerData.razonSocial);

    if (existing) {
      await updateCustomer(existing.id, customerData);
      return existing.id;
    } else {
      return await createCustomer(customerData);
    }
  } catch (error) {
    console.error('❌ Error guardando cliente desde emisión:', error);
    throw error;
  }
};

/**
 * Buscar todos los clientes con un RUT dado (versión pública, sin autenticación)
 * Para uso en catálogo público — puede haber varios con mismo RUT pero distinto giro
 * @param {string} companyId
 * @param {string} rut
 * @returns {Promise<Array>} - Lista de clientes con ese RUT
 */
export const getCustomersByRutPublic = async (companyId, rut) => {
  try {
    if (!companyId || !rut) return [];

    const q = query(
      collection(db, `companies/${companyId}/customers`),
      where('rut', '==', rut)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nombre: data.nombre || data.razonSocial || '',
        email: data.email || '',
        telefono: data.telefono || '',
        rut: data.rut,
        direccion: data.direccion || '',
        comuna: data.comuna || '',
        razonSocial: data.razonSocial || '',
        giro: data.giro || '',
        direcciones: data.direcciones || null,
      };
    });
  } catch (error) {
    console.error('Error buscando clientes públicos por RUT:', error);
    return [];
  }
};

/**
 * Buscar cliente por RUT (versión pública, sin autenticación)
 * Retorna el primero si hay varios — usar getCustomersByRutPublic para manejar múltiples
 * @param {string} companyId
 * @param {string} rut
 * @returns {Promise<Object|null>}
 */
export const getCustomerByRutPublic = async (companyId, rut) => {
  const list = await getCustomersByRutPublic(companyId, rut);
  return list.length > 0 ? list[0] : null;
};

/**
 * Guardar referencia de documento emitido en el cliente
 * @param {string} customerRut - RUT del cliente
 * @param {Object} documentoData - { tipoDTE, folio, fecha, total, exitId }
 */
export const saveDocumentoToCustomer = async (customerRut, documentoData) => {
  try {
    const customer = await getCustomerByRut(customerRut);
    if (!customer) return;

    const companyId = await getUserCompanyId();
    if (!companyId) return;

    await updateDoc(
      doc(db, `companies/${companyId}/customers`, customer.id),
      {
        documentos: arrayUnion({
          ...documentoData,
          emitidoAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      }
    );
    console.log('✅ Documento guardado en cliente:', customerRut, documentoData.folio);
  } catch (error) {
    console.error('⚠️ Error guardando documento en cliente:', error);
  }
};

/**
 * Marcar un documento del cliente con Nota de Crédito emitida
 * Actualiza el documento original en el array 'documentos' agregando ncEmitida y ncFolio
 * @param {string} customerRut - RUT del cliente
 * @param {number} folioOriginal - Folio del documento original
 * @param {number} tipoDTEOriginal - Tipo DTE del documento original (33 o 39)
 * @param {Object} ncData - { folio, fecha }
 */
export const markDocumentoWithNC = async (customerRut, folioOriginal, tipoDTEOriginal, ncData) => {
  try {
    const customer = await getCustomerByRut(customerRut);
    if (!customer) throw new Error('Cliente no encontrado');

    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    const customerRef = doc(db, `companies/${companyId}/customers`, customer.id);
    const customerDoc = await getDoc(customerRef);
    const data = customerDoc.data();
    const documentos = data.documentos || [];

    // Actualizar el documento original marcándolo con NC
    let found = false;
    const updatedDocumentos = documentos.map(d => {
      if (d.folio === folioOriginal && d.tipoDTE === tipoDTEOriginal) {
        found = true;
        return {
          ...d,
          ncEmitida: true,
          ncFolio: ncData.folio,
          ncFecha: ncData.fecha
        };
      }
      return d;
    });

    // Si el documento vino de inventory_exits y no está en el array del cliente,
    // lo agregamos directamente con ncEmitida para que persista en Firestore
    if (!found) {
      updatedDocumentos.push({
        tipoDTE: tipoDTEOriginal,
        folio: folioOriginal,
        total: ncData.total || 0,
        emitidoAt: ncData.fechaOriginal || new Date().toISOString(),
        ncEmitida: true,
        ncFolio: ncData.folio,
        ncFecha: ncData.fecha,
      });
      console.warn('⚠️ Documento no estaba en array del cliente — se agregó con ncEmitida:', folioOriginal);
    }

    await updateDoc(customerRef, {
      documentos: updatedDocumentos,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Documento marcado con NC:', folioOriginal, '→ NC Folio:', ncData.folio);
  } catch (error) {
    console.error('❌ Error marcando documento con NC:', error);
    throw error;
  }
};

/**
 * Agregar Nota de Crédito como nuevo documento del cliente
 * @param {string} customerRut - RUT del cliente
 * @param {Object} ncDoc - { tipoDTE: 61, folio, fecha, total, folioRef, tipoDTERef }
 */
export const addNotaCreditoToCustomer = async (customerRut, ncDoc) => {
  try {
    const customer = await getCustomerByRut(customerRut);
    if (!customer) throw new Error('Cliente no encontrado');

    const companyId = await getUserCompanyId();
    if (!companyId) throw new Error('No se pudo obtener el companyId');

    await updateDoc(
      doc(db, `companies/${companyId}/customers`, customer.id),
      {
        documentos: arrayUnion({
          ...ncDoc,
          tipoDTE: 61,
          emitidoAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      }
    );

    console.log('✅ Nota de Crédito agregada al cliente:', customerRut, 'Folio:', ncDoc.folio);
  } catch (error) {
    console.error('❌ Error agregando NC al cliente:', error);
    throw error;
  }
};

export default {
  createCustomer,
  getAllCustomers,
  getCustomerByRut,
  getCustomerByRutPublic,
  searchCustomers,
  updateCustomer,
  deleteCustomer,
  saveOrUpdateFromEmission,
  saveDocumentoToCustomer,
  markDocumentoWithNC,
  addNotaCreditoToCustomer
};
