import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Save as SaveIcon, CalendarDays, PieChart, Calculator } from "lucide-react";
import { db } from "../../firebase/firebase.js";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";

/* ================= Utils ================= */
const CLP = (n) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));

const num = (v) => {
  const n = Number(String(v ?? 0).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const MS = 86400000;
const d0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const d1 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const parseISO = (s) => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const overlapDays = (a1, a2, b1, b2) => {
  const s = d0(a1 > b1 ? a1 : b1);
  const e = d1(a2 < b2 ? a2 : b2);
  return e < s ? 0 : Math.round((e - s) / MS) + 1;
};
const lastN = (n) => {
  const end = d1(new Date());
  const start = d0(new Date(Date.now() - (n - 1) * MS));
  return { start, end };
};
const monthRange = () => {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: d1(now) };
};

/* Unidades y conversión */
const normalizeUnit = (u = "") => {
  const s = String(u).trim().toLowerCase();
  if (["g", "gramo", "gramos"].includes(s)) return "g";
  if (["kg", "kilo", "kilogramo", "kilogramos"].includes(s)) return "kg";
  if (["ml", "mililitro", "mililitros"].includes(s)) return "ml";
  if (["l", "lt", "litro", "litros"].includes(s)) return "litros";
  if (["unidad", "unidades", "u"].includes(s)) return "unidades";
  if (["paquete", "paquetes", "pack"].includes(s)) return "paquetes";
  return s || "unidades";
};
const isMass = (u) => ["g", "kg"].includes(normalizeUnit(u));
const isVol = (u) => ["ml", "litros"].includes(normalizeUnit(u));
const convertQty = (q, fromU, toU) => {
  const v = Number(q) || 0;
  const f = normalizeUnit(fromU);
  const t = normalizeUnit(toU);
  if (f === t) return v;
  if (isMass(f) && isMass(t)) {
    if (f === "g" && t === "kg") return v / 1000;
    if (f === "kg" && t === "g") return v * 1000;
  }
  if (isVol(f) && isVol(t)) {
    if (f === "ml" && t === "litros") return v / 1000;
    if (f === "litros" && t === "ml") return v * 1000;
  }
  return v;
};

// % o monto
const val = (modo, valor, base) =>
  String(modo) === "porcentaje" ? (num(valor) / 100) * num(base) : num(valor);

/* Limpia historial: elimina ceros y duplicados exactos por fecha+valores */
const cleanHist = (hist = []) => {
  const arr = Array.isArray(hist) ? [...hist] : [];
  arr.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const nonZero = arr.filter((h) => {
    const pv = num(h.precioVenta);
    const cf = num(h.costoFinal);
    const u = num(h.valorUtilidad);
    const iva = num(h.valorIVA);
    return pv !== 0 || cf !== 0 || u !== 0 || iva !== 0;
  });

  const compact = [];
  for (const h of nonZero) {
    const last = compact[compact.length - 1];
    const same =
      last &&
      String(last.fecha) === String(h.fecha) &&
      num(last.precioVenta) === num(h.precioVenta) &&
      num(last.costoFinal) === num(h.costoFinal) &&
      num(last.valorUtilidad) === num(h.valorUtilidad) &&
      num(last.valorIVA) === num(h.valorIVA);
    if (!same) compact.push(h);
  }
  return compact;
};

/* ===== NUEVA LÓGICA PARA PORCIONES ===== */
const calcularPorciones = (producto) => {
  if (!producto?.seDividePorPorciones) {
    return { numeroPorciones: 1, esAutomatico: false };
  }

  if (producto.tipoPortionado === 'automatico') {
    const pesoTotal = num(producto.cantidad);
    const pesoPorcion = num(producto.pesoPorcion);

    if (pesoPorcion > 0) {
      let pesoTotalGramos = pesoTotal;
      let pesoPorcionGramos = pesoPorcion;

      if (producto.unidad === 'kg') pesoTotalGramos *= 1000;
      if (producto.unidadPesoPortionado === 'kg') pesoPorcionGramos *= 1000;

      const porciones = Math.floor(pesoTotalGramos / pesoPorcionGramos);
      return { numeroPorciones: Math.max(1, porciones), esAutomatico: true };
    }
  }

  return {
    numeroPorciones: Math.max(1, num(producto.numeroPorciones || 1)),
    esAutomatico: false
  };
};

/* ================= Componente ================= */
export default function ProductHistory({ productId: propId }) {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const [sp] = useSearchParams();
  const productId = propId || paramId || sp.get("id") || null;

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState(null);
  const [note, setNote] = useState("");

  // parámetros editables - INCLUYE costoBase
  const [form, setForm] = useState({
    costoBase: 0, // IMPORTANTE: Campo editable para el costo base
    costoOperativo: 0,
    costoOperativoTipo: "porcentaje",
    personal: 0,
    personalTipo: "porcentaje",
    otros: 0,
    otrosTipo: "porcentaje",
    utilidad: 0,
    utilidadTipo: "porcentaje",
    iva: 19,
  });

  // mapa { insumoId: { costoUnitario, unidad, ... } }
  const [insumoMap, setInsumoMap] = useState({});

  // ---- Listener del producto
  useEffect(() => {
    if (!productId) return;
    const ref = doc(db, "productos", productId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setP({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub && unsub();
  }, [productId]);

  // ---- Listeners de insumos usados (tiempo real)
  useEffect(() => {
    if (!Array.isArray(p?.receta) || p.receta.length === 0) {
      setInsumoMap({});
      return;
    }
    const ids = Array.from(
      new Set(
        p.receta
          .map((r) => String(r?.id ?? r?.insumoId ?? "").trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) {
      setInsumoMap({});
      return;
    }
    const unsubs = ids.map((id) =>
      onSnapshot(doc(db, "insumos", id), (snap) => {
        setInsumoMap((prev) => ({
          ...prev,
          [id]: snap.exists() ? snap.data() : null,
        }));
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [p?.receta]);

  /* ===== Costo base calculado de receta (solo para mostrar como referencia) ===== */
  const costoBaseReceta = useMemo(() => {
    if (!Array.isArray(p?.receta) || p.receta.length === 0) {
      return 0;
    }

    let total = 0;
    let any = false;

    for (const r of p.receta) {
      const qty = num(
        r?.cantidadReceta ??
        r?.cantidadIngresada ??
        r?.cantidad ??
        r?.cantidadBase ??
        0
      );
      if (!qty) continue;

      const insId = String(r?.id ?? r?.insumoId ?? "").trim();
      const unitUsed = r?.unidadIngresada ?? r?.unidadSel ?? r?.unidad ?? r?.unidadBase ?? "unidades";
      const ins = insumoMap[insId];

      if (ins && ins.costoUnitario != null) {
        const unitPriceUnit = ins?.unidad || "unidades";
        const qtyConv = convertQty(qty, unitUsed, unitPriceUnit);
        total += qtyConv * num(ins.costoUnitario);
        any = true;
      } else if (r?.costoUnitarioBase != null) {
        const priceUnitUnit = r?.unidadBase ?? r?.unidad ?? unitUsed;
        const qtyConv = convertQty(qty, unitUsed, priceUnitUnit);
        total += qtyConv * num(r.costoUnitarioBase);
        any = true;
      } else if (r?.costoUnitario != null) {
        total += qty * num(r.costoUnitario);
        any = true;
      }
    }

    return Math.round(total);
  }, [p?.receta, insumoMap]);

  // Sync form con el producto - INCLUYE costoBase
  useEffect(() => {
    if (!p) return;
    setForm({
      costoBase: num(p.costoBase ?? 0), // Sincronizar costo base
      costoOperativo: num(p.costoOperativo ?? p.costoOperativoPorProducto ?? 0),
      costoOperativoTipo: String(p.modoCostoOperativo ?? p.costoOperativoTipo ?? "porcentaje"),
      personal: num(p.personal ?? 0),
      personalTipo: String(p.modoPersonal ?? p.personalTipo ?? "porcentaje"),
      otros: num(p.otros ?? 0),
      otrosTipo: String(p.modoOtros ?? p.otrosTipo ?? "porcentaje"),
      utilidad: num(p.utilidad ?? 0),
      utilidadTipo: String(p.modoUtilidad ?? p.utilidadTipo ?? "porcentaje"),
      iva: num(p.iva ?? 19),
    });
  }, [p]);

  // Auto-sync con el costo calculado de receta cuando cambian los insumos
  useEffect(() => {
    if (p?.tieneReceta === true && costoBaseReceta > 0) {
      const diff = Math.abs(costoBaseReceta - num(form.costoBase));
      if (diff > 100 || (form.costoBase > 0 && diff / form.costoBase > 0.1)) {
        setForm(f => ({ ...f, costoBase: costoBaseReceta }));
      }
    }
  }, [costoBaseReceta, p?.tieneReceta]);

  /* ===== CÁLCULO DE PORCIONES ===== */
  const { numeroPorciones, esAutomatico } = useMemo(() => calcularPorciones(p), [p]);

  /* ===== Historial (limpio) ===== */
  const histAscClean = useMemo(() => cleanHist(p?.historial), [p?.historial]);

  /* ===== PPP costo (ponderado por días) ===== */
  const pppCosto = useMemo(() => {
    if (!histAscClean.length) return { d7: 0, d30: 0, d90: 0, mtd: 0 };
    const segs = [];
    const today = new Date();
    for (let i = 0; i < histAscClean.length; i++) {
      const h = histAscClean[i];
      const start = parseISO(h.fecha) || today;
      const next = i < histAscClean.length - 1 ? parseISO(histAscClean[i + 1].fecha) : null;
      const end = next ? new Date(next.getTime() - 1) : today;
      segs.push({ start: d0(start), end: d1(end), costo: num(h.costoFinal) });
    }
    const avg = (s, e) => {
      let wsum = 0, w = 0;
      for (const g of segs) {
        const od = overlapDays(g.start, g.end, s, e);
        if (od > 0) {
          wsum += g.costo * od;
          w += od;
        }
      }
      return w ? Math.round(wsum / w) : 0;
    };
    const { start: s7, end: e7 } = lastN(7);
    const { start: s30, end: e30 } = lastN(30);
    const { start: s90, end: e90 } = lastN(90);
    const { start: sm, end: em } = monthRange();
    return { d7: avg(s7, e7), d30: avg(s30, e30), d90: avg(s90, e90), mtd: avg(sm, em) };
  }, [histAscClean]);

  /* ===== PPP COSTO POR PORCIÓN ===== */
  const pppCostoPorcion = useMemo(() => ({
    d7: Math.round(pppCosto.d7 / numeroPorciones),
    d30: Math.round(pppCosto.d30 / numeroPorciones),
    d90: Math.round(pppCosto.d90 / numeroPorciones),
    mtd: Math.round(pppCosto.mtd / numeroPorciones),
  }), [pppCosto, numeroPorciones]);
  /* ===== Costo base - SIEMPRE usa el valor del form para el cálculo ===== */
  const baseLive = useMemo(() => {
    return Math.round(num(form.costoBase || 0));
  }, [form.costoBase]);

  /* ===== Cálculo en vivo ===== */
  const calc = useMemo(() => {
    const base = baseLive;
    const op = val(form.costoOperativoTipo, form.costoOperativo, base);
    const per = val(form.personalTipo, form.personal, base);
    const otros = val(form.otrosTipo, form.otros, base);
    const totalNoRound = base + op + per + otros;
    const total = Math.round(totalNoRound);
    const util = val(form.utilidadTipo, form.utilidad, totalNoRound);
    const subtotal = totalNoRound + util;
    const IVA = Math.round((num(form.iva) / 100) * subtotal);
    const sugerido = Math.max(Math.round(subtotal + IVA), total);

    const costoPorPorcion = Math.round(total / numeroPorciones);
    const precioPorPorcion = Math.round(sugerido / numeroPorciones);

    return {
      base: Math.round(base),
      op: Math.round(op),
      per: Math.round(per),
      otros: Math.round(otros),
      total,
      util: Math.round(util),
      IVA,
      sugerido,
      costoPorPorcion,
      precioPorPorcion,
    };
  }, [baseLive, form, numeroPorciones]);

  /* ===== Guardar ===== */
  const savingRef = useRef(false);

  const lastEntry = (histAsc) => (histAsc.length ? histAsc[histAsc.length - 1] : null);

  const sameAs = (a, c) =>
    a &&
    num(a.costoFinal) === c.total &&
    num(a.valorUtilidad) === c.util &&
    num(a.valorIVA) === c.IVA &&
    num(a.precioVenta) === c.sugerido;

  const handleGuardar = async () => {
    if (!p?.id || savingRef.current) return;
    savingRef.current = true;
    try {
      const ref = doc(db, "productos", p.id);
      const hoy = new Date().toISOString().slice(0, 10);

      const clean = cleanHist(p?.historial);
      const last = lastEntry(clean);

      const addNew = !sameAs(last, calc);
      const newHist = addNew
        ? [
          ...clean,
          {
            fecha: hoy,
            precioVenta: calc.sugerido,
            costoFinal: calc.total,
            costoBase: calc.base,
            valorUtilidad: calc.util,
            valorIVA: calc.IVA,
            numeroPorciones,
            costoPorPorcion: calc.costoPorPorcion,
            precioPorPorcion: calc.precioPorPorcion,
          },
        ]
        : clean;

      await updateDoc(ref, {
        costoBase: calc.base,
        costoOperativo: num(form.costoOperativo),
        modoCostoOperativo: String(form.costoOperativoTipo || "porcentaje"),
        personal: num(form.personal),
        modoPersonal: String(form.personalTipo || "porcentaje"),
        otros: num(form.otros),
        modoOtros: String(form.otrosTipo || "porcentaje"),
        utilidad: num(form.utilidad),
        modoUtilidad: String(form.utilidadTipo || "porcentaje"),
        iva: num(form.iva),
        costoFinal: calc.total,
        valorUtilidad: calc.util,
        valorIVA: calc.IVA,
        precioVenta: calc.sugerido,
        numeroPorciones,
        costoPorPorcion: calc.costoPorPorcion,
        precioPorPorcion: calc.precioPorPorcion,
        historial: newHist,
      });

      setNote(addNew ? "Guardado ✅ Se agregó una nueva entrada." : "Sin cambios para guardar.");
    } catch (e) {
      console.error(e);
      setNote("No se pudo guardar. Revisa tu conexión.");
    } finally {
      savingRef.current = false;
    }
  };

  /* ================= UI ================= */
  if (!productId) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Historial</h1>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-black shadow-md hover:bg-black focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg text-gray-800">
            No se indicó ningún producto.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              {p?.nombre || p?.producto || "Producto"}
            </h1>
            {p?.cantidad != null && (
              <p className="text-sm text-gray-600">
                {p.cantidad} {p.unidad || "unidades"}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-black shadow-md hover:bg-black focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
        </div>

        {/* SECCIÓN DE PORCIONES */}
        {p?.seDividePorPorciones && (
          <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-6 h-6 text-orange-600" />
              <h2 className="text-lg font-bold text-gray-900">División por porciones</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 border border-orange-200">
                <div className="text-xs text-orange-700 font-medium">Total de porciones</div>
                <div className="text-2xl font-extrabold text-orange-600">{numeroPorciones}</div>
                {esAutomatico && (
                  <div className="text-xs text-gray-600 mt-1">
                    Calculado por peso ({p.pesoPorcion}{p.unidadPesoPortionado} c/u)
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 border border-orange-200">
                <div className="text-xs text-orange-700 font-medium">Costo por porción HOY</div>
                <div className="text-2xl font-extrabold text-gray-900">{CLP(calc.costoPorPorcion)}</div>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-4">
                <div className="text-xs text-orange-100 font-medium">Precio por porción HOY</div>
                <div className="text-2xl font-extrabold text-white">{CLP(calc.precioPorPorcion)}</div>
              </div>
            </div>
          </section>
        )}

        {/* Parámetros / cálculo */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xl">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Parámetros de costo</h2>

          {/* CAMPO DE COSTO BASE EDITABLE Y IVA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {/* Costo base siempre editable */}
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Costo base {p?.tieneReceta === true && p?.receta?.length > 0 ? "(sugerido de receta)" : ""}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none"
                  value={form.costoBase}
                  onChange={(e) => setForm((f) => ({ ...f, costoBase: e.target.value }))}
                  placeholder="0"
                />
                <span className="rounded-xl border-2 border-gray-200 bg-gray-100 px-3 py-2 text-gray-900">
                  $
                </span>
              </div>
              {p?.tieneReceta === true && p?.receta?.length > 0 && (
                <div className="mt-1 text-xs text-gray-600">
                  Calculado de receta: {CLP(costoBaseReceta)}
                </div>
              )}
            </div>

            {/* IVA */}
            <div>
              <label className="mb-1 block text-xs text-gray-500">IVA</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none"
                  value={form.iva}
                  onChange={(e) => setForm((f) => ({ ...f, iva: e.target.value }))}
                />
                <span className="rounded-xl border-2 border-gray-200 bg-gray-100 px-3 py-2 text-gray-900">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Otros campos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Costo operativo", key: "costoOperativo", tipo: "costoOperativoTipo" },
              { label: "Personal", key: "personal", tipo: "personalTipo" },
              { label: "Otros gastos", key: "otros", tipo: "otrosTipo" },
              { label: "Utilidad", key: "utilidad", tipo: "utilidadTipo" },
            ].map((r) => (
              <div key={r.key}>
                <label className="mb-1 block text-xs text-gray-500">{r.label}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none"
                    value={form[r.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [r.key]: e.target.value }))}
                  />
                  <select
                    className="rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none"
                    value={form[r.tipo]}
                    onChange={(e) => setForm((f) => ({ ...f, [r.tipo]: e.target.value }))}
                  >
                    <option value="porcentaje">%</option>
                    <option value="monto">$</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <div className="text-xs text-gray-500">Costo total HOY</div>
              <div className="mt-0.5 text-2xl font-extrabold text-gray-900">{CLP(calc.total)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-white">
              <div className="text-xs text-gray-500">Impuesto (IVA)</div>
              <div className="mt-0.5 text-xl font-bold text-gray-900">{CLP(calc.IVA)}</div>
            </div>
            <div className="rounded-xl border border-orange-200 p-3 bg-gradient-to-r from-orange-500 to-orange-600">
              <div className="text-xs text-orange-100">Precio sugerido HOY</div>
              <div className="mt-0.5 text-2xl font-extrabold text-white drop-shadow-sm">
                {CLP(calc.sugerido)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-700">{note}</span>
            <button
              onClick={handleGuardar}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-black shadow-md hover:bg-black focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
              title="Guardar cambios y registrar en historial"
            >
              <SaveIcon className="w-4 h-4" />
              Guardar en historial
            </button>
          </div>
        </section>

        {/* Continúa con PPP COSTO e Historial... */}
        {/* PPP COSTO */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xl">
          <h2 className="text-lg font-bold text-gray-900 mb-3">PPP Costo (promedio ponderado por días)</h2>

          {/* Costo total */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Producto completo</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs text-gray-700">7 días</div>
                <div className="text-lg font-bold text-gray-900">{CLP(pppCosto.d7)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs text-gray-700">30 días</div>
                <div className="text-lg font-bold text-gray-900">{CLP(pppCosto.d30)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs text-gray-700">90 días</div>
                <div className="text-lg font-bold text-gray-900">{CLP(pppCosto.d90)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs text-gray-700">Mes actual</div>
                <div className="text-lg font-bold text-gray-900">{CLP(pppCosto.mtd)}</div>
              </div>
            </div>
          </div>

          {/* Costo por porción */}
          {p?.seDividePorPorciones && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-orange-600" />
                Por porción ({numeroPorciones} porciones)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="text-xs text-orange-700">7 días</div>
                  <div className="text-lg font-bold text-orange-900">{CLP(pppCostoPorcion.d7)}</div>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="text-xs text-orange-700">30 días</div>
                  <div className="text-lg font-bold text-orange-900">{CLP(pppCostoPorcion.d30)}</div>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="text-xs text-orange-700">90 días</div>
                  <div className="text-lg font-bold text-orange-900">{CLP(pppCostoPorcion.d90)}</div>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="text-xs text-orange-700">Mes actual</div>
                  <div className="text-lg font-bold text-orange-900">{CLP(pppCostoPorcion.mtd)}</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Historial */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xl">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Historial</h2>
          {loading ? (
            <div className="text-gray-700">Cargando…</div>
          ) : !histAscClean.length ? (
            <div className="text-gray-700">Aún no hay entradas.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {[...histAscClean].reverse().map((h, i) => (
                <li key={`${h.fecha}-${i}`} className="py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CalendarDays className="w-4 h-4 text-gray-500" />
                    <span>{h.fecha}</span>
                    <span className="ml-auto font-semibold text-gray-900">
                      {CLP(h.precioVenta)}
                    </span>
                  </div>

                  {/* Datos principales */}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                    <div className="rounded-xl border border-gray-200 px-3 py-2 bg-white">
                      <span className="text-gray-500">Costo</span>
                      <div className="font-semibold text-gray-900">{CLP(h.costoFinal)}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 px-3 py-2 bg-white">
                      <span className="text-gray-500">Utilidad</span>
                      <div className="font-semibold text-gray-900">{CLP(h.valorUtilidad)}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 px-3 py-2 bg-white">
                      <span className="text-gray-500">IVA</span>
                      <div className="font-semibold text-gray-900">{CLP(h.valorIVA)}</div>
                    </div>
                  </div>

                  {/* Datos por porción (si existen) */}
                  {h.numeroPorciones > 1 && h.costoPorPorcion && h.precioPorPorcion && (
                    <div className="mt-2 p-3 bg-orange-50 rounded-xl border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <PieChart className="w-3 h-3 text-orange-600" />
                        <span className="text-xs font-medium text-orange-700">
                          {h.numeroPorciones} porciones
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[12px]">
                        <div className="text-center">
                          <div className="text-orange-600 font-medium">Costo c/u</div>
                          <div className="font-bold text-orange-900">{CLP(h.costoPorPorcion)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-orange-600 font-medium">Precio c/u</div>
                          <div className="font-bold text-orange-900">{CLP(h.precioPorPorcion)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}