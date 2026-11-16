# 🚀 Activar Asistente de IA - Instrucciones Paso a Paso

## ✅ Estado Actual

**TODO está implementado y listo para usar:**

- ✅ Backend configurado con OpenAI
- ✅ Frontend con chat completo
- ✅ Integrado en página de Inventario
- ✅ Conocimiento base extenso
- ✅ Paquetes instalados

**Solo falta: Obtener y configurar tu API Key de Anthropic (Claude)**

---

## 📝 Pasos para Activar (5 minutos)

### Paso 1: Obtener API Key de Anthropic (Claude)

1. Ve a: **https://console.anthropic.com/settings/keys**

2. Si no tienes cuenta Anthropic:
   - Clic en "Sign up"
   - Completa registro (email + verificación)
   - Agrega método de pago

3. Si ya tienes cuenta:
   - Inicia sesión

4. En el panel de Anthropic:
   - Ve a "API Keys" en el menú
   - Clic en **"Create Key"**
   - Dale un nombre: `Stockly-Asistente-Inventario`
   - Clic en "Create Key"

5. **IMPORTANTE:** Copia la key **INMEDIATAMENTE**
   - Solo se muestra una vez
   - Empieza con: `sk-ant-...`
   - Guárdala en un lugar seguro

---

### Paso 2: Configurar la API Key

1. Abre el archivo `.env` del backend:
   ```
   planilla-costos-backend/.env
   ```

2. Busca la línea:
   ```env
   ANTHROPIC_API_KEY=tu_anthropic_api_key_aqui
   ```

3. Reemplázala con tu key real:
   ```env
   ANTHROPIC_API_KEY=sk-ant-ABC123XYZ...tu-key-completa
   ```

4. Guarda el archivo (Ctrl+S)

---

### Paso 3: Reiniciar el Backend

1. Si el backend ya está corriendo:
   - Ve a la terminal donde corre
   - Presiona **Ctrl+C** para detenerlo

2. Inicia el backend nuevamente:
   ```bash
   cd planilla-costos-backend
   npm run dev
   ```

3. Verifica que arrancó correctamente:
   ```
   ✅ Servidor corriendo en puerto 5188
   ✅ Sin errores de ANTHROPIC_API_KEY
   ```

---

### Paso 4: Probar el Asistente

1. Abre tu aplicación frontend:
   - Inicia sesión en Stockly
   - Ve a la página de **Inventario**

2. Busca el **botón flotante morado** en la esquina inferior izquierda:
   - Tiene ícono de robot 🤖
   - Tiene animación pulsante

3. Haz clic en el botón

4. Escribe una pregunta de prueba:
   ```
   ¿Cómo creo una bodega?
   ```

5. **Si funciona:**
   - El asistente responde en ~2 segundos
   - La respuesta es coherente y útil
   - Aparecen botones de acción (opcional)

6. **Si NO funciona:**
   - Revisa la consola del navegador (F12)
   - Revisa la terminal del backend
   - Verifica que la API key esté correcta en el .env

---

## 🧪 Preguntas de Prueba Sugeridas

Para verificar que todo funciona correctamente, prueba estas preguntas:

### Básicas:
```
¿Cómo creo una bodega?
¿Cómo agrego un producto?
¿Qué significa stock bajo?
```

### Importación:
```
Tengo 200 productos en Excel, ¿puedo importarlos?
¿Cómo importo productos desde Excel?
¿Dónde descargo la plantilla de Excel?
```

### Organización:
```
Tengo un restaurante, ¿cómo organizo mi inventario?
Tips para organizar mejor mi inventario
¿Cómo evito que se me venzan productos?
```

### Resolución de Problemas:
```
Tengo una alerta roja, ¿qué hago?
¿Cómo evito quedarme sin productos?
Tengo productos duplicados, ¿cómo los elimino?
```

---

## 💰 Costos de Claude API (Anthropic)

### Modelo usado: Claude 3.5 Haiku
- El más económico y rápido de Claude
- Perfecto para chat conversacional
- Excelente calidad en español
- Respuestas rápidas y precisas

### Costos estimados:
**Precios de Claude 3.5 Haiku:**
- Input: $0.80 por 1M tokens
- Output: $4.00 por 1M tokens

**Traducción a uso real:**
| Usuarios Activos | Conversaciones/Mes | Costo Mensual |
|------------------|-------------------|---------------|
| 10 usuarios      | ~50 conversaciones | ~$1.00 USD    |
| 50 usuarios      | ~250 conversaciones | ~$5.00 USD   |
| 100 usuarios     | ~500 conversaciones | ~$10.00 USD   |
| 500 usuarios     | ~2500 conversaciones | ~$50 USD    |
| 1000 usuarios    | ~5000 conversaciones | ~$100 USD    |

### Ejemplos reales:
- **1 conversación** (10 mensajes) ≈ $0.002 USD
- **Usuario promedio** (5 conversaciones/mes) ≈ $0.01 USD

### Presupuesto recomendado:
- **$10 USD/mes** → Cubre ~100 usuarios activos
- **$50 USD/mes** → Cubre ~500 usuarios activos

**Nota:** Claude es ~2x más caro que GPT-4o-mini, pero ofrece mejor calidad en español y razonamiento.

---

## 🛡️ Seguridad de la API Key

### ✅ Buenas prácticas implementadas:
- API Key está en el backend (no en frontend)
- Archivo `.env` está en `.gitignore`
- Rate limiting configurado en el servidor
- Solo usuarios autenticados pueden usar el asistente

### ⚠️ Recomendaciones adicionales:
1. **No compartas tu API Key** con nadie
2. **No la subas a GitHub** (ya está en .gitignore)
3. **Rota la key periódicamente** (cada 3-6 meses)
4. **Monitorea uso en OpenAI** → https://platform.openai.com/usage

---

## 📊 Monitorear Uso y Costos

### En Anthropic Console:
1. Ve a: **https://console.anthropic.com/settings/usage**
2. Verás:
   - Gráfico de uso diario
   - Costos acumulados del mes
   - Desglose por modelo (Claude 3.5 Haiku)

### Establecer límites:
1. Ve a: **https://console.anthropic.com/settings/limits**
2. Configura:
   - **Monthly spending limit:** $50 USD/mes (o lo que prefieras)
   - **Email alerts:** Activar notificaciones cuando llegues al 80% del límite

---

## 🐛 Troubleshooting

### Error: "ANTHROPIC_API_KEY no configurado"
**Causa:** La key no está en el .env o tiene formato incorrecto

**Solución:**
1. Verifica que la línea en `.env` sea:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Sin espacios antes/después del `=`
3. Reinicia el backend

---

### Error: "Failed to fetch"
**Causa:** El backend no está corriendo o está en otro puerto

**Solución:**
1. Verifica que el backend corra en **puerto 5188**
2. En `server.js`, confirma: `const PORT = process.env.PORT || 5188;`
3. Reinicia el backend

---

### Error: "Insufficient credits" o "Credit balance too low"
**Causa:** No tienes saldo en tu cuenta Anthropic

**Solución:**
1. Ve a: https://console.anthropic.com/settings/billing
2. Agrega método de pago
3. Recarga saldo ($10 USD es suficiente para empezar)

---

### Error: "Rate limit exceeded"
**Causa:** Demasiadas peticiones en poco tiempo

**Solución:**
1. Espera 1 minuto
2. Ajusta rate limiting en `server.js` si es necesario
3. Considera upgrade de tier en Anthropic (más requests por minuto)

---

### El asistente responde lento (>10 segundos)
**Causa:** Posible problema de red o latencia de Claude API

**Solución:**
1. Verifica tu conexión a internet
2. Claude 3.5 Haiku es muy rápido (~1-2 segundos), si tarda más revisa logs
3. Revisa logs del backend para errores
4. Claude tiene servidores en USA (puede haber latencia desde Chile)

---

### El asistente responde cosas incorrectas
**Causa:** El conocimiento base necesita ajuste

**Solución:**
1. Edita `planilla-costos-backend/routes/assistant.js`
2. Busca `INVENTORY_KNOWLEDGE`
3. Agrega/modifica información específica
4. Reinicia backend

---

## 📖 Documentación Adicional

### Para implementación técnica:
📄 **ASISTENTE_IA_GUIA.md** - Guía técnica completa

### Para vender el asistente:
📄 **GUION_VENTAS_ASISTENTE_IA.md** - Script de ventas detallado

### Para presentar a inversores/stakeholders:
📄 **ASISTENTE_IA_RESUMEN.md** - Resumen ejecutivo con ROI

---

## ✅ Checklist de Activación

Marca cada paso cuando lo completes:

- [ ] Crear cuenta en Anthropic Console
- [ ] Agregar método de pago
- [ ] Generar API Key
- [ ] Copiar API Key a un lugar seguro
- [ ] Editar archivo `.env` del backend
- [ ] Pegar API Key en `ANTHROPIC_API_KEY=...`
- [ ] Guardar archivo `.env`
- [ ] Detener backend (Ctrl+C)
- [ ] Reiniciar backend (`npm run dev`)
- [ ] Verificar que arrancó sin errores
- [ ] Abrir Stockly en el navegador
- [ ] Ir a página de Inventario
- [ ] Hacer clic en botón morado del asistente
- [ ] Escribir pregunta de prueba
- [ ] Verificar respuesta del asistente
- [ ] Configurar límites en Anthropic Console
- [ ] Activar alertas de billing

---

## 🎉 ¡Listo!

Si completaste todos los pasos del checklist, **tu asistente de IA está activo y funcionando**.

### Próximos pasos recomendados:
1. Prueba con usuarios reales (beta testers)
2. Recopila feedback sobre las respuestas
3. Ajusta el conocimiento base según necesidad
4. Agrega el asistente a otras páginas (Dashboard, Bodegas, etc.)

---

## 📞 Soporte

Si tienes problemas:
1. Revisa la sección **Troubleshooting** de este documento
2. Verifica logs del backend y consola del navegador
3. Consulta documentación de OpenAI: https://platform.openai.com/docs

---

**🚀 ¡Disfruta de tu nuevo asistente de IA!**
