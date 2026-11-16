// src/pages/SuperAdminBodestockWorld.jsx
// Prototipo de "Bodestock World": experiencia 2D isométrica con Konva,
// reemplazando el enfoque 3D (Three.js/R3F). El mapa en sí vive en
// BodestockWorldView.jsx (reusado también por SuperAdminAgentRoom.jsx, la
// ruta real /super-admin/agentes) -- esta página es el wrapper del
// prototipo: header propio, badge "Prototipo" y allowEdit habilitado (acá
// sí tiene sentido dejar reposicionar agentes libremente para probar).
import React from 'react';
import { Sparkles } from 'lucide-react';
import BodestockWorldView from '../components/BodestockWorld/BodestockWorldView';
import { useCompanySelector } from '../hooks/useCompanySelector';

export default function SuperAdminBodestockWorld() {
  const { companies, companyId, companyName, selectCompany } = useCompanySelector();

  return (
    <div className="w-full">
      <div className="hidden lg:flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Bodestock World</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 rounded-full px-2 py-0.5">Prototipo</span>
        </div>
        {companies.length > 0 && (
          <select
            value={companyId || ''}
            onChange={(e) => selectCompany(e.target.value)}
            className="text-xs bg-white/[0.06] border border-white/[0.08] text-zinc-200 rounded-lg px-2.5 py-1.5 max-w-[220px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      <p className="hidden lg:block text-sm text-zinc-400 mb-4">
        Estado real de {companyName || 'la empresa'}. Clic en un agente para ver su detalle, arrastra para mover el mapa, scroll o pellizco para zoom.
      </p>

      <BodestockWorldView
        companyId={companyId}
        companyName={companyName}
        companies={companies}
        onSelectCompany={selectCompany}
        allowEdit
      />
    </div>
  );
}
