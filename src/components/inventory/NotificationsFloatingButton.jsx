// src/components/inventory/NotificationsFloatingButton.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  AlertTriangle,
  Package,
  TrendingDown,
  Warehouse,
  Calendar,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Volume2
} from 'lucide-react';

const NotificationsFloatingButton = ({
  items = [],
  warehouses = [],
  pendingPermissions = [],
  onUpdateThreshold,
  onApprovePermission,
  onRejectPermission,
  isOpen: externalIsOpen, // Control externo del panel
  onClose: externalOnClose, // Función para cerrar desde afuera
  onNotificationsCountChange // Callback para notificar cambios en el contador
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Usar control externo si está disponible, sino usar interno
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnClose ? (value) => {
    if (!value) externalOnClose();
    else setInternalIsOpen(value);
  } : setInternalIsOpen;

  // Marcar notificaciones como vistas cuando se abre el panel
  useEffect(() => {
    if (isOpen) {
      console.log('👁️ Panel abierto - Marcando notificaciones como vistas');
      console.log('   - Alertas actuales:', alerts.length);
      console.log('   - Permisos actuales:', pendingPermissions.length);

      // Marcar todas las alertas actuales como vistas
      setViewedAlerts(prevViewed => {
        const newViewedAlerts = new Set(prevViewed);
        alerts.forEach(alert => newViewedAlerts.add(alert.id));
        return newViewedAlerts;
      });

      // Marcar todas las solicitudes actuales como vistas
      setViewedPermissions(prevViewed => {
        const newViewedPermissions = new Set(prevViewed);
        pendingPermissions.forEach(perm => newViewedPermissions.add(perm.id));
        return newViewedPermissions;
      });
    }
  }, [isOpen, alerts, pendingPermissions]); // Incluir todas las dependencias
  const [alerts, setAlerts] = useState([]);
  const [viewedAlerts, setViewedAlerts] = useState(new Set());
  const [viewedPermissions, setViewedPermissions] = useState(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef(null);
  const previousCountRef = useRef(null); // null = primera carga
  const isInitialLoadRef = useRef(true);

  const [thresholds] = useState({
    critical: 0,
    low: 5,
    warning: 10
  });

  // Calcular alertas
  useEffect(() => {
    const newAlerts = [];

    items.forEach(item => {
      // Los productos elaborados no tienen stock físico — ignorar en alertas
      const isElaborado = item.productType === 'ELABORADO' || (Array.isArray(item.receta) && item.receta.length > 0);
      if (isElaborado) return;

      const stock = item.stock || 0;
      const warehouse = warehouses.find(w => w.id === item.warehouseId);

      let alertLevel = null;
      let alertMessage = '';

      if (stock === 0) {
        alertLevel = 'outOfStock';
        alertMessage = 'Sin stock disponible';
      } else if (stock <= thresholds.critical) {
        alertLevel = 'critical';
        alertMessage = `Stock crítico: ${stock} ${item.unit}`;
      } else if (stock <= thresholds.low) {
        alertLevel = 'low';
        alertMessage = `Stock bajo: ${stock} ${item.unit}`;
      } else if (stock <= thresholds.warning) {
        alertLevel = 'warning';
        alertMessage = `Stock en advertencia: ${stock} ${item.unit}`;
      }

      if (alertLevel) {
        newAlerts.push({
          id: item.id,
          itemName: item.name,
          stock,
          unit: item.unit,
          warehouseName: warehouse?.name || 'Sin bodega',
          alertLevel,
          alertMessage,
        });
      }
    });

    setAlerts(newAlerts);
  }, [items, warehouses, thresholds]);

  // Calcular notificaciones no vistas
  const unviewedAlerts = alerts.filter(alert => !viewedAlerts.has(alert.id));
  const unviewedPermissions = pendingPermissions.filter(perm => !viewedPermissions.has(perm.id));
  const totalNotifications = unviewedAlerts.length + unviewedPermissions.length;

  // Notificar cambios en el contador al componente padre
  useEffect(() => {
    if (onNotificationsCountChange) {
      console.log('📊 Actualizando contador de notificaciones:', totalNotifications);
      console.log('   - Alertas no vistas:', unviewedAlerts.length);
      console.log('   - Permisos no vistos:', unviewedPermissions.length);
      onNotificationsCountChange(totalNotifications);
    }
  }, [totalNotifications, onNotificationsCountChange]);

  // Reproducir sonido cuando hay nuevas notificaciones NO VISTAS
  useEffect(() => {
    const currentUnviewedTotal = totalNotifications;

    // Si es la primera carga, solo guardar el contador sin reproducir sonido
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = currentUnviewedTotal;
      console.log('📊 Primera carga - notificaciones:', currentUnviewedTotal);
      return;
    }

    // Solo reproducir si hay MÁS notificaciones no vistas que antes (y ya pasó la carga inicial)
    if (previousCountRef.current !== null && currentUnviewedTotal > previousCountRef.current && soundEnabled) {
      // Verificar que no sean productos recién creados (tienen menos de 3 segundos)
      const now = Date.now();
      const hasRecentlyCreatedItems = unviewedAlerts.some(alert => {
        const item = items.find(i => i.id === alert.id);
        if (item?.createdAt) {
          const createdTime = item.createdAt.toMillis ? item.createdAt.toMillis() : new Date(item.createdAt).getTime();
          return (now - createdTime) < 3000; // Menos de 3 segundos
        }
        return false;
      });

      if (!hasRecentlyCreatedItems) {
        console.log('🔔 Reproduciendo sonido de notificación (nueva notificación detectada)');
        playNotificationSound();
      } else {
        console.log('🔇 Notificación de producto recién creado - sin sonido');
      }
    }

    previousCountRef.current = currentUnviewedTotal;
  }, [totalNotifications, soundEnabled, unviewedAlerts, items]);

  // Marcar como vistas al abrir el panel
  const handleOpenPanel = () => {
    console.log('👁️ Abriendo panel - Marcando notificaciones como vistas');
    console.log('   - Alertas antes:', viewedAlerts.size, '→ después:', alerts.length);
    console.log('   - Permisos antes:', viewedPermissions.size, '→ después:', pendingPermissions.length);

    setIsOpen(true);
    // Marcar todas las alertas actuales como vistas
    const newViewedAlerts = new Set(viewedAlerts);
    alerts.forEach(alert => newViewedAlerts.add(alert.id));
    setViewedAlerts(newViewedAlerts);

    // Marcar todas las solicitudes actuales como vistas
    const newViewedPermissions = new Set(viewedPermissions);
    pendingPermissions.forEach(perm => newViewedPermissions.add(perm.id));
    setViewedPermissions(newViewedPermissions);
  };

  const playNotificationSound = () => {
    try {
      // Crear un sonido de notificación estilo iOS usando Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Primer tono
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();

      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);

      oscillator1.frequency.value = 880; // La (A5)
      oscillator1.type = 'sine';

      gainNode1.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.2);

      // Segundo tono (más alto)
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();

      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);

      oscillator2.frequency.value = 1046; // Do (C6)
      oscillator2.type = 'sine';

      gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
      gainNode2.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.15);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

      oscillator2.start(audioContext.currentTime + 0.1);
      oscillator2.stop(audioContext.currentTime + 0.4);

      console.log('✅ Sonido de notificación reproducido');
    } catch (error) {
      console.error('❌ Error al reproducir sonido:', error);
    }
  };


  const getAlertColor = (level) => {
    switch (level) {
      case 'outOfStock':
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'low':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getAlertIcon = (level) => {
    switch (level) {
      case 'outOfStock':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'low':
        return <TrendingDown className="w-5 h-5 text-yellow-600" />;
      case 'warning':
        return <Package className="w-5 h-5 text-orange-600" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel Lateral - Estilo iOS */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed top-0 right-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-[9999] overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Bell className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold">Notificaciones</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* Toggle de sonido */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm ${
                      soundEnabled ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 hover:bg-white/20'
                    }`}
                    title={soundEnabled ? 'Silenciar notificaciones' : 'Activar sonido'}
                  >
                    <Volume2 className={`w-4 h-4 ${soundEnabled ? '' : 'opacity-50'}`} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-white/90 text-sm">
                {totalNotifications} sin leer • {alerts.length + pendingPermissions.length} total
              </p>
            </div>

            {/* Contenido */}
            <div className="overflow-y-auto h-[calc(100%-120px)] p-4">
              {/* Solicitudes de Permisos */}
              {unviewedPermissions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Solicitudes Pendientes ({unviewedPermissions.length})
                  </h3>
                  <div className="space-y-3">
                    {unviewedPermissions.map((request) => (
                      <div
                        key={request.id}
                        className="bg-blue-50 border border-blue-200 rounded-2xl p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-blue-900 text-sm mb-1">
                              {request.workerName}
                            </p>
                            <p className="text-xs text-blue-700">
                              Solicita acceso a: {request.warehouseName}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              {new Date(request.requestedAt?.toDate()).toLocaleDateString('es-CL')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onApprovePermission(request);
                              setIsOpen(false);
                            }}
                            className="flex-1 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white py-2.5 px-3 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                            style={{ color: 'white' }}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Aprobar
                          </button>
                          <button
                            onClick={() => {
                              onRejectPermission(request);
                              setIsOpen(false);
                            }}
                            className="flex-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white py-2.5 px-3 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                            style={{ color: 'white' }}
                          >
                            <XCircle className="w-4 h-4" />
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alertas de Stock */}
              {unviewedAlerts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    Alertas de Stock ({unviewedAlerts.length})
                  </h3>
                  <div className="space-y-2">
                    {unviewedAlerts.slice(0, 20).map((alert) => (
                      <div
                        key={alert.id}
                        className={`border rounded-2xl p-4 ${getAlertColor(alert.alertLevel)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getAlertIcon(alert.alertLevel)}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm mb-1 truncate">
                              {alert.itemName}
                            </p>
                            <p className="text-xs opacity-75 mb-1">
                              {alert.alertMessage}
                            </p>
                            <div className="flex items-center gap-2 text-xs opacity-60">
                              <Warehouse className="w-3 h-3" />
                              {alert.warehouseName}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sin notificaciones */}
              {totalNotifications === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">Sin notificaciones</p>
                  <p className="text-gray-500 text-sm mt-1">Todo está en orden</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Componente para el Header Mobile
export const NotificationBellButton = ({ onClick, count }) => {
  return (
    <button
      onClick={onClick}
      className="relative p-2 hover:bg-white/10 rounded-xl transition-colors"
    >
      <Bell className="w-6 h-6 text-white" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};

export default NotificationsFloatingButton;
