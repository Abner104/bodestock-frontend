// src/utils/themeUtils.js
/**
 * Utilidades para mantener consistencia de colores entre modo claro y oscuro
 * Evita que textos blancos aparezcan en fondos blancos, etc.
 */

/**
 * Clases de texto adaptativas - Siempre legibles en ambos temas
 */
export const textClasses = {
  // Texto principal - Negro en claro, Blanco en oscuro
  primary: (isDark) => isDark ? 'text-slate-100' : 'text-slate-900',

  // Texto secundario - Gris oscuro en claro, Gris claro en oscuro
  secondary: (isDark) => isDark ? 'text-slate-300' : 'text-slate-600',

  // Texto terciario - Más sutil
  tertiary: (isDark) => isDark ? 'text-slate-400' : 'text-slate-500',

  // Texto de marca/accent - Siempre azul pero con contraste
  accent: (isDark) => isDark ? 'text-blue-400' : 'text-blue-600',

  // Texto de éxito
  success: (isDark) => isDark ? 'text-green-400' : 'text-green-600',

  // Texto de error
  error: (isDark) => isDark ? 'text-red-400' : 'text-red-600',

  // Texto de advertencia
  warning: (isDark) => isDark ? 'text-yellow-400' : 'text-yellow-600',
};

/**
 * Clases de fondo adaptativas
 */
export const bgClasses = {
  // Fondo principal - Blanco en claro, Gris oscuro en oscuro
  primary: (isDark) => isDark ? 'bg-slate-900' : 'bg-white',

  // Fondo secundario - Para cards, etc.
  secondary: (isDark) => isDark ? 'bg-slate-800' : 'bg-gray-50',

  // Fondo terciario - Más sutil
  tertiary: (isDark) => isDark ? 'bg-slate-700' : 'bg-gray-100',

  // Fondo de accent/marca
  accent: (isDark) => isDark ? 'bg-blue-600' : 'bg-blue-500',

  // Fondo hover
  hover: (isDark) => isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100',

  // Fondo activo/seleccionado
  active: (isDark) => isDark ? 'bg-blue-600/20' : 'bg-blue-500/10',
};

/**
 * Clases de borde adaptativas
 */
export const borderClasses = {
  // Borde normal
  default: (isDark) => isDark ? 'border-slate-700' : 'border-gray-200',

  // Borde sutil
  subtle: (isDark) => isDark ? 'border-slate-800' : 'border-gray-100',

  // Borde de accent
  accent: (isDark) => isDark ? 'border-blue-500' : 'border-blue-400',
};

/**
 * Clases de sombra adaptativas
 */
export const shadowClasses = {
  sm: (isDark) => isDark ? 'shadow-lg shadow-black/20' : 'shadow-sm',
  md: (isDark) => isDark ? 'shadow-xl shadow-black/30' : 'shadow-md',
  lg: (isDark) => isDark ? 'shadow-2xl shadow-black/40' : 'shadow-lg',
};

/**
 * Helper para botones adaptativos
 */
export const buttonClasses = {
  // Botón primario
  primary: (isDark) => `
    ${bgClasses.accent(isDark)}
    ${textClasses.primary(isDark)}
    hover:opacity-90
    active:opacity-80
    transition-all
  `,

  // Botón secundario
  secondary: (isDark) => `
    ${bgClasses.secondary(isDark)}
    ${textClasses.primary(isDark)}
    ${borderClasses.default(isDark)}
    border
    ${bgClasses.hover(isDark)}
    transition-all
  `,

  // Botón ghost (transparente)
  ghost: (isDark) => `
    ${textClasses.primary(isDark)}
    ${bgClasses.hover(isDark)}
    transition-all
  `,

  // Botón de peligro
  danger: (isDark) => `
    ${isDark ? 'bg-red-600' : 'bg-red-500'}
    text-white
    hover:opacity-90
    active:opacity-80
    transition-all
  `,
};

/**
 * Helper para cards adaptativos
 */
export const cardClasses = (isDark) => `
  ${bgClasses.primary(isDark)}
  ${borderClasses.default(isDark)}
  ${shadowClasses.sm(isDark)}
  border
  rounded-xl
`;

/**
 * Helper para inputs adaptativos
 */
export const inputClasses = (isDark) => `
  ${bgClasses.secondary(isDark)}
  ${textClasses.primary(isDark)}
  ${borderClasses.default(isDark)}
  border
  rounded-lg
  focus:ring-2
  ${isDark ? 'focus:ring-blue-500' : 'focus:ring-blue-400'}
  focus:border-transparent
  transition-all
`;

/**
 * Helper para badges/pills adaptativos
 */
export const badgeClasses = {
  default: (isDark) => `
    ${bgClasses.secondary(isDark)}
    ${textClasses.primary(isDark)}
    px-2 py-1
    rounded-full
    text-xs
    font-medium
  `,

  success: (isDark) => `
    ${isDark ? 'bg-green-500/20' : 'bg-green-100'}
    ${textClasses.success(isDark)}
    px-2 py-1
    rounded-full
    text-xs
    font-medium
  `,

  error: (isDark) => `
    ${isDark ? 'bg-red-500/20' : 'bg-red-100'}
    ${textClasses.error(isDark)}
    px-2 py-1
    rounded-full
    text-xs
    font-medium
  `,

  warning: (isDark) => `
    ${isDark ? 'bg-yellow-500/20' : 'bg-yellow-100'}
    ${textClasses.warning(isDark)}
    px-2 py-1
    rounded-full
    text-xs
    font-medium
  `,
};

/**
 * Función helper para combinar clases
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Ejemplo de uso:
 *
 * import { useTheme } from '../contexts/ThemeContext';
 * import { textClasses, bgClasses, cardClasses } from '../utils/themeUtils';
 *
 * function MyComponent() {
 *   const { isDark } = useTheme();
 *
 *   return (
 *     <div className={cardClasses(isDark)}>
 *       <h1 className={textClasses.primary(isDark)}>Título</h1>
 *       <p className={textClasses.secondary(isDark)}>Descripción</p>
 *     </div>
 *   );
 * }
 */
