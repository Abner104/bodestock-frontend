// src/components/vitrina/VitrinaSuggest.jsx
// Dropdown de sugerencias del buscador: solo un atajo para completar el texto. Tocar una
// sugerencia NO agrega nada al carrito ni toca la grilla directamente — simplemente pone
// ese nombre en el buscador, y la grilla de productos se filtra sola por el searchTerm
// normal (mismo mecanismo de siempre). Así no se duplica ni interfiere con el filtrado
// en vivo que ya funciona bien.

import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CLP = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');

export default function VitrinaSuggest({ query, products = [], onPick, inputRef }) {
  const [idx, setIdx] = useState(-1);

  const matches = useMemo(() => {
    const s = norm(query);
    if (!s) return [];
    return products
      .map((p) => {
        const cands = [
          norm(p.name),
          norm(p.category),
          ...(p.aliases || []).map(norm),
          (p.sku || '').toLowerCase(),
          (p.code || '').toLowerCase(),
        ];
        let sc = 0;
        for (const c of cands) {
          if (!c) continue;
          if (c === s) sc = Math.max(sc, 1);
          else if (c.startsWith(s)) sc = Math.max(sc, 0.9);
          else if (c.includes(s)) sc = Math.max(sc, 0.7);
        }
        return { p, sc };
      })
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 8)
      .map((x) => x.p);
  }, [query, products]);

  useEffect(() => {
    setIdx(-1);
  }, [query]);

  // teclado ↓ ↑ Enter sobre el input del padre
  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return undefined;
    const onKey = (e) => {
      if (!matches.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, matches.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const p = matches[idx] || matches[0];
        if (p) onPick?.(p);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [matches, idx, onPick, inputRef]);

  if (!query.trim() || !matches.length) return null;

  return (
    <div className="vt-suggest is-show">
      {matches.map((p, i) => {
        const out = (p.stock ?? 0) <= 0 && !(p.productType === 'ELABORADO' || (p.receta || []).length > 0);
        const photo = p.photoURL || (p.photos && p.photos[0]);
        return (
          <button
            key={p.id}
            type="button"
            className={i === idx ? 'is-active' : ''}
            onClick={() => onPick?.(p)}
          >
            <span className="vt-s-ico">
              {photo ? <img src={photo} alt="" /> : <Package size={16} style={{ opacity: 0.4 }} />}
            </span>
            <span className="vt-s-txt">
              <span className="vt-s-name">{p.name}</span>
              <span className={`vt-s-meta${out ? ' is-out' : ''}`}>
                {p.category} · {out ? 'agotado' : `${p.stock} u`} · {CLP(p.salePrice || p.precioVenta || 0)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
