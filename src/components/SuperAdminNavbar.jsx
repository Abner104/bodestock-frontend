// src/components/SuperAdminNavbar.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase.js";
import { collection, getDocs, query, where } from "firebase/firestore";
import { gsap } from "gsap";
import {
  Shield, Gift, CreditCard, Building2, BarChart3,
  LogOut, Home, Search, Menu, X, ChevronRight, Sparkles,
} from "lucide-react";
import { cn } from "../lib/cn";
import { CommandPalette } from "./ui/sa-command";
import SAIsland from "./ui/sa-island";

const NAV_ITEMS = [
  { label: "Dashboard", icon: Home,       path: "/super-admin" },
  { label: "Empresas",  icon: Building2,  path: "/super-admin/empresas" },
  { label: "Agentes",   icon: Sparkles,   path: "/super-admin/agentes" },
  { label: "Analytics", icon: BarChart3,  path: "/super-admin/analytics" },
  { label: "Referidos", icon: Gift,       path: "/super-admin/referidos" },
  { label: "Planes",    icon: CreditCard, path: "/super-admin/planes" },
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

export default function SuperAdminNavbar() {
  const [mobileOpen, setMobileOpen]       = useState(false);
  const [commandOpen, setCommandOpen]     = useState(false);
  const [avatarOpen, setAvatarOpen]       = useState(false);
  const [billingAlerts, setBillingAlerts] = useState([]);

  const navRef     = useRef(null);
  const mobileRef  = useRef(null);
  const avatarRef  = useRef(null);
  const navigate   = useNavigate();
  const location   = useLocation();

  /* entrance */
  useEffect(() => {
    if (navRef.current)
      gsap.fromTo(navRef.current,
        { y: -56, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }
      );
  }, []);

  /* billing alerts */
  useEffect(() => {
    getDocs(query(collection(db, "companies"), where("status", "==", "active")))
      .then((snap) => {
        const today = new Date();
        setBillingAlerts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => {
            if (!c.nextBillingDate || c.plan === "trial" || c.plan === "free") return false;
            const bd = c.nextBillingDate?.toDate ? c.nextBillingDate.toDate() : new Date(c.nextBillingDate);
            return bd < today;
          })
        );
      })
      .catch(() => {});
  }, []);

  /* avatar dropdown animation */
  useEffect(() => {
    const el = avatarRef.current?.querySelector(".dd-avatar");
    if (el && avatarOpen)
      gsap.fromTo(el,
        { opacity: 0, y: -6, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.16, ease: "power2.out" }
      );
  }, [avatarOpen]);

  /* mobile menu animation */
  useEffect(() => {
    const el = mobileRef.current;
    if (!el || !mobileOpen) return;
    gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" });
  }, [mobileOpen]);

  /* outside click — solo avatar */
  useEffect(() => {
    const h = (e) => {
      if (!avatarRef.current?.contains(e.target)) setAvatarOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ⌘K */
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const logout = async () => { try { await signOut(auth); navigate("/login"); } catch {} };

  const isActive = (path) =>
    path === "/super-admin"
      ? location.pathname === "/super-admin"
      : location.pathname.startsWith(path);

  const go = (path) => { navigate(path); setMobileOpen(false); };

  return (
    <>
      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <nav
        ref={navRef}
        className="sa-nav fixed top-0 left-0 right-0 z-50"
        style={{
          background: "rgba(9,9,11,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.055)",
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-12 flex items-center gap-3">

          {/* Logo */}
          <NavBtn onClick={() => go("/super-admin")} className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold text-sm hidden sm:block">Bodestock</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/12 text-blue-400 border border-blue-500/20 tracking-widest uppercase hidden md:block">
              SA
            </span>
          </NavBtn>

          <div className="hidden lg:block h-4 w-px bg-white/[0.07] shrink-0" />

          {/* Nav links — desktop */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1">
            {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
              const active = isActive(path);
              return (
                <NavBtn
                  key={path}
                  onClick={() => go(path)}
                  style={active ? { border: "1px solid rgba(59,130,246,0.22)" } : { border: "none" }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all",
                    active
                      ? "bg-blue-500/10 text-blue-400"
                      : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </NavBtn>
              );
            })}
          </div>

          {/* Spacer mobile */}
          <div className="flex-1 lg:hidden" />

          {/* Right cluster */}
          <div className="flex items-center gap-1">

            {/* Search */}
            <NavBtn
              onClick={() => setCommandOpen(true)}
              title="Búsqueda (⌘K)"
              className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
            </NavBtn>

            {/* Mobile hamburger */}
            <NavBtn
              onClick={() => setMobileOpen((v) => !v)}
              className="hamburger-btn lg:hidden flex w-8 h-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </NavBtn>

            {/* Avatar */}
            <div ref={avatarRef} className="relative">
              <NavBtn
                onClick={() => setAvatarOpen((v) => !v)}
                className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-[11px] ring-2 ring-blue-500/25 hover:ring-blue-500/50 transition-all"
              >
                SA
              </NavBtn>

              {avatarOpen && (
                <div className="dd-avatar absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/[0.08] bg-[#111118] shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-white font-semibold text-sm">Super Admin</p>
                    <p className="text-zinc-500 text-xs truncate">{auth.currentUser?.email}</p>
                  </div>
                  <div className="p-1.5">
                    <NavBtn
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar Sesión
                    </NavBtn>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Dynamic Island (centrado, encima del navbar) ─────────────── */}
      <SAIsland billingAlerts={billingAlerts} />

      {/* ── Overlay para cerrar mobile menu ─────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30"
          onPointerDown={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile menu card ─────────────────────────────────────────── */}
      <div
        ref={mobileRef}
        className="lg:hidden fixed top-14 left-3 right-3 z-40"
        style={{ display: mobileOpen ? "block" : "none" }}
      >
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#0f0f12] overflow-hidden"
          style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
        >
          <div className="p-2">
            {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
              const active = isActive(path);
              return (
                <NavBtn
                  key={path}
                  onClick={() => go(path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left",
                    active
                      ? "bg-blue-500/12 text-blue-400"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                </NavBtn>
              );
            })}
          </div>

          <div className="h-px bg-white/[0.05] mx-3" />

          <div className="p-2">
            <NavBtn
              onClick={() => { setCommandOpen(true); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors text-left"
            >
              <Search className="w-4 h-4 shrink-0" />
              Búsqueda rápida
              <span className="ml-auto text-[10px] text-zinc-600 font-mono">⌘K</span>
            </NavBtn>

            <NavBtn
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Cerrar Sesión
            </NavBtn>
          </div>
        </div>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  );
}
