# 🔥 INSTRUCCIONES: Actualizar Reglas de Firestore

## ⚠️ PROBLEMA ACTUAL

Estás viendo este error:
```
FirebaseError: Missing or insufficient permissions.
```

Esto sucede porque las reglas de seguridad de Firestore no permiten acceso a las nuevas colecciones de inventarios dinámicos.

---

## ✅ SOLUCIÓN (5 minutos)

### Paso 1: Ir a Firebase Console

1. Abre tu navegador
2. Ve a: https://console.firebase.google.com/
3. Selecciona tu proyecto
4. En el menú lateral izquierdo, click en **"Firestore Database"**
5. Click en la pestaña **"Reglas"** (Rules)

### Paso 2: Copiar las Nuevas Reglas

1. Abre el archivo: `firestore-rules-inventories.rules` (está en la raíz del proyecto)
2. Copia TODO el contenido del archivo (Ctrl+A, Ctrl+C)

### Paso 3: Pegar y Publicar

1. En Firebase Console, **SELECCIONA TODO** el texto existente en el editor de reglas
2. **BORRA** todo (Ctrl+A, Delete)
3. **PEGA** las nuevas reglas copiadas (Ctrl+V)
4. Click en el botón azul **"Publicar"** (Publish)
5. Confirma la publicación

### Paso 4: Verificar

1. Espera 10 segundos
2. Recarga tu aplicación (F5)
3. Ve a **"Mis Inventarios"** desde el menú
4. Deberías ver:
   - Un banner azul mostrando tu inventario principal con X productos
   - La opción de crear nuevos inventarios

---

## 📋 RESUMEN DE CAMBIOS EN LAS REGLAS

Las nuevas reglas permiten:

✅ **Lectura/escritura en inventarios dinámicos:**
- `companies/{companyId}/inventories/{inventoryId}/metadata/`
- `companies/{companyId}/inventories/{inventoryId}/products/`
- `companies/{companyId}/inventories/{inventoryId}/warehouses/`

✅ **Compatibilidad con inventario legacy:**
- `companies/{companyId}/inventory/` (tu inventario actual)
- `companies/{companyId}/warehouses/` (bodegas actuales)

✅ **Permisos por rol:**
- **ADMIN**: Puede crear, editar, eliminar inventarios
- **Trabajadores activos**: Pueden leer y trabajar con productos

✅ **Nuevas funcionalidades:**
- Pedidos públicos desde el catálogo (sin autenticación)
- Clientes guardados
- Notificaciones por inventario

---

## 🎯 DESPUÉS DE APLICAR LAS REGLAS

### Tu inventario actual NO se perderá:
- Sigue en `companies/{companyId}/inventory/`
- Accesible desde el menú **"Inventario"**
- Todos tus productos, bodegas y datos están intactos

### Nuevas capacidades:
1. **Crear inventarios adicionales** desde "Mis Inventarios"
2. **Inventarios independientes** para:
   - Minimarket
   - Distribuidora
   - Restaurante
   - Bodega central
   - Otros negocios

3. **Catálogos públicos** con URL única por inventario:
   - `/catalogo-publico/{companyId}/{inventoryId}`

4. **Notificaciones separadas** por inventario:
   - Stock bajo en Minimarket
   - Productos por vencer en Distribuidora
   - etc.

---

## 🆘 SI TIENES PROBLEMAS

### Error persiste después de publicar:
1. Espera 30 segundos (las reglas tardan en propagarse)
2. Cierra sesión en la app
3. Vuelve a iniciar sesión
4. Intenta de nuevo

### No puedes publicar las reglas:
- Verifica que copiaste TODO el contenido del archivo
- Asegúrate de NO tener errores de sintaxis
- El editor de Firebase te mostrará errores en rojo si hay problemas

### Quieres revertir:
- Firebase guarda el historial de reglas
- Puedes volver a la versión anterior desde la consola
- Click en "Historial" para ver versiones previas

---

## 📞 SIGUIENTE PASO

Una vez aplicadas las reglas:
1. Recarga la aplicación
2. Ve a **"Mis Inventarios"**
3. Verás un banner azul con tu inventario actual
4. Podrás crear nuevos inventarios adicionales

¡Listo! 🎉
