// src/hooks/usePresence.js
// Escribe lastSeen en Firestore cada 60s mientras el usuario está activo
import { useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';

const HEARTBEAT_MS = 60_000; // cada 60 segundos

export function usePresence(workerName = null) {
  useEffect(() => {
    const ping = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const companyId = await getUserCompanyId();
        if (!companyId) return;
        await setDoc(
          doc(db, `companies/${companyId}/presence`, user.uid),
          {
            uid: user.uid,
            email: user.email,
            name: workerName || user.displayName || user.email,
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        // silencioso — no bloquear la app por esto
      }
    };

    ping(); // ping inmediato al montar
    const interval = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [workerName]);
}
