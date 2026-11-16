// src/pages/TerrenoProspeccion.jsx
// Vista para el vendedor EN TERRENO: busca negocios cercanos con el GPS del
// celular en el momento, los guarda como prospectos nuevos, y muestra la
// lista de pendientes AHÍ MISMO con un botón "Visitado" en cada uno -- el
// vendedor no depende del dueño para ver ni marcar su propia ruta. Cuando
// visita el último pendiente, se busca sola la siguiente tanda (radio más
// amplio) desde el mismo punto. "Mi Consultor" (dueño) solo ve un resumen
// de avance, no esta lista casa por casa -- ver ProspectsSummaryCard.jsx.
import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getUserCompanyId, companyIsWholesale } from '../services/companyService';
import { getWorkerByEmail } from '../services/workers-service';
import { searchNearbyBusinesses, saveProspectsBatch, markVisitedNow, PROSPECT_STATUS } from '../agents/marketingAgent';
import { MapPin, Phone, Star, Check, Loader2, CheckCircle2, AlertTriangle, Navigation } from 'lucide-react';

const DEFAULT_RADIUS_M = 1500;
const NEXT_RADIUS_GROWTH = 1.6;
const MAX_AUTO_RADIUS_M = 6000;

// Deep links de navegación con coordenadas (más preciso que buscar por
// texto de dirección) -- si la app no está instalada, ambos caen solos al
// sitio web correspondiente.
function wazeUrl(location) {
  return `https://waze.com/ul?ll=${location.lat},${location.lng}&navigate=yes`;
}
function googleMapsUrl(location) {
  return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
}

// Distancia en línea recta (haversine) -- suficiente para ordenar "más
// cerca primero" en una lista de a pie/auto, sin pedirle ruta a ninguna API.
function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function TerrenoProspeccion() {
  const [companyId, setCompanyId] = useState(null);
  const [allowed, setAllowed] = useState(null); // null=verificando, true/false
  const [workerName, setWorkerName] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M);
  const [status, setStatus] = useState('idle'); // idle | locating | searching | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);

  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [markingId, setMarkingId] = useState(null);
  const [autoSearching, setAutoSearching] = useState(false);
  const [myLocation, setMyLocation] = useState(null);

  useEffect(() => {
    (async () => {
      const id = await getUserCompanyId();
      setCompanyId(id);
      setAllowed(await companyIsWholesale(id));
      const user = auth.currentUser;
      if (user) {
        try {
          const worker = await getWorkerByEmail(user.email);
          setWorkerName(worker?.name || user.email);
        } catch {
          setWorkerName(user.email || '');
        }
      }
    })();

    // Ubicación pasiva al abrir la pantalla, solo para ordenar la lista por
    // cercanía -- si el permiso falla o se niega, la lista simplemente
    // queda en el orden por fecha (sin bloquear nada).
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // Lista de pendientes en vivo -- cualquier vendedor ve la misma cola
  // compartida de la empresa, no solo lo que encontró él.
  useEffect(() => {
    if (!companyId) return;
    const q = query(
      collection(db, `companies/${companyId}/prospects`),
      where('status', '==', PROSPECT_STATUS.TO_VISIT),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setPending(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPendingLoading(false);
    }, () => setPendingLoading(false));
    return unsub;
  }, [companyId]);

  const handleSearchHere = () => {
    if (!companyId) return;
    setStatus('locating');
    setErrorMsg('');
    setResult(null);

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMsg('Tu navegador no soporta ubicación. Probá desde el celular con Chrome.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('searching');
        const { latitude, longitude } = position.coords;
        setMyLocation({ lat: latitude, lng: longitude });
        try {
          const { places } = await searchNearbyBusinesses({ latitude, longitude, radiusMeters: radius });
          if (places.length > 0) {
            await saveProspectsBatch(places, companyId, {
              foundBy: workerName || 'Vendedor en terreno',
              searchOrigin: { lat: latitude, lng: longitude },
              radiusMeters: radius
            });
          }
          setResult({ found: places.length });
          setStatus('done');
        } catch (err) {
          setStatus('error');
          setErrorMsg(err.message || 'No se pudo buscar negocios cercanos.');
        }
      },
      (geoErr) => {
        setStatus('error');
        setErrorMsg(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Le negaste el permiso de ubicación al navegador. Activalo en la configuración del sitio.'
            : 'No se pudo obtener tu ubicación. Probá de nuevo en un lugar con mejor señal.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Al visitar el último pendiente de la tanda, busca sola la siguiente
  // desde el mismo punto de origen, con el radio ampliado.
  const triggerNextBatch = useCallback(async (lastProspect) => {
    if (!lastProspect?.searchOrigin || autoSearching) return;
    const nextRadius = Math.min(
      Math.round((lastProspect.radiusMeters || DEFAULT_RADIUS_M) * NEXT_RADIUS_GROWTH),
      MAX_AUTO_RADIUS_M
    );
    setAutoSearching(true);
    try {
      const { places } = await searchNearbyBusinesses({
        latitude: lastProspect.searchOrigin.lat,
        longitude: lastProspect.searchOrigin.lng,
        radiusMeters: nextRadius
      });
      if (places.length > 0) {
        await saveProspectsBatch(places, companyId, {
          foundBy: lastProspect.foundBy || workerName || 'Búsqueda automática',
          searchOrigin: lastProspect.searchOrigin,
          radiusMeters: nextRadius
        });
      }
    } catch (e) {
      console.error('No se pudo ampliar la búsqueda de negocios cercanos:', e.message);
    } finally {
      setAutoSearching(false);
    }
  }, [companyId, workerName, autoSearching]);

  const handleMarkVisited = async (prospect) => {
    setMarkingId(prospect.id);
    try {
      await markVisitedNow(prospect.id, prospect.status, companyId);
      const remaining = pending.filter(p => p.id !== prospect.id);
      if (remaining.length === 0) triggerNextBatch(prospect);
    } catch (e) {
      console.error('No se pudo marcar como visitado:', e.message);
    } finally {
      setMarkingId(null);
    }
  };

  const isBusy = status === 'locating' || status === 'searching';

  // Ordenados de más cerca a más lejos de donde está el vendedor ahora --
  // si todavía no hay ubicación (permiso denegado/pendiente), queda el
  // orden por fecha que ya trae la consulta.
  const sortedPending = myLocation
    ? [...pending]
        .map(p => ({ ...p, _distance: p.location ? distanceMeters(myLocation, p.location) : null }))
        .sort((a, b) => {
          if (a._distance == null) return 1;
          if (b._distance == null) return -1;
          return a._distance - b._distance;
        })
    : pending;

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-5 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" />
        <p className="font-semibold mb-1">Esta función no está disponible para tu empresa</p>
        <p className="text-sm text-zinc-500 max-w-xs">
          "Buscar clientes cerca" es una herramienta pensada para distribuidoras y mayoristas.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center px-5 pt-10 pb-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-5 h-5 text-emerald-400" />
          <h1 className="text-lg font-bold">Buscar clientes cerca</h1>
        </div>
        <p className="text-sm text-zinc-400 mb-6">
          {workerName ? `Hola ${workerName}. ` : ''}Tocá el botón donde estés parado y el agente busca negocios cercanos para ofrecerles los productos.
        </p>

        <div className="mb-5">
          <label className="text-xs text-zinc-500 mb-1.5 block">Radio de búsqueda</label>
          <div className="flex gap-2">
            {[800, 1500, 3000].map((m) => (
              <button
                key={m}
                onClick={() => setRadius(m)}
                disabled={isBusy}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  radius === m ? 'bg-emerald-500 text-black' : 'bg-white/[0.06] text-zinc-300'
                }`}
              >
                {m < 1000 ? `${m} m` : `${m / 1000} km`}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSearchHere}
          disabled={isBusy || !companyId}
          className="w-full py-4 rounded-xl bg-emerald-500 text-black font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
        >
          {isBusy ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {status === 'locating' ? 'Ubicándote...' : 'Buscando negocios...'}
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5" />
              Buscar negocios cerca de mí
            </>
          )}
        </button>

        {status === 'done' && result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="font-semibold text-emerald-300 text-sm">
              {result.found > 0 ? `Encontré ${result.found} negocio${result.found === 1 ? '' : 's'} cerca` : 'No encontré negocios nuevos en esta zona'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.08] p-4 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{errorMsg}</p>
          </div>
        )}

        {/* Cola de pendientes -- compartida entre todos los vendedores de la empresa */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Por visitar</p>
            {pending.length > 0 && <p className="text-xs text-zinc-500">{pending.length}</p>}
          </div>

          {pendingLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">Sin negocios pendientes. Buscá para armar tu ruta.</p>
          ) : (
            <div className="space-y-2">
              {sortedPending.map((p) => (
                <div key={p.id} className="py-2.5 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    {p._distance != null && (
                      <span className="shrink-0 text-[11px] font-semibold text-emerald-400 tabular-nums">{formatDistance(p._distance)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{p.address}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {p.phone && (
                      <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                        <Phone className="w-3 h-3" /> {p.phone}
                      </span>
                    )}
                    {p.rating != null && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400">
                        <Star className="w-3 h-3 fill-current" /> {p.rating}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5">
                    {p.location && (
                      <>
                        <a
                          href={wazeUrl(p.location)}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 transition-colors"
                        >
                          <Navigation className="w-3 h-3" /> Waze
                        </a>
                        <a
                          href={googleMapsUrl(p.location)}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition-colors"
                        >
                          <Navigation className="w-3 h-3" /> Maps
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => handleMarkVisited(p)}
                      disabled={markingId === p.id}
                      className="flex items-center justify-center gap-1 flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
                    >
                      {markingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Visitado
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {autoSearching && (
            <div className="flex items-center gap-2 mt-3 text-[11px] text-emerald-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Visitaste toda la tanda — buscando negocios nuevos más lejos...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
