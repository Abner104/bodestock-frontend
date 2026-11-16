// src/hooks/useCurrency.js
/**
 * Hook para formatear moneda según la configuración global
 */

import { useSettings } from '../contexts/SettingsContext';

export function useCurrency() {
  const { formatCurrency, currency } = useSettings();

  return {
    formatCurrency,
    currency,
    // Alias para compatibilidad con código existente
    CLP: formatCurrency
  };
}
