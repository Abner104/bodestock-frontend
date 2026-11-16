// src/components/SuperAdminLayout.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase.js";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  Shield, Gift, CreditCard, Building2, BarChart3,
  LogOut, Home, Search, Menu, X, CalendarDays,
  Bell, Wallet, MoreHorizontal, ChevronRight, Sparkles, Map, Box,
} from "lucide-react";
import { cn } from "../lib/cn";
import { CommandPalette } from "./ui/sa-command";

// ── Navegación principal (lo que usas a diario) ──────────
const NAV_MAIN = [
  { label: "Dashboard",  icon: Home,         path: "/super-admin" },
  { label: "Empresas",   icon: Building2,    path: "/super-admin/empresas" },
  { label: "Agentes",    icon: Sparkles,     path: "/super-admin/agentes" },
  { label: "Ingresos",   icon: Wallet,       path: "/super-admin/ingresos" },
  { label: "Calendario", icon: CalendarDays, path: "/super-admin/calendario" },
  { label: "Analytics",  icon: BarChart3,    path: "/super-admin/analytics" },
];

// ── Secciones secundarias (acceso desde "Más") ───────────
const NAV_MORE = [
  { label: "Referidos",     icon: Gift,         path: "/super-admin/referidos" },
  { label: "Planes",        icon: CreditCard,   path: "/super-admin/planes" },
  { label: "Map Designer",  icon: Map,          path: "/super-admin/map-designer" },
  { label: "Bodestock World", icon: Sparkles,   path: "/super-admin/bodestock-world" },
  { label: "Ciudad 3D",       icon: Box,        path: "/super-admin/ciudad-3d" },
];

function NavBtn({ children, className, ...props }) {
  return (
    <button
      style={{ border: "none", padding: 0, background: "transparent" }}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export default function SuperAdminLayout({ children }) {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [showMore, setShowMore]       = useState(false);
  const [billingAlerts, setBillingAlerts] = useState([]);

  // Forzar dark
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    return () => {
      const appTheme = localStorage.getItem('bodestock-theme') || 'dark';
      if (appTheme !== 'dark') root.classList.remove('dark');
    };
  }, []);

  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    getDocs(query(collection(db, "companies"), where("status", "==", "active")))
      .then((snap) => {
        const today = new Date();
        setBillingAlerts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => {
            if (!c.nextBillingDate || c.plan === "trial" || c.plan === "free") return false;
            const bd = c.nextBillingDate?.toDate ? c.nextBillingDate.toDate() : new Date(c.nextBillingDate);
            return Math.ceil((bd - today) / (1000 * 60 * 60 * 24)) <= 3;
          })
        );
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCommandOpen(v => !v); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const logout = async () => { try { await signOut(auth); navigate("/login"); } catch {} };

  const isActive = (path) =>
    path === "/super-admin"
      ? location.pathname === "/super-admin"
      : location.pathname.startsWith(path);

  const go = (path) => { navigate(path); setMobileOpen(false); setShowMore(false); };

  const allItems = [...NAV_MAIN, ...NAV_MORE];
  const currentPage = allItems.find((i) => isActive(i.path));
  const userInitial = auth.currentUser?.email?.charAt(0).toUpperCase() || 'S';

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">

      {/* Mobile overlay del sidebar */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ── SIDEBAR desktop ───────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col w-[220px]",
        "border-r border-white/[0.08]",
        "bg-zinc-900",
        "transition-transform duration-250 ease-in-out",
        "lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      )}>

        {/* Logo */}
        <div className="flex items-center justify-between h-[56px] px-4 border-b border-white/[0.08] shrink-0">
          <NavBtn onClick={() => go("/super-admin")} className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-zinc-950" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-none">Bodestock</p>
              <p className="text-zinc-500 text-[10px] leading-none mt-0.5 uppercase tracking-wide">
                Super Admin
              </p>
            </div>
          </NavBtn>
          <NavBtn
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </NavBtn>
        </div>

        {/* Búsqueda */}
        <div className="px-3 pt-3 pb-2">
          <NavBtn
            onClick={() => setCommandOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] transition-all text-left"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-[12px]">Buscar...</span>
            <kbd className="text-[9px] font-mono bg-white/[0.06] text-zinc-500 px-1.5 py-0.5 rounded">⌘K</kbd>
          </NavBtn>
        </div>

        {/* Nav principal */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          {NAV_MAIN.map(({ label, icon: Icon, path }) => {
            const active = isActive(path);
            return (
              <NavBtn
                key={path}
                onClick={() => go(path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 text-left relative",
                  active
                    ? "bg-white/[0.10] text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
                )}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full" />}
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-zinc-500")} />
                <span>{label}</span>
                {path === "/super-admin/calendario" && billingAlerts.length > 0 && (
                  <span className="ml-auto w-5 h-5 bg-amber-500 rounded-full text-[9px] font-bold text-zinc-950 flex items-center justify-center">
                    {billingAlerts.length}
                  </span>
                )}
              </NavBtn>
            );
          })}

          {/* Separador + Más */}
          <div className="pt-2 mt-2 border-t border-white/[0.06]">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-3 mb-1.5">Más</p>
            {NAV_MORE.map(({ label, icon: Icon, path }) => {
              const active = isActive(path);
              return (
                <NavBtn
                  key={path}
                  onClick={() => go(path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-all text-left",
                    active ? "bg-white/[0.10] text-white font-semibold" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-zinc-600")} />
                  <span>{label}</span>
                </NavBtn>
              );
            })}
          </div>
        </nav>

        {/* Alertas de cobro */}
        {billingAlerts.length > 0 && (
          <div className="mx-3 mb-2 p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/[0.20]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Bell className="w-3 h-3 text-amber-400 shrink-0" />
              <p className="text-amber-400 text-[11px] font-semibold">
                {billingAlerts.length} cobro{billingAlerts.length > 1 ? 's' : ''} próximo{billingAlerts.length > 1 ? 's' : ''}
              </p>
            </div>
            {billingAlerts.slice(0, 2).map(c => (
              <NavBtn key={c.id} onClick={() => go(`/super-admin/empresa/${c.id}`)} className="w-full text-left">
                <p className="text-amber-400/70 text-[11px] truncate flex items-center gap-1 hover:text-amber-300 transition-colors">
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  {c.name}
                </p>
              </NavBtn>
            ))}
          </div>
        )}

        {/* Footer usuario */}
        <div className="shrink-0 p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 bg-gradient-to-br from-zinc-600 to-zinc-700 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ring-1 ring-white/[0.12]">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-200 text-[12px] font-semibold leading-none">Super Admin</p>
              <p className="text-zinc-500 text-[10px] truncate leading-none mt-0.5">
                {auth.currentUser?.email}
              </p>
            </div>
            <NavBtn
              onClick={logout}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.10] transition-colors shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </NavBtn>
          </div>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-[56px] px-4 bg-zinc-950/95 backdrop-blur-xl border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            {/* Botón menú mobile */}
            <NavBtn
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <Menu className="w-4 h-4" />
            </NavBtn>
            {/* Título página actual */}
            {currentPage && (
              <div className="flex items-center gap-2">
                <currentPage.icon className="w-4 h-4 text-zinc-500" />
                <span className="text-white text-sm font-semibold">{currentPage.label}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {billingAlerts.length > 0 && (
              <NavBtn
                onClick={() => go('/super-admin/calendario')}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg text-amber-400 bg-amber-500/[0.10] hover:bg-amber-500/[0.16] border border-amber-500/[0.20] transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-bold text-zinc-950 flex items-center justify-center">
                  {billingAlerts.length}
                </span>
              </NavBtn>
            )}
            <NavBtn
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[12px]">Buscar</span>
              <kbd className="hidden sm:inline text-[9px] font-mono text-zinc-600 bg-white/[0.05] px-1 py-0.5 rounded border border-white/[0.08]">⌘K</kbd>
            </NavBtn>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>

      {/* ── BOTTOM NAV MOBILE (solo en mobile) ───────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-zinc-900 border-t border-white/[0.10] flex items-center justify-around px-2 py-2 safe-area-bottom">
        {NAV_MAIN.slice(0, 4).map(({ label, icon: Icon, path }) => {
          const active = isActive(path);
          return (
            <NavBtn
              key={path}
              onClick={() => go(path)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-0",
                active ? "text-white" : "text-zinc-500"
              )}
            >
              <div className={cn(
                "w-8 h-8 flex items-center justify-center rounded-xl transition-all relative",
                active ? "bg-white/[0.12]" : ""
              )}>
                <Icon className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
                {path === "/super-admin/calendario" && billingAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full text-[8px] font-bold text-zinc-950 flex items-center justify-center">
                    {billingAlerts.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium truncate max-w-[52px] text-center">{label}</span>
            </NavBtn>
          );
        })}
        {/* Botón Más */}
        <div className="relative">
          <NavBtn
            onClick={() => setShowMore(v => !v)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all",
              showMore ? "text-white" : "text-zinc-500"
            )}
          >
            <div className={cn("w-8 h-8 flex items-center justify-center rounded-xl", showMore ? "bg-white/[0.12]" : "")}>
              <MoreHorizontal style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="text-[10px] font-medium">Más</span>
          </NavBtn>

          {/* Popup del menú Más */}
          {showMore && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMore(false)} />
              <div className="absolute bottom-full right-0 mb-2 z-20 bg-zinc-800 border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden w-44">
                {NAV_MORE.map(({ label, icon: Icon, path }) => (
                  <NavBtn
                    key={path}
                    onClick={() => go(path)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-[13px] transition-colors text-left border-b border-white/[0.06] last:border-0",
                      isActive(path) ? "text-white bg-white/[0.08]" : "text-zinc-300 hover:bg-white/[0.06]"
                    )}
                  >
                    <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                    {label}
                  </NavBtn>
                ))}
                <NavBtn
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-400 hover:bg-red-500/[0.08] transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Cerrar sesión
                </NavBtn>
              </div>
            </>
          )}
        </div>
      </nav>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
