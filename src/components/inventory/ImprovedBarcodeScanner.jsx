// src/components/inventory/ImprovedBarcodeScanner.jsx
// Motor: @undecaf/zbar-wasm (ZBar C++ via WebAssembly) — mucho más rápido que ZXing JS en móvil
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, CheckCircle, AlertTriangle, Maximize2, Minimize2, Zap, ZapOff, RefreshCw } from 'lucide-react';

const ImprovedBarcodeScanner = ({ onScanSuccess, onClose, products, inline = false, rawMode = false }) => {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [permissionState, setPermissionState] = useState('requesting');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1 });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const mountedRef = useRef(true);
  const lastVibrateRef = useRef(0); // cooldown vibración — evita loop
  const lastScanRef = useRef(null);
  const zbarRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    initScanner();
    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, []);

  const initScanner = async () => {
    try {
      setError(null);
      setPermissionState('requesting');

      // Cargar zbar-wasm dinámicamente
      if (!zbarRef.current) {
        const { scanImageData } = await import('@undecaf/zbar-wasm');
        zbarRef.current = scanImageData;
      }

      // Pedir permisos
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      tempStream.getTracks().forEach(t => t.stop());

      if (!mountedRef.current) return;
      setPermissionState('granted');

      // Listar cámaras
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);

      // Preferir cámara trasera
      const backIdx = videoDevices.findIndex(d =>
        /back|rear|trasera|environment/i.test(d.label)
      );
      const idx = backIdx >= 0 ? backIdx : 0;
      setDeviceIndex(idx);

      await startStream(videoDevices[idx]?.deviceId);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setError('Permiso de cámara denegado. Actívalo en la configuración de tu navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara en este dispositivo.');
      } else {
        setError('No se pudo acceder a la cámara: ' + err.message);
      }
    }
  };

  const startStream = async (deviceId) => {
    stopStream();
    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScanning(true);
      checkCameraCapabilities();
      requestAnimationFrame(scanLoop);
    } catch (err) {
      console.error('Error iniciando stream:', err);
      if (mountedRef.current) setError('No se pudo iniciar la cámara: ' + err.message);
    }
  };

  const stopStream = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setTorchOn(false);
  };

  const stopScanning = () => {
    stopStream();
    setZoomLevel(1);
    setTorchSupported(false);
    setZoomSupported(false);
  };

  // Loop de escaneo: captura frame → zbar-wasm decodifica
  const scanLoop = async () => {
    if (!mountedRef.current || !zbarRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const results = await zbarRef.current(imageData);
      if (results.length > 0) {
        const code = results[0].decode();
        if (code && code !== lastScanRef.current) {
          handleScanSuccess(code);
        }
      }
    } catch (_) {}

    // ~15fps es suficiente para lectura fluida sin quemar CPU
    if (mountedRef.current) {
      rafRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(scanLoop);
      }, 66);
    }
  };

  const handleScanSuccess = (decodedText) => {
    lastScanRef.current = decodedText;
    setLastScan(decodedText);

    // Vibrar solo si pasaron más de 3 segundos desde la última vibración
    const now = Date.now();
    const vibrate = (pattern) => {
      if (navigator.vibrate && (now - lastVibrateRef.current) > 3000) {
        navigator.vibrate(pattern);
        lastVibrateRef.current = now;
      }
    };

    if (rawMode) {
      vibrate(200);
      onScanSuccess(null, decodedText);
      setError(null);
      setTimeout(() => { lastScanRef.current = null; setLastScan(null); }, 2000);
      return;
    }

    const product = products?.find(p =>
      p.code === decodedText || p.sku === decodedText ||
      p.barcode === decodedText || p.ean === decodedText
    );

    if (product) {
      vibrate(200);
      onScanSuccess(product);
      setError(null);
      setTimeout(() => { lastScanRef.current = null; setLastScan(null); }, 2000);
    } else {
      vibrate([100, 50, 100]);
      setError(`Código "${decodedText}" no encontrado en inventario`);
      setTimeout(() => { setError(null); lastScanRef.current = null; setLastScan(null); }, 3000);
    }
  };

  const checkCameraCapabilities = () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      const caps = track.getCapabilities?.();
      if (!caps) return;
      setTorchSupported(!!caps.torch);
      if (caps.zoom) {
        setZoomSupported(true);
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
      }
    } catch (_) {}
  };

  const toggleTorch = async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) { console.error('torch error:', err); }
  };

  const cycleZoom = async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      const levels = [1, 2, 3].filter(l => l <= zoomRange.max);
      const next = levels[(levels.indexOf(zoomLevel) + 1) % levels.length] || 1;
      await track.applyConstraints({ advanced: [{ zoom: next }] });
      setZoomLevel(next);
    } catch (err) { console.error('zoom error:', err); }
  };

  const switchCamera = async () => {
    if (devices.length < 2) return;
    const next = (deviceIndex + 1) % devices.length;
    setDeviceIndex(next);
    await startStream(devices[next]?.deviceId);
  };

  const handleClose = () => { stopScanning(); onClose(); };

  const renderPermissionDenied = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <div className="text-center text-white p-4">
        <Camera className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-semibold mb-1">Cámara bloqueada</p>
        <p className="text-xs opacity-70 mb-3">Activa el permiso de cámara en la configuración de tu navegador</p>
        <button onClick={initScanner} className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          Reintentar
        </button>
      </div>
    </div>
  );

  const controlButtons = (
    <>
      {zoomSupported && (
        <button onClick={cycleZoom} className={`px-2 py-1 rounded-lg text-white text-xs font-bold transition z-10 ${zoomLevel > 1 ? 'bg-blue-500/80' : 'bg-black/50 hover:bg-black/70'}`}>
          {zoomLevel}x
        </button>
      )}
      {torchSupported && (
        <button onClick={toggleTorch} className={`p-1.5 rounded-lg text-white transition z-10 ${torchOn ? 'bg-yellow-500/80' : 'bg-black/50 hover:bg-black/70'}`}>
          {torchOn ? <ZapOff className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
        </button>
      )}
      {devices.length > 1 && (
        <button onClick={switchCamera} className="p-1.5 rounded-lg text-white bg-black/50 hover:bg-black/70 transition z-10">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </>
  );

  // ===== INLINE MODE =====
  if (inline) {
    return (
      <div className="relative w-full h-full">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {permissionState === 'denied' && renderPermissionDenied()}
        {permissionState === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-center text-white">
              <motion.div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full mx-auto mb-3" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
              <p className="text-xs opacity-70">Activando cámara...</p>
            </div>
          </div>
        )}

        {scanning && !lastScan && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-48 h-28 sm:w-64 sm:h-36 border-2 border-blue-400 rounded-lg">
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-[3px] border-l-[3px] border-blue-400 rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-[3px] border-r-[3px] border-blue-400 rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-[3px] border-l-[3px] border-blue-400 rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-[3px] border-r-[3px] border-blue-400 rounded-br-lg" />
              <motion.div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent" initial={{ top: '0%' }} animate={{ top: ['0%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatType: "reverse" }} />
            </div>
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-1.5">{controlButtons}</div>

        <AnimatePresence>
          {lastScan && !error && (
            <motion.div className="absolute bottom-2 left-2 right-2 bg-emerald-500 rounded-lg px-3 py-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <div className="flex items-center gap-1.5 text-white"><CheckCircle className="w-4 h-4" /><span className="text-xs font-semibold">Agregado: {lastScan}</span></div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {error && permissionState !== 'denied' && (
            <motion.div className="absolute bottom-2 left-2 right-2 bg-red-500 rounded-lg px-3 py-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <div className="flex items-center gap-1.5 text-white"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-semibold">{error}</span></div>
            </motion.div>
          )}
        </AnimatePresence>

        {!scanning && error && permissionState !== 'denied' && permissionState !== 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center text-white p-4">
              <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs opacity-70 mb-3">{error}</p>
              <button onClick={initScanner} className="px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-medium hover:bg-blue-700 transition">Reintentar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== MODAL MODE =====
  return (
    <motion.div
      className={`fixed inset-0 bg-black/90 z-[60] flex items-center justify-center ${isFullscreen ? 'p-0' : 'p-4'}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className={`bg-white rounded-xl overflow-hidden shadow-2xl ${isFullscreen ? 'w-full h-full rounded-none' : 'max-w-lg w-full'}`}
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25 }}
      >
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <h3 className="font-semibold text-lg">Escanear Código de Barras</h3>
            </div>
            <div className="flex items-center gap-2">
              {zoomSupported && (
                <button onClick={cycleZoom} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${zoomLevel > 1 ? 'bg-blue-400/40' : 'bg-white/20 hover:bg-white/30'}`}>
                  {zoomLevel}x
                </button>
              )}
              {torchSupported && (
                <button onClick={toggleTorch} className={`p-2 rounded-lg transition ${torchOn ? 'bg-yellow-400/40' : 'bg-white/20 hover:bg-white/30'}`}>
                  {torchOn ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </button>
              )}
              {devices.length > 1 && (
                <button onClick={switchCamera} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={handleClose} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className={`relative bg-slate-900 ${isFullscreen ? 'h-full' : 'aspect-video'}`}>
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          {permissionState === 'denied' && renderPermissionDenied()}
          {permissionState === 'requesting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center text-white">
                <motion.div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full mx-auto mb-3" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                <p className="text-sm opacity-70">Activando cámara...</p>
              </div>
            </div>
          )}

          {scanning && !lastScan && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-80 h-52 border-2 border-blue-500 rounded-lg">
                <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                <motion.div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-lg shadow-blue-500/50" initial={{ top: '0%' }} animate={{ top: ['0%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatType: "reverse" }} />
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && permissionState !== 'denied' && (
              <motion.div className="absolute bottom-4 left-4 right-4 bg-red-500 rounded-lg p-4 shadow-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
                <div className="flex items-start gap-2 text-white">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div><p className="font-semibold">Código no encontrado</p><p className="text-sm opacity-90">{error}</p></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {lastScan && !error && (
              <motion.div className="absolute bottom-4 left-4 right-4 bg-green-500 rounded-lg p-4 shadow-xl" initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}>
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle className="w-5 h-5" />
                  <div><p className="font-semibold">Producto encontrado!</p><p className="text-sm opacity-90">Código: {lastScan}</p></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ImprovedBarcodeScanner;
