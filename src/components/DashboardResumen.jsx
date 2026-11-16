// src/pages/DashboardResumen.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  TrendingUp,
  Percent,
  CheckCircle,
  Calendar,
  Activity,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ⬇️ ajusta esta ruta a tu firebase
import { db } from "../firebase/firebase";
// Firestore
import { collection, onSnapshot } from "firebase/firestore";

// (Recomendado abrir el wizard en su ruta /costeo para evitar conflicto de layout full-screen)
function WizardLauncher() {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-6 sm:p-8 shadow-xl">
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white shadow-md border border-orange-200">
            <Calculator className="h-7 w-7 text-orange-600" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-neutral-900">
              Asistente de Costeo
            </h3>
            <p className="text-sm text-neutral-700">
              Calcula precio de venta en 5 pasos. Registra historial automático.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate("/costeo")}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-black hover:bg-neutral-900 shadow-md focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          Abrir asistente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ====================== Utils ====================== */

const CLP = (n) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));

// fecha "YYYY-MM-DD" -> Date (local, día)
const parseISO = (s) => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

function buildRealtimeFeed(snapshotDocs) {
  // Construye una lista con las entradas de historial de TODOS los productos
  // y calcula delta vs la entrada anterior del mismo producto.
  const items = [];

  snapshotDocs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const nombre =
      data.producto || data.nombre || "(sin nombre)";
    const historial = Array.isArray(data.historial) ? [...data.historial] : [];

    // ordenar por fecha asc para poder calcular delta
    historial.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    for (let i = 0; i < historial.length; i++) {
      const h = historial[i];
      const prev = i > 0 ? historial[i - 1] : null;
      const precio = Number(h.precioVenta) || 0;
      const prevPrecio = Number(prev?.precioVenta) || precio;
      const delta = precio - prevPrecio;

      const dt = parseISO(h.fecha) || new Date(0);

      items.push({
        key: `${docSnap.id}-${h.fecha}-${i}`,
        productId: docSnap.id,
        nombre,
        fecha: h.fecha,
        dt,
        precioVenta: precio,
        costoFinal: Number(h.costoFinal) || 0,
        delta,
      });
    }
  });

  // más recientes primero
  items.sort((a, b) => b.dt - a.dt);
  return items.slice(0, 15); // top 15 eventos
}

/* ====================== Componente ====================== */

function DashboardResumen() {
  const [currentDate, setCurrentDate] = useState(
    new Date().toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  // Actualiza fecha visual cada minuto (cosmético)
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentDate(
        new Date().toLocaleDateString("es-CL", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // ======== Actividad reciente (tiempo real) ========
  const [feed, setFeed] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snap) => {
      setFeed(buildRealtimeFeed(snap.docs));
      setLoaded(true);
    });
    return () => unsub && unsub();
  }, []);

  // número de cambios "hoy"
  const todayStr = new Date().toISOString().slice(0, 10);
  const cambiosHoy = useMemo(
    () => feed.filter((f) => f.fecha === todayStr).length,
    [feed, todayStr]
  );

  // tarjetas principales (SIN facturas, SIN costo variable)
  const topCards = [
    {
      title: "IVA Chile",
      value: "19%",
      sub: "Vigente",
      icon: Percent,
      color: "from-green-500 to-emerald-600",
      pill: "Actual",
    },
    {
      title: "Margen Promedio",
      value: "25–35%",
      sub: "Referencia retail",
      icon: TrendingUp,
      color: "from-orange-500 to-amber-600",
      pill: "Sugerido",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-orange-50 via-white to-neutral-50">
      <div className="w-full px-6 py-6 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 mb-1">
                Panel de Costeo
              </h1>
              
              <p className="text-neutral-700">
                Precios, utilidad e historial en tiempo real.
              </p>
              <div className="flex items-center gap-2 mt-3 text-sm text-neutral-600">
                <Calendar className="h-4 w-4" />
                <span>Actualizado: {currentDate}</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-4 rounded-xl shadow-lg">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">IVA Chile</span>
                </div>
                <div className="text-2xl font-extrabold">19%</div>
                <div className="text-emerald-100 text-xs">Vigente</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topCards.map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6 hover:shadow-2xl transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} shadow-md`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-200">
                  {card.pill}
                </span>
              </div>
              <h3 className="text-neutral-600 font-medium">{card.title}</h3>
              <div className="text-2xl font-extrabold text-neutral-900">{card.value}</div>
              <p className="text-sm text-neutral-500 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Actividad reciente (tiempo real) */}
        <section className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-black">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900">
                Actividad reciente (en vivo)
              </h2>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Cambios hoy: {cambiosHoy}
            </span>
          </div>

          {!loaded ? (
            <div className="text-neutral-700">Cargando actividad…</div>
          ) : !feed.length ? (
            <div className="text-neutral-700">
              Aún no hay movimientos. Guarda algún producto desde el asistente para ver cambios aquí.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {feed.map((it) => (
                <li key={it.key} className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {it.nombre}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {it.fecha}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-600">
                        Costo: <span className="font-medium text-neutral-800">{CLP(it.costoFinal)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {it.delta > 0 ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                          ↑ +{CLP(Math.abs(it.delta))}
                        </span>
                      ) : it.delta < 0 ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                          ↓ -{CLP(Math.abs(it.delta))}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                          = sin cambio
                        </span>
                      )}

                      <div className="text-right">
                        <div className="text-xs text-neutral-500 leading-none">
                          Precio actual
                        </div>
                        <div className="text-sm font-extrabold text-neutral-900">
                          {CLP(it.precioVenta)}
                        </div>
                      </div>

                      <a
                        href={`/historial/${it.productId}`}
                        className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-900"
                        title="Ver historial"
                      >
                        Ver historial
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Lanzador del ProductCostingWizard (abajo) */}
        <WizardLauncher />
      </div>
    </div>
  );
}

export default DashboardResumen;
