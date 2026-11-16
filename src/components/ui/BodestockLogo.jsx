// src/components/ui/BodestockLogo.jsx
import React from 'react';

const BodestockLogo = ({ variant = 'default', size = 'md', className = '' }) => {
  const sizes = {
    sm: { width: 120, height: 32, fontSize: 16 },
    md: { width: 180, height: 48, fontSize: 24 },
    lg: { width: 240, height: 64, fontSize: 32 },
    xl: { width: 300, height: 80, fontSize: 40 }
  };

  const { width, height, fontSize } = sizes[size];

  const colors = {
    default: {
      boxBack: '#3B82F6',
      boxFront: '#3B82F6',
      line: 'white',
      dot: 'white',
      text: '#1E293B'
    },
    white: {
      boxBack: 'white',
      boxFront: 'white',
      line: '#3B82F6',
      dot: '#3B82F6',
      text: 'white'
    },
    dark: {
      boxBack: '#1E293B',
      boxFront: '#1E293B',
      line: '#3B82F6',
      dot: '#3B82F6',
      text: '#1E293B'
    }
  };

  const theme = colors[variant] || colors.default;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 180 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Icono: Cajas apiladas con gráfico */}
      <g>
        {/* Caja trasera */}
        <rect
          x="3"
          y="14"
          width="14"
          height="14"
          rx="2"
          fill={theme.boxBack}
          opacity="0.3"
        />

        {/* Caja frontal */}
        <rect
          x="7"
          y="18"
          width="14"
          height="14"
          rx="2"
          fill={theme.boxFront}
        />

        {/* Línea de tendencia hacia arriba */}
        <path
          d="M9 26 L12 23 L15 24 L19 20"
          stroke={theme.line}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Punto final */}
        <circle
          cx="19"
          cy="20"
          r="2"
          fill={theme.dot}
        />
      </g>

      {/* Texto STOCKLY */}
      <text
        x="35"
        y="32"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        fill={theme.text}
        letterSpacing="-0.5"
      >
        Bodestock
      </text>
    </svg>
  );
};

// Componente para solo el icono (cuadrado)
export const BodestockIcon = ({ size = 48, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Fondo circular */}
      <circle cx="24" cy="24" r="24" fill="#3B82F6"/>

      {/* Caja trasera */}
      <rect x="14" y="16" width="14" height="14" rx="2" fill="white" opacity="0.3"/>

      {/* Caja frontal */}
      <rect x="18" y="20" width="14" height="14" rx="2" fill="white"/>

      {/* Línea de tendencia hacia arriba */}
      <path
        d="M20 28 L23 25 L26 26 L30 22"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Punto final */}
      <circle cx="30" cy="22" r="2.5" fill="#3B82F6"/>
    </svg>
  );
};

export default BodestockLogo;
