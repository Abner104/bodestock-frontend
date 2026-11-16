# 📦 GUÍA COMPLETA: Sistema de Presentaciones Múltiples

## 🎯 ¿Qué problema resuelve?

**Problema anterior:**
- Compras 10 cajas de Corona (cada caja = 24 botellas)
- Sistema pensaba que eran 10 botellas
- Al vender, el precio estaba mal

**Solución ahora:**
- Defines que compras en "Cajas"
- El sistema convierte: 10 cajas × 24 = 240 botellas
- Stock correcto: 240 botellas
- Al vender, vendes por botella individual

---

## 📝 PASO A PASO: Crear Producto Corona

### PASO 0: Información Básica
```
✏️ Nombre: Corona
🏷️ SKU: CRN-001
📂 Categoría: Bebidas
🏭 Bodega: Principal
```

### PASO 1: Unidad de Medida + Presentaciones

#### 1.1 Definir Unidad BASE (la más pequeña)
```
📏 Unidad principal: botella
```
💡 **Importante:** Esta es la unidad en la que VENDES/USAS el producto.

#### 1.2 Agregar Presentaciones (cómo lo COMPRAS)

Haz clic en "➕ Agregar nueva presentación":

**Presentación 1:**
- Nombre: `Caja`
- Factor: `24`
- Click "Agregar"

**Presentación 2 (opcional):**
- Nombre: `Six-pack`
- Factor: `6`
- Click "Agregar"

**Presentación 3 (opcional):**
- Nombre: `Pallet`
- Factor: `1152`
- Click "Agregar"

✅ **Resultado:**
```
Presentaciones configuradas:
┌─────────────────────────────────┐
│ Caja                            │
│ 1 Caja = 24 botella            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Six-pack                        │
│ 1 Six-pack = 6 botella         │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Pallet                          │
│ 1 Pallet = 1152 botella        │
└─────────────────────────────────┘
```

### PASO 2: Primera Compra (Stock Inicial)

#### 2.1 Seleccionar Presentación
```
📦 ¿En qué presentación compraste?
   [Por Caja (1 = 24 botella)]  ← Selecciona esto
```

#### 2.2 Ingresar Cantidad
```
📦 Cantidad inicial: 10
```

**El sistema muestra:**
```
🔄 Conversión automática:
10 Caja × 24 = 240 botella
💡 El stock se guardará en botella (unidad base)
```

#### 2.3 Ingresar Precio Total
```
💰 Precio total pagado: $120,000
```

**El sistema calcula:**
```
💡 Costo unitario (por botella)
$500
por cada botella

📊 Stock total: 240 botella
```

✅ **Perfecto!**
- Compraste: 10 cajas
- Pagaste: $120,000
- Stock: 240 botellas
- Costo por botella: $500

### PASO 3: Información Adicional (Opcional)
```
🏢 Proveedor: CCU
📅 Fecha vencimiento: 2026-12-31
```

Click "💾 Crear Producto"

---

## 🛒 COMPRAR MÁS STOCK

### Escenario: Comprar 5 cajas más

1. Click en "🛒 Comprar" del producto Corona
2. Aparece el modal de compra:

```
📦 Presentación:
   [ Por botella (unidad base)     ]
   [ Por Caja (1 = 24 botella)     ] ← Selecciona esto
   [ Por Six-pack (1 = 6 botella)  ]
   [ Por Pallet (1 = 1152 botella) ]
```

3. Ingresar datos:
```
Cantidad comprada: 5
💡 Por Caja seleccionado

= 120 botellas en total  ← Se muestra automáticamente
```

4. Precio:
```
Precio TOTAL de la compra: $60,000
```

5. Click "💾 Registrar compra"

**Resultado:**
```
🔄 Convertido: 5 Caja = 120 botella
✅ Compra registrada exitosamente
```

**Nuevo stock:**
- Anterior: 240 botellas
- Compra: 120 botellas
- **Nuevo: 360 botellas**

---

## 💰 VENDER PRODUCTOS (Salidas)

### Escenario: Vender 10 botellas

1. Ve a "Salidas de Inventario"
2. Selecciona el producto Corona
3. Cantidad: `10` (siempre en unidad base = botellas)
4. Click "Registrar salida"

**Resultado:**
- Stock anterior: 360 botellas
- **Nuevo stock: 350 botellas**

💡 **Nota:** Las ventas SIEMPRE son en unidad base (botellas). NO se usa presentación en salidas porque ya vendiste el producto suelto.

---

## 📊 EJEMPLOS COMPLETOS

### Ejemplo 1: Producto SIN Presentaciones (Carne)

**PASO 1:**
```
Unidad principal: kg
```
**NO agregar presentaciones** ← Dejar vacío

**PASO 2:**
```
Cantidad inicial: 10  (kg)
Precio total: $50,000
```

**Resultado:**
- Stock: 10 kg
- Costo: $5,000/kg

Al comprar o vender, SIEMPRE en kg. Simple y directo.

---

### Ejemplo 2: Producto CON Presentaciones (Aceite)

**PASO 1:**
```
Unidad principal: litro

Presentaciones:
- Bidón: 20 litros
- Botella 1L: 1 litro
- Botella 500ml: 0.5 litros
```

**PASO 2:**
```
Presentación: Bidón (20 litros)
Cantidad: 5 bidones
Precio: $100,000

🔄 Conversión: 5 Bidón × 20 = 100 litros
💡 Costo: $1,000/litro
```

**Compras futuras:**
- Puedes comprar en CUALQUIER presentación (Bidón, Botella 1L, 500ml)
- El sistema SIEMPRE convierte a litros

**Ventas:**
- Siempre vendes en litros (unidad base)

---

## ❓ PREGUNTAS FRECUENTES

### 1. ¿Puedo cambiar las presentaciones después?
✅ **Sí.** Ve a Editar producto → PASO 1 → Agregar/Eliminar presentaciones.

### 2. ¿Qué pasa si no agrego presentaciones?
✅ El producto funciona igual que antes. Compras y vendes en la misma unidad.

### 3. ¿Puedo tener productos con y sin presentaciones?
✅ Sí. Cada producto es independiente.

### 4. ¿Las presentaciones afectan el stock?
✅ **NO.** El stock SIEMPRE se guarda en unidad base. Las presentaciones solo sirven para facilitar las compras.

### 5. ¿Puedo vender en diferentes presentaciones?
❌ **NO.** Las ventas siempre son en unidad base. Las presentaciones son SOLO para compras.

*Razón: Cuando vendes, ya sacaste el producto de su empaque. Ejemplo: Vendes botellas individuales, no cajas completas.*

### 6. ¿Qué pasa con productos antiguos?
✅ Ejecuta la migración (ver `MIGRACION-PRESENTACIONES.md`) o edita manualmente cada producto.

---

## 🎓 PARA EL ASISTENTE DE VOZ

Cuando el asistente cree un producto con presentaciones, debe:

1. **Preguntar:** "¿En qué unidad se VENDE/USA este producto?"
   - Respuesta: "botella", "kg", "litro", etc.

2. **Preguntar:** "¿Se compra en una presentación diferente?"
   - Si NO: Continuar sin presentaciones
   - Si SÍ: Preguntar presentaciones

3. **Para cada presentación:**
   - "¿Nombre de la presentación?" → "Caja"
   - "¿Cuántas [unidad base] trae?" → "24"
   - "¿Agregar otra presentación?" → Sí/No

4. **Primera compra:**
   - Si hay presentaciones: "¿En qué presentación compraste?" → Seleccionar
   - "¿Cuántas [presentación]?" → Cantidad
   - "¿Precio total?" → Monto

5. **Crear con datos:**
```javascript
{
  name: "Corona",
  unit: "botella",
  presentations: [
    { id: "auto", name: "Caja", factor: 24 },
    { id: "auto", name: "Six-pack", factor: 6 }
  ],
  initialPresentationId: "id-de-Caja",
  stock: 10,  // Se convertirá a 240 botellas
  ppp: 120000
}
```

---

## ✅ CHECKLIST DE CREACIÓN

- [ ] Definir unidad BASE (la más pequeña)
- [ ] Agregar presentaciones (si aplica)
- [ ] Seleccionar presentación para primera compra
- [ ] Ingresar cantidad Y precio total
- [ ] Verificar conversión automática
- [ ] Verificar costo unitario
- [ ] Crear producto
- [ ] Probar compra adicional
- [ ] Verificar que stock se actualiza correctamente

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### "El costo por unidad está mal"
✅ **Verifica:** ¿Seleccionaste la presentación correcta en la compra inicial?

### "El stock muestra cantidad incorrecta"
✅ **Verifica:** El stock debe estar en unidad BASE, NO en presentación.
Ejemplo: Si compraste 10 cajas de 24, el stock debe ser 240 (botellas), NO 10.

### "No aparece el selector de presentaciones"
✅ **Verifica:** ¿Agregaste presentaciones en el PASO 1?

### "Al vender, el precio no coincide"
✅ **Normal.** El PPP (Precio Promedio Ponderado) cambia con cada compra.

---

**¡Listo!** Ahora tienes un sistema de inventario profesional que maneja presentaciones múltiples como los ERP grandes (SAP, Odoo, etc.) 🚀
