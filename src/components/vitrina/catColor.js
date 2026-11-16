// src/components/vitrina/catColor.js
// Color por categoría para la Vitrina (equivalente a catColor del prototipo).

const CAT_COLORS = {
  Bebidas: '#2563eb',
  Snacks: '#d9822b',
  Panadería: '#c9820f',
  Lácteos: '#3f7fd6',
  Abarrotes: '#16915b',
  Aseo: '#7c3aed',
  Carnes: '#c0392b',
  'Frutas y Verduras': '#27ae60',
  Congelados: '#2980b9',
};

export function catColor(cat) {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat];
  let h = 0;
  for (let i = 0; i < (cat || '').length; i += 1) h = (h * 31 + cat.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 48%)`;
}
