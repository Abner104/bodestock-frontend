// src/hooks/useOnlineUsers.js
// Escucha en tiempo real quién está en línea (lastSeen < 2 minutos)
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos

export function useOnlineUsers(companyId) {
  const [onlineMap, setOnlineMap] = useState({}); // uid → { name, email, lastSeen, isOnline }

  useEffect(() => {
    if (!companyId) return;

    const ref = collection(db, `companies/${companyId}/presence`);
    const unsub = onSnapshot(ref, (snap) => {
      const now = Date.now();
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const lastSeenMs = data.lastSeen?.toMillis?.() || 0;
        map[d.id] = {
          uid: d.id,
          email: data.email,
          name: data.name,
          lastSeen: data.lastSeen,
          isOnline: (now - lastSeenMs) < ONLINE_THRESHOLD_MS,
        };
      });
      setOnlineMap(map);
    });

    return () => unsub();
  }, [companyId]);

  return onlineMap;
}
