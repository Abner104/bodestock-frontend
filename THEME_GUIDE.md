# 🎨 Guía de Temas - Stockly

## Sistema de Tema Claro/Oscuro

Este proyecto usa un sistema de temas consistente que garantiza que **NUNCA** haya problemas de contraste (como texto blanco sobre fondo blanco).

## 📦 Utilidades Disponibles

Todas las utilidades están en `src/utils/themeUtils.js`

### 1. Clases de Texto

```jsx
import { useTheme } from '../contexts/ThemeContext';
import { textClasses } from '../utils/themeUtils';

function MyComponent() {
  const { isDark } = useTheme();

  return (
    <div>
      {/* Texto principal - SIEMPRE legible */}
      <h1 className={textClasses.primary(isDark)}>
        Título Principal
      </h1>

      {/* Texto secundario - Más sutil pero legible */}
      <p className={textClasses.secondary(isDark)}>
        Descripción secundaria
      </p>

      {/* Texto terciario - Aún más sutil */}
      <span className={textClasses.tertiary(isDark)}>
        Info adicional
      </span>

      {/* Texto de accent (azul) */}
      <a className={textClasses.accent(isDark)}>
        Enlace importante
      </a>

      {/* Texto de éxito */}
      <span className={textClasses.success(isDark)}>
        Operación exitosa
      </span>

      {/* Texto de error */}
      <span className={textClasses.error(isDark)}>
        Error encontrado
      </span>
    </div>
  );
}
```

### 2. Clases de Fondo

```jsx
import { bgClasses } from '../utils/themeUtils';

function MyCard() {
  const { isDark } = useTheme();

  return (
    <div className={bgClasses.primary(isDark)}>
      {/* Fondo primario - Blanco en claro, Gris oscuro en oscuro */}
      <div className={bgClasses.secondary(isDark)}>
        {/* Fondo secundario - Para cards internos */}
      </div>
    </div>
  );
}
```

### 3. Helpers Pre-construidos

```jsx
import { cardClasses, inputClasses, buttonClasses } from '../utils/themeUtils';

function MyForm() {
  const { isDark } = useTheme();

  return (
    {/* Card completo con estilos adaptativos */}
    <div className={cardClasses(isDark)}>
      {/* Input con estilos adaptativos */}
      <input
        type="text"
        className={inputClasses(isDark)}
        placeholder="Nombre"
      />

      {/* Botón primario */}
      <button className={buttonClasses.primary(isDark)}>
        Guardar
      </button>

      {/* Botón secundario */}
      <button className={buttonClasses.secondary(isDark)}>
        Cancelar
      </button>
    </div>
  );
}
```

### 4. Badges Adaptativos

```jsx
import { badgeClasses } from '../utils/themeUtils';

function MyStatus() {
  const { isDark } = useTheme();

  return (
    <>
      <span className={badgeClasses.success(isDark)}>Activo</span>
      <span className={badgeClasses.error(isDark)}>Error</span>
      <span className={badgeClasses.warning(isDark)}>Pendiente</span>
      <span className={badgeClasses.default(isDark)}>Info</span>
    </>
  );
}
```

## 🚫 Qué NO Hacer

### ❌ NO hardcodear colores

```jsx
// ❌ MAL - Texto blanco puede quedar invisible en fondo blanco
<div className="text-white bg-white">
  Esto es invisible en modo claro
</div>

// ✅ BIEN - Usa las utilidades
<div className={`${textClasses.primary(isDark)} ${bgClasses.primary(isDark)}`}>
  Esto siempre es visible
</div>
```

### ❌ NO usar clases de Tailwind directamente para colores de tema

```jsx
// ❌ MAL
<div className="bg-slate-900 text-white">
  Esto se ve mal en modo claro
</div>

// ✅ BIEN
<div className={cardClasses(isDark)}>
  <span className={textClasses.primary(isDark)}>Contenido</span>
</div>
```

## ✅ Mejores Prácticas

### 1. Siempre importa `useTheme`

```jsx
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const { isDark } = useTheme();
  // ... resto del componente
}
```

### 2. Usa las utilidades para TODO lo relacionado con colores

```jsx
import { textClasses, bgClasses, borderClasses } from '../utils/themeUtils';

function MyComponent() {
  const { isDark } = useTheme();

  return (
    <div className={`
      ${bgClasses.primary(isDark)}
      ${borderClasses.default(isDark)}
      p-4 rounded-lg border
    `}>
      <h2 className={textClasses.primary(isDark)}>Título</h2>
      <p className={textClasses.secondary(isDark)}>Descripción</p>
    </div>
  );
}
```

### 3. Para componentes complejos, crea helpers específicos

```jsx
// En themeUtils.js
export const myCustomCardClasses = (isDark) => `
  ${cardClasses(isDark)}
  p-6
  hover:shadow-lg
  transition-all
`;

// En tu componente
<div className={myCustomCardClasses(isDark)}>
  ...
</div>
```

## 🔧 Personalización

Si necesitas agregar más utilidades, edita `src/utils/themeUtils.js` siguiendo el patrón:

```js
export const myNewHelper = {
  variant: (isDark) => `
    ${isDark ? 'dark-classes' : 'light-classes'}
  `
};
```

## 📱 Modo Oscuro por Defecto

El sistema usa **modo oscuro por defecto**. Los usuarios pueden cambiarlo con el botón de tema en:
- Navbar (desktop)
- MobileBottomNav → Menú "Más" (móvil)

El tema se guarda en `localStorage` como `stockly-theme`.

## 🎯 Resumen

1. **NUNCA** uses colores hardcodeados para fondos/textos
2. **SIEMPRE** usa las utilidades de `themeUtils.js`
3. **SIEMPRE** importa `useTheme` y usa `isDark`
4. Si algo no se ve bien, revisa que estés usando las utilidades correctas
5. Cuando agregues componentes nuevos, usa los helpers o crea uno nuevo

## 🐛 Debugging

Si ves texto invisible o mal contraste:

1. Verifica que estás usando `textClasses` o `bgClasses`
2. Verifica que pasas `isDark` correctamente
3. Prueba en ambos modos (claro y oscuro)
4. Si es un componente de terceros (MUI, etc.), envuélvelo en un div con las clases correctas

## 📚 Referencias

- `src/utils/themeUtils.js` - Todas las utilidades
- `src/contexts/ThemeContext.jsx` - Contexto de tema
- `src/components/MobileBottomNav.jsx` - Ejemplo de uso completo
- `src/pages/Settings.jsx` - Ejemplo de tabs adaptativos
