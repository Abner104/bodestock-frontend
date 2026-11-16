// src/hooks/useRegion.js
import { useState, useEffect } from 'react';
import { REGIONS, DEFAULT_REGION, formatCurrency } from '../config/regions';

const CACHE_KEY = 'bodestock_region';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

async function detectCountry() {
  // 1. ¿Ya hay una preferencia manual guardada?
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (saved?.manual) return saved.code;
    if (saved?.code && saved?.ts && Date.now() - saved.ts < CACHE_TTL) return saved.code;
  } catch {}

  // 2. Detectar por IP — API pública, sin cuenta, sin CORS
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const code = data.country_code || DEFAULT_REGION;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ code, ts: Date.now() }));
    return code;
  } catch {}

  // 3. Fallback por timezone del navegador
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Caracas')) return 'VE';
    if (tz.includes('Santiago')) return 'CL';
  } catch {}

  return DEFAULT_REGION;
}

export function useRegion() {
  const [regionCode, setRegionCode] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (saved?.code && REGIONS[saved.code]) return saved.code;
    } catch {}
    return DEFAULT_REGION;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectCountry().then(code => {
      const resolved = REGIONS[code] ? code : DEFAULT_REGION;
      setRegionCode(resolved);
      setLoading(false);
    });
  }, []);

  const region = REGIONS[regionCode] || REGIONS[DEFAULT_REGION];

  const setRegion = (code) => {
    if (!REGIONS[code]) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ code, ts: Date.now(), manual: true }));
    setRegionCode(code);
  };

  return {
    regionCode,
    region,
    loading,
    setRegion,
    paymentMethods: region.paymentMethods,
    vocab:          region.vocab,
    currency:       region.currency,
    tax:            region.tax,
    formatPrice:    (amount) => formatCurrency(amount, regionCode),
    isVE:           regionCode === 'VE',
    isCL:           regionCode === 'CL',
  };
}
