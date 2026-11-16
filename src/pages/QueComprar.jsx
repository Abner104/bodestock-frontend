// src/pages/QueComprar.jsx
// Qué comprar y qué NO comprar, calculado con las ventas reales del negocio.
// La lógica vive en utils/salesAnalysis.js; esta página solo carga datos y los muestra.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, ShoppingCart, TrendingUp, PackageX, Download, ArrowLeft, Info } from 'lucide-react';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';
import { formatCLP } from '../services/inventory-exits-service';
import { analyzeSales, STATUS } from '../utils/salesAnalysis';

const PERIODS = [7, 30, 60, 90];
const COVERS = [7, 14, 21, 30];

const ABC_STYLE = {
  A: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  B: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  C: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
};

const fmtQty = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const fmtDays = (d) => (Number.isFinite(d) ? (d < 1 ? '<1' : Math.round(d)) : '—');

const mapProduct = (d) => ({
  id: d.id,
  name: d.data().name || '',
  stock: Number(d.data().stock) || 0,
  ppp: Number(d.data().ppp) || 0,
  category: d.data().category || '',
  unit: d.data().unit || 'unidades',
});

export default function QueComprar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exits, setExits] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [days, setDays] = useState(30);
  const [coverDays, setCoverDays] = useState(14);
  const [tab, setTab] = useState('comprar');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const companyId = await getUserCompanyId();
        if (!companyId) throw new Error('No se pudo identificar la empresa');

        // Mismo criterio de "venta válida" que el Dashboard.
        const exitsSnap = await getDocs(
          query(collection(db, `companies/${companyId}/inventory_exits`), orderBy('createdAt', 'desc'), limit(5000))
        );
        const sales = exitsSnap.docs
          .map((d) => {
            const data = d.data();
            return { id: d.id, ...data, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt) };
          })
          .filter((e) => e.status !== 'cancelled' && (e.reason === 'SALE' || (e.reason === 'CREDIT' && e.creditStatus === 'paid')));

        // Productos: inventario legacy + todos los inventarios nuevos.
        const [legacySnap, invsSnap] = await Promise.all([
          getDocs(collection(db, `companies/${companyId}/inventory`)),
          getDocs(collection(db, `companies/${companyId}/inventories`)),
        ]);
        const extra = await Promise.all(
          invsSnap.docs.map((inv) => getDocs(collection(db, `companies/${companyId}/inventories/${inv.id}/products`)))
        );
        const items = [...legacySnap.docs.map(mapProduct), ...extra.flatMap((s) => s.docs.map(mapProduct))];

        if (!cancelled) {
          setExits(sales);
          setInventory(items);
        }
      } catch (e) {
        console.error('Error cargando análisis de compras:', e);
        if (!cancelled) setError('No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const result = useMemo(
    () => analyzeSales({ exits, inventory, days, coverDays }),
    [exits, inventory, days, coverDays]
  );
  const { summary } = result;

  const exportBuyList = () => {
    const rows = result.toBuy.map((r) => ({
      Producto: r.name,
      Categoría: r.category,
      Estado: r.status === STATUS.AGOTADO ? 'Agotado' : 'Por acabarse',
      'Stock actual': r.stock,
      'Venta diaria': Number(r.dailyRate.toFixed(2)),
      'Días de stock': Number.isFinite(r.daysOfStock) ? Math.round(r.daysOfStock) : '',
      'Cantidad sugerida': r.suggestedQty,
      Unidad: r.unit,
      'Costo estimado': r.ppp > 0 ? Math.round(r.ppp * r.suggestedQty) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de compra');
    XLSX.writeFile(wb, `lista-de-compra-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const Card = ({ icon, label, value, hint, tone }) => (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${tone}`}>
        {icon}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
    </div>
  );

  const Pills = ({ options, value, onChange, suffix }) => (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            value === o
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          {o} {suffix}
        </button>
      ))}
    </div>
  );

  const Empty = ({ children }) => (
    <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">{children}</div>
  );

  const tabs = [
    { id: 'comprar', label: `Comprar (${summary.toBuyCount})` },
    { id: 'ranking', label: 'Los que más venden' },
    { id: 'nocomprar', label: `No comprar (${summary.dontBuyCount})` },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">¿Qué comprar?</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Calculado con tus ventas reales de los últimos {summary.days} días.
        </p>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm p-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Período a analizar</p>
            <Pills options={PERIODS} value={days} onChange={setDays} suffix="días" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Quiero stock para</p>
            <Pills options={COVERS} value={coverDays} onChange={setCoverDays} suffix="días" />
          </div>
        </div>

        {!summary.hasSales ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center">
            <Info className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h2 className="font-bold text-slate-900 dark:text-white mb-1">Aún no hay ventas que analizar</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Este reporte se llena solo a medida que vendes. Con una o dos semanas de ventas ya empieza a
              mostrar qué productos reponer primero y cuáles no vale la pena comprar.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <Card
                icon={<TrendingUp className="w-5 h-5" />}
                label="Productos estrella"
                value={`${summary.classACount} de ${summary.productsSold}`}
                hint={`Generan el ${Math.round(summary.classAShare)}% de tus ventas`}
                tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              />
              <Card
                icon={<ShoppingCart className="w-5 h-5" />}
                label="Por reponer"
                value={summary.toBuyCount}
                hint="Agotados o por acabarse"
                tone="bg-blue-500/15 text-blue-600 dark:text-blue-400"
              />
              <Card
                icon={<PackageX className="w-5 h-5" />}
                label="Plata parada"
                value={formatCLP(summary.tiedUpCapital)}
                hint={`En ${summary.dontBuyCount} productos que no rotan`}
                tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto mb-3">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                    tab === t.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'comprar' && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {result.toBuy.length === 0 ? (
                  <Empty>Todo tu stock alcanza para {coverDays} días. No necesitas reponer nada por ahora. 👌</Empty>
                ) : (
                  <>
                    <div className="flex justify-end p-3">
                      <button
                        onClick={exportBuyList}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar lista (Excel)
                      </button>
                    </div>
                    {result.toBuy.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {r.status === STATUS.AGOTADO ? (
                              <span className="text-red-500 font-bold">Agotado</span>
                            ) : (
                              <>Alcanza para <b>{fmtDays(r.daysOfStock)}</b> días</>
                            )}
                            {' · '}vende {fmtQty(r.dailyRate)} {r.unit}/día · stock {fmtQty(r.stock)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Comprar</p>
                          <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                            {fmtQty(r.suggestedQty)} <span className="text-xs font-semibold">{r.unit}</span>
                          </p>
                          {r.ppp > 0 && (
                            <p className="text-[11px] text-slate-500">≈ {formatCLP(r.ppp * r.suggestedQty)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {tab === 'ranking' && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {result.ranking.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 p-3">
                    <span className="w-6 text-center text-xs font-black text-slate-400">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.name}</p>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${ABC_STYLE[r.abc]}`}>{r.abc}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, r.share * 2)}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {fmtQty(r.qty)} {r.unit} vendidos · {r.share.toFixed(1)}% de las ventas
                        {r.marginPct !== null && <> · margen ≈ {Math.round(r.marginPct)}%</>}
                      </p>
                    </div>
                    <p className="font-black text-sm text-slate-900 dark:text-white shrink-0">{formatCLP(r.revenue)}</p>
                  </div>
                ))}
                <p className="text-[11px] text-slate-400 p-3">
                  A = productos que sostienen el 80% de tus ventas · B = el siguiente 15% · C = el resto.
                  El margen usa el costo promedio actual del producto, es una estimación.
                </p>
              </div>
            )}

            {tab === 'nocomprar' && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {result.dontBuy.length === 0 ? (
                  <Empty>No tienes productos parados ni con exceso de stock. 👌</Empty>
                ) : (
                  result.dontBuy.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {r.status === STATUS.SIN_MOVIMIENTO
                            ? `Sin ventas en ${summary.days} días`
                            : `Stock para ${fmtDays(r.daysOfStock)} días de venta`}
                          {' · '}hay {fmtQty(r.stock)} {r.unit}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Plata parada</p>
                        <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                          {r.tiedUpCapital > 0 ? formatCLP(r.tiedUpCapital) : '—'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-4">
              Los cálculos son una guía: considera temporadas, promociones y el plazo de entrega de tu proveedor.
              {summary.effectiveDays < summary.days &&
                ` Tienes ${summary.effectiveDays} días de ventas registradas, así que la precisión mejorará con el tiempo.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
