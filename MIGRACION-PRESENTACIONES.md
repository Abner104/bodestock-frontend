# 🔄 Guía de Migración: Sistema de Presentaciones

## 📋 ¿Qué es esta migración?

Esta migración convierte el **sistema antiguo** de conversión (1 presentación) al **sistema nuevo** de presentaciones múltiples.

### Sistema Antiguo (conversion):
```javascript
{
  conversion: {
    enabled: true,
    packagingUnit: "caja",
    factor: 24
  }
}
```

### Sistema Nuevo (presentations):
```javascript
{
  presentations: [
    { id: "1", name: "Caja", factor: 24 },
    { id: "2", name: "Six-pack", factor: 6 },
    { id: "3", name: "Pallet", factor: 1152 }
  ]
}
```

---

## 🚀 Método 1: Migración Automática (Recomendado)

### Paso 1: Abrir la Consola del Navegador

1. Ve a tu aplicación en el navegador
2. Presiona `F12` o `Ctrl+Shift+I` (Windows/Linux) o `Cmd+Option+I` (Mac)
3. Ve a la pestaña "Console"

### Paso 2: Obtener tu Company ID

Ejecuta este código en la consola:

```javascript
// Obtener el ID de tu empresa
import { getUserCompanyId } from './services/companyService';
const companyId = await getUserCompanyId();
console.log('Tu Company ID:', companyId);
```

Copia el Company ID que aparece.

### Paso 3: Ejecutar la Migración

```javascript
// Importar la función de migración
import { runMigration } from './utils/migrateToPresentations';

// Ejecutar (reemplaza 'TU-COMPANY-ID' con el ID que copiaste)
await runMigration('TU-COMPANY-ID');
```

### Paso 4: Verificar Resultados

La consola mostrará algo como:

```
🚀 Iniciando migración de productos a sistema de presentaciones...

✅ Migrado: Corona
   De: conversion.caja = 24
   A: presentations[Caja] = 24

⏭️  Omitido: Carne de Res (producto simple, sin conversiones)

═══════════════════════════════════════════════════════════
📊 RESUMEN DE MIGRACIÓN:
   Total de productos procesados: 25
   ✅ Migrados exitosamente: 8
   ⏭️  Omitidos: 17
   ❌ Errores: 0
═══════════════════════════════════════════════════════════

✨ Migración completada exitosamente!
```

---

## 🛠️ Método 2: Migración Manual (Producto por Producto)

Si prefieres migrar manualmente o solo algunos productos:

### Para cada producto con conversión:

1. Ve a **Inventario**
2. Haz clic en **Editar** (✏️) del producto
3. Ve al **PASO 1: Unidad de Medida**
4. En la sección **"📦 Presentaciones (Opcional)"**:
   - Nombre: `Caja` (o como se llamaba en el sistema antiguo)
   - Factor: `24` (o el factor que tenía)
   - Clic en **Agregar**
5. Guarda el producto

**IMPORTANTE:** Después de agregar la presentación manualmente, el sistema antiguo (`conversion`) seguirá existiendo. No afecta el funcionamiento, pero queda duplicado.

---

## ⚠️ Consideraciones Importantes

### Antes de Migrar:

1. **Backup:** Aunque la migración es segura, se recomienda hacer un backup de Firestore
2. **Prueba:** Si tienes una base de datos de prueba, prueba ahí primero
3. **Horario:** Hazlo en horario de baja actividad

### Durante la Migración:

- No cierres el navegador
- No refresques la página
- Espera a que termine completamente

### Después de Migrar:

1. **Verifica** que los productos tengan las presentaciones correctas
2. **Prueba** hacer una compra con presentaciones
3. **Verifica** que el stock se actualice correctamente

---

## 🔍 Verificación Post-Migración

### Verificar un Producto:

1. Ve a Inventario
2. Edita un producto que tenía conversión
3. Ve al PASO 1
4. Deberías ver la presentación en la lista:
   ```
   Presentaciones configuradas:
   ┌─────────────────────────┐
   │ Caja                    │
   │ 1 Caja = 24 botella    │
   └─────────────────────────┘
   ```

### Probar una Compra:

1. Haz clic en "Comprar" en un producto migrado
2. Deberías ver el selector:
   ```
   📦 Presentación:
   [ Por botella (unidad base)     ]
   [ Por Caja (1 = 24 botella)     ]
   ```
3. Selecciona "Por Caja"
4. Ingresa cantidad: `5`
5. Debería mostrar: `= 120 botellas en total` ✅

---

## 🐛 Solución de Problemas

### Error: "Cannot find module"
**Solución:** Asegúrate de que el archivo `migrateToPresentations.js` existe en `src/utils/`

### Error: "Company ID is undefined"
**Solución:** Asegúrate de estar logueado y de ejecutar primero `getUserCompanyId()`

### Error: "Permission denied"
**Solución:** Tu usuario debe tener permisos de escritura en Firestore

### Los productos no se migran
**Solución:** Verifica que los productos tengan el campo `conversion.enabled = true`

---

## 📊 Qué Hace la Migración

Para cada producto en tu inventario:

1. **Verifica** si tiene `conversion.enabled = true`
2. **Crea** una nueva presentación con:
   - `id`: generado automáticamente
   - `name`: el valor de `conversion.packagingUnit`
   - `factor`: el valor de `conversion.factor`
3. **Elimina** el campo `conversion` antiguo
4. **Guarda** el producto actualizado

### Ejemplo de Transformación:

**ANTES:**
```javascript
{
  name: "Corona",
  unit: "botella",
  conversion: {
    enabled: true,
    packagingUnit: "caja",
    factor: 24
  }
}
```

**DESPUÉS:**
```javascript
{
  name: "Corona",
  unit: "botella",
  presentations: [
    {
      id: "1735689123456abc",
      name: "caja",
      factor: 24
    }
  ]
}
```

---

## ✅ Checklist de Migración

- [ ] Hacer backup de Firestore
- [ ] Obtener Company ID
- [ ] Ejecutar migración con `runMigration()`
- [ ] Verificar estadísticas en consola
- [ ] Verificar productos migrados en la interfaz
- [ ] Probar compra con presentaciones
- [ ] Verificar que stock se actualiza correctamente
- [ ] (Opcional) Agregar más presentaciones a productos específicos

---

## 💡 Próximos Pasos

Después de migrar, puedes:

1. **Agregar más presentaciones** a tus productos:
   - Ejemplo: Agregar "Six-pack" (6) y "Pallet" (1152) a Corona

2. **Crear nuevos productos** directamente con presentaciones múltiples

3. **Capacitar** a tu equipo sobre el nuevo sistema

---

## 🆘 Soporte

Si tienes problemas con la migración:

1. Revisa los logs en la consola del navegador
2. Verifica que no haya errores en Firestore Rules
3. Contacta al soporte técnico con los logs de error

---

## 📝 Notas Finales

- Esta migración es **IRREVERSIBLE** sin un backup
- El sistema nuevo es **compatible** con productos que no tienen presentaciones
- Productos sin presentaciones funcionan exactamente igual que antes
- Solo los productos CON presentaciones tendrán el selector en compras

**¡Buena suerte con la migración!** 🚀
