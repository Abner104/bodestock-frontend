// src/hooks/inventory/useWarehousesData.js
/**
 * Hook para cargar y sincronizar datos de bodegas en tiempo real
 * Listener de la colección "warehouses" en Firestore
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase.js';
import { getUserCompanyId } from '../../services/companyService.js';

/**
 * Hook que carga bodegas con listener en tiempo real
 *
 * @param {string} inventoryId - ID del inventario específico (opcional - si no se provee, usa el inventario legacy)
 * @returns {Object} - { warehouses, loading, error }
 */
export function useWarehousesData(inventoryId = null) {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe;

    const setupListener = async () => {
      try {
        // Obtener ID de la empresa
        const companyId = await getUserCompanyId();

        if (!companyId) {
          console.error('❌ No se pudo obtener companyId');
          setError('No se pudo identificar la empresa');
          setLoading(false);
          return;
        }

        // Configurar listener en tiempo real
        // Si inventoryId está presente, usar la nueva estructura: companies/{companyId}/inventories/{inventoryId}/warehouses
        // Si no, usar la estructura legacy: companies/{companyId}/warehouses
        const warehousesCollection = inventoryId
          ? collection(db, `companies/${companyId}/inventories/${inventoryId}/warehouses`)
          : collection(db, `companies/${companyId}/warehouses`);

        unsubscribe = onSnapshot(
          warehousesCollection,
          (snapshot) => {
            const docs = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data()
            }));

            // Ordenar por nombre para consistencia
            docs.sort((a, b) =>
              String(a.name || '').localeCompare(String(b.name || ''))
            );

            setWarehouses(docs);
            setLoading(false);
            setError(null);

            console.log(`✅ Bodegas cargadas: ${docs.length} bodegas`);
          },
          (err) => {
            console.error('❌ Listener warehouses error:', err);
            setError(err.message || 'Error al cargar bodegas');
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('❌ Error setting up warehouses listener:', err);
        setError(err.message || 'Error al configurar listener');
        setLoading(false);
      }
    };

    setupListener();

    // Cleanup: desuscribir listener al desmontar
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('🔌 Listener de bodegas desconectado');
      }
    };
  }, [inventoryId]); // Re-ejecutar si inventoryId cambia

  return {
    warehouses,
    loading,
    error
  };
}
