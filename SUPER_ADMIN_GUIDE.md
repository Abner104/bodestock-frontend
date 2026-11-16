# 🔐 Super Admin Dashboard - Guía Completa

## ✅ Estado: COMPLETADO

El Super Admin Dashboard está listo y funcionando. Este panel te permite gestionar todas las empresas que se registren en ProControl.

---

## 🎯 Funcionalidades Implementadas

### 1. **Estadísticas Generales**
- Total de empresas registradas
- Empresas activas
- Total de usuarios en el sistema
- Ingresos mensuales estimados

### 2. **Gestión de Empresas**
- Ver todas las empresas registradas
- Filtrar por plan (Free, Básico, Profesional, Empresa)
- Filtrar por estado (Activo, Suspendido, Cancelado)
- Ver detalles completos de cada empresa

### 3. **Acciones sobre Empresas**
- **Editar Plan**: Cambiar el plan de una empresa
- **Cambiar Estado**: Activar/Suspender/Cancelar empresa
- **Eliminar**: Soft delete (marca como eliminada, no borra datos)
- **Ver Detalles**: Uso de recursos, administradores, fechas

### 4. **Gráficos y Reportes**
- Distribución de empresas por plan (gráfico de torta)
- Distribución por estado (gráfico de barras)
- Últimas 5 empresas registradas

---

## 🚀 Cómo Acceder

### 1. Usuario Super Admin Actual
```
Email: abnerdariomedina@gmail.com
Rol: SUPER_ADMIN
URL: http://localhost:5173/super-admin
```

### 2. Pasos para acceder:
1. **Cierra sesión** si estás logueado
2. **Vuelve a entrar** con tu email: `abnerdariomedina@gmail.com`
3. **Ve a**: `http://localhost:5173/super-admin`

---

## 🔧 Backend Endpoints

### Estadísticas
```http
GET /api/super-admin/stats
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "totalCompanies": 1,
    "activeCompanies": 1,
    "totalUsers": 10,
    "monthlyRevenue": 79990,
    "planDistribution": { "empresa": 1 },
    "statusDistribution": { "active": 1 },
    "latestCompanies": [...]
  }
}
```

### Listar Empresas
```http
GET /api/super-admin/companies?plan=profesional&status=active
Authorization: Bearer {token}
```

### Detalles de Empresa
```http
GET /api/super-admin/companies/:companyId
Authorization: Bearer {token}
```

### Actualizar Empresa
```http
PUT /api/super-admin/companies/:companyId
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan": "profesional",
  "status": "active"
}
```

### Eliminar Empresa (Soft Delete)
```http
DELETE /api/super-admin/companies/:companyId
Authorization: Bearer {token}
```

---

## 🎨 Interfaz del Dashboard

### Sección 1: Estadísticas Principales
Muestra 4 cards con:
- 🏢 Total Empresas (naranja)
- 📈 Empresas Activas (verde)
- 👥 Total Usuarios (azul)
- 💰 Ingresos Mensuales (morado)

### Sección 2: Tabs
**Tab 1 - Empresas:**
- Tabla con todas las empresas
- Filtros por plan y estado
- Acciones: Ver detalles, Editar, Eliminar

**Tab 2 - Estadísticas:**
- Gráfico de torta: Distribución por plan
- Gráfico de barras: Distribución por estado
- Tabla: Últimas empresas registradas

---

## 👤 Cómo Crear Más Super Admins

### Opción 1: Usando el script (recomendado)
```bash
cd planilla-costos-backend
node make-super-admin.js email@ejemplo.com
```

### Opción 2: Usando el endpoint
```bash
curl -X POST http://localhost:3001/api/super-admin/grant/{uid} \
  -H "Content-Type: application/json" \
  -d '{"secret": "procontrol-super-secret-2025"}'
```

**Nota:** El secret está en `.env` → `SUPER_ADMIN_SECRET`

---

## 🔒 Seguridad

### Middleware de Verificación
Todos los endpoints de super admin están protegidos con un middleware que:
1. Verifica que el usuario esté autenticado
2. Verifica que tenga `isSuperAdmin: true` en sus custom claims
3. Rechaza cualquier acceso no autorizado

### Custom Claims Requeridos
```json
{
  "isSuperAdmin": true,
  "role": "SUPER_ADMIN"
}
```

---

## 📊 Planes y Precios

| Plan | Precio/mes | Usuarios | Productos | Bodegas |
|------|-----------|----------|-----------|---------|
| Free | $0 | 1 | 50 | 1 |
| Básico | $19.990 | 3 | 200 | 2 |
| Profesional | $39.990 | 10 | 1.000 | 5 |
| Empresa | $79.990 | Ilimitado | Ilimitado | Ilimitado |

---

## 🎯 Estados de Empresa

- **active**: Empresa operando normalmente
- **suspended**: Acceso suspendido (falta de pago, etc.)
- **cancelled**: Plan cancelado por el cliente
- **deleted**: Eliminada por super admin

---

## 🧪 Probar el Dashboard

### 1. Registrar una empresa de prueba
```bash
# Ve a http://localhost:5173/register
# Llena el formulario con datos de prueba
# Selecciona un plan
# Crea la cuenta
```

### 2. Ver la nueva empresa en Super Admin
```bash
# Inicia sesión con: abnerdariomedina@gmail.com
# Ve a: http://localhost:5173/super-admin
# Verás la nueva empresa en la tabla
```

### 3. Editar el plan de una empresa
```bash
# Click en el botón "Editar" (lápiz)
# Cambia el plan (ej: de Free a Profesional)
# Guardar
# Los límites se actualizarán automáticamente
```

---

## 📝 Archivos Creados

### Backend
1. `server.js` (líneas 440-710) - Endpoints de super admin
2. `make-super-admin.js` - Script para asignar super admin
3. `.env` - Nueva variable `SUPER_ADMIN_SECRET`

### Frontend
1. `src/pages/SuperAdminDashboard.jsx` - Componente principal (650+ líneas)
2. `src/App.jsx` - Ruta `/super-admin` agregada

---

## 🚀 Próximos Pasos

Con el Super Admin Dashboard completado, las siguientes tareas son:

1. **Landing Page** - Página de marketing para ProControl
2. **Sistema de Pagos** - Integración con Mercado Pago/Stripe (futuro)
3. **Notificaciones Push** - Avisar cuando nuevas empresas se registren (futuro)

---

## 🆘 Solución de Problemas

### "Acceso denegado - Se requiere super admin"
→ Cierra sesión y vuelve a entrar para actualizar los custom claims

### "No autorizado"
→ El token expiró, refresca la página o vuelve a hacer login

### No veo ninguna empresa
→ Verifica que haya empresas registradas en Firestore en `companies/`

### Error al editar empresa
→ Verifica que el backend esté corriendo en puerto 3001

---

## 📧 Contacto Super Admin

**Email actual:** abnerdariomedina@gmail.com

Para cambiar el super admin principal, ejecuta:
```bash
node make-super-admin.js nuevo-email@ejemplo.com
```

---

**¡El Super Admin Dashboard está 100% funcional! 🎉**

Ahora puedes gestionar todas las empresas de ProControl desde un solo lugar.
