# 📦 Selección de Bodega para Etiquetas QR

## ✅ Implementado

Se ha mejorado el botón de **Etiquetas QR** para permitir que el usuario seleccione qué bodega(s) quiere generar.

---

## 🎯 Problema Resuelto

**Antes:**
- Al hacer click en "Etiquetas QR", se generaban automáticamente las etiquetas de TODAS las bodegas con productos
- No había opción de elegir una bodega específica
- Si solo necesitabas una etiqueta, tenías que generar todas y descartar las demás

**Ahora:**
- Al hacer click en "Etiquetas QR", aparece un modal con opciones
- Puedes seleccionar una bodega específica
- O generar todas las bodegas de una vez
- Información visual de cuántos productos tiene cada bodega

---

## 🎨 Características del Modal

### 1. **Opción destacada: Todas las bodegas**

```
┌─────────────────────────────────────────────┐
│ 📦 Todas las bodegas                        │
│ Generar etiquetas QR para todas las        │
│ bodegas con productos                      │
└─────────────────────────────────────────────┘
```

- Icono naranja destacado
- Border más grueso
- Descripción clara

### 2. **Lista de bodegas individuales**

```
┌─────────────────────────────────────────────┐
│ 📦 Bodega Principal                         │
│ Av. Libertador 123                         │
│ 45 productos • 1,234 unidades              │
├─────────────────────────────────────────────┤
│ 📦 Bodega Secundaria                        │
│ Calle 45 #67                               │
│ 12 productos • 567 unidades                │
└─────────────────────────────────────────────┘
```

Cada bodega muestra:
- ✅ Nombre de la bodega
- ✅ Ubicación (si está configurada)
- ✅ Cantidad de productos
- ✅ Total de unidades en stock

---

## 🔧 Funcionamiento Técnico

### 1. **Estados agregados** (líneas 146-148)

```javascript
// Modal de selección de bodega para QR
const [showWarehouseQRModal, setShowWarehouseQRModal] = useState(false);
const [selectedWarehouseForQR, setSelectedWarehouseForQR] = useState(null);
```

### 2. **Modificación del botón** (línea 1535)

**Antes:**
```javascript
onClick={generateInventoryLabels}
```

**Ahora:**
```javascript
onClick={() => setShowWarehouseQRModal(true)}
```

### 3. **Función mejorada** (línea 1143)

**Antes:**
```javascript
const generateInventoryLabels = async () => {
  // Siempre generaba todas las bodegas
}
```

**Ahora:**
```javascript
const generateInventoryLabels = async (specificWarehouseId = null) => {
  // Si specificWarehouseId es null: genera todas
  // Si specificWarehouseId tiene valor: genera solo esa bodega

  filteredItems.forEach(item => {
    const warehouseId = item.warehouseId;
    // Si se especificó una bodega, solo procesar esa
    if (specificWarehouseId && warehouseId !== specificWarehouseId) {
      return;
    }
    // ...
  });
}
```

### 4. **Modal de selección** (líneas 3285-3384)

```javascript
<AnimatePresence>
  {showWarehouseQRModal && (
    <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header naranja con gradiente */}
        {/* Opción: Todas las bodegas */}
        {/* Lista de bodegas individuales */}
        {/* Botón Cancelar */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

---

## 📊 Flujo de Usuario

### Escenario 1: Generar todas las bodegas

1. **Click** en botón "Etiquetas QR" (naranja)
2. **Aparece** modal de selección
3. **Click** en "Todas las bodegas"
4. **Se genera** PDF con etiquetas de todas las bodegas
5. **Se descarga** archivo: `etiquetas-todas-las-bodegas-{timestamp}.pdf`

### Escenario 2: Generar bodega específica

1. **Click** en botón "Etiquetas QR" (naranja)
2. **Aparece** modal de selección
3. **Click** en una bodega específica (ej: "Bodega Principal")
4. **Se genera** PDF con etiqueta solo de esa bodega
5. **Se descarga** archivo: `etiqueta-bodega-bodega-principal-{timestamp}.pdf`

### Escenario 3: Cancelar

1. **Click** en botón "Etiquetas QR" (naranja)
2. **Aparece** modal de selección
3. **Click** en "Cancelar" o fuera del modal
4. **Se cierra** el modal sin generar nada

---

## 🎨 Diseño UI/UX

### Colores y Estilos

**Header del modal:**
- Fondo: `bg-gradient-to-r from-orange-500 to-orange-600`
- Texto: `text-white`
- Icono: `Package` de Lucide

**Opción "Todas las bodegas":**
- Border: `border-2 border-orange-200`
- Hover: `hover:bg-orange-50 hover:border-orange-400`
- Icono: Fondo naranja con gradiente
- Text hover: `group-hover:text-orange-700`

**Bodegas individuales:**
- Border: `border border-slate-200`
- Hover: `hover:bg-slate-50 hover:border-slate-300`
- Icono: `bg-slate-100 group-hover:bg-orange-100`

**Botón Cancelar:**
- Fondo: `bg-slate-200 hover:bg-slate-300`
- Texto: `text-slate-700`

### Animaciones

**Modal:**
```javascript
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
exit={{ opacity: 0 }}
```

**Contenido:**
```javascript
initial={{ scale: 0.9, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
exit={{ scale: 0.9, opacity: 0 }}
```

---

## 💡 Ejemplo Visual Completo

### Modal abierto:

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ╔══════════════════════════════════════════════════╗ │
│  ║ 📦 Generar Etiqueta QR                           ║ │
│  ║ Selecciona la bodega para generar su etiqueta   ║ │
│  ╠══════════════════════════════════════════════════╣ │
│  ║                                                  ║ │
│  ║ ┌────────────────────────────────────────────┐  ║ │
│  ║ │ 🔶 Todas las bodegas                       │  ║ │
│  ║ │ Generar etiquetas QR para todas las        │  ║ │
│  ║ │ bodegas con productos                      │  ║ │
│  ║ └────────────────────────────────────────────┘  ║ │
│  ║                                                  ║ │
│  ║ ┌────────────────────────────────────────────┐  ║ │
│  ║ │ 📦 Bodega Principal                        │  ║ │
│  ║ │ Av. Libertador 123                         │  ║ │
│  ║ │ 45 productos • 1,234 unidades              │  ║ │
│  ║ └────────────────────────────────────────────┘  ║ │
│  ║                                                  ║ │
│  ║ ┌────────────────────────────────────────────┐  ║ │
│  ║ │ 📦 Bodega Secundaria                       │  ║ │
│  ║ │ Calle 45 #67                               │  ║ │
│  ║ │ 12 productos • 567 unidades                │  ║ │
│  ║ └────────────────────────────────────────────┘  ║ │
│  ║                                                  ║ │
│  ║ ┌────────────────────────────────────────────┐  ║ │
│  ║ │ 📦 Bodega Norte                            │  ║ │
│  ║ │ 8 productos • 320 unidades                 │  ║ │
│  ║ └────────────────────────────────────────────┘  ║ │
│  ║                                                  ║ │
│  ╠══════════════════════════════════════════════════╣ │
│  ║              [ Cancelar ]                        ║ │
│  ╚══════════════════════════════════════════════════╝ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 📱 Responsive Design

El modal es completamente responsive:

- **Desktop**: `max-w-md` (ancho máximo mediano)
- **Mobile**: `w-full` con `p-4` (padding para respirar)
- **Scroll**: `max-h-[60vh] overflow-y-auto` en el body del modal
- **Click fuera**: Cierra el modal

---

## 🔍 Información Mostrada por Bodega

Para cada bodega en la lista se calcula en tiempo real:

```javascript
const productsInWarehouse = filteredItems.filter(item => item.warehouseId === warehouse.id);
const productCount = productsInWarehouse.length;
const totalStock = productsInWarehouse.reduce((sum, p) => sum + (p.stock || 0), 0);
```

**Muestra:**
- Nombre de la bodega
- Ubicación (si existe)
- `X productos` (singular o plural automático)
- Total de unidades en stock

---

## ✅ Ventajas de la Mejora

### 1. **Flexibilidad**
- Generar todas las bodegas si lo necesitas
- Generar solo una bodega específica
- No desperdiciar papel imprimiendo etiquetas innecesarias

### 2. **Información Contextual**
- Ver cuántos productos tiene cada bodega antes de generar
- Saber cuántas unidades en total
- Ver la ubicación para verificar que es la correcta

### 3. **UX Mejorada**
- Modal intuitivo y claro
- Diseño coherente con el resto de la app
- Animaciones suaves
- Feedback visual en hover

### 4. **Eficiencia**
- Genera solo lo que necesitas
- Ahorro de tiempo si solo necesitas una etiqueta
- Menos descargas y archivos PDF innecesarios

---

## 🎯 Casos de Uso

### Caso 1: Nueva bodega
Acabas de crear una nueva bodega y necesitas su etiqueta QR:
1. Click en "Etiquetas QR"
2. Seleccionar la nueva bodega
3. Generar e imprimir solo esa etiqueta

### Caso 2: Reemplazo de etiqueta dañada
Una etiqueta QR de la "Bodega Norte" se dañó:
1. Click en "Etiquetas QR"
2. Seleccionar "Bodega Norte"
3. Generar e imprimir solo esa etiqueta

### Caso 3: Configuración inicial
Primera vez configurando el sistema con múltiples bodegas:
1. Click en "Etiquetas QR"
2. Seleccionar "Todas las bodegas"
3. Generar todas las etiquetas de una vez

---

## 🛠️ Archivos Modificados

### `src/components/Inventory.jsx`

**Cambios:**

1. **Nuevos estados** (líneas 146-148):
   - `showWarehouseQRModal`
   - `selectedWarehouseForQR`

2. **Función modificada** (línea 1143):
   - `generateInventoryLabels` ahora acepta parámetro `specificWarehouseId`

3. **Botón modificado** (línea 1535):
   - Ahora abre modal en lugar de generar directamente

4. **Modal agregado** (líneas 3285-3384):
   - Modal completo con AnimatePresence
   - Opción "Todas las bodegas"
   - Lista de bodegas individuales

---

## ✅ Checklist de Implementación

- [x] Estados para modal de selección
- [x] Parámetro opcional en `generateInventoryLabels`
- [x] Lógica para filtrar por bodega específica
- [x] Botón modificado para abrir modal
- [x] Modal con header naranja
- [x] Opción "Todas las bodegas" destacada
- [x] Lista de bodegas individuales
- [x] Información de productos y stock por bodega
- [x] Botón cancelar
- [x] Click fuera cierra modal
- [x] Animaciones con Framer Motion
- [x] Responsive design
- [x] Build exitoso sin errores

---

## 🚀 Resultado Final

**Antes:**
- ❌ Click → Genera todas las bodegas automáticamente
- ❌ Sin opción de elegir
- ❌ Sin información previa

**Ahora:**
- ✅ Click → Modal con opciones
- ✅ Elegir bodega específica o todas
- ✅ Ver cuántos productos tiene cada bodega
- ✅ Información contextual útil
- ✅ UX profesional con animaciones

**¡Mucho más flexible y útil!** 💪
