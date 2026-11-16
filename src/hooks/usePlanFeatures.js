// src/hooks/usePlanFeatures.js
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';
import { PLAN_FEATURES, ADDONS } from '../config/plan-features';
import { SUPER_ADMIN_EMAIL } from '../config/env';

/**
 * Guarda el inventario activo en localStorage para que usePlanFeatures
 * pueda aplicar el override de features por sucursal.
 * Llamar esto cuando el usuario selecciona/navega a un inventario específico.
 */
export function setActiveInventoryId(inventoryId) {
  if (inventoryId) {
    localStorage.setItem('activeInventoryId', inventoryId);
  } else {
    localStorage.removeItem('activeInventoryId');
  }
}

export function getActiveInventoryId() {
  return localStorage.getItem('activeInventoryId') || null;
}

export function usePlanFeatures() {
  const [state, setState] = useState({
    loading: true,
    plan: null,
    features: [],
    addons: [],
    companyFeatures: null,
    inventoryFeatures: null,
    activeInventoryId: null,
    limits: { maxUsers: 0, maxProducts: 0, maxWarehouses: 0 },
    monthlyAmount: null,
    nextBillingDate: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        // Super admin tiene acceso a todo
        if (user.email === SUPER_ADMIN_EMAIL) {
          setState({
            loading: false,
            plan: 'empresa',
            features: ['*'],
            companyFeatures: null,
            inventoryFeatures: null,
            activeInventoryId: null,
            limits: { maxUsers: Infinity, maxProducts: Infinity, maxWarehouses: Infinity },
          });
          return;
        }

        const companyId = await getUserCompanyId();
        if (!companyId) {
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        // Obtener plan de la empresa
        const companyDoc = await getDoc(doc(db, 'companies', companyId));
        const companyData = companyDoc.exists() ? companyDoc.data() : {};
        const companyPlan = companyData.plan || 'free';

        // Cargar config dinámica de planes (si el super admin editó features/limits)
        const planConfigDoc = await getDoc(doc(db, 'config', 'plans'));
        let planData = PLAN_FEATURES[companyPlan] || PLAN_FEATURES.free;

        if (planConfigDoc.exists()) {
          const dynamicConfig = planConfigDoc.data()[companyPlan];
          if (dynamicConfig) {
            planData = {
              ...planData,
              features: dynamicConfig.features ?? planData.features,
              maxUsers: dynamicConfig.maxUsers ?? planData.maxUsers,
              maxProducts: dynamicConfig.maxProducts ?? planData.maxProducts,
              maxWarehouses: dynamicConfig.maxWarehouses ?? planData.maxWarehouses,
            };
          }
        }

        // Sumar features de add-ons activos
        const activeAddons = companyData.addons || []; // ['workers', 'invoicing', ...]
        let finalFeatures = [...(planData.features || [])];
        if (!finalFeatures.includes('*')) {
          activeAddons.forEach(addonId => {
            const addon = ADDONS[addonId];
            if (addon?.features) {
              addon.features.forEach(f => {
                if (!finalFeatures.includes(f)) finalFeatures.push(f);
              });
            }
          });
        }

        // Override nivel 1: por empresa (companyFeatures)
        const companyFeatures = companyData.companyFeatures; // { customers: false, invoicing: true, ... }
        if (companyFeatures && typeof companyFeatures === 'object' && !Array.isArray(finalFeatures)) {
          // features es '*' (personalizado) → no aplicar override
        } else if (companyFeatures && typeof companyFeatures === 'object') {
          finalFeatures = finalFeatures.filter(f => {
            if (f === '*') return true;
            return companyFeatures[f] !== false;
          });
        }

        // Override nivel 2: por inventario/sucursal activo (inventoryFeatures)
        // Lee el inventoryId activo desde localStorage
        const activeInventoryId = getActiveInventoryId();
        let inventoryFeatures = null;

        if (activeInventoryId && companyId) {
          try {
            // Las features del inventario se guardan en el metadata del inventario
            const metaSnap = await getDocs(
              collection(db, `companies/${companyId}/inventories/${activeInventoryId}/metadata`)
            );
            if (!metaSnap.empty) {
              const meta = metaSnap.docs[0].data();
              if (meta.inventoryFeatures && typeof meta.inventoryFeatures === 'object') {
                inventoryFeatures = meta.inventoryFeatures;
                // Aplicar override: si una feature está explícitamente en false para este inventario, sacarla
                if (!Array.isArray(finalFeatures)) {
                  // wildcard '*' → no aplicar override de inventario
                } else {
                  finalFeatures = finalFeatures.filter(f => {
                    if (f === '*') return true;
                    return inventoryFeatures[f] !== false;
                  });
                }
              }
            }
          } catch (err) {
            // Si falla la lectura del inventario, continuar con features de empresa
            console.warn('No se pudo leer inventoryFeatures:', err);
          }
        }

        setState({
          loading: false,
          plan: companyPlan,
          features: finalFeatures,
          addons: activeAddons,
          companyFeatures: companyFeatures || null,
          inventoryFeatures: inventoryFeatures,
          activeInventoryId: activeInventoryId,
          limits: {
            maxUsers: planData.maxUsers || 0,
            maxProducts: planData.maxProducts || 0,
            maxWarehouses: planData.maxWarehouses || 0,
          },
          monthlyAmount: companyData.monthlyAmount ?? null,
          nextBillingDate: companyData.nextBillingDate ?? null,
        });
      } catch (error) {
        console.error('Error cargando plan features:', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    if (auth.currentUser) {
      load();
    }
  }, []);

  const hasFeature = (featureName) => {
    if (state.features.includes('*')) return true;
    return state.features.includes(featureName);
  };

  return {
    ...state,
    hasFeature,
  };
}
