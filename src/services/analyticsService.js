// src/services/analyticsService.js
/**
 * Analytics Service - Rastreo de uso real del SaaS
 * Proporciona métricas de actividad por empresa
 */

import { db } from '../firebase/firebase';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import logger from '../utils/logger';

/**
 * Obtiene analytics completos de una empresa
 * @param {string} companyId - ID de la empresa
 * @returns {Promise<Object>} Objeto con todas las métricas de uso
 */
export const getCompanyAnalytics = async (companyId) => {
  try {
    logger.info(`📊 Obteniendo analytics para empresa: ${companyId}`);

    const [
      productsCount,
      inventoryMovements,
      workersCount,
      categoriesCount,
      inventoriesCount,
      recentActivity,
      weeklyActivity,
      aiUsage
    ] = await Promise.all([
      getProductsCount(companyId),
      getInventoryMovements(companyId),
      getWorkersCount(companyId),
      getCategoriesCount(companyId),
      getInventoriesCount(companyId),
      getRecentActivity(companyId),
      getWeeklyActivity(companyId),
      getAIUsage(companyId)
    ]);

    const engagementScore = calculateEngagementScore({
      productsCount,
      inventoryMovements,
      workersCount,
      recentActivity
    });

    return {
      companyId,
      metrics: {
        productsCount,
        inventoryMovements,
        workersCount,
        categoriesCount,
        inventoriesCount,
        aiUsage
      },
      activity: {
        recent: recentActivity,
        weekly: weeklyActivity
      },
      engagementScore,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    logger.error('❌ Error obteniendo analytics de empresa:', error);
    throw error;
  }
};

/**
 * Obtiene analytics de todas las empresas activas
 * @returns {Promise<Array>} Array de analytics por empresa
 */
export const getAllCompaniesAnalytics = async () => {
  try {
    logger.info('📊 Obteniendo analytics de todas las empresas');

    // Obtener todas las empresas
    const companiesRef = collection(db, 'companies');
    const companiesSnapshot = await getDocs(companiesRef);

    const analyticsPromises = companiesSnapshot.docs.map(async (doc) => {
      const companyData = doc.data();
      const analytics = await getCompanyAnalytics(doc.id);

      return {
        ...analytics,
        companyName: companyData.name || 'Sin nombre',
        status: companyData.status || 'active',
        plan: companyData.plan || 'free'
      };
    });

    const allAnalytics = await Promise.all(analyticsPromises);

    // Ordenar por engagement score
    return allAnalytics.sort((a, b) => b.engagementScore - a.engagementScore);
  } catch (error) {
    logger.error('❌ Error obteniendo analytics de todas las empresas:', error);
    throw error;
  }
};

/**
 * Cuenta productos de una empresa (suma todos los inventarios)
 */
const getProductsCount = async (companyId) => {
  try {
    // Los productos están en companies/{companyId}/inventories/{inventoryId}/products
    const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
    const inventoriesSnap = await getDocs(inventoriesRef);

    let total = 0;
    await Promise.all(inventoriesSnap.docs.map(async (invDoc) => {
      const productsRef = collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`);
      const productsSnap = await getDocs(productsRef);
      total += productsSnap.size;
    }));

    return total;
  } catch (error) {
    return 0;
  }
};

/**
 * Cuenta movimientos de inventario (salidas)
 */
const getInventoryMovements = async (companyId) => {
  try {
    const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
    const snapshot = await getDocs(exitsRef);
    return snapshot.size;
  } catch (error) {
    // Silenciar error si no hay permisos (empresa sin movimientos aún)
    return 0;
  }
};

/**
 * Cuenta trabajadores de una empresa
 */
const getWorkersCount = async (companyId) => {
  try {
    const workersRef = collection(db, `companies/${companyId}/workers`);
    const snapshot = await getDocs(workersRef);
    return snapshot.size;
  } catch (error) {
    // Silenciar error si no hay permisos
    return 0;
  }
};

/**
 * Cuenta categorías únicas de una empresa (en todos sus inventarios)
 */
const getCategoriesCount = async (companyId) => {
  try {
    const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
    const inventoriesSnap = await getDocs(inventoriesRef);

    const categories = new Set();
    await Promise.all(inventoriesSnap.docs.map(async (invDoc) => {
      const productsRef = collection(db, `companies/${companyId}/inventories/${invDoc.id}/products`);
      const productsSnap = await getDocs(productsRef);
      productsSnap.docs.forEach(doc => {
        const category = doc.data().category;
        if (category) categories.add(category);
      });
    }));

    return categories.size;
  } catch (error) {
    return 0;
  }
};

/**
 * Cuenta inventarios de una empresa
 */
const getInventoriesCount = async (companyId) => {
  try {
    const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
    const snapshot = await getDocs(inventoriesRef);
    return snapshot.size;
  } catch (error) {
    return 0;
  }
};

/**
 * Obtiene actividad reciente (últimas 10 acciones)
 */
const getRecentActivity = async (companyId) => {
  try {
    const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
    const q = query(exitsRef, orderBy('createdAt', 'desc'), limit(10));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().createdAt?.toDate?.() || null
    }));
  } catch (error) {
    // Silenciar error si no hay permisos
    return [];
  }
};

/**
 * Obtiene actividad de la última semana (por día)
 */
const getWeeklyActivity = async (companyId) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const exitsRef = collection(db, `companies/${companyId}/inventory_exits`);
    const q = query(
      exitsRef,
      where('createdAt', '>=', Timestamp.fromDate(weekAgo)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    // Agrupar por día
    const activityByDay = {};
    snapshot.docs.forEach(doc => {
      const date = doc.data().createdAt?.toDate?.();
      if (date) {
        const dayKey = date.toLocaleDateString('es-ES');
        activityByDay[dayKey] = (activityByDay[dayKey] || 0) + 1;
      }
    });

    // Convertir a array para gráficos
    return Object.entries(activityByDay).map(([day, count]) => ({
      day,
      count
    }));
  } catch (error) {
    // Silenciar error si no hay permisos
    return [];
  }
};

/**
 * Cuenta uso del asistente IA (simulado - ajustar según implementación real)
 */
const getAIUsage = async (companyId) => {
  // TODO: Implementar rastreo real del asistente IA
  // Por ahora retorna un valor simulado
  return Math.floor(Math.random() * 50);
};

/**
 * Calcula score de engagement (0-100)
 * Basado en múltiples factores de actividad
 */
const calculateEngagementScore = ({ productsCount, inventoryMovements, workersCount, recentActivity }) => {
  let score = 0;

  // Productos creados (máx 30 puntos)
  score += Math.min(productsCount * 2, 30);

  // Movimientos de inventario (máx 40 puntos)
  score += Math.min(inventoryMovements, 40);

  // Trabajadores activos (máx 15 puntos)
  score += Math.min(workersCount * 3, 15);

  // Actividad reciente (máx 15 puntos)
  score += Math.min(recentActivity.length * 1.5, 15);

  return Math.min(Math.round(score), 100);
};

/**
 * Filtra empresas inactivas (riesgo de churn) a partir de un resultado ya calculado.
 * No vuelve a consultar Firestore — usar junto a getAllCompaniesAnalytics().
 * @param {Array} allAnalytics - Resultado de getAllCompaniesAnalytics()
 * @returns {Array} Empresas sin actividad reciente
 */
export const filterInactiveCompanies = (allAnalytics) => {
  return allAnalytics.filter(analytics => {
    const hasRecentActivity = analytics.activity.recent.length > 0;
    const hasLowEngagement = analytics.engagementScore < 20;

    return !hasRecentActivity || hasLowEngagement;
  });
};

/**
 * Toma las top empresas más activas a partir de un resultado ya calculado.
 * No vuelve a consultar Firestore — usar junto a getAllCompaniesAnalytics().
 * @param {Array} allAnalytics - Resultado de getAllCompaniesAnalytics(), ya viene ordenado por engagement
 * @param {number} limitCount - Número de empresas a retornar
 * @returns {Array} Top empresas por engagement
 */
export const filterTopActiveCompanies = (allAnalytics, limitCount = 5) => {
  return allAnalytics.slice(0, limitCount);
};

export default {
  getCompanyAnalytics,
  getAllCompaniesAnalytics,
  filterInactiveCompanies,
  filterTopActiveCompanies
};
