# Instrucciones para Eliminar Empresas

Hay **2 formas** de eliminar todas las empresas excepto 'botimarket':

---

## ⚡ Método 1: Script Automático (Recomendado)

### Paso 1: Verificar que tienes el archivo de credenciales

Asegúrate de que existe el archivo:
```
planilla-costos-backend/serviceAccountKey.json
```

Si no lo tienes:
1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto: **gestor-gastos-407c1**
3. Ve a **Configuración del Proyecto** > **Cuentas de servicio**
4. Haz clic en **Generar nueva clave privada**
5. Guarda el archivo como `serviceAccountKey.json` en `planilla-costos-backend/`

### Paso 2: Ejecutar el script

```bash
cd c:\Users\Ultrabook\planilla-costos
node scripts/cleanup-companies.js
```

### Paso 3: Confirmar la operación

El script te mostrará:
- ✅ Lista de todas las empresas
- ⚠️  Cuáles se eliminarán y cuáles se mantendrán
- 🔒 Pedirá confirmación escribiendo "SI"

---

## 🌐 Método 2: Firebase Console (Manual)

Si prefieres hacerlo manualmente o el script no funciona:

### Pasos:

1. Abre [Firebase Console](https://console.firebase.google.com)

2. Selecciona tu proyecto: **gestor-gastos-407c1**

3. Ve a **Firestore Database** en el menú lateral

4. Navega a la colección `companies`

5. Para cada empresa que NO sea **botimarket**:
   - Haz clic en el documento de la empresa
   - Revisa que NO sea botimarket (verifica el campo `name`)
   - Haz clic en los 3 puntos (⋮) > **Delete document**
   - **IMPORTANTE**: Marca la opción **"Delete nested collections"**
   - Confirma la eliminación

6. Repite para todas las empresas excepto botimarket

---

## ✅ Verificación

Después de la eliminación, verifica que:

1. Solo quede 1 empresa en Firestore (`companies` collection)
2. Esa empresa sea **botimarket**
3. Sus subcolecciones estén intactas:
   - products
   - inventory
   - workers
   - categories
   - exits
   - warehouses

---

## ⚠️ IMPORTANTE

- Esta operación es **IRREVERSIBLE**
- Se eliminarán permanentemente todas las empresas y sus datos
- **Solo se conservará botimarket**
- Haz un backup si tienes dudas

---

## 🆘 Si algo sale mal

Si eliminaste botimarket por error o necesitas restaurar:

1. Ve a Firebase Console > Firestore
2. Crea manualmente una nueva empresa con los datos de botimarket
3. O restaura desde un backup de Firestore si lo tienes configurado

---

## 📞 Soporte

Si el script falla, revisa:
- ✅ Node.js está instalado (`node --version`)
- ✅ Firebase Admin SDK está instalado en backend
- ✅ El archivo serviceAccountKey.json existe
- ✅ Las credenciales tienen permisos de escritura en Firestore
