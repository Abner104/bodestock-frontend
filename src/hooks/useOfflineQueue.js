// src/hooks/useOfflineQueue.js
// Cola de operaciones pendientes en IndexedDB para modo offline
// Cuando vuelve la conexión, sincroniza automáticamente con Firestore

import { useState, useEffect, useCallback, useRef } from 'react';

const DB_NAME    = 'bodestock_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_exits';

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db    = await openDB();
  const tx    = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function dbAdd(item) {
  const db    = await openDB();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.add({ ...item, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result); // localId asignado
    req.onerror   = () => reject(req.error);
  });
}

async function dbDelete(localId) {
  const db    = await openDB();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.delete(localId);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useOfflineQueue() {
  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [pending, setPending]         = useState([]);
  const [syncing, setSyncing]         = useState(false);
  const [lastSyncAt, setLastSyncAt]   = useState(null);
  const syncingRef = useRef(false);

  // Cargar cola al montar
  useEffect(() => {
    dbGetAll().then(setPending).catch(() => {});
  }, []);

  // Listeners de conexión
  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Sincronizar cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && pending.length > 0) {
      syncPending();
    }
  }, [isOnline]); // eslint-disable-line

  // ── Guardar venta en cola offline ──
  const enqueue = useCallback(async (exitData) => {
    try {
      const localId = await dbAdd(exitData);
      setPending(prev => [...prev, { ...exitData, localId }]);
      return localId;
    } catch (e) {
      console.error('Error guardando en cola offline:', e);
      throw e;
    }
  }, []);

  // ── Sincronizar con Firestore ──
  const syncPending = useCallback(async () => {
    if (syncingRef.current) return;
    const items = await dbGetAll();
    if (items.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    const { registerInventoryExit } = await import('../services/inventory-exits-service.js');

    let synced = 0;
    for (const item of items) {
      try {
        const { localId, createdAt, ...exitData } = item;
        await registerInventoryExit(exitData);
        await dbDelete(localId);
        synced++;
      } catch (e) {
        console.warn('No se pudo sincronizar venta offline:', e);
        // Si falla, se queda en la cola para el próximo intento
      }
    }

    const remaining = await dbGetAll();
    setPending(remaining);
    setSyncing(false);
    syncingRef.current = false;
    if (synced > 0) setLastSyncAt(new Date());
  }, []);

  return {
    isOnline,
    pending,
    pendingCount: pending.length,
    syncing,
    lastSyncAt,
    enqueue,
    syncPending,
  };
}
