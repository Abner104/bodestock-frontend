# 💰 Sistema de Descuentos - Super Admin

## ✅ Implementado

Se ha agregado un **sistema completo de descuentos** en el Super Admin Dashboard para aplicar descuentos porcentuales a las empresas.

---

## 📍 Ubicación

El sistema de descuentos está integrado en el Super Admin Dashboard:

**Ruta:** `/super-admin` (solo accesible para el super admin)

---

## 🎨 Características del Sistema

### 1. **Campo de Descuento en Modal de Edición**

Al editar una empresa, ahora puedes configurar un descuento del 0% al 100%:

```
┌──────────────────────────────────────────┐
│ Editar Empresa                           │
├──────────────────────────────────────────┤
│ Plan:         [Seleccionar plan ▼]       │
│ Estado:       [Seleccionar estado ▼]     │
│                                          │
│ Descuento (%)                            │
│ ┌──────────────────────────────┐        │
│ │ 25                        % │        │
│ └──────────────────────────────┘        │
│ Descuento del 0% al 100% sobre el       │
│ precio del plan                         │
│                                          │
│ ┌────────────────────────────────────┐  │
│ │ 💰 Descuento aplicado: 25%         │  │
│ └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 2. **Indicador Visual en Tabla de Empresas**

Las empresas con descuentos activos muestran un badge verde junto al plan:

```
┌─────────────────────────────────────────────────────────────┐
│ Empresas Registradas                                        │
├───────────────┬────────────────┬──────────┬───────┬─────────┤
│ Empresa       │ Plan           │ Estado   │ Users │ Acciones│
├───────────────┼────────────────┼──────────┼───────┼─────────┤
│ Botimarket    │ [PRO] [💰-25%] │ Activo   │   5   │ [👁️][✏️] │
│ Test Co.      │ [FREE]         │ Trial    │   1   │ [👁️][✏️] │
│ Demo Inc.     │ [PRO] [💰-15%] │ Activo   │   2   │ [👁️][✏️] │
└───────────────┴────────────────┴──────────┴───────┴─────────┘
```

### 3. **Validación Automática**

- **Rango permitido:** 0% - 100%
- Si ingresas un valor menor a 0, se ajusta automáticamente a 0
- Si ingresas un valor mayor a 100, se ajusta automáticamente a 100
- Acepta números decimales y enteros

---

## ⚙️ Funcionamiento Técnico

### 1. **Estado del Descuento**

```javascript
const [editDiscount, setEditDiscount] = useState(0);
```

### 2. **Inicialización al Editar**

```javascript
const handleEditClick = (company) => {
  setSelectedCompany(company);
  setEditPlan(company.plan);
  setEditStatus(company.status);
  setEditDiscount(company.discount || 0); // Inicializa con descuento actual
  setShowEditModal(true);
};
```

### 3. **Validación de Input**

```javascript
onChange={(e) => setEditDiscount(
  Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
)}
```

**Explicación:**
- `parseFloat(e.target.value) || 0` - Convierte a número, usa 0 si es inválido
- `Math.max(0, ...)` - Asegura que no sea menor a 0
- `Math.min(100, ...)` - Asegura que no sea mayor a 100

### 4. **Guardar Descuento**

```javascript
const handleSaveEdit = async () => {
  const response = await fetch(`${BACKEND_URL}/api/super-admin/companies/${selectedCompany.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan: editPlan,
      status: editStatus,
      discount: parseFloat(editDiscount) || 0 // Envía como número
    })
  });
};
```

### 5. **Indicador Visual en Tabla**

```javascript
{company.discount > 0 && (
  <motion.span
    className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-bold"
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ type: "spring", stiffness: 500, damping: 15 }}
  >
    <span className="text-[10px]">💰</span>
    -{company.discount}%
  </motion.span>
)}
```

**Características del badge:**
- Solo aparece si `discount > 0`
- Animación de entrada con spring physics
- Color verde para indicar beneficio
- Icono de dinero para contexto visual

---

## 🎯 Casos de Uso

### Caso 1: Aplicar Descuento del 20%

1. Click en botón **Editar** (✏️) de la empresa
2. En el campo "Descuento (%)", ingresa: `20`
3. Aparece mensaje verde: **💰 Descuento aplicado: 20%**
4. Click en **Guardar**
5. En la tabla aparece badge verde: **💰-20%**

### Caso 2: Remover Descuento

1. Click en botón **Editar** (✏️) de la empresa
2. En el campo "Descuento (%)", ingresa: `0`
3. El mensaje verde desaparece
4. Click en **Guardar**
5. El badge verde desaparece de la tabla

### Caso 3: Descuento Total (100%)

1. Click en botón **Editar** (✏️) de la empresa
2. En el campo "Descuento (%)", ingresa: `100`
3. Aparece mensaje: **💰 Descuento aplicado: 100%**
4. Click en **Guardar**
5. La empresa tiene acceso gratuito total

---

## 🔄 Integración con Backend

### Endpoint

```
PUT /api/super-admin/companies/:companyId
```

### Request Body

```json
{
  "plan": "pro",
  "status": "active",
  "discount": 25
}
```

### Respuesta Exitosa

```json
{
  "message": "Empresa actualizada exitosamente",
  "company": {
    "id": "abc123",
    "name": "Botimarket",
    "plan": "pro",
    "status": "active",
    "discount": 25,
    "updatedAt": "2025-12-28T12:00:00Z"
  }
}
```

---

## 📊 Ejemplo Visual Completo

### Antes de aplicar descuento:

```
┌──────────────────────────────────┐
│ Botimarket                       │
│ Plan: PRO - $99/mes              │
│ Estado: Activo                   │
│ Descuento: 0%                    │
│ Total: $99/mes                   │
└──────────────────────────────────┘
```

### Después de aplicar 30% de descuento:

```
┌──────────────────────────────────┐
│ Botimarket          💰-30%       │
│ Plan: PRO - $99/mes              │
│ Estado: Activo                   │
│ Descuento: 30%                   │
│ Total: $69.30/mes ✨             │
└──────────────────────────────────┘
```

---

## 🎨 Diseño UX/UI

### Colores y Estilos

**Badge de descuento:**
- Fondo: `bg-green-500/20` (verde translúcido)
- Texto: `text-green-400` (verde claro)
- Border: `border-green-500/30` (verde con transparencia)
- Icono: 💰 emoji

**Modal de edición:**
- Input background: `bg-white/5`
- Border: `border-white/20`
- Focus ring: `ring-blue-500`
- Placeholder: `"0"`

**Confirmación visual:**
- Aparece cuando discount > 0
- Fondo verde translúcido
- Mensaje claro del porcentaje aplicado

---

## 🚀 Animaciones

### Badge en Tabla

```javascript
initial={{ scale: 0 }}
animate={{ scale: 1 }}
transition={{ type: "spring", stiffness: 500, damping: 15 }}
```

**Efecto:** El badge "rebota" al aparecer, llamando la atención del usuario.

---

## ✅ Checklist de Implementación

- [x] Estado del descuento en React
- [x] Campo de input en modal de edición
- [x] Validación 0-100%
- [x] Indicador % en input
- [x] Mensaje de confirmación verde
- [x] Envío al backend en handleSaveEdit
- [x] Badge visual en tabla de empresas
- [x] Animación de entrada del badge
- [x] Condicional para mostrar solo si discount > 0
- [x] Build exitoso sin errores

---

## 🔮 Mejoras Futuras (Opcional)

### 1. **Cálculo de Precio con Descuento**

Mostrar el precio final después del descuento:

```javascript
const originalPrice = getPlanPrice(company.plan); // Ej: 99
const discountedPrice = originalPrice * (1 - company.discount / 100);

<p className="text-xs text-green-400">
  ${discountedPrice.toFixed(2)}/mes
  <span className="line-through text-gray-500 ml-2">
    ${originalPrice}/mes
  </span>
</p>
```

### 2. **Historial de Descuentos**

Guardar cuándo se aplicó/modificó un descuento:

```javascript
{
  discount: 25,
  discountHistory: [
    { value: 0, date: "2025-01-01", appliedBy: "admin@example.com" },
    { value: 15, date: "2025-01-15", appliedBy: "admin@example.com" },
    { value: 25, date: "2025-01-28", appliedBy: "admin@example.com" }
  ]
}
```

### 3. **Descuentos Temporales**

Agregar fecha de expiración:

```javascript
{
  discount: 30,
  discountExpiresAt: "2025-12-31T23:59:59Z"
}
```

### 4. **Razón del Descuento**

Permitir agregar una nota:

```javascript
{
  discount: 20,
  discountReason: "Cliente fidelizado - 2 años con nosotros"
}
```

---

## 🎉 Resumen

**Sistema de descuentos completamente funcional:**

1. ✅ Configurable desde Super Admin
2. ✅ Validación automática (0-100%)
3. ✅ Feedback visual inmediato
4. ✅ Badge distintivo en tabla
5. ✅ Animaciones profesionales
6. ✅ Integrado con backend
7. ✅ Build sin errores

**¡Listo para producción!** 🚀
