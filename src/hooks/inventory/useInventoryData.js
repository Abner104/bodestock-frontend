// src/hooks/inventory/useInventoryData.js
/**
 * Hook para cargar y sincronizar datos de inventario en tiempo real
 * Listener de la colección "inventory" en Firestore
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase.js';
import { getUserCompanyId } from '../../services/companyService.js';

/**
 * Hook que carga productos del inventario con listener en tiempo real
 *
 * @param {string} inventoryId - ID del inventario específico (opcional - si no se provee, usa el inventario legacy)
 * @returns {Object} - { items, loading, error }
 */
export function useInventoryData(inventoryId = null) {
  const [items, setItems] = useState([]);
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
        // Si inventoryId está presente, usar la nueva estructura: companies/{companyId}/inventories/{inventoryId}/products
        // Si no, usar la estructura legacy: companies/{companyId}/inventory
        const inventoryCollection = inventoryId
          ? collection(db, `companies/${companyId}/inventories/${inventoryId}/products`)
          : collection(db, `companies/${companyId}/inventory`);

        unsubscribe = onSnapshot(
          inventoryCollection,
          (snapshot) => {
            const docs = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data()
            }));

            // Ordenar por nombre para consistencia
            docs.sort((a, b) =>
              String(a.name || '').localeCompare(String(b.name || ''))
            );

            setItems(docs);
            setLoading(false);
            setError(null);

            console.log(`✅ Inventario cargado: ${docs.length} productos`);
          },
          (err) => {
            console.error('❌ Listener inventory error:', err);
            setError(err.message || 'Error al cargar inventario');
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('❌ Error setting up inventory listener:', err);
        setError(err.message || 'Error al configurar listener');
        setLoading(false);
      }
    };

    setupListener();

    // Cleanup: desuscribir listener al desmontar
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('🔌 Listener de inventario desconectado');
      }
    };
  }, [inventoryId]); // Re-ejecutar si inventoryId cambia

  return {
    items,
    loading,
    error
  };
}
