# 🚀 Optimizaciones para el Agente IA

## 1. USAR CLAUDE HAIKU CON PROMPT CACHING (AHORRO 90%)

```javascript
// ANTES (lento y caro)
const completion = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022',
  system: systemPrompt, // Se procesa COMPLETO cada vez
  messages: messages
});

// DESPUÉS (10x más rápido, 90% más barato)
const completion = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022',
  system: [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" } // ✅ CACHEA el prompt
    }
  ],
  messages: messages
});
```

**Impacto:** Primera llamada = normal, siguientes = 10x más rápidas

---

## 2. ÍNDICES DE FIRESTORE (BÚSQUEDA 100x MÁS RÁPIDA)

```javascript
// ANTES: Escanea TODO el inventario (lento)
const inventorySnapshot = await db
  .collection('companies')
  .doc(companyId)
  .collection('inventory')
  .get(); // 😱 Trae 1000 productos para buscar "jarabe"

// DESPUÉS: Búsqueda indexada
const inventorySnapshot = await db
  .collection('companies')
  .doc(companyId)
  .collection('inventory')
  .where('name', '>=', searchTerm)
  .where('name', '<=', searchTerm + '\uf8ff')
  .limit(5)
  .get(); // ⚡ Solo trae 5 resultados relevantes
```

**Crear índice:**
```bash
# En Firebase Console → Firestore → Indexes
Colección: inventory
Campo: name (Ascending)
Campo: companyId (Ascending)
```

---

## 3. REDUCIR PROMPT A LO ESENCIAL (50% MÁS RÁPIDO)

```javascript
// ANTES: ~2000 líneas de contexto
const systemPrompt = `
  - Todas las capacidades del sistema
  - Todos los ejemplos posibles
  - Toda la documentación
  - Todos los casos edge
`; // 😱 100,000+ tokens

// DESPUÉS: Prompt dinámico según intención
const getSystemPrompt = (intention) => {
  const basePrompt = "Eres el asistente de Stockly...";

  if (intention === 'salida') {
    return basePrompt + SALIDAS_PROMPT; // Solo instrucciones de salidas
  }
  if (intention === 'costeo') {
    return basePrompt + COSTEO_PROMPT; // Solo instrucciones de costeo
  }
  // etc...
};
```

---

## 4. EJECUTAR TOOLS EN PARALELO

```javascript
// ANTES: Secuencial (lento)
const producto = await buscarIngrediente('jarabe');
const bodega = await obtenerBodega(producto.warehouseId);
const registro = await registrarSalida(producto);
// Total: 3 segundos

// DESPUÉS: Paralelo (rápido)
const [producto, bodega] = await Promise.all([
  buscarIngrediente('jarabe'),
  obtenerBodega(warehouseId)
]);
await registrarSalida(producto);
// Total: 1.2 segundos
```

---

## 5. STREAMING DE RESPUESTAS (UX MEJOR)

```javascript
// ANTES: Usuario espera 3 segundos sin feedback
const response = await anthropic.messages.create({...});
res.json({ reply: response.content[0].text });

// DESPUÉS: Usuario ve respuesta inmediata
const stream = await anthropic.messages.stream({...});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    // Enviar chunk al frontend vía SSE
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
}
```

---

## 6. CACHÉ DE BÚSQUEDAS FRECUENTES

```javascript
// Cache simple en memoria
const productCache = new Map();

async function buscarIngrediente(nombre) {
  const cacheKey = `${companyId}-${nombre.toLowerCase()}`;

  // Revisar caché (válido por 5 minutos)
  if (productCache.has(cacheKey)) {
    const cached = productCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 300000) {
      return cached.data; // ⚡ Instantáneo
    }
  }

  // Buscar en Firestore
  const result = await db.collection(...)...;

  // Guardar en caché
  productCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });

  return result;
}
```

---

## 7. SIMPLIFICAR FLUJO (MENOS LLAMADAS A CLAUDE)

```javascript
// ANTES: 3 llamadas
// 1. Usuario: "quiero usar jarabe"
// 2. Claude: Usa buscar_ingrediente
// 3. Backend ejecuta
// 4. Claude genera respuesta final
// Total: 3 llamadas API

// DESPUÉS: 1 llamada con few-shot prompting
const systemPrompt = `
Cuando usuario diga "quiero usar X de Y":
1. ASUME que existe en inventario
2. USA INMEDIATAMENTE registrar_salida_stock
3. NO preguntes, NO busques primero, ACTÚA
`;
// Total: 1 llamada API (3x más rápido)
```

---

## 📊 IMPACTO ESPERADO

| Optimización | Mejora Velocidad | Ahorro Costo | Dificultad |
|--------------|------------------|--------------|------------|
| Prompt Caching | 10x | 90% | Fácil ✅ |
| Índices Firestore | 100x búsquedas | - | Media |
| Prompt Dinámico | 2x | 50% | Media |
| Tools Paralelos | 2-3x | - | Fácil ✅ |
| Streaming | UX mejor | - | Media |
| Caché búsquedas | 1000x hits | - | Fácil ✅ |
| Simplificar flujo | 3x | 66% | Difícil |

**Implementando solo las 3 fáciles (✅):**
- Velocidad: 5-10x más rápido
- Costos: 70-80% menos
- Tiempo implementación: 2-3 horas

---

## 🎯 PLAN DE IMPLEMENTACIÓN PRIORITARIO

### FASE 1 (Implementar YA - 1 hora):
1. ✅ Habilitar Prompt Caching
2. ✅ Caché en memoria para búsquedas

### FASE 2 (Esta semana - 3 horas):
3. ✅ Índices de Firestore
4. ✅ Ejecutar tools en paralelo

### FASE 3 (Próxima semana - 5 horas):
5. Prompt dinámico según intención
6. Streaming de respuestas

### FASE 4 (Opcional - mejora incremental):
7. Simplificar flujo completamente
