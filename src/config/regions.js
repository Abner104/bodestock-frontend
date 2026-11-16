// src/config/regions.js
// Configuración por región — agregar un nuevo país = agregar una entrada aquí

export const REGIONS = {
  CL: {
    code: 'CL',
    name: 'Chile',
    flag: '🇨🇱',
    currency: {
      code: 'CLP',
      symbol: '$',
      locale: 'es-CL',
      decimals: 0,
    },
    tax: {
      label: 'IVA',
      rate: 0.19,
    },
    // Identificador tributario de la empresa
    taxId: {
      label: 'RUT',
      placeholder: '12.345.678-9',
    },
    // Métodos de pago disponibles en esta región
    paymentMethods: {
      CASH:     { label: 'Efectivo',           icon: '💵', color: 'bg-green-100 text-green-800' },
      CARD:     { label: 'Débito/Crédito',     icon: '💳', color: 'bg-blue-100 text-blue-800' },
      TRANSFER: { label: 'Transferencia',      icon: '🏦', color: 'bg-purple-100 text-purple-800' },
      CREDIT:   { label: 'Fiado',              icon: '📒', color: 'bg-orange-100 text-orange-800' },
      OTHER:    { label: 'Otro',               icon: '💰', color: 'bg-gray-100 text-gray-800' },
    },
    // Vocabulario local
    vocab: {
      store:        'minimarket',
      stores:       'minimarkets',
      credit:       'fiado',
      creditVerb:   'fiar',
      warehouse:    'bodega',
      supplies:     'insumos',
      greeting:     'Hola',
      buddy:        '',
      trialDays:    30,
    },
    // Precios en USD (referencia para planes)
    planCurrency: 'CLP',
  },

  VE: {
    code: 'VE',
    name: 'Venezuela',
    flag: '🇻🇪',
    currency: {
      code: 'USD',
      symbol: '$',
      locale: 'es-VE',
      decimals: 2,
    },
    tax: {
      label: 'IVA',
      rate: 0.16,
    },
    taxId: {
      label: 'RIF',
      placeholder: 'J-12345678-9',
    },
    paymentMethods: {
      CASH:     { label: 'Efectivo USD',       icon: '💵', color: 'bg-green-100 text-green-800' },
      ZELLE:    { label: 'Zelle',              icon: '💸', color: 'bg-blue-100 text-blue-800' },
      USDT:     { label: 'USDT / Binance',     icon: '₿',  color: 'bg-yellow-100 text-yellow-800' },
      PAGOMOVIL:{ label: 'Pago Móvil',         icon: '📲', color: 'bg-purple-100 text-purple-800' },
      CREDIT:   { label: 'Al fiao',            icon: '📒', color: 'bg-orange-100 text-orange-800' },
      OTHER:    { label: 'Otro',               icon: '💰', color: 'bg-gray-100 text-gray-800' },
    },
    vocab: {
      store:        'abasto',
      stores:       'abastos',
      credit:       'fiao',
      creditVerb:   'fiar',
      warehouse:    'depósito',
      supplies:     'mercancía',
      greeting:     'Buenas',
      buddy:        'pana',
      trialDays:    30,
    },
    planCurrency: 'USD',
  },
};

// Región por defecto si no se detecta
export const DEFAULT_REGION = 'CL';

// Formateador de moneda según región
export const formatCurrency = (amount, regionCode) => {
  const region = REGIONS[regionCode] || REGIONS[DEFAULT_REGION];
  const { locale, code, decimals } = region.currency;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount || 0);
};
