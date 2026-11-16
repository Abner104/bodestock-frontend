// src/components/costing/CostingAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Loader2, Bot, User, Calculator, Save, FolderOpen, Trash2, ChefHat, Search, DollarSign, Package, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { API_URL } from '../../config/env';

// Componente para renderizar mensajes con formato bonito
const FormattedMessage = ({ content, actionData, onFillWizard }) => {
  // Detectar si es una respuesta de costeo (tiene tablas markdown)
  const isCostingResponse = content.includes('|') && content.includes('Ingrediente');

  if (!isCostingResponse) {
    // Mensaje normal - solo formatear básico
    return (
      <div className="text-sm whitespace-pre-wrap leading-relaxed">
        {content.split('\n').map((line, i) => {
          // Títulos con ##
          if (line.startsWith('## ')) {
            return (
              <h3 key={i} className="text-lg font-bold text-gray-900 mt-2 mb-3 flex items-center gap-2">
                {line.replace('## ', '')}
              </h3>
            );
          }
          // Subtítulos con ###
          if (line.startsWith('### ')) {
            const text = line.replace('### ', '');
            const isSuccess = text.includes('✅');
            const isError = text.includes('❌');
            return (
              <h4 key={i} className={`text-sm font-bold mt-4 mb-2 flex items-center gap-2 ${
                isSuccess ? 'text-emerald-700' : isError ? 'text-red-600' : 'text-indigo-700'
              }`}>
                {text}
              </h4>
            );
          }
          // Líneas con **texto** (negrita)
          if (line.includes('**')) {
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
              <p key={i} className="my-1">
                {parts.map((part, j) =>
                  j % 2 === 1 ? <strong key={j} className="font-semibold text-gray-900">{part}</strong> : part
                )}
              </p>
            );
          }
          // Bullets
          if (line.startsWith('- ') || line.startsWith('• ')) {
            return (
              <p key={i} className="my-1 pl-4 flex items-start gap-2">
                <span className="text-indigo-500 mt-1">•</span>
                <span>{line.replace(/^[-•]\s*/, '')}</span>
              </p>
            );
          }
          // Líneas vacías
          if (line.trim() === '' || line === '---') {
            return <div key={i} className="h-2" />;
          }
          // Línea normal
          return <p key={i} className="my-1">{line}</p>;
        })}
      </div>
    );
  }

  // Es una respuesta de costeo - formato especial
  const lines = content.split('\n');
  const elements = [];
  let currentTable = [];
  let inTable = false;

  lines.forEach((line, i) => {
    // Título principal
    if (line.startsWith('## ')) {
      elements.push(
        <div key={`title-${i}`} className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-3 rounded-xl mb-4 flex items-center gap-3">
          <ChefHat className="w-6 h-6" />
          <span className="text-lg font-bold">{line.replace('## ', '')}</span>
        </div>
      );
      return;
    }

    // Subtítulos
    if (line.startsWith('### ')) {
      if (inTable && currentTable.length > 0) {
        elements.push(renderTable(currentTable, elements.length));
        currentTable = [];
        inTable = false;
      }

      const text = line.replace('### ', '');
      const isSuccess = text.includes('✅');
      const isError = text.includes('❌');
      const isMoney = text.includes('💰');

      elements.push(
        <div key={`subtitle-${i}`} className={`flex items-center gap-2 mt-4 mb-2 px-3 py-2 rounded-lg ${
          isSuccess ? 'bg-emerald-50 text-emerald-700' :
          isError ? 'bg-red-50 text-red-600' :
          isMoney ? 'bg-amber-50 text-amber-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {isSuccess && <CheckCircle2 className="w-5 h-5" />}
          {isError && <XCircle className="w-5 h-5" />}
          {isMoney && <DollarSign className="w-5 h-5" />}
          <span className="font-bold text-sm">{text.replace(/[✅❌💰]\s*/, '')}</span>
        </div>
      );
      return;
    }

    // Detectar inicio de tabla
    if (line.startsWith('|') && line.includes('Ingrediente')) {
      inTable = true;
      currentTable = [line];
      return;
    }

    // Continuar tabla
    if (inTable && line.startsWith('|')) {
      if (!line.includes('---')) { // Ignorar línea separadora
        currentTable.push(line);
      }
      return;
    }

    // Fin de tabla
    if (inTable && !line.startsWith('|')) {
      if (currentTable.length > 0) {
        elements.push(renderTable(currentTable, elements.length));
        currentTable = [];
      }
      inTable = false;
    }

    // Líneas con **texto**
    if (line.includes('**')) {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      elements.push(
        <p key={`line-${i}`} className="my-2 text-sm flex items-center gap-2">
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="font-bold text-gray-900">{part}</strong> : <span key={j}>{part}</span>
          )}
        </p>
      );
      return;
    }

    // Bullets
    if (line.startsWith('- ')) {
      elements.push(
        <p key={`bullet-${i}`} className="my-1.5 pl-3 flex items-start gap-2 text-sm">
          <Package className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">{line.replace('- ', '')}</span>
        </p>
      );
      return;
    }

    // Mensaje de éxito al final
    if (line.includes('✨')) {
      elements.push(
        <div key={`success-${i}`} className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">{line}</span>
        </div>
      );
      return;
    }

    // Pregunta al usuario
    if (line.includes('📝') || line.includes('?')) {
      elements.push(
        <div key={`question-${i}`} className="my-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
          <p className="text-sm text-blue-800">{line}</p>
        </div>
      );
      return;
    }

    // Líneas vacías o separadores
    if (line.trim() === '' || line === '---') {
      return;
    }

    // Línea normal
    if (line.trim()) {
      elements.push(<p key={`text-${i}`} className="my-1.5 text-sm text-gray-700">{line}</p>);
    }
  });

  // Renderizar tabla pendiente
  if (currentTable.length > 0) {
    elements.push(renderTable(currentTable, elements.length));
  }

  // Botón de acción
  if (actionData) {
    elements.push(
      <button
        key="action-btn"
        onClick={() => onFillWizard(actionData)}
        className="mt-4 w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center gap-3 hover:from-indigo-700 hover:to-purple-700 transition shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
      >
        <Calculator className="w-5 h-5" />
        <span className="font-bold">Cargar en el Wizard</span>
      </button>
    );
  }

  return <div>{elements}</div>;
};

// Función para renderizar tabla bonita
const renderTable = (tableLines, key) => {
  if (tableLines.length < 2) return null;

  const headers = tableLines[0].split('|').filter(h => h.trim()).map(h => h.trim());
  const rows = tableLines.slice(1).map(line =>
    line.split('|').filter(c => c.trim()).map(c => c.trim())
  );

  return (
    <div key={`table-${key}`} className="my-3 overflow-hidden rounded-xl border-2 border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
          <tr>
            {headers.map((header, i) => (
              <th key={i} className="px-3 py-2.5 text-left font-bold text-gray-700 text-xs uppercase tracking-wide">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-indigo-50/50 transition">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2.5 ${
                  j === 0 ? 'font-medium text-gray-900' :
                  cell.includes('$') ? 'font-semibold text-emerald-600' :
                  'text-gray-600'
                }`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CostingAssistant = ({ isOpen, onClose, onFillWizard, companyId, currentStep, plantilla }) => {
  // Mensaje inicial contextual según plantilla
  const getMensajeInicial = () => {
    const mensajesPorPlantilla = {
      bar: '¡Hola! 🍹 Soy tu asistente experto en costeo de bar.\n\n¿Qué cóctel o bebida quieres costear? Puedo ayudarte a:\n\n• Sugerir ingredientes y cantidades exactas\n• Calcular costo por trago (50-60ml)\n• Definir precio ideal (margen 150-200%)\n• Comparar con otros cócteles ya costeados',
      restaurante: '¡Hola! 🍽️ Soy tu asistente experto en costeo de restaurante.\n\n¿Qué plato quieres costear? Puedo ayudarte a:\n\n• Sugerir ingredientes y porciones\n• Calcular costo por plato\n• Definir precio ideal (margen 200-300%)\n• Comparar con platos similares',
      cafeteria: '¡Hola! ☕ Soy tu asistente experto en costeo de cafetería.\n\n¿Qué producto quieres costear? Puedo ayudarte a:\n\n• Sugerir ingredientes (café, leche, etc.)\n• Calcular costo por bebida o alimento\n• Definir precio ideal (margen 150-250%)\n• Comparar con productos similares',
      panaderia: '¡Hola! 🥐 Soy tu asistente experto en costeo de panadería.\n\n¿Qué producto de panadería quieres costear? Puedo ayudarte a:\n\n• Sugerir ingredientes y cantidades\n• Calcular costo por unidad o kg\n• Definir precio ideal (margen 150-250%)\n• Comparar con productos similares'
    };

    return mensajesPorPlantilla[plantilla] || '¡Hola! 👋 Soy tu asistente de costeo con IA.\n\n¿Qué producto quieres costear? Puedo ayudarte a:\n\n• Sugerir ingredientes típicos\n• Calcular cantidades recomendadas\n• Definir precio de venta ideal\n• Comparar con productos similares';
  };

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: getMensajeInicial(),
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Pensando...');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [conversationName, setConversationName] = useState('');
  const [savedConversations, setSavedConversations] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus en input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cargar conversaciones guardadas al abrir
  useEffect(() => {
    if (isOpen) {
      loadSavedConversations();
    }
  }, [isOpen]);

  // Cargar conversaciones del localStorage
  const loadSavedConversations = () => {
    try {
      const saved = localStorage.getItem(`costing_conversations_${companyId}`);
      if (saved) {
        const conversations = JSON.parse(saved);
        setSavedConversations(conversations);
      }
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
    }
  };

  // Guardar conversación actual
  const handleSaveConversation = () => {
    if (!conversationName.trim()) {
      alert('Por favor ingresa un nombre para la conversación');
      return;
    }

    try {
      const conversationData = {
        id: Date.now(),
        name: conversationName.trim(),
        messages: messages,
        plantilla: plantilla,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const saved = localStorage.getItem(`costing_conversations_${companyId}`);
      const conversations = saved ? JSON.parse(saved) : [];

      // Agregar nueva conversación
      conversations.unshift(conversationData);

      // Limitar a 20 conversaciones máximo
      if (conversations.length > 20) {
        conversations.pop();
      }

      localStorage.setItem(`costing_conversations_${companyId}`, JSON.stringify(conversations));
      setSavedConversations(conversations);
      setShowSaveModal(false);
      setConversationName('');

      alert(`✅ Conversación "${conversationData.name}" guardada exitosamente`);
    } catch (error) {
      console.error('Error guardando conversación:', error);
      alert('❌ Error al guardar la conversación');
    }
  };

  // Cargar una conversación guardada
  const handleLoadConversation = (conversation) => {
    setMessages(conversation.messages);
    setShowLoadModal(false);
    alert(`📂 Conversación "${conversation.name}" cargada`);
  };

  // Eliminar conversación
  const handleDeleteConversation = (conversationId) => {
    if (!confirm('¿Estás seguro de eliminar esta conversación?')) return;

    try {
      const saved = localStorage.getItem(`costing_conversations_${companyId}`);
      if (saved) {
        let conversations = JSON.parse(saved);
        conversations = conversations.filter(c => c.id !== conversationId);
        localStorage.setItem(`costing_conversations_${companyId}`, JSON.stringify(conversations));
        setSavedConversations(conversations);
        alert('🗑️ Conversación eliminada');
      }
    } catch (error) {
      console.error('Error eliminando conversación:', error);
      alert('❌ Error al eliminar la conversación');
    }
  };

  // Nueva conversación
  const handleNewConversation = () => {
    if (messages.length > 1) {
      if (!confirm('¿Iniciar una nueva conversación? Los mensajes actuales se perderán si no los guardas.')) {
        return;
      }
    }

    setMessages([{
      role: 'assistant',
      content: getMensajeInicial(),
      timestamp: new Date()
    }]);
  };

  // Búsqueda inteligente en tiempo real
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    // Limpiar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Si el input tiene al menos 2 caracteres, buscar
    if (value.length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`${API_URL}/api/assistant/smart-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: value,
              companyId: companyId,
              limit: 5
            })
          });

          const data = await response.json();
          if (data.success && data.results.length > 0) {
            setSearchSuggestions(data.results);
            setShowSuggestions(true);
          } else {
            setShowSuggestions(false);
          }
        } catch (error) {
          console.error('Error en búsqueda:', error);
        }
      }, 300); // Debounce de 300ms
    } else {
      setShowSuggestions(false);
    }
  };

  // Seleccionar sugerencia
  const handleSelectSuggestion = (suggestion) => {
    if (suggestion.tipo === 'insumo') {
      setInput(`¿Cuánto cuesta ${suggestion.nombre}? ¿Con qué puedo usarlo?`);
    } else {
      setInput(`Muéstrame la receta de ${suggestion.nombre}`);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Generar mensaje de carga dinámico basado en el input
  const getLoadingMessage = (userInput) => {
    const input = userInput.toLowerCase();

    // Detectar tipo de pregunta
    if (input.includes('costear') || input.includes('costo')) {
      const producto = input.replace(/quiero costear|costear|un|una|el|la|cuanto cuesta|costo de/gi, '').trim();
      if (producto) {
        return `Analizando receta de ${producto}...`;
      }
      return 'Preparando el costeo...';
    }

    if (input.includes('ingrediente') || input.includes('receta')) {
      return 'Buscando ingredientes en tu inventario...';
    }

    if (input.includes('precio') || input.includes('margen') || input.includes('utilidad')) {
      return 'Calculando precios sugeridos...';
    }

    if (input.includes('uso') || input.includes('ml') || input.includes('g ') || input.includes('gramos')) {
      return 'Calculando costos con tus cantidades...';
    }

    // Mensajes genéricos variados
    const mensajesGenericos = [
      'Analizando tu consulta...',
      'Revisando tu inventario...',
      'Preparando respuesta...',
      'Consultando recetas...'
    ];

    return mensajesGenericos[Math.floor(Math.random() * mensajesGenericos.length)];
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    // Generar mensaje de carga contextual
    setLoadingMessage(getLoadingMessage(input));

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Llamar al backend
      const response = await fetch(`${API_URL}/api/assistant/costing-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages.slice(-10),
          companyId,
          currentStep,
          plantilla: plantilla || null
        })
      });

      const data = await response.json();

      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        actionData: data.actionData, // Puede tener datos para pre-llenar el wizard
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: '❌ Lo siento, tuve un problema. ¿Puedes intentarlo de nuevo?',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFillWizardClick = (actionData) => {
    console.log('🎯 Datos recibidos del asistente:', actionData);

    // El backend devuelve { action: "fill_wizard", data: {...} }
    // Necesitamos pasar solo el objeto "data"
    const dataToFill = actionData.data || actionData;

    console.log('📦 Datos a llenar en wizard:', dataToFill);
    onFillWizard(dataToFill);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Asistente de Costeo IA
                </h2>
                <p className="text-indigo-100 text-sm">Powered by Claude 3.5 Haiku</p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSaveModal(true)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                title="Guardar conversación"
              >
                <Save className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setShowLoadModal(true)}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                title="Cargar conversación"
              >
                <FolderOpen className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleNewConversation}
                className="px-3 py-1.5 text-xs bg-white/20 hover:bg-white/30 rounded-lg transition text-white font-medium"
                title="Nueva conversación"
              >
                Nueva
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-500'
                    : 'bg-gradient-to-br from-indigo-600 to-purple-600'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Message bubble */}
                <div className="flex-1 max-w-[85%]">
                  <div className={`rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white ml-auto shadow-lg'
                      : 'bg-white shadow-md border border-gray-100'
                  }`}>
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <FormattedMessage
                        content={message.content}
                        actionData={message.actionData}
                        onFillWizard={handleFillWizardClick}
                      />
                    )}
                  </div>
                  <p className={`text-xs mt-1.5 px-2 ${message.role === 'user' ? 'text-right' : ''} text-gray-400`}>
                    {message.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 max-w-[80%]">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2.5 h-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2.5 h-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2.5 h-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{loadingMessage}</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  onFocus={() => input.length >= 2 && searchSuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Ej: Quiero costear un mojito cubano..."
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-gray-100 rounded-xl border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none transition text-sm"
                />

                {/* Sugerencias inteligentes */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-white border-2 border-indigo-200 rounded-lg shadow-xl overflow-hidden z-50"
                  >
                    <div className="p-2 bg-indigo-50 border-b border-indigo-200">
                      <p className="text-xs font-semibold text-indigo-900">🔍 Sugerencias</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {searchSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          className="w-full px-3 py-2 hover:bg-indigo-50 text-left transition flex items-center justify-between group"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                              {suggestion.nombre}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                suggestion.tipo === 'insumo'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {suggestion.tipo === 'insumo' ? '📦 Insumo' : '🍽️ Producto'}
                              </span>
                              {suggestion.tipo === 'insumo' && (
                                <span className="text-xs text-gray-500">
                                  ${suggestion.precioUnitario?.toLocaleString('es-CL')} / {suggestion.unidad}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* Tips contextuales según plantilla */}
            <div className="mt-2 flex flex-wrap gap-2">
              {(() => {
                const tipsPorPlantilla = {
                  bar: [
                    "Costear un mojito",
                    "Ingredientes para margarita",
                    "¿Qué utilidad usar en cócteles?"
                  ],
                  restaurante: [
                    "Costear un plato de pasta",
                    "Ingredientes para carne al horno",
                    "¿Cuánto cobrar por un plato?"
                  ],
                  cafeteria: [
                    "Costear un café latte",
                    "Ingredientes para cappuccino",
                    "Precio ideal para sandwich"
                  ],
                  panaderia: [
                    "Costear pan francés",
                    "Ingredientes para croissant",
                    "¿Cuánto cobrar por torta?"
                  ]
                };

                const tips = plantilla && tipsPorPlantilla[plantilla]
                  ? tipsPorPlantilla[plantilla]
                  : [
                      "¿Qué puedo costear?",
                      "Productos ya costeados",
                      "¿Qué precio debería tener?"
                    ];

                return tips.map((tip, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(tip)}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                  >
                    {tip}
                  </button>
                ));
              })()}
            </div>
          </div>
        </motion.div>

        {/* Modal: Guardar Conversación */}
        <AnimatePresence>
          {showSaveModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-10"
              onClick={() => setShowSaveModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">💾 Guardar Conversación</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Dale un nombre a esta conversación para encontrarla fácilmente después.
                </p>
                <input
                  type="text"
                  value={conversationName}
                  onChange={(e) => setConversationName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveConversation()}
                  placeholder="Ej: Costeo de Mojitos, Recetas Bar, etc."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveConversation}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition font-medium"
                  >
                    Guardar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Cargar Conversación */}
        <AnimatePresence>
          {showLoadModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-10"
              onClick={() => setShowLoadModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">📂 Conversaciones Guardadas</h3>

                {savedConversations.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No hay conversaciones guardadas</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {savedConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="p-3 border-2 border-gray-200 rounded-lg hover:border-indigo-500 transition group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            onClick={() => handleLoadConversation(conv)}
                            className="flex-1 text-left"
                          >
                            <h4 className="font-semibold text-gray-900 text-sm group-hover:text-indigo-600">
                              {conv.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {new Date(conv.createdAt).toLocaleDateString('es-CL')}
                              </span>
                              {conv.plantilla && (
                                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                                  {conv.plantilla}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                {conv.messages.length} mensajes
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={() => handleDeleteConversation(conv.id)}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowLoadModal(false)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium"
                >
                  Cerrar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default CostingAssistant;
