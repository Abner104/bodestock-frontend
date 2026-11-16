// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Intentar obtener el tema guardado o usar 'dark' por defecto
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('bodestock-theme');
    return savedTheme || 'dark';
  });

  useEffect(() => {
    // Guardar tema en localStorage
    localStorage.setItem('bodestock-theme', theme);

    // Aplicar clase al html element y al body
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const colors = {
    light: {
      // Colores modo claro
      primary: '#3B82F6',
      primaryHover: '#2563EB',
      secondary: '#06B6D4',
      accent: '#0EA5E9',
      bg: {
        primary: '#FFFFFF',
        secondary: '#F9FAFB',
        tertiary: '#F3F4F6',
      },
      text: {
        primary: '#111827',
        secondary: '#6B7280',
        tertiary: '#9CA3AF',
      },
      border: '#E5E7EB',
      shadow: 'rgba(59, 130, 246, 0.1)',
      gradient: {
        from: '#3B82F6',
        via: '#60A5FA',
        to: '#93C5FD'
      }
    },
    dark: {
      // Colores modo oscuro
      primary: '#3B82F6',
      primaryHover: '#60A5FA',
      secondary: '#06B6D4',
      accent: '#0EA5E9',
      bg: {
        primary: '#0F172A',
        secondary: '#1E293B',
        tertiary: '#334155',
      },
      text: {
        primary: '#F8FAFC',
        secondary: '#CBD5E1',
        tertiary: '#94A3B8',
      },
      border: '#334155',
      shadow: 'rgba(59, 130, 246, 0.3)',
      gradient: {
        from: '#3B82F6',
        via: '#60A5FA',
        to: '#93C5FD'
      }
    }
  };

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    colors: colors[theme]
  }), [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
