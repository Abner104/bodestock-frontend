// src/components/marketing/MarketingSuggestions.jsx
// Buscador manual de negocios cercanos, productos para promocionar, y
// seguimiento de prospectos para UNA empresa -- vive dentro del panel del
// agente en el mapa (SuperAdminAgentRoom.jsx), mismo patrón que
// Precios/Inventario/Finanzas/Contabilidad. El buscador manual (por
// texto/GPS con filtros) es más potente que /terreno (que solo usa GPS y
// 3 radios fijos, pensado para el vendedor en el momento) -- útil para
// buscar por comuna específica sin estar ahí físicamente. Ver
// marketingAgent.js y marketingRecommendationAgent.js.
import { useState, useEffect } from 'react';
import {
  searchNearbyBusinesses, fetchSavedProspects, saveProspect, updateProspect, deleteProspect,
  markVisitedNow, getBusinessTypeOptions, PROSPECT_STATUS, getMarketingAIAnalysis
} from '../../agents/marketingAgent';
import { analyzeProductsToPromote, getProductPromotionAIAnalysis } from '../../agents/marketingRecommendationAgent';
import {
  RefreshCw, MapPin, Navigation, Phone, Star, Plus, Check, Trash2, ChevronDown,
  CalendarCheck, StickyNote, TrendingUp, Gem, PackageX, Sparkles
} from 'lucide-react';

const STATUS_LABEL = {
  [PROSPECT_STATUS.NEW]: { label: 'Nuevo', color: 'text-zinc-300 bg-white/[0.06] border-white/[0.1]' },
  [PROSPECT_STATUS.TO_VISIT]: { label: 'Por visitar', color: 'text-blue-300 bg-blue-500/10 border-blue-500/20' },
  [PROSPECT_STATUS.VISITED]: { label: 'Visitado', color: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20' },
  [PROSPECT_STATUS.INTERESTED]: { label: 'Interesado', color: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20' },
  [PROSPECT_STATUS.CLIENT]: { label: 'Cliente', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
  [PROSPECT_STATUS.NOT_INTERESTED]: { label: 'No interesado', color: 'text-red-300 bg-red-500/10 border-red-500/20' }
};

function formatVisitDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : null;
  if (!date) return null;
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProspectCard({ prospect, onUpdateStatus, onDelete, onMarkVisited, onSaveNotes }) {
  const statusInfo = STATUS_LABEL[prospect.status] || STATUS_LABEL[PROSPECT_STATUS.NEW];
  const mapsUrl = prospect.location
    ? `https://www.google.com/maps/search/?api=1&query=${prospect.location.lat},${prospect.location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospect.address || prospect.name)}`;

  const [notesDraft, setNotesDraft] = useState(prospect.notes || '');
  const [showNotes, setShowNotes] = useState(!!prospect.notes);
  const lastVisitLabel = formatVisitDate(prospect.lastVisitAt);

  const handleNotesBlur = () => {
    if (notesDraft !== (prospect.notes || '')) {
      onSaveNotes(prospect.id, notesDraft);
    }
  };

  return (
    <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{prospect.name}</p>
          <p className="text-xs text-zinc-500 break-words">{prospect.address}</p>
        </div>
        <select
          value={prospect.status}
          onChange={(e) => onUpdateStatus(prospect.id, e.target.value)}
          className={`text-xs px-2 py-1 rounded-lg border shrink-0 focus:outline-none ${statusInfo.color}`}
        >
          {Object.entries(STATUS_LABEL).map(([value, info]) => (
            <option key={value} value={value} className="bg-zinc-900 text-white">{info.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400 mb-2">
        {prospect.phone && (
          <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {prospect.phone}</span>
        )}
        {prospect.rating != null && (
          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> {prospect.rating} ({prospect.ratingCount})</span>
        )}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <Navigation className="w-3 h-3" /> Cómo llegar
        </a>
        <button onClick={() => setShowNotes(v => !v)} className="flex items-center gap-1 text-purple-400/80 hover:text-purple-300">
          <StickyNote className="w-3 h-3" /> {showNotes ? 'Ocultar nota' : 'Nota'}
        </button>
        <button onClick={() => onDelete(prospect.id)} className="flex items-center gap-1 text-red-400/70 hover:text-red-400 ml-auto">
          <Trash2 className="w-3 h-3" /> Quitar
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => onMarkVisited(prospect.id, prospect.status)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.1] transition"
        >
          <CalendarCheck className="w-3.5 h-3.5" /> Marcar visitado hoy
        </button>
        {lastVisitLabel && <span className="text-xs text-zinc-500">Última visita: {lastVisitLabel}</span>}
      </div>

      {showNotes && (
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Ej. Hablé con el dueño, le interesa probar 2 productos..."
          rows={2}
          className="w-full text-xs bg-white/[0.05] border border-white/[0.08] text-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
        />
      )}
    </div>
  );
}

function SearchResultCard({ place, isSaved, onSave, saving }) {
  const mapsUrl = place.location
    ? `https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address || place.name)}`;

  return (
    <div className="flex items-start justify-between gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{place.name}</p>
        <p className="text-xs text-zinc-500 break-words">{place.address}</p>
        <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400 mt-1">
          {place.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {place.phone}</span>}
          {place.rating != null && (
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> {place.rating} ({place.ratingCount})</span>
          )}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
            <Navigation className="w-3 h-3" /> Ver en Maps
          </a>
        </div>
      </div>
      <button
        onClick={() => onSave(place)}
        disabled={isSaved || saving}
        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition whitespace-nowrap shrink-0
          ${isSaved ? 'bg-emerald-500/10 text-emerald-400 cursor-default' : 'bg-purple-500 text-zinc-950 hover:bg-purple-400 disabled:opacity-50 disabled:cursor-wait'}`}
      >
        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isSaved ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        {isSaved ? 'Guardado' : 'Guardar'}
      </button>
    </div>
  );
}

const formatCLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

function ProductRow({ product, extra }) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{product.nombre}</p>
        <p className="text-xs text-zinc-500">Margen {product.marginPct}% · {formatCLP(product.price)}</p>
      </div>
      <span className="text-xs text-zinc-400 whitespace-nowrap shrink-0">{extra}</span>
    </div>
  );
}

function ProductsToPromoteSection({ companyId, companyName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    setAiError(null);
    analyzeProductsToPromote({ companyId })
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err.message || 'No se pudo analizar los productos.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId]);

  const handleAskAI = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const text = await getProductPromotionAIAnalysis(data, companyName);
      setAiAnalysis(text);
    } catch (err) {
      console.error('Error pidiendo análisis con IA:', err);
      setAiError(err.message || 'No se pudo generar el análisis.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
      <p className="text-sm font-semibold text-white mb-1">Productos para promocionar</p>
      <p className="text-xs text-zinc-500 mb-3">Cruza margen real con ventas de los últimos {data?.daysBack || 90} días.</p>

      {loading && (
        <div className="py-6 text-center"><RefreshCw className="w-5 h-5 text-purple-400 animate-spin mx-auto" /></div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {!loading && !error && data && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-2">
              <Gem className="w-3.5 h-3.5 text-purple-400" /> Joyas escondidas — buen margen, poca venta
            </p>
            {data.hiddenGems.length === 0 ? (
              <p className="text-xs text-zinc-500">Ninguno detectado en el período.</p>
            ) : (
              <div className="space-y-1.5">
                {data.hiddenGems.map(p => <ProductRow key={p.id} product={p} extra={`${p.unitsSold} vendidas`} />)}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Más vendidos — buenos para ofrecer de entrada
            </p>
            {data.bestSellers.length === 0 ? (
              <p className="text-xs text-zinc-500">No hay ventas registradas en el período.</p>
            ) : (
              <div className="space-y-1.5">
                {data.bestSellers.map(p => <ProductRow key={p.id} product={p} extra={formatCLP(p.revenue)} />)}
              </div>
            )}
          </div>

          {data.noSales.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 mb-2">
                <PackageX className="w-3.5 h-3.5 text-yellow-400" /> Buen margen, cero ventas — revisar por qué
              </p>
              <div className="space-y-1.5">
                {data.noSales.map(p => <ProductRow key={p.id} product={p} extra="0 vendidas" />)}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-white/[0.06]">
            <button
              onClick={handleAskAI}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition"
            >
              {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? 'Analizando...' : 'Analizar con IA'}
            </button>
            {aiError && <p className="text-xs text-red-400 mt-2">{aiError}</p>}
            {aiAnalysis && <p className="text-sm text-zinc-200 mt-3 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketingSuggestions({ companyId, companyName }) {
  const [locationText, setLocationText] = useState('');
  const [radiusKm, setRadiusKm] = useState('1.5');
  const [businessTypes, setBusinessTypes] = useState(['convenience_store', 'grocery_store']);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [excludeChains, setExcludeChains] = useState(true);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [savingPlaceId, setSavingPlaceId] = useState(null);

  const [prospects, setProspects] = useState([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);

  const [prospectsAiAnalysis, setProspectsAiAnalysis] = useState(null);
  const [prospectsAiLoading, setProspectsAiLoading] = useState(false);
  const [prospectsAiError, setProspectsAiError] = useState(null);

  const typeOptions = getBusinessTypeOptions();

  useEffect(() => {
    if (!companyId) return;
    setProspectsLoading(true);
    setProspectsAiAnalysis(null);
    setProspectsAiError(null);
    fetchSavedProspects(companyId)
      .then(setProspects)
      .catch(err => console.error('Error cargando prospectos:', err))
      .finally(() => setProspectsLoading(false));
  }, [companyId]);

  const toggleType = (value) => {
    setBusinessTypes(prev => prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]);
  };

  const handleSearch = async (coords) => {
    if (!coords && !locationText.trim()) {
      setSearchError('Escribe una comuna/dirección o usa tu ubicación actual.');
      return;
    }
    if (!coords) {
      const normalized = locationText.trim().toLowerCase();
      const isJustCity = ['santiago', 'santiago, chile', 'santiago chile', 'santiago de chile'].includes(normalized);
      if (isJustCity) {
        setSearchError('"Santiago" es muy grande — los resultados siempre caen en el centro. Prueba con una comuna específica, ej. "Ñuñoa" o "La Florida".');
        return;
      }
    }
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const params = { radiusMeters: Number(radiusKm) * 1000, businessTypes, excludeChains };
      if (coords) { params.latitude = coords.lat; params.longitude = coords.lng; }
      else { params.locationText = locationText.trim(); }
      const result = await searchNearbyBusinesses(params);
      setSearchResults(result.places);
    } catch (err) {
      console.error('Error buscando negocios:', err);
      setSearchError(err.message || 'No se pudo completar la búsqueda.');
    } finally {
      setSearching(false);
    }
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setSearchError('Tu navegador no soporta geolocalización.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => handleSearch({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (err) => {
        console.error('Error obteniendo ubicación:', err);
        setSearchError('No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.');
        setSearching(false);
      }
    );
  };

  const handleSavePlace = async (place) => {
    setSavingPlaceId(place.id);
    try {
      await saveProspect(place, companyId);
      const updated = await fetchSavedProspects(companyId);
      setProspects(updated);
    } catch (err) {
      console.error('Error guardando prospecto:', err);
      alert('No se pudo guardar este negocio. Intenta de nuevo.');
    } finally {
      setSavingPlaceId(null);
    }
  };

  const handleUpdateStatus = async (prospectId, status) => {
    setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, status } : p));
    try { await updateProspect(prospectId, { status }, companyId); } catch (err) { console.error('Error actualizando prospecto:', err); }
  };

  const handleDeleteProspect = async (prospectId) => {
    const confirmed = window.confirm('¿Quitar este negocio de la lista de seguimiento?');
    if (!confirmed) return;
    setProspects(prev => prev.filter(p => p.id !== prospectId));
    try { await deleteProspect(prospectId, companyId); } catch (err) { console.error('Error eliminando prospecto:', err); }
  };

  const handleMarkVisited = async (prospectId, currentStatus) => {
    const nextStatus = (currentStatus === PROSPECT_STATUS.TO_VISIT || currentStatus === PROSPECT_STATUS.NEW) ? PROSPECT_STATUS.VISITED : currentStatus;
    setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, status: nextStatus, lastVisitAt: { toDate: () => new Date() } } : p));
    try { await markVisitedNow(prospectId, currentStatus, companyId); } catch (err) { console.error('Error marcando visita:', err); }
  };

  const handleSaveNotes = async (prospectId, notes) => {
    setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, notes } : p));
    try { await updateProspect(prospectId, { notes }, companyId); } catch (err) { console.error('Error guardando nota:', err); }
  };

  const handleAskProspectsAI = async () => {
    setProspectsAiLoading(true);
    setProspectsAiError(null);
    setProspectsAiAnalysis(null);
    try {
      const summary = { total: prospects.length };
      Object.values(PROSPECT_STATUS).forEach(status => { summary[status] = prospects.filter(p => p.status === status).length; });
      const text = await getMarketingAIAnalysis(summary, companyName);
      setProspectsAiAnalysis(text);
    } catch (err) {
      console.error('Error pidiendo análisis con IA:', err);
      setProspectsAiError(err.message || 'No se pudo generar el análisis.');
    } finally {
      setProspectsAiLoading(false);
    }
  };

  const savedIds = new Set(prospects.map(p => p.id));

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
        <p className="text-sm font-semibold text-white mb-3">Buscar negocios cercanos</p>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1 min-w-0">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Ej. La Florida, Santiago"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/[0.06] border border-white/[0.08] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
          <button
            onClick={handleUseGPS}
            disabled={searching}
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-white/[0.06] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.1] transition disabled:opacity-50 whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5" /> Mi ubicación
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">Radio</span>
            <input
              type="number"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              className="w-14 text-xs bg-white/[0.06] border border-white/[0.08] text-white rounded-lg px-2 py-1.5 focus:outline-none"
            />
            <span className="text-xs text-zinc-400">km</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowTypeMenu(v => !v)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.1] transition"
            >
              {businessTypes.length} tipo{businessTypes.length !== 1 ? 's' : ''} de negocio <ChevronDown className="w-3 h-3" />
            </button>
            {showTypeMenu && (
              <div className="absolute z-10 mt-1 bg-zinc-900 border border-white/[0.1] rounded-lg shadow-xl p-2 w-64">
                {typeOptions.map(opt => (
                  <label key={opt.value} className="flex items-start gap-2 text-xs text-zinc-300 px-2 py-1.5 hover:bg-white/[0.06] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={businessTypes.includes(opt.value)}
                      onChange={() => toggleType(opt.value)}
                      className="accent-purple-500 mt-0.5"
                    />
                    <span>
                      {opt.label}
                      {opt.warning && <span className="block text-[10px] text-yellow-500/80 mt-0.5">{opt.warning}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
            <input type="checkbox" checked={excludeChains} onChange={(e) => setExcludeChains(e.target.checked)} className="accent-purple-500" />
            Sin cadenas grandes
          </label>

          <button
            onClick={() => handleSearch()}
            disabled={searching}
            className="ml-auto flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium bg-purple-500 text-zinc-950 hover:bg-purple-400 disabled:opacity-50 transition"
          >
            {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {searchError && <p className="text-xs text-red-400 mb-3">{searchError}</p>}

        {searchResults && (
          <div className="space-y-2 pt-3 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-500 mb-2">
              {searchResults.length} negocio{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
            </p>
            {searchResults.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No se encontraron negocios en esa zona con los filtros elegidos.</p>
            )}
            {searchResults.map(place => (
              <SearchResultCard key={place.id} place={place} isSaved={savedIds.has(place.id)} saving={savingPlaceId === place.id} onSave={handleSavePlace} />
            ))}
          </div>
        )}
      </div>

      {/* Qué productos promocionar */}
      {companyId && <ProductsToPromoteSection companyId={companyId} companyName={companyName} />}

      {/* Prospectos guardados */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <p className="text-sm font-semibold text-white">Seguimiento ({prospects.length})</p>
          {prospects.length > 0 && (
            <button
              onClick={handleAskProspectsAI}
              disabled={prospectsAiLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 transition"
            >
              {prospectsAiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {prospectsAiLoading ? 'Analizando...' : 'Analizar con IA'}
            </button>
          )}
        </div>

        {prospectsAiError && <p className="text-xs text-red-400 mb-3">{prospectsAiError}</p>}
        {prospectsAiAnalysis && <p className="text-sm text-zinc-200 mb-4 leading-relaxed whitespace-pre-line">{prospectsAiAnalysis}</p>}

        {prospectsLoading && (
          <div className="py-6 text-center"><RefreshCw className="w-5 h-5 text-purple-400 animate-spin mx-auto" /></div>
        )}

        {!prospectsLoading && prospects.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-6">Todavía no has guardado negocios. Busca arriba y guarda los que quieras visitar.</p>
        )}

        {!prospectsLoading && prospects.length > 0 && (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {prospects.map(prospect => (
              <ProspectCard
                key={prospect.id}
                prospect={prospect}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDeleteProspect}
                onMarkVisited={handleMarkVisited}
                onSaveNotes={handleSaveNotes}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
