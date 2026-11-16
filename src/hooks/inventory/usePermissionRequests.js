// src/hooks/inventory/usePermissionRequests.js
/**
 * Hook para gestionar solicitudes de permisos pendientes
 * Listener en tiempo real de permission requests
 */

import { useState, useEffect } from 'react';
import { onPendingPermissionRequestsChange } from '../../services/permission-requests-service.js';

/**
 * Hook que escucha solicitudes de permisos pendientes en tiempo real
 *
 * @returns {Object} - { pendingPermissions, loading, error }
 */
export function usePermissionRequests() {
  const [pendingPermissions, setPendingPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe;

    const setupListener = async () => {
      try {
        unsubscribe = await onPendingPermissionRequestsChange((requests) => {
          setPendingPermissions(requests);
          setLoading(false);
          setError(null);

          if (requests.length > 0) {
            console.log(`📋 Solicitudes de permiso pendientes: ${requests.length}`);
          }
        });
      } catch (err) {
        console.error('❌ Error setting up permission requests listener:', err);
        setError(err.message || 'Error al cargar solicitudes de permisos');
        setLoading(false);
      }
    };

    setupListener();

    // Cleanup: desuscribir listener al desmontar
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('🔌 Listener de solicitudes de permisos desconectado');
      }
    };
  }, []);

  return {
    pendingPermissions,
    loading,
    error,
    hasPendingRequests: pendingPermissions.length > 0
  };
}
