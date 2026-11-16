# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based cost management application ("planilla-costos") for tracking product costs and inventory. The app uses Firebase for authentication and data storage, with a modern UI built using Material-UI and Tailwind CSS.

## Common Development Commands

### Development
- `npm run dev` - Start development server with Vite
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality checks

### Firebase Deployment
The app is configured for Firebase hosting with the build output in the `dist` directory.

## Architecture Overview

### Tech Stack
- **Frontend**: React 19.1.0 with Vite as build tool
- **UI Framework**: Material-UI (@mui/material) with Tailwind CSS for styling
- **Routing**: React Router DOM with client-side routing
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **State Management**: React hooks (useState, useEffect)
- **Styling**: Tailwind CSS with custom animations + Material-UI components
- **PDF Generation**: jsPDF with autotable for reports
- **Excel Export**: xlsx library for spreadsheet functionality
- **Charts**: Recharts for data visualization

### Project Structure
```
src/
├── components/           # Reusable UI components
│   ├── products/        # Product-specific components
│   ├── DashboardResumen.jsx
│   ├── InsumosTable.jsx
│   └── Navbar.jsx
├── pages/               # Route components
│   ├── Dashboard.jsx
│   ├── HistorialIndex.jsx
│   ├── InsumosPage.jsx
│   ├── Login.jsx
│   ├── ProductCostingWizard.jsx
│   └── Profile.jsx
├── firebase/
│   └── firebase.js      # Firebase configuration
├── App.jsx              # Main app component with routing
└── main.jsx             # App entry point with theme provider
```

### Key Features
1. **Authentication Flow**: Firebase Auth with protected routes
2. **Product Costing**: Wizard-based product cost calculation
3. **Inventory Management**: Track "insumos" (supplies/materials)
4. **Historical Data**: Product history tracking and visualization
5. **Dashboard**: Overview with charts and summary data
6. **Export Functionality**: PDF and Excel export capabilities

### Firebase Integration
- Authentication: Users must log in to access the app
- Firestore: Stores product data, costs, and inventory information
- Configuration is in `src/firebase/firebase.js`

### UI Patterns
- Uses Material-UI components with dark/light theme switching
- Tailwind CSS for custom styling and animations
- Responsive design with mobile-first approach
- Loading states with CircularProgress components

### Development Notes
- ESLint configured with React hooks and refresh plugins
- Vite for fast development and building
- Uses React 19 with concurrent features
- Firebase security rules should be configured separately