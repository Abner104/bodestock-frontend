# 💬 Ejemplos de Conversaciones con el Asistente de IA

Este documento muestra ejemplos reales de conversaciones que el asistente puede manejar. Úsalo como referencia para demos y para entender el alcance del asistente.

---

## 🏪 Categoría: Gestión de Bodegas

### Conversación 1: Crear una bodega
**Usuario:** ¿Cómo creo una bodega?

**Asistente:**
```
Para crear una bodega en Stockly:

1. Ve a "Mis Bodegas" en el menú principal
2. Haz clic en el botón "Crear Bodega" (ícono +)
3. Completa los datos:
   • Nombre: Elige algo descriptivo (ej: "Bodega Seca", "Nevera Principal")
   • Descripción: Opcional, ayuda a identificar qué almacenas
   • Ubicación: Opcional, útil para negocios con múltiples locales

4. Haz clic en "Guardar"

¡Listo! Tu bodega estará lista para agregar productos.

[🏪 Ir a Mis Bodegas]
```

---

### Conversación 2: Tipos de bodegas recomendadas
**Usuario:** Tengo un restaurante, ¿qué tipos de bodegas debería crear?

**Asistente:**
```
Para un restaurante, te recomiendo crear estas bodegas organizadas por temperatura y tipo de producto:

📦 Bodega Seca
• Granos (arroz, fideos, harina)
• Aceites y condimentos
• Productos enlatados
• Especias

❄️ Nevera / Refrigerador
• Carnes frescas
• Lácteos (leche, queso, mantequilla)
• Verduras y frutas
• Huevos

🧊 Congelador
• Carnes congeladas
• Pescados y mariscos
• Helados
• Productos precongelados

🍺 Despensa Bar (si aplica)
• Licores y vinos
• Bebidas gaseosas
• Cervezas
• Insumos de coctelería

🧹 Bodega de Limpieza
• Detergentes
• Desinfectantes
• Paños y escobas

¿Quieres que te guíe para crear estas bodegas paso a paso?
```

**Usuario:** Sí, ayúdame a crear la nevera

**Asistente:**
```
Perfecto, vamos a crear tu Nevera:

1. Ve a "Mis Bodegas"
2. Clic en "Crear Bodega"
3. Completa así:
   • Nombre: "Nevera Principal" o "Refrigerador"
   • Descripción: "Productos refrigerados - Carnes, lácteos, verduras"
   • Ubicación: "Cocina" (o donde esté ubicada)

4. Guarda

Luego, cuando agregues productos a esa bodega, ya sabrás que están refrigerados y podrás configurar alertas de vencimiento más cortas (ideal para productos frescos).

¿Creamos la siguiente bodega (Congelador)?

[🏪 Ir a Mis Bodegas]
```

---

## 📦 Categoría: Gestión de Productos

### Conversación 3: Agregar un producto
**Usuario:** ¿Cómo agrego un producto?

**Asistente:**
```
Para agregar un producto a tu inventario:

1. Ve a "Inventario"
2. Haz clic en el botón "Agregar Producto" (ícono +)
3. Completa el formulario:

   📝 DATOS BÁSICOS (obligatorios):
   • Nombre: Ej: "Papa Amarilla"
   • SKU: Código único (ej: "PA-001")
   • Categoría: Ej: "Verduras"
   • Unidad: kg, litros, unidades, etc.

   💰 DATOS DE COMPRA:
   • Stock actual: Cuánto tienes ahora
   • Precio por unidad: Cuánto cuesta comprar 1 unidad
   • Proveedor: Nombre del proveedor

   🏪 UBICACIÓN:
   • Bodega: Selecciona dónde lo almacenas

4. Guarda

El producto aparecerá en tu inventario inmediatamente.

[📦 Ir a Inventario]
```

---

### Conversación 4: Importar múltiples productos
**Usuario:** Tengo 200 productos en un Excel desordenado, ¿puedo importarlos?

**Asistente:**
```
¡Sí! El sistema de importación de Stockly es INTELIGENTE y acepta Excel en cualquier formato.

🧠 DETECTA AUTOMÁTICAMENTE:
• Nombres de columnas variables:
  - "Producto", "Item", "Nombre", "Artículo" → todos funcionan

• Unidades flexibles:
  - "kg", "kilos", "kilogramos" → reconoce como lo mismo
  - "L", "litros", "lts" → también

• Precios con/sin símbolos:
  - "$5000", "5000", "5.000" → todos válidos

• SKU opcionales:
  - Si no tienes, el sistema genera automáticamente

📋 PASOS PARA IMPORTAR:
1. Ve a "Inventario"
2. Clic en "Importar desde Excel" (botón de descarga con flecha arriba)
3. Arrastra tu archivo Excel o haz clic para seleccionar
4. El sistema analiza y te muestra una vista previa
5. Revisa que todo esté correcto
6. Confirma importación

⚠️ TIPS:
• Si detecta errores (precios negativos, nombres vacíos), te avisa antes de importar
• Puedes corregir directamente en la vista previa
• Se recomienda tener al menos: Nombre, Unidad, Precio, Stock

¿Tienes tu Excel a mano? Puedo guiarte paso a paso.

[📊 Ir a Inventario]
```

**Usuario:** ¿Y si mi Excel tiene columnas con nombres raros?

**Asistente:**
```
No hay problema. El sistema es flexible.

EJEMPLOS DE COLUMNAS QUE RECONOCE:

Para el nombre del producto:
✅ "Producto", "Item", "Nombre", "Artículo", "Descripción", "Product"

Para el precio:
✅ "Precio", "Costo", "Valor", "Price", "Precio Compra", "PPP"

Para el stock:
✅ "Stock", "Cantidad", "Existencia", "Inventario", "Qty"

Para la unidad:
✅ "Unidad", "Medida", "Unit", "UM"

Si tiene nombres MUY raros que el sistema no reconoce:
1. Durante la importación, aparece un mapeo manual
2. Tú le dices: "Esta columna es el precio", "Esta es el stock"
3. El sistema aprende y aplica a todos los productos

En resumen: CUALQUIER Excel funciona. Intenta importar tal como lo tienes.

[📊 Ir a Inventario]
```

---

## ⚠️ Categoría: Alertas y Stock Bajo

### Conversación 5: Alertas de stock bajo
**Usuario:** Tengo una notificación roja de stock bajo, ¿qué hago?

**Asistente:**
```
Esa alerta significa que uno o más productos están por agotarse.

🔴 SIGNIFICADO DE LOS COLORES:
• ROJO (crítico): Stock muy bajo, reordenar URGENTE
• AMARILLO (advertencia): Stock bajo, planificar compra pronto
• VERDE: Stock normal

✅ QUÉ HACER AHORA:
1. Ve a "Inventario"
2. Busca productos con indicador 🔴 rojo
3. Anota cuáles necesitas comprar urgente
4. Ve a "Realizar Compra" para cada producto
5. Aumenta el stock

💡 PREVENIR EN EL FUTURO:
• Configura alertas personalizadas por producto
• Ajusta el umbral de "stock mínimo" según tu consumo
• Revisa alertas semanalmente

🎯 CONFIGURAR ALERTAS:
1. Ve al producto específico
2. Edítalo
3. Configura "Stock Mínimo" (ej: 10kg)
4. Recibirás alerta cuando baje de ese número

¿Quieres que te ayude a configurar alertas para algún producto específico?

[📦 Ver Productos con Stock Bajo]
```

---

### Conversación 6: Prevenir vencimientos
**Usuario:** ¿Cómo evito que se me venzan productos?

**Asistente:**
```
Para evitar pérdidas por productos vencidos:

📅 USAR FECHAS DE VENCIMIENTO:
1. Al agregar/editar un producto, busca el campo "Fecha de Vencimiento"
2. Ingresa la fecha (ej: 31/12/2025)
3. Guarda

El sistema te alertará automáticamente:
• 30 días antes: Advertencia amarilla ⚠️
• 7 días antes: Alerta crítica 🔴
• Fecha pasada: Vencido 🚫

🎯 ESTRATEGIAS RECOMENDADAS:

Para Restaurantes:
• Método FIFO (First In, First Out): Usa primero lo más antiguo
• Revisa nevera diariamente
• Alertas a 3 días para productos frescos

Para Panaderías:
• Harina: Alerta a 15 días
• Levadura: Alerta a 7 días
• Revisa fechas en cada recepción

Para Bares:
• Licores: Raramente vencen (alertas a 60 días)
• Jugos/mixers: Alerta a 10 días
• Hierbas/frutas: Alerta a 3 días

📊 REPORTES ÚTILES:
• Exporta reporte de "Productos próximos a vencer"
• Revísalo semanalmente
• Planifica promociones para productos cerca de vencer

¿Tienes algún tipo de producto específico que se te vence frecuentemente?

[📦 Ir a Inventario]
```

---

## 📊 Categoría: Organización y Tips

### Conversación 7: Organización general
**Usuario:** Tips para organizar mejor mi inventario

**Asistente:**
```
Aquí van las mejores prácticas para organizar tu inventario:

1️⃣ BODEGAS SEPARADAS POR TEMPERATURA
✅ Correcto: Bodega Seca / Nevera / Congelador
❌ Incorrecto: Todo en "Almacén General"

Ventaja: Identificas rápido qué revisar primero (productos fríos son más urgentes)

2️⃣ NOMBRES CLAROS Y ÚNICOS
✅ Correcto: "Papa Amarilla 50kg", "Leche Entera Colun 1L"
❌ Incorrecto: "Papa 1", "Leche"

Ventaja: Evitas confusiones y duplicados

3️⃣ USA SKU CONSISTENTES
✅ Correcto: PA-001, PA-002 (Papa), LE-001 (Leche)
❌ Incorrecto: SKU aleatorios sin patrón

Ventaja: Fácil búsqueda y escaneo de códigos

4️⃣ CONFIGURA ALERTAS DE VENCIMIENTO
✅ Correcto: Fechas en productos perecederos
❌ Incorrecto: Ignorar fechas

Ventaja: Reduces mermas por vencimiento

5️⃣ EXPORTA REPORTES SEMANALES
✅ Correcto: Excel/PDF cada semana
❌ Incorrecto: Solo revisar cuando hay problema

Ventaja: Detectas tendencias de consumo

6️⃣ CATEGORÍAS ESPECÍFICAS
✅ Correcto: "Proteínas", "Verduras", "Granos", "Lácteos"
❌ Incorrecto: "Insumos", "Varios"

Ventaja: Reportes más útiles y búsqueda más rápida

7️⃣ PROVEEDORES REGISTRADOS
✅ Correcto: Guardar proveedor en cada producto
❌ Incorrecto: Dejar en blanco

Ventaja: Sabes a quién reordenar rápido

¿Quieres profundizar en alguno de estos puntos?
```

---

### Conversación 8: Nombres de productos
**Usuario:** ¿Cómo nombro mis productos?

**Asistente:**
```
Guía para nombres de productos efectivos:

📝 ESTRUCTURA RECOMENDADA:
[Tipo de Producto] + [Característica Principal] + [Presentación]

EJEMPLOS CORRECTOS:
✅ "Papa Amarilla 50kg"
✅ "Leche Entera Colun 1L"
✅ "Aceite Girasol Chef 5L"
✅ "Harina 0000 25kg"
✅ "Tomate Cherry Bandeja 500g"

EJEMPLOS INCORRECTOS:
❌ "Papa" (demasiado genérico)
❌ "Leche 1" (no sabes qué tipo)
❌ "Aceite grande" (¿cuánto es grande?)
❌ "Harina blanca" (¿qué tipo de harina?)

🎯 REGLAS DE ORO:

1. SÉ ESPECÍFICO:
   ✅ "Arroz Grado 1 Carolina 25kg"
   ❌ "Arroz"

2. INCLUYE LA PRESENTACIÓN:
   ✅ "Azúcar 1kg", "Azúcar 25kg"
   ❌ "Azúcar" (¿cuánto?)

3. DIFERENCIA MARCAS SI IMPORTA:
   ✅ "Yogurt Soprole Natural 1L"
   ✅ "Yogurt Nestlé Natural 1L"
   (Si compras ambas marcas)

4. USA UNIDADES ESTÁNDAR:
   ✅ kg, L, unidades, cajas
   ❌ "bolsas", "paquetes" (demasiado ambiguo)

5. EVITA ABREVIATURAS RARAS:
   ✅ "Leche Descremada"
   ❌ "Lech Desc" (¿qué es eso?)

💡 CASO ESPECIAL - PRODUCTOS SIMILARES:
Si tienes varios tipos del mismo producto, usa SKU diferentes:

• Papa Amarilla 25kg → SKU: PA-25
• Papa Amarilla 50kg → SKU: PA-50
• Papa Rosada 25kg → SKU: PR-25

Así el sistema no los confunde.

¿Quieres renombrar algunos de tus productos existentes?

[📦 Ir a Inventario]
```

---

## 🔧 Categoría: Problemas Técnicos

### Conversación 9: Productos duplicados
**Usuario:** Tengo productos duplicados, ¿cómo los elimino?

**Asistente:**
```
Para manejar productos duplicados:

🔍 IDENTIFICAR DUPLICADOS:
1. Ve a "Inventario"
2. Usa la barra de búsqueda
3. Busca el nombre del producto duplicado (ej: "Papa")
4. Verás todas las coincidencias

🗑️ ELIMINAR DUPLICADOS:

Opción A - Eliminar completo:
1. Ubica el producto duplicado que NO quieres
2. Haz clic en el botón de eliminar (ícono basura)
3. Confirma eliminación

Opción B - Fusionar (recomendado si tienen stock):
1. Anota el stock del producto que eliminarás
2. Edita el producto que quieres mantener
3. Suma el stock de ambos
4. Guarda
5. Elimina el duplicado

⚠️ PREVENIR DUPLICADOS EN EL FUTURO:

1. USA SKU ÚNICOS:
   • El sistema alerta si intentas usar un SKU existente

2. BUSCA ANTES DE AGREGAR:
   • Antes de crear un producto nuevo, busca si ya existe

3. AL IMPORTAR EXCEL:
   • Marca la opción "Actualizar si ya existe"
   • El sistema fusiona automáticamente en vez de duplicar

💡 EJEMPLO:
Tienes:
• "Papa Amarilla" (50kg stock)
• "Papa" (20kg stock)

Solución:
1. Edita "Papa Amarilla"
2. Cambia stock a 70kg (50+20)
3. Elimina "Papa"

¿Necesitas ayuda con algún producto duplicado específico?

[📦 Ir a Inventario]
```

---

### Conversación 10: Stock negativo
**Usuario:** Un producto tiene stock negativo, ¿qué pasó?

**Asistente:**
```
Un stock negativo indica que se registraron salidas sin entrada previa.

🔍 CAUSAS COMUNES:

1. COMPRAS NO REGISTRADAS:
   • Se usó el producto, pero no se registró cuando se compró
   • Solución: Registra la compra ahora

2. MERMA NO REGISTRADA:
   • Se botó producto sin usar la función "Merma"
   • Solución: Ajusta el stock manualmente

3. ERROR DE INGRESO:
   • Alguien ingresó mal la cantidad de salida
   • Solución: Revisa historial y corrige

✅ CÓMO CORREGIR:

Método 1 - Registrar Compra:
1. Ve al producto con stock negativo
2. Haz clic en "Realizar Compra"
3. Ingresa la cantidad que realmente tienes ahora
4. Guarda

Método 2 - Ajuste Manual:
1. Edita el producto
2. Cambia el stock al valor real actual
3. Guarda
4. Anota en descripción: "Ajuste por corrección de inventario"

📊 EJEMPLO:
• Stock dice: -5kg
• Realmente tienes: 20kg

Solución:
1. Edita el producto
2. Cambia stock a 20kg
3. Guarda

El historial se mantendrá, pero el stock actual será correcto.

🎯 PREVENIR EN EL FUTURO:
• Capacita al equipo para registrar compras siempre
• Revisa inventario físico vs sistema mensualmente
• Usa alertas de stock bajo para detectar problemas antes

¿Quieres que te ayude a ajustar un producto específico?

[📦 Ir a Inventario]
```

---

## 🚀 Categoría: Funcionalidades Avanzadas

### Conversación 11: Exportar reportes
**Usuario:** ¿Cómo descargo mi inventario en Excel?

**Asistente:**
```
Para exportar tu inventario completo:

📊 EXPORTAR A EXCEL:
1. Ve a "Inventario"
2. Haz clic en el botón "Exportar" (ícono de descarga)
3. Selecciona "Exportar a Excel"
4. El archivo se descarga automáticamente

El Excel incluye:
• Nombre del producto
• SKU
• Categoría
• Stock actual
• Precio por unidad
• Valor total del stock
• Proveedor
• Bodega
• Fecha de vencimiento (si aplica)

📄 EXPORTAR A PDF:
1. Ve a "Inventario"
2. Clic en "Exportar"
3. Selecciona "Exportar a PDF"
4. Se genera un PDF listo para imprimir

Incluye:
• Lista completa de productos
• Totales por categoría
• Valor total del inventario
• Fecha del reporte

🎯 FILTRAR ANTES DE EXPORTAR:
Puedes exportar solo lo que necesitas:

1. Filtrar por bodega:
   • Selecciona bodega específica
   • Luego exporta

2. Filtrar por stock bajo:
   • Activa filtro "Solo stock crítico"
   • Exporta

3. Buscar productos específicos:
   • Usa barra de búsqueda
   • Exporta resultados

💡 USO RECOMENDADO:
• Exporta PDF para auditorías físicas (imprimir y revisar)
• Exporta Excel para análisis y reportes a contabilidad
• Exporta semanalmente como respaldo

¿Necesitas exportar solo una bodega específica?

[📊 Ir a Inventario]
```

---

### Conversación 12: Transferencias entre bodegas
**Usuario:** ¿Cómo muevo productos de una bodega a otra?

**Asistente:**
```
Para transferir productos entre bodegas:

📦 MÉTODO 1 - Transferencia Directa (recomendado):
1. Ve a "Inventario"
2. Busca el producto que quieres transferir
3. Haz clic en el botón "Transferir" (ícono de flechas)
4. Selecciona:
   • Bodega origen (de dónde sale)
   • Bodega destino (a dónde va)
   • Cantidad a transferir
5. Confirma

El sistema registra:
✅ Descuenta del origen
✅ Suma al destino
✅ Guarda historial de movimiento

📝 MÉTODO 2 - Manual (si no ves botón Transferir):
1. Edita el producto en bodega origen
2. Reduce el stock
3. Ve a bodega destino
4. Si el producto ya existe allí, aumenta el stock
5. Si no existe, agrégalo con el stock transferido

⚠️ IMPORTANTE:
• Si transferir TODO el stock, mejor cambia la bodega del producto directamente
• Si transferir PARTE, usa el método 1 (mantiene historial)

💡 EJEMPLO:
Tienes:
• 50kg de Arroz en "Bodega Seca"
• Quieres 20kg en "Despensa Cocina"

Pasos:
1. Busca "Arroz"
2. Transferir → Origen: Bodega Seca → Destino: Despensa Cocina
3. Cantidad: 20kg
4. Confirma

Resultado:
• Bodega Seca: 30kg
• Despensa Cocina: 20kg

¿Necesitas hacer una transferencia ahora?

[📦 Ir a Inventario]
```

---

## 🎓 Categoría: Onboarding (Nuevos Usuarios)

### Conversación 13: Usuario completamente nuevo
**Usuario:** Es mi primera vez usando Stockly, ¿por dónde empiezo?

**Asistente:**
```
¡Bienvenido a Stockly! Te voy a guiar paso a paso.

🎯 ORDEN RECOMENDADO (15-20 minutos):

PASO 1 - Crear tus bodegas (5 min):
Primero organiza dónde almacenas tus productos.

¿Qué tipo de negocio tienes?
• Restaurante → Bodega Seca, Nevera, Congelador, Bar
• Panadería → Bodega Harina, Bodega Dulces, Nevera
• Bar/Cafetería → Bodega Bar, Nevera, Almacén

1. Ve a "Mis Bodegas"
2. Crea al menos 2-3 bodegas principales
3. Dale nombres descriptivos

PASO 2 - Agregar tus primeros productos (10 min):
Empieza con tus 10-15 productos más importantes.

1. Ve a "Inventario"
2. Clic en "Agregar Producto"
3. Completa:
   • Nombre (ej: "Papa Amarilla 25kg")
   • Stock actual (cuánto tienes ahora)
   • Precio (cuánto cuesta comprar)
   • Bodega (dónde lo guardas)

4. Repite con tus productos principales

PASO 3 - Configurar alertas básicas (2 min):
Para no quedarte sin productos críticos.

1. Edita cada producto importante
2. Configura "Stock Mínimo" (ej: 5kg)
3. Guarda

PASO 4 - Importar el resto (si tienes Excel):
Si tienes una lista larga:

1. Clic en "Importar desde Excel"
2. Sube tu archivo
3. Revisa y confirma

📚 EXTRAS (después, cuando tengas tiempo):
• Exportar reportes
• Configurar fechas de vencimiento
• Revisar estadísticas en Dashboard

¿Qué tipo de negocio tienes? Te doy recomendaciones específicas.
```

---

## 🎬 Casos de Uso Completos (Conversaciones Largas)

### Caso 1: Cliente frustrado con otro sistema
**Usuario:** Vengo de otro sistema que era muy complicado, ¿este es igual?

**Asistente:**
```
Entiendo tu frustración. La mayoría de sistemas de inventario son complicados.

❌ SISTEMAS TRADICIONALES:
• Manuales de 50+ páginas
• Videos tutoriales largos
• Menús escondidos
• Nombres técnicos confusos
• Soporte lento (email, 24-48h)

✅ STOCKLY ES DIFERENTE:
• Conversación natural (como estamos haciendo ahora)
• Yo te guío en tiempo real
• Respuestas instantáneas 24/7
• Interfaz visual e intuitiva
• Todo está a máximo 2 clics

🎯 PRUEBA RÁPIDA (2 minutos):
Pregúntame cualquier cosa sobre inventario que no sepas hacer.

Ejemplos:
• "¿Cómo registro que compré 50kg de papa?"
• "¿Cómo sé qué se me está por acabar?"
• "¿Cómo exporto un reporte?"

Hazme una pregunta real que tengas. Si no puedo ayudarte en 30 segundos, Stockly no es para ti.

¿Qué quieres hacer primero?
```

**Usuario:** Ok, quiero registrar una compra de 30kg de arroz que hice hoy

**Asistente:**
```
Perfecto. Vamos a registrar esa compra.

🛒 OPCIÓN A - Si el arroz ya existe en tu inventario:
1. Ve a "Inventario"
2. Busca "Arroz" en la barra de búsqueda
3. Haz clic en el botón "Comprar" (ícono carrito)
4. Ingresa:
   • Cantidad: 30
   • Unidad: kg
   • Precio: [cuánto pagaste por kg]
5. Confirma

El sistema suma automáticamente los 30kg a tu stock actual.

📦 OPCIÓN B - Si es la primera vez que compras arroz:
1. Ve a "Inventario"
2. Clic en "Agregar Producto"
3. Completa:
   • Nombre: "Arroz [tipo] [presentación]" (ej: "Arroz Grado 1 Carolina")
   • Stock: 30
   • Unidad: kg
   • Precio: [cuánto pagaste]
   • Bodega: [donde lo guardaste]
4. Guarda

¿Ya tienes arroz registrado o es la primera vez?

[📦 Ir a Inventario]
```

**Usuario:** Es la primera vez, ¿puedo poner solo "Arroz"?

**Asistente:**
```
Puedes, pero te recomiendo ser más específico para evitar problemas futuros.

❌ PROBLEMA con solo "Arroz":
Si después compras:
• Arroz integral
• Arroz largo
• Arroz grado 2

No sabrás cuál es cuál. Tendrías que crear "Arroz 1", "Arroz 2"... confuso.

✅ SOLUCIÓN - Nombrar específico desde el inicio:
• "Arroz Grado 1 Carolina" (si es ese tipo)
• "Arroz Largo" (si es largo)
• "Arroz Integral" (si es integral)

Si solo compras un tipo de arroz siempre, "Arroz Blanco" está bien.

💡 RECOMENDACIÓN:
Usa: "Arroz [tipo que compraste]"

Revisa el paquete que compraste. Probablemente dice algo como:
• "Grado 1"
• "Carolina"
• "Largo fino"

Usa ese nombre. Te ayudará después.

¿Qué tipo de arroz compraste? (si no sabes, podemos usar "Arroz Blanco")
```

**Usuario:** Es Grado 1, voy a poner "Arroz Grado 1"

**Asistente:**
```
Perfecto. "Arroz Grado 1" es un excelente nombre.

🎯 AHORA CREA EL PRODUCTO:
1. Ve a "Inventario" → "Agregar Producto"
2. Completa:

   Nombre: Arroz Grado 1
   SKU: ARR-001 (o déjalo auto-generar)
   Categoría: Granos (o Insumos)
   Unidad: kg
   Stock actual: 30
   Precio por kg: [cuánto pagaste]
   Proveedor: [nombre del proveedor] (opcional)
   Bodega: Bodega Seca (o la que corresponda)

3. Guarda

✅ LISTO. Tu compra quedó registrada.

Ahora puedes:
• Ver el stock (30kg)
• Registrar cuando uses arroz
• Ver alertas cuando baje de cierto nivel

💡 SIGUIENTE PASO:
¿Quieres configurar una alerta para que te avise cuando te queden solo 5kg?

Así nunca te quedarás sin arroz sin darte cuenta.
```

**Usuario:** Sí, configura la alerta

**Asistente:**
```
Genial. Vamos a configurar la alerta de stock mínimo.

⚙️ CONFIGURAR ALERTA:
1. Ve a "Inventario"
2. Busca "Arroz Grado 1"
3. Haz clic en "Editar" (ícono lápiz)
4. Busca el campo "Stock Mínimo"
5. Ingresa: 5 (kg)
6. Guarda

Ahora:
• Cuando tengas más de 5kg → Indicador verde ✅
• Cuando tengas 5kg o menos → Alerta roja 🔴

Te llegará una notificación en la app cuando baje de 5kg.

💡 RECOMENDACIÓN:
• Stock mínimo = Cuánto consumes en 3-5 días

Si consumes 2kg de arroz por día:
• 3 días = 6kg
• 5 días = 10kg

Ajusta el stock mínimo a 10kg para tener margen de compra.

¿Consumes mucho arroz o poco? Ajustamos el número.
```

---

Este es el tipo de conversaciones que el asistente puede manejar de forma natural y útil.

---

## 💡 Tips para Demos en Vivo

1. **Empieza con algo simple:**
   - "¿Cómo creo una bodega?"
   - Muestra la respuesta + botón de acción

2. **Luego algo más complejo:**
   - "Tengo 200 productos en Excel, ¿puedo importarlos?"
   - Muestra que el asistente explica paso a paso

3. **Deja que el cliente pregunte:**
   - "Ahora tú pregúntale algo"
   - El cliente se sorprende de que realmente funciona

4. **Cierra con valor:**
   - "Y esto está disponible 24/7, sin costo extra"

---

**🎯 Usa este documento como guía para preparar demos y entender el alcance del asistente.**
