// src/hooks/useVoiceInput.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../firebase/firebase';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';

// endpointing=1200: Deepgram marca speech_final tras ~1.2s de silencio real.
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen'
  + '?model=nova-3&language=es&smart_format=true&interim_results=true&punctuate=true&endpointing=1200';

// Respaldo del lado del cliente por si Deepgram no dispara speech_final:
// solo se resetea cuando llega texto real (ver onmessage), así que se
// dispara de forma confiable cuando de verdad no se dijo nada nuevo.
const SILENCE_FALLBACK_MS = 2500;

/**
 * Pide al backend una API key TEMPORAL de Deepgram (60s de vida, un solo uso).
 * La key maestra nunca sale del servidor — ver functions/index.js:getDeepgramToken.
 */
async function fetchTemporaryDeepgramKey() {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para usar el micrófono.');

  const idToken = await user.getIdToken();
  const response = await fetch(FUNCTIONS_ENDPOINTS.GET_DEEPGRAM_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo iniciar la sesión de voz.');
  }
  return data.key;
}

/**
 * Hook para reconocimiento de voz (Speech-to-Text) en tiempo real vía Deepgram.
 * Reemplaza el motor del navegador (Web Speech API) por streaming a Deepgram
 * Nova-3, con mucha mejor precisión en español y ambientes con ruido.
 *
 * Mantiene la misma forma que el hook anterior (isListening, transcript,
 * isSupported, startListening, stopListening, resetTranscript) para no
 * romper a quien ya lo consuma.
 */
export const useVoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const silenceTimerRef = useRef(null);
  const stopListeningRef = useRef(null); // se asigna abajo, evita dependencia circular

  useEffect(() => {
    const supported = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.WebSocket);
    setIsSupported(supported);
    if (!supported) {
      // getUserMedia solo existe en un "contexto seguro" -- https real o
      // localhost. Un IP directa como 127.0.0.1 con certificado
      // autofirmado no siempre cuenta como seguro según el navegador, y
      // ahí navigator.mediaDevices ni existe (no es un permiso denegado,
      // es que la API entera falta) -- de ahí el mensaje específico en vez
      // de un genérico "no soporta grabación" que no ayuda a diagnosticar.
      const isSecureContext = window.isSecureContext;
      console.warn(
        isSecureContext
          ? 'Este navegador no soporta grabación de audio (getUserMedia/MediaRecorder/WebSocket).'
          : 'El micrófono requiere un contexto seguro (https o localhost). Si estás en desarrollo con una IP como 127.0.0.1, usa https://localhost en su lugar.'
      );
    }

    return () => {
      cleanup();
    };
  }, []);

  /**
   * Cierra micrófono y socket. Si el socket seguía abierto, espera un margen
   * antes de cortarlo del todo para no perder la transcripción final pendiente
   * de Deepgram, y solo entonces marca isListening=false (onDrained).
   */
  const cleanup = (onDrained) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Avisa a Deepgram que no llega más audio y espera su transcripción
      // final pendiente antes de cortar — cerrar de inmediato la perdía.
      socket.send(JSON.stringify({ type: 'CloseStream' }));
      setTimeout(() => {
        socket.close();
        onDrained?.();
      }, 1500);
    } else {
      if (socket) socket.close();
      onDrained?.();
    }
  };

  const armSilenceFallback = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      stopListeningRef.current?.();
    }, SILENCE_FALLBACK_MS);
  };

  const startListening = useCallback(async () => {
    if (!isSupported) {
      alert('Tu navegador no soporta grabación de audio. Usa Chrome o Edge.');
      return;
    }

    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';

    try {
      const temporaryKey = await fetchTemporaryDeepgramKey();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const socket = new WebSocket(DEEPGRAM_WS_URL, ['token', temporaryKey]);
      socketRef.current = socket;

      socket.onopen = () => {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        mediaRecorder.start(250); // envía chunks cada 250ms para transcripción casi en vivo
        setIsListening(true);
        armSilenceFallback();
      };

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;

          // Solo cuenta como "actividad real" si vino texto de verdad — Deepgram
          // manda mensajes vacíos constantemente mientras hay silencio, y si esos
          // también resetean el fallback, el timer nunca llega a dispararse.
          if (alt.transcript) {
            armSilenceFallback();
          }

          if (data.is_final) {
            if (alt.transcript) {
              finalTranscriptRef.current = `${finalTranscriptRef.current} ${alt.transcript}`.trim();
              setTranscript(finalTranscriptRef.current);
            }
          } else {
            // resultado parcial: se muestra en vivo pero no se guarda como definitivo
            setTranscript(`${finalTranscriptRef.current} ${alt.transcript}`.trim());
          }

          // Deepgram detectó una pausa natural (endpointing) → se corta solo.
          if (data.speech_final) {
            stopListeningRef.current?.();
          }
        } catch (err) {
          console.error('Error procesando respuesta de Deepgram:', err);
        }
      };

      socket.onerror = (event) => {
        console.error('Error en conexión de voz:', event);
        setError('Se perdió la conexión con el servicio de voz.');
        setIsListening(false);
        cleanup();
      };

      socket.onclose = () => {
        setIsListening(false);
      };

    } catch (err) {
      console.error('Error al iniciar reconocimiento de voz:', err);
      if (err.name === 'NotAllowedError') {
        alert('Permiso de micrófono denegado. Por favor, habilita el acceso al micrófono.');
      } else {
        setError(err.message || 'No se pudo iniciar el micrófono.');
      }
      setIsListening(false);
      cleanup();
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    cleanup(() => setIsListening(false));
  }, []);
  stopListeningRef.current = stopListening;

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript
  };
};

/**
 * Hook para síntesis de voz (Text-to-Speech).
 * Permite que el agente "hable" las respuestas con voz natural de
 * ElevenLabs en vez de la voz robótica del navegador (SpeechSynthesisUtterance)
 * -- el backend (functions/index.js:textToSpeech) hace todo el trabajo con
 * la key secreta y devuelve el audio ya generado; acá solo se reproduce.
 * Mantiene la misma forma que el hook anterior (speak, stop, isSpeaking,
 * isSupported) para no romper a quien ya lo consuma.
 */
export const useVoiceOutput = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSupported = true; // fetch+Audio son universales, a diferencia de speechSynthesis
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);

  const releaseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => () => releaseAudio(), []);

  const speak = useCallback(async (text, options = {}) => {
    releaseAudio();
    setIsSpeaking(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Debes iniciar sesión para escuchar al agente.');
      const idToken = await user.getIdToken();

      const response = await fetch(FUNCTIONS_ENDPOINTS.TEXT_TO_SPEECH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo generar la voz.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      if (options.volume != null) audio.volume = options.volume;
      if (options.rate != null) audio.playbackRate = options.rate;

      audio.onended = () => {
        setIsSpeaking(false);
        options.onEnd?.();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        options.onEnd?.();
      };

      await audio.play();
    } catch (err) {
      console.error('Error en síntesis de voz:', err);
      setIsSpeaking(false);
      options.onEnd?.();
    }
  }, []);

  const stop = useCallback(() => {
    releaseAudio();
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported
  };
};

export default useVoiceInput;
