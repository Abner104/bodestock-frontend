// src/services/workers-service.js
// Servicio para gestión de trabajadores y permisos

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  setDoc,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase/firebase.js';
import { getUserCompanyId, checkResourceLimit } from './companyService.js';
import { DEFAULT_ROLES, EXIT_REASONS } from '../config/database-schema.js';

// ======== INICIALIZACIÓN DEL SISTEMA ========

/**
 * Inicializa los roles predefinidos en Firestore
 * Se ejecuta al configurar el sistema y al actualizar roles
 */
export const initializeSystemRoles = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    console.log('🔄 Inicializando/actualizando roles del sistema para compañía:', companyId);

    // Crear/actualizar roles uno por uno en lugar de batch
    // Esto evita problemas de permisos con batch writes
    for (const [roleId, roleData] of Object.entries(DEFAULT_ROLES)) {
      try {
        const roleRef = doc(db, `companies/${companyId}/roles`, roleId);
        const roleDoc = await getDoc(roleRef);

        if (roleDoc.exists()) {
          // Actualizar rol existente
          await updateDoc(roleRef, {
            ...roleData,
            updatedAt: serverTimestamp()
          });
          console.log(`✅ Actualizado: ${roleId}`);
        } else {
          // Crear nuevo rol con setDoc
          await setDoc(roleRef, {
            ...roleData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log(`✨ Creado: ${roleId}`);
        }
      } catch (roleError) {
        console.error(`❌ Error con rol ${roleId}:`, roleError.message);
        // Continuar con el siguiente rol
      }
    }

    console.log('✅ Sincronización de roles completada');
  } catch (error) {
    console.error('❌ Error general inicializando roles:', error);
    throw error;
  }
};

/**
 * Verifica si el sistema ya fue inicializado
 */
export const isSystemInitialized = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const adminRoleRef = doc(db, `companies/${companyId}/roles`, 'ADMIN');
    const adminRoleSnap = await getDoc(adminRoleRef);
    return adminRoleSnap.exists();
  } catch (error) {
    console.error('Error verificando inicialización:', error);
    return false;
  }
};

// ======== GESTIÓN DE TRABAJADORES ========

/**
 * Crea un nuevo trabajador
 */
export const createWorker = async (workerData, createdBy) => {
  try {
    // Usar el companyId que viene en workerData (ya debería estar seteado)
    const companyId = workerData.companyId || await getUserCompanyId();

    if (!companyId || companyId === 'default') {
      throw new Error('No se pudo obtener un companyId válido. Super admins deben especificar una empresa.');
    }

    // Verificar límite de usuarios del plan
    const limitCheck = await checkResourceLimit('users');
    const isOverage = !limitCheck.allowed && limitCheck.limit !== 'unlimited';

    console.log('📝 Creando trabajador en companyId:', companyId, isOverage ? '(EXCEDENTE)' : '');

    const workerRef = await addDoc(collection(db, `companies/${companyId}/workers`), {
      ...workerData,
      isActive: true,
      isOverage: isOverage || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy
    });

    // Si es excedente, registrar en la empresa para facturación
    if (isOverage) {
      await updateDoc(doc(db, 'companies', companyId), {
        'overage.users': increment(1),
        'overage.usersCostPerMonth': 10000,
        'overage.lastUpdated': serverTimestamp()
      });
    }

    console.log('✅ Trabajador creado con ID:', workerRef.id);
    return { id: workerRef.id, isOverage };
  } catch (error) {
    console.error('Error creando trabajador:', error);
    throw error;
  }
};

/**
 * Obtiene todos los trabajadores
 */
export const getAllWorkers = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const q = query(
      collection(db, `companies/${companyId}/workers`),
      orderBy('name', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const workers = [];

    querySnapshot.forEach((doc) => {
      workers.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      });
    });

    return workers;
  } catch (error) {
    console.error('Error obteniendo trabajadores:', error);
    throw error;
  }
};

/**
 * Obtiene un trabajador por email
 */
export const getWorkerByEmail = async (email) => {
  try {
    console.log('🔍 getWorkerByEmail - Buscando:', email);

    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return null;
    }

    console.log('🔑 Firebase UID:', user.uid);

    // Obtener el companyId de los custom claims del token
    const tokenResult = await Promise.race([
      user.getIdTokenResult(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('token-timeout')), 4000))
    ]);
    const companyId = tokenResult.claims.companyId;

    console.log('🏢 CompanyId de claims:', companyId);

    if (!companyId) {
      console.log('❌ No hay companyId en custom claims - usuario legacy sin claims');
      return null;
    }

    // Buscar trabajador por firebaseUid en la empresa específica
    console.log('🔍 Buscando por firebaseUid en companyId:', companyId);

    const q = query(
      collection(db, `companies/${companyId}/workers`),
      where('firebaseUid', '==', user.uid),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);
    console.log('📊 Trabajadores encontrados por UID:', querySnapshot.size);

    if (!querySnapshot.empty) {
      const docSnapshot = querySnapshot.docs[0];
      const worker = {
        id: docSnapshot.id,
        companyId: companyId,
        ...docSnapshot.data(),
        createdAt: docSnapshot.data().createdAt?.toDate(),
        updatedAt: docSnapshot.data().updatedAt?.toDate()
      };

      console.log('✅ getWorkerByEmail - Trabajador encontrado por UID:', worker.name, worker.role);
      return worker;
    }

    // Fallback: buscar por email si no se encontró por UID
    console.log('🔍 Buscando por email en companyId:', companyId);

    const q2 = query(
      collection(db, `companies/${companyId}/workers`),
      where('email', '==', email),
      where('isActive', '==', true)
    );

    const querySnapshot2 = await getDocs(q2);
    console.log('📊 Trabajadores encontrados por email:', querySnapshot2.size);

    if (querySnapshot2.empty) {
      console.log('❌ getWorkerByEmail - No se encontró trabajador activo');
      return null;
    }

    const docSnapshot = querySnapshot2.docs[0];
    const worker = {
      id: docSnapshot.id,
      companyId: companyId,
      ...docSnapshot.data(),
      createdAt: docSnapshot.data().createdAt?.toDate(),
      updatedAt: docSnapshot.data().updatedAt?.toDate()
    };

    console.log('✅ getWorkerByEmail - Trabajador encontrado por email:', worker.name, worker.role);
    return worker;

  } catch (error) {
    console.error('Error obteniendo trabajador por email:', error);
    console.error('Error details:', error.code, error.message);
    return null; // Devolver null en lugar de throw para que se trate como admin legacy
  }
};

/**
 * Actualiza un trabajador
 */
export const updateWorker = async (workerId, updateData) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const workerRef = doc(db, `companies/${companyId}/workers`, workerId);
    await updateDoc(workerRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });

    console.log('Trabajador actualizado:', workerId);
  } catch (error) {
    console.error('Error actualizando trabajador:', error);
    throw error;
  }
};

/**
 * Desactiva un trabajador (soft delete)
 */
export const deactivateWorker = async (workerId) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const workerRef = doc(db, `companies/${companyId}/workers`, workerId);
    await updateDoc(workerRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });

    console.log('Trabajador desactivado:', workerId);
  } catch (error) {
    console.error('Error desactivando trabajador:', error);
    throw error;
  }
};

// ======== GESTIÓN DE PERMISOS ========

/**
 * Obtiene todos los roles disponibles
 */
export const getAllRoles = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const querySnapshot = await getDocs(collection(db, `companies/${companyId}/roles`));

    // Si no hay roles en Firestore, usar los roles predefinidos
    if (querySnapshot.empty) {
      console.log('📋 No hay roles en Firestore, usando DEFAULT_ROLES');
      return Object.values(DEFAULT_ROLES);
    }

    const roles = [];
    const defaultRolesArray = Object.values(DEFAULT_ROLES);

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Buscar match en DEFAULT_ROLES por: doc.id exacto, doc.id en mayúsculas, roleKey, o nombre
      const defaultRole = DEFAULT_ROLES[docSnap.id]
        || DEFAULT_ROLES[docSnap.id.toUpperCase()]
        || DEFAULT_ROLES[data.roleKey]
        || defaultRolesArray.find(r => r.name === data.name || r.id === data.roleId);

      const permissions = (data.permissions && data.permissions.length > 0)
        ? data.permissions
        : (defaultRole?.permissions || []);

      roles.push({
        id: docSnap.id,
        ...data,
        permissions
      });
    });

    return roles;
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    // Fallback a roles predefinidos si hay error
    return Object.values(DEFAULT_ROLES);
  }
};

/**
 * Verifica si un trabajador tiene un permiso específico
 */
export const hasPermission = async (workerEmail, permission) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId del usuario');
    }

    const worker = await getWorkerByEmail(workerEmail);

    if (!worker) {
      return false;
    }

    // Obtener permisos del rol
    const roleRef = doc(db, `companies/${companyId}/roles`, worker.role);
    const roleSnap = await getDoc(roleRef);

    if (!roleSnap.exists()) {
      return false;
    }

    const roleData = roleSnap.data();
    return roleData.permissions.includes(permission);
  } catch (error) {
    console.error('Error verificando permiso:', error);
    return false;
  }
};

/**
 * Verifica si un trabajador puede acceder a una bodega
 */
export const canAccessWarehouse = async (workerEmail, warehouseId) => {
  try {
    const worker = await getWorkerByEmail(workerEmail);

    if (!worker) {
      return false;
    }

    // Si tiene acceso a todas las bodegas
    if (await hasPermission(workerEmail, 'access_all_warehouses')) {
      return true;
    }

    // Verificar bodegas asignadas
    return worker.assignedWarehouses.includes(warehouseId);
  } catch (error) {
    console.error('Error verificando acceso a bodega:', error);
    return false;
  }
};

// ======== CONTROL DE LÍMITES DIARIOS ========

/**
 * Obtiene el uso del límite diario de un trabajador
 */
export const getDailyUsage = async (workerId, date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const limitId = `${workerId}-${targetDate}`;

    const limitRef = doc(db, 'daily_limits', limitId);
    const limitSnap = await getDoc(limitRef);

    if (!limitSnap.exists()) {
      return {
        workerId,
        date: targetDate,
        usedAmount: 0,
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
 * Actualiza el uso del límite diario
 */
export const updateDailyUsage = async (workerId, amount, transactionId) => {
  try {
    const targetDate = new Date().toISOString().split('T')[0];
    const limitId = `${workerId}-${targetDate}`;

    const limitRef = doc(db, 'daily_limits', limitId);
    const limitSnap = await getDoc(limitRef);

    if (!limitSnap.exists()) {
      // Crear nuevo registro
      await updateDoc(limitRef, {
        workerId,
        date: targetDate,
        usedAmount: amount,
        transactions: [transactionId],
        lastUpdated: serverTimestamp()
      });
    } else {
      // Actualizar existente
      const currentData = limitSnap.data();
      await updateDoc(limitRef, {
        usedAmount: currentData.usedAmount + amount,
        transactions: [...currentData.transactions, transactionId],
        lastUpdated: serverTimestamp()
      });
    }

    console.log('Límite diario actualizado:', limitId);
  } catch (error) {
    console.error('Error actualizando límite diario:', error);
    throw error;
  }
};

/**
 * Verifica si un trabajador puede realizar una salida
 */
export const canMakeExit = async (workerId, exitAmount) => {
  try {
    const worker = await getWorkerByEmail(workerId);

    if (!worker) {
      return { canExit: false, reason: 'Trabajador no encontrado' };
    }

    // Si tiene permisos ilimitados
    if (await hasPermission(worker.email, 'unlimited_withdrawals')) {
      return { canExit: true };
    }

    // Verificar límite diario
    if (worker.dailyLimit !== null && worker.dailyLimit > 0) {
      const dailyUsage = await getDailyUsage(worker.id);
      const newTotal = dailyUsage.usedAmount + exitAmount;

      if (newTotal > worker.dailyLimit) {
        return {
          canExit: false,
          reason: `Límite diario excedido. Disponible: $${(worker.dailyLimit - dailyUsage.usedAmount).toLocaleString()}`
        };
      }
    }

    return { canExit: true };
  } catch (error) {
    console.error('Error verificando capacidad de salida:', error);
    return { canExit: false, reason: 'Error del sistema' };
  }
};

// ======== UTILIDADES ========

/**
 * Formatea un valor en CLP
 */
export const formatCLP = (amount) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};