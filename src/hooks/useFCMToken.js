// src/hooks/useFCMToken.js
import { useState, useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function useFCMToken({ companyId, onNewOrder } = {}) {
  const [permission, setPermission] = useState(Notification.permission);
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  // Escuchar mensajes en foreground (tab abierto)
  useEffect(() => {
    if (!('Notification' in window)) return;
    try {
      const messaging = getMessaging();
      const unsub = onMessage(messaging, (payload) => {
        // Sonido en foreground lo maneja KitchenDisplay directamente
        // Solo notificamos si el callback está definido
        if (onNewOrder) onNewOrder(payload);
      });
      return () => unsub();
    } catch {}
  }, [onNewOrder]);

  const requestPermission = async () => {
    if (!('Notification' in window) || !VAPID_KEY) {
      setError(!VAPID_KEY ? 'VAPID key no configurada' : 'Notificaciones no soportadas');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const messaging = getMessaging();
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });

      if (!fcmToken) return false;
      setToken(fcmToken);

      // Guardar token en Firestore asociado al usuario/empresa
      const uid = auth.currentUser?.uid;
      if (uid && companyId) {
        await setDoc(
          doc(db, `companies/${companyId}/fcm_tokens/${uid}`),
          {
            token: fcmToken,
            uid,
            updatedAt: serverTimestamp(),
            userAgent: navigator.userAgent.slice(0, 100),
          },
          { merge: true }
        );
      }
      return true;
    } catch (e) {
      console.error('FCM error:', e);
      setError(e.message);
      return false;
    }
  };

  return { permission, token, error, requestPermission };
}
