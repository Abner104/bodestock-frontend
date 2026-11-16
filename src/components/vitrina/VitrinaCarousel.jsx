// src/components/vitrina/VitrinaCarousel.jsx
// Carrusel-vitrina: agrupa productos por categoría en filas horizontales (carrusel infinito
// centrado). Expone un ref con focusProduct(id) para saltar a un producto desde voz/escáner/búsqueda.

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import './vitrina.css';
import VitrinaCard from './VitrinaCard';
import { catColor } from './catColor';

// pid que un focusProduct() externo (búsqueda/voz/escáner) está intentando enfocar ahora mismo.
// Mientras esté seteado, el recenter() automático que corre al montar/remontar una fila (por
// cambio de filtro) NO debe pisar el scroll con su centrado por defecto — si no, compite con
// focusProduct por el mismo scrollTo y el que corre último "gana", mostrando otro producto.
let pendingFocusPid = null;

// ---------- una fila = una categoría ----------
const CategoryRow = forwardRef(function CategoryRow(
  { row, mode, isLast, cartQtyOf, canSeePrice, renderExtra, onAdd, onSetQty, onOpenDetail, onNotify, onFocusChange, registerRail, unregisterRail, reducedMotion },
  ref,
) {
  const railRef = useRef(null);
  const rafRef = useRef(null);
  const snapRef = useRef(null);
  const lastFocused = useRef(null);

  const items = row.items;
  const loop = items.length >= 3;
  const reps = loop ? 3 : 1;
  const seq = useMemo(() => {
    const out = [];
    for (let r = 0; r < reps; r += 1) items.forEach((p) => out.push(p));
    return out;
  }, [items, reps]);

  const cards = () => (railRef.current ? [...railRef.current.querySelectorAll('.vt-card')] : []);

  const centerCard = (el, smooth = true) => {
    const rail = railRef.current;
    if (!rail || !el) return;
    rail.scrollTo({
      left: el.offsetLeft + el.offsetWidth / 2 - rail.clientWidth / 2,
      behavior: smooth && !reducedMotion ? 'smooth' : 'auto',
    });
    // el foco visual es ÚNICO para todo el carrusel, no por fila: si no se limpia también en
    // OTRAS filas, una categoría que recién se monta (ej. reaparece al limpiar la búsqueda)
    // marca su propia primera card como enfocada sin saber que ya había otro producto elegido
    // en otra fila — quedan dos cards con el borde azul "seleccionado" a la vez.
    document.querySelectorAll('.vt-card.is-focused').forEach((c) => {
      if (c !== el) c.classList.remove('is-focused');
    });
    for (const c of cards()) c.classList.toggle('is-focused', c === el);
    if (el.dataset.pid !== lastFocused.current) {
      lastFocused.current = el.dataset.pid;
      onFocusChange?.(el.dataset.pid);
    }
  };

  const nearest = () => {
    const rail = railRef.current;
    if (!rail) return { best: null, dist: Infinity };
    const cx = rail.scrollLeft + rail.clientWidth / 2;
    let best = null;
    let dist = Infinity;
    for (const el of cards()) {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - cx);
      if (d < dist) { dist = d; best = el; }
    }
    return { best, dist };
  };

  const updateFocus = () => {
    const { best } = nearest();
    for (const el of cards()) el.classList.toggle('is-focused', el === best);
    if (best && best.dataset.pid !== lastFocused.current) {
      lastFocused.current = best.dataset.pid;
      onFocusChange?.(best.dataset.pid);
    }
  };

  const blockWidth = () => {
    const cs = cards();
    if (cs.length < 2 || !cs[items.length]) return 0;
    return cs[items.length].offsetLeft - cs[0].offsetLeft;
  };

  const recenter = () => {
    const cs = cards();
    if (!cs.length) return;
    // si hay un producto específico pendiente de enfocar (búsqueda/voz/escáner)...
    if (pendingFocusPid != null) {
      // ...y es de ESTA fila, centrarlo en vez del bloque por defecto.
      if (items.some((p) => String(p.id) === String(pendingFocusPid))) {
        if (focusProduct(pendingFocusPid, false)) return;
      }
      // ...y es de OTRA fila, esta fila no debe robar el foco visual: solo se posiciona en
      // su bloque por defecto SIN marcar is-focused.
      const railEl = railRef.current;
      const target = loop ? cs[items.length] : cs[0];
      if (railEl && target) {
        railEl.scrollTo({ left: target.offsetLeft + target.offsetWidth / 2 - railEl.clientWidth / 2, behavior: 'auto' });
      }
      return;
    }
    centerCard(loop ? cs[items.length] : cs[0], false);
    updateFocus();
  };

  const focusProduct = (pid, smooth = true) => {
    const rail = railRef.current;
    if (!rail) return false;
    const cx = rail.scrollLeft + rail.clientWidth / 2;
    let target = null;
    let dist = Infinity;
    for (const el of cards()) {
      if (el.dataset.pid !== String(pid)) continue;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - cx);
      if (d < dist) { dist = d; target = el; }
    }
    if (!target) return false;
    centerCard(target, smooth);
    target.classList.remove('is-bump');
    void target.offsetWidth;
    target.classList.add('is-bump');
    return true;
  };

  useImperativeHandle(ref, () => ({ focusProduct, recenter, hasProduct: (pid) => items.some((p) => p.id === pid) }));

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;

    let dragging = false;

    // reubica el scroll al bloque del medio del loop — SOLO cuando el usuario no está
    // tocando/arrastrando (mover scrollLeft a mitad de un gesto activo causa el salto raro)
    const rewrapIfNeeded = () => {
      if (!loop || dragging) return;
      const bw = blockWidth();
      if (!bw) return;
      if (rail.scrollLeft < bw * 0.5) rail.scrollLeft += bw;
      else if (rail.scrollLeft > bw * 2.5) rail.scrollLeft -= bw;
    };

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateFocus);
      clearTimeout(snapRef.current);
      snapRef.current = setTimeout(() => {
        rewrapIfNeeded();
        const { best, dist } = nearest();
        if (best && dist > 2) centerCard(best, true);
      }, 120);
    };

    let sx = 0;
    let sy = 0;
    const onTouchStart = (e) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      dragging = true;
    };
    const onTouchEnd = (e) => {
      if (!dragging) return;
      dragging = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) { rewrapIfNeeded(); return; }
      const cs = cards();
      const { best } = nearest();
      const idx = cs.indexOf(best);
      const next = cs[dx < 0 ? idx + 1 : idx - 1];
      if (next) centerCard(next, true);
      else rewrapIfNeeded();
    };

    rail.addEventListener('scroll', onScroll, { passive: true });
    rail.addEventListener('touchstart', onTouchStart, { passive: true });
    rail.addEventListener('touchend', onTouchEnd, { passive: true });

    // posición inicial + tras cargar fuentes
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(recenter));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(recenter);

    registerRail?.(row.cat, { focusProduct, recenter, hasProduct: (pid) => items.some((p) => p.id === pid) });

    return () => {
      rail.removeEventListener('scroll', onScroll);
      rail.removeEventListener('touchstart', onTouchStart);
      rail.removeEventListener('touchend', onTouchEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(raf1);
      clearTimeout(snapRef.current);
      // si esta fila se desmonta (categoría filtrada/desaparecida), borrar su registro para
      // que focusProduct del padre no la encuentre "viva" con datos/geometría obsoletos.
      unregisterRail?.(row.cat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.cat, seq.length, loop]);

  return (
    <section className="vt-cat">
      <div className="vt-cat-head" style={{ '--vt-cat': catColor(row.cat) }}>
        <h2>
          <span className="vt-cdot" />
          {row.cat}
        </h2>
        <span className="vt-count">{items.length} productos</span>
        {items.length > 1 && (
          <span className="vt-swipe">
            desliza
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        )}
      </div>

      <div className="vt-rail" ref={railRef} role="listbox" aria-label={row.cat}>
        {seq.map((p, i) => (
          <VitrinaCard
            key={`${p.id}-${i}`}
            product={p}
            mode={mode}
            inCartQty={cartQtyOf?.(p.id) || 0}
            canSeePrice={canSeePrice}
            renderExtra={renderExtra}
            onRequestFocus={(el) => centerCard(el, true)}
            onNotify={onNotify}
            onAdd={(prod, qty) => {
              onAdd?.(prod, qty);
              focusProduct(prod.id, true);
            }}
            onSetQty={onSetQty}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>

      {/* pista de que hay más categorías más abajo — sin esto, en mobile una sola fila
          ocupa casi toda la pantalla y no se nota que hay más para hacer scroll */}
      {!isLast && (
        <div className="vt-more-below" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      )}
    </section>
  );
});

// ---------- carrusel completo ----------
const VitrinaCarousel = forwardRef(function VitrinaCarousel(
  {
    items = [],
    mode = 'salida',
    loading = false,
    cartQtyOf,
    canSeePrice = true,
    renderExtra,
    onAdd,
    onSetQty,
    onOpenDetail,
    onNotify,
    onFocusChange,
    emptyText = 'Esta bodega está vacía',
    noResultsText = 'Sin resultados',
  },
  ref,
) {
  const railsRef = useRef({}); // cat -> { focusProduct, recenter, hasProduct }
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of items) {
      const cat = p.category || 'Producto';
      if (!map.has(cat)) map.set(cat, { cat, items: [] });
      map.get(cat).items.push(p);
    }
    return [...map.values()];
  }, [items]);

  const registerRail = (cat, api) => {
    railsRef.current[cat] = api;
  };
  const unregisterRail = (cat) => {
    delete railsRef.current[cat];
  };

  useImperativeHandle(ref, () => {
    // busca en qué fila está el producto y la centra. Si el carrusel acaba de cambiar de
    // composición (ej. se limpió un filtro en el mismo gesto), las filas pueden no estar
    // registradas todavía en railsRef — reintenta unos frames antes de rendirse.
    const focusProduct = (pid, smooth = true, attemptsLeft = 20) => {
      // marca este pid como "pendiente" mientras dura el intento — así, si alguna fila se
      // está montando/remontando en este mismo instante (por el cambio de filtro que
      // disparó esta búsqueda), su recenter() automático de montaje cede el paso a este pid
      // en vez de centrar el bloque por defecto y pisar el resultado.
      pendingFocusPid = pid;
      for (const api of Object.values(railsRef.current)) {
        if (api.hasProduct(pid)) {
          // centrar horizontalmente PRIMERO (mientras la fila aún no se movió verticalmente,
          // su geometría es estable) y recién después hacer scroll vertical de la página.
          // Al revés, el scroll vertical en curso puede alterar las medidas que usa el
          // centrado horizontal y el producto termina "cerca" pero no realmente centrado.
          api.focusProduct(pid, smooth);
          // alinear la SECCIÓN de categoría arriba del viewport (no centrar la card): con
          // block:'center' una categoría angosta (pocos productos) deja la categoría vecina
          // muy visible al lado. Se usa scrollIntoView NATIVO con block:'start' — el
          // scroll-margin-top de .vt-cat (vitrina.css) ya le dice al navegador cuánto
          // espacio reservar arriba para no tapar la sección detrás de topbar+buscador,
          // así no hace falta calcular offsets a mano ni reintentar con setTimeout.
          const behavior = smooth && !reducedMotion ? 'smooth' : 'auto';
          const scrollToSection = () => {
            const card = document.querySelector(`.vt-rail [data-pid="${pid}"].is-focused`)
              || document.querySelector(`.vt-rail [data-pid="${pid}"]`);
            card?.closest('.vt-cat')?.scrollIntoView({ block: 'start', behavior });
          };
          requestAnimationFrame(scrollToSection);
          // reintento de seguridad: al limpiar la búsqueda TODAS las categorías reaparecen de
          // golpe y el reflow completo puede tardar más de un frame — sin este segundo intento,
          // el primer scrollIntoView puede calcular la posición antes de que el layout termine
          // de acomodarse y dejar la sección tapada.
          setTimeout(() => {
            scrollToSection();
            if (pendingFocusPid === pid) pendingFocusPid = null;
          }, 200);
          return true;
        }
      }
      // producto todavía no montado (filas recién cambiaron) → reintentar en el próximo frame
      if (attemptsLeft > 0) {
        requestAnimationFrame(() => focusProduct(pid, smooth, attemptsLeft - 1));
        return true;
      }
      pendingFocusPid = null;
      return false;
    };
    return { focusProduct };
  });

  if (loading) {
    return (
      <div className={`vt vt-mode-${mode}`}>
        {[0, 1, 2].map((s) => (
          <div className="vt-sk-cat" key={s}>
            <div className="vt-sk-head vt-shimmer" />
            <div className="vt-sk-rail">
              {[0, 1, 2, 3, 4].map((k) => (
                <div className="vt-sk-card" key={k}>
                  <div className="vt-sk-disc vt-shimmer" />
                  <div className="vt-sk-line vt-shimmer" style={{ width: '70%' }} />
                  <div className="vt-sk-line vt-shimmer" style={{ width: '45%' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={`vt vt-mode-${mode}`}>
        <div className="vt-noresults">
          <h2>Sin productos</h2>
          <p>{emptyText}</p>
        </div>
      </div>
    );
  }

  if (!grouped.length) {
    return (
      <div className={`vt vt-mode-${mode}`}>
        <div className="vt-noresults">
          <h2>{noResultsText}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`vt vt-mode-${mode}`}>
      {grouped.map((row, rowIdx) => (
        <CategoryRow
          key={row.cat}
          row={row}
          mode={mode}
          isLast={rowIdx === grouped.length - 1}
          cartQtyOf={cartQtyOf}
          canSeePrice={canSeePrice}
          renderExtra={renderExtra}
          onAdd={onAdd}
          onSetQty={onSetQty}
          onOpenDetail={onOpenDetail}
          onNotify={onNotify}
          onFocusChange={onFocusChange}
          registerRail={registerRail}
          unregisterRail={unregisterRail}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
});

export default VitrinaCarousel;
