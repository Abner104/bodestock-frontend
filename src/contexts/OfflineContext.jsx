// src/contexts/OfflineContext.jsx
import { createContext, useContext } from 'react';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import OfflineBanner from '../components/OfflineBanner';

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const queue = useOfflineQueue();

  return (
    <OfflineContext.Provider value={queue}>
      <OfflineBanner
        isOnline={queue.isOnline}
        pendingCount={queue.pendingCount}
        syncing={queue.syncing}
        lastSyncAt={queue.lastSyncAt}
        onSync={queue.syncPending}
      />
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOfflineContext debe usarse dentro de OfflineProvider');
  return ctx;
}
