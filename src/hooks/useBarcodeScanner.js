// src/hooks/useBarcodeScanner.js
import { useEffect, useRef, useState } from 'react';

/**
 * Hook para detectar escaneo de códigos de barras con pistola láser
 * Las pistolas de código de barras funcionan como teclados USB que envían
 * el código seguido de Enter muy rápidamente
 */
export const useBarcodeScanner = (onScan, options = {}) => {
  const {
    minLength = 3,          // Longitud mínima del código
    maxLength = 50,         // Longitud máxima del código
    scanTimeout = 100,      // Tiempo máximo entre teclas (ms)
    enabled = true,         // Si el scanner está habilitado
    preventDefault = true   // Si prevenir el comportamiento por defecto
  } = options;

  const [isScanning, setIsScanning] = useState(false);
  const bufferRef = useRef('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (event) => {
      // Ignorar si el usuario está escribiendo en un input/textarea
      const target = event.target;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      // Solo ignorar si NO es un input de tipo búsqueda o código de barras
      if (isInputField &&
          target.type !== 'search' &&
          !target.classList.contains('barcode-input')) {
        return;
      }

      // Enter indica fin del escaneo
      if (event.key === 'Enter') {
        if (preventDefault) {
          event.preventDefault();
        }

        const code = bufferRef.current.trim();

        // Validar longitud
        if (code.length >= minLength && code.length <= maxLength) {
          setIsScanning(false);
          onScan(code);
        }

        // Limpiar buffer
        bufferRef.current = '';

        // Limpiar timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        return;
      }

      // Ignorar teclas especiales (Shift, Ctrl, Alt, etc.)
      if (event.key.length > 1 && event.key !== 'Backspace') {
        return;
      }

      if (preventDefault) {
        event.preventDefault();
      }

      // Agregar caracter al buffer
      if (event.key === 'Backspace') {
        bufferRef.current = bufferRef.current.slice(0, -1);
      } else {
        bufferRef.current += event.key;
        setIsScanning(true);
      }

      // Reiniciar timer - si pasa mucho tiempo, no es un scanner
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        // Si pasó mucho tiempo, limpiar buffer (no es scanner)
        bufferRef.current = '';
        setIsScanning(false);
        timerRef.current = null;
      }, scanTimeout);
    };

    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, minLength, maxLength, scanTimeout, onScan, preventDefault]);

  return {
    isScanning,
    buffer: bufferRef.current
  };
};
