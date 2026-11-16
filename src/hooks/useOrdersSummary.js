// src/hooks/useOrdersSummary.js
// Resumen en tiempo real de pedidos de la tienda pública, para mostrar en
// el Dashboard -- mismo criterio de "tienda activa" que ya usa Navbar.jsx
// para el badge del menú (al menos un inventario con catalogEnabled=true).
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';
import { getAllInventories } from '../services/inventories-service';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export function useOrdersSummary() {
  const [hasActiveStore, setHasActiveStore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ pending: 0, delivering: 0, approvedToday: 0 });

  useEffect(() => {
    let unsubscribe = null;
    let cancelled = false;

    (async () => {
      try {
        const companyId = await getUserCompanyId();
        if (!companyId || cancelled) { setLoading(false); return; }

        const inventories = await getAllInventories();
        const activeStore = inventories.some((inv) => inv.catalogEnabled === true);
        if (cancelled) return;
        setHasActiveStore(activeStore);

        if (!activeStore) { setLoading(false); return; }

        const todayStart = startOfToday();
        const q = query(
          collection(db, `companies/${companyId}/orders`),
          where('status', 'in', ['PENDING', 'pendiente', 'DELIVERING', 'APPROVED', 'listo'])
        );
        unsubscribe = onSnapshot(q, (snapshot) => {
          let pending = 0, delivering = 0, approvedToday = 0;
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'PENDING' || data.status === 'pendiente') pending++;
            else if (data.status === 'DELIVERING') delivering++;
            else if (data.status === 'APPROVED' || data.status === 'listo') {
              const approvedAt = data.approvedAt?.toDate?.() || data.createdAt?.toDate?.();
              if (approvedAt && approvedAt >= todayStart) approvedToday++;
            }
          });
          setSummary({ pending, delivering, approvedToday });
          setLoading(false);
        }, () => setLoading(false));
      } catch {
        setLoading(false);
      }
    })();

    return () => { cancelled = true; if (unsubscribe) unsubscribe(); };
  }, []);

  return { hasActiveStore, loading, ...summary };
}
