# 🤖 Guía del Asistente de Inventario con IA

## ✅ Lo que acabamos de implementar

Hemos creado un **Asistente Inteligente de Inventario** que usa OpenAI GPT-4 para ayudar a tus usuarios con:

- ✨ Crear bodegas, neveras, estantes
- 📦 Agregar productos al inventario
- 📊 Importar productos desde Excel
- 💾 Exportar inventario
- 🏷️ Organizar mejor el stock
- 🔔 Entender alertas de stock bajo

## 📁 Archivos creados

### Frontend
1. **`src/components/InventoryAssistant.jsx`** - Chat completo con IA
2. **`src/components/FloatingAssistantButton.jsx`** - Botón flotante para abrir el chat

### Backend
3. **`planilla-costos-backend/routes/assistant.js`** - API endpoint que procesa mensajes con OpenAI

## 🔧 Configuración Requerida

### 1. Obtener API Key de OpenAI

Ve a: https://platform.openai.com/api-keys

1. Crea una cuenta en OpenAI (si no tienes)
2. Ve a "API Keys"
3. Clic en "Create new secret key"
4. Copia la key (solo se muestra una vez)

### 2. Agregar la API Key al .env

Edita: `planilla-costos-backend/.env`

```env
OPENAI_API_KEY=sk-proj-XXXXXXXXXXXXX  # ← Pega tu key aquí
```

### 3. Reiniciar el backend

```bash
cd planilla-costos-backend
npm run dev
```

## 🚀 Cómo Integrar en una Página

### ✅ YA INTEGRADO en Inventario

El asistente de IA ya está integrado y funcionando en:
- **`src/components/Inventory.jsx`** - Componente principal de inventario

### Cómo funciona la integración:

```jsx
// src/components/Inventory.jsx
import InventoryAssistant from './InventoryAssistant.jsx';
import FloatingAssistantButton from './FloatingAssistantButton.jsx';

export default function Inventory() {
  // Estado para controlar el modal del asistente
  const [showAssistant, setShowAssistant] = useState(false);

  // ... resto del código del componente

  return (
    <div>
      {/* Todo el contenido de inventario */}

      {/* Botón flotante del Asistente de IA */}
      <FloatingAssistantButton
        onClick={() => setShowAssistant(true)}
        showPulse={true}
      />

      {/* Modal del Asistente de IA */}
      <InventoryAssistant
        isOpen={showAssistant}
        onClose={() => setShowAssistant(false)}
        userContext={{
          userRole: auth.currentUser?.email || 'USER',
          currentPage: 'inventario',
          totalProducts: items.length,
          totalWarehouses: warehouses.length,
          hasLowStock: items.some(item =>
            (item.stock || 0) <= (stockThresholds.low || 5)
          ),
          hasCriticalStock: items.some(item =>
            (item.stock || 0) <= (stockThresholds.critical || 0)
          )
        }}
      />
    </div>
  );
}
```

### Para agregar en OTRAS páginas:

```jsx
// Ejemplo para cualquier otra página
import React, { useState } from 'react';
import InventoryAssistant from '../components/InventoryAssistant';
import FloatingAssistantButton from '../components/FloatingAssistantButton';

function MiOtraPagina() {
  const [showAssistant, setShowAssistant] = useState(false);

  const userContext = {
    userRole: 'ADMIN',
    currentPage: 'mi-pagina',
    totalProducts: 150,
    totalWarehouses: 5
  };

  return (
    <div>
      {/* Tu contenido */}

      <FloatingAssistantButton
        onClick={() => setShowAssistant(true)}
        showPulse={true}
      />

      <InventoryAssistant
        isOpen={showAssistant}
        onClose={() => setShowAssistant(false)}
        userContext={userContext}
      />
    </div>
  );
}
```

## 💬 Ejemplos de Preguntas que Puede Responder

El asistente está entrenado para responder preguntas como:

### Bodegas
- "¿Cómo creo una bodega?"
- "¿Qué tipos de bodegas puedo crear?"
- "Quiero crear una nevera para productos refrigerados"
- "¿Cómo organizo mi bodega por estantes?"

### Productos
- "¿Cómo agrego un producto?"
- "Necesito agregar 50 productos, ¿puedo hacerlo rápido?"
- "¿Cómo importo productos desde Excel?"
- "¿Dónde descargo la plantilla de Excel?"

### Stock y Alertas
- "¿Qué significa stock bajo?"
- "Tengo una notificación roja, ¿qué hago?"
- "¿Cómo evito quedarme sin productos?"
- "¿Cómo configuro alertas personalizadas?"

### Exportar
- "¿Cómo descargo mi inventario?"
- "Necesito un reporte de productos en PDF"
- "¿Puedo exportar solo una bodega específica?"

### Organización
- "Tips para organizar mejor mi inventario"
- "¿Cómo nombro mis productos?"
- "¿Debo separar productos por categorías?"

## 🎯 Acciones Inteligentes (Botones)

Cuando el asistente responde, puede sugerir acciones con botones:

Ejemplo de respuesta:
```
Para crear una bodega:
1. Ve a "Mis Bodegas"
2. Haz clic en "Crear Bodega"
3. ...

[Botón: 🏪 Ir a Mis Bodegas]  ← Click lleva directo a /mis-bodegas
```

Estas acciones se generan automáticamente en `routes/assistant.js` → función `detectActions()`

## 💰 Costos de OpenAI

**Modelo usado**: GPT-4o-mini (el más económico)

**Precio aproximado**:
- Input: $0.15 por 1 millón de tokens
- Output: $0.60 por 1 millón de tokens

**Traducción**:
- 1 conversación de 10 mensajes ≈ $0.001 (menos de 1 centavo)
- 1000 conversaciones ≈ $1 USD
- Usuario promedio (5 conversaciones/mes) ≈ $0.005/mes

**Estimado mensual**:
- 100 usuarios activos → ~$2-5 USD/mes
- 500 usuarios activos → ~$10-25 USD/mes
- 1000 usuarios activos → ~$20-50 USD/mes

## 🔒 Seguridad

✅ La API Key está en el backend (.env) - NUNCA en el frontend
✅ El frontend solo envía mensajes al backend
✅ El backend valida y procesa con OpenAI
✅ Rate limiting ya configurado en server.js

## 📈 Próximas Mejoras (Opcionales)

### Fase 2: Memoria Persistente
- Guardar conversaciones en Firestore
- Recordar preferencias del usuario
- Contexto entre sesiones

### Fase 3: Acciones Directas
- "Crea una bodega llamada Nevera 1" → Crea la bodega automáticamente
- "Muéstrame productos con stock bajo" → Abre modal con la lista
- "Agrega Papa, 10kg, $5000" → Agrega el producto directamente

### Fase 4: Análisis Avanzado
- "¿Cuál es mi producto más rentable?"
- "¿Cuánto he gastado en insumos este mes?"
- "Predice cuándo me quedaré sin harina"

### Fase 5: Voz
- Integrar Web Speech API
- Respuestas por voz
- Modo manos libres para cocinas

## 🐛 Troubleshooting

### Error: "OPENAI_API_KEY no configurado"
→ Verifica que agregaste la key en el .env y reiniciaste el servidor

### Error: "Failed to fetch"
→ Verifica que el backend esté corriendo en puerto 5188

### El asistente no responde específicamente sobre mi negocio
→ Edita `INVENTORY_KNOWLEDGE` en `routes/assistant.js` para agregar más info

### Quiero cambiar el estilo del chat
→ Edita `src/components/InventoryAssistant.jsx` (Tailwind CSS)

## 📞 Soporte

Si tienes dudas sobre la implementación, pregúntame:
1. Cómo personalizar las respuestas
2. Cómo agregar más conocimiento
3. Cómo integrar en otras páginas
4. Cómo mejorar el contexto

---

**¡Listo para usar!** 🚀

El asistente está 100% funcional. Solo necesitas:
1. Agregar tu OPENAI_API_KEY al .env
2. Integrar el botón flotante en las páginas que quieras
3. ¡Probarlo!
