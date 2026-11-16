# 🔐 Sistema de Permisos y Roles

## 📋 Descripción General

Sistema granular de permisos para controlar el acceso de trabajadores a diferentes secciones y funcionalidades del sistema. Perfecto para minimarkets que necesitan roles específicos como **Cajera**, **Vendedora**, **Encargada**, etc.

---

## 🎭 Roles Disponibles

### 1. **ADMIN** (Administrador)
- ✅ Acceso completo al sistema
- ✅ Ve costos, ganancias, PPP
- ✅ Gestiona trabajadores y permisos
- ✅ Sin límites de retiro
- ✅ Acceso a todas las bodegas

### 2. **ENCARGADA** (Encargada de Tienda)
- ✅ Gestión completa de la tienda
- ✅ Ve costos y ganancias
- ✅ Supervisión del equipo
- ✅ Acceso a reportes
- ✅ Sin límites de retiro
- ✅ Puede gestionar inventario

### 3. **CAJERA**
- ✅ Registro de ventas
- ✅ Ve stock disponible (sin costos)
- ❌ NO ve precios de costo
- ❌ NO ve ganancias
- ❌ NO accede a inventario completo
- ⚠️ Límite diario: $50,000 por defecto

### 4. **VENDEDORA**
- ✅ Consulta de inventario
- ✅ Ve precios de venta
- ✅ Registro de ventas
- ✅ Ve stock disponible
- ❌ NO ve precios de costo
- ❌ NO ve ganancias
- ⚠️ Límite diario: $50,000 por defecto

### 5. **SUPERVISOR**
- ✅ Supervisión de bodegas asignadas
- ✅ Aprobación de salidas
- ✅ Ve actividad del equipo
- ✅ Acceso a reportes
- ✅ Gestión de límites del equipo

### 6. **WORKER** (Trabajador Genérico)
- ✅ Registro de salidas básico
- ✅ Acceso a bodegas asignadas
- ⚠️ Límite diario: $10,000 por defecto

---

## 🛡️ Categorías de Permisos

### 📖 Lectura
- `read_all` - Leer todo el sistema
- `read_inventory` - Ver inventario
- `view_reports` - Ver reportes
- `view_own_activity` - Ver actividad propia
- `view_team_activity` - Ver actividad del equipo

### 🔒 Información Sensible
- `view_costs` - Ver costos y PPP (⚠️ Solo para admin/encargada)
- `view_profits` - Ver ganancias (⚠️ Solo para admin/encargada)
- `view_stock_only` - Ver solo stock sin costos (✅ Para cajera/vendedora)
- `view_sale_prices` - Ver precios de venta (✅ Para vendedora)

### ✏️ Escritura
- `write_all` - Escribir en todo el sistema
- `record_exits` - Registrar salidas/ventas
- `manage_inventory` - Gestionar inventario completo
- `approve_exits` - Aprobar salidas

### 🗑️ Eliminación
- `delete_all` - Eliminar cualquier registro

### 👥 Gestión
- `manage_workers` - Gestionar trabajadores
- `manage_roles` - Gestionar roles
- `manage_team_limits` - Gestionar límites del equipo

### 🏢 Acceso a Secciones
- `access_dashboard` - Ver dashboard
- `access_inventory` - Acceder a inventario
- `access_sales` - Acceder a ventas
- `access_reports` - Acceder a reportes
- `access_workers` - Acceder a trabajadores
- `access_settings` - Acceder a configuración

### 📦 Acceso a Bodegas
- `access_all_warehouses` - Todas las bodegas
- `access_assigned_warehouses` - Solo bodegas asignadas

### ∞ Límites
- `unlimited_withdrawals` - Sin límites de retiro

---

## 🚀 Cómo Usar

### 1️⃣ Crear un Trabajador con Rol

```javascript
// En WorkersManagement, selecciona el rol:
- CAJERA → Límite $50,000/día, solo ve stock
- VENDEDORA → Límite $50,000/día, ve precios de venta
- ENCARGADA → Sin límite, gestión completa
```

**Los permisos se cargan automáticamente** según el rol seleccionado, pero puedes personalizarlos.

---

### 2️⃣ Personalizar Permisos

En el formulario de crear/editar trabajador, verás el **PermissionSelector** que agrupa permisos por categorías:

```jsx
<PermissionSelector
  selectedPermissions={form.customPermissions}
  onChange={(permissions) => setForm({ ...form, customPermissions: permissions })}
/>
```

**Puedes:**
- ✅ Expandir/colapsar categorías
- ✅ Marcar/desmarcar permisos individuales
- ✅ Seleccionar todos los permisos de una categoría
- ✅ Ver descripción de cada permiso

---

### 3️⃣ Verificar Permisos en Componentes

#### Hook Principal: `useUserPermissions()`

```javascript
import { useUserPermissions } from '../hooks/useUserPermissions.js';

function MyComponent() {
  const {
    permissions,        // Array de permisos del usuario
    userRole,           // Rol actual ('CAJERA', 'ADMIN', etc.)
    worker,             // Datos completos del trabajador
    loading,            // Si está cargando
    isAdmin,            // true si es ADMIN
    hasPermission,      // Función para verificar 1 permiso
    hasAnyPermission,   // Función para verificar AL MENOS 1
    hasAllPermissions,  // Función para verificar TODOS
    canAccessWarehouse, // Función para verificar acceso a bodega
    canViewSensitiveInfo, // Si puede ver costos/ganancias
    canViewStockOnly    // Si solo puede ver stock
  } = useUserPermissions();

  if (loading) return <Loading />;

  // Ejemplo: Ocultar botón si no tiene permiso
  return (
    <div>
      {hasPermission('manage_inventory') && (
        <button>Editar Producto</button>
      )}
    </div>
  );
}
```

---

### 4️⃣ Proteger Secciones Completas

#### Guard para Páginas: `PermissionGuard`

```javascript
import PermissionGuard from '../components/guards/PermissionGuard.jsx';

function InventoryPage() {
  return (
    <PermissionGuard
      requiredPermissions={['access_inventory', 'read_inventory']}
      requireAll={false} // Solo necesita UNO de los permisos
    >
      {/* Tu contenido aquí */}
      <h1>Inventario</h1>
      <ProductList />
    </PermissionGuard>
  );
}
```

**Props de PermissionGuard:**
- `requiredPermissions` - Array de permisos requeridos
- `requireAll` - Si true, necesita TODOS. Si false, necesita AL MENOS UNO
- `fallback` - Componente alternativo si no tiene permiso
- `showMessage` - Mostrar mensaje de "Acceso Denegado"

---

### 5️⃣ Guards Inline (Botones, Elementos)

```javascript
import { InlinePermissionGuard } from '../components/guards/PermissionGuard.jsx';

function ProductCard({ product }) {
  return (
    <div>
      <h3>{product.name}</h3>

      {/* Solo muestra el botón si tiene permiso */}
      <InlinePermissionGuard requiredPermissions={['manage_inventory']}>
        <button>Eliminar</button>
      </InlinePermissionGuard>
    </div>
  );
}
```

---

### 6️⃣ Ocultar Información Sensible

```javascript
import { SensitiveInfoGuard } from '../components/guards/PermissionGuard.jsx';

function ProductCard({ product }) {
  return (
    <div>
      <h3>{product.name}</h3>

      {/* Solo muestra el costo si tiene permiso view_costs */}
      <SensitiveInfoGuard>
        <p>Costo: ${product.ppp}</p>
      </SensitiveInfoGuard>

      {/* Si no tiene permiso, muestra ●●●●● */}
      <SensitiveInfoGuard showPlaceholder={true}>
        <p>Ganancia: ${product.profit}</p>
      </SensitiveInfoGuard>
    </div>
  );
}
```

---

## 📝 Ejemplos de Uso Práctico

### Ejemplo 1: Dashboard con Restricciones

```javascript
import { useUserPermissions } from '../hooks/useUserPermissions.js';
import { SensitiveInfoGuard } from '../components/guards/PermissionGuard.jsx';

function Dashboard() {
  const { userRole, canViewSensitiveInfo } = useUserPermissions();

  return (
    <div>
      <h1>Dashboard - {userRole}</h1>

      {/* Todos ven el total de ventas */}
      <StatCard title="Ventas del Día" value="$150,000" />

      {/* Solo ADMIN y ENCARGADA ven ganancias */}
      <SensitiveInfoGuard>
        <StatCard title="Ganancia del Día" value="$45,000" />
      </SensitiveInfoGuard>

      {/* Solo ADMIN y ENCARGADA ven costos */}
      {canViewSensitiveInfo() && (
        <CostAnalysisChart />
      )}
    </div>
  );
}
```

---

### Ejemplo 2: Inventario para Cajera vs Admin

```javascript
function InventoryPage() {
  const { userRole, canViewSensitiveInfo, canViewStockOnly } = useUserPermissions();

  return (
    <PermissionGuard requiredPermissions={['access_inventory', 'access_sales']}>
      <div>
        <h1>Inventario</h1>

        <ProductList>
          {products.map(product => (
            <div key={product.id}>
              <h3>{product.name}</h3>
              <p>Stock: {product.stock}</p>

              {/* CAJERA: Solo ve si hay stock */}
              {canViewStockOnly() && (
                <p>Estado: {product.stock > 0 ? '✅ Disponible' : '❌ Sin stock'}</p>
              )}

              {/* VENDEDORA: Ve precio de venta */}
              {hasPermission('view_sale_prices') && (
                <p>Precio venta: ${product.salePrice}</p>
              )}

              {/* ADMIN/ENCARGADA: Ve costo y ganancia */}
              <SensitiveInfoGuard>
                <p>Costo: ${product.ppp}</p>
                <p>Ganancia: ${product.profit}</p>
              </SensitiveInfoGuard>

              {/* Solo ADMIN puede eliminar */}
              <InlinePermissionGuard requiredPermissions={['delete_all']}>
                <button>Eliminar</button>
              </InlinePermissionGuard>
            </div>
          ))}
        </ProductList>
      </div>
    </PermissionGuard>
  );
}
```

---

### Ejemplo 3: Restricción por Bodega

```javascript
function WarehouseSelector() {
  const { canAccessWarehouse, worker } = useUserPermissions();

  return (
    <select>
      {warehouses.map(warehouse => {
        // Solo muestra bodegas a las que tiene acceso
        if (!canAccessWarehouse(warehouse.id)) return null;

        return (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
          </option>
        );
      })}
    </select>
  );
}
```

---

## 🎯 Casos de Uso para Minimarkets

### Caso 1: Cajera - Solo Registrar Ventas
```javascript
// Cajera puede:
✅ Ver página de ventas (access_sales)
✅ Registrar ventas (record_exits)
✅ Ver si hay stock (view_stock_only)
❌ NO ve costos (NO tiene view_costs)
❌ NO ve inventario completo (NO tiene access_inventory)
```

### Caso 2: Vendedora - Consultar Inventario para Informar a Clientes
```javascript
// Vendedora puede:
✅ Ver inventario (access_inventory)
✅ Ver precios de venta (view_sale_prices)
✅ Ver stock disponible (view_stock_only)
✅ Registrar ventas (record_exits)
❌ NO ve costos ni ganancias
```

### Caso 3: Encargada - Gestión Completa de Tienda
```javascript
// Encargada puede:
✅ TODO lo que hace cajera y vendedora
✅ Ver costos y ganancias (view_costs, view_profits)
✅ Gestionar inventario (manage_inventory)
✅ Ver reportes (access_reports)
✅ Supervisar equipo (view_team_activity)
✅ Aprobar mermas (approve_exits)
```

---

## 🔧 Configuración Inicial

### 1. Inicializar Roles (Automático)
Al entrar a WorkersManagement por primera vez, se crean automáticamente todos los roles en Firestore.

### 2. Crear Primer Trabajador
1. Click en "Nuevo Trabajador"
2. Seleccionar rol (CAJERA, VENDEDORA, etc.)
3. Los permisos se cargan automáticamente
4. Personalizar si es necesario
5. Guardar

### 3. Los permisos se guardan en:
```
companies/{companyId}/workers/{workerId}/customPermissions: []
```

---

## 🐛 Troubleshooting

### Problema: Usuario no tiene permisos esperados
```javascript
// Verificar en consola:
const { permissions, userRole } = useUserPermissions();
console.log('Rol:', userRole);
console.log('Permisos:', permissions);
```

### Problema: Admin legacy sin rol
Si un admin creado antes del sistema de roles no tiene rol:
- Se le asignan automáticamente permisos de ADMIN
- No afecta su funcionamiento

### Problema: Guard no funciona
Asegúrate de que el guard está dentro de un componente que tenga acceso al auth:
```javascript
// ❌ Malo
export default PermissionGuard({ children: <MyPage /> });

// ✅ Bueno
function MyPage() {
  return (
    <PermissionGuard requiredPermissions={['access_inventory']}>
      <div>Contenido</div>
    </PermissionGuard>
  );
}
```

---

## ✅ Checklist de Implementación

Para aplicar permisos a una página existente:

- [ ] Importar `useUserPermissions` o `PermissionGuard`
- [ ] Envolver la página en `<PermissionGuard>`
- [ ] Definir `requiredPermissions` apropiados
- [ ] Ocultar botones sensibles con `<InlinePermissionGuard>`
- [ ] Proteger información sensible con `<SensitiveInfoGuard>`
- [ ] Probar con cada rol (CAJERA, VENDEDORA, ENCARGADA, ADMIN)

---

## 🎉 ¡Listo!

Ya tienes un sistema completo de permisos granulares para tus minimarkets. Cada trabajador ve solo lo que necesita para su trabajo.

**Próximos pasos:**
1. Crear tus trabajadores con los roles apropiados
2. Aplicar guards en las páginas críticas (Inventario, Reportes, Dashboard)
3. Ocultar información sensible con `<SensitiveInfoGuard>`
4. Probar con diferentes roles para asegurar que funciona

---

**Fecha:** 2026-02-11
**Status:** ✅ Sistema de permisos completo y funcional
**Archivos creados:**
- `src/config/database-schema.js` (actualizado con roles)
- `src/components/workers/PermissionSelector.jsx` (selector visual)
- `src/hooks/useUserPermissions.js` (hook principal)
- `src/components/guards/PermissionGuard.jsx` (guards)
- `src/pages/WorkersManagement.jsx` (UI actualizada)

🔥 **¡Sistema listo para producción bro!** 🔥
