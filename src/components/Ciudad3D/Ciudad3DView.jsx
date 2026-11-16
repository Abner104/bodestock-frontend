// Demo/propuesta de mapa 3D isométrico de la distribuidora (modelo hecho en
// Blender). Es una experiencia APARTE del mapa 2D real en /super-admin/agentes
// -- no lo reemplaza. Conecta los KPIs de cada agente a los datos reales de
// `companyId` vía cargarAgentesReales(), misma fuente de datos que usa
// SuperAdminAgentRoom.jsx.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { X } from 'lucide-react';
import Ciudad from './Ciudad.jsx';
import Lluvia from './Lluvia.jsx';
import { AGENTES as AGENTES_INICIAL, BODESTOCK as BODESTOCK_INICIAL, cargarAgentesReales } from './agentes.js';
import { AgentAlertsContent } from '../BodestockWorld/AgentAlertsPanel.jsx';
import ProductPricingSuggestions from '../pricing/ProductPricingSuggestions';
import InventorySuggestions from '../inventory/InventorySuggestions';
import FinanceSuggestions from '../finance/FinanceSuggestions';
import MarketingSuggestions from '../marketing/MarketingSuggestions';
import { useAgentRealStatus } from '../../hooks/useAgentRealStatus';
import { fetchUnreadAlertsCountByAgent } from '../../agents/agentAlerts';
import './ciudad3d.css';

// Mismos 4 agentes con "vista propia" que AgentAlertsPanel.jsx
// (AGENTS_WITH_OWN_LIVE_VIEW) -- acá se usan para mostrar su lectura real
// (análisis con IA sobre datos de la empresa) directo en la pestaña
// "Resumen", en vez de esconderla detrás de "Hablar y tareas". El chat y
// las tareas pendientes de esos agentes siguen solo en "Hablar y tareas".
const RESUMEN_LIVE_VIEW_BY_AGENT = {
  pricing: ProductPricingSuggestions,
  inventory: InventorySuggestions,
  finance: FinanceSuggestions,
  marketing: MarketingSuggestions,
};

function useViewport() {
  const leer = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [vp, setVp] = useState(leer);
  useEffect(() => {
    const f = () => setVp(leer());
    window.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); };
  }, []);
  return vp;
}

// El brillo (bloom) sube de noche, para que los tubos y la esfera resplandezcan.
function Brillo({ nv }) {
  const ref = useRef();
  useFrame(() => { if (ref.current) ref.current.intensity = 0.3 + 0.95 * nv.current; });
  return <Bloom ref={ref} mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.25} />;
}

function Cargando() {
  const { progress, active } = useProgress();
  const [visible, setVisible] = useState(true);
  useEffect(() => { if (!active && progress >= 100) { const t = setTimeout(() => setVisible(false), 400); return () => clearTimeout(t); } }, [active, progress]);
  if (!visible) return null;
  return (
    <div className="ciudad3d-cargando" data-hecho={!active && progress >= 100}>
      <img src="/logobode.png" alt="Bodestock" />
      <div className="ciudad3d-barra"><i style={{ width: `${Math.round(progress)}%` }} /></div>
      <span>Cargando ciudad… {Math.round(progress)}%</span>
    </div>
  );
}

// Panel lateral con el mismo "vidrio" que el resto de la ciudad 3D -- dos
// pestañas (Resumen / Hablar y tareas) en vez de un segundo overlay tipo
// modal encima de la escena, para que no se sienta como dos interfaces
// distintas pegadas una sobre la otra.
function Panel({ ag, onClose, onSelect, sheet, agentes, companyId, companyName, realStatus, onUnreadCountChange }) {
  const [tab, setTab] = useState('resumen');
  const puedeHablar = ag.id !== 'bodestock';

  useEffect(() => { setTab('resumen'); }, [ag.id]);

  return (
    <aside className={'ciudad3d-panel ' + (sheet ? 'hoja' : 'lado')} style={{ '--c': ag.color }} role="dialog" aria-label={ag.nombre}>
      <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
      <div className="cab">
        <span className="punto" />
        <div>
          <h2>{ag.nombre}</h2>
          <p className="frase">{ag.frase}</p>
        </div>
      </div>

      {puedeHablar && (
        <div className="tabs">
          <button className={tab === 'resumen' ? 'act' : ''} onClick={() => setTab('resumen')}>Resumen</button>
          <button className={tab === 'hablar' ? 'act' : ''} onClick={() => setTab('hablar')}>Hablar y tareas</button>
        </div>
      )}

      {tab === 'resumen' || !puedeHablar ? (
        <>
          <div className="kpis">
            {ag.kpis.map((k) => (
              <div className="kpi" key={k.label}>
                <small>{k.label}</small>
                <b>{k.valor}</b>
                {k.delta && <em>{k.delta}</em>}
              </div>
            ))}
          </div>

          {RESUMEN_LIVE_VIEW_BY_AGENT[ag.id] && (() => {
            const LiveView = RESUMEN_LIVE_VIEW_BY_AGENT[ag.id];
            return (
              <div className="ciudad3d-contenido-chat">
                <LiveView companyId={companyId} companyName={companyName} />
              </div>
            );
          })()}

          <h3>Qué hace en tu distribuidora</h3>
          <ul>{ag.que.map((q) => <li key={q}>{q}</li>)}</ul>
          {!sheet && (
            <div className="acciones">
              <div className="otros">
                {agentes.filter((a) => a.id !== ag.id).map((a) => (
                  <button key={a.id} style={{ '--c': a.color }} onClick={() => onSelect(a.id)}>{a.nombre}</button>
                ))}
              </div>
            </div>
          )}
          <small className="nota">Propuesta / demo visual · datos reales de tu distribuidora.</small>
        </>
      ) : (
        <div className="ciudad3d-contenido-chat">
          <AgentAlertsContent
            companyId={companyId}
            companyName={companyName}
            agentId={ag.id}
            realStatus={realStatus}
            onCountChange={onUnreadCountChange}
            hideLiveView={Boolean(RESUMEN_LIVE_VIEW_BY_AGENT[ag.id])}
          />
        </div>
      )}
    </aside>
  );
}

export default function Ciudad3DView({ companyId, companyName, companies = [], onSelectCompany, onClose }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  // Pausa el loop de render de R3F ANTES de desmontar el Canvas -- sin
  // esto, salir de la ciudad (o navegar a otra ruta) puede desmontar el
  // Canvas mientras el requestAnimationFrame interno de R3F sigue corriendo
  // un frame, y React 19 tira "Attempted to synchronously unmount a root
  // while React was already rendering" (bug conocido de R3F v9 + React 19
  // con componentes que se desmontan a mitad de un frame activo).
  const [saliendo, setSaliendo] = useState(false);
  const [night, setNight] = useState(() => { const h = new Date().getHours(); return h >= 19 || h < 7; });
  const [rain, setRain] = useState(false);
  const { w, h } = useViewport();
  const sheet = w < 820 || h > w; // móvil, o tablet vertical → panel como hoja inferior
  const compact = w < 820;
  const nv = useRef(night ? 1 : 0);

  const [agentes, setAgentes] = useState(AGENTES_INICIAL);
  const [bodestock, setBodestock] = useState(BODESTOCK_INICIAL);

  useEffect(() => {
    if (!companyId) return;
    let vivo = true;
    cargarAgentesReales(companyId).then(({ agentes, bodestock }) => {
      if (!vivo) return;
      setAgentes(agentes);
      setBodestock(bodestock);
    });
    return () => { vivo = false; };
  }, [companyId]);

  const porGrupo = useMemo(() => Object.fromEntries([...agentes, bodestock].map((a) => [a.grupo, a])), [agentes, bodestock]);
  const porId = useMemo(() => Object.fromEntries([...agentes, bodestock].map((a) => [a.id, a])), [agentes, bodestock]);

  // Mismo dato en vivo que ya usa el mapa 2D real (SuperAdminAgentRoom.jsx)
  // para decidir si AgentAlertsPanel muestra el aviso de "alerta activa
  // pero sin tarea registrada todavía" -- ver useAgentRealStatus.js.
  const { data: agentRealData } = useAgentRealStatus(companyId);
  const [unreadByAgent, setUnreadByAgent] = useState({});
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    fetchUnreadAlertsCountByAgent(companyId).then((counts) => {
      if (!cancelled) setUnreadByAgent({ accounting: counts.accounting || 0 });
    }).catch((e) => console.error('No se pudo cargar el conteo de alertas:', e.message));
    return () => { cancelled = true; };
  }, [companyId]);
  const adjustUnreadCount = (agentId, delta) => {
    setUnreadByAgent(prev => ({ ...prev, [agentId]: Math.max(0, (prev[agentId] || 0) + delta) }));
  };

  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const ag = selected ? porId[selected] : null;
  const salir = onClose || (() => navigate('/super-admin'));
  const handleClose = () => {
    setSaliendo(true);
    requestAnimationFrame(() => requestAnimationFrame(salir));
  };

  return (
    <div className="ciudad3d-app" data-night={night} data-sheet={sheet}>
      <Canvas
        orthographic
        frameloop={saliendo ? 'never' : 'always'}
        camera={{ position: [40, 40, 40], zoom: 20, near: 0.1, far: 400 }}
        dpr={[1, compact ? 1.5 : 2]}
        shadows={!compact}
        gl={{ antialias: !compact, toneMapping: THREE.NoToneMapping, powerPreference: 'high-performance' }}
        onPointerMissed={(e) => { if (e?.target?.closest?.('.etiqueta')) return; setSelected(null); }}
      >
        <Suspense fallback={null}>
          <Ciudad night={night} nv={nv} selected={selected} onSelect={setSelected} sheet={sheet} porGrupo={porGrupo} unreadByAgent={unreadByAgent} agentRealData={agentRealData} />
          <Lluvia activa={rain} />
          <EffectComposer multisampling={compact ? 0 : 4}>
            <Brillo nv={nv} />
          </EffectComposer>
        </Suspense>
      </Canvas>

      <header className="ciudad3d-barra-sup">
        <div className="marca">
          <button onClick={handleClose} aria-label="Salir" className="salir"><X /></button>
          <img src="/logobode.png" alt="Bodestock" />
          <span>Ciudad de agentes · propuesta</span>
          {companies.length > 0 && (
            <select
              value={companyId || ''}
              onChange={(e) => onSelectCompany?.(e.target.value)}
              aria-label="Empresa"
              className="empresa"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="controles">
          <button className={night ? 'on' : ''} onClick={() => setNight((v) => !v)} aria-pressed={night}>{night ? 'Noche' : 'Día'}</button>
          <button className={rain ? 'on' : ''} onClick={() => setRain((v) => !v)} aria-pressed={rain}>Lluvia</button>
        </div>
      </header>

      {ag && (
        <Panel
          ag={ag}
          sheet={sheet}
          onClose={() => setSelected(null)}
          onSelect={setSelected}
          agentes={agentes}
          companyId={companyId}
          companyName={companyName}
          realStatus={agentRealData[ag.id]}
          onUnreadCountChange={adjustUnreadCount}
        />
      )}

      <nav className="ciudad3d-chips" aria-label="Agentes">
        {agentes.map((a) => {
          const unread = unreadByAgent[a.id] || 0;
          return (
            <button key={a.id} className={selected === a.id ? 'act' : ''} style={{ '--c': a.color }} onClick={() => setSelected(selected === a.id ? null : a.id)}>
              <i />{a.nombre}
              {unread > 0 && <em className="badge">{unread}</em>}
            </button>
          );
        })}
      </nav>

      <Cargando />
    </div>
  );
}
