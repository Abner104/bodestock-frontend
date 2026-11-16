# 📖 GUÍA DE USO - STOCKLY
### Sistema de Gestión de Inventario y Costos

---

## 🎯 ¿QUÉ ES STOCKLY?

**Stockly** es un sistema profesional que te ayuda a:
- ✅ Controlar tu inventario en tiempo real
- ✅ Calcular el costo real de tus productos
- ✅ Gestionar a tu equipo de trabajo
- ✅ Recibir alertas cuando el stock está bajo
- ✅ Generar reportes automáticos cada mes

**Ideal para**: Restaurantes, panaderías, pastelerías, cafeterías, empresas de alimentos, talleres, y cualquier negocio que maneje inventario.

---

## 🚀 PASO 1: REGISTRO E INICIO

### Crear tu cuenta (Primera vez)

1. **Ingresa a la plataforma** → Click en "Registrarse"
2. **Completa los datos**:
   - Nombre de tu empresa
   - Tu nombre completo
   - Email
   - Contraseña
3. **Empieza con 30 días de prueba GRATIS**:
   - Acceso completo a todas las funcionalidades
   - Sin tarjeta de crédito requerida
   - Prueba el sistema sin compromisos

4. **Después de los 30 días, selecciona tu plan**:
   - **Free** (Gratis para siempre): 1 usuario, 50 productos, 1 bodega
   - **Básico** ($19.990/mes): 3 usuarios, 200 productos, 2 bodegas
   - **Profesional** ($49.990/mes): 10 usuarios, 1000 productos, 5 bodegas ⭐ **RECOMENDADO**
   - **Empresa** ($79.990/mes): Usuarios ilimitados, productos ilimitados, bodegas ilimitadas
5. **Click en "Crear Cuenta"**
6. **¡Listo!** Ya tienes acceso con trial de 30 días

### Iniciar Sesión

1. Ingresa tu email y contraseña
2. Click en "Iniciar Sesión"
3. Serás redirigido a tu Dashboard

---

## 📊 PASO 2: CONFIGURACIÓN INICIAL (15 minutos)

### 2.1 Crear tus Bodegas

Las bodegas son los lugares físicos donde guardas tu inventario.

**Ejemplos**: "Bodega Principal", "Cocina", "Barra", "Almacén Seco", etc.

1. Ve a **Inventario**
2. Click en **"Crear Bodega"** (botón superior derecho)
3. Ingresa el nombre de la bodega
4. Click en "Guardar"
5. Repite para cada bodega que tengas

💡 **Consejo**: Empieza con 1 o 2 bodegas. Puedes agregar más después.

---

### 2.2 Agregar tus Productos (Inventario)

Hay **3 formas** de agregar productos:

#### ✅ Opción A: Manual (Producto por producto)

1. Ve a **Inventario**
2. Click en **"Agregar Producto"**
3. Completa la información:
   - **Nombre**: Ej. "Harina integral"
   - **SKU**: Código único (opcional). Ej. "HAR-001"
   - **Categoría**: Ej. "Granos", "Lácteos", "Carnes"
   - **Stock inicial**: Cantidad que tienes ahora
   - **Unidad**: kg, litros, unidades, gramos
   - **Bodega**: Dónde está guardado
   - **Proveedor**: De quién lo compras
4. Click en **"Guardar"**

#### ✅ Opción B: Importar desde Excel (Múltiples productos)

1. Ve a **Inventario**
2. Click en **"Importar Excel"** (ícono de hoja)
3. Descarga la plantilla de ejemplo
4. Llena la plantilla con tus productos:
   ```
   Nombre           | SKU      | Categoría | Stock | Unidad | Proveedor
   Harina integral  | HAR-001  | Granos    | 50    | kg     | Molinera ABC
   Leche entera     | LEC-001  | Lácteos   | 20    | litros | Lechería XYZ
   ```
5. Sube el archivo Excel
6. **¡Listo!** Todos los productos se importan automáticamente

#### ✅ Opción C: Con Escáner de Códigos (Avanzado)

1. Ve a **Inventario**
2. Click en **"Escanear Código"** (ícono de cámara)
3. Permite acceso a la cámara
4. Apunta al código de barras o QR del producto
5. El sistema lo busca en tu inventario
6. Si no existe, puedes crearlo desde ahí

---

### 2.3 Sistema de Notificaciones de Stock (Automático)

**Stockly te mantiene informado automáticamente** cuando hay productos con stock bajo o agotado.

#### 📱 Notificaciones en la Plataforma

Las notificaciones aparecen en **3 lugares diferentes**:

1. **Campana en el Navbar** (arriba a la derecha):
   - 🔔 Ícono de campana con badge rojo
   - Número indica cuántos productos requieren atención
   - Click para ver lista completa de productos

2. **Menú Lateral** (Más → Notificaciones):
   - Abre el drawer lateral (botón hamburguesa)
   - Busca la sección "Más"
   - Click en "Notificaciones"
   - Badge rojo muestra el número de alertas

3. **En Móvil** (Campana flotante central):
   - Botón naranja en el centro superior
   - Muestra "Stock bajo" con cantidad
   - Muy visible y fácil de acceder

#### 📧 Alertas por Email (Automáticas)

**¿Quién recibe las alertas?**
- Todos los usuarios con rol **ADMIN** de tu empresa
- Los emails se registran automáticamente al crear administradores

**¿Cuándo se envían?**
- El sistema verifica cada 6 horas
- Solo envía si hay productos que cumplan los umbrales configurados
- Los emails incluyen: nombre, stock actual, bodega y precio

**Configurar umbrales**:
- Ve a **Menú Lateral → Más → Notificaciones**
- Ajusta los umbrales según tus necesidades:
  - 🔴 **Stock Crítico** (por defecto ≤ 0)
  - 🟡 **Stock Bajo** (por defecto ≤ 5)
  - 🟠 **Stock Advertencia** (por defecto ≤ 10)
- Click en **"Guardar Configuración"** para aplicar los cambios

---

## 👥 PASO 3: GESTIONAR TU EQUIPO

### 3.1 Crear Trabajadores

Si tienes empleados que van a usar el sistema:

1. Ve a **Trabajadores** (menú lateral)
2. Click en **"Crear Trabajador"**
3. Completa:
   - **Nombre completo**
   - **Email** (se creará una cuenta para él/ella)
   - **Rol**:
     - **ADMIN**: Control total (tú mismo u otro socio)
     - **SUPERVISOR**: Puede aprobar salidas, ver reportes
     - **WORKER**: Solo registra salidas de inventario
4. Asigna **bodegas**: A cuáles puede acceder
5. Configura **límites diarios máximos** (opcional):
   - Por dinero: Ej. $50.000 por día (máximo permitido)
   - Por cantidad: Ej. 10 unidades por día (máximo permitido)
   - Sin límite: Para supervisores de confianza

6. Click en **"Crear"**

**El sistema generará**:
- Email de acceso
- Contraseña automática
- Podrás enviársela por email o anotarla

---

### 3.2 Límites Diarios (Control de salidas)

**¿Para qué sirve?**
Establecer un máximo de productos que un empleado puede sacar por día.

**Ejemplo Real**:
- Juan es Trabajador de bodega
- Configuraste límite de $30.000/día
- Hoy ya sacó productos por $25.000
- Puede sacar máximo $5.000 más
- Si intenta sacar $10.000 → **EL SISTEMA NO LO PERMITE**
- Debe esperar al día siguiente o contactar a un admin

**Tipos de límites**:
1. **Por Dinero (CLP)**: Suma el valor total de los productos (máximo permitido)
2. **Por Unidades**: Suma las cantidades (10kg + 5 litros = 15 unidades máximo)
3. **Sin Límite**: Para administradores o supervisores de confianza

**El límite es ESTRICTO**: Una vez alcanzado, no se pueden hacer más salidas hasta el día siguiente.

---

## 📦 PASO 4: REGISTRAR MOVIMIENTOS DE INVENTARIO

### 4.1 Registrar Compras (Entrada de productos)

Cuando compras mercancía:

1. Ve a **Inventario**
2. Busca el producto que compraste
3. Click en **"Compra"** (botón verde)
4. Completa:
   - **Cantidad comprada**: Ej. 10 kg
   - **Precio TOTAL de la compra**: Ej. $220.000 (lo que pagaste en total)
   - **Fecha**: Se registra automáticamente
5. Click en **"Registrar Compra"**

**El sistema automáticamente**:
- Suma al stock actual
- Calcula el nuevo **PPP** (Precio Promedio Ponderado)
- Guarda la compra en el historial

**💡 Ejemplo de PPP**:
```
Tenías: 5 kg a $20.000/kg = $100.000 total
Compraste: 10 kg por $220.000 total

Nuevo PPP = ($100.000 + $220.000) ÷ (5 + 10)
          = $320.000 ÷ 15 kg
          = $21.333/kg

Nuevo stock: 15 kg
```

---

### 4.2 Registrar Salidas (Cuando usas productos)

**Hay 2 formas**:

#### ✅ Forma A: Desde el Inventario (Como Admin)

1. Ve a **Inventario**
2. Busca el producto
3. Click en **"Salida"** (botón rojo)
4. Completa:
   - **Cantidad**: Cuánto sacas
   - **Motivo**:
     - 🟢 **Venta**: Vendiste a un cliente
     - 🔴 **Merma**: Producto vencido/dañado
     - 🔵 **Transferencia**: A otra bodega
     - 🟠 **Producción**: Para elaborar productos
     - 🟣 **Consumo**: Uso interno
   - **Notas**: Ej. "Venta a cliente ABC"
5. Click en **"Registrar Salida"**

#### ✅ Forma B: Pantalla de Salidas (Para Trabajadores)

1. Ve a **Salida de Inventario** (menú lateral)
2. Selecciona la **bodega**
3. Busca el producto (puedes **escanear el código**)
4. Agrega al "carrito"
5. Especifica cantidad el motivo siempre sera produccion
6. Click en **"Registrar Salida"**

**Si excedes el límite diario**:
- El sistema **NO permite** la salida
- Muestra mensaje: "Límite diario alcanzado"
- El trabajador debe esperar al día siguiente o contactar a un admin para que aumente el límite

---

### 4.3 Ver Historial de Compras

Para ver todas las compras de un producto:

1. Ve a **Inventario**
2. Busca el producto
3. Click en **"Ver Historial"** (ícono de reloj)
4. Verás:
   - Fecha de cada compra
   - Cantidad comprada
   - Precio total pagado
   - **PPP resultante** después de esa compra

---

## 💰 PASO 5: COSTEAR PRODUCTOS (Calcular Precio de Venta)

### 5.1 ¿Qué es el Costeo?

El costeo te ayuda a calcular cuánto te cuesta producir un producto y cuánto deberías venderlo.

**Ejemplo**: Calcular el costo de un "Pan Integral 500g"

---

### 5.2 Crear un Producto Costeado

1. Ve a **Costeo** (menú lateral)
2. Click en **"Nuevo Producto"**
3. **PASO 1**: Agrega insumos
   - Busca "Harina integral" en tu inventario
   - Especifica cantidad: 400 gramos
   - El sistema trae automáticamente el PPP
   - Agrega más insumos (levadura, agua, sal, etc.)

4. **PASO 2**: Costos adicionales
   - **Costo Operativo**: Ej. 10% (electricidad, gas, agua)
   - **Personal/MOD**: Ej. 15% (mano de obra)
   - **Otros gastos**: Ej. 5% (empaque, etiquetas)
   - **Utilidad**: Ej. 20% (tu ganancia)
   - **IVA**: 19% (automático)

5. **PASO 3**: Presentación
   - ¿El producto se divide en porciones?
     - **SÍ**: Ej. 1 pan de 500g se divide en 4 rodajas
     - **NO**: Se vende completo
   - Peso por porción: 125g

6. **Ver Resultados**:
   ```
   Costo Base (insumos):     $1.000
   Costo Operativo (10%):    $100
   Personal (15%):           $150
   Otros (5%):               $50
   ──────────────────────────────
   Subtotal:                 $1.300
   Utilidad (20%):           $260
   ──────────────────────────────
   Costo Final:              $1.560
   IVA (19%):                $296
   ──────────────────────────────
   PRECIO DE VENTA:          $1.856

   Por porción (125g):       $464
   ```

7. Click en **"Guardar Producto"**
8. Ahora aparece en tu **Catálogo de Productos**

---

## 📈 PASO 6: VER REPORTES Y ESTADÍSTICAS

### 6.1 Dashboard Principal

Tu pantalla principal muestra:

- 📊 **Gráfico de Tendencias**: Movimientos de los últimos 7 días
- 📦 **Total de Productos**: Insumos y productos terminados
- 💵 **Producto más caro** y **más barato**
- 🔔 **Alertas de Stock Bajo**
- 📋 **Últimas 5 Salidas**: Quién sacó qué y cuándo

---

### 6.2 Historial de Salidas

Para ver todas las salidas de inventario:

1. Ve a **Reportes** (menú lateral)
2. Verás una tabla con:
   - Fecha y hora
   - Trabajador que hizo la salida
   - Productos y cantidades
   - Motivo (venta, merma, etc.)
   - Valor total

3. **Filtros disponibles**:
   - Por rango de fechas
   - Por trabajador
   - Por motivo
   - Por bodega

4. **Exportar a Excel**:
   - Click en "Exportar"
   - Se descarga un archivo Excel con toda la información

---

### 6.3 Reporte Mensual Automático

**Cada día 1 de mes a las 10:00 AM**:
- El sistema genera un reporte completo
- Lo envía por email automáticamente
- Incluye:
  - Movimientos del mes anterior
  - Productos más movidos
  - Trabajadores más activos
  - Análisis de mermas
  - Valores de salidas por categoría

No tienes que hacer nada, es automático.

---

## 🔔 PASO 7: SISTEMA DE NOTIFICACIONES

### 7.1 Acceder a las Notificaciones

**Stockly tiene 3 formas de acceder a las notificaciones**:

#### 🖥️ **Opción 1: Campana en Desktop** (Recomendado)
1. Ve a la parte superior derecha del navbar
2. Busca el ícono de **campana** 🔔
3. Si hay productos con stock bajo, verás un **badge rojo** con el número
4. Click en la campana → Se abre un panel con la lista completa
5. Click en cualquier producto → Te lleva directo al inventario

#### 📱 **Opción 2: Menú Lateral** (Desktop y Móvil)
1. Abre el **menú lateral** (botón hamburguesa ☰)
2. Baja hasta la sección **"Más"**
3. Click en **"Notificaciones"**
4. Verás el badge rojo con el número de alertas
5. Se abre el mismo panel de notificaciones

#### 📲 **Opción 3: Campana Flotante** (Solo Móvil)
1. En el centro superior del navbar verás un **botón naranja**
2. Dice "Stock bajo" con el número de productos
3. Click para ver las notificaciones
4. Muy visible y fácil de usar desde el celular

---

### 7.2 Tipos de Notificaciones

**🔴 SIN STOCK** (Crítico)
- Producto con **0 unidades**
- Fondo rojo en la notificación
- Requiere acción inmediata
- Click para ir al inventario y hacer compra

**🟠 STOCK BAJO** (Advertencia)
- Producto con **5 o menos unidades**
- Fondo naranja en la notificación
- Planifica tu próxima compra
- Evita quedarte sin stock

---

### 7.3 Configurar Umbrales de Stock

**¿Dónde configurar los umbrales?**

1. Abre el **menú lateral** (botón hamburguesa ☰)
2. Baja hasta la sección **"Más"**
3. Click en **"Notificaciones"**
4. Verás la sección **"Umbrales de Stock"**

**¿Qué puedes configurar?**

**🔴 Stock Crítico (≤)**
- Por defecto: **0 unidades**
- Alerta de máxima prioridad
- Ejemplo: Si pones "2", recibirás alertas cuando stock ≤ 2

**🟡 Stock Bajo (≤)**
- Por defecto: **5 unidades**
- Requiere reabastecimiento pronto
- Ejemplo: Si pones "10", recibirás alertas cuando stock ≤ 10

**🟠 Stock Advertencia (≤)**
- Por defecto: **10 unidades**
- Para planificar próxima compra
- Ejemplo: Si pones "20", recibirás alertas cuando stock ≤ 20

**💾 Guardar cambios**
- Después de ajustar los umbrales, haz click en **"Guardar Configuración"**
- Los cambios se aplican inmediatamente

---

### 7.4 Alertas por Email (Automáticas)

Los emails se envían **automáticamente** a todos los **ADMIN** de tu empresa:

**¿Cuándo llegan?**
- Cada 6 horas el sistema verifica el stock
- Solo envía si hay productos que cumplan los umbrales configurados
- No recibes spam si todo está bien

**¿Qué incluyen?**
- Tabla con todos los productos afectados
- Nombre del producto, stock actual, bodega
- Precio promedio ponderado (PPP)
- Enlace directo para acceder al sistema

**Importante**: Los umbrales que configuraste determinan qué productos generan alertas

---

## 📱 PASO 8: USO DESDE MÓVIL

### 8.1 Acceso Móvil

El sistema funciona perfectamente desde el navegador de tu celular:

1. Abre Chrome, Safari o Firefox
2. Ingresa a la URL del sistema
3. Inicia sesión
4. **Todo se adapta automáticamente al tamaño de pantalla**

---

## 🎓 PASO 9: CAPACITAR A TU EQUIPO

### 9.1 Para Supervisores

Los supervisores tienen acceso adicional a:

1. **Ver reportes de su equipo**
2. **Gestionar límites diarios** (ajustar límites de trabajadores)
3. **Acceso a todas las bodegas asignadas**
4. **Supervisar actividad del equipo**

---

## 🆘 PASO 10: RESOLUCIÓN DE PROBLEMAS

### ❓ Problemas Comunes

**1. "No puedo registrar una salida"**
- ✅ Verifica que haya stock disponible
- ✅ Verifica que no hayas excedido tu límite diario (si aplica)
- ✅ Si eres TRABAJADOR, verifica que tengas acceso a esa bodega
- ✅ Si alcanzaste el límite, contacta a un ADMIN para que lo ajuste temporalmente

**2. "No me llegan las alertas de email"**
- ✅ Ve a Notificaciones → Verifica que estén activadas
- ✅ Verifica que el email sea correcto
- ✅ Revisa la carpeta de spam

**3. "El PPP no se calcula bien"**
- ✅ Asegúrate de ingresar el **precio TOTAL** de la compra
- ✅ No ingreses el precio unitario
- ✅ Ejemplo: Si compraste 10kg por $220.000, ingresa $220.000

**4. "Olvidé mi contraseña"**
- ✅ Click en "Olvidé mi contraseña" en la pantalla de login
- ✅ Ingresa tu email
- ✅ Recibirás un link para resetear

**5. "Un trabajador no puede acceder"**
- ✅ Ve a Trabajadores → Verifica que esté **activo**
- ✅ Verifica que tenga **bodegas asignadas**
- ✅ Verifica que su **email sea correcto**

---

## 💡 MEJORES PRÁCTICAS

### ✅ DO (Haz esto)

1. **Actualiza el inventario diariamente**
   - Registra compras el mismo día
   - Registra salidas en el momento

2. **Revisa las alertas semanalmente**
   - Ve la campana de notificaciones
   - Actúa sobre productos con stock bajo

3. **Capacita a tu equipo gradualmente**
   - Empieza con 1-2 personas
   - Expande cuando dominen el sistema

4. **Usa categorías claras**
   - "Granos", "Lácteos", "Carnes", etc.
   - Facilita filtros y búsquedas

5. **Configura límites razonables**
   - No muy restrictivos (frustra al equipo)
   - No muy laxos (pierdes control)

---

### ❌ DON'T (Evita esto)

1. **No compartas la cuenta de ADMIN**
   - Crea cuentas individuales para cada persona
   - Mejor control y auditoría

2. **No ignores las solicitudes de permisos**
   - Revísalas rápido
   - Puedes aprobar/rechazar desde el celular

3. **No elimines productos con historial**
   - Mejor márcalos como "descontinuados"
   - Preservas el historial

4. **Evalúa si el plan Free es suficiente**
   - Es gratis para siempre pero muy limitado (1 bodega, 50 productos)
   - Si tu negocio crece, considera un plan pagado
   - Los planes pagados tienen más funcionalidades

5. **No olvides exportar datos mensualmente**
   - Genera backups en Excel
   - Por seguridad

---

## 📞 SOPORTE Y CONTACTO

### ¿Necesitas ayuda?

- 📧 **Email**: soporte@stockly.app
- 💬 **WhatsApp**: +56 9 XXXX XXXX
- 🌐 **Centro de Ayuda**: https://ayuda.stockly.app
- 📹 **Tutoriales en Video**: https://youtube.com/@stockly

**Horario de atención**:
- Lunes a Viernes: 9:00 AM - 6:00 PM
- Sábados: 10:00 AM - 2:00 PM

---

## 🎉 ¡LISTO PARA EMPEZAR!

### Checklist de Inicio Rápido

- [ ] Cuenta creada y plan seleccionado
- [ ] Bodegas creadas (mínimo 1)
- [ ] Primeros 10-20 productos agregados
- [ ] Alertas de stock configuradas
- [ ] Trabajadores creados (si aplica)
- [ ] Primera salida registrada
- [ ] Dashboard revisado

**¡Felicidades! Ya estás usando Stockly profesionalmente.**

---

### 🚀 Próximos Pasos

1. **Semana 1**: Familiarízate con el inventario y salidas
2. **Semana 2**: Crea tus primeros productos costeados
3. **Semana 3**: Capacita a tu equipo
4. **Semana 4**: Revisa el primer reporte mensual

**💪 Tips para el Éxito**:
- Usa el sistema todos los días (crea el hábito)
- Revisa los reportes semanalmente
- Ajusta límites según necesites
- Pide feedback a tu equipo

---

**Versión**: 1.0
**Última actualización**: Noviembre 2025
**Sistema**: Stockly - Gestión Profesional de Inventario y Costos
