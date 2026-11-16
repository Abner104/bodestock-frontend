# 🔐 Firestore Security Rules - Deployment Guide

## ⚠️ IMPORTANTE

Este archivo `firestore.rules` contiene las reglas de seguridad para proteger tu base de datos Firestore. **DEBES desplegarlas** para que tu aplicación esté segura en producción.

## 📋 Requisitos Previos

1. Tener Firebase CLI instalado:
   ```bash
   npm install -g firebase-tools
   ```

2. Estar autenticado en Firebase:
   ```bash
   firebase login
   ```

3. Verificar que el proyecto esté configurado:
   ```bash
   firebase projects:list
   ```

## 🚀 Despliegue de Reglas

### Opción 1: Via Firebase CLI (Recomendado)

```bash
# En el directorio raíz del proyecto
firebase deploy --only firestore:rules
```

### Opción 2: Via Consola de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **gestor-gastos-407c1**
3. Ve a **Firestore Database** → **Rules**
4. Copia y pega el contenido de `firestore.rules`
5. Click en **Publish**

## 🧪 Prueba las Reglas (ANTES de desplegar)

Puedes simular las reglas en la consola de Firebase:

1. En Firebase Console → Firestore Database → Rules
2. Click en **Rules Playground**
3. Prueba diferentes escenarios:
   - Usuario admin leyendo inventario de su empresa
   - Trabajador intentando acceder a otra empresa
   - Usuario sin autenticar intentando leer datos

## 📖 Resumen de Reglas Implementadas

### 🏢 Multi-Tenancy (Aislamiento por Empresa)
- Cada usuario solo puede acceder a datos de SU empresa (`companyId` en custom claims)
- Imposible acceder a datos de otras empresas

### 👥 Control de Acceso por Roles

#### **ADMIN**
- Acceso completo a todos los datos de su empresa
- Puede crear/editar/eliminar: trabajadores, bodegas, inventario, productos terminados
- Puede ver todos los movimientos y reportes

#### **SUPERVISOR**
- Lee inventario y bodegas
- Puede aprobar/rechazar salidas de inventario
- Puede aprobar solicitudes de permisos (límites diarios)
- Acceso limitado a bodegas asignadas

#### **WORKER (Trabajador)**
- Lee inventario de bodegas asignadas
- Registra salidas de inventario (solo para sí mismo)
- Ve su propia actividad y límites
- No puede modificar configuraciones

### 🔒 Seguridad Específica

1. **Workers (Trabajadores)**:
   - Solo admins pueden crear/eliminar trabajadores
   - Trabajadores solo pueden actualizar campos limitados de su perfil
   - No pueden cambiar: rol, límites, bodegas asignadas

2. **Inventory Exits (Salidas)**:
   - Trabajadores solo crean salidas para sí mismos (`workerId` = `auth.uid`)
   - No pueden crear salidas en nombre de otros
   - Solo admins/supervisores pueden aprobar/rechajar

3. **Permission Requests (Solicitudes de Permiso)**:
   - Solo se crean cuando trabajadores exceden límites diarios
   - Estado inicial siempre es `PENDING`
   - Solo admins/supervisores pueden aprobar

4. **Daily Limits (Límites Diarios)**:
   - Colección global fuera de companies
   - Solo backend puede escribir (previene manipulación)
   - Trabajadores solo leen su propio límite

5. **System Roles (Roles del Sistema)**:
   - Roles ADMIN, SUPERVISOR, WORKER no pueden ser modificados
   - Son plantillas base del sistema

## ⚙️ Custom Claims Requeridos

Para que las reglas funcionen, cada usuario DEBE tener estos custom claims en su ID token:

```javascript
{
  companyId: "uuid_de_la_empresa",
  role: "ADMIN" | "SUPERVISOR" | "WORKER",
  isSuperAdmin: false, // solo para super admin
  // ... otros claims opcionales
}
```

Estos claims se configuran en el backend cuando se crea un usuario.

## 🔍 Monitoreo Post-Despliegue

Después de desplegar, monitorea los logs de Firestore:

1. Firebase Console → Firestore Database → Usage tab
2. Revisa "Security rules evaluations"
3. Busca "Denied requests" - investiga si son legítimos

## 🐛 Troubleshooting

### Error: "Missing or insufficient permissions"

**Causa**: El usuario no tiene los custom claims correctos.

**Solución**:
1. Verifica que el usuario tenga `companyId` y `role` en sus custom claims
2. Re-autentica el usuario (logout/login) para refrescar el token
3. Revisa que el usuario esté en la colección `workers` de su empresa

### Error: "PERMISSION_DENIED: Missing or insufficient permissions"

**Causa**: Las reglas bloquearon una operación legítima.

**Solución**:
1. Revisa qué operación se intentó realizar
2. Verifica el rol del usuario
3. Asegúrate que la colección existe en las reglas (`firestore.rules`)

### Backend necesita acceso directo

**Solución**: El backend usa Firebase Admin SDK que **bypasea las reglas** de Firestore. No hay problema.

## 📝 Próximos Pasos

Después de desplegar las reglas:

1. ✅ Prueba el login como ADMIN
2. ✅ Prueba registrar una salida como WORKER
3. ✅ Verifica que no puedas acceder a datos de otra empresa
4. ✅ Confirma que las alertas de stock y reportes mensuales funcionan (backend)

## 🆘 Soporte

Si encuentras problemas con las reglas de seguridad, contacta al equipo de desarrollo.
