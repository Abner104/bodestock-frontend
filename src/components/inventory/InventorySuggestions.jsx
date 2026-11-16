// src/components/inventory/InventorySuggestions.jsx
// Sugerencias del Agente de Inventario para UNA empresa: qué reponer
// (sin stock / stock crítico) y qué no está rotando (capital inmovilizado),
// con análisis opcional por IA -- vive dentro del panel del agente en el
// mapa (SuperAdminAgentRoom.jsx), mismo patrón que Precios y Contabilidad.
// Ver inventoryAgent.js:analyzeInventoryHealth.
import { useState, useEffect } from 'react';
import { analyzeInventoryHealth, getInventoryAIAnalysisCached } from '../../agents/inventoryAgent';
import { useVoiceOutput } from '../../hooks/useVoiceInput';
import { Loader2, AlertTriangle, Sparkles, PackageX, PackageMinus, Search, Volume2, VolumeX } from 'lucide-react';

const formatCLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

export default function InventorySuggestions({ companyId, companyName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('reponer'); // 'reponer' | 'sin_rotacion'
  const [searchText, setSearchText] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: voiceOutputSupported } = useVoiceOutput();

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    analyzeInventoryHealth({ companyId })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => {
        console.error('No se pudo analizar el inventario:', e);
        if (!cancelled) setError(e.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  // El resumen en texto se pide solo, apenas hay datos para analizar --
  // mismo criterio que Precios/Contabilidad: nada pide un click extra para
  // que el agente dé su lectura de la situación. Usa caché (ver
  // getInventoryAIAnalysisCached): si los conteos no cambiaron desde la
  // última vez, reutiliza el texto guardado en vez de volver a pagar la
  // llamada a Claude cada vez que se abre el panel.
  useEffect(() => {
    if (!data || data.summary.totalProducts === 0) return;
    let cancelled = false;
    setAiLoading(true);
    setAiError(null);
    getInventoryAIAnalysisCached(data, companyName, companyId)
      .then((text) => { if (!cancelled) setAiAnalysis(text); })
      .catch((err) => {
        console.error('Error pidiendo análisis con IA:', err);
        if (!cancelled) setAiError(err.message || 'No se pudo generar el análisis.');
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Cortar la voz si se cierra la ficha del agente mientras lee.
  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 text-orange-400 animate-spin mx-auto mb-2" />
        <p className="text-xs text-zinc-500">Revisando stock y movimientos...</p>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-center text-sm text-zinc-500 py-8">No se pudo analizar el inventario.</p>;
  }

  if (data.summary.totalProducts === 0) {
    return <p className="text-center text-sm text-zinc-500 py-8">Esta empresa todavía no tiene productos de inventario cargados.</p>;
  }

  const q = searchText.trim().toLowerCase();
  const matches = (p) => !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-base font-bold text-red-400">{data.summary.outOfStockCount}</p>
          <p className="text-[10px] text-zinc-400">Sin stock</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-base font-bold text-amber-400">{data.summary.criticalStockCount}</p>
          <p className="text-[10px] text-zinc-400">Stock crítico</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-base font-bold text-zinc-300">{data.summary.deadStockCount}</p>
          <p className="text-[10px] text-zinc-400">Sin rotación</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-2.5 text-center">
          <p className="text-sm font-bold text-purple-400 break-words">{formatCLP(data.summary.immobilizedValue)}</p>
          <p className="text-[10px] text-zinc-400">Capital parado</p>
        </div>
      </div>

      <div className="mb-4 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-violet-300">
            <Sparkles className="w-3.5 h-3.5" />
            Lectura del agente
          </div>
          {voiceOutputSupported && aiAnalysis && (
            <button
              onClick={() => (isSpeaking ? stopSpeaking() : speak(aiAnalysis))}
              title={isSpeaking ? 'Detener lectura' : 'Escuchar'}
              className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors shrink-0"
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {aiLoading && (
          <p className="text-xs text-zinc-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Analizando...</p>
        )}
        {aiError && <p className="text-xs text-red-400">{aiError}</p>}
        {aiAnalysis && <p className="text-sm text-zinc-200 mt-1 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>}
      </div>

      {data.summary.outOfStockCount > 0 && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-200">
            {data.summary.outOfStockCount} producto{data.summary.outOfStockCount !== 1 ? 's' : ''} sin stock — son ventas que se están perdiendo ahora mismo.
          </p>
        </div>
      )}

      {data.summary.deadStockCount > 0 && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200">
            {formatCLP(data.summary.immobilizedValue)} está parado en productos sin ninguna venta reciente.
          </p>
        </div>
      )}

      {(data.outOfStock.length > 0 || data.criticalStock.length > 0 || data.deadStock.length > 0) && (
        <>
          <div className="flex items-center gap-1 mb-3 border-b border-white/[0.08]">
            <button
              onClick={() => setActiveTab('reponer')}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 border-b-2 transition ${
                activeTab === 'reponer' ? 'text-white border-red-400' : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              <PackageX className="w-3.5 h-3.5" />
              Reponer ({data.outOfStock.length + data.criticalStock.length})
            </button>
            <button
              onClick={() => setActiveTab('sin_rotacion')}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 border-b-2 transition ${
                activeTab === 'sin_rotacion' ? 'text-white border-zinc-400' : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              <PackageMinus className="w-3.5 h-3.5" />
              Sin rotación ({data.deadStock.length})
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.2]"
            />
          </div>

          {activeTab === 'reponer' && (() => {
            const restockList = data.restockList.filter(matches);
            if (restockList.length === 0) {
              return <p className="text-sm text-zinc-500 text-center py-6">Sin resultados para "{searchText}".</p>;
            }
            return (
              <>
                <div className="flex items-center justify-between gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 mb-2">
                  <p className="text-[11px] text-zinc-400">Ordenado por lo que más se vende primero</p>
                  <p className="text-xs font-semibold text-zinc-200">Costo total: {formatCLP(data.summary.restockTotalCost)}</p>
                </div>
                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {restockList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name}</p>
                        {p.sku && <p className="text-xs text-zinc-500">SKU {p.sku}</p>}
                        <p className="text-[11px] text-zinc-500">{p.unitsSoldThisMonth} vendidas este mes</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-semibold ${p.stock === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                          {p.stock === 0 ? 'Sin stock' : `Quedan ${p.stock}`}
                        </p>
                        <p className="text-[11px] text-zinc-400">Reponer {p.suggestedReorderQty} · {formatCLP(p.estimatedCost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          {activeTab === 'sin_rotacion' && (() => {
            const deadStock = data.deadStock.filter(matches);
            if (deadStock.length === 0) {
              return <p className="text-sm text-zinc-500 text-center py-6">Sin resultados para "{searchText}".</p>;
            }
            return (
              <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                {deadStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      {p.sku && <p className="text-xs text-zinc-500">SKU {p.sku} · {p.stock} unidades</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-zinc-300">{formatCLP(p.immobilizedValue)}</p>
                      <p className="text-[11px] text-zinc-500">Liquidar o dejar de reponer</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
