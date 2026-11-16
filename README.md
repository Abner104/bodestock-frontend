# 📦 Stockly - Sistema de Gestión de Inventario

<div align="center">

![Stockly Logo](src/assets/logoStockly.png)

**Sistema SaaS multi-tenant para gestión integral de inventarios, costeo de productos y control de trabajadores**

[![React](https://img.shields.io/badge/React-19.1.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3.5-purple.svg)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Latest-orange.svg)](https://firebase.google.com/)
[![Material-UI](https://img.shields.io/badge/MUI-7.1.0-blue.svg)](https://mui.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

</div>

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Desarrollo](#-desarrollo)
- [Despliegue](#-despliegue)
- [Arquitectura](#-arquitectura)
- [Scripts Disponibles](#-scripts-disponibles)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Guía de Contribución](#-guía-de-contribución)

---

## ✨ Características Principales

### 🏢 Multi-Tenancy
- **Aislamiento de datos** por empresa
- **Roles y permisos** (ADMIN, SUPERVISOR, WORKER)
- **Custom claims** de Firebase para autorización

### 📊 Gestión de Inventario
- Control de stock en tiempo real
- Alertas de inventario bajo
- Escaneo de códigos de barras y QR
- Categorización de productos
- Sistema de bodegas/almacenes

### 💰 Costeo de Productos
- Wizard paso a paso para calcular costos
- Gestión de insumos/ingredientes
- Cálculo automático de márgenes
- División por porciones
- Historial de costeos

### 👥 Gestión de Trabajadores
- Creación y gestión de trabajadores
- Asignación de bodegas
- Límites diarios (dinero/unidades)
- Sistema de permisos granular
- Dashboard específico para trabajadores

### 📈 Reportes y Analytics
- Dashboard con KPIs en tiempo real
- Visualización de datos con gráficos (Recharts)
- Exportación a Excel y PDF
- Historial de salidas de inventario
- Reportes de ventas y desperdicios

### 🤖 Asistente IA
- Integración con OpenAI
- Ayuda contextual para inventario
- Procesamiento de lenguaje natural

### 💳 Sistema de Suscripciones
- Período de prueba (30 días)
- Planes escalonados
- Integración con MercadoPago
- Gestión de upgrades

### 🎨 UI/UX Premium
- **Dynamic Island** (estilo iOS)
- Animaciones con Framer Motion
- Glassmorphism y efectos modernos
- Dark mode completo
- Diseño responsive (Mobile-first)
- Optimización iOS (safe areas, haptic feedback)

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 19.1.0** - Librería de UI
- **Vite 6.3.5** - Build tool y dev server
- **Material-UI 7.1.0** - Componentes de UI
- **Tailwind CSS 4.1.12** - Utility-first CSS
- **Framer Motion 12.23.24** - Animaciones
- **React Router 7.6.0** - Enrutamiento

### Backend & Servicios
- **Firebase**
  - Authentication - Gestión de usuarios
  - Firestore - Base de datos NoSQL
  - Storage - Almacenamiento de archivos
  - Cloud Functions - Backend serverless
- **OpenAI API 6.15.0** - Asistente IA

### Librerías Adicionales
- **Recharts** - Gráficos y visualizaciones
- **jsPDF** - Generación de PDFs
- **xlsx** - Exportación Excel
- **html5-qrcode** - Escaneo QR/Barcode
- **MercadoPago SDK** - Pagos
- **React Toastify** - Notificaciones

---

## 📦 Requisitos Previos

```bash
Node.js >= 18.0.0
npm >= 9.0.0
```

### Cuentas Requeridas
- Proyecto de Firebase
- API Key de OpenAI (opcional, para asistente IA)
- Cuenta de MercadoPago (para pagos)

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd planilla-costos
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
# Firebase
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# OpenAI
VITE_OPENAI_API_KEY=sk-your_key

# Backend
VITE_API_URL=http://localhost:5188

# Super Admin
VITE_SUPER_ADMIN_EMAIL=admin@yourdomain.com

# MercadoPago
VITE_MERCADOPAGO_PUBLIC_KEY=your_public_key
```

### 4. Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilita Authentication (Email/Password)
3. Crea base de datos Firestore
4. Configura reglas de seguridad (ver `firestore.rules`)
5. Descarga las credenciales de configuración

---

## 💻 Desarrollo

### Iniciar servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Características en desarrollo
- Hot Module Replacement (HMR)
- Error Boundaries activos
- Logger habilitado
- Source maps

---

## 🏗️ Despliegue

### Build de producción

```bash
npm run build
```

Los archivos optimizados se generarán en `dist/`

### Preview de producción

```bash
npm run preview
```

### Deploy a Firebase Hosting

```bash
firebase deploy --only hosting
```

### Variables de entorno en producción

Asegúrate de configurar todas las variables en tu plataforma de hosting:
- Vercel: Settings > Environment Variables
- Netlify: Site settings > Build & deploy > Environment
- Firebase: `firebase functions:config:set`

---

## 🏛️ Arquitectura

### Multi-Tenancy
```
Firebase Auth → Custom Claims → companyId
                                    ↓
                        Firestore: companies/{companyId}/...
```

### Estructura de datos

```
firestore/
├── companies/
│   └── {companyId}/
│       ├── products/
│       ├── inventory/
│       ├── workers/
│       ├── categories/
│       └── exits/
└── users/
    └── {userId}
```

### Flujo de autenticación
1. Usuario se autentica con Firebase Auth
2. Se obtiene el `idToken` con custom claims
3. Se extrae `companyId` de los claims
4. Todas las queries incluyen el `companyId`

---

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar dev server
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # Ejecutar ESLint

# Firebase
firebase deploy      # Deploy completo
firebase deploy --only hosting
firebase deploy --only functions
```

---

## 📁 Estructura del Proyecto

```
planilla-costos/
├── src/
│   ├── assets/           # Imágenes, logos
│   ├── components/       # Componentes reutilizables
│   │   ├── ui/          # Componentes UI base
│   │   ├── products/    # Componentes de productos
│   │   └── ...
│   ├── pages/           # Páginas/Rutas
│   ├── contexts/        # React Contexts
│   ├── hooks/           # Custom hooks
│   ├── services/        # Lógica de negocio
│   ├── config/          # Configuraciones
│   │   └── env.js       # Variables de entorno
│   ├── utils/           # Utilidades
│   │   └── logger.js    # Sistema de logs
│   ├── firebase/        # Configuración Firebase
│   ├── App.jsx          # Componente principal
│   └── main.jsx         # Entry point
├── public/              # Archivos estáticos
├── dist/                # Build de producción
├── .env.example         # Template de variables
├── vite.config.js       # Configuración Vite
├── tailwind.config.js   # Configuración Tailwind
└── package.json         # Dependencias
```

---

## 🔒 Seguridad

### Buenas prácticas implementadas
- ✅ Variables de entorno para secretos
- ✅ Error Boundaries para capturar errores
- ✅ Validación de roles en backend (Custom Claims)
- ✅ Firestore Security Rules
- ✅ HTTPS en producción
- ✅ Content Security Policy

### TODO de seguridad
- [ ] Implementar rate limiting
- [ ] Agregar 2FA
- [ ] Audit logs
- [ ] Encriptación de datos sensibles

---

## 🧪 Testing

### Ejecutar tests (próximamente)

```bash
npm run test
npm run test:coverage
```

**Nota:** El proyecto actualmente no tiene tests. Se recomienda implementar:
- Unit tests con Vitest
- Integration tests con React Testing Library
- E2E tests con Playwright

---

## 🐛 Debugging

### Habilitar modo debug

```env
VITE_DEBUG_MODE=true
```

### Ver logs en producción

Los logs están deshabilitados en producción. Para habilitarlos temporalmente:

```javascript
// En consola del navegador
console._original.log('mensaje de debug');
```

---

## 📈 Roadmap

### v2.0 (Próximo)
- [ ] Migración a TypeScript
- [ ] Tests unitarios (70% coverage)
- [ ] PWA con service workers
- [ ] Multi-idioma (i18n)
- [ ] Bulk operations
- [ ] Advanced filtering

### v3.0 (Futuro)
- [ ] Mobile app (React Native)
- [ ] Integración con ERPs
- [ ] Analytics avanzado
- [ ] Webhooks
- [ ] API pública

---

## 👥 Equipo

- **Desarrollo**: [Tu nombre]
- **Diseño UI/UX**: [Diseñador]
- **Backend**: Firebase + Node.js

---

## 📄 Licencia

Proprietary - Todos los derechos reservados © 2025 Stockly

---

## 📞 Soporte

- **Email**: soporte@stockly.com
- **Documentación**: [Docs](https://docs.stockly.com)
- **Issues**: [GitHub Issues](https://github.com/tu-org/stockly/issues)

---

## 🙏 Agradecimientos

- [Firebase](https://firebase.google.com/)
- [Vercel](https://vercel.com/) por el hosting
- [OpenAI](https://openai.com/) por la API
- Comunidad de React

---

<div align="center">

**Hecho con ❤️ usando React + Vite**

[⬆ Volver arriba](#-stockly---sistema-de-gestión-de-inventario)

</div>
