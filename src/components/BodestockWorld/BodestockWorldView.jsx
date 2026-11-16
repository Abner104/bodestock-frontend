// src/components/BodestockWorld/BodestockWorldView.jsx
// El mapa de Bodestock World completo (canvas + agentes + modo edición +
// tooltip) como componente reusable -- extraído de
// SuperAdminBodestockWorld.jsx para que también lo use SuperAdminAgentRoom.jsx
// (la ruta real /super-admin/agentes, que reemplaza al mundo 3D) sin
// duplicar todo este comportamiento entre las dos páginas.
//
// `onAgentClick`, si se pasa, habilita el botón "Ver tareas" dentro de la
// ficha del agente -- lo usa Bodestock HQ para abrir el panel de alertas de
// ese agente (mismo panel que ya existía con el mundo 3D). La ficha en sí
// (tooltip) siempre se abre al seleccionar, en las dos vistas -- un mismo
// click no debe hacer cosas distintas según la ruta.
// `allowEdit` controla si aparece el botón "Editar" -- en la vista real no
// tiene sentido que cualquiera reposicione agentes por accidente mientras
// mira el estado del día; el modo edición queda reservado al prototipo.
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Pencil, Check, Copy, RotateCcw } from 'lucide-react';
import WorldCanvas from './WorldCanvas';
import WorldBackground from './WorldBackground';
import AgentSprite from './AgentSprite';
import OfficeZone from './OfficeZone';
import AgentTooltip from './AgentTooltip';
import WorldControls from './WorldControls';
import AgentRoster from './AgentRoster';
import { agents as agentsData } from '../../data/agents';
import { offices as officesData } from '../../data/offices';
import { WORLD_CONFIG } from '../../data/world';
import { useAgentRealStatus } from '../../hooks/useAgentRealStatus';

// Mundo en unidades fijas -- las coordenadas normalizadas (0..1) de
// agents.js se convierten a este espacio, y WorldCanvas ya se encarga de
// llevar ese espacio a píxeles de pantalla según el zoom/pan actual.
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = WORLD_WIDTH / WORLD_CONFIG.backgroundAspectRatio;

const POSITIONS_STORAGE_KEY = 'bodestockWorld:positionOverrides';

function loadOverrides() {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('No se pudieron leer las posiciones guardadas:', e.message);
    return {};
  }
}

const BodestockWorldView = forwardRef(function BodestockWorldView({
  companyId,
  companyName,
  companies = [],
  onSelectCompany,
  onCloseMobile,
  onAgentClick,
  unreadByAgent = {},
  allowEdit = false,
}, ref) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null); // id del agente seleccionado, o null
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState(loadOverrides);
  const [copied, setCopied] = useState(false);

  const { data: agentRealData } = useAgentRealStatus(companyId);

  const persistOverrides = useCallback((next) => {
    setOverrides(next);
    try {
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('No se pudo guardar la posición:', e.message);
    }
  }, []);

  const agentsInWorld = useMemo(
    () => agentsData.map((a) => {
      const pos = overrides[a.id] || a;
      const real = agentRealData[a.id];
      return {
        ...a,
        x: pos.x * WORLD_WIDTH,
        y: pos.y * WORLD_HEIGHT,
        status: real?.status || a.status,
        summary: real?.summary || a.role,
      };
    }),
    [overrides, agentRealData]
  );
  const officesInWorld = useMemo(
    () => officesData.map((o) => {
      const pos = overrides[o.id] || o;
      return { ...o, x: pos.x * WORLD_WIDTH, y: pos.y * WORLD_HEIGHT, width: o.width * WORLD_WIDTH, height: o.height * WORLD_HEIGHT };
    }),
    [overrides]
  );

  const selectedAgent = useMemo(
    () => agentsInWorld.find((a) => a.id === selectedId) || null,
    [selectedId, agentsInWorld]
  );

  const handleDragEnd = useCallback((id, worldX, worldY) => {
    persistOverrides({
      ...overrides,
      [id]: { x: worldX / WORLD_WIDTH, y: worldY / WORLD_HEIGHT },
    });
  }, [overrides, persistOverrides]);

  const handleResetPositions = useCallback(() => {
    persistOverrides({});
  }, [persistOverrides]);

  const handleCopyCode = useCallback(async () => {
    const fmt = (n) => Math.round(n * 1000) / 1000;
    const agentsSnippet = agentsData
      .map((a) => {
        const pos = overrides[a.id] || a;
        return `  { id: '${a.id}', x: ${fmt(pos.x)}, y: ${fmt(pos.y)} },`;
      })
      .join('\n');
    const officesSnippet = officesData
      .map((o) => {
        const pos = overrides[o.id] || o;
        return `  { id: '${o.id}', x: ${fmt(pos.x)}, y: ${fmt(pos.y)} },`;
      })
      .join('\n');
    const text = `// Posiciones actualizadas -- pegar los valores x/y en data/agents.js y data/offices.js\n// Agentes:\n${agentsSnippet}\n// Oficinas (zonas clickeables sobre el edificio del agente):\n${officesSnippet}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('No se pudo copiar al portapapeles:', e.message);
    }
  }, [overrides]);

  // Al seleccionar un agente, la cámara se desplaza suavemente hacia él y
  // se abre su ficha (tooltip) -- mismo comportamiento en las dos vistas
  // (prototipo y real) para que un mismo click no haga cosas distintas
  // según la ruta. onAgentClick (el panel de tareas/alertas) ya NO se
  // dispara acá directo: se abre desde el botón "Ver tareas" de la ficha,
  // así la ficha siempre aparece primero y da contexto antes del panel
  // grande.
  const handleSelectAgent = useCallback((id) => {
    setSelectedId(id);
    const agent = agentsInWorld.find((a) => a.id === id);
    if (agent) canvasRef.current?.panTo(agent.x, agent.y, 1.15);
  }, [agentsInWorld]);

  // Expuesto al padre (SuperAdminAgentRoom.jsx) para volver a la vista
  // general al cerrar el panel de tareas -- sin esto, la cámara se queda
  // acercada al último agente que se tocó, y no hay forma "de un paso" de
  // volver a ver el mapa completo.
  useImperativeHandle(ref, () => ({
    resetView: () => {
      setSelectedId(null);
      canvasRef.current?.resetCamera();
    },
  }), []);

  // < lg (mobile/tablet): el mapa se porta directo a document.body, fuera
  // del <main> del layout admin (overflow-y-auto + padding), que en algunos
  // navegadores atrapa un descendiente position:fixed y le come el borde --
  // ver WorldCanvas.jsx. El portal garantiza fullscreen real sin pelear con
  // el CSS del padre.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleClose = onCloseMobile || (() => navigate('/super-admin'));

  const worldPane = (
    <div
      className={isMobile
        ? 'fixed inset-0 z-50 overflow-hidden h-screen'
        : 'relative overflow-hidden rounded-2xl border border-white/[0.08] h-[560px]'}
      style={{ background: '#0a0b0e' }}
    >
      <button
        onClick={handleClose}
        aria-label="Cerrar y volver al Dashboard"
        className="lg:hidden absolute top-3 left-3 z-20 w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm border border-white/[0.12] text-zinc-300"
      >
        <X className="w-4 h-4" />
      </button>

      {isMobile && companies.length > 0 && (
        <select
          value={companyId || ''}
          onChange={(e) => onSelectCompany?.(e.target.value)}
          aria-label="Empresa"
          className="lg:hidden absolute top-3 left-14 right-3 z-20 text-xs bg-black/50 backdrop-blur-sm border border-white/[0.12] text-zinc-200 rounded-lg px-2 py-1.5"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <WorldCanvas
        ref={canvasRef}
        worldWidth={WORLD_WIDTH}
        worldHeight={WORLD_HEIGHT}
        maxScale={WORLD_CONFIG.camera.maxScale}
        onBackgroundClick={() => setSelectedId(null)}
      >
        {() => (
          <>
            <WorldBackground src={WORLD_CONFIG.background} width={WORLD_WIDTH} height={WORLD_HEIGHT} />

            {/* Zonas clickeables sobre el edificio-oficina de cada agente
                en el dibujo de fondo -- antes de los agentes para que quede
                "pegada" al mapa, no compitiendo visualmente con lo que ya
                está encima. */}
            {officesInWorld.map((o) => (
              <OfficeZone
                key={o.id}
                office={o}
                editable={allowEdit && editMode}
                draggable={allowEdit && editMode}
                onSelect={handleSelectAgent}
                onDragEnd={handleDragEnd}
              />
            ))}

            {agentsInWorld.map((a) => (
              <AgentSprite
                key={a.id}
                agent={a}
                selected={selectedId === a.id}
                draggable={allowEdit && editMode}
                unreadCount={unreadByAgent[a.id]}
                onSelect={handleSelectAgent}
                onDragEnd={handleDragEnd}
              />
            ))}
          </>
        )}
      </WorldCanvas>

      {!editMode && (
        <AgentRoster
          agents={agentsInWorld}
          selectedId={selectedId}
          unreadByAgent={unreadByAgent}
          onSelect={handleSelectAgent}
          hidden={Boolean(selectedAgent)}
        />
      )}

      <WorldControls canvasRef={canvasRef} raised={!editMode && Boolean(selectedAgent)} />

      {allowEdit && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {editMode && (
            <>
              <button
                onClick={handleResetPositions}
                title="Descartar cambios de posición"
                className="flex items-center gap-1.5 text-xs font-semibold bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/[0.12] text-zinc-200 rounded-lg px-2.5 py-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reiniciar</span>
              </button>
              <button
                onClick={handleCopyCode}
                title="Copiar código con las posiciones actuales"
                className="flex items-center gap-1.5 text-xs font-semibold bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/[0.12] text-zinc-200 rounded-lg px-2.5 py-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar código'}</span>
              </button>
            </>
          )}
          <button
            onClick={() => { setEditMode((v) => !v); setSelectedId(null); }}
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 ${editMode ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/[0.12] text-zinc-200'}`}
          >
            <Pencil className="w-3.5 h-3.5" /> {editMode ? 'Listo' : 'Editar'}
          </button>
        </div>
      )}

      {!editMode && (
        <AgentTooltip
          entity={selectedAgent}
          onClose={() => { setSelectedId(null); canvasRef.current?.resetCamera(); }}
          onViewTasks={onAgentClick ? (id) => { setSelectedId(null); onAgentClick(id); } : undefined}
          companyName={companyName}
        />
      )}
    </div>
  );

  return isMobile ? createPortal(worldPane, document.body) : worldPane;
});

export default BodestockWorldView;
