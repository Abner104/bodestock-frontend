import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { RegionProvider } from "./contexts/RegionContext";
import { OfflineProvider } from "./contexts/OfflineContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { validateEnvConfig } from "./config/env";
import logger from "./utils/logger"; // Importar logger para deshabilitar console.logs en producción
import './App.css';
import './i18n'; // Inicializar i18n

// Si entran por un dominio de Firebase Hosting (link viejo, ícono guardado, etc.)
// redirigir al dominio custom — el login con Google usa bodestock.cl como authDomain
// y falla si el flujo empieza desde otro host.
const FIREBASE_HOSTING_HOSTS = ['gestor-gastos-407c1.web.app', 'gestor-gastos-407c1.firebaseapp.com'];
if (FIREBASE_HOSTING_HOSTS.includes(window.location.hostname)) {
  window.location.replace(`https://bodestock.cl${window.location.pathname}${window.location.search}${window.location.hash}`);
}

// Validar configuración de entorno al iniciar la app
try {
  validateEnvConfig();
  logger.info('✅ Configuración de entorno validada correctamente');
} catch (error) {
  console.error('❌ Error en configuración de entorno:', error);
}

// Desregistrar cualquier Service Worker viejo que pueda estar cacheado
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}

function AppWrapper() {
  const { isDark } = useTheme();

  const muiTheme = React.useMemo(() => createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
      primary: {
        main: '#3B82F6',
      },
      secondary: {
        main: '#06B6D4',
      },
      background: {
        default: isDark ? '#0F172A' : '#FFFFFF',
        paper: isDark ? '#1E293B' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F8FAFC' : '#111827',
        secondary: isDark ? '#CBD5E1' : '#6B7280',
      }
    },
  }), [isDark]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <SettingsProvider>
        <RegionProvider>
          <OfflineProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </OfflineProvider>
        </RegionProvider>
      </SettingsProvider>
    </MuiThemeProvider>
  );
}

function Main() {
  return (
    <ThemeProvider>
      <AppWrapper />
    </ThemeProvider>
  );
}

// Asegúrate de envolver Main con BrowserRouter y ErrorBoundary
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Main />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
