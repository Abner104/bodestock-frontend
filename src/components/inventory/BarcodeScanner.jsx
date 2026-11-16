// src/components/inventory/BarcodeScanner.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';

const BarcodeScanner = ({ onScanSuccess, onClose, products }) => {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    startScanning();

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setError(null);

      // Crear instancia del scanner
      const html5QrCode = new Html5Qrcode("barcode-reader");
      html5QrCodeRef.current = html5QrCode;

      // Configuración del scanner optimizada para códigos de barras
      const config = {
        fps: 10,
        qrbox: { width: 300, height: 200 }, // Área más grande para barcodes
        aspectRatio: 1.5,
        // Formatos soportados para códigos de barras
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR
        ],
        videoConstraints: {
          facingMode: "environment",
          advanced: [{ zoom: 2.0 }] // Zoom para mejor lectura
        }
      };

      // Iniciar el scanner
      await html5QrCode.start(
        { facingMode: "environment" }, // Cámara trasera
        config,
        handleScanSuccess,
        handleScanError
      );

      setScanning(true);
    } catch (err) {
      console.error('Error iniciando scanner:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error deteniendo scanner:', err);
      }
      setScanning(false);
    }
  };

  const handleScanSuccess = (decodedText, decodedResult) => {
    console.log('📷 Código escaneado:', decodedText);

    // Evitar escaneos duplicados consecutivos
    if (lastScan === decodedText) {
      return;
    }

    setLastScan(decodedText);

    // Buscar el producto por código
    const product = products.find(p =>
      p.code === decodedText ||
      p.sku === decodedText ||
      p.name.toLowerCase().includes(decodedText.toLowerCase())
    );

    if (product) {
      // Producto encontrado
      console.log('✅ Producto encontrado:', product.name);
      onScanSuccess(product);

      // Feedback visual
      setError(null);

      // Limpiar después de 2 segundos para permitir otro escaneo
      setTimeout(() => {
        setLastScan(null);
      }, 2000);
    } else {
      // Producto no encontrado
      console.log('❌ Producto no encontrado para código:', decodedText);
      setError(`Producto "${decodedText}" no encontrado`);

      setTimeout(() => {
        setError(null);
        setLastScan(null);
      }, 3000);
    }
  };

  const handleScanError = (errorMessage) => {
    // Ignorar errores menores de escaneo
    // Solo logueamos para debugging
    // console.log('Scan error:', errorMessage);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleClose = async () => {
    await stopScanning();
    onClose();
  };

  return (
    <motion.div
      className={`fixed inset-0 bg-black/90 z-[60] flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`bg-white rounded-xl overflow-hidden shadow-2xl ${
          isFullscreen ? 'w-full h-full rounded-none' : 'max-w-lg w-full'
        }`}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25 }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Escanear Código</h3>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={toggleFullscreen}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </motion.button>
              <motion.button
                onClick={handleClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Scanner Area */}
        <div className={`relative bg-slate-900 ${isFullscreen ? 'h-full' : 'aspect-video'}`}>
          <div
            id="barcode-reader"
            ref={scannerRef}
            className="w-full h-full"
          />

          {/* Overlay con instrucciones */}
          {scanning && !error && !lastScan && (
            <motion.div
              className="absolute top-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-white text-sm text-center space-y-2">
                <p className="font-semibold">📷 Escanea el código de barras</p>
                <p className="text-xs opacity-90">
                  Soporta: EAN-13, UPC, CODE-128, CODE-39, QR
                </p>
              </div>
            </motion.div>
          )}

          {/* Guías visuales de escaneo */}
          {scanning && !lastScan && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Esquinas del área de escaneo */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-48 border-2 border-orange-500 rounded-lg">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-400 rounded-br-lg" />

                {/* Línea de escaneo animada */}
                <motion.div
                  className="absolute inset-x-0 h-0.5 bg-orange-400 shadow-lg shadow-orange-500/50"
                  initial={{ top: 0 }}
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </div>
          )}

          {/* Feedback de error */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="absolute bottom-4 left-4 right-4 bg-red-500 rounded-lg p-4 shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                <div className="flex items-start gap-2 text-white">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Producto no encontrado</p>
                    <p className="text-sm opacity-90">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback de éxito */}
          <AnimatePresence>
            {lastScan && !error && (
              <motion.div
                className="absolute bottom-4 left-4 right-4 bg-green-500 rounded-lg p-4 shadow-xl"
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
              >
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle className="w-5 h-5" />
                  <p className="font-semibold">¡Producto agregado!</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer con tips */}
        {!isFullscreen && (
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full" />
                Mantén el código dentro del área de escaneo
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full" />
                Asegúrate de tener buena iluminación
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full" />
                Los códigos de barras estándar funcionan mejor
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default BarcodeScanner;
