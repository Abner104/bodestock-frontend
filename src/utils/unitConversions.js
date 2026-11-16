// src/utils/unitConversions.js

// Tabla de conversiones de unidades
export const UNIT_CONVERSIONS = {
  // PESO
  weight: {
    baseUnit: 'g', // gramos como unidad base
    units: {
      'g': 1,
      'gr': 1,
      'gramos': 1,
      'kg': 1000,
      'kilogramos': 1000,
      'lb': 453.592,
      'libras': 453.592,
      'oz': 28.3495, // onzas de peso
      'onzas': 28.3495,
      'mg': 0.001,
      'miligramos': 0.001,
      't': 1000000,
      'ton': 1000000,
      'toneladas': 1000000,
    }
  },

  // VOLUMEN LÍQUIDO
  volume: {
    baseUnit: 'ml',
    units: {
      'ml': 1,
      'mililitros': 1,
      'l': 1000,
      'litros': 1000,
      'cc': 1,
      'oz': 29.5735, // onzas líquidas (fl oz)
      'fl oz': 29.5735,
      'onzas': 29.5735,
      'gal': 3785.41,
      'galon': 3785.41,
      'galones': 3785.41,
      'taza': 236.588,
      'tazas': 236.588,
      'cup': 236.588,
      'cups': 236.588,
      'cucharada': 14.7868,
      'cucharadas': 14.7868,
      'tbsp': 14.7868,
      'cucharadita': 4.92892,
      'cucharaditas': 4.92892,
      'tsp': 4.92892,
      'pinta': 473.176,
      'pintas': 473.176,
      'pint': 473.176,
      'cuarto': 946.353,
      'cuartos': 946.353,
      'quart': 946.353,
    }
  },

  // LONGITUD
  length: {
    baseUnit: 'cm',
    units: {
      'mm': 0.1,
      'milimetros': 0.1,
      'cm': 1,
      'centimetros': 1,
      'm': 100,
      'metros': 100,
      'metro': 100,
      'km': 100000,
      'kilometros': 100000,
      'in': 2.54,
      'inch': 2.54,
      'pulgadas': 2.54,
      'pulgada': 2.54,
      'ft': 30.48,
      'pie': 30.48,
      'pies': 30.48,
      'feet': 30.48,
      'yd': 91.44,
      'yarda': 91.44,
      'yardas': 91.44,
      'yard': 91.44,
    }
  },

  // UNIDADES (sin conversión)
  count: {
    baseUnit: 'unidad',
    units: {
      'unidad': 1,
      'unidades': 1,
      'ud': 1,
      'u': 1,
      'pieza': 1,
      'piezas': 1,
      'pza': 1,
      'docena': 12,
      'docenas': 12,
      'dz': 12,
      'caja': 1,
      'cajas': 1,
      'paquete': 1,
      'paquetes': 1,
      'botella': 1,
      'botellas': 1,
      'lata': 1,
      'latas': 1,
      'six pack': 6,
      'sixpack': 6,
    }
  }
};

// Detectar el tipo de unidad
export function detectUnitType(unit) {
  const normalizedUnit = unit.toLowerCase().trim();

  for (const [type, data] of Object.entries(UNIT_CONVERSIONS)) {
    if (normalizedUnit in data.units) {
      return type;
    }
  }

  return 'count'; // Por defecto, unidades sin conversión
}

// Convertir de una unidad a otra
export function convertUnit(value, fromUnit, toUnit) {
  if (!value || !fromUnit || !toUnit) return value;

  const normalizedFrom = fromUnit.toLowerCase().trim();
  const normalizedTo = toUnit.toLowerCase().trim();

  // Si son la misma unidad, no convertir
  if (normalizedFrom === normalizedTo) return value;

  // Detectar tipo de unidad
  const fromType = detectUnitType(normalizedFrom);
  const toType = detectUnitType(normalizedTo);

  // Si son de diferentes tipos, no se puede convertir
  if (fromType !== toType) {
    console.warn(`No se puede convertir de ${fromUnit} a ${toUnit} - tipos incompatibles`);
    return value;
  }

  const conversionData = UNIT_CONVERSIONS[fromType];

  // Convertir a unidad base primero
  const valueInBase = value * (conversionData.units[normalizedFrom] || 1);

  // Luego convertir a la unidad destino
  const result = valueInBase / (conversionData.units[normalizedTo] || 1);

  return result;
}

// Obtener el precio por unidad convertido
export function convertPrice(pricePerUnit, fromUnit, toUnit) {
  if (!pricePerUnit || !fromUnit || !toUnit) return pricePerUnit;

  const normalizedFrom = fromUnit.toLowerCase().trim();
  const normalizedTo = toUnit.toLowerCase().trim();

  if (normalizedFrom === normalizedTo) return pricePerUnit;

  // Para el precio, la conversión es inversa
  // Si 1 kg = 1000 g, entonces $1000/kg = $1/g
  const conversionFactor = convertUnit(1, fromUnit, toUnit);

  if (conversionFactor === 1) return pricePerUnit;

  return pricePerUnit / conversionFactor;
}

// Obtener unidades compatibles para conversión (ordenadas alfabéticamente)
export function getCompatibleUnits(unit) {
  const normalizedUnit = unit.toLowerCase().trim();
  const type = detectUnitType(normalizedUnit);

  if (!type) return [];

  // Ordenar alfabéticamente por el nombre formateado
  return Object.keys(UNIT_CONVERSIONS[type].units).sort((a, b) => {
    const nameA = formatUnitName(a).toLowerCase();
    const nameB = formatUnitName(b).toLowerCase();
    return nameA.localeCompare(nameB, 'es');
  });
}

// Formatear nombre de unidad para mostrar
export function formatUnitName(unit) {
  const normalizedUnit = unit.toLowerCase().trim();

  // Mapeo de nombres comunes
  const commonNames = {
    'g': 'g',
    'gr': 'g',
    'gramos': 'gramos',
    'kg': 'kg',
    'kilogramos': 'kilogramos',
    'lb': 'lb',
    'libras': 'libras',
    'oz': 'oz',
    'onzas': 'onzas',
    'mg': 'mg',
    'miligramos': 'miligramos',
    't': 't',
    'ton': 'ton',
    'toneladas': 'toneladas',
    'ml': 'ml',
    'mililitros': 'mililitros',
    'l': 'L',
    'litros': 'litros',
    'cc': 'cc',
    'fl oz': 'fl oz',
    'gal': 'gal',
    'galon': 'galón',
    'galones': 'galones',
    'taza': 'taza',
    'tazas': 'tazas',
    'cup': 'cup',
    'cups': 'cups',
    'cucharada': 'cucharada',
    'cucharadas': 'cucharadas',
    'tbsp': 'tbsp',
    'cucharadita': 'cucharadita',
    'cucharaditas': 'cucharaditas',
    'tsp': 'tsp',
    'pinta': 'pinta',
    'pintas': 'pintas',
    'pint': 'pint',
    'cuarto': 'cuarto',
    'cuartos': 'cuartos',
    'quart': 'quart',
    'mm': 'mm',
    'milimetros': 'milímetros',
    'cm': 'cm',
    'centimetros': 'centímetros',
    'm': 'm',
    'metro': 'metro',
    'metros': 'metros',
    'km': 'km',
    'kilometros': 'kilómetros',
    'in': 'in',
    'inch': 'inch',
    'pulgadas': 'pulgadas',
    'pulgada': 'pulgada',
    'ft': 'ft',
    'pie': 'pie',
    'pies': 'pies',
    'feet': 'feet',
    'yd': 'yd',
    'yarda': 'yarda',
    'yardas': 'yardas',
    'yard': 'yard',
    'unidad': 'unidad',
    'unidades': 'unidades',
    'ud': 'ud',
    'u': 'u',
    'pieza': 'pieza',
    'piezas': 'piezas',
    'pza': 'pza',
    'docena': 'docena',
    'docenas': 'docenas',
    'dz': 'dz',
    'caja': 'caja',
    'cajas': 'cajas',
    'paquete': 'paquete',
    'paquetes': 'paquetes',
    'botella': 'botella',
    'botellas': 'botellas',
    'lata': 'lata',
    'latas': 'latas',
    'six pack': 'six pack',
    'sixpack': 'sixpack',
  };

  return commonNames[normalizedUnit] || unit;
}
