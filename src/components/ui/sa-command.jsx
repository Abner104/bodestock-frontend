// src/components/ui/sa-command.jsx
// ⌘K Command palette for Super Admin
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import {
  Search, Home, Building2, BarChart3, Gift, CreditCard,
  X, ArrowRight, Building, Command,
} from 'lucide-react';
import { cn } from '../../lib/cn';

const STATIC_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',         category: 'Navegación', icon: Home,       path: '/super-admin' },
  { id: 'empresas',   label: 'Empresas',           category: 'Navegación', icon: Building2,  path: '/super-admin/empresas' },
  { id: 'analytics',  label: 'Analytics de Uso',  category: 'Navegación', icon: BarChart3,  path: '/super-admin/analytics' },
  { id: 'referidos',  label: 'Referidos',          category: 'Navegación', icon: Gift,       path: '/super-admin/referidos' },
  { id: 'planes',     label: 'Gestión de Planes',  category: 'Navegación', icon: CreditCard, path: '/super-admin/planes' },
];

const PLAN_LABELS = { trial: 'Trial', basico: 'Básico', profesional: 'Pro', personalizado: 'Custom', free: 'Free' };

export function CommandTrigger({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 text-xs transition-all cursor-pointer"
      title="Búsqueda rápida (Ctrl+K)"
    >
      <Search className="w-3.5 h-3.5" />
      <span>Buscar...</span>
      <div className="flex items-center gap-0.5 ml-1">
        <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono leading-none">⌘</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono leading-none">K</kbd>
      </div>
    </button>
  );
}

export function CommandPalette({ open, onClose }) {
  const [query_, setQuery] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const overlayRef = useRef(null);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // GSAP open animation
  useEffect(() => {
    if (!open || !overlayRef.current || !boxRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power2.out' });
    gsap.fromTo(boxRef.current, { opacity: 0, scale: 0.96, y: -8 }, { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'power3.out' });
    setQuery('');
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Load companies once on open
  useEffect(() => {
    if (!open || companies.length > 0) return;
    setLoadingCompanies(true);
    getDocs(query(collection(db, 'companies'), limit(100)))
      .then(snap => setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoadingCompanies(false));
  }, [open]);

  const filteredStatic = STATIC_ITEMS.filter(i =>
    i.label.toLowerCase().includes(query_.toLowerCase())
  );

  const filteredCompanies = companies
    .filter(c => c.name?.toLowerCase().includes(query_.toLowerCase()) || c.email?.toLowerCase().includes(query_.toLowerCase()))
    .slice(0, 6);

  const allItems = [
    ...filteredStatic.map(i => ({ ...i, type: 'nav' })),
    ...filteredCompanies.map(c => ({
      id: `company-${c.id}`,
      label: c.name || c.id,
      subtitle: c.email,
      category: 'Empresas',
      icon: Building,
      path: `/super-admin/empresa/${c.id}`,
      plan: c.plan,
      type: 'company',
    })),
  ];

  const handleSelect = useCallback((item) => {
    navigate(item.path);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query_]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allItems.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && allItems[activeIndex]) { handleSelect(allItems[activeIndex]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, allItems, activeIndex, handleSelect, onClose]);

  if (!open) return null;

  // Group by category
  const groups = allItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={boxRef}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[560px] bg-[#111118] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query_}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar página o empresa..."
            className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
          {query_ && (
            <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-1 rounded-md bg-white/[0.05] text-zinc-600 text-[11px] font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto py-2">
          {allItems.length === 0 && !loadingCompanies && (
            <p className="text-zinc-600 text-sm text-center py-10">Sin resultados para "{query_}"</p>
          )}
          {loadingCompanies && companies.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-6">Cargando empresas...</p>
          )}

          {Object.entries(groups).map(([category, items]) => (
            <div key={category}>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{category}</p>
              {items.map((item) => {
                const Icon = item.icon;
                const currentIndex = flatIndex++;
                const isActive = currentIndex === activeIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(currentIndex)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer bg-transparent border-0',
                      isActive ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                      item.type === 'company' ? 'bg-violet-500/10' : 'bg-zinc-800'
                    )}>
                      <Icon className={cn('w-3.5 h-3.5', item.type === 'company' ? 'text-violet-400' : 'text-zinc-400')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isActive ? 'text-white' : 'text-zinc-300')}>
                        {item.label}
                      </p>
                      {item.subtitle && <p className="text-zinc-600 text-xs truncate">{item.subtitle}</p>}
                    </div>
                    {item.plan && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-500 flex-shrink-0">
                        {PLAN_LABELS[item.plan] || item.plan}
                      </span>
                    )}
                    {isActive && <ArrowRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-3 text-[11px] text-zinc-700">
          <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
