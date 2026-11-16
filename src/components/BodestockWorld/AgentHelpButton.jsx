// src/components/BodestockWorld/AgentHelpButton.jsx
// Botón (?) junto al nombre del agente en el panel del mapa: explica en
// 2-3 frases qué hace ese agente, con opción de escucharlo en voz. Mismo
// hook/guardas de voz que el resto de la app (useVoiceOutput, sin
// reactivar el micrófono solo). El texto vive en data/agents.js
// (agent.description), una sola fuente de verdad.
import { useState, useRef, useEffect } from 'react';
import { HelpCircle, Volume2, VolumeX, X } from 'lucide-react';
import { useVoiceOutput } from '../../hooks/useVoiceInput';

export default function AgentHelpButton({ agentName, description, accent }) {
  const [open, setOpen] = useState(false);
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: voiceOutputSupported } = useVoiceOutput();
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  if (!description) return null;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Qué hace el Agente de ${agentName}`}
        className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors shrink-0"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute z-20 top-full left-0 mt-2 w-72 rounded-xl p-3 shadow-2xl border"
          style={{ background: 'linear-gradient(165deg, #1a1b24 0%, #101117 100%)', borderColor: `${accent}40` }}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-xs font-semibold text-white">Qué hace el Agente de {agentName}</p>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[12px] text-zinc-300 leading-relaxed mb-2">{description}</p>
          {voiceOutputSupported && (
            <button
              onClick={() => (isSpeaking ? stopSpeaking() : speak(description))}
              className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isSpeaking ? 'Detener' : 'Escuchar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
