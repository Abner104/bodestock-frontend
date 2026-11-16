// src/contexts/SettingsContext.jsx
/**
 * Context global para configuración de moneda, idioma y zona horaria
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';

const SettingsContext = createContext();

// Formateadores de moneda
const CURRENCY_FORMATTERS = {
  CLP: new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  USD: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }),
  EUR: new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }),
  ARS: new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  PEN: new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }),
  COP: new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  MXN: new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    currency: 'CLP',
    language: 'es',
    timezone: 'America/Santiago'
  });
  const [loading, setLoading] = useState(true);

  // Cargar configuración desde Firestore
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const companyId = await getUserCompanyId();
        if (!companyId) {
          setLoading(false);
          return;
        }

        const generalDoc = await getDoc(doc(db, `companies/${companyId}/settings`, 'general'));
        if (generalDoc.exists()) {
          const data = generalDoc.data();
          setSettings({
            currency: data.currency || 'CLP',
            language: data.language || 'es',
            timezone: data.timezone || 'America/Santiago'
          });
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
      } finally {
        setLoading(false);
      }
    };

    // Escuchar cambios en auth
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadSettings();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Función para formatear moneda
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return CURRENCY_FORMATTERS[settings.currency].format(0);
    }
    return CURRENCY_FORMATTERS[settings.currency].format(amount);
  };

  // Función para actualizar configuración
  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const value = {
    settings,
    updateSettings,
    formatCurrency,
    loading,
    currency: settings.currency,
    language: settings.language,
    timezone: settings.timezone
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// Hook para usar el context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings debe usarse dentro de SettingsProvider');
  }
  return context;
}
