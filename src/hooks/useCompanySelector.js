// src/hooks/useCompanySelector.js
// Selector de empresa reusable entre las vistas de "sala de agentes"
// (Bodestock HQ 3D, Bodestock World 2D) -- misma key de localStorage
// ('agentRoomCompanyId') que ya usaba SuperAdminAgentRoom.jsx, extraída
// acá para que ambas vistas recuerden la MISMA última empresa elegida en
// vez de tener cada una su propia preferencia separada.
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const STORAGE_KEY = 'agentRoomCompanyId';
// Empresa objetivo del análisis diario automático -- mismo criterio
// "contiene" (case-insensitive) que ALERTS_TARGET_COMPANY_PATTERN en
// SuperAdminAgentRoom.jsx y TARGET_COMPANY_NAME_PATTERN en functions/index.js.
const FALLBACK_PATTERN = 'L&N';

export function useCompanySelector() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'companies'));
        const list = snap.docs
          .map((d) => ({ id: d.id, name: d.data().name || 'Sin nombre' }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (cancelled) return;
        setCompanies(list);
        const remembered = localStorage.getItem(STORAGE_KEY);
        const fallbackMatch = list.find((c) => c.name.toLowerCase().includes(FALLBACK_PATTERN.toLowerCase()));
        const initial = list.find((c) => c.id === remembered) || fallbackMatch || list[0];
        if (initial) setCompanyId(initial.id);
      } catch (e) {
        console.error('No se pudo cargar la lista de empresas:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectCompany = (id) => {
    setCompanyId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage no disponible, no es crítico */ }
  };

  const companyName = companies.find((c) => c.id === companyId)?.name || '';

  return { companies, companyId, companyName, selectCompany };
}
