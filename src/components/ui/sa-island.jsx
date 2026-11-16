// src/components/ui/sa-island.jsx — Dynamic Island con mensajes rotativos
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { Bell, ChevronRight, X, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";

// ── Mensajes dinámicos por contexto ──────────────────────────────────────────
function getBillingMessages(alerts) {
  const n = alerts.length;
  const name = alerts[0]?.name || "una empresa";
  return [
    { text: `${n} pago${n > 1 ? "s" : ""} vencido${n > 1 ? "s" : ""}`, icon: Bell, color: "text-red-400" },
    { text: `${name} está esperando`, icon: AlertTriangle, color: "text-amber-400" },
    { text: n > 1 ? `${n} clientes sin cobrar` : "1 cliente sin cobrar", icon: TrendingUp, color: "text-orange-400" },
    { text: "Revisar facturación →", icon: Zap, color: "text-red-300" },
  ];
}

const IDLE_MESSAGES = [
  { text: "Todo tranquilo por aquí", icon: Zap, color: "text-zinc-500" },
  { text: "Sistema operativo", icon: Zap, color: "text-emerald-500" },
  { text: "Bodestock Admin", icon: Zap, color: "text-blue-400" },
];

export default function SAIsland({ billingAlerts = [], hidden = false }) {
  const navigate       = useNavigate();
  const pillRef        = useRef(null);
  const textRef        = useRef(null);
  const expandedRef    = useRef(null);
  const [state, setState]       = useState("idle");
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible]   = useState(true);

  const hasBilling = billingAlerts.length > 0;
  const messages   = hasBilling ? getBillingMessages(billingAlerts) : IDLE_MESSAGES;
  const currentMsg = messages[msgIndex % messages.length];

  // ── Mount animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!pillRef.current) return;
    gsap.fromTo(pillRef.current,
      { y: -32, opacity: 0, scale: 0.7 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.6)", delay: 0.7 }
    );
  }, []);

  // ── Auto-expand to compact when billing loads ─────────────────────────────
  useEffect(() => {
    if (!hasBilling) return;
    const t = setTimeout(() => {
      setState("compact");
      if (pillRef.current)
        gsap.to(pillRef.current, { scale: 1.1, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.inOut" });
    }, 1600);
    return () => clearTimeout(t);
  }, [hasBilling]);

  // ── Rotate messages every 3s (compact state only) ────────────────────────
  useEffect(() => {
    if (state !== "compact" || messages.length <= 1) return;
    const t = setInterval(() => {
      // fade out
      if (textRef.current) {
        gsap.to(textRef.current, {
          opacity: 0, y: -6, duration: 0.2, ease: "power2.in",
          onComplete: () => {
            setMsgIndex(i => (i + 1) % messages.length);
            // fade in
            if (textRef.current)
              gsap.fromTo(textRef.current,
                { opacity: 0, y: 6 },
                { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }
              );
          }
        });
      }
    }, 3000);
    return () => clearInterval(t);
  }, [state, messages.length]);

  // ── Pill morph on state change ────────────────────────────────────────────
  useEffect(() => {
    if (!pillRef.current) return;
    const configs = {
      idle:     { width: 88,  height: 26, borderRadius: 20, duration: 0.38, ease: "power3.inOut" },
      compact:  { width: 176, height: 30, borderRadius: 20, duration: 0.36, ease: "back.out(1.3)" },
      expanded: { width: 296, height: 228, borderRadius: 22, duration: 0.4, ease: "power3.inOut" },
    };
    const cfg = configs[state];
    if (cfg) gsap.to(pillRef.current, cfg);
  }, [state]);

  // ── Expanded content entrance ─────────────────────────────────────────────
  useEffect(() => {
    if (state === "expanded" && expandedRef.current)
      gsap.fromTo(expandedRef.current,
        { opacity: 0, y: -4 },
        { opacity: 1, y: 0, duration: 0.22, delay: 0.18, ease: "power2.out" }
      );
  }, [state]);

  const handleClick = () => {
    if (!hasBilling && state === "idle") return;
    if (state === "compact") setState("expanded");
    else if (state === "expanded") setState("compact");
    else if (state === "idle" && hasBilling) setState("compact");
  };

  const handleClose = (e) => {
    e.stopPropagation();
    gsap.to(pillRef.current, {
      scale: 0.85, opacity: 0, duration: 0.2, ease: "power2.in",
      onComplete: () => {
        setState("idle");
        gsap.to(pillRef.current, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.4)" });
      }
    });
  };

  const goToCompany = (id) => {
    navigate(`/super-admin/empresa/${id}`);
    setState("idle");
  };

  const Icon = currentMsg.icon;

  return (
    // Centered at top, lives in the navbar zone
    <div
      className="sa-island-wrapper fixed left-0 right-0 flex justify-center pointer-events-none transition-opacity duration-200"
      style={{ top: 9, opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : undefined, zIndex: hidden ? 30 : 60 }}
    >
      <div
        ref={pillRef}
        onClick={handleClick}
        className={cn(
          "relative pointer-events-auto select-none overflow-hidden",
          "bg-[#050507]",
          hasBilling ? "cursor-pointer" : state !== "idle" ? "cursor-pointer" : "cursor-default",
        )}
        style={{
          width: 88,
          height: 26,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: hasBilling
            ? "0 2px 20px rgba(239,68,68,0.15), 0 0 0 1px rgba(239,68,68,0.1), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 2px 16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >

        {/* ── IDLE ── dot + optional bell ──────────────────────────── */}
        {state === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full shrink-0",
              hasBilling ? "bg-red-500 shadow-sm shadow-red-500/60" : "bg-blue-500 shadow-sm shadow-blue-500/50"
            )} />
            {hasBilling && (
              <div className="relative">
                <Bell className="w-3 h-3 text-zinc-500" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full flex items-center justify-center text-[7px] font-bold text-white leading-none">
                  {billingAlerts.length}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── COMPACT ── mensaje rotativo ───────────────────────────── */}
        {state === "compact" && (
          <div ref={textRef} className="absolute inset-0 flex items-center justify-between px-3 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Icon className={cn("w-3 h-3 shrink-0", currentMsg.color)} />
              <span className="text-white text-[11px] font-semibold truncate leading-none">
                {currentMsg.text}
              </span>
            </div>
            <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
          </div>
        )}

        {/* ── EXPANDED ── panel completo ────────────────────────────── */}
        {state === "expanded" && (
          <div ref={expandedRef} className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold leading-tight">Pagos vencidos</p>
                  <p className="text-zinc-600 text-[10px] leading-tight mt-0.5">
                    {billingAlerts.length} empresa{billingAlerts.length > 1 ? "s" : ""} pendiente{billingAlerts.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{ border: "none", background: "transparent", padding: 0 }}
                className="w-6 h-6 rounded-full bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.06] mx-3 shrink-0" />

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {billingAlerts.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  onClick={(e) => { e.stopPropagation(); goToCompany(c.id); }}
                  style={{ border: "none", background: "transparent", padding: 0, width: "100%", textAlign: "left" }}
                  className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-[10px] font-bold shrink-0">
                    {c.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[11px] font-medium truncate group-hover:text-red-300 transition-colors">
                      {c.name || c.id}
                    </p>
                    <p className="text-red-500/60 text-[9px] leading-tight">pago vencido</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-3 pb-3">
              <button
                onClick={(e) => { e.stopPropagation(); navigate("/super-admin/empresas"); setState("idle"); }}
                style={{ border: "none", background: "transparent", padding: 0, width: "100%", textAlign: "center" }}
                className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-400 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Ver todas las empresas →
              </button>
            </div>
          </div>
        )}

        {/* Shimmer — idle only */}
        {state === "idle" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: "inherit",
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "sa-shimmer 3s ease infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}
