# 📋 IMPLEMENTACIÓN COMPLETA - SISTEMA DE PLANES (OPCIÓN C)

## ✅ YA IMPLEMENTADO EN FRONTEND

- ✅ Register.jsx actualizado para crear empresas con trial de 30 días
- ✅ Eliminada la selección de planes en el registro
- ✅ PlansPage.jsx muestra correctamente trial y planes
- ✅ Notificaciones agregadas al menú lateral
- ✅ Guía del cliente actualizada

---

## 🔧 PENDIENTE: IMPLEMENTACIÓN EN BACKEND

### 1. 📝 ACTUALIZAR REGISTRO DE EMPRESAS

**Archivo**: `planilla-costos-backend/routes/companies.js` o `controllers/companyController.js`

**Cambios en el endpoint `/api/companies/register`**:

```javascript
// POST /api/companies/register
router.post('/register', async (req, res) => {
  const { companyName, adminName, adminEmail, password } = req.body;

  try {
    // 1. Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: adminEmail,
      password: password,
      displayName: adminName
    });

    // 2. Calcular fecha de fin del trial (30 días desde hoy)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    // 3. Crear empresa en Firestore con TRIAL
    const companyRef = await db.collection('companies').add({
      name: companyName,
      adminEmail: adminEmail,
      adminName: adminName,
      plan: 'trial',              // ← SIEMPRE trial al inicio
      status: 'trial',             // ← Estado trial
      trialEndDate: trialEndDate,  // ← Fecha de expiración
      createdAt: new Date(),
      limits: {
        users: 999,                // Sin límite durante trial
        products: 999,
        warehouses: 999
      },
      usage: {
        users: 1,                  // El admin ya cuenta
        products: 0,
        warehouses: 0
      }
    });

    const companyId = companyRef.id;

    // 4. Crear primer worker (ADMIN automáticamente)
    await db.collection('companies').doc(companyId).collection('workers').add({
      email: adminEmail,
      name: adminName,
      role: 'ADMIN',               // ← SIEMPRE ADMIN el primer usuario
      active: true,
      createdAt: new Date(),
      dailyLimit: {
        type: 'unlimited',
        amount: 0
      },
      assignedWarehouses: []       // Acceso a todas
    });

    // 5. Asignar custom claims (companyId y role)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      companyId: companyId,
      role: 'ADMIN',
      receiveAlerts: true,         // ← Los ADMIN reciben alertas por defecto
      receiveReports: true
    });

    // 6. Enviar email de bienvenida
    await sendWelcomeEmail({
      to: adminEmail,
      name: adminName,
      companyName: companyName,
      trialEndDate: trialEndDate
    });

    // 7. Responder con éxito
    res.json({
      success: true,
      message: 'Empresa creada exitosamente con trial de 30 días',
      data: {
        companyId,
        userId: userRecord.uid,
        trialEndDate
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

### 2. 🤖 CRON JOB: VERIFICAR TRIALS EXPIRADOS

**Archivo**: `planilla-costos-backend/jobs/checkExpiredTrials.js`

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();
const { sendEmail } = require('../services/emailService');

const PLAN_LIMITS = {
  free: {
    users: 1,
    products: 50,
    warehouses: 1
  },
  basico: {
    users: 3,
    products: 200,
    warehouses: 2
  },
  profesional: {
    users: 10,
    products: 1000,
    warehouses: 5
  },
  empresa: {
    users: 999,
    products: 999,
    warehouses: 999
  }
};

/**
 * Cron job que se ejecuta diariamente a las 00:00
 * Verifica empresas con trial expirado y las downgradea a Free
 */
async function checkExpiredTrials() {
  console.log('🔍 Verificando trials expirados...');

  const today = new Date();

  try {
    // Buscar empresas en trial con fecha vencida
    const expiredTrials = await db.collection('companies')
      .where('status', '==', 'trial')
      .where('trialEndDate', '<=', today)
      .get();

    console.log(`📊 Encontradas ${expiredTrials.size} empresas con trial expirado`);

    const promises = [];

    for (const doc of expiredTrials.docs) {
      const company = doc.data();
      const companyId = doc.id;

      console.log(`⏰ Trial expirado para: ${company.name} (${company.adminEmail})`);

      // Downgrade automático a Free
      const promise = doc.ref.update({
        plan: 'free',
        status: 'active',
        limits: PLAN_LIMITS.free,
        trialEndDate: null,
        downgradeDate: new Date()
      }).then(async () => {
        // Enviar email notificando downgrade
        await sendEmail({
          to: company.adminEmail,
          subject: 'Tu período de prueba de Stockly ha terminado',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Hola ${company.adminName},</h2>

              <p>Tu período de prueba de 30 días ha terminado.</p>

              <p>Tu cuenta ha sido <strong>automáticamente migrada al plan Free</strong>, que incluye:</p>
              <ul>
                <li>✅ <strong>1 usuario</strong></li>
                <li>✅ <strong>50 productos</strong></li>
                <li>✅ <strong>1 bodega</strong></li>
                <li>✅ <strong>Gratis para siempre</strong></li>
              </ul>

              <p>Si necesitas más funcionalidades, puedes actualizar tu plan en cualquier momento:</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.APP_URL}/plans"
                   style="background: linear-gradient(135deg, #3b82f6, #6366f1);
                          color: white;
                          padding: 15px 30px;
                          text-decoration: none;
                          border-radius: 8px;
                          font-weight: bold;
                          display: inline-block;">
                  Ver Planes y Precios
                </a>
              </div>

              <p>¡Gracias por usar Stockly! 🚀</p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <p style="color: #6b7280; font-size: 14px;">
                Si tienes preguntas, responde a este email o contáctanos en soporte@stockly.app
              </p>
            </div>
          `
        });

        console.log(`✅ Email enviado a ${company.adminEmail}`);
      });

      promises.push(promise);
    }

    await Promise.all(promises);

    console.log(`✅ Procesados ${expiredTrials.size} trials expirados`);

  } catch (error) {
    console.error('❌ Error verificando trials:', error);
    throw error;
  }
}

module.exports = { checkExpiredTrials };
```

**Configurar el cron job** en `server.js` o `index.js`:

```javascript
const cron = require('node-cron');
const { checkExpiredTrials } = require('./jobs/checkExpiredTrials');

// Ejecutar todos los días a las 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('⏰ Ejecutando cron job: checkExpiredTrials');
  try {
    await checkExpiredTrials();
  } catch (error) {
    console.error('❌ Error en cron job:', error);
  }
});

console.log('✅ Cron job configurado: checkExpiredTrials (diario a las 00:00)');
```

**Instalar node-cron** si no está instalado:

```bash
cd planilla-costos-backend
npm install node-cron
```

---

### 3. 🛡️ MIDDLEWARE: VERIFICAR LÍMITES DEL PLAN

**Archivo**: `planilla-costos-backend/middleware/checkPlanLimits.js`

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

const PLAN_LIMITS = {
  trial: {
    users: 999,
    products: 999,
    warehouses: 999
  },
  free: {
    users: 1,
    products: 50,
    warehouses: 1
  },
  basico: {
    users: 3,
    products: 200,
    warehouses: 2
  },
  profesional: {
    users: 10,
    products: 1000,
    warehouses: 5
  },
  empresa: {
    users: 999,
    products: 999,
    warehouses: 999
  }
};

/**
 * Verificar si se puede crear un recurso basado en el plan actual
 * @param {string} companyId - ID de la empresa
 * @param {string} resourceType - 'users', 'products', 'warehouses'
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
async function checkResourceLimit(companyId, resourceType) {
  try {
    // Obtener info de la empresa
    const companyDoc = await db.collection('companies').doc(companyId).get();

    if (!companyDoc.exists) {
      return { allowed: false, message: 'Empresa no encontrada' };
    }

    const company = companyDoc.data();
    const plan = company.plan || 'free';
    const limits = PLAN_LIMITS[plan];
    const usage = company.usage || {};

    // Verificar límite específico
    const currentUsage = usage[resourceType] || 0;
    const limit = limits[resourceType];

    if (currentUsage >= limit && limit !== 999) {
      return {
        allowed: false,
        message: `Has alcanzado el límite de ${resourceType} (${limit}) para tu plan ${plan}. Actualiza tu plan para agregar más.`,
        limit,
        current: currentUsage
      };
    }

    return {
      allowed: true,
      limit,
      current: currentUsage,
      remaining: limit === 999 ? 'ilimitado' : limit - currentUsage
    };

  } catch (error) {
    console.error('Error verificando límite:', error);
    // Fail-open: si hay error, permitir la operación
    return { allowed: true };
  }
}

/**
 * Middleware para Express - verificar límite antes de crear recurso
 */
function checkLimitMiddleware(resourceType) {
  return async (req, res, next) => {
    try {
      const companyId = req.user.companyId; // Viene del middleware de auth

      if (!companyId) {
        return res.status(403).json({
          success: false,
          error: 'No se pudo verificar la empresa'
        });
      }

      const check = await checkResourceLimit(companyId, resourceType);

      if (!check.allowed) {
        return res.status(403).json({
          success: false,
          error: check.message,
          limitReached: true,
          upgrade: true
        });
      }

      // Agregar info del límite al request
      req.planLimit = check;
      next();

    } catch (error) {
      console.error('Error en checkLimitMiddleware:', error);
      // Fail-open
      next();
    }
  };
}

module.exports = {
  checkResourceLimit,
  checkLimitMiddleware
};
```

**Usar el middleware** en tus rutas:

```javascript
const { checkLimitMiddleware } = require('../middleware/checkPlanLimits');

// Ejemplo: Crear producto
router.post('/products',
  authMiddleware,
  checkLimitMiddleware('products'), // ← Verifica límite
  async (req, res) => {
    // Si llegó aquí, está dentro del límite
    // ... crear producto
  }
);

// Ejemplo: Crear usuario/trabajador
router.post('/workers',
  authMiddleware,
  checkLimitMiddleware('users'), // ← Verifica límite
  async (req, res) => {
    // ... crear trabajador
  }
);

// Ejemplo: Crear bodega
router.post('/warehouses',
  authMiddleware,
  checkLimitMiddleware('warehouses'), // ← Verifica límite
  async (req, res) => {
    // ... crear bodega
  }
);
```

---

### 4. 📧 SERVICIO DE EMAIL

**Archivo**: `planilla-costos-backend/services/emailService.js`

```javascript
const nodemailer = require('nodemailer');

// Configurar transporter (usa Gmail, SendGrid, o tu servicio preferido)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // tu-email@gmail.com
    pass: process.env.EMAIL_PASS  // contraseña de aplicación
  }
});

/**
 * Enviar email de bienvenida
 */
async function sendWelcomeEmail({ to, name, companyName, trialEndDate }) {
  const daysLeft = Math.ceil((trialEndDate - new Date()) / (1000 * 60 * 60 * 24));

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: '🎉 ¡Bienvenido a Stockly! - Tu cuenta está lista',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 32px;">¡Bienvenido a Stockly!</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1f2937;">Hola ${name},</h2>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
            ¡Tu cuenta <strong>${companyName}</strong> ha sido creada exitosamente! 🎉
          </p>

          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 10px; margin: 25px 0;">
            <h3 style="margin: 0 0 10px 0;">✨ Tu período de prueba</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 0;">
              ${daysLeft} días GRATIS
            </p>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">
              Acceso completo sin límites hasta el ${trialEndDate.toLocaleDateString('es-CL')}
            </p>
          </div>

          <h3 style="color: #1f2937;">Durante tu prueba tienes acceso a:</h3>
          <ul style="color: #4b5563; line-height: 1.8;">
            <li>✅ <strong>Usuarios ilimitados</strong></li>
            <li>✅ <strong>Productos ilimitados</strong></li>
            <li>✅ <strong>Bodegas ilimitadas</strong></li>
            <li>✅ <strong>Alertas por email</strong></li>
            <li>✅ <strong>Reportes mensuales automáticos</strong></li>
            <li>✅ <strong>Exportación a Excel</strong></li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}"
               style="background: linear-gradient(135deg, #3b82f6, #6366f1);
                      color: white;
                      padding: 15px 40px;
                      text-decoration: none;
                      border-radius: 8px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Empezar a usar Stockly
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #d1d5db; margin: 30px 0;">

          <h3 style="color: #1f2937;">¿Qué pasa después de los 30 días?</h3>
          <p style="color: #4b5563;">
            Podrás elegir entre nuestro <strong>plan Free</strong> (gratis para siempre con funciones básicas)
            o actualizar a uno de nuestros planes pagos para acceso completo.
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            ¿Tienes preguntas? Responde a este email o contáctanos en <strong>soporte@stockly.app</strong>
          </p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email de bienvenida enviado a:', to);
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
}

/**
 * Enviar email genérico
 */
async function sendEmail({ to, subject, html }) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: subject,
    html: html
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado a:', to);
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw error;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendEmail
};
```

**Instalar nodemailer**:

```bash
npm install nodemailer
```

**Configurar variables de entorno** en `.env`:

```env
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-contraseña-de-aplicación
APP_URL=http://localhost:5174
```

---

### 5. 📊 ENDPOINT: ACTUALIZAR PLAN (UPGRADE)

**Archivo**: `planilla-costos-backend/routes/companies.js`

```javascript
// PUT /api/companies/:companyId/upgrade
router.put('/:companyId/upgrade', authMiddleware, async (req, res) => {
  const { companyId } = req.params;
  const { plan } = req.body; // 'basico', 'profesional', 'empresa'

  // Verificar que el usuario sea admin de la empresa
  if (req.user.companyId !== companyId || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'No tienes permisos para actualizar el plan'
    });
  }

  try {
    const PLAN_LIMITS = {
      basico: { users: 3, products: 200, warehouses: 2 },
      profesional: { users: 10, products: 1000, warehouses: 5 },
      empresa: { users: 999, products: 999, warehouses: 999 }
    };

    const limits = PLAN_LIMITS[plan];

    if (!limits) {
      return res.status(400).json({
        success: false,
        error: 'Plan inválido'
      });
    }

    // Actualizar empresa
    await db.collection('companies').doc(companyId).update({
      plan: plan,
      status: 'active',
      limits: limits,
      upgradedAt: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 días
    });

    // Obtener info de la empresa para el email
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyData = companyDoc.data();

    // Enviar email de confirmación
    await sendEmail({
      to: companyData.adminEmail,
      subject: `¡Plan ${plan} activado en Stockly!`,
      html: `
        <h2>¡Tu plan ha sido actualizado!</h2>
        <p>Hola ${companyData.adminName},</p>
        <p>Tu empresa <strong>${companyData.name}</strong> ahora tiene el plan <strong>${plan.toUpperCase()}</strong>.</p>
        <p>Nuevos límites:</p>
        <ul>
          <li>Usuarios: ${limits.users === 999 ? 'Ilimitados' : limits.users}</li>
          <li>Productos: ${limits.products === 999 ? 'Ilimitados' : limits.products}</li>
          <li>Bodegas: ${limits.warehouses === 999 ? 'Ilimitadas' : limits.warehouses}</li>
        </ul>
        <p>¡Gracias por confiar en Stockly! 🚀</p>
      `
    });

    res.json({
      success: true,
      message: 'Plan actualizado exitosamente',
      data: {
        plan,
        limits
      }
    });

  } catch (error) {
    console.error('Error actualizando plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## 🚀 CHECKLIST DE IMPLEMENTACIÓN

### Backend

- [ ] 1. Actualizar endpoint `/api/companies/register` para crear con trial
- [ ] 2. Primer usuario siempre se crea con rol ADMIN automáticamente
- [ ] 3. Crear archivo `jobs/checkExpiredTrials.js`
- [ ] 4. Configurar cron job en `server.js` (ejecutar diario a las 00:00)
- [ ] 5. Instalar `node-cron`: `npm install node-cron`
- [ ] 6. Crear middleware `middleware/checkPlanLimits.js`
- [ ] 7. Aplicar middleware a rutas de creación (productos, users, bodegas)
- [ ] 8. Crear servicio `services/emailService.js`
- [ ] 9. Instalar `nodemailer`: `npm install nodemailer`
- [ ] 10. Configurar variables de entorno en `.env` (EMAIL_USER, EMAIL_PASS, APP_URL)
- [ ] 11. Crear endpoint PUT `/api/companies/:id/upgrade`
- [ ] 12. Probar flujo completo de registro → trial → downgrade → upgrade

### Testing

- [ ] 1. Registrar nueva empresa y verificar que se cree con trial
- [ ] 2. Verificar que el primer usuario sea ADMIN automáticamente
- [ ] 3. Verificar que el email de bienvenida llegue
- [ ] 4. Simular expiración de trial (cambiar fecha manualmente)
- [ ] 5. Ejecutar cron job manualmente y verificar downgrade a Free
- [ ] 6. Verificar que el email de downgrade llegue
- [ ] 7. Intentar crear más recursos de los permitidos (debería bloquearse)
- [ ] 8. Hacer upgrade a plan pagado y verificar que se desbloqueen límites

---

## 📝 NOTAS ADICIONALES

### Alertas de Email a Admins

Para que los emails de alertas de stock lleguen automáticamente a los ADMIN:

```javascript
// En el servicio de alertas de stock
async function sendStockAlerts() {
  // Para cada empresa
  const companies = await db.collection('companies').get();

  for (const companyDoc of companies.docs) {
    const companyId = companyDoc.id;

    // Obtener todos los admins de la empresa
    const workers = await db.collection('companies')
      .doc(companyId)
      .collection('workers')
      .where('role', '==', 'ADMIN')
      .where('active', '==', true)
      .get();

    const adminEmails = workers.docs.map(doc => doc.data().email);

    // Obtener productos con stock bajo
    const lowStockProducts = await getLowStockProducts(companyId);

    if (lowStockProducts.length > 0 && adminEmails.length > 0) {
      // Enviar email a todos los admins
      for (const email of adminEmails) {
        await sendStockAlert(email, lowStockProducts);
      }
    }
  }
}
```

---

## 💡 TIPS

1. **Desarrollo local**: Prueba el cron job manualmente antes de dejarlo en producción:
   ```javascript
   // En server.js
   if (process.env.NODE_ENV === 'development') {
     // Ejecutar cada minuto para pruebas
     cron.schedule('* * * * *', checkExpiredTrials);
   } else {
     // En producción: ejecutar diario a las 00:00
     cron.schedule('0 0 * * *', checkExpiredTrials);
   }
   ```

2. **Email transaccional**: Para producción, considera usar servicios como:
   - SendGrid (gratis hasta 100 emails/día)
   - Mailgun
   - AWS SES

3. **Backup de datos**: Antes de implementar, haz un backup de Firestore:
   ```bash
   gcloud firestore export gs://tu-bucket/backup
   ```

4. **Logs**: Agrega logs detallados para troubleshooting:
   ```javascript
   console.log('🔍 Verificando trial de:', company.name);
   console.log('📅 Trial expira:', company.trialEndDate);
   console.log('✅ Downgrade exitoso a Free');
   ```

---

## 🎯 RESULTADO FINAL

Después de implementar todo esto, el flujo será:

```
1. Usuario se registra → Trial de 30 días automático (acceso completo)
2. A los 30 días → Cron job downgradeea a Free automáticamente
3. Usuario puede seguir usando Free (limitado) para siempre
4. Cuando quiera → Upgrade a plan pagado desde /plans
5. Pago exitoso → Plan activado con nuevos límites
```

✅ **100% compatible con la Opción C que hablamos!**

---

**Autor**: Claude Code
**Fecha**: Noviembre 2025
**Proyecto**: Stockly - Sistema de Gestión de Inventario
