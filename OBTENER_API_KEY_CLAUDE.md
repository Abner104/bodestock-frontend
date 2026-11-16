# 🔑 Cómo Obtener tu API Key de Claude (Anthropic)

## ✅ Ya tienes cuenta de Anthropic

Perfecto, ya lograste crear cuenta y agregar método de pago. Ahora solo falta obtener la API key.

---

## 📝 Pasos para Obtener la API Key

### Paso 1: Ir al Console de Anthropic

1. Abre tu navegador
2. Ve a: **https://console.anthropic.com/settings/keys**
3. Inicia sesión con tu cuenta

---

### Paso 2: Crear una API Key

1. En la página de API Keys, verás un botón **"Create Key"** o **"+ New Key"**
2. Haz clic en él

3. Te pedirá:
   - **Name:** Dale un nombre descriptivo
     - Ejemplo: `Stockly-Asistente-Inventario`

   - **Workspace:** Selecciona tu workspace (probablemente solo tienes uno)

4. Haz clic en **"Create Key"**

---

### Paso 3: Copiar la API Key

**⚠️ MUY IMPORTANTE:**

1. La API key se mostrará **UNA SOLA VEZ**
2. **Cópiala INMEDIATAMENTE** a un lugar seguro
3. La key empieza con: `sk-ant-api03-...`
4. Tiene un formato largo, algo como:
   ```
   sk-ant-api03-ABC123XYZ789...
   ```

5. **Guárdala en un archivo de texto** o en tu gestor de contraseñas

---

### Paso 4: Pegar la API Key en el .env

1. Abre el proyecto en tu editor de código

2. Ve al archivo:
   ```
   planilla-costos-backend/.env
   ```

3. Busca la línea:
   ```env
   ANTHROPIC_API_KEY=tu_anthropic_api_key_aqui
   ```

4. Reemplázala con tu key real:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-ABC123XYZ789...
   ```

5. **Guarda el archivo** (Ctrl+S)

---

### Paso 5: Reiniciar el Backend

1. Si el backend ya está corriendo:
   - Ve a la terminal donde está corriendo
   - Presiona **Ctrl+C** para detenerlo

2. Inicia el backend nuevamente:
   ```bash
   cd planilla-costos-backend
   npm run dev
   ```

3. Deberías ver:
   ```
   ✅ Servidor corriendo en puerto 5188
   ```

4. **Sin errores de ANTHROPIC_API_KEY**

---

### Paso 6: Probar el Asistente

1. Abre tu navegador

2. Ve a: **http://localhost:5173**

3. Inicia sesión en Stockly

4. Ve a la página de **Inventario**

5. Busca el **botón morado flotante** en la esquina inferior izquierda
   - Tiene un ícono de robot 🤖
   - Tiene animación pulsante

6. **Haz clic** en el botón

7. Escribe una pregunta de prueba:
   ```
   ¿Cómo creo una bodega?
   ```

8. Presiona Enter

9. **Si funciona:**
   - El asistente responderá en ~1-2 segundos
   - La respuesta será coherente y útil
   - Verás una explicación paso a paso

10. **Si NO funciona:**
    - Abre la consola del navegador (F12)
    - Ve a la pestaña "Console"
    - Busca errores en rojo
    - Ve también a la terminal del backend
    - Busca errores allí

---

## 🎯 Preguntas de Prueba Sugeridas

Prueba estas preguntas para verificar que todo funciona:

### Básicas:
```
¿Cómo creo una bodega?
¿Cómo agrego un producto?
¿Qué es stock bajo?
```

### Importación:
```
Tengo 200 productos en Excel, ¿puedo importarlos?
¿Cómo funciona la importación de Excel?
```

### Organización:
```
Tengo un restaurante, ¿cómo organizo mi inventario?
Tips para organizar mejor mi inventario
```

---

## 💰 Información de Costos

### Claude 3.5 Haiku (el modelo que estás usando):
- **Input:** $0.80 por 1 millón de tokens
- **Output:** $4.00 por 1 millón de tokens

### ¿Qué significa eso en la práctica?

**1 conversación típica:**
- Usuario: "¿Cómo creo una bodega?"
- Asistente: Respuesta de 200 palabras
- **Costo:** ~$0.002 USD (menos de 1 centavo chileno)

**100 conversaciones:**
- **Costo:** ~$0.20 USD

**1000 conversaciones:**
- **Costo:** ~$2.00 USD

### Estimación mensual:
- **10 usuarios activos:** ~$1 USD/mes
- **50 usuarios activos:** ~$5 USD/mes
- **100 usuarios activos:** ~$10 USD/mes

**¿Es caro?**
No. Si cobras $10.000 CLP (~$11 USD) por cliente, el asistente te cuesta $0.10 USD por cliente al mes.

**Eso es menos del 1% de tus ingresos por cliente.**

---

## 🛡️ Seguridad de la API Key

### ✅ Buenas prácticas:

1. **NUNCA compartas tu API Key**
   - Es como la contraseña de tu banco

2. **NO la subas a GitHub**
   - El archivo `.env` ya está en `.gitignore`
   - Pero verifica siempre antes de hacer commit

3. **Rota la key periódicamente**
   - Cada 3-6 meses, crea una nueva key
   - Elimina la anterior

4. **Monitorea uso**
   - Ve a: https://console.anthropic.com/settings/usage
   - Revisa semanalmente cuánto gastas

5. **Configura límites**
   - Ve a: https://console.anthropic.com/settings/limits
   - Configura un límite mensual (ej: $50 USD)
   - Activa alertas por email

---

## 📊 Monitorear Uso

### En el Console de Anthropic:

1. Ve a: **https://console.anthropic.com/settings/usage**

2. Verás:
   - **Gráfico de uso diario:** Cuántas requests haces
   - **Costo acumulado del mes:** Cuánto llevas gastado
   - **Desglose por modelo:** Claude 3.5 Haiku

3. Puedes:
   - Descargar reportes en CSV
   - Ver uso por día/semana/mes
   - Filtrar por modelo

---

## 🐛 Si algo no funciona

### Error en consola: "ANTHROPIC_API_KEY is not defined"
**Solución:**
1. Verifica que pegaste la key correctamente en `.env`
2. Sin espacios antes/después del `=`
3. Reinicia el backend

---

### Error en consola: "Invalid API Key"
**Solución:**
1. Verifica que copiaste la key completa
2. No debe tener saltos de línea
3. Debe empezar con `sk-ant-api03-`

---

### Error: "Insufficient credits"
**Solución:**
1. Ve a: https://console.anthropic.com/settings/billing
2. Verifica que tienes saldo
3. Agrega crédito si es necesario

---

### El asistente no responde nada
**Solución:**
1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Network"
3. Busca la request a `/api/assistant/inventory`
4. Ve qué error devuelve
5. Revisa también la terminal del backend

---

## ✅ Checklist Final

- [ ] Obtuve la API Key de Anthropic
- [ ] La copié a un lugar seguro
- [ ] La pegué en el archivo `.env`
- [ ] Guardé el archivo `.env`
- [ ] Reinicié el backend
- [ ] El backend arrancó sin errores
- [ ] Abrí Stockly en el navegador
- [ ] Fui a la página de Inventario
- [ ] Vi el botón morado del asistente
- [ ] Hice clic en el botón
- [ ] Escribí una pregunta de prueba
- [ ] El asistente respondió correctamente
- [ ] Configuré límites de gasto en Anthropic
- [ ] Activé alertas de billing

---

## 🎉 ¡Listo!

Si completaste todos los pasos del checklist, **tu asistente de IA con Claude está funcionando**.

### Próximos pasos:

1. **Prueba con más preguntas**
   - Experimenta con diferentes tipos de consultas
   - Ve qué tan bien responde

2. **Muestra a tus usuarios**
   - Pide feedback
   - Anota qué preguntas hacen más seguido

3. **Mejora el conocimiento base**
   - Si ves que responde mal algo específico
   - Edita `routes/assistant.js`
   - Agrega más información en `INVENTORY_KNOWLEDGE`

4. **Integra en más páginas**
   - Dashboard
   - Bodegas
   - Productos
   - Donde sea útil

---

## 📞 Soporte

Si tienes problemas:
1. Revisa la sección **"Si algo no funciona"** de este documento
2. Ve la consola del navegador (F12)
3. Ve la terminal del backend
4. Lee los errores completos

---

**🚀 ¡Disfruta de tu asistente de IA con Claude!**

Es el mejor modelo de conversación del mercado, especialmente en español.
