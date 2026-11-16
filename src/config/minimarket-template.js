// src/config/minimarket-template.js
// Catálogo base de productos típicos de un minimarket, para que un negocio
// nuevo no parta de cero. Se descarga como Excel desde el importador
// (ImportExcelModal) con las columnas que ese importador ya entiende.
//
// Nombres genéricos a propósito (sin marcas) y SIN precios ni stock: el dueño
// completa costo, precio de venta y cantidades, y agrega la marca que venda.
// No incluye tabaco ni alcohol fuerte: dependen de patente y de cada local.
//
// Formato: [nombre, categoría, unidad]
// Unidad 'kg' => en caja se pide el peso al vender (ver isWeightUnit en InventoryExit).

export const MINIMARKET_COLUMNS = [
  'Nombre', 'SKU', 'Categoría', 'Unidad', 'Stock', 'Precio Costo', 'Precio Venta', 'Proveedor',
];

const PRODUCTS = [
  // Bebidas
  ['Bebida cola 1,5 L', 'Bebidas', 'unidad'],
  ['Bebida cola 500 ml', 'Bebidas', 'unidad'],
  ['Bebida cola 3 L', 'Bebidas', 'unidad'],
  ['Bebida cola lata 350 ml', 'Bebidas', 'unidad'],
  ['Bebida sabor naranja 1,5 L', 'Bebidas', 'unidad'],
  ['Bebida sabor lima-limón 1,5 L', 'Bebidas', 'unidad'],
  ['Agua mineral sin gas 500 ml', 'Bebidas', 'unidad'],
  ['Agua mineral con gas 500 ml', 'Bebidas', 'unidad'],
  ['Agua mineral 1,5 L', 'Bebidas', 'unidad'],
  ['Jugo en caja 1 L', 'Bebidas', 'unidad'],
  ['Jugo en polvo sobre', 'Bebidas', 'unidad'],
  ['Bebida energética lata', 'Bebidas', 'unidad'],
  ['Bebida isotónica 500 ml', 'Bebidas', 'unidad'],
  ['Té helado 1,5 L', 'Bebidas', 'unidad'],

  // Cervezas y vinos
  ['Cerveza lata 470 ml', 'Cervezas y vinos', 'unidad'],
  ['Cerveza botella 1 L', 'Cervezas y vinos', 'unidad'],
  ['Cerveza pack 6 latas', 'Cervezas y vinos', 'unidad'],
  ['Vino tinto 750 ml', 'Cervezas y vinos', 'unidad'],
  ['Vino blanco 750 ml', 'Cervezas y vinos', 'unidad'],

  // Panadería
  ['Pan marraqueta', 'Panadería', 'kg'],
  ['Pan hallulla', 'Panadería', 'kg'],
  ['Pan de molde blanco', 'Panadería', 'unidad'],
  ['Pan de molde integral', 'Panadería', 'unidad'],
  ['Pan para completos', 'Panadería', 'unidad'],
  ['Tortillas de rescoldo', 'Panadería', 'unidad'],

  // Lácteos y huevos
  ['Leche entera 1 L', 'Lácteos y huevos', 'unidad'],
  ['Leche descremada 1 L', 'Lácteos y huevos', 'unidad'],
  ['Leche con chocolate individual', 'Lácteos y huevos', 'unidad'],
  ['Yogurt individual', 'Lácteos y huevos', 'unidad'],
  ['Yogurt 1 L', 'Lácteos y huevos', 'unidad'],
  ['Mantequilla 250 g', 'Lácteos y huevos', 'unidad'],
  ['Margarina 250 g', 'Lácteos y huevos', 'unidad'],
  ['Crema de leche', 'Lácteos y huevos', 'unidad'],
  ['Huevos (unidad)', 'Lácteos y huevos', 'unidad'],
  ['Huevos bandeja 30 unidades', 'Lácteos y huevos', 'unidad'],
  ['Queso laminado', 'Lácteos y huevos', 'kg'],
  ['Queso gouda', 'Lácteos y huevos', 'kg'],
  ['Queso fresco', 'Lácteos y huevos', 'kg'],

  // Fiambrería
  ['Jamón', 'Fiambrería', 'kg'],
  ['Mortadela', 'Fiambrería', 'kg'],
  ['Salchichas paquete', 'Fiambrería', 'unidad'],
  ['Longaniza', 'Fiambrería', 'kg'],

  // Abarrotes
  ['Arroz 1 kg', 'Abarrotes', 'unidad'],
  ['Fideos 400 g', 'Abarrotes', 'unidad'],
  ['Azúcar 1 kg', 'Abarrotes', 'unidad'],
  ['Sal 1 kg', 'Abarrotes', 'unidad'],
  ['Harina 1 kg', 'Abarrotes', 'unidad'],
  ['Aceite vegetal 1 L', 'Abarrotes', 'unidad'],
  ['Aceite de oliva 500 ml', 'Abarrotes', 'unidad'],
  ['Lentejas 1 kg', 'Abarrotes', 'unidad'],
  ['Porotos 1 kg', 'Abarrotes', 'unidad'],
  ['Atún en lata', 'Abarrotes', 'unidad'],
  ['Conserva de choclo', 'Abarrotes', 'unidad'],
  ['Salsa de tomate', 'Abarrotes', 'unidad'],
  ['Mayonesa', 'Abarrotes', 'unidad'],
  ['Ketchup', 'Abarrotes', 'unidad'],
  ['Mostaza', 'Abarrotes', 'unidad'],
  ['Café instantáneo', 'Abarrotes', 'unidad'],
  ['Té en bolsitas', 'Abarrotes', 'unidad'],
  ['Mermelada', 'Abarrotes', 'unidad'],
  ['Cereal de desayuno', 'Abarrotes', 'unidad'],

  // Snacks y dulces
  ['Papas fritas bolsa', 'Snacks y dulces', 'unidad'],
  ['Papas fritas bolsa grande', 'Snacks y dulces', 'unidad'],
  ['Maní salado', 'Snacks y dulces', 'unidad'],
  ['Galletas dulces', 'Snacks y dulces', 'unidad'],
  ['Galletas saladas', 'Snacks y dulces', 'unidad'],
  ['Chocolate barra', 'Snacks y dulces', 'unidad'],
  ['Alfajor', 'Snacks y dulces', 'unidad'],
  ['Chicles', 'Snacks y dulces', 'unidad'],
  ['Caramelos bolsa', 'Snacks y dulces', 'unidad'],
  ['Helado individual', 'Snacks y dulces', 'unidad'],

  // Frutas y verduras
  ['Plátano', 'Frutas y verduras', 'kg'],
  ['Manzana', 'Frutas y verduras', 'kg'],
  ['Tomate', 'Frutas y verduras', 'kg'],
  ['Cebolla', 'Frutas y verduras', 'kg'],
  ['Papa', 'Frutas y verduras', 'kg'],
  ['Limón', 'Frutas y verduras', 'kg'],
  ['Palta', 'Frutas y verduras', 'kg'],

  // Congelados
  ['Hamburguesas congeladas', 'Congelados', 'unidad'],
  ['Papas pre-fritas congeladas', 'Congelados', 'unidad'],
  ['Pollo congelado', 'Congelados', 'kg'],
  ['Hielo bolsa', 'Congelados', 'unidad'],

  // Aseo y limpieza
  ['Detergente en polvo', 'Aseo y limpieza', 'unidad'],
  ['Lavalozas', 'Aseo y limpieza', 'unidad'],
  ['Cloro 1 L', 'Aseo y limpieza', 'unidad'],
  ['Limpiador multiuso', 'Aseo y limpieza', 'unidad'],
  ['Esponja de cocina', 'Aseo y limpieza', 'unidad'],
  ['Bolsas de basura', 'Aseo y limpieza', 'unidad'],

  // Higiene personal
  ['Papel higiénico 4 rollos', 'Higiene personal', 'unidad'],
  ['Toalla de papel', 'Higiene personal', 'unidad'],
  ['Servilletas', 'Higiene personal', 'unidad'],
  ['Jabón de tocador', 'Higiene personal', 'unidad'],
  ['Shampoo', 'Higiene personal', 'unidad'],
  ['Pasta dental', 'Higiene personal', 'unidad'],
  ['Cepillo de dientes', 'Higiene personal', 'unidad'],
  ['Desodorante', 'Higiene personal', 'unidad'],
  ['Toallas higiénicas', 'Higiene personal', 'unidad'],
  ['Pañales', 'Higiene personal', 'unidad'],

  // Varios
  ['Pilas AA', 'Varios', 'unidad'],
  ['Fósforos', 'Varios', 'unidad'],
  ['Velas', 'Varios', 'unidad'],
  ['Bolsa reutilizable', 'Varios', 'unidad'],
  ['Cargador de celular', 'Varios', 'unidad'],
];

/** Filas listas para XLSX.utils.aoa_to_sheet (encabezado + productos). */
export const getMinimarketTemplateRows = () => [
  MINIMARKET_COLUMNS,
  ...PRODUCTS.map(([name, category, unit]) => [name, '', category, unit, '', '', '', '']),
];

export const MINIMARKET_PRODUCT_COUNT = PRODUCTS.length;
