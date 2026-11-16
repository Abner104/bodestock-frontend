# 📋 Guía de Facturación Electrónica en Stockly

## ✅ Requisitos Previos

Antes de comenzar, asegúrate de tener:

- ✅ **Empresa registrada en el SII** (Servicio de Impuestos Internos)
- ✅ **Folios autorizados** por el SII (gratuitos - los solicitas desde tu cuenta SII)
- ✅ **Certificado Digital** vigente (costo aproximado: $10.000 - $15.000 CLP/año)

---

## 🎯 ¿Qué es SimpleFactura?

**SimpleFactura** es un servicio intermediario que facilita la emisión de Documentos Tributarios Electrónicos (DTE) hacia el SII de forma programática.

### ⚠️ Importante: ¿Qué NO es SimpleFactura?

- ❌ **NO vende folios** (los folios son gratis y los obtienes del SII)
- ❌ **NO es el SII** (es solo un intermediario técnico)
- ❌ **NO reemplaza tu certificado digital** (usas tu propio certificado del SII)

### ✅ ¿Qué SÍ hace SimpleFactura?

- ✅ Proporciona una **API fácil de usar** para emitir boletas y facturas
- ✅ Genera automáticamente los **archivos XML** en formato SII
- ✅ **Firma digitalmente** los documentos con tu certificado
- ✅ **Envía los DTEs al SII** en tu nombre
- ✅ Te entrega **PDFs listos para imprimir** o enviar por email
- ✅ Valida que todo cumpla con las **normativas del SII**

### 💰 Costo del Servicio

| Concepto | Proveedor | Costo Aproximado | Frecuencia |
|----------|-----------|------------------|------------|
| **Folios** | SII | **GRATIS** | Solicitud según necesidad |
| **Certificado Digital** | SII o entidades certificadoras | $10.000 - $15.000 CLP | Anual |
| **SimpleFactura (Plan Básico)** | SimpleFactura.cl | $10.000 - $30.000 CLP | Mensual |

---

## 🚀 Paso a Paso: Configuración en Stockly

### Paso 1️⃣: Crear Cuenta en SimpleFactura

1. Ingresa a [https://www.simplefactura.cl](https://www.simplefactura.cl)
2. Haz clic en **"Crear Cuenta"** o **"Registrarse"**
3. Completa tus datos:
   - RUT de tu empresa
   - Razón Social
   - Email de contacto
   - Contraseña

4. **Verifica tu email** (revisa bandeja de entrada y spam)

---

### Paso 2️⃣: Configurar tu Certificado Digital en SimpleFactura

1. Inicia sesión en [https://app.simplefactura.cl](https://app.simplefactura.cl)
2. Ve a **Configuración** → **Certificado Digital**
3. Sube tu archivo **certificado.pfx** (o .p12) que obtuviste del SII
4. Ingresa la **contraseña del certificado**
5. Guarda los cambios

---

### Paso 3️⃣: Cargar Folios en SimpleFactura

1. En tu cuenta de SimpleFactura, ve a **Folios** → **Cargar Folios**
2. Sube los archivos de folios que descargaste del SII (formato XML):
   - **Boletas Electrónicas** (Tipo 39)
   - **Facturas Electrónicas** (Tipo 33)
3. SimpleFactura validará automáticamente que los folios sean válidos

💡 **Tip:** Solicita al menos 100 folios de cada tipo para empezar.

---

### Paso 4️⃣: Obtener tu API Key de SimpleFactura

1. En SimpleFactura, ve a **Configuración** → **API** o **Integraciones**
2. Busca la sección **"API Key"** o **"Token de Acceso"**
3. Haz clic en **"Generar API Key"** o **"Crear Token"**
4. **Copia y guarda** esta API Key (la necesitarás en Stockly)

⚠️ **Importante:** Esta API Key es como una contraseña. No la compartas con nadie.

---

### Paso 5️⃣: Configurar Stockly

1. **Inicia sesión en Stockly** con tu cuenta de administrador

2. Ve a tu **Perfil** (clic en tu nombre arriba a la derecha)

3. Haz clic en el botón **"Configurar Facturación Electrónica SII"**

4. Completa el formulario:

   **A. Selección de Proveedor:**
   - Selecciona **"SimpleFactura"** (recomendado)

   **B. Ambiente:**
   - **Certificación**: Para pruebas (usa esto primero)
   - **Producción**: Solo cuando estés segura de que todo funciona

   **C. Credenciales:**
   - **API Key**: Pega la API Key que copiaste de SimpleFactura
   - Deja **API URL** vacío (Stockly usa la URL automática de SimpleFactura)

   **D. Datos de tu Empresa (importante - revisa que sean correctos):**
   - **RUT Emisor**: Tu RUT empresarial (formato: 12345678-9)
   - **Razón Social**: Nombre legal de tu empresa
   - **Giro**: Actividad comercial (ej: "Venta de ropa al por menor")
   - **Actividad Económica (Código)**: Código ACTECO del SII (ej: 477310)
   - **Dirección**: Dirección fiscal de tu empresa
   - **Comuna**: Comuna donde está ubicada tu empresa

5. Haz clic en **"Guardar Configuración"**

6. ✅ Deberías ver un mensaje: **"Configuración guardada exitosamente"**

---

### Paso 6️⃣: Probar en Ambiente de Certificación

Antes de emitir documentos reales, **SIEMPRE prueba primero** en el ambiente de certificación:

1. **Crear una venta de prueba:**
   - Ve a **Salidas** en Stockly
   - Crea una salida con algunos productos
   - Guarda la salida

2. **Emitir una Boleta de Prueba:**
   - Haz clic en el botón **"Ver detalles"** de la salida
   - Haz clic en **"Emitir Boleta Electrónica"**
   - Verifica los datos y confirma
   - ✅ Deberías recibir un PDF de la boleta con código QR

3. **Verificar en SimpleFactura:**
   - Ingresa a tu cuenta de SimpleFactura
   - Ve a **Documentos** → **Boletas**
   - Deberías ver la boleta emitida con estado **"CERTIFICACIÓN"**

4. **Si todo funciona correctamente:**
   - Vuelve a **Perfil** → **Facturación Electrónica SII**
   - Cambia **Ambiente** de "Certificación" a **"Producción"**
   - Guarda nuevamente

---

## 📝 Cómo Usar la Facturación en Stockly

### 🧾 Emitir Boletas Electrónicas (Tipo 39)

**Cuándo usar:** Ventas a consumidores finales sin necesidad de factura con datos del receptor.

1. Ve a **Salidas** en Stockly
2. Crea una nueva salida o selecciona una existente
3. Haz clic en **"Emitir Boleta Electrónica"**
4. Revisa los datos (cliente genérico 66.666.666-6)
5. Confirma
6. ✅ Recibirás:
   - PDF con código QR
   - Número de folio asignado
   - Documento enviado automáticamente al SII

---

### 📄 Emitir Facturas Electrónicas (Tipo 33)

**Cuándo usar:** Ventas a empresas que necesitan factura con datos del receptor para contabilidad.

1. Ve a **Salidas** en Stockly
2. Crea una nueva salida o selecciona una existente
3. Haz clic en **"Emitir Factura Electrónica"**
4. **Importante:** Completa los datos del receptor:
   - RUT del cliente (empresa)
   - Razón Social
   - Giro
   - Dirección
   - Comuna
5. Confirma
6. ✅ Recibirás:
   - PDF con datos del receptor
   - Número de folio asignado
   - Documento enviado automáticamente al SII

---

### 🚚 Emitir Guías de Despacho Electrónicas (Tipo 52)

**Cuándo usar:** **OBLIGATORIO** cuando trasladas mercadería antes de emitir la factura. Es un documento de transporte requerido por el SII.

**Casos de uso comunes:**
- Entregas a domicilio (vendes pero entregas después)
- Traslados a sucursales
- Consignaciones
- Entregas con facturación diferida

#### ¿Por qué es importante?

El SII **exige** que toda mercadería en tránsito cuente con un documento tributario que respalde su traslado. Sin una Guía de Despacho, te arriesgas a multas en fiscalizaciones.

#### Flujo profesional recomendado:

```
📝 Pedido → 🚚 Guía de Despacho → 📦 Despacho → 📄 Factura
```

#### Cómo emitir una Guía de Despacho:

1. Ve a **Salidas** en Stockly
2. Crea una nueva salida (con razón "SALE")
3. Haz clic en **"Ver detalles"** de la salida
4. Selecciona **"🚚 Guía de Despacho"**
5. **Completa los datos del destinatario:**
   - RUT del cliente
   - Razón Social
   - Giro (ej: "Comercio al por menor")
   - Dirección de destino
   - Comuna de destino

6. **Completa los datos de transporte (OBLIGATORIO):**
   - **Patente del vehículo** (ej: ABCD12)
   - RUT del transportista (si es externo)
   - Nombre del chofer
   - RUT del chofer
   - Dirección de destino
   - Comuna de destino
   - **Tipo de traslado:**
     - ✅ **"Operación constituye venta"** (vas a facturar después) - **Más común**
     - "Venta por efectuar a terceros"
     - "Consignación"
     - "Entrega gratuita"
     - "Traslado interno"
     - "Otros traslados no venta"

7. Haz clic en **"🚚 Emitir Guía de Despacho Electrónica"**

8. ✅ Recibirás:
   - PDF con datos del transporte
   - Número de folio asignado
   - Documento enviado automáticamente al SII
   - **El chofer puede llevar este PDF impreso durante el traslado**

#### Después del despacho: Emitir Factura

Una vez que la mercadería llegó a destino:

1. Ve a la misma salida en **Salidas**
2. Haz clic en **"Ver detalles"**
3. Ahora selecciona **"📄 Factura"**
4. Completa los datos del receptor (ya los tienes de la guía)
5. Emite la factura

**Importante:** La guía y la factura quedan vinculadas a la misma salida, así tienes el historial completo del flujo.

#### Ventajas de usar Guías de Despacho:

✅ **Cumplimiento legal:** SII no te multará por mercadería sin respaldo
✅ **Profesionalismo:** Los clientes ven que operas formalmente
✅ **Control de inventario:** Trazabilidad completa de traslados
✅ **Facturación diferida:** Despachas hoy, facturas mañana (según acuerdo con cliente)
✅ **Evitas problemas en fiscalizaciones:** PDI/Carabineros puede pedir documentos en ruta

#### ⚠️ Errores comunes a evitar:

❌ **Olvidar la patente:** Es obligatorio para Guías de Despacho
❌ **Usar tipo de traslado incorrecto:** Si vas a facturar, usa "Operación constituye venta"
❌ **No imprimir la guía:** El chofer DEBE llevar el PDF impreso durante el traslado
❌ **Emitir solo factura sin guía:** Si hay traslado, SIEMPRE debe haber guía primero

---

## 🔍 Verificación y Seguimiento

### ¿Cómo saber si mi documento llegó al SII?

1. **Desde Stockly:**
   - Los documentos emitidos muestran el estado (EMITIDO, ACEPTADO, RECHAZADO)
   - El PDF incluye un código QR que puedes escanear para verificar en el SII

2. **Desde SimpleFactura:**
   - Ingresa a tu cuenta
   - Ve a **Documentos**
   - Verás el listado con estados actualizados

3. **Desde el SII directamente:**
   - Ingresa a [https://www.sii.cl](https://www.sii.cl) con tu clave tributaria
   - Ve a **Facturación Electrónica** → **Registro de Aceptación y Reclamos**
   - Busca el documento por folio y fecha

---

## ❓ Preguntas Frecuentes

### ¿Qué pasa si se me acaban los folios?

1. Ingresa al sitio del SII con tu clave tributaria
2. Solicita más folios (proceso gratuito e inmediato)
3. Descarga el archivo XML de folios
4. Súbelo a SimpleFactura en la sección **Folios**

### ¿Puedo emitir boletas y facturas del mismo producto?

✅ Sí, el mismo producto puede generar boletas o facturas según el tipo de cliente.

### ¿Qué hago si SimpleFactura no me funciona?

Stockly soporta **múltiples proveedores**:
- **LibreDTE** (alternativa open-source)
- **ChileSystems** (otro proveedor comercial)
- **SII Directo** (gratis pero muy técnico - no recomendado)

Para cambiar de proveedor:
1. Ve a **Perfil** → **Facturación Electrónica SII**
2. Selecciona otro proveedor
3. Completa las credenciales del nuevo proveedor

### ¿Cuánto demora en aparecer en el SII?

- **Ambiente Certificación:** Inmediato (segundos)
- **Ambiente Producción:** Entre 30 segundos y 5 minutos

### ¿Puedo cancelar o anular una boleta/factura?

⚠️ **No directamente desde Stockly** (aún). Para anular un documento:
1. Ingresa a SimpleFactura
2. Ve al documento emitido
3. Usa la opción **"Anular"** o **"Nota de Crédito"**

### ¿Qué pasa si mi certificado digital vence?

1. Renueva tu certificado digital en el SII (antes de que expire)
2. Sube el nuevo certificado a SimpleFactura
3. No necesitas cambiar nada en Stockly (usa la misma API Key)

### ¿Los clientes pueden ver sus documentos?

✅ Sí, tienes varias opciones:
- Enviar el PDF por email (desde Stockly o SimpleFactura)
- Imprimir el PDF con código QR
- El cliente puede verificar en el SII escaneando el QR

### ¿Cuándo debo usar Guía de Despacho en vez de Factura directamente?

🚚 **Usa Guía de Despacho cuando:**
- Entregas mercadería a domicilio
- El pago se hace después de la entrega
- Necesitas que el chofer tenga un documento de respaldo durante el traslado
- Trasladas entre sucursales propias
- Envías productos en consignación

📄 **Factura directamente cuando:**
- El cliente paga y retira en tu local (venta mostrador)
- Es una venta digital sin envío físico
- No hay traslado de mercadería

**Regla de oro:** Si la mercadería viaja en un vehículo, **SIEMPRE** debe llevar Guía de Despacho.

### ¿Puedo emitir la Guía y la Factura el mismo día?

✅ Sí, perfectamente. El flujo puede ser:
1. **Mañana:** Emites Guía de Despacho y despachas
2. **Tarde:** Cliente recibe y confirma, emites Factura
3. Ambos documentos quedan registrados en el SII

### ¿Qué pasa si Carabineros o PDI detienen al chofer?

Si llevas la **Guía de Despacho impresa**, no hay problema. El documento respalda el traslado.

Si **NO llevas Guía de Despacho**:
- ⚠️ Multa del SII (desde $50.000 CLP)
- ⚠️ Posible retención de la mercadería
- ⚠️ Sanciones administrativas

**Por eso es obligatorio llevar el PDF impreso durante el transporte.**

### ¿Necesito distintos folios para cada tipo de documento?

✅ **Sí**, cada tipo de documento usa su propio rango de folios:
- **Boletas (Tipo 39):** Folios independientes
- **Facturas (Tipo 33):** Folios independientes
- **Guías de Despacho (Tipo 52):** Folios independientes

Solicita todos los tipos de folios que necesites en el portal del SII (son gratis).

---

## 🆘 Soporte

### Problemas con Stockly
- Contacta al administrador de Stockly
- Email: [tu-email-de-soporte@example.com]

### Problemas con SimpleFactura
- Soporte SimpleFactura: [https://www.simplefactura.cl/soporte](https://www.simplefactura.cl/soporte)
- Email: contacto@simplefactura.cl

### Problemas con el SII
- Soporte SII: 223951502 (desde Santiago)
- Sitio web: [https://www.sii.cl](https://www.sii.cl)

---

## ✅ Checklist Final

Antes de empezar a facturar en producción, verifica:

### Configuración Inicial
- [ ] Tengo cuenta activa en SimpleFactura (u otro proveedor)
- [ ] Subí mi certificado digital a SimpleFactura
- [ ] Cargué folios de boletas (Tipo 39) en SimpleFactura
- [ ] Cargué folios de facturas (Tipo 33) en SimpleFactura
- [ ] Cargué folios de guías de despacho (Tipo 52) en SimpleFactura
- [ ] Configuré la API Key en Stockly
- [ ] Verifiqué que los datos de mi empresa sean correctos

### Pruebas en Certificación
- [ ] Probé emitir una boleta en **Certificación**
- [ ] Probé emitir una factura en **Certificación**
- [ ] Probé emitir una guía de despacho en **Certificación**
- [ ] Verifiqué que los documentos aparezcan en SimpleFactura

### Puesta en Producción
- [ ] Cambié el ambiente a **Producción** en Stockly
- [ ] Emití mi primera boleta real ✅
- [ ] Emití mi primera factura real ✅
- [ ] Emití mi primera guía de despacho real ✅

---

## 🎉 ¡Felicitaciones!

Ahora estás lista para emitir **boletas, facturas y guías de despacho** electrónicas directamente desde Stockly.

### 📊 Resumen de Documentos Tributarios Disponibles:

| Documento | Tipo SII | Cuándo usar |
|-----------|----------|-------------|
| **🧾 Boleta Electrónica** | 39 | Ventas a consumidores finales (sin datos del receptor) |
| **📄 Factura Electrónica** | 33 | Ventas a empresas (requiere datos del receptor) |
| **🚚 Guía de Despacho** | 52 | Traslado de mercadería (OBLIGATORIO antes de facturar si hay transporte) |

### 🔄 Flujo Recomendado para Ventas con Despacho:

```
1️⃣ Cliente hace pedido
2️⃣ Emites Guía de Despacho (Tipo 52)
3️⃣ Chofer entrega mercadería con guía impresa
4️⃣ Cliente recibe y confirma
5️⃣ Emites Factura (Tipo 33) o Boleta (Tipo 39)
```

**Recuerda:**
- Los folios son **gratis** del SII
- SimpleFactura es el **intermediario técnico** (costo mensual)
- Usa tu **propio certificado** del SII
- **Prueba siempre** en certificación antes de producción
- **Guías de Despacho son obligatorias** si trasladas mercadería

¡Éxito con tu facturación electrónica profesional! 🚀

---

**Última actualización:** Febrero 2026
**Versión de Stockly:** 2.0+
**Compatibilidad:** SimpleFactura, LibreDTE, ChileSystems
