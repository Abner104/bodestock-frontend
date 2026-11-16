// src/services/companyService.js
// Servicio para manejar el multi-tenancy en el frontend

import React from 'react';
import { auth, db } from '../firebase/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { API_URL } from '../config/env';
import { PLAN_FEATURES } from '../config/plan-features';

// ⭐ Cache para companyId y role
let companyIdCache = null;
let roleCache = null;
let cacheUserId = null;

/**
 * Limpiar cache (útil al hacer logout)
 */
export const clearCompanyCache = () => {
  companyIdCache = null;
  roleCache = null;
  cacheUserId = null;
  console.log('🧹 Cache de companyId y role limpiado');
};

/**
 * Buscar el companyId del usuario en Firestore (fallback si no tiene custom claims)
 * @param {string} userId - UID del usuario
 * @returns {Promise<string|null>}
 */
const findCompanyIdInFirestore = async (userId) => {
  try {
    console.log('🔍 Buscando companyId en Firestore para usuario:', userId);

    // Buscar en todas las colecciones de workers
    const companiesRef = collection(db, 'companies');
    const companiesSnapshot = await getDocs(companiesRef);

    for (const companyDoc of companiesSnapshot.docs) {
      const workersRef = collection(db, `companies/${companyDoc.id}/workers`);
      const workerQuery = query(workersRef, where('firebaseUid', '==', userId), limit(1));
      const workerSnapshot = await getDocs(workerQuery);

      if (!workerSnapshot.empty) {
        console.log('✅ CompanyId encontrado en Firestore:', companyDoc.id);
        return companyDoc.id;
      }
    }

    console.warn('⚠️  No se encontró companyId en Firestore para el usuario');
    return null;
  } catch (error) {
    console.error('❌ Error buscando companyId en Firestore:', error);
    return null;
  }
};

/**
 * Obtener el companyId del usuario actual desde sus custom claims
 * Si no tiene custom claims, busca en Firestore (fallback para cuando el backend no configuró claims)
 * @returns {Promise<string|null>} - ID de la empresa o null si no está disponible
 */
export const getUserCompanyId = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.error('No hay usuario autenticado');
    return null;
  }

  // ⭐ Si tenemos cache para este usuario, devolverlo inmediatamente
  if (companyIdCache && cacheUserId === user.uid) {
    return companyIdCache;
  }

  const OFFLINE_CACHE_KEY = `bodestock_cid_${user.uid}`;

  try {
    const tokenResult = await Promise.race([
      user.getIdTokenResult(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    const companyId = tokenResult.claims.companyId;

    if (companyId) {
      companyIdCache = companyId;
      cacheUserId = user.uid;
      localStorage.setItem(OFFLINE_CACHE_KEY, companyId);
      return companyId;
    }

    // Sin claims (ej. justo después de un registro, antes de que el token propague):
    // buscar en Firestore como fallback antes de rendirse
    const firestoreCompanyId = await findCompanyIdInFirestore(user.uid);
    if (firestoreCompanyId) {
      companyIdCache = firestoreCompanyId;
      cacheUserId = user.uid;
      localStorage.setItem(OFFLINE_CACHE_KEY, firestoreCompanyId);
      return firestoreCompanyId;
    }

    // Sin claims ni match en Firestore: leer desde caché local
    const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (cached) {
      companyIdCache = cached;
      cacheUserId = user.uid;
      return cached;
    }

    return null;
  } catch {
    // Sin red o timeout: leer desde localStorage
    const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (cached) {
      companyIdCache = cached;
      cacheUserId = user.uid;
      return cached;
    }
    return null;
  }
};

/**
 * Buscar el rol del usuario en Firestore (fallback si no tiene custom claims)
 * @param {string} userId - UID del usuario
 * @param {string} companyId - ID de la empresa
 * @returns {Promise<string|null>}
 */
const findUserRoleInFirestore = async (userId, companyId) => {
  try {
    const workerDoc = await Promise.race([
      getDocs(query(collection(db, `companies/${companyId}/workers`), where('firebaseUid', '==', userId), limit(1))),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);

    if (!workerDoc.empty) {
      const role = workerDoc.docs[0].data().role;
      console.log('✅ Rol encontrado en Firestore:', role);
      return role;
    }

    console.warn('⚠️  No se encontró rol en Firestore para el usuario');
    return null;
  } catch (error) {
    console.error('❌ Error buscando rol en Firestore:', error);
    return null;
  }
};

/**
 * Obtener el rol del usuario actual desde sus custom claims
 * Si no tiene custom claims, busca en Firestore (fallback)
 * @returns {Promise<string|null>} - Rol del usuario (ADMIN, SUPERVISOR, VIEWER) o null
 */
export const getUserRole = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  // ⭐ Si tenemos cache para este usuario, devolverlo inmediatamente
  if (roleCache && cacheUserId === user.uid) {
    return roleCache;
  }

  try {
    const tokenResult = await Promise.race([
      user.getIdTokenResult(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    const claimRole = tokenResult.claims.role;
    const companyId = tokenResult.claims.companyId;

    if (claimRole) {
      roleCache = claimRole;
      cacheUserId = user.uid;
      return claimRole;
    }

    // Sin claim de rol → buscar en Firestore (workers sin claims configurados)
    if (companyId) {
      const firestoreRole = await findUserRoleInFirestore(user.uid, companyId);
      if (firestoreRole) {
        roleCache = firestoreRole;
        cacheUserId = user.uid;
        return firestoreRole;
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Verificar si el usuario es super admin
 * @returns {Promise<boolean>}
 */
export const isUserSuperAdmin = async () => {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const tokenResult = await Promise.race([
      user.getIdTokenResult(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    return tokenResult.claims.isSuperAdmin === true;
  } catch {
    return false;
  }
};

/**
 * Verificar si el usuario es admin
 * @returns {Promise<boolean>}
 */
export const isUserAdmin = async () => {
  const role = await getUserRole();
  return role === 'ADMIN';
};

/**
 * Verificar si el usuario es admin o supervisor
 * @returns {Promise<boolean>}
 */
export const canUserEdit = async () => {
  const role = await getUserRole();
  return role === 'ADMIN' || role === 'SUPERVISOR';
};

/**
 * Forzar refresh del token para obtener claims actualizados
 * Útil después de que un admin actualice los custom claims del usuario
 * @returns {Promise<void>}
 */
export const refreshUserToken = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.warn('No hay usuario para refrescar token');
    return;
  }

  try {
    await user.getIdToken(true); // Force refresh
    console.log('✅ Token actualizado correctamente');
  } catch (error) {
    console.error('❌ Error refrescando token:', error);
    throw error;
  }
};

/**
 * Obtener todos los custom claims del usuario actual
 * @returns {Promise<object|null>}
 */
export const getUserCustomClaims = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const tokenResult = await Promise.race([
      user.getIdTokenResult(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    return tokenResult.claims;
  } catch {
    return null;
  }
};

/**
 * Verificar si el usuario debe recibir alertas de email
 * @returns {Promise<boolean>}
 */
export const shouldReceiveAlerts = async () => {
  const claims = await getUserCustomClaims();
  return claims?.receiveAlerts === true;
};

/**
 * Verificar si el usuario debe recibir reportes mensuales
 * @returns {Promise<boolean>}
 */
export const shouldReceiveReports = async () => {
  const claims = await getUserCustomClaims();
  return claims?.receiveReports === true;
};

/**
 * Helper para construir rutas de Firestore con companyId
 * @param {string} collection - Nombre de la colección (inventory, warehouses, workers)
 * @returns {Promise<string>} - Ruta completa: companies/{companyId}/{collection}
 */
export const getCompanyCollectionPath = async (collection) => {
  const companyId = await getUserCompanyId();
  if (!companyId) {
    throw new Error('No se pudo obtener el companyId del usuario');
  }
  return `companies/${companyId}/${collection}`;
};

/**
 * Obtener información de la empresa del usuario
 * Requiere que el backend esté corriendo
 * @returns {Promise<object|null>}
 */
export const getCompanyInfo = async () => {
  const companyId = await getUserCompanyId();
  if (!companyId) return null;

  try {
    const response = await fetch(`${API_URL}/api/companies/${companyId}`);
    const data = await response.json();

    if (data.success) {
      return data.company;
    } else {
      console.error('Error obteniendo info de empresa:', data.error);
      return null;
    }
  } catch (error) {
    console.error('Error llamando al backend:', error);
    return null;
  }
};

/**
 * Verificar si se puede crear más recursos de un tipo
 * @param {string} resourceType - 'products', 'users', 'warehouses'
 * @returns {Promise<object>} - { allowed: boolean, limit: number|string, current: number, remaining: number }
 */
export const checkResourceLimit = async (resourceType) => {
  const companyId = await getUserCompanyId();
  if (!companyId) {
    return { allowed: false, error: 'No companyId' };
  }

  try {
    // Obtener plan de la empresa desde Firestore
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    const companyData = companyDoc.exists() ? companyDoc.data() : {};
    const companyPlan = companyData.plan || 'free';

    // Obtener config dinámica de planes
    let planData = PLAN_FEATURES[companyPlan] || PLAN_FEATURES.free;
    const planConfigDoc = await getDoc(doc(db, 'config', 'plans'));
    if (planConfigDoc.exists()) {
      const dynamicConfig = planConfigDoc.data()[companyPlan];
      if (dynamicConfig) {
        planData = { ...planData, ...dynamicConfig };
      }
    }

    // Mapear resourceType a campo de límite
    const limitFieldMap = {
      products: 'maxProducts',
      users: 'maxUsers',
      warehouses: 'maxWarehouses',
      inventories: 'maxWarehouses', // alias
    };
    const collectionMap = {
      products: null, // se cuenta por inventarios
      users: `companies/${companyId}/users`,
      warehouses: `companies/${companyId}/inventories`,
      inventories: `companies/${companyId}/inventories`,
    };

    const limitField = limitFieldMap[resourceType];
    const maxAllowed = planData[limitField];

    // Si el límite es Infinity o no está definido, siempre permitir
    if (!maxAllowed || maxAllowed === Infinity) {
      return { allowed: true, limit: maxAllowed || Infinity, current: 0, remaining: Infinity };
    }

    // Contar recursos actuales
    let current = 0;
    if (resourceType === 'products') {
      // Contar productos en todos los inventarios de la empresa
      const inventoriesSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
      let total = 0;
      await Promise.all(inventoriesSnap.docs.map(async (invDoc) => {
        const productsSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`));
        total += productsSnap.size;
      }));
      current = total;
    } else if (collectionMap[resourceType]) {
      const snap = await getDocs(collection(db, collectionMap[resourceType]));
      current = snap.size;
    }

    const allowed = current < maxAllowed;
    return {
      allowed,
      limit: maxAllowed,
      current,
      remaining: Math.max(0, maxAllowed - current),
    };
  } catch (error) {
    console.error('Error verificando límite:', error);
    // En caso de error, permitir la operación para no bloquear al usuario
    return { allowed: true, limit: null, current: null, remaining: null };
  }
};

/**
 * Hook de React para usar en componentes
 * Ejemplo de uso:
 *
 * const { companyId, role, isAdmin, loading } = useCompanyContext();
 */
export const useCompanyContext = () => {
  const [companyId, setCompanyId] = React.useState(null);
  const [role, setRole] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadUserContext = async () => {
      setLoading(true);
      const cid = await getUserCompanyId();
      const r = await getUserRole();
      setCompanyId(cid);
      setRole(r);
      setLoading(false);
    };

    loadUserContext();
  }, []);

  return {
    companyId,
    role,
    isAdmin: role === 'ADMIN',
    canEdit: role === 'ADMIN' || role === 'SUPERVISOR',
    loading
  };
};

/**
 * Determina si una empresa es "de comida" (habilita rol GARZÓN, Mesas, etc.)
 * Revisa dos fuentes, porque empresas creadas antes de que existiera el
 * registro con tipo de negocio no tienen `businessType` guardado:
 *  1. companies/{id}.businessType — lo elegido en el registro (empresas nuevas)
 *  2. companies/{id}/inventories/*.type — si algún inventario ya es de comida
 *     (empresas viejas que cambiaron el tipo de un inventario manualmente)
 * @param {string} companyId
 * @returns {Promise<boolean>}
 */
export const companyHasFoodBusiness = async (companyId) => {
  if (!companyId) return false;
  try {
    const { PRODUCTION_BUSINESS_TYPES } = await import('../config/business-types.js');

    const companySnap = await getDoc(doc(db, 'companies', companyId));
    const businessType = companySnap.exists() ? companySnap.data().businessType : null;
    if (PRODUCTION_BUSINESS_TYPES.includes(businessType)) return true;

    const inventoriesSnap = await getDocs(collection(db, `companies/${companyId}/inventories`));
    for (const invDoc of inventoriesSnap.docs) {
      const metaSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/metadata`));
      const type = invDoc.data()?.type || (!metaSnap.empty ? metaSnap.docs[0].data().type : null);
      if (PRODUCTION_BUSINESS_TYPES.includes(type)) return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Determina si una empresa es una distribuidora/mayorista (habilita "Buscar
 * clientes cerca" — prospección de minimarkets/almacenes, ver
 * TerrenoProspeccion.jsx). Solo tiene sentido para este rubro: un
 * restaurante o una inmobiliaria no salen a prospectar almacenes cercanos
 * para venderles productos.
 * @param {string} companyId
 * @returns {Promise<boolean>}
 */
export const companyIsWholesale = async (companyId) => {
  if (!companyId) return false;
  try {
    const companySnap = await getDoc(doc(db, 'companies', companyId));
    return companySnap.exists() && companySnap.data().businessType === 'WHOLESALE';
  } catch {
    return false;
  }
};

export default {
  getUserCompanyId,
  getUserRole,
  isUserSuperAdmin,
  isUserAdmin,
  canUserEdit,
  refreshUserToken,
  getUserCustomClaims,
  shouldReceiveAlerts,
  shouldReceiveReports,
  getCompanyCollectionPath,
  getCompanyInfo,
  checkResourceLimit,
  companyHasFoodBusiness,
  companyIsWholesale
};
