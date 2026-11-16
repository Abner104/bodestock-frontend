# Plan: Peso en Salidas + Escáner en Inventario + Fix cámara

## 1. Productos por peso en Salidas (InventoryExit.jsx)

Detectar si un producto tiene unidad de peso/volumen (`kg`, `g`, `ml`, `L`, `lt`, `lb`) y en vez de sumar +1 automáticamente, mostrar un input para ingresar la cantidad decimal.

### Cambios:
- Agregar helper `isWeightUnit(unit)` que retorna true si la unidad es de peso/volumen
- **handleScanSuccess**: Si el producto es por peso, en vez de sumar +1, abrir un mini-modal/prompt para ingresar cantidad
- **handleBarcodeFromGun**: Mismo comportamiento - si es por peso, mostrar prompt
- **renderCartItem**: Para productos por peso, en vez de botones +/- con enteros, mostrar input numérico decimal
- **Cart en scanner mode**: Igual, input decimal para productos por peso
- Los botones +/- para peso incrementan/decrementan en 0.1 en vez de 1

## 2. Escáner continuo en Inventario (Inventory.jsx)

Cambiar de `SimpleBarcodeScanner` (modal que se cierra tras escanear) a `ImprovedBarcodeScanner` en modo inline/continuo, igual que en Salidas.

### Cambios:
- En `Inventory.jsx`: Importar `ImprovedBarcodeScanner` en vez de `SimpleBarcodeScanner`
- Agregar `scannerMode` state para modo continuo en móvil
- Cuando escanea un producto existente: abrir modal de edición (comportamiento actual)
- Cuando escanea y no existe: abrir wizard para crear producto con el código pre-llenado
- En mobile: overlay fullscreen con cámara arriba y lista de productos escaneados abajo

## 3. Fix botón voltear cámara (ImprovedBarcodeScanner.jsx)

El `switchCamera` no funciona porque `stopScanning()` hace `codeReaderRef.current.reset()` que destruye el reader, y luego `startScanning` intenta usarlo.

### Fix:
- En `switchCamera`: Recrear el `BrowserMultiFormatReader` después de detener el anterior, antes de llamar `startScanning`
