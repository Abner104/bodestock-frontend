// src/pages/SuperAdminAgentRoom.jsx
// "Sala de Agentes": vista central donde cada agente de Bodestock espera a
// ser llamado. Finanzas, Inventario y Marketing viven en sus propias rutas
// (/super-admin/agentes/{finanzas,inventario,marketing}); Precios y
// Contabilidad no tienen página propia -- todo (chat, tareas, herramientas)
// vive en este mismo panel flotante ("Ver tareas"), sin navegar a otro lado.
// El mapa 2D isométrico de Bodestock World (BodestockWorldView.jsx) es la
// presentación -- reemplaza al mundo 3D (Three.js/R3F, components/agents3d/)
// que vivía acá antes: mismo selector de empresa y panel de alertas de
// siempre, solo cambió cómo se dibuja el mundo.
import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase/firebase';
import { Sparkles } from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../config/env.js';
import { fetchUnreadAlertsCountByAgent } from '../agents/agentAlerts';
import BodestockWorldView from '../components/BodestockWorld/BodestockWorldView';
import AgentAlertsPanel from '../components/BodestockWorld/AgentAlertsPanel';
import { useCompanySelector } from '../hooks/useCompanySelector';
import { useAgentRealStatus } from '../hooks/useAgentRealStatus';

export default function SuperAdminAgentRoom() {
  const [openAlertsAgentId, setOpenAlertsAgentId] = useState(null);
  const worldRef = useRef(null);

  // Al cerrar el panel de tareas, vuelve a la vista general del mapa en vez
  // de dejar la cámara acercada al último agente -- "cerrar" debe sentirse
  // como volver al punto de partida, no quedar a mitad de camino.
  const handleCloseAlerts = () => {
    setOpenAlertsAgentId(null);
    worldRef.current?.resetView();
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.email !== SUPER_ADMIN_EMAIL) { window.location.href = '/login'; }
  }, []);

  const { companies, companyId, companyName, selectCompany } = useCompanySelector();
  const { data: agentRealData } = useAgentRealStatus(companyId);

  // Cuántas alertas sin leer tiene cada agente -- se muestra como badge
  // numérico sobre su sprite en el mapa (ver AgentSprite.jsx/UnreadBadge),
  // mismo dato que antes mostraba el mundo 3D en cada isla.
  const [unreadByAgent, setUnreadByAgent] = useState({});

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const counts = await fetchUnreadAlertsCountByAgent(companyId);
        if (cancelled) return;
        // Precios/Inventario/Finanzas/Marketing ya no muestran "Tareas de
        // hoy" (agent_alerts) en su panel -- tienen su propia vista en
        // vivo (ProductPricingSuggestions, InventorySuggestions, etc.) que
        // no depende de alertas sin leer. Mostrar el badge para esos 4
        // dejaría un contador sin forma de verse ni resolverse dentro del
        // panel. Solo Contabilidad sigue usando agent_alerts tal cual.
        setUnreadByAgent({ accounting: counts.accounting || 0 });
      } catch (e) {
        console.error('No se pudo cargar el conteo de alertas de agentes:', e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const adjustUnreadCount = (agentId, delta) => {
    setUnreadByAgent(prev => ({ ...prev, [agentId]: Math.max(0, (prev[agentId] || 0) + delta) }));
  };

  return (
    <div className="w-full">
      <div className="hidden lg:flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Bodestock HQ</h1>
        </div>
        {companies.length > 0 && (
          <select
            value={companyId || ''}
            onChange={(e) => selectCompany(e.target.value)}
            className="text-xs bg-white/[0.06] border border-white/[0.08] text-zinc-200 rounded-lg px-2.5 py-1.5 max-w-[220px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      <p className="hidden lg:block text-sm text-zinc-400 mb-4">
        Precios, Finanzas, Inventario y Marketing. Clic en un agente para ver sus tareas de hoy, arrastra para mover el mapa, scroll para zoom.
      </p>

      <BodestockWorldView
        ref={worldRef}
        companyId={companyId}
        companyName={companyName}
        companies={companies}
        onSelectCompany={selectCompany}
        onAgentClick={setOpenAlertsAgentId}
        unreadByAgent={unreadByAgent}
      />

      {openAlertsAgentId && companyId && (
        <AgentAlertsPanel
          companyId={companyId}
          companyName={companyName}
          agentId={openAlertsAgentId}
          realStatus={agentRealData[openAlertsAgentId]}
          onClose={handleCloseAlerts}
          onCountChange={adjustUnreadCount}
        />
      )}
    </div>
  );
}
