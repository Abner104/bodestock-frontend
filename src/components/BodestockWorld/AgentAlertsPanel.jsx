// src/components/BodestockWorld/AgentAlertsPanel.jsx
// Panel flotante con el chat (texto + voz) y las alertas/tareas de UN
// agente -- extraído de SuperAdminAgentRoom.jsx para que tanto el mapa 2D
// real (/super-admin/agentes) como la Ciudad 3D (/super-admin/ciudad-3d) lo
// usen sin duplicar este comportamiento. No depende de cómo se dibuja el
// mapa (Konva o Three.js): solo necesita companyId/agentId.
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, X, Check, Volume2, VolumeX } from 'lucide-react';
import { useVoiceOutput } from '../../hooks/useVoiceInput';
import { fetchAlerts, markAlertRead, syncLiveAlerts } from '../../agents/agentAlerts';
import { auditAccounting } from '../../agents/accountingAgent';
import AccountingFinanceTabs from '../accounting/AccountingFinanceTabs';
import ProductPricingSuggestions from '../pricing/ProductPricingSuggestions';
import InventorySuggestions from '../inventory/InventorySuggestions';
import FinanceSuggestions from '../finance/FinanceSuggestions';
import MarketingSuggestions from '../marketing/MarketingSuggestions';
import AgentHelpButton from './AgentHelpButton';
import AgentChatPanel from './AgentChatPanel';
import { agents as agentsData } from '../../data/agents';

// Agentes cuyas "tareas" se sincronizan EN VIVO al abrir el panel (no
// dependen solo de la corrida diaria en el backend, dailyAgentAnalysisScheduled,
// que hoy no conoce a estos agentes). Cada entrada corre su auditoría y
// guarda los hallazgos nuevos vía syncLiveAlerts antes de leer agent_alerts.
const LIVE_AUDIT_BY_AGENT = {
  accounting: auditAccounting,
};

function formatAlertDate(createdAt) {
  const date = createdAt?.toDate ? createdAt.toDate() : null;
  if (!date) return '';
  return date.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Contenido del panel de UN agente (chat + tareas + su vista especial) SIN
 * el wrapper de modal -- lo usa AgentAlertsPanel (mapa 2D, overlay con
 * fondo oscuro) y también Ciudad3DView (panel lateral glass propio), para
 * no tener dos estilos de "ventana" distintos compitiendo en la misma
 * pantalla cuando la Ciudad 3D es fullscreen.
 */
export function AgentAlertsContent({ companyId, companyName, agentId, realStatus, onCountChange, hideLiveView = false }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Mismo agente (color, avatar, nombre) que ya usa la ficha en el mapa --
  // una sola fuente de verdad (agents.js) en vez de un mapeo local
  // duplicado, y así el panel hereda su identidad visual en vez de un
  // modal gris genérico sin relación con lo que se acaba de tocar.
  const agent = agentsData.find((a) => a.id === agentId);
  const accent = agent?.color || '#9aa5b8';
  const agentLabel = agent ? `Agente de ${agent.name}` : 'Agente';

  // El badge de estado en el mapa se calcula EN VIVO desde los datos
  // actuales (ver useAgentRealStatus.js); estas "tareas" en cambio son,
  // para los agentes SIN auditoría en vivo (ver LIVE_AUDIT_BY_AGENT), solo
  // lo que el análisis automático diario (dailyAgentAnalysisScheduled,
  // corre una vez por día) ya escribió a Firestore -- si algo cambió
  // después de esa corrida, o la alerta de hoy ya se generó sin esta
  // novedad, el badge puede decir ALERT mientras acá no hay nada
  // registrado todavía. Sin explicar esto, se lee como un bug ("dice que
  // hay algo pero no hay nada"). Los agentes con auditoría en vivo no
  // sufren este desfasaje (se sincronizan antes de leer), así que nunca
  // muestran este aviso. Pricing tampoco lo muestra: no tiene auditoría en
  // vivo tipo "findings", pero la sección de sugerencias por producto de
  // abajo (ProductPricingSuggestions) ya dice EXACTAMENTE cuál producto
  // está en pérdida/margen bajo con acción directa, así que este aviso
  // genérico ("1 en pérdida" sin decir cuál) quedaría redundante y peor.
  // Mismo caso para Inventario: InventorySuggestions ya dice cuál producto
  // falta reponer o no rota, con nombre y SKU.
  const AGENTS_WITH_OWN_LIVE_VIEW = ['pricing', 'inventory', 'finance', 'marketing'];
  const hasLiveAudit = Boolean(LIVE_AUDIT_BY_AGENT[agentId]);
  const showStaleNotice = !hasLiveAudit && !AGENTS_WITH_OWN_LIVE_VIEW.includes(agentId) && !loading && alerts.length === 0 && realStatus?.status === 'ALERT';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const runAudit = LIVE_AUDIT_BY_AGENT[agentId];
        if (runAudit) {
          const result = await runAudit({ companyId });
          await syncLiveAlerts(companyId, agentId, result.findings);
        }
        const list = await fetchAlerts(companyId);
        if (!cancelled) setAlerts(list.filter(a => a.agentId === agentId));
      } catch (e) {
        console.error('No se pudieron cargar las alertas:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [companyId, agentId]);

  // Confirmación visual momentánea al marcar como leída -- sin esto, el
  // único cambio era un tono de fondo casi imperceptible y el botón
  // desaparecía sin aviso, lo que se sentía como que el clic no había
  // hecho nada.
  const [justMarked, setJustMarked] = useState(null);
  // Historial de tareas ya resueltas -- colapsado por defecto, para que no
  // compita por espacio con lo que sí necesita atención ahora.
  const [showHistory, setShowHistory] = useState(false);

  // Voz por tarea -- una sola instancia de síntesis para todo el panel,
  // reutilizada tanto por cada botón de altavoz como (implícitamente) por
  // el toggle del chat de abajo, ver AgentChatPanel.
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: voiceOutputSupported } = useVoiceOutput();
  const [speakingAlertId, setSpeakingAlertId] = useState(null);

  useEffect(() => stopSpeaking, [stopSpeaking]);

  const handleToggleAlertVoice = (alert) => {
    if (isSpeaking && speakingAlertId === alert.id) {
      stopSpeaking();
      setSpeakingAlertId(null);
      return;
    }
    setSpeakingAlertId(alert.id);
    speak(alert.summary, { onEnd: () => setSpeakingAlertId(null) });
  };

  const handleMarkRead = async (alertId) => {
    setJustMarked(alertId);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true, readAt: { toDate: () => new Date() } } : a));
    onCountChange?.(agentId, -1);
    setTimeout(() => setJustMarked(null), 1200);
    try {
      await markAlertRead(companyId, alertId);
    } catch (e) {
      console.error('No se pudo marcar la alerta como leída:', e.message);
    }
  };

  const pending = alerts.filter(a => !a.read);
  const done = alerts.filter(a => a.read);

  const renderAlert = (alert) => {
    const isWarning = alert.severity === 'warning';
    // El backend solo guarda un párrafo largo (summary), sin título corto
    // aparte -- se separa la primera oración como encabezado destacado y
    // el resto como cuerpo, para que se entienda de un vistazo de qué se
    // trata antes de leer el párrafo completo.
    const sentences = alert.summary?.split(/(?<=[.!?])\s+/) || [];
    const headline = sentences[0] || alert.summary;
    const rest = sentences.slice(1).join(' ');
    return (
      <div
        key={alert.id}
        className={`rounded-lg border p-3 text-xs transition-colors ${alert.read ? 'border-white/[0.06] bg-white/[0.02]' : 'border-white/[0.12] bg-white/[0.05]'}`}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          {isWarning ? (
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          ) : (
            <Info className="w-3 h-3 text-zinc-400 shrink-0" />
          )}
          <span className="text-[10px] text-zinc-500">{formatAlertDate(alert.createdAt)}</span>
          {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          {voiceOutputSupported && (
            <button
              onClick={() => handleToggleAlertVoice(alert)}
              aria-label={speakingAlertId === alert.id && isSpeaking ? 'Detener lectura' : 'Escuchar esta tarea'}
              className="ml-auto shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors"
            >
              {speakingAlertId === alert.id && isSpeaking
                ? <VolumeX className="w-3 h-3" />
                : <Volume2 className="w-3 h-3" />}
            </button>
          )}
        </div>
        <p className={`font-semibold leading-snug ${alert.read ? 'text-zinc-300' : 'text-white'}`}>{headline}</p>
        {rest && (
          <p className={`mt-1 leading-relaxed ${alert.read ? 'text-zinc-500' : 'text-zinc-400'}`}>{rest}</p>
        )}
        {!alert.read && (
          <button
            onClick={() => handleMarkRead(alert.id)}
            className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
          >
            {justMarked === alert.id ? (
              <><Check className="w-3 h-3" /> Marcada como leída</>
            ) : (
              'Marcar como leída'
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2.5 mb-1">
        {agent?.image && (
          <div
            className="w-9 h-9 rounded-full shrink-0 overflow-hidden bg-black/30"
            style={{ boxShadow: `0 0 0 2px ${accent}55` }}
          >
            <img src={agent.image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <p className="text-sm font-bold text-white">{agentLabel}</p>
        <AgentHelpButton agentName={agent?.name} description={agent?.description} accent={accent} />
      </div>
      <p className="text-xs text-zinc-500 mb-3">{companyName}</p>

      <AgentChatPanel agentId={agentId} agentName={agentLabel} companyId={companyId} accent={accent} />

      {!AGENTS_WITH_OWN_LIVE_VIEW.includes(agentId) && (
      <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mt-4 pt-4 border-t border-white/[0.06] mb-2">Tareas de hoy</p>

      {loading && <p className="text-xs text-zinc-500 py-4 text-center">Cargando...</p>}

      {showStaleNotice ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs">
          <p className="text-amber-300 font-semibold mb-1.5">El mapa marca una alerta activa</p>
          <p className="text-zinc-200 font-semibold leading-relaxed mb-1.5">
            {realStatus?.summary || 'Hay una novedad detectada ahora mismo.'}
          </p>
          <p className="text-zinc-500 leading-relaxed">
            El resumen diario automático todavía no la registró como tarea — vuelve a revisar después de
            la próxima actualización (todos los días a las 7:00 a. m.).
          </p>
        </div>
      ) : (
        !loading && alerts.length === 0 && (
          <p className="text-xs text-zinc-500 py-4 text-center">Este agente no ha registrado tareas todavía.</p>
        )
      )}

      {!loading && pending.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Pendientes ({pending.length})</p>
          <div className="flex flex-col gap-2">{pending.map(renderAlert)}</div>
        </div>
      )}
      </>
      )}

      {/* Historial de tareas ya resueltas -- colapsado por defecto
          (mismo patrón que "Cierre de mes" y "Conciliar banco" en
          Contabilidad), se muestra para todos los agentes, incluidos
          los que tienen vista propia (Precios/Inventario/Finanzas),
          que solo ocultan "Tareas de hoy" en vivo (reemplazada por su
          propia vista). */}
      {!loading && done.length > 0 && (
        <div className={!AGENTS_WITH_OWN_LIVE_VIEW.includes(agentId) ? '' : 'mt-4 pt-4 border-t border-white/[0.06]'}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Historial ({done.length}) {showHistory ? '▲' : '▼'}
          </button>
          {showHistory && (
            <div className="flex flex-col gap-2 mt-2">{done.map(renderAlert)}</div>
          )}
        </div>
      )}

      {agentId === 'accounting' && (
        <div className="mt-2 pt-4 border-t border-white/[0.06] -mx-4 px-4">
          <AccountingFinanceTabs companyId={companyId} companyName={companyName} />
        </div>
      )}

      {agentId === 'pricing' && !hideLiveView && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] -mx-4 px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Sugerencias de precio</p>
          <ProductPricingSuggestions companyId={companyId} companyName={companyName} />
        </div>
      )}

      {agentId === 'inventory' && !hideLiveView && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] -mx-4 px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Qué reponer y qué no rota</p>
          <InventorySuggestions companyId={companyId} companyName={companyName} />
        </div>
      )}

      {agentId === 'finance' && !hideLiveView && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] -mx-4 px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Flujo de caja y simulador</p>
          <FinanceSuggestions companyId={companyId} companyName={companyName} />
        </div>
      )}

      {agentId === 'marketing' && !hideLiveView && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] -mx-4 px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Prospección y seguimiento</p>
          <MarketingSuggestions companyId={companyId} companyName={companyName} />
        </div>
      )}
    </>
  );
}

/**
 * Panel flotante (modal con fondo oscuro) que envuelve AgentAlertsContent --
 * usado por el mapa 2D real (SuperAdminAgentRoom.jsx), donde sigue
 * teniendo sentido una ventana superpuesta porque el resto del admin
 * (sidebar, header) queda visible alrededor.
 */
export default function AgentAlertsPanel({ companyId, companyName, agentId, realStatus, onClose, onCountChange }) {
  const agent = agentsData.find((a) => a.id === agentId);
  const accent = agent?.color || '#9aa5b8';

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4 pb-4 bg-black/50" onClick={onClose}>
      <div
        className="relative flex items-stretch w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[85vh] sm:max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(165deg, #16171f 0%, #0e0f15 100%)',
          border: `1px solid ${accent}33`,
          boxShadow: `0 12px 32px -8px ${accent}40, 0 0 0 1px rgba(255,255,255,0.03) inset`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Misma franja de acento que la ficha del agente en el mapa --
            continuidad visual entre "tocar el agente" y "ver sus tareas". */}
        <div className="w-1.5 shrink-0" style={{ background: accent }} />

        <div className="flex-1 min-w-0 p-4 pr-9 overflow-y-auto">
          <AgentAlertsContent
            companyId={companyId}
            companyName={companyName}
            agentId={agentId}
            realStatus={realStatus}
            onCountChange={onCountChange}
          />
        </div>

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
