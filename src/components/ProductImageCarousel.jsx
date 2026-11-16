// src/components/ProductImageCarousel.jsx
/**
 * Carrusel de fotos de producto para catálogos públicos.
 * Si hay 1 sola foto (o ninguna), se comporta exactamente como una <img> simple —
 * sin flechas ni puntos, para no cambiar nada visualmente en el caso más común.
 * Si hay 2+ fotos, agrega swipe (drag) + flechas + puntos indicadores.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';

export default function ProductImageCarousel({ images = [], alt = '', className = '', iconClassName = 'w-10 h-10 opacity-20', iconStyle }) {
  const [index, setIndex] = useState(0);
  const photos = (images || []).filter(Boolean);

  if (photos.length === 0) {
    return <Package className={iconClassName} style={iconStyle} />;
  }

  if (photos.length === 1) {
    return <img src={photos[0]} alt={alt} className={className} />;
  }

  const goTo = (e, newIndex) => {
    e.stopPropagation();
    e.preventDefault();
    setIndex((newIndex + photos.length) % photos.length);
  };

  const handleDragEnd = (e, info) => {
    if (info.offset.x < -40) goTo(e, index + 1);
    else if (info.offset.x > 40) goTo(e, index - 1);
  };

  return (
    <div className="relative w-full h-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence initial={false} mode="wait">
        <motion.img
          key={index}
          src={photos[index]}
          alt={alt}
          className={className}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        />
      </AnimatePresence>

      {/* Flechas — visibles siempre en mobile, en hover en desktop */}
      <button
        type="button"
        onClick={(e) => goTo(e, index - 1)}
        className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-70 transition"
        aria-label="Foto anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => goTo(e, index + 1)}
        className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-70 transition"
        aria-label="Foto siguiente"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Puntos indicadores */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition ${i === index ? 'bg-white' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
