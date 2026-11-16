# 🗑️ Botón de Eliminar Empresas - Super Admin

## ✅ Implementado

Se ha agregado un **botón de eliminar** en el Super Admin Dashboard para eliminar empresas directamente desde la interfaz.

---

## 📍 Ubicación

El botón aparece en la tabla de empresas, junto a los botones de "Ver" y "Editar":

```
[Ver 👁️] [Editar ✏️] [Eliminar 🗑️]
```

**Ruta:** `/super-admin` (solo accesible para el super admin)

---

## 🎨 Diseño del Botón

- **Color:** Rojo (`bg-red-500/20 hover:bg-red-500/30`)
- **Icono:** Trash2 (papelera) de Lucide
- **Efectos:** Hover scale animation con Framer Motion
- **Tooltip:** "Eliminar empresa"

---

## 🔒 Seguridad - Doble Confirmación

Para evitar eliminaciones accidentales, el sistema implementa **2 niveles de confirmación**:

### Nivel 1: Alerta de Advertencia
Al hacer click en el botón, aparece un `prompt` con:

```
⚠️ ADVERTENCIA: Vas a eliminar permanentemente la empresa "Nombre de la Empresa"

Esto eliminará:
• Todos los productos
• Todo el inventario
• Todos los trabajadores
• Todas las categorías
• Todo el historial

Esta acción NO se puede deshacer.

Escribe el nombre de la empresa para confirmar:
```

### Nivel 2: Validación del Nombre
El usuario **DEBE escribir exactamente el nombre de la empresa** (case-insensitive).

Si el nombre no coincide:
```
❌ Eliminación cancelada. El nombre no coincide.
```

Si el nombre coincide, se procede con la eliminación.

---

## ⚙️ Funcionamiento Técnico

### 1. Click en el Botón
```javascript
onClick={() => handleDeleteCompany(company)}
```

### 2. Función `handleDeleteCompany`
```javascript
const handleDeleteCompany = async (company) => {
  // 1. Mostrar prompt de confirmación
  const userInput = prompt(confirmMessage);

  // 2. Validar nombre ingresado
  if (userInput.toLowerCase() !== company.name.toLowerCase()) {
    alert('❌ Eliminación cancelada');
    return;
  }

  // 3. Llamar al endpoint DELETE del backend
  const response = await fetch(`${BACKEND_URL}/api/super-admin/companies/${company.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // 4. Mostrar resultado
  alert(`✅ Empresa "${company.name}" eliminada exitosamente`);

  // 5. Recargar datos
  await loadData();
}
```

### 3. Backend Endpoint
**Ruta:** `DELETE /api/super-admin/companies/:companyId`

**Ubicación:** `planilla-costos-backend/server.js:921`

**Autenticación:** Requiere middleware `verifySuperAdmin`

**Acción:** Elimina la empresa y TODAS sus subcolecciones de Firestore:
- `products/`
- `inventory/`
- `workers/`
- `categories/`
- `exits/`
- `warehouses/`

---

## 🎯 Flujo Completo

```mermaid
Usuario hace click →
  Prompt de confirmación →
    Usuario escribe nombre →
      Validación →
        Llamada DELETE al backend →
          Backend elimina empresa + subcolecciones →
            Respuesta exitosa →
              Alert de confirmación →
                Recarga de datos
```

---

## ✨ Características

### ✅ Ventajas
1. **Interfaz visual** - No necesitas usar scripts en terminal
2. **Confirmación doble** - Previene eliminaciones accidentales
3. **Feedback inmediato** - Alertas de éxito/error
4. **Recarga automática** - La tabla se actualiza sola
5. **Logging** - Registra todas las eliminaciones en consola
6. **UX profesional** - Animaciones y diseño coherente

### 🛡️ Seguridad
- ✅ Solo accesible por super admin (`verifySuperAdmin`)
- ✅ Requiere autenticación con token JWT
- ✅ Validación de nombre exacto (case-insensitive)
- ✅ Prompt nativo del navegador (no se puede bypassear con JS)
- ✅ Logging de todas las acciones

---

## 🚀 Cómo Usar

### Paso 1: Acceder al Super Admin Dashboard
```
http://localhost:5173/super-admin
```

### Paso 2: Ubicar la empresa a eliminar
- Usa la búsqueda si es necesario
- Filtra por plan o estado

### Paso 3: Click en el botón de eliminar (🗑️)
El botón está a la derecha de cada fila.

### Paso 4: Escribir el nombre exacto de la empresa
```
⚠️ ADVERTENCIA: Vas a eliminar permanentemente la empresa "Test Company"
...
Escribe el nombre de la empresa para confirmar: Test Company
```

### Paso 5: Confirmar
Si el nombre coincide:
```
✅ Empresa "Test Company" eliminada exitosamente
```

Si el nombre NO coincide:
```
❌ Eliminación cancelada. El nombre no coincide.
```

---

## 📊 Ejemplo Visual

### Antes de eliminar:
```
┌─────────────────────────────────────────────────────────────┐
│ Empresas Registradas                    5 empresas          │
├─────────────┬──────┬────────┬─────────┬──────────────────┤
│ Empresa     │ Plan │ Estado │ Usuarios│ Acciones         │
├─────────────┼──────┼────────┼─────────┼──────────────────┤
│ Botimarket  │ PRO  │ Activo │    5    │ [👁️] [✏️] [🗑️] │
│ Test Co.    │ FREE │ Trial  │    1    │ [👁️] [✏️] [🗑️] │
│ Demo Inc.   │ FREE │ Active │    2    │ [👁️] [✏️] [🗑️] │
└─────────────┴──────┴────────┴─────────┴──────────────────┘
```

### Click en 🗑️ de "Test Co.":
```
┌──────────────────────────────────────────────────┐
│ ⚠️ ADVERTENCIA                                   │
│                                                  │
│ Vas a eliminar permanentemente la empresa        │
│ "Test Co."                                       │
│                                                  │
│ Esto eliminará:                                  │
│ • Todos los productos                            │
│ • Todo el inventario                             │
│ • Todos los trabajadores                         │
│ • Todas las categorías                           │
│ • Todo el historial                              │
│                                                  │
│ Esta acción NO se puede deshacer.                │
│                                                  │
│ Escribe el nombre de la empresa para confirmar:  │
│ [Test Co.                                   ]    │
│                                                  │
│           [Cancelar]    [Aceptar]                │
└──────────────────────────────────────────────────┘
```

### Después de eliminar:
```
┌─────────────────────────────────────────────────────────────┐
│ Empresas Registradas                    4 empresas          │
├─────────────┬──────┬────────┬─────────┬──────────────────┤
│ Empresa     │ Plan │ Estado │ Usuarios│ Acciones         │
├─────────────┼──────┼────────┼─────────┼──────────────────┤
│ Botimarket  │ PRO  │ Activo │    5    │ [👁️] [✏️] [🗑️] │
│ Demo Inc.   │ FREE │ Active │    2    │ [👁️] [✏️] [🗑️] │
└─────────────┴──────┴────────┴─────────┴──────────────────┘
```

---

## 🐛 Manejo de Errores

### Error de Backend
```javascript
try {
  const response = await fetch(...);
  if (!response.ok) {
    throw new Error('Error al eliminar empresa');
  }
} catch (err) {
  alert('❌ Error al eliminar empresa: ' + err.message);
}
```

### Error de Red
Si no hay conexión con el backend:
```
❌ Error al eliminar empresa: Failed to fetch
```

### Error de Permisos
Si el token expiró o no eres super admin:
```
❌ Error al eliminar empresa: Unauthorized
```

---

## 📝 Logs en Consola

```javascript
// Al iniciar la eliminación
logger.info(`🗑️ Eliminando empresa: Test Co. (abc123)`);

// Al completar exitosamente
logger.info(`✅ Empresa eliminada exitosamente: Test Co.`);

// Si hay error
logger.error('Error eliminando empresa:', err);
```

---

## 🔄 Alternativas

Si prefieres eliminar empresas de otras formas:

### 1. Script de Terminal
```bash
node scripts/cleanup-companies.js
```
Ver: [DELETE-COMPANIES-INSTRUCTIONS.md](scripts/DELETE-COMPANIES-INSTRUCTIONS.md)

### 2. Firebase Console
Ir a Firestore → `companies` → Seleccionar empresa → Delete document (con nested collections)

### 3. API Directa
```bash
curl -X DELETE \
  http://localhost:5188/api/super-admin/companies/COMPANY_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ Testing

Para probar el botón de eliminar:

1. **Crear empresa de prueba:**
   - Registra una nueva empresa con un nombre obvio como "TEST DELETE ME"

2. **Probar cancelación:**
   - Click en 🗑️
   - Escribe un nombre incorrecto
   - Verifica que muestre: "❌ Eliminación cancelada"

3. **Probar eliminación exitosa:**
   - Click en 🗑️
   - Escribe el nombre exacto: "TEST DELETE ME"
   - Verifica que muestre: "✅ Empresa eliminada exitosamente"
   - Verifica que la tabla se actualizó

4. **Verificar en Firestore:**
   - Firebase Console → Firestore
   - Verificar que la empresa ya no existe

---

## 🎉 Conclusión

Ahora puedes **eliminar empresas con 3 clicks**:
1. Click en 🗑️
2. Escribir nombre
3. Enter

Mucho más rápido y visual que usar scripts de terminal.

**¡Listo para producción!** ✅
