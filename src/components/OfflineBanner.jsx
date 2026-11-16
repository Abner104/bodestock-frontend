// src/components/OfflineBanner.jsx
import { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner({ isOnline, pendingCount, syncing, lastSyncAt, onSync }) {
  const [showBackOnline, setShowBackOnline] = useState(false);

  // Cuando vuelve la conexión, mostrar banner verde por 3 segundos
  useEffect(() => {
    if (isOnline && pendingCount === 0 && !syncing) {
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, pendingCount, syncing]);

  const showOffline   = !isOnline;
  const showSyncing   = isOnline && syncing;
  const showPending   = isOnline && !syncing && pendingCount > 0;

  if (!showOffline && !showSyncing && !showPending && !showBackOnline) return null;

  return (
    <AnimatePresence>
      {(showOffline || showSyncing || showPending || showBackOnline) && (
        <motion.div
          key={showOffline ? 'offline' : showSyncing ? 'syncing' : showPending ? 'pending' : 'back'}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className={`fixed top-0 left-0 right-0 z-[99999] flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white shadow-lg ${
            showOffline   ? 'bg-red-600' :
            showSyncing   ? 'bg-blue-600' :
            showPending   ? 'bg-amber-600' :
            'bg-emerald-600'
          }`}
        >
          {showOffline && (
            <>
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Sin conexión — las ventas se guardan y suben solas cuando vuelva la luz</span>
              {pendingCount > 0 && (
                <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                </span>
              )}
            </>
          )}

          {showSyncing && (
            <>
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>Sincronizando {pendingCount} venta{pendingCount !== 1 ? 's' : ''} guardada{pendingCount !== 1 ? 's' : ''}...</span>
            </>
          )}

          {showPending && (
            <>
              <Clock className="w-4 h-4 shrink-0" />
              <span>{pendingCount} venta{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de sincronizar</span>
              <button
                onClick={onSync}
                className="ml-2 bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded-full text-xs transition"
              >
                Sincronizar ahora
              </button>
            </>
          )}

          {showBackOnline && (
            <>
              <Wifi className="w-4 h-4 shrink-0" />
              <span>Conexión restaurada — todo sincronizado</span>
              {lastSyncAt && (
                <span className="ml-1 text-white/70 text-xs">
                  {lastSyncAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
