# Guía: Sistema de Notificaciones iOS y Bottom Navigation

## Sistema de Notificaciones Estilo iPhone 15

### ¿Cómo usar las notificaciones?

Las notificaciones aparecen como burbujas desde la parte superior de la pantalla, con efecto blur y animaciones suaves, tal como en el iPhone 15.

### Uso en cualquier componente:

```javascript
import { useNotification } from '../contexts/NotificationContext';

function MiComponente() {
  const { showNotification } = useNotification();

  const handleAction = () => {
    // Notificación de éxito
    showNotification({
      type: 'success',
      title: 'Producto agregado',
      message: 'El producto se guardó correctamente',
      duration: 4000 // opcional, default 4000ms
    });
  };

  return (
    <button onClick={handleAction}>
      Hacer algo
    </button>
  );
}
```

### Tipos de notificaciones:

1. **Success** (verde):
```javascript
showNotification({
  type: 'success',
  title: 'Éxito',
  message: 'Operación completada'
});
```

2. **Error** (rojo):
```javascript
showNotification({
  type: 'error',
  title: 'Error',
  message: 'Algo salió mal'
});
```

3. **Warning** (amarillo):
```javascript
showNotification({
  type: 'warning',
  title: 'Advertencia',
  message: 'Revisa esto'
});
```

4. **Info** (azul):
```javascript
showNotification({
  type: 'info',
  title: 'Información',
  message: 'Datos actualizados'
});
```

### Características:

- ✅ Animación suave desde arriba
- ✅ Auto-dismiss después de 4 segundos (configurable)
- ✅ Se puede deslizar hacia arriba para cerrar
- ✅ Múltiples notificaciones se apilan
- ✅ Blur effect glassmorphism
- ✅ Adaptado a modo oscuro/claro
- ✅ Barra de progreso animada
- ✅ Safe area para iPhones con notch

---

## Bottom Navigation Bar iOS

### Características:

- 🎨 Diseño elegante estilo iOS
- 📱 Solo visible en móviles (oculto en desktop)
- 🌗 Se adapta a modo oscuro/claro
- ⚡ Animaciones suaves al tocar
- 🎯 Indicador de pestaña activa
- 📍 Safe area para iPhones con notch

### Navegación incluida:

1. **Inicio** - `/dashboard`
2. **Inventario** - `/inventario`
3. **Productos** - `/productos`
4. **Perfil** - `/profile`
5. **Más** - `/menu` (para expandir funciones)

### Personalización:

Para cambiar los ítems de navegación, edita:
```
src/components/MobileBottomNav.jsx
```

Modifica el array `navItems`:
```javascript
const navItems = [
  { icon: Home, label: 'Inicio', path: '/dashboard' },
  { icon: Package, label: 'Inventario', path: '/inventario' },
  // ... añade o modifica aquí
];
```

---

## Estilos CSS iOS añadidos:

### Safe Area Classes:
```css
.pt-safe  /* padding-top con safe area */
.pb-safe  /* padding-bottom con safe area */
.pl-safe  /* padding-left con safe area */
.pr-safe  /* padding-right con safe area */
```

### Backdrop Blur iOS:
```css
.backdrop-blur-ios  /* Efecto blur estilo iOS */
```

### Tap Feedback:
```css
.tap-feedback  /* Animación al presionar */
```

---

## Ejemplos Prácticos:

### Ejemplo 1: Notificación al guardar producto
```javascript
import { useNotification } from '../contexts/NotificationContext';

function ProductForm() {
  const { showNotification } = useNotification();

  const handleSave = async () => {
    try {
      await saveProduct(data);
      showNotification({
        type: 'success',
        title: 'Producto guardado',
        message: 'El producto se agregó al inventario'
      });
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Error al guardar',
        message: error.message
      });
    }
  };

  return <button onClick={handleSave}>Guardar</button>;
}
```

### Ejemplo 2: Notificación de stock bajo
```javascript
const checkStock = () => {
  if (stock < 10) {
    showNotification({
      type: 'warning',
      title: 'Stock bajo',
      message: `Solo quedan ${stock} unidades`,
      duration: 6000
    });
  }
};
```

---

## Responsive Design:

- **Desktop**: Bottom nav oculto, solo navbar superior
- **Tablet**: Bottom nav oculto, solo navbar superior
- **Móvil** (< 768px): Bottom nav visible, navbar superior simplificado

---

## Compatibilidad:

✅ iPhone 15 / 15 Pro / 15 Pro Max
✅ iPhone 14 / 13 / 12 (con notch)
✅ iPhone X / 11 (con notch)
✅ iPhone SE / 8 / 7 (sin notch)
✅ Android moderno
✅ Modo oscuro / claro
✅ Safari iOS
✅ Chrome / Firefox móvil

---

## Tips de Diseño:

1. **Notificaciones cortas**: Máximo 2 líneas de texto
2. **Usa el tipo correcto**: success/error/warning/info
3. **Duración apropiada**:
   - Info rápida: 3000ms
   - Normal: 4000ms
   - Importante: 6000ms
4. **No abuses**: Máximo 3 notificaciones visibles a la vez

---

Desarrollado con ❤️ para Stockly
