// src/components/products/helpers.js

export function formatoCLP(num) {
  if (isNaN(num)) return "--";
  return Number(num).toLocaleString("es-CL", { minimumFractionDigits: 0 });
}

// Calcula el valor real de cada campo según modo (porcentaje o monto)
export function getValor(modo, valor, base) {
  if (!valor || isNaN(valor)) return 0;
  if (modo === "porcentaje") {
    return Math.round(Number(base) * (Number(valor) / 100));
  }
  return Math.round(Number(valor));
}

// Devuelve todos los datos listos para guardar en Firestore

export function calcularCostoBaseDeReceta(receta, insumosDisponibles) {
  return (receta || []).reduce((sum, ing) => {
    const insumo = insumosDisponibles.find(i => i.id === (ing.insumoId || ing.id));
    const precioUnitario = insumo ? insumo.costoUnitario : 0;
    return sum + (Number(ing.cantidad) || 0) * precioUnitario;
  }, 0);
}

// helpers.js


export function calcularCamposParaGuardar(row, modos) {
  const costoBase = Number(row.costoBase) || 0;
  const vCostoOperativo = getValor(modos.costoOperativoPorProducto, row.costoOperativoPorProducto, costoBase);
  const vPersonal = getValor(modos.personal, row.personal, costoBase);
  const vOtros = getValor(modos.otros, row.otros, costoBase);
  const costoFinal = costoBase + vCostoOperativo + vPersonal + vOtros;

  const vUtilidad = getValor(modos.utilidad, row.utilidad, costoFinal);
  const subtotalAntesIVA = costoFinal + vUtilidad;
  const vIVA = getValor(modos.iva, row.iva, subtotalAntesIVA);
  const precioVenta = subtotalAntesIVA + vIVA;

  return {
    costoBase,
    costoOperativoPorProducto: Number(row.costoOperativoPorProducto) || 0,
    personal: Number(row.personal) || 0,
    otros: Number(row.otros) || 0,
    utilidad: Number(row.utilidad) || 0,
    iva: Number(row.iva) || 0,
    modoCostoOperativo: modos.costoOperativoPorProducto,
    modoPersonal: modos.personal,
    modoOtros: modos.otros,
    modoUtilidad: modos.utilidad,
    modoIVA: modos.iva,
    costoFinal,
    valorUtilidad: vUtilidad,
    valorIVA: vIVA,
    precioVenta,
  };
}
