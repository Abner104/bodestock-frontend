// src/components/inventory/SimpleBarcodeScanner.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CheckCircle, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

const SimpleBarcodeScanner = ({ onScanSuccess, onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

      const html5QrCode = new Html5Qrcode("simple-barcode-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778
      };

      await html5QrCode.start(
        { facingMode: "environment" },
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

  const handleScanSuccess = (decodedText) => {
    console.log('📷 Código escaneado:', decodedText);

    // Evitar escaneos duplicados
    if (lastScan === decodedText) {
      return;
    }

    setLastScan(decodedText);
    setError(null);

    // Llamar al callback con el código escaneado
    onScanSuccess(decodedText);

    // Auto-cerrar después de 1 segundo
    setTimeout(() => {
      stopScanning().then(() => onClose());
    }, 1000);
  };

  const handleScanError = () => {
    // Ignorar errores menores de escaneo
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
      className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl ${
          isFullscreen ? 'w-full h-full rounded-none' : 'max-w-sm w-full'
        }`}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        {/* Header compacto */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <h3 className="font-semibold text-sm">Escanear Código</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <motion.button
                onClick={toggleFullscreen}
                className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition"
                whileTap={{ scale: 0.95 }}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </motion.button>
              <motion.button
                onClick={handleClose}
                className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition"
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Scanner Area - más compacto */}
        <div className={`relative bg-slate-900 ${isFullscreen ? 'h-full' : 'aspect-[4/3]'}`}>
          <div id="simple-barcode-reader" className="w-full h-full" />

          {scanning && !error && !lastScan && (
            <motion.div
              className="absolute top-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-white text-xs text-center">Apunta al código de barras</p>
            </motion.div>
          )}

          {error && (
            <motion.div
              className="absolute bottom-2 left-2 right-2 bg-red-500 rounded-lg p-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 text-white">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs">{error}</p>
              </div>
            </motion.div>
          )}

          {lastScan && (
            <motion.div
              className="absolute bottom-2 left-2 right-2 bg-green-500 rounded-lg p-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-center gap-2 text-white">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Escaneado</p>
                  <p className="text-xs font-mono">{lastScan}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {!isFullscreen && (
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border-t text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Se agregará al campo SKU automáticamente</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default SimpleBarcodeScanner;
