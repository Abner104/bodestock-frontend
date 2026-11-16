# 📊 Índices de Firebase Necesarios

Los índices permiten hacer queries con múltiples orderBy y where.

## 🔗 Links para crear índices (1 click cada uno)

### 1. Permission Requests (status + priority + requestedAt)
**Error visto:** "The query requires an index"

**Click aquí para crearlo:**
👉 https://console.firebase.google.com/v1/r/project/gestor-gastos-407c1/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9nZXN0b3ItZ2FzdG9zLTQwN2MxL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wZXJtaXNzaW9uX3JlcXVlc3RzL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGgwKCHByaW9yaXR5EAIaDwoLcmVxdWVzdGVkQXQQAhoMCghfX25hbWVfXxAC

**Campos:**
- Collection: `permission_requests` (Collection group)
- status: Ascending
- priority: Descending
- requestedAt: Descending

**Tiempo de creación:** 2-3 minutos

---

## 📋 Otros índices que probablemente necesitarás:

Firebase te dará links automáticos cuando los necesites. Simplemente:

1. **Ves el error en consola**
2. **Copias el link** que Firebase te da
3. **Haces click** y esperas 2-3 minutos
4. **Recarga la página**

### Índices comunes en multi-tenant:

#### Inventory Exits (por fecha y warehouse)
```
Collection: inventory_exits (Collection group)
Campos:
- warehouseId: Ascending
- exitDate: Descending
```

#### Inventory (por categoría y stock)
```
Collection: inventory (Collection group)
Campos:
- category: Ascending
- stock: Ascending
```

#### Workers (por rol y activo)
```
Collection: workers (Collection group)
Campos:
- isActive: Ascending
- role: Ascending
- name: Ascending
```

---

## ✅ Cómo crear índices manualmente (si necesitas):

1. Ve a: https://console.firebase.google.com/project/gestor-gastos-407c1/firestore/indexes

2. Click en **"Create Index"**

3. Configura:
   - **Collection ID**: nombre de la colección
   - **Query scope**: Collection group (para multi-tenant)
   - **Fields to index**: Agrega los campos necesarios
   - **Order**: Ascending o Descending según la query

4. Click en **"Create"**

5. Espera 2-3 minutos

---

## 🎯 Estado de Índices:

### Creados:
- [ ] permission_requests (status + priority + requestedAt)

### Por crear (cuando aparezcan errores):
- [ ] inventory_exits
- [ ] inventory
- [ ] workers
- [ ] productos_terminados

---

## 💡 Tip:

**NO necesitas crear todos ahora**. Firebase te dirá exactamente cuáles necesitas cuando los uses. Solo haz click en el link del error y listo.

La mayoría de índices simples (1 campo) los crea Firebase automáticamente.
