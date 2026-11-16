// src/hooks/useAssistantContext.js
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';

/**
 * Hook para capturar contexto inteligente del agente AI
 * Detecta automáticamente página, datos visibles, acciones recientes
 */
export const useAssistantContext = (additionalContext = {}) => {
  const location = useLocation();
  const [context, setContext] = useState({});

  useEffect(() => {
    // Detectar página actual
    const page = location.pathname;
    const pageName = getPageName(page);

    // Construir contexto base
    const baseContext = {
      page,
      pageName,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      ...additionalContext
    };

    setContext(baseContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Solo depender del pathname, no del objeto completo

  return context;
};

/**
 * Detecta el nombre legible de la página actual
 */
const getPageName = (path) => {
  const routes = {
    '/': 'Dashboard Principal',
    '/dashboard': 'Dashboard',
    '/inventario': 'Gestión de Inventario',
    '/productos': 'Catálogo de Productos',
    '/bodegas': 'Gestión de Bodegas',
    '/trabajadores': 'Gestión de Trabajadores',
    '/salidas': 'Salidas de Inventario',
    '/reportes': 'Reportes y Análisis',
    '/perfil': 'Perfil de Usuario',
    '/costeo': 'Wizard de Costeo'
  };

  // Buscar ruta exacta
  if (routes[path]) return routes[path];

  // Buscar ruta parcial
  for (const [route, name] of Object.entries(routes)) {
    if (path.startsWith(route) && route !== '/') {
      return name;
    }
  }

  return 'Página desconocida';
};

/**
 * Hook para rastrear acciones recientes del usuario
 * Mantiene un historial de las últimas 10 acciones
 */
export const useRecentActions = () => {
  const [actions, setActions] = useState(() => {
    try {
      const saved = localStorage.getItem('recentActions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addAction = (action) => {
    setActions(prev => {
      const newActions = [
        {
          ...action,
          timestamp: new Date().toISOString()
        },
        ...prev
      ].slice(0, 10); // Mantener solo las últimas 10

      // Guardar en localStorage
      try {
        localStorage.setItem('recentActions', JSON.stringify(newActions));
      } catch (err) {
        console.error('Error guardando acciones recientes:', err);
      }

      return newActions;
    });
  };

  const clearActions = () => {
    setActions([]);
    localStorage.removeItem('recentActions');
  };

  return { actions, addAction, clearActions };
};

/**
 * Formatea el contexto para enviarlo al backend
 */
export const formatContextForBackend = (context, recentActions = []) => {
  return {
    page: context.pageName || context.page,
    currentPath: context.page,
    recentActions: recentActions.map(a => ({
      type: a.type,
      description: a.description,
      timestamp: a.timestamp
    })),
    selectedItem: context.selectedItem,
    filters: context.filters,
    viewMode: context.viewMode,
    companyId: context.companyId
  };
};

/**
 * Hook que carga contexto real de Firestore cuando el asistente se abre.
 * Refresca cada 5 minutos máximo para no saturar lecturas.
 */
const REFRESH_MS = 5 * 60 * 1000;

export function useRealCompanyContext(isOpen) {
  const [companyContext, setCompanyContext] = useState(null);
  const lastFetch = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const now = Date.now();
    if (lastFetch.current && now - lastFetch.current < REFRESH_MS) return;

    const load = async () => {
      try {
        const companyId = await getUserCompanyId();
        if (!companyId) return;

        // 1. Leer inventarios dinámicos (nueva estructura) + exits en paralelo
        const [inventoriesSnap, exitsSnap] = await Promise.all([
          getDocs(collection(db, `companies/${companyId}/inventories`)),
          getDocs(
            query(
              collection(db, `companies/${companyId}/exits`),
              orderBy('timestamp', 'desc'),
              limit(5)
            )
          ).catch(() => ({ docs: [] }))
        ]);

        // 2. Para cada inventario dinámico, leer sus productos
        const inventariosMeta = inventoriesSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id,
          type: d.data().type || 'GENERAL'
        }));

        const productosporInventario = await Promise.all(
          inventariosMeta.map(async inv => {
            const snap = await getDocs(
              collection(db, `companies/${companyId}/inventories/${inv.id}/products`)
            );
            return {
              inventario: inv.name,
              tipo: inv.type,
              productos: snap.docs.map(d => ({ id: d.id, ...d.data(), _inventario: inv.name }))
            };
          })
        );

        // 3. Leer inventario legacy también
        const legacySnap = await getDocs(
          collection(db, `companies/${companyId}/inventory`)
        ).catch(() => ({ docs: [] }));

        const legacyProducts = legacySnap.docs.map(d => ({
          id: d.id, ...d.data(), _inventario: 'Principal'
        }));

        // 4. Unir todos los productos
        const allProducts = [
          ...legacyProducts,
          ...productosporInventario.flatMap(i => i.productos)
        ];

        const stockProducts = allProducts.filter(p => {
          const isElaborado = p.productType === 'ELABORADO' || (Array.isArray(p.receta) && p.receta.length > 0);
          return !isElaborado;
        });

        const outOfStock = stockProducts
          .filter(p => p.stock === 0)
          .map(p => `${p.name} (${p._inventario})`);

        const critical = stockProducts
          .filter(p => p.stock > 0 && p.stock <= 5)
          .map(p => `${p.name} (${p._inventario})`);

        const topProducts = [...stockProducts]
          .sort((a, b) => (b.stock || 0) - (a.stock || 0))
          .slice(0, 5)
          .map(p => `${p.name} (${p.stock} ${p.unit || 'u'}) — ${p._inventario}`);

        // 5. Resumen por inventario (para que Claude sepa qué tiene cada sucursal)
        const resumenPorInventario = [
          ...(legacyProducts.length > 0 ? [{
            nombre: 'Principal (legacy)',
            total: legacyProducts.length
          }] : []),
          ...productosporInventario
            .filter(i => i.productos.length > 0)
            .map(i => ({ nombre: `${i.inventario} (${i.tipo})`, total: i.productos.length }))
        ];

        const recentExits = exitsSnap.docs.map(d => {
          const data = d.data();
          const date = data.timestamp?.toDate?.()?.toLocaleDateString('es-CL') || 'reciente';
          const prods = Array.isArray(data.products)
            ? data.products.map(p => `${p.quantity} ${p.name}`).join(', ')
            : data.productName || 'sin detalle';
          return `[${date}] ${prods}`;
        });

        lastFetch.current = now;
        setCompanyContext({
          companyId,
          totalProducts: allProducts.length,
          resumenPorInventario,
          outOfStock,
          critical,
          topProducts,
          recentExits
        });
      } catch (err) {
        console.error('Error cargando contexto real:', err);
      }
    };

    load();
  }, [isOpen]);

  return companyContext;
}

/**
 * Convierte el contexto real en bloque de texto para el system prompt
 */
export function formatContextForPrompt(ctx) {
  if (!ctx) return '';
  const lines = [`📦 Total productos: ${ctx.totalProducts}`];

  // Resumen por inventario/sucursal
  if (ctx.resumenPorInventario?.length > 0) {
    lines.push(`🏪 Inventarios/Sucursales:`);
    ctx.resumenPorInventario.forEach(inv => {
      lines.push(`  • ${inv.nombre}: ${inv.total} productos`);
    });
  }

  if (ctx.outOfStock?.length) lines.push(`🔴 Sin stock: ${ctx.outOfStock.slice(0, 8).join(', ')}`);
  if (ctx.critical?.length) lines.push(`🟡 Stock crítico (≤5): ${ctx.critical.slice(0, 8).join(', ')}`);
  if (!ctx.outOfStock?.length && !ctx.critical?.length) lines.push('✅ Stock general en buen estado');
  if (ctx.topProducts?.length) lines.push(`📈 Mayor stock: ${ctx.topProducts.join(' | ')}`);
  if (ctx.recentExits?.length) lines.push(`📤 Últimas salidas: ${ctx.recentExits.join(' | ')}`);
  return lines.join('\n');
}
