// src/components/BodestockWorld/AgentChatPanel.jsx
// Chat real con UN agente del mapa (pricing/inventory/finance/marketing/
// accounting) -- responde con los datos reales de ESE agente (ver
// agentChat.js / functions/index.js:agentChat), y soporta voz con las
// mismas guardas que InventoryAssistant.jsx contra el loop TTS→STT→TTS:
// el micrófono se corta ANTES de que el asistente hable, y nunca se
// reactiva solo -- el usuario tiene que tocar el botón de nuevo.
import React, { useEffect, useRef, useState } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { chatWithAgent } from '../../agents/agentChat';
import { useVoiceInput, useVoiceOutput } from '../../hooks/useVoiceInput';

// Preguntas de ejemplo por agente, tocables, para el estado vacío del chat --
// sin esto quien lo abre ve solo una caja de texto sin ninguna pista de qué
// preguntar. Para Contabilidad se aprovecha también el conocimiento general
// nuevo del agente (ver AGENT_PROFILES.accounting.knowledge en
// functions/index.js), no solo sus datos cargados. Para el resto, derivadas
// del `role` ya definido de cada uno en ese mismo archivo.
const SUGGESTED_QUESTIONS = {
  accounting: [
    '¿Cuánto gané este mes?',
    '¿Qué es el IVA?',
    '¿Qué gastos me faltan registrar?',
    'No entiendo el F29',
  ],
  pricing: [
    '¿Qué productos están en pérdida?',
    '¿Cuáles tienen margen muy bajo?',
    '¿Qué precio me recomiendas subir?',
  ],
  inventory: [
    '¿Qué productos están sin stock?',
    '¿Qué debería reponer ahora?',
    '¿Qué productos no rotan?',
  ],
  finance: [
    '¿Cómo va mi flujo de caja este mes?',
    '¿Cuánto llevo vendido este mes?',
    '¿En qué estoy gastando más?',
  ],
  marketing: [
    '¿Cuántos prospectos nuevos hay esta semana?',
    '¿Qué prospectos debería contactar primero?',
  ],
};

export default function AgentChatPanel({ agentId, agentName, companyId, accent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // la voz lee las respuestas por defecto; el botón de abajo la apaga si se prefiere silencio
  const messagesEndRef = useRef(null);

  const { isListening, transcript, isSupported: voiceInputSupported, startListening, stopListening, resetTranscript } = useVoiceInput();
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: voiceOutputSupported } = useVoiceOutput();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reflejar la transcripción en vivo en el campo de texto.
  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  // Auto-enviar cuando useVoiceInput deja de escuchar solo (speech_final
  // de Deepgram, o su fallback de silencio) y hay texto real.
  useEffect(() => {
    if (!isListening && transcript && transcript.trim().length > 2) {
      const timer = setTimeout(() => {
        handleSend(transcript);
        resetTranscript();
      }, 400);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, transcript]);

  // Leer la última respuesta en voz alta -- GUARDA contra el loop viejo:
  // corta el micrófono ANTES de hablar, y nada acá vuelve a prenderlo solo.
  useEffect(() => {
    if (!voiceEnabled || messages.length === 0 || isLoading) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant' || !last.content) return;
    stopListening();
    speak(last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceEnabled, isLoading]);

  // Cortar mic/voz al desmontar (ej. se cierra la ficha del agente).
  useEffect(() => () => {
    stopListening();
    stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await chatWithAgent({ agentId, companyId, message: content, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `No pude responder: ${err.message}`, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicClick = () => {
    if (isListening) { stopListening(); return; }
    if (isSpeaking) stopSpeaking();
    resetTranscript();
    setInput('');
    startListening();
  };

  const suggestions = SUGGESTED_QUESTIONS[agentId] || [];

  return (
    <div className="flex flex-col">
      <div className={`overflow-y-auto px-3 py-2 space-y-2 max-h-[320px] sm:max-h-[420px] ${messages.length === 0 ? '' : 'min-h-[80px]'}`}>
        {messages.length === 0 && (
          <div className="py-3 space-y-3">
            <p className="text-[11.5px] text-zinc-500 text-center">
              Preguntale algo a {agentName} sobre lo que ya sabe de esta empresa.
            </p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 px-2">
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    disabled={isLoading}
                    className="text-[11.5px] text-zinc-300 rounded-lg px-2.5 py-1.5 bg-white/[0.06] border transition-colors hover:bg-white/[0.1] disabled:opacity-50"
                    style={{ borderColor: `${accent || '#34d399'}40` }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                m.role === 'user'
                  ? 'text-white'
                  : m.isError ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-white/[0.06] text-zinc-200'
              }`}
              style={m.role === 'user' ? { background: accent || '#34d399' } : undefined}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.06] rounded-xl px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-white/[0.06]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={isListening ? 'Escuchando...' : 'Escribe o habla...'}
          disabled={isLoading}
          className="flex-1 min-w-0 text-[12.5px] bg-white/[0.06] border border-white/[0.08] text-zinc-100 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
        />

        {voiceOutputSupported && (
          <button
            type="button"
            onClick={() => { if (isSpeaking) stopSpeaking(); setVoiceEnabled((v) => !v); }}
            title={voiceEnabled ? 'Dejar de leer respuestas' : 'Leer respuestas en voz alta'}
            className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
              voiceEnabled ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1]'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        )}

        {voiceInputSupported && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isLoading}
            title={isListening ? 'Detener el micrófono' : 'Hablar'}
            className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1]'
            }`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-black disabled:opacity-40 transition-colors"
          style={{ background: accent || '#34d399' }}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
