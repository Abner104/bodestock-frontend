// src/components/InventoryAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, User, Loader2, AlertCircle, CheckCircle, Trash2, Edit2, ExternalLink, ArrowRight, Package, ShoppingCart, Warehouse, TrendingUp, Calculator, BarChart2, UserPlus, AlertTriangle, ClipboardList, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { getUserCompanyId } from '../services/companyService';
import { API_URL } from '../config/env';
import { useVoiceInput, useVoiceOutput } from '../hooks/useVoiceInput';
// import Lottie from 'lottie-react';
// import { useAssistantContext, useRecentActions, formatContextForBackend } from '../hooks/useAssistantContext';
// import { useAssistantActions } from '../hooks/useAssistantActions';
// import QuickActions from './QuickActions';

const InventoryAssistant = ({ isOpen, onClose, userContext }) => {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState(userContext?.companyId || null);
  // const [robotAnimation, setRobotAnimation] = useState(null);

  // Lectura en voz alta apagada por defecto y siempre manual (toggle del
  // usuario) -- nunca se enciende sola. Esto es la guarda #1 contra el loop
  // viejo (ver comentario de "TTS→STT→TTS" más abajo): si el usuario no
  // pidió que le lean la respuesta, no hay audio de salida que el
  // micrófono pueda volver a escuchar.
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // TEMPORALMENTE DESACTIVADO - Causaba loops infinitos
  // const assistantContext = useAssistantContext(userContext);
  // const { actions: recentActions } = useRecentActions();
  // const { executeAction } = useAssistantActions();
  const { isListening, transcript, isSupported: voiceInputSupported, startListening, stopListening, resetTranscript } = useVoiceInput();
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: voiceOutputSupported } = useVoiceOutput();

  // Cargar animación Lottie - TEMPORALMENTE DESACTIVADO
  // useEffect(() => {
  //   fetch('https://assets9.lottiefiles.com/packages/lf20_abqysclq.json')
  //     .then(response => response.json())
  //     .then(data => setRobotAnimation(data))
  //     .catch(err => console.error('Error cargando animación:', err));
  // }, []);

  // Detectar si es usuario nuevo (primera vez que abre el asistente)
  const isNewUser = !localStorage.getItem('bodestock-assistant-used');

  // Cargar mensajes desde localStorage o usar mensaje inicial
  const getInitialMessages = () => {
    try {
      const saved = localStorage.getItem('assistantMessages');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }

    // Mensaje de onboarding para usuarios nuevos
    if (isNewUser) {
      return [
        {
          role: 'assistant',
          content: '¡Hola! 👋 Soy tu asistente IA de Bodestock y voy a acompañarte desde el primer día.\n\nEstoy aquí 24/7 para ayudarte con todo lo que necesites — desde configurar tu negocio hasta responder dudas en segundos.\n\n**Para empezar bien, dime:**\n¿Qué tipo de negocio tenés? (restaurante, almacén, panadería, bar, otro...)\n\nCon eso te voy a guiar paso a paso para dejarlo todo configurado. 🚀',
          timestamp: new Date(),
          isOnboarding: true
        }
      ];
    }

    // Mensaje normal para usuarios que vuelven
    return [
      {
        role: 'assistant',
        content: '¡Hola! 👋 Soy tu asistente inteligente de Bodestock. ¿En qué puedo ayudarte hoy?\n\nPuedo ayudarte con:\n• Costear productos paso a paso 🧮💰\n• Crear y gestionar bodegas 📦\n• Agregar productos al inventario 🏷️\n• Crear trabajadores y asignar roles 👥\n• Importar/exportar desde Excel 📊\n• Organizar tu stock y salidas 📋',
        timestamp: new Date()
      }
    ];
  };

  const [messages, setMessages] = useState(getInitialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState({ step: '', progress: 0 }); // Estado de progreso detallado
  const [confirmModal, setConfirmModal] = useState(null); // Modal de confirmación para ejecutar acciones
  const [isExecuting, setIsExecuting] = useState(false); // Estado de ejecución
  const [editingMessageIndex, setEditingMessageIndex] = useState(null); // Índice del mensaje que se está editando
  const [editingContent, setEditingContent] = useState(''); // Contenido temporal mientras se edita
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Guardar mensajes en localStorage cada vez que cambien
  useEffect(() => {
    try {
      localStorage.setItem('assistantMessages', JSON.stringify(messages));
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }, [messages]);

  // Cargar companyId si no está disponible
  useEffect(() => {
    const loadCompanyId = async () => {
      if (!companyId && isOpen) {
        try {
          const cid = await getUserCompanyId();
          setCompanyId(cid);
        } catch (error) {
          console.error('Error obteniendo companyId:', error);
        }
      }
    };
    loadCompanyId();
  }, [isOpen, companyId]);

  // Actualizar input en vivo mientras se habla -- transcript ya viene de
  // Deepgram (useVoiceInput), que distingue parcial de final internamente;
  // acá solo se refleja en el campo de texto para que el usuario vea lo
  // que se está transcribiendo, igual que si lo estuviera tipeando.
  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  // Generar bienvenida dinámica para usuarios nuevos cuando se abre el asistente
  useEffect(() => {
    if (!isOpen || !isNewUser) return;
    // Solo si el único mensaje es el hardcodeado de onboarding (aún no hubo respuesta dinámica)
    if (messages.length !== 1 || messages[0].role !== 'assistant' || messages[0]._dynamic) return;
    const cid = companyId || userContext?.companyId;
    if (!cid) return;

    const generateWelcome = async () => {
      setIsLoading(true);
      setLoadingState({ step: 'Preparando tu bienvenida...', progress: 20 });
      try {
        const ctx = {
          companyId: cid,
          companyName: userContext?.companyName || '',
          userRole: userContext?.userRole || 'ADMIN',
          page: 'Dashboard',
          isOnboarding: true,
          inventorySnapshot: userContext?.inventorySnapshot || '',
          totalProducts: userContext?.totalProducts || 0,
          totalInventories: userContext?.totalInventories || 0,
        };

        const response = await fetch(`${API_URL}/api/assistant/inventory/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '__onboarding_welcome__',
            context: ctx,
            conversationHistory: []
          })
        });

        if (!response.ok) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let welcomeText = '';

        // Reemplazar el mensaje hardcodeado con uno en streaming
        setMessages([{ role: 'assistant', content: '', streaming: true, _dynamic: true, timestamp: new Date() }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'chunk') {
                welcomeText += event.text;
                setMessages([{ role: 'assistant', content: welcomeText, streaming: true, _dynamic: true, timestamp: new Date() }]);
              } else if (event.type === 'done') {
                setMessages([{ role: 'assistant', content: welcomeText, streaming: false, _dynamic: true, timestamp: new Date(), actions: event.actions || [] }]);
              }
            } catch { /* ignorar */ }
          }
        }
      } catch (err) {
        console.error('Error generando bienvenida:', err);
        // Dejar el mensaje hardcodeado si falla
      } finally {
        setIsLoading(false);
        setLoadingState({ step: '', progress: 100 });
      }
    };

    // Pequeño delay para que el panel termine de abrirse
    const timer = setTimeout(generateWelcome, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, companyId]);

  // Auto-enviar cuando termina de escuchar -- useVoiceInput ya corta
  // isListening solo (speech_final de Deepgram, o el fallback de silencio),
  // así que "dejó de escuchar y hay texto" es una señal confiable de que
  // el usuario terminó de hablar, no un cambio a mitad de frase.
  useEffect(() => {
    if (!isListening && transcript && transcript.length > 3) {
      const timer = setTimeout(() => {
        handleSendMessage();
        resetTranscript();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, transcript]);

  // Leer respuestas del asistente en voz alta -- GUARDA CONTRA EL LOOP
  // VIEJO (bug real: el asistente hablaba con el micrófono todavía
  // escuchando, así que se transcribía a sí mismo y volvía a responder en
  // bucle sin que nadie dijera nada más). El fix tiene dos partes:
  // 1. stopListening() ANTES de speak() -- el micrófono nunca está activo
  //    mientras el parlante suena, así que no hay nada que "escucharse".
  // 2. Nada en este archivo vuelve a llamar startListening()
  //    automáticamente después de que termina de hablar (onEnd de speak
  //    más abajo no la reactiva) -- el usuario tiene que tocar el botón de
  //    nuevo para volver a hablar, a propósito.
  useEffect(() => {
    if (!voiceEnabled || messages.length === 0 || isLoading) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant' || !lastMessage.content) return;
    stopListening();
    speak(lastMessage.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceEnabled, isLoading]);

  // Focus en input cuando se abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cortar micrófono y voz al cerrar el asistente (o desmontar el
  // componente) -- sin esto, cerrar el panel mientras se está escuchando o
  // hablando dejaría el micrófono abierto o el audio sonando de fondo sin
  // ninguna UI visible para pararlo.
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      stopSpeaking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => () => {
    stopListening();
    stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Marcar que ya interactuó — próxima vez verá el saludo normal, no el onboarding
    localStorage.setItem('bodestock-assistant-used', 'true');

    const userMessage = { role: 'user', content: input, timestamp: new Date() };
    const currentInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingState({ step: 'Analizando tu consulta...', progress: 20 });

    // Agregar mensaje vacío del asistente que iremos llenando con chunks
    setMessages(prev => [...prev, { role: 'assistant', content: '', actions: [], timestamp: new Date(), streaming: true }]);

    try {
      const simpleContext = {
        companyId,
        page: userContext?.page || '/',
        ...userContext,
        isOnboarding: isNewUser && messages.length <= 2
      };

      const response = await fetch(`${API_URL}/api/assistant/inventory/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          context: simpleContext,
          conversationHistory: messages.slice(-10)
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Guardar línea incompleta

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'chunk') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) {
                  updated[updated.length - 1] = { ...last, content: last.content + event.text };
                }
                return updated;
              });
            } else if (event.type === 'step') {
              setLoadingState({ step: event.step, progress: 60 });
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) {
                  const existing = last.steps || [];
                  updated[updated.length - 1] = { ...last, steps: [...existing, event.step] };
                }
                return updated;
              });
            } else if (event.type === 'done') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) {
                  updated[updated.length - 1] = { ...last, actions: event.actions || [], streaming: false };
                }
                return updated;
              });
              setLoadingState({ step: '', progress: 100 });
              // Refrescar datos en la UI si hubo mutación (producto creado, stock actualizado, etc.)
              if (event.refresh) {
                window.dispatchEvent(new CustomEvent('bodestock:dataChanged', { detail: { source: 'assistant' } }));
              }
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // Ignorar líneas mal formadas
          }
        }
      }

    } catch (error) {
      console.error('Error en stream del asistente:', error);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming || last?.content === '') {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Lo siento, tuve un problema al procesar tu mensaje. ¿Puedes intentarlo de nuevo?',
            timestamp: new Date(),
            streaming: false
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setLoadingState({ step: '', progress: 0 });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleActionClick = (action) => {
    if (action.type === 'fill') {
      setInput(action.text);
    } else if (action.type === 'execute') {
      setConfirmModal(action);
    } else if (action.type === 'openProductModal') {
      // Abrir modal de producto con datos pre-rellenados
      window.dispatchEvent(new CustomEvent('assistant:openProductModal', {
        detail: { mode: 'add', data: action.data }
      }));
      onClose(); // Cerrar el agente para ver el modal
    } else if (action.type === 'openPurchaseModal') {
      window.dispatchEvent(new CustomEvent('assistant:openPurchaseModal', {
        detail: action.data
      }));
      onClose();
    } else if (action.type === 'openWarehouseModal') {
      window.dispatchEvent(new CustomEvent('assistant:openWarehouseModal', {
        detail: action.data
      }));
      onClose();
    } else if (action.type === 'navigate') {
      // Navegar a otra página
      const path = action.url || action.data?.path || '/inventario';
      navigate(path);
      onClose(); // Cerrar el agente después de navegar
    }
  };

  const handleConfirmExecution = async () => {
    if (!confirmModal) return;

    setIsExecuting(true);

    try {
      // Llamar al backend para ejecutar la acción
      const response = await fetch(`${API_URL}/api/assistant/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: confirmModal.toolName,
          toolId: confirmModal.toolId,
          params: confirmModal.params,
          userContext: userContext
        })
      });

      const data = await response.json();

      if (data.success) {
        // Agregar mensaje de éxito
        const successMessage = {
          role: 'assistant',
          content: `✅ ${data.message}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);

        // Cerrar modal
        setConfirmModal(null);

        // Emitir evento para que los componentes con listener actualicen sus datos
        window.dispatchEvent(new CustomEvent('bodestock:dataChanged', {
          detail: { type: 'inventory', action: data.action || 'update' }
        }));
      } else {
        // Agregar mensaje de error
        const errorMessage = {
          role: 'assistant',
          content: `❌ Error: ${data.message}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setConfirmModal(null);
      }
    } catch (error) {
      console.error('Error al ejecutar acción:', error);
      const errorMessage = {
        role: 'assistant',
        content: '❌ Hubo un error al ejecutar la acción. Por favor, intenta de nuevo.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setConfirmModal(null);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelExecution = () => {
    setConfirmModal(null);
  };

  const handleClearConversation = () => {
    const initialMessage = {
      role: 'assistant',
      content: '¡Hola! 👋 Soy tu asistente inteligente de Bodestock. ¿En qué puedo ayudarte hoy?\n\nPuedo ayudarte con:\n• Costear productos paso a paso 🧮💰\n• Crear y gestionar bodegas 📦\n• Agregar productos al inventario 🏷️\n• Crear trabajadores y asignar roles 👥\n• Importar/exportar desde Excel 📊\n• Organizar tu stock y salidas 📋',
      timestamp: new Date()
    };
    setMessages([initialMessage]);
    localStorage.setItem('assistantMessages', JSON.stringify([initialMessage]));
  };

  const handleStartEdit = (index, content) => {
    setEditingMessageIndex(index);
    setEditingContent(content);
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (index) => {
    if (!editingContent.trim()) return;

    // Actualizar el mensaje editado
    const updatedMessages = [...messages];
    updatedMessages[index] = {
      ...updatedMessages[index],
      content: editingContent,
      edited: true
    };

    // Eliminar todos los mensajes después del editado (para regenerar la conversación)
    const newMessages = updatedMessages.slice(0, index + 1);
    setMessages(newMessages);
    setEditingMessageIndex(null);
    setEditingContent('');

    // Si es un mensaje de usuario, reenviar a la IA
    if (updatedMessages[index].role === 'user') {
      setIsLoading(true);

      try {
        // Separar el mensaje editado del historial previo
        const editedMessage = updatedMessages[index].content;
        const previousMessages = newMessages.slice(0, -1); // Todo excepto el último (el editado)

        const response = await fetch(`${API_URL}/api/assistant/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: editedMessage, // El mensaje editado
            conversationHistory: previousMessages, // El historial previo
            context: {
              ...userContext,
              companyId: companyId
            }
          })
        });

        const data = await response.json();

        if (data.reply) {
          const assistantMessage = {
            role: 'assistant',
            content: data.reply,
            timestamp: new Date(),
            actions: data.actions || []
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } catch (error) {
        console.error('Error al reenviar mensaje editado:', error);
        const errorMessage = {
          role: 'assistant',
          content: '❌ Error al procesar tu mensaje editado. Por favor intenta de nuevo.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Sincronizar clase en body para que App.jsx pueda reaccionar con CSS
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('assistant-sidebar-open');
    } else {
      document.body.classList.remove('assistant-sidebar-open');
    }
    return () => document.body.classList.remove('assistant-sidebar-open');
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - solo móvil */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          />

          {/* Sidebar derecho en desktop / Bottom sheet en móvil */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl top-0 right-0 bottom-0 w-full md:top-16 md:w-[400px] md:rounded-l-2xl md:border-l md:border-gray-200"
          >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 md:p-5 text-white flex items-center justify-between flex-shrink-0 pt-safe">
            <div className="md:hidden w-full absolute top-0 left-0 flex justify-center pt-2">
              <div className="w-12 h-1 bg-white/30 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center overflow-hidden">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  Asistente de Inventario
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </h2>
                <p className="text-indigo-100 text-xs sm:text-sm">Siempre listo para ayudarte</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearConversation}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                title="Limpiar conversación"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="overflow-y-auto p-4 pb-4 space-y-4 bg-gray-50 flex-1 sm:flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
                  message.role === 'user'
                    ? 'bg-blue-600'
                    : 'bg-gradient-to-br from-indigo-600 to-purple-600'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message bubble */}
                <div className="flex-1 max-w-[80%]">
                  {editingMessageIndex === index ? (
                    // Modo edición
                    <div className={`rounded-2xl p-3 sm:p-4 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white ml-auto'
                        : 'bg-white shadow-sm border border-gray-200'
                    }`}>
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className={`w-full text-sm sm:text-base p-2 rounded-lg resize-none ${
                          message.role === 'user'
                            ? 'bg-blue-700 text-white placeholder-blue-200'
                            : 'bg-gray-50 text-gray-900 placeholder-gray-400'
                        }`}
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleSaveEdit(index)}
                          className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition ${
                            message.role === 'user'
                              ? 'bg-white text-blue-600 hover:bg-blue-50'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          Guardar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition ${
                            message.role === 'user'
                              ? 'bg-blue-700 text-white hover:bg-blue-800'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Modo normal
                    <>
                      <div className={`rounded-2xl p-3 sm:p-4 relative group ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white ml-auto'
                          : 'bg-white shadow-sm border border-gray-200'
                      }`}>

                        {/* Steps timeline — solo mensajes del asistente con steps */}
                        {message.role === 'assistant' && message.steps && message.steps.length > 0 && (
                          <div className="mb-3 space-y-1.5">
                            {message.steps.map((step, si) => {
                              const isLast = si === message.steps.length - 1;
                              const isDone = !message.streaming;
                              return (
                                <motion.div
                                  key={si}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="flex items-center gap-2"
                                >
                                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isDone || !isLast
                                      ? 'bg-emerald-100'
                                      : 'bg-indigo-100'
                                  }`}>
                                    {isDone || !isLast ? (
                                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
                                    )}
                                  </div>
                                  <span className={`text-xs ${
                                    isDone || !isLast ? 'text-emerald-700' : 'text-indigo-600 font-medium'
                                  }`}>
                                    {step}
                                  </span>
                                </motion.div>
                              );
                            })}
                            {/* Separador si hay texto debajo */}
                            {message.content && (
                              <div className="border-t border-gray-100 pt-2 mt-2" />
                            )}
                          </div>
                        )}

                        <p className="text-sm sm:text-base whitespace-pre-wrap">
                          {message.content}
                          {/* Cursor parpadeante mientras streamea */}
                          {message.streaming && (
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 align-middle"
                            />
                          )}
                          {message.edited && <span className="text-xs opacity-70 ml-2">(editado)</span>}
                        </p>

                        {/* Botón de editar (solo para mensajes de usuario y no el inicial) */}
                        {message.role === 'user' && index > 0 && (
                          <button
                            onClick={() => handleStartEdit(index, message.content)}
                            className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                              message.role === 'user'
                                ? 'bg-blue-700 hover:bg-blue-800'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                            title="Editar mensaje"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Action buttons */}
                      {message.actions && message.actions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mt-3 flex flex-wrap gap-2"
                        >
                          {message.actions.map((action, idx) => {
                            // Determinar icono según el tipo de acción
                            const getActionIcon = () => {
                              if (action.type === 'openProductModal') return <Package className="w-3 h-3 sm:w-4 sm:h-4" />;
                              if (action.type === 'openPurchaseModal') return <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />;
                              if (action.type === 'openWarehouseModal') return <Warehouse className="w-3 h-3 sm:w-4 sm:h-4" />;
                              if (action.type === 'navigate') return <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />;
                              return <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />;
                            };

                            return (
                              <motion.button
                                key={idx}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleActionClick(action)}
                                className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-xs sm:text-sm font-medium hover:from-indigo-600 hover:to-purple-600 transition shadow-md hover:shadow-lg flex items-center gap-2"
                              >
                                {getActionIcon()}
                                <span>{action.label}</span>
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      )}

                      <p className="text-xs text-gray-400 mt-1">
                        {message.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Quick Actions contextuales — cambian según la página */}
            {!isLoading && messages.length <= 2 && (() => {
              const page = userContext?.page || '/';
              const quickActions = {
                '/inventario': [
                  { icon: <Package className="w-3 h-3" />, label: 'Agregar producto', text: 'Quiero agregar un nuevo producto al inventario' },
                  { icon: <ShoppingCart className="w-3 h-3" />, label: 'Registrar compra', text: 'Quiero registrar una compra de stock' },
                  { icon: <AlertTriangle className="w-3 h-3" />, label: 'Stock bajo', text: '¿Qué productos tienen stock bajo?' },
                  { icon: <TrendingUp className="w-3 h-3" />, label: 'Más vendidos', text: '¿Cuáles son mis productos más consumidos?' },
                ],
                '/costeo': [
                  { icon: <Calculator className="w-3 h-3" />, label: 'Costear producto', text: 'Ayúdame a costear un producto nuevo' },
                  { icon: <TrendingUp className="w-3 h-3" />, label: 'Mejor margen', text: '¿Qué producto me deja más margen de ganancia?' },
                  { icon: <Package className="w-3 h-3" />, label: 'Ver recetas', text: 'Muéstrame mis productos costeados' },
                ],
                '/': [
                  { icon: <BarChart2 className="w-3 h-3" />, label: 'Resumen del día', text: 'Dame un resumen de hoy: stock, movimientos y alertas' },
                  { icon: <AlertTriangle className="w-3 h-3" />, label: 'Ver alertas', text: '¿Qué alertas tengo activas?' },
                  { icon: <TrendingUp className="w-3 h-3" />, label: 'Análisis rápido', text: 'Analiza mi inventario y dime qué debo reponer' },
                ],
                '/trabajadores': [
                  { icon: <UserPlus className="w-3 h-3" />, label: 'Crear trabajador', text: 'Quiero crear un nuevo trabajador' },
                  { icon: <ClipboardList className="w-3 h-3" />, label: 'Ver roles', text: '¿Qué roles y permisos tengo disponibles?' },
                ],
                '/historial': [
                  { icon: <BarChart2 className="w-3 h-3" />, label: 'Resumen semana', text: 'Dame un resumen de los movimientos de esta semana' },
                  { icon: <TrendingUp className="w-3 h-3" />, label: 'Tendencias', text: '¿Qué productos tienen mayor consumo últimamente?' },
                  { icon: <ClipboardList className="w-3 h-3" />, label: 'Exportar', text: '¿Cómo exporto el historial a Excel?' },
                ],
              };

              // Buscar la key más específica que coincida con la ruta actual
              const matchKey = Object.keys(quickActions).find(k => k !== '/' && page.startsWith(k))
                || (quickActions[page] ? page : '/');
              const chips = quickActions[matchKey] || quickActions['/'];

              return (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-1 pb-2"
                >
                  <p className="text-xs text-gray-400 mb-2 px-1">Acciones rápidas</p>
                  <div className="flex flex-wrap gap-2">
                    {chips.map((chip, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setInput(chip.text)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium transition border border-indigo-100"
                      >
                        {chip.icon}
                        {chip.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              );
            })()}

            {/* Spinner de carga solo si no hay mensaje streaming activo (ej: delay inicial) */}
            {isLoading && !messages.some(m => m.streaming) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex-1">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-sm text-gray-600">{loadingState.step || 'Conectando...'}</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 sm:p-4 bg-white border-t border-gray-200 flex-shrink-0 sticky bottom-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isListening ? 'Escuchando...' : 'Escribe tu pregunta...'}
                disabled={isLoading}
                className="flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-gray-100 rounded-xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition text-sm"
              />

              {voiceOutputSupported && (
                <button
                  type="button"
                  onClick={() => {
                    // Apagar mientras habla corta el audio en el momento,
                    // no solo evita la próxima lectura.
                    if (isSpeaking) stopSpeaking();
                    setVoiceEnabled((v) => !v);
                  }}
                  title={voiceEnabled ? 'Dejar de leer respuestas en voz alta' : 'Leer respuestas en voz alta'}
                  className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl transition flex items-center justify-center ${
                    voiceEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              )}

              {voiceInputSupported && (
                <button
                  onClick={() => {
                    if (isListening) {
                      stopListening();
                      return;
                    }
                    // Tocar el micrófono mientras el asistente habla lo
                    // interrumpe primero -- nunca hay audio de salida y
                    // entrada al mismo tiempo, ni por accidente.
                    if (isSpeaking) stopSpeaking();
                    resetTranscript();
                    setInput('');
                    startListening();
                  }}
                  disabled={isLoading}
                  title={isListening ? 'Detener el micrófono' : 'Hablar en vez de escribir'}
                  className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl transition flex items-center justify-center disabled:opacity-50 ${
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              )}

              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

        {/* Modal de Confirmación para Ejecutar Acción */}
        <AnimatePresence>
          {confirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              onClick={handleCancelExecution}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Confirmar Acción</h3>
                    <p className="text-sm text-gray-500">Revisa los datos antes de continuar</p>
                  </div>
                </div>

                {/* Mostrar parámetros de la acción */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {confirmModal.toolName === 'crear_bodega' ? '📦 Nueva Bodega' :
                     confirmModal.toolName === 'crear_producto' ? '🏷️ Nuevo Producto' :
                     confirmModal.toolName === 'crear_trabajador' ? '👤 Nuevo Trabajador' :
                     '✨ Nueva Acción'}
                  </p>
                  {Object.entries(confirmModal.params).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm gap-2">
                      <span className="text-gray-600 capitalize">{key}:</span>
                      <span className="text-gray-900 font-medium text-right break-words">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCancelExecution}
                    disabled={isExecuting}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition disabled:opacity-50 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmExecution}
                    disabled={isExecuting}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirmar
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InventoryAssistant;
