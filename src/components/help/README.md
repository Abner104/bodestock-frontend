# Sistema de Ayuda Contextual - Stockly

## Descripción

Sistema de ayuda inteligente que guía a los usuarios paso a paso en el proceso de costeo de productos, con ejemplos reales específicos para cada industria (bar, botillería, restaurante, etc.).

## Componentes

### 1. `FloatingHelpButton.jsx`
Botón flotante animado que aparece en la esquina inferior derecha.

**Características:**
- Animación de pulso para llamar la atención
- Tooltip al hacer hover
- Badge de notificación
- Animaciones suaves con Framer Motion
- Se adapta al contexto (pulsa más en pasos críticos)

**Props:**
- `onClick`: Función que se ejecuta al hacer clic
- `showPulse`: Boolean para mostrar/ocultar la animación de pulso

### 2. `CostingHelpModal.jsx`
Modal completo con ejemplos paso a paso y tips contextuales.

**Características:**
- Tips específicos por paso del wizard
- Ejemplos detallados por industria:
  - **Pisco Sour** (Bar/Coctelería)
  - **Pack 6 Cervezas** (Botillería)
- Desglose completo de costos
- Cálculos en tiempo real
- Consejos prácticos de la industria
- Diseño responsive para mobile/desktop

**Props:**
- `isOpen`: Boolean para controlar visibilidad
- `onClose`: Función para cerrar el modal
- `currentStep`: Número del paso actual del wizard (0-2)

## Ejemplos Incluidos

### Ejemplo 1: Pisco Sour (Bar)
```
Insumos:
- Pisco 35° (60ml): $800
- Limón de Pica (30ml): $300
- Clara de huevo (1 unidad): $200
- Jarabe de goma (20ml): $150
- Amargo de angostura (3 gotas): $50

Extras:
- Copa/Vaso: $500
- Hielo: $200
- Decoración: $300
- Pitillo/Servilleta: $100

Mano de Obra: $800
Margen: 150%

Costo Total: $3.400
Precio Venta: $8.500
Ganancia: $5.100
```

### Ejemplo 2: Pack 6 Cervezas (Botillería)
```
Insumos:
- 6x Cerveza Artesanal IPA: $6.000

Extras:
- Caja de cartón: $400
- Plástico termocontraíble: $200
- Etiqueta/Sticker: $100

Mano de Obra: $300
Margen: 30%

Costo Total: $7.000
Precio Venta: $9.100
Ganancia: $2.100
```

## Tips por Paso

### Paso 0: Información Básica
- Dale un nombre descriptivo
- Define la unidad correctamente
- Usa plantillas predefinidas

### Paso 1: Selección de Insumos
- Busca todos los ingredientes necesarios
- Define cantidades exactas
- El sistema calcula automáticamente

### Paso 2: Costos Adicionales
- Incluye empaque y presentación
- Agrega mano de obra
- Define tu margen de ganancia

## Integración en ProductCostingWizard

```jsx
import CostingHelpModal from '../components/help/CostingHelpModal';
import FloatingHelpButton from '../components/help/FloatingHelpButton';

// En el componente:
const [showHelpModal, setShowHelpModal] = useState(false);

// En el render:
<FloatingHelpButton
  onClick={() => setShowHelpModal(true)}
  showPulse={currentStep === 0 || currentStep === 1}
/>

<CostingHelpModal
  isOpen={showHelpModal}
  onClose={() => setShowHelpModal(false)}
  currentStep={currentStep}
/>
```

## Personalización

Para agregar más ejemplos, edita el objeto `EXAMPLES` en `CostingHelpModal.jsx`:

```javascript
const EXAMPLES = {
  tuEjemplo: {
    id: 'tuEjemplo',
    industria: 'restaurante',
    icon: <Coffee className="w-6 h-6" />,
    nombre: 'Tu Producto',
    color: 'from-purple-500 to-pink-500',
    // ... resto de la configuración
  }
};
```

## Mejoras Futuras

- [ ] Video tutoriales embebidos
- [ ] Tour guiado interactivo (onboarding)
- [ ] Guardar ejemplos como plantillas
- [ ] Más ejemplos por industria
- [ ] Exportar configuración de ejemplo
- [ ] Chat de soporte en vivo
- [ ] Base de conocimiento con búsqueda

## UX Best Practices Aplicadas

1. **Ayuda Contextual**: Los tips cambian según el paso actual
2. **Ejemplos Reales**: Casos de uso de verdaderos clientes (bar y botillería)
3. **Visual Hierarchy**: Colores y tamaños guían la atención
4. **Progressive Disclosure**: Información se revela gradualmente
5. **Feedback Visual**: Animaciones confirman acciones
6. **Mobile-First**: Funciona perfectamente en cualquier dispositivo

## Notas para Desarrollo

- El botón flotante tiene `z-index: 40`
- El modal tiene backdrop con blur para mejor enfoque
- Todas las animaciones usan Framer Motion
- Los colores siguen la paleta de Stockly (blue/indigo)
- Los ejemplos usan precios en CLP (pesos chilenos)
