# 🎨 Plan de Rediseño: WorkersManagement Profesional

## Objetivo
Crear un componente WorkersManagement **moderno, limpio y profesional** con:
- ✅ UI tipo shadcn/ui (Tailwind + Framer Motion)
- ✅ Formulario en pasos (wizard) para crear trabajadores
- ✅ Vista de permisos clara y simple
- ✅ Experiencia de usuario fluida

## Estructura Nueva

```
src/
├── components/workers/
│   ├── WorkersTable.jsx          (Tabla con trabajadores)
│   ├── WorkerCard.jsx             (Card individual de trabajador)
│   ├── CreateWorkerWizard.jsx     (Wizard de 3 pasos)
│   │   ├── Step1BasicInfo.jsx    (Nombre, email, contraseña)
│   │   ├── Step2RoleAndLimits.jsx (Rol, límites diarios)
│   │   └── Step3Warehouses.jsx   (Bodegas asignadas)
│   ├── RolePermissionsDisplay.jsx (Mostrar permisos del rol)
│   └── WorkerStatsCards.jsx       (Estadísticas: total, activos, etc.)
│
└── pages/
    └── WorkersManagement.jsx      (Orquestador limpio)
```

## Wizard de 3 Pasos

### Paso 1: Información Básica
- Nombre completo
- Email
- Contraseña (auto-generar o manual)

### Paso 2: Rol y Límites
- Selector de rol (6 opciones con iconos y descripciones)
- Permisos se muestran automáticamente (read-only)
- Configurar límites diarios según rol

### Paso 3: Bodegas
- Seleccionar bodegas a las que tiene acceso
- Vista previa del trabajador antes de crear

## Componentes Clave

### WorkerCard
```jsx
<motion.div className="bg-white rounded-xl border shadow-sm p-6">
  <div className="flex items-center gap-4">
    <Avatar />
    <div>
      <h3>{worker.name}</h3>
      <Badge>{worker.role}</Badge>
    </div>
  </div>
  <div className="mt-4">
    <div>Email: {worker.email}</div>
    <div>Límite: {worker.dailyLimitMoney}</div>
  </div>
  <div className="mt-4 flex gap-2">
    <Button>Editar</Button>
    <Button variant="destructive">Desactivar</Button>
  </div>
</motion.div>
```

### RoleSelector
```jsx
<div className="grid grid-cols-2 gap-4">
  {ROLES.map(role => (
    <motion.button
      className={`p-4 border-2 rounded-xl ${selected ? 'border-blue-500' : ''}`}
      whileHover={{ scale: 1.02 }}
    >
      <div className="text-3xl">{role.icon}</div>
      <h4 className="font-bold">{role.name}</h4>
      <p className="text-sm text-slate-600">{role.description}</p>
    </motion.button>
  ))}
</div>
```

## Paleta de Colores

- **ADMIN**: `bg-purple-100 text-purple-800 border-purple-300`
- **ENCARGADA**: `bg-blue-100 text-blue-800 border-blue-300`
- **CAJERA**: `bg-green-100 text-green-800 border-green-300`
- **VENDEDORA**: `bg-pink-100 text-pink-800 border-pink-300`
- **SUPERVISOR**: `bg-orange-100 text-orange-800 border-orange-300`
- **WORKER**: `bg-slate-100 text-slate-800 border-slate-300`

## Iconos por Rol

- **ADMIN**: ⚡ (Crown)
- **ENCARGADA**: 👩‍💼 (Briefcase)
- **CAJERA**: 💰 (Cash Register)
- **VENDEDORA**: 🛍️ (Shopping Bag)
- **SUPERVISOR**: 👁️ (Eye)
- **WORKER**: 🔧 (Wrench)

## Animaciones

- **Card hover**: scale(1.02), shadow-lg
- **Modal open**: slideUp + fadeIn
- **Button**: scale(0.98) on tap
- **List items**: staggered fadeIn

## Estado de Implementación

- [ ] Crear estructura de carpetas
- [ ] WorkersTable.jsx
- [ ] WorkerCard.jsx
- [ ] CreateWorkerWizard pasos 1-3
- [ ] RolePermissionsDisplay.jsx
- [ ] WorkerStatsCards.jsx
- [ ] Integrar en WorkersManagement.jsx
- [ ] Testing completo
