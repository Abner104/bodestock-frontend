// src/components/marketing/TabMarketing.jsx
import { useState, useMemo, useEffect } from 'react';
import {
  Megaphone, Users, Zap, Copy, Check, ChevronDown, ChevronUp,
  Loader2, Sparkles, Package, ShoppingBag, MessageCircle,
  Search, X, ArrowRight, TrendingUp, ShoppingCart, Trash2, Tag
} from 'lucide-react';
import { Card } from '../ui/sa-card';
import { savePromo, getPromos, deletePromo } from '../../services/promos-service';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

// ── RFM ───────────────────────────────────────────────────
function calcularRFM(clientes) {
  const now = new Date();
  return clientes.map(c => {
    const diasSinComprar = c.ultimaCompra
      ? Math.floor((now - new Date(c.ultimaCompra)) / (1000 * 60 * 60 * 24))
      : 999;
    const R = diasSinComprar <= 7 ? 3 : diasSinComprar <= 20 ? 2 : 1;
    const F = (c.compras || 0) >= 8 ? 3 : (c.compras || 0) >= 3 ? 2 : 1;
    const M = (c.totalHistorico || 0) >= 200000 ? 3 : (c.totalHistorico || 0) >= 50000 ? 2 : 1;
    const score = R + F + M;
    let segmento;
    if (score >= 8) segmento = 'vip';
    else if (R <= 1 && F >= 2) segmento = 'riesgo';
    else if ((c.compras || 0) <= 2) segmento = 'nuevo';
    else if (diasSinComprar > 30) segmento = 'perdido';
    else segmento = 'regular';
    return { ...c, diasSinComprar, R, F, M, score, segmento };
  });
}

const SEGMENTOS = {
  vip:     { label: 'VIP',       emoji: '⭐', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   desc: 'Compran seguido y gastan mucho' },
  regular: { label: 'Regular',   emoji: '🟢', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', desc: 'Clientes estables y frecuentes' },
  nuevo:   { label: 'Nuevo',     emoji: '🔵', color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',     desc: '1-2 compras — hay que fidelizarlos' },
  riesgo:  { label: 'En riesgo', emoji: '🟡', color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20', desc: 'Antes compraban, llevan días sin venir' },
  perdido: { label: 'Perdido',   emoji: '🔴', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',       desc: '+30 días sin comprar' },
};

const MENSAJES = {
  vip:     (n, combo) => `⭐ Hola ${n}, como uno de nuestros mejores clientes tenés acceso prioritario a nuestra oferta especial esta semana:\n\n🔥 ${combo}\n\nSolo para clientes VIP. ¡Avisanos para apartar tu pedido!`,
  nuevo:   (n, combo) => `👋 Hola ${n}! Nos alegra tenerte como cliente.\n\n🎁 Esta semana tenemos una oferta especial para vos:\n\n🔥 ${combo}\n\n¡Esperamos verte pronto!`,
  riesgo:  (n, combo) => `💛 Hola ${n}, hace algunos días que no te vemos y te echamos de menos.\n\n🎁 Tenemos esta oferta especial esperándote:\n\n🔥 ${combo}\n\n¡Vení esta semana y aprovechá!`,
  perdido: (n, combo) => `🙌 Hola ${n}! Ha pasado un tiempo y queremos que vuelvas.\n\n🎁 Oferta exclusiva de reactivación:\n\n🔥 ${combo}\n\nEsta oferta es solo por esta semana. ¡Te esperamos!`,
  regular: (n, combo) => `👋 Hola ${n}! Esta semana tenemos una oferta que te va a interesar:\n\n🔥 ${combo}\n\n¡No te la pierdas!`,
};

// ── Buscador de producto ──────────────────────────────────
function BuscadorProducto({ products, value, onChange, placeholder }) {
  const [query, setQuery] = useState('');

  const filtrados = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return (products || []).filter(p => p.name?.toLowerCase().includes(q)).slice(0, 6);
  }, [query, products]);

  const limpiar = () => { onChange(null); setQuery(''); };

  if (value) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.08]">
        <Package className="w-4 h-4 text-violet-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{value.name}</p>
          <p className="text-[10px] text-zinc-500">
            PPP: {CLP(value.ppp || 0)} · Stock: {value.stock ?? 0} {value.unit || 'u'}
          </p>
        </div>
        <button onClick={limpiar} className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.10] bg-white/[0.03]">
        <Search className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[13px] text-white placeholder-zinc-600 outline-none min-w-0"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-400 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {query.trim() && filtrados.length === 0 && (
        <p className="text-[11px] text-zinc-600 px-1">Sin resultados para "{query}"</p>
      )}
      {filtrados.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          {filtrados.map((p, i) => (
            <button
              key={p.id || i}
              onClick={() => { onChange(p); setQuery(''); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] active:bg-white/[0.10] transition-colors text-left border-none border-b border-white/[0.04] last:border-b-0"
            >
              <Package className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white truncate">{p.name}</p>
                <p className="text-[10px] text-zinc-600">PPP {CLP(p.ppp || 0)} · Stock {p.stock ?? 0}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {!query.trim() && (products || []).length > 0 && (
        <p className="text-[11px] text-zinc-500 px-1">Escribe el nombre del producto para buscar ({(products || []).length} disponibles)</p>
      )}
    </div>
  );
}

// ── Mensaje copiable por cliente ──────────────────────────
function MensajeCard({ cliente, comboTexto }) {
  const [copiado, setCopiado] = useState(false);
  const seg = cliente.segmento;
  const nombre = cliente.nombre?.split(' ')[0] || 'cliente';
  const mensaje = MENSAJES[seg]?.(nombre, comboTexto) || '';
  const copiar = () => {
    navigator.clipboard.writeText(mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{SEGMENTOS[seg]?.emoji}</span>
          <span className="text-[12px] font-semibold text-white truncate">{cliente.nombre}</span>
        </div>
        <button
          onClick={copiar}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 ml-2 ${
            copiado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.10]'
          }`}
        >
          {copiado ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500 whitespace-pre-line leading-relaxed">{mensaje}</p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
export default function TabMarketing({ exits, products, rankingClientes, companyName }) {
  const [activeSection, setActiveSection] = useState('rfm');
  const [segmentoFiltro, setSegmentoFiltro] = useState('todos');
  const [expandedCliente, setExpandedCliente] = useState(null);

  // Combo builder
  const [prod1, setProd1] = useState(null);
  const [prod2, setProd2] = useState(null);
  const [precioManual, setPrecioManual] = useState('');
  const [generando, setGenerando] = useState(false);
  const [mensajesGenerados, setMensajesGenerados] = useState(false);
  const [comboFinal, setComboFinal] = useState(null);

  const clientesRFM = useMemo(() => calcularRFM(rankingClientes || []), [rankingClientes]);

  const resumenSegmentos = useMemo(() => {
    const res = { vip: 0, regular: 0, nuevo: 0, riesgo: 0, perdido: 0 };
    clientesRFM.forEach(c => { if (res[c.segmento] !== undefined) res[c.segmento]++; });
    return res;
  }, [clientesRFM]);

  const clientesFiltrados = segmentoFiltro === 'todos'
    ? clientesRFM
    : clientesRFM.filter(c => c.segmento === segmentoFiltro);

  // Cálculo del combo
  const calculo = useMemo(() => {
    if (!prod1 || !prod2) return null;
    const costo = (prod1.ppp || 0) + (prod2.ppp || 0);
    const precioNormal = (prod1.salePrice || Math.round((prod1.ppp || 0) * 1.35))
                       + (prod2.salePrice || Math.round((prod2.ppp || 0) * 1.35));
    const precioPromo = precioManual
      ? parseInt(precioManual.replace(/\D/g, ''), 10) || 0
      : Math.round(precioNormal * 0.88 / 100) * 100;
    const ganancia = precioPromo - costo;
    const margen = precioPromo > 0 ? (ganancia / precioPromo) * 100 : 0;
    const stockMax = Math.min(prod1.stock ?? 0, prod2.stock ?? 0);
    return { costo, precioNormal, precioPromo, ganancia, margen, stockMax };
  }, [prod1, prod2, precioManual]);

  const comboTexto = comboFinal
    ? `${comboFinal.p1.name} + ${comboFinal.p2.name} → ${CLP(comboFinal.precioPromo)} (precio normal ${CLP(comboFinal.precioNormal)})`
    : '';

  const generarMensajes = () => {
    if (!prod1 || !prod2 || !calculo) return;
    setGenerando(true);
    setTimeout(() => {
      setComboFinal({ p1: prod1, p2: prod2, ...calculo });
      setMensajesGenerados(true);
      setGenerando(false);
      setActiveSection('mensajes');
    }, 1000);
  };

  // Promos guardadas en Firestore
  const [promosGuardadas, setPromosGuardadas] = useState([]);
  const [guardandoPromo, setGuardandoPromo] = useState(false);
  const [promoGuardadaOk, setPromoGuardadaOk] = useState(false);

  useEffect(() => {
    getPromos().then(setPromosGuardadas).catch(() => {});
  }, []);

  const guardarPromoEnCaja = async () => {
    if (!prod1 || !prod2 || !calculo || calculo.ganancia <= 0) return;
    setGuardandoPromo(true);
    try {
      await savePromo({
        nombre: `${prod1.name} + ${prod2.name}`,
        prod1: { id: prod1.id, name: prod1.name, ppp: prod1.ppp || 0, salePrice: prod1.salePrice || 0 },
        prod2: { id: prod2.id, name: prod2.name, ppp: prod2.ppp || 0, salePrice: prod2.salePrice || 0 },
        precioPromo: calculo.precioPromo,
        precioNormal: calculo.precioNormal,
        costo: calculo.costo,
        ganancia: calculo.ganancia,
        margen: calculo.margen,
      });
      const lista = await getPromos();
      setPromosGuardadas(lista);
      setPromoGuardadaOk(true);
      setTimeout(() => setPromoGuardadaOk(false), 3000);
    } catch (e) {
      console.error('Error guardando promo:', e);
    } finally {
      setGuardandoPromo(false);
    }
  };

  const eliminarPromo = async (id) => {
    await deletePromo(id);
    setPromosGuardadas(prev => prev.filter(p => p.id !== id));
  };

  const sections = [
    { id: 'rfm',      label: 'Clientes',  icon: Users },
    { id: 'promos',   label: 'Crear promo', icon: ShoppingBag },
    { id: 'combos',   label: 'Combos activos', icon: Tag },
    { id: 'mensajes', label: 'Mensajes',  icon: MessageCircle },
  ];

  // Productos disponibles (excluye el ya seleccionado en el otro slot)
  const prodsParaP1 = useMemo(() => (products || []).filter(p => p.id !== prod2?.id), [products, prod2]);
  const prodsParaP2 = useMemo(() => (products || []).filter(p => p.id !== prod1?.id), [products, prod1]);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <Megaphone className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-white">Marketing</h2>
          <p className="text-[11px] text-zinc-500">Segmentación RFM · Promos personalizadas · WhatsApp</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer border-none ${
              activeSection === s.id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{s.label}</span>
            {s.id === 'mensajes' && mensajesGenerados && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* ── CLIENTES ── */}
      {activeSection === 'rfm' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(SEGMENTOS).map(([key, seg]) => (
              <button
                key={key}
                onClick={() => setSegmentoFiltro(segmentoFiltro === key ? 'todos' : key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  segmentoFiltro === key ? seg.bg : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">{seg.emoji}</span>
                  <span className={`text-[20px] font-black tabular-nums ${segmentoFiltro === key ? seg.color : 'text-white'}`}>
                    {resumenSegmentos[key]}
                  </span>
                </div>
                <p className={`text-[12px] font-semibold ${segmentoFiltro === key ? seg.color : 'text-zinc-400'}`}>{seg.label}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{seg.desc}</p>
              </button>
            ))}
            <button
              onClick={() => setSegmentoFiltro('todos')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                segmentoFiltro === 'todos' ? 'bg-white/[0.08] border-white/[0.20]' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg">👥</span>
                <span className="text-[20px] font-black tabular-nums text-white">{clientesRFM.length}</span>
              </div>
              <p className="text-[12px] font-semibold text-zinc-400">Todos</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Ver lista completa</p>
            </button>
          </div>

          <Card className="p-4">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              {segmentoFiltro === 'todos' ? 'Todos los clientes' : SEGMENTOS[segmentoFiltro]?.label}
              <span className="ml-2 text-zinc-500 normal-case font-normal">({clientesFiltrados.length})</span>
            </p>
            {clientesFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <p className="text-[13px] text-zinc-600">Sin clientes en este segmento</p>
                <p className="text-[11px] text-zinc-500 mt-1">Los clientes aparecen cuando tienen nombre registrado en las ventas</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {clientesFiltrados.map((c, i) => {
                  const seg = SEGMENTOS[c.segmento];
                  const isExp = expandedCliente === i;
                  return (
                    <div key={i} className="rounded-xl border border-white/[0.06] overflow-hidden">
                      <button
                        onClick={() => setExpandedCliente(isExp ? null : i)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors text-left"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${seg.bg}`}>
                          {seg.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white truncate">{c.nombre}</p>
                          <p className="text-[10px] text-zinc-600">
                            {c.diasSinComprar === 999 ? 'Sin fecha' : `Hace ${c.diasSinComprar}d`}
                            {' · '}{c.compras} compra{c.compras !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[12px] font-bold ${seg.color}`}>{seg.label}</p>
                          <p className="text-[11px] text-zinc-500 tabular-nums">{CLP(c.totalHistorico)}</p>
                        </div>
                        {isExp ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                      </button>
                      {isExp && (
                        <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-t border-white/[0.04] pt-2">
                          {[
                            { label: 'Recencia', val: c.diasSinComprar === 999 ? '—' : `${c.diasSinComprar}d`, score: c.R },
                            { label: 'Frecuencia', val: `${c.compras}`, score: c.F },
                            { label: 'Monto total', val: CLP(c.totalHistorico), score: c.M },
                          ].map((kpi, j) => (
                            <div key={j} className="bg-white/[0.06] rounded-lg p-2 text-center">
                              <p className="text-[10px] text-zinc-600 mb-0.5">{kpi.label}</p>
                              <p className="text-[11px] font-bold text-white tabular-nums">{kpi.val}</p>
                              <div className="flex gap-0.5 justify-center mt-1">
                                {[1,2,3].map(n => (
                                  <div key={n} className={`w-2 h-2 rounded-full ${n <= kpi.score ? 'bg-violet-400' : 'bg-white/[0.08]'}`} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {clientesFiltrados.length > 0 && (
            <button
              onClick={() => setActiveSection('promos')}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <Zap className="w-4 h-4" />
              Crear promo para {segmentoFiltro === 'todos' ? 'todos' : SEGMENTOS[segmentoFiltro]?.label + 's'} ({clientesFiltrados.length})
            </button>
          )}
        </div>
      )}

      {/* ── CREAR PROMO ── */}
      {activeSection === 'promos' && (
        <div className="space-y-4">

          {/* Paso 1: elegir productos */}
          <Card className="p-4 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Paso 1 — Elige los productos del combo</p>
              <p className="text-[12px] text-zinc-600">Busca y selecciona los dos productos que van juntos en la promo</p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-zinc-500 mb-1.5">Producto 1</p>
                <BuscadorProducto
                  products={prodsParaP1}
                  value={prod1}
                  onChange={setProd1}
                  placeholder="Buscar producto..."
                />
              </div>

              {prod1 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[11px] text-zinc-500 font-semibold">+ combo con</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
              )}

              {prod1 && (
                <div>
                  <p className="text-[11px] text-zinc-500 mb-1.5">Producto 2</p>
                  <BuscadorProducto
                    products={prodsParaP2}
                    value={prod2}
                    onChange={setProd2}
                    placeholder="Buscar segundo producto..."
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Paso 2: precio y cálculo */}
          {calculo && (
            <Card className="p-4 space-y-4">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Paso 2 — Precio de la promo</p>

              {/* Resumen de costos */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white/[0.06] rounded-xl p-3 border border-white/[0.08]">
                  <p className="text-[10px] text-zinc-400 mb-1">Lo que te costó a vos</p>
                  <p className="text-[16px] font-black text-white tabular-nums">{CLP(calculo.costo)}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{prod1.name?.split(' ')[0]} + {prod2.name?.split(' ')[0]}</p>
                </div>
                <div className="bg-white/[0.06] rounded-xl p-3 border border-white/[0.08]">
                  <p className="text-[10px] text-zinc-400 mb-1">Si los compran por separado</p>
                  <p className="text-[16px] font-black text-zinc-300 line-through tabular-nums">{CLP(calculo.precioNormal)}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Precio individual de cada uno</p>
                </div>
              </div>

              {/* Input precio promo */}
              <div>
                <p className="text-[11px] text-zinc-500 mb-2">
                  ¿A cuánto vas a vender el combo?
                  <span className="ml-2 text-zinc-500 font-normal">(sugerido: {CLP(Math.round(calculo.precioNormal * 0.88 / 100) * 100)} — 12% menos que el precio normal)</span>
                </p>
                <div className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.10] bg-white/[0.03] focus-within:border-violet-500/40">
                  <span className="text-zinc-500 text-[14px]">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={precioManual}
                    onChange={e => setPrecioManual(e.target.value.replace(/\D/g, ''))}
                    placeholder={String(Math.round(calculo.precioNormal * 0.88 / 100) * 100)}
                    className="flex-1 bg-transparent text-[18px] font-bold text-white placeholder-zinc-700 outline-none tabular-nums"
                  />
                  {precioManual && (
                    <button onClick={() => setPrecioManual('')} className="text-zinc-600 hover:text-zinc-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Resultado */}
              <div className={`rounded-xl p-4 border ${
                calculo.ganancia <= 0
                  ? 'bg-red-500/[0.08] border-red-500/[0.20]'
                  : calculo.margen >= 20
                    ? 'bg-emerald-500/[0.08] border-emerald-500/[0.20]'
                    : 'bg-amber-500/[0.08] border-amber-500/[0.20]'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[12px] font-bold ${
                    calculo.ganancia <= 0 ? 'text-red-400' : calculo.margen >= 20 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {calculo.ganancia <= 0 ? '❌ Sin margen — ajusta el precio' : calculo.margen >= 20 ? '✅ Buena promo' : '⚠️ Margen bajo — considera subir el precio'}
                  </p>
                  <TrendingUp className={`w-4 h-4 ${calculo.ganancia <= 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-zinc-400 mb-0.5">Te ganás por combo</p>
                    <p className={`text-[15px] font-black tabular-nums ${calculo.ganancia <= 0 ? 'text-red-400' : 'text-white'}`}>{CLP(calculo.ganancia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 mb-0.5">% de ganancia</p>
                    <p className={`text-[15px] font-black tabular-nums ${calculo.ganancia <= 0 ? 'text-red-400' : calculo.margen >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {calculo.margen.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 mb-0.5">Combos posibles</p>
                    <p className="text-[15px] font-black text-white tabular-nums">{calculo.stockMax}</p>
                  </div>
                </div>
              </div>

              {/* Stock crítico */}
              {calculo.stockMax < 5 && calculo.stockMax > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/[0.20]">
                  <span className="text-amber-400 text-sm">⚠️</span>
                  <p className="text-[11px] text-amber-400">Stock limitado: solo podés armar {calculo.stockMax} combo{calculo.stockMax !== 1 ? 's' : ''}</p>
                </div>
              )}
            </Card>
          )}

          {/* Paso 3: a quién enviar */}
          {calculo && calculo.ganancia > 0 && (
            <Card className="p-4 space-y-3">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Paso 3 — ¿A quién enviarlo?</p>
              <div className="grid grid-cols-2 gap-2">
                {['todos', ...Object.keys(SEGMENTOS)].map(seg => {
                  const count = seg === 'todos' ? clientesRFM.length : clientesRFM.filter(c => c.segmento === seg).length;
                  if (count === 0) return null;
                  const info = seg === 'todos' ? { emoji: '👥', label: 'Todos', color: 'text-white' } : SEGMENTOS[seg];
                  return (
                    <button
                      key={seg}
                      onClick={() => setSegmentoFiltro(seg)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        segmentoFiltro === seg
                          ? seg === 'todos' ? 'bg-white/[0.08] border-white/[0.20]' : SEGMENTOS[seg]?.bg
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{info.emoji}</span>
                        <span className={`text-[16px] font-black tabular-nums ${segmentoFiltro === seg ? info.color : 'text-white'}`}>{count}</span>
                      </div>
                      <p className={`text-[11px] font-semibold mt-1 ${segmentoFiltro === seg ? info.color : 'text-zinc-500'}`}>{info.label}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-600 text-center">
                Se generarán mensajes para <strong className="text-zinc-400">{clientesFiltrados.length} clientes</strong>
              </p>
            </Card>
          )}

          {/* Preview mensaje */}
          {calculo && calculo.ganancia > 0 && prod1 && prod2 && (
            <div className="bg-[#075E54]/20 border border-[#075E54]/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                  <MessageCircle className="w-3 h-3 text-[#25D366]" />
                </div>
                <span className="text-[11px] text-zinc-500">Preview WhatsApp · {companyName}</span>
              </div>
              <p className="text-[12px] text-zinc-400 whitespace-pre-line leading-relaxed">
                {MENSAJES['regular']('Cliente', `${prod1.name} + ${prod2.name} → ${CLP(calculo.precioPromo)} (normal ${CLP(calculo.precioNormal)})`)}
              </p>
            </div>
          )}

          {/* Botones: generar mensajes + activar en caja */}
          <div className="space-y-2">
            <button
              onClick={generarMensajes}
              disabled={!prod1 || !prod2 || !calculo || calculo.ganancia <= 0 || generando}
              className={`w-full py-3.5 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 border-none ${
                !prod1 || !prod2 || !calculo || calculo.ganancia <= 0
                  ? 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                  : generando
                    ? 'bg-violet-600/50 text-violet-300 cursor-not-allowed'
                    : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/25 cursor-pointer'
              }`}
            >
              {generando
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando mensajes...</>
                : <><Sparkles className="w-4 h-4" /> Generar {clientesFiltrados.length} mensajes <ArrowRight className="w-4 h-4" /></>
              }
            </button>

            {/* Activar combo en caja */}
            {calculo && calculo.ganancia > 0 && (
              <button
                onClick={guardarPromoEnCaja}
                disabled={guardandoPromo || promoGuardadaOk}
                className={`w-full py-3 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 border-none ${
                  promoGuardadaOk
                    ? 'bg-emerald-600/20 text-emerald-400 cursor-default border border-emerald-600/30'
                    : guardandoPromo
                      ? 'bg-white/[0.04] text-zinc-500 cursor-not-allowed'
                      : 'bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-600/25 cursor-pointer'
                }`}
              >
                {promoGuardadaOk
                  ? <><Check className="w-4 h-4" /> ¡Combo activado! Ya aparece en el módulo de ventas</>
                  : guardandoPromo
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    : <><ShoppingCart className="w-4 h-4" /> Activar combo en caja</>
                }
              </button>
            )}
            {calculo && calculo.ganancia > 0 && !promoGuardadaOk && (
              <p className="text-center text-[10px] text-zinc-600">
                Al activar, el vendedor podrá seleccionar este combo directamente desde el módulo de ventas
              </p>
            )}
          </div>
          {(!prod1 || !prod2) && (
            <p className="text-center text-[11px] text-zinc-600">Selecciona los dos productos primero</p>
          )}
        </div>
      )}

      {/* ── COMBOS ACTIVOS ── */}
      {activeSection === 'combos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-white">Combos activos en caja</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Estos combos están disponibles para el vendedor al registrar una venta</p>
            </div>
          </div>

          {promosGuardadas.length === 0 ? (
            <Card className="p-8 text-center">
              <ShoppingCart className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-500 mb-1">No hay combos activos</p>
              <p className="text-[11px] text-zinc-600">Ve a <strong className="text-zinc-400">Crear promo</strong> y activa un combo en caja</p>
              <button
                onClick={() => setActiveSection('promos')}
                className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors cursor-pointer border-none"
              >
                Crear promo
              </button>
            </Card>
          ) : (
            promosGuardadas.map(promo => (
              <Card key={promo.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <p className="text-[13px] font-bold text-white truncate">{promo.nombre}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="bg-white/[0.04] rounded-lg p-2 text-center">
                        <p className="text-[10px] text-zinc-500 mb-0.5">Precio combo</p>
                        <p className="text-[13px] font-black text-emerald-400 tabular-nums">{CLP(promo.precioPromo)}</p>
                      </div>
                      <div className="bg-white/[0.04] rounded-lg p-2 text-center">
                        <p className="text-[10px] text-zinc-500 mb-0.5">Precio normal</p>
                        <p className="text-[12px] font-bold text-zinc-500 line-through tabular-nums">{CLP(promo.precioNormal)}</p>
                      </div>
                      <div className="bg-white/[0.04] rounded-lg p-2 text-center">
                        <p className="text-[10px] text-zinc-500 mb-0.5">Ganancia</p>
                        <p className="text-[13px] font-black text-white tabular-nums">+{CLP(promo.ganancia)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-2">
                      {promo.prod1?.name} + {promo.prod2?.name} · {promo.margen?.toFixed(0)}% margen
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarPromo(promo.id)}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border-none bg-transparent shrink-0"
                    title="Desactivar combo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── MENSAJES ── */}
      {activeSection === 'mensajes' && (
        <div className="space-y-4">
          {!mensajesGenerados || !comboFinal ? (
            <Card className="p-10 text-center">
              <MessageCircle className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-500 mb-1">Todavía no generaste mensajes</p>
              <p className="text-[11px] text-zinc-500">Ve a <strong className="text-zinc-400">Crear promo</strong>, elige los productos y presiona Generar</p>
              <button
                onClick={() => setActiveSection('promos')}
                className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors cursor-pointer border-none"
              >
                Ir a Crear promo
              </button>
            </Card>
          ) : (
            <>
              {/* Info combo */}
              <div className="p-3 rounded-xl bg-violet-500/[0.08] border border-violet-500/[0.20] flex items-center gap-3">
                <ShoppingBag className="w-4 h-4 text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-white truncate">
                    {comboFinal.p1.name} + {comboFinal.p2.name}
                  </p>
                  <p className="text-[10px] text-violet-400">
                    {CLP(comboFinal.precioPromo)} · {comboFinal.margen.toFixed(0)}% margen · +{CLP(comboFinal.ganancia)} por combo
                  </p>
                </div>
                <button
                  onClick={() => setActiveSection('promos')}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 border-none bg-transparent cursor-pointer"
                >
                  Cambiar
                </button>
              </div>

              {/* Filtros segmento */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {['todos', 'vip', 'riesgo', 'nuevo', 'perdido', 'regular'].map(seg => {
                  const count = seg === 'todos' ? clientesRFM.length : clientesRFM.filter(c => c.segmento === seg).length;
                  return (
                    <button
                      key={seg}
                      onClick={() => setSegmentoFiltro(seg)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                        segmentoFiltro === seg
                          ? 'bg-violet-600 text-white border-transparent'
                          : 'bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300'
                      }`}
                    >
                      {seg === 'todos' ? '👥 Todos' : `${SEGMENTOS[seg]?.emoji} ${SEGMENTOS[seg]?.label}`}
                      <span className="ml-1 opacity-50">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Instrucción */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#25D366]/[0.06] border border-[#25D366]/[0.15]">
                <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                <p className="text-[12px] text-zinc-400 leading-relaxed">
                  Copia el mensaje de cada cliente y envíalo por WhatsApp. Cada uno está personalizado según su historial de compras.
                </p>
              </div>

              {/* Lista */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {clientesFiltrados.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-[13px] text-zinc-600">Sin clientes en este segmento</p>
                  </Card>
                ) : (
                  clientesFiltrados.map((c, i) => (
                    <MensajeCard key={i} cliente={c} comboTexto={comboTexto} />
                  ))
                )}
              </div>

              {/* Resumen campaña */}
              <Card className="p-4">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Resumen de campaña</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Clientes a contactar', val: clientesFiltrados.length, color: 'text-white' },
                    { label: 'Combos que podés armar', val: comboFinal.stockMax, color: 'text-white' },
                    { label: 'Te ganás por combo', val: CLP(comboFinal.ganancia), color: 'text-emerald-400' },
                    { label: 'Si 3 de 10 compran', val: CLP(Math.round(clientesFiltrados.length * 0.3) * comboFinal.ganancia), color: 'text-violet-400' },
                  ].map((k, i) => (
                    <div key={i} className="bg-white/[0.06] rounded-xl p-3 border border-white/[0.08]">
                      <p className="text-[10px] text-zinc-600 mb-1">{k.label}</p>
                      <p className={`text-[15px] font-black tabular-nums ${k.color}`}>{k.val}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
