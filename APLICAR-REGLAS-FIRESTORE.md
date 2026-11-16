# 🔥 APLICAR REGLAS DE FIRESTORE ACTUALIZADAS

## ✅ PASO A PASO (2 minutos)

### 1. Abre Firebase Console
- Ve a: https://console.firebase.google.com/
- Selecciona tu proyecto
- Click en **"Firestore Database"** (menú izquierdo)
- Click en la pestaña **"Reglas"**

### 2. Copia las Nuevas Reglas
- Abre el archivo: `firestore.rules` (está en la raíz del proyecto)
- **Copia TODO el contenido** (Ctrl+A, Ctrl+C)

### 3. Reemplaza en Firebase
- En Firebase Console, **SELECCIONA TODO** el texto en el editor (Ctrl+A)
- **BORRA** todo (Delete)
- **PEGA** las nuevas reglas (Ctrl+V)
- Click en **"Publicar"** (botón azul)

### 4. Espera 30 segundos
- Las reglas tardan unos segundos en propagarse
- Después de esperar, **recarga tu aplicación** (F5)

---

## ✅ VERIFICAR QUE FUNCIONÓ

Ve a **"Mis Inventarios"** en tu app y deberías ver:

1. ✅ Un **banner azul** con tu inventario principal (X productos)
2. ✅ **Sin errores** de permisos
3. ✅ Botón **"Nuevo Inventario"** funcionando

---

## 📋 QUÉ SE AGREGÓ

Las reglas actualizadas ahora permiten:

✅ **Inventarios dinámicos:**
- `/inventories/{inventoryId}/metadata/` - Configuración del inventario
- `/inventories/{inventoryId}/products/` - Productos del inventario
- `/inventories/{inventoryId}/warehouses/` - Bodegas del inventario

✅ **Clientes guardados:**
- `/customers/` - Para guardar datos de clientes recurrentes

✅ **Pedidos públicos:**
- `/orders/` - Pedidos desde el catálogo (con o sin autenticación)

✅ **Compatibilidad total:**
- Todo tu inventario actual sigue funcionando (`/inventory/`, `/warehouses/`)

---

## 🆘 SI HAY ERRORES

### Error: "Rules are invalid"
- Asegúrate de copiar **TODO** el contenido del archivo `firestore.rules`
- Verifica que no haya caracteres extraños al pegar

### El error persiste
1. Cierra sesión en la app
2. Limpia caché del navegador (Ctrl+Shift+Delete)
3. Vuelve a iniciar sesión
4. Intenta de nuevo

---

**Listo!** Una vez aplicadas las reglas, todo funcionará correctamente 🎉
