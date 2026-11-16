// src/contexts/RegionContext.jsx
import { createContext, useContext } from 'react';
import { useRegion } from '../hooks/useRegion';

const RegionContext = createContext(null);

export function RegionProvider({ children }) {
  const region = useRegion();
  return <RegionContext.Provider value={region}>{children}</RegionContext.Provider>;
}

export function useRegionContext() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error('useRegionContext debe usarse dentro de RegionProvider');
  return ctx;
}
