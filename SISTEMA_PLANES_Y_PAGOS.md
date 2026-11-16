# 🔐 SISTEMA DE PLANES, TRIALS Y PAGOS - PROCONTROL

## 📋 ESTADO ACTUAL DEL SISTEMA

### ✅ LO QUE YA FUNCIONA:

1. **Backend tiene la lógica completa**:
   - ✅ Crear empresa con trial de 14 días
   - ✅ Verificar si trial expiró (`isCompanyActive`)
   - ✅ Auto-suspender cuando expira
   - ✅ Límites por plan (usuarios, productos, bodegas)

2. **Planes definidos**:
   ```javascript
   Free:        $0      (1 usuario, 50 productos, 1 bodega)
   Básico:      $19.990 (3 usuarios, 200 productos, 2 bodegas)
   Profesional: $49.990 (10 usuarios, 1000 productos, 5 bodegas)
   Empresa:     $79.990 (Ilimitado todo)
   ```

### ❌ LO QUE FALTA:

1. **Frontend NO verifica** si el trial expiró
2. **NO hay página** de "Plan Expirado"
3. **NO hay integración** de pagos (Mercado Pago)
4. **NO redirige** automáticamente cuando expira
5. **NO muestra** días restantes del trial

---

## 🔧 CÓMO FUNCIONA ACTUALMENTE:

### Flujo de Registro:

```
1. Usuario se registra → POST /api/companies/register
   {
     companyName: "Panadería ABC",
     adminName: "Juan",
     email: "juan@panaderia.com",
     password: "******",
     plan: "free" o "basico" o "profesional"
   }

2. Backend crea empresa:
   - Si plan = "free" → status: "trial", trialEndDate: hoy + 14 días
   - Si plan pagado → status: "active" (pero NO cobra, solo lo marca)

3. Usuario accede al sistema normalmente

4. Después de 14 días:
   - Backend detecta trial expirado en isCompanyActive()
   - Auto-suspende la empresa (status: "suspended")
   - Pero... frontend NO hace nada con esto
```

### Problema:

**El usuario puede seguir usando el sistema** aunque esté suspendido porque:
- Frontend NO verifica status de la empresa
- NO hay middleware que bloquee acceso
- NO hay página de "Actualizar Plan"

---

## 🎯 SOLUCIÓN COMPLETA: IMPLEMENTACIÓN

### FASE 1: Verificar Trial en Frontend

Crear hook: `useCompanyStatus.js`

```javascript
// src/hooks/useCompanyStatus.js
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';

export function useCompanyStatus() {
  const [companyStatus, setCompanyStatus] = useState({
    loading: true,
    active: true,
    status: null,
    trialDaysLeft: null,
    needsUpgrade: false
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const companyId = await getUserCompanyId();
        if (!companyId) {
          setCompanyStatus({ ...companyStatus, loading: false });
          return;
        }

        // Obtener info de la empresa
        const companyDoc = await getDoc(doc(db, 'companies', companyId));
        if (!companyDoc.exists()) {
          setCompanyStatus({ ...companyStatus, loading: false });
          return;
        }

        const company = companyDoc.data();

        // Verificar status
        if (company.status === 'suspended') {
          setCompanyStatus({
            loading: false,
            active: false,
            status: 'suspended',
            needsUpgrade: true
          });
          return;
        }

        // Verificar trial
        if (company.status === 'trial' && company.trialEndDate) {
          const now = new Date();
          const trialEnd = company.trialEndDate.toDate();
          const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

          if (daysLeft <= 0) {
            // Trial expirado
            setCompanyStatus({
              loading: false,
              active: false,
              status: 'trial_expired',
              trialDaysLeft: 0,
              needsUpgrade: true
            });
          } else {
            // Trial activo
            setCompanyStatus({
              loading: false,
              active: true,
              status: 'trial',
              trialDaysLeft: daysLeft,
              needsUpgrade: daysLeft <= 3 // Advertir 3 días antes
            });
          }
          return;
        }

        // Plan activo
        setCompanyStatus({
          loading: false,
          active: true,
          status: 'active',
          needsUpgrade: false
        });

      } catch (error) {
        console.error('Error verificando status:', error);
        setCompanyStatus({ ...companyStatus, loading: false });
      }
    };

    if (auth.currentUser) {
      checkStatus();
    }
  }, [auth.currentUser]);

  return companyStatus;
}
```

---

### FASE 2: Componente de Banner de Trial

```javascript
// src/components/TrialBanner.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { useCompanyStatus } from '../hooks/useCompanyStatus';

export default function TrialBanner() {
  const navigate = useNavigate();
  const { status, trialDaysLeft, needsUpgrade } = useCompanyStatus();

  if (!needsUpgrade) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 px-4 shadow-lg"
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === 'trial' ? (
              <>
                <Clock className="w-5 h-5" />
                <p className="text-sm font-semibold">
                  {trialDaysLeft === 0
                    ? "Tu prueba gratis termina HOY"
                    : `Te quedan ${trialDaysLeft} días de prueba gratis`}
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                <p className="text-sm font-semibold">
                  Tu período de prueba ha finalizado
                </p>
              </>
            )}
          </div>

          <motion.button
            onClick={() => navigate('/upgrade')}
            className="bg-white text-orange-600 px-6 py-2 rounded-lg font-bold text-sm hover:bg-orange-50 transition-all flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <CreditCard className="w-4 h-4" />
            {status === 'trial' ? 'Actualizar Ahora' : 'Elegir Plan'}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

---

### FASE 3: Página de Upgrade/Pago

```javascript
// src/pages/UpgradePlan.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, AlertCircle } from 'lucide-react';
import { useCompanyStatus } from '../hooks/useCompanyStatus';
import { getUserCompanyId } from '../services/companyService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const PLANS = [
  {
    id: 'basico',
    name: 'Básico',
    price: 19990,
    features: ['3 usuarios', '200 productos', '2 bodegas', 'Alertas por email'],
    color: 'from-blue-600 to-blue-700'
  },
  {
    id: 'profesional',
    name: 'Profesional',
    price: 49990,
    features: ['10 usuarios', '1000 productos', '5 bodegas', 'Reportes mensuales', 'Soporte prioritario'],
    color: 'from-orange-600 to-amber-600',
    popular: true
  },
  {
    id: 'empresa',
    name: 'Empresa',
    price: 79990,
    features: ['Usuarios ilimitados', 'Productos ilimitados', 'Bodegas ilimitadas', 'API personalizada'],
    color: 'from-purple-600 to-pink-600'
  }
];

export default function UpgradePlan() {
  const navigate = useNavigate();
  const { status, active } = useCompanyStatus();
  const [selectedPlan, setSelectedPlan] = useState('profesional');
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const loadCompanyInfo = async () => {
      const id = await getUserCompanyId();
      setCompanyId(id);

      if (id) {
        const companyDoc = await getDoc(doc(db, 'companies', id));
        if (companyDoc.exists()) {
          setCompanyName(companyDoc.data().name);
        }
      }
    };
    loadCompanyInfo();
  }, []);

  const handlePayment = async (planId) => {
    const plan = PLANS.find(p => p.id === planId);

    // Aquí va la integración con Mercado Pago
    const preference = {
      items: [
        {
          title: `Plan ${plan.name} - ProControl`,
          unit_price: plan.price,
          quantity: 1,
          description: `Suscripción mensual - ${companyName}`
        }
      ],
      back_urls: {
        success: `${window.location.origin}/payment-success`,
        failure: `${window.location.origin}/payment-failure`,
        pending: `${window.location.origin}/payment-pending`
      },
      auto_return: 'approved',
      external_reference: `${companyId}_${planId}_${Date.now()}`,
      metadata: {
        companyId: companyId,
        plan: planId
      }
    };

    try {
      // Llamar a tu backend para crear preferencia de MP
      const response = await fetch('http://localhost:3001/api/payments/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preference)
      });

      const data = await response.json();

      // Redirigir a Mercado Pago
      window.location.href = data.init_point;

    } catch (error) {
      console.error('Error creando preferencia:', error);
      alert('Error al procesar el pago. Intenta nuevamente.');
    }
  };

  // Si está activo, mostrar mensaje diferente
  if (active && status === 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Tu plan está activo</h2>
          <p className="text-gray-400 mb-6">Estás disfrutando de ProControl</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-orange-600 rounded-lg hover:bg-orange-700 transition"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-900 text-white p-4 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {status === 'trial_expired' || status === 'suspended' ? (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2">Tu período de prueba ha finalizado</h1>
              <p className="text-gray-300">
                Selecciona un plan para continuar usando ProControl sin interrupciones
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-bold mb-4">Elige tu plan</h1>
              <p className="text-xl text-gray-400">
                Actualiza para desbloquear todo el potencial de ProControl
              </p>
            </>
          )}
        </motion.div>

        {/* Planes */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.id}
              className={`relative rounded-2xl p-8 backdrop-blur-sm border transition-all ${
                plan.popular
                  ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/50 scale-105'
                  : 'bg-white/5 border-white/10 hover:border-white/30'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10 }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MÁS POPULAR
                </div>
              )}

              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price.toLocaleString('es-CL')}</span>
                <span className="text-gray-400">/mes</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.button
                onClick={() => handlePayment(plan.id)}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-lg hover:shadow-orange-500/50'
                    : 'bg-white/10 border border-white/20 hover:bg-white/20'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Elegir Plan
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Garantía */}
        <motion.div
          className="text-center mt-12 text-gray-400 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Lock className="w-5 h-5 inline-block mr-2" />
          Pagos seguros con Mercado Pago • Cancela cuando quieras
        </motion.div>
      </div>
    </div>
  );
}
```

---

## 💳 INTEGRACIÓN MERCADO PAGO

### PASO 1: Crear cuenta en Mercado Pago

1. Ve a https://www.mercadopago.cl/developers
2. Registra una cuenta (gratis)
3. Ve a "Tus aplicaciones" → "Crear aplicación"
4. Selecciona "Pagos online"
5. Obtén tus credenciales:
   - **Public Key**: `APP_USR-xxxxxxxx` (para frontend)
   - **Access Token**: `APP_USR-xxxxxxxx` (para backend)

### PASO 2: Instalar SDK Backend

```bash
cd planilla-costos-backend
npm install mercadopago
```

### PASO 3: Crear endpoint de pagos

```javascript
// planilla-costos-backend/routes/payments.js
const express = require('express');
const router = express.Router();
const mercadopago = require('mercadopago');

// Configurar Mercado Pago
mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// Crear preferencia de pago
router.post('/create-preference', async (req, res) => {
  try {
    const preference = {
      items: req.body.items,
      back_urls: req.body.back_urls,
      auto_return: req.body.auto_return || 'approved',
      external_reference: req.body.external_reference,
      metadata: req.body.metadata,
      notification_url: `${process.env.BACKEND_URL}/api/payments/webhook`, // Para recibir notificaciones
    };

    const response = await mercadopago.preferences.create(preference);

    res.json({
      id: response.body.id,
      init_point: response.body.init_point, // URL para redirigir
      sandbox_init_point: response.body.sandbox_init_point // Para testing
    });

  } catch (error) {
    console.error('Error creando preferencia:', error);
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
});

// Webhook para notificaciones de pago
router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type === 'payment') {
      const paymentId = data.id;

      // Obtener info del pago
      const payment = await mercadopago.payment.get(paymentId);

      if (payment.body.status === 'approved') {
        // Pago aprobado
        const { companyId, plan } = payment.body.metadata;

        // Actualizar plan de la empresa
        await updateCompanyPlan(companyId, plan);

        console.log(`✅ Pago aprobado para empresa ${companyId}, plan ${plan}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.sendStatus(500);
  }
});

async function updateCompanyPlan(companyId, planId) {
  const db = admin.firestore();

  await db.collection('companies').doc(companyId).update({
    plan: planId,
    status: 'active',
    trialEndDate: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastPayment: {
      date: new Date(),
      plan: planId,
      amount: PLANS[planId].price
    }
  });
}

module.exports = router;
```

### PASO 4: Agregar route en server.js

```javascript
// planilla-costos-backend/server.js
const paymentsRouter = require('./routes/payments');
app.use('/api/payments', paymentsRouter);
```

### PASO 5: Variables de entorno

```env
# .env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxx-xxxxxxxx
BACKEND_URL=http://localhost:3001
```

---

## 🎯 FLUJO COMPLETO:

```
1. Usuario se registra con plan FREE
   → status: "trial", trialEndDate: +14 días

2. Usuario usa el sistema 14 días
   → Banner muestra: "Te quedan X días"

3. Día 15 (trial expiró):
   → Backend auto-suspende
   → Frontend detecta y redirige a /upgrade
   → Muestra: "Tu prueba gratis terminó"

4. Usuario selecciona plan y paga:
   → Crea preferencia en Mercado Pago
   → Redirige a MP para pagar
   → Usuario paga con tarjeta/cuenta MP

5. Mercado Pago notifica via webhook:
   → Backend recibe notificación
   → Actualiza plan: status: "active"
   → Usuario puede usar el sistema ✅

6. Cada mes:
   → Debes configurar suscripción recurrente en MP
   → O enviar recordatorio para renovar
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN:

- [ ] Crear `useCompanyStatus.js`
- [ ] Crear `TrialBanner.jsx`
- [ ] Crear página `UpgradePlan.jsx`
- [ ] Agregar `TrialBanner` en App.jsx
- [ ] Crear ruta `/upgrade` en App.jsx
- [ ] Registrarse en Mercado Pago
- [ ] Obtener credenciales
- [ ] Instalar `mercadopago` en backend
- [ ] Crear `routes/payments.js`
- [ ] Configurar webhook URL en MP
- [ ] Probar con Sandbox de MP
- [ ] Deploy y probar en producción

---

**Tiempo estimado**: 4-6 horas de desarrollo

**Costo Mercado Pago**:
- Chile: 3.99% + $100 CLP por transacción aprobada
- Suscripciones: 4.99%

**Ejemplo**:
- Cliente paga $49.990
- MP cobra: $49.990 × 4.99% = $2.495
- Recibes: $47.495
