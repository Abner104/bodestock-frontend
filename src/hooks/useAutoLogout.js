// src/hooks/useAutoLogout.js
import { useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase';

const useAutoLogout = (timeoutMinutes = 30) => {
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  const resetTimer = () => {
    // Limpiar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Warning 2 minutos antes del logout
    const warningTime = (timeoutMinutes - 2) * 60 * 1000;
    warningTimeoutRef.current = setTimeout(() => {
      const shouldStay = window.confirm(
        '⚠️ Tu sesión expirará en 2 minutos por inactividad.\n\n¿Quieres continuar?'
      );

      if (shouldStay) {
        resetTimer(); // Reiniciar el timer si el usuario quiere continuar
      }
    }, warningTime);

    // Auto logout
    const logoutTime = timeoutMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(async () => {
      try {
        await signOut(auth);
        alert('🕐 Sesión cerrada automáticamente por inactividad.');
      } catch (error) {
        console.error('Error al cerrar sesión automáticamente:', error);
      }
    }, logoutTime);
  };

  useEffect(() => {
    // Solo activar si hay un usuario autenticado
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Eventos que detectan actividad del usuario
        const events = [
          'mousedown',
          'mousemove',
          'keypress',
          'scroll',
          'touchstart',
          'click'
        ];

        // Función throttled para evitar demasiadas llamadas
        let lastActivity = Date.now();
        const handleActivity = () => {
          const now = Date.now();
          if (now - lastActivity > 1000) { // Throttle de 1 segundo
            lastActivity = now;
            resetTimer();
          }
        };

        // Agregar listeners
        events.forEach(event => {
          document.addEventListener(event, handleActivity, true);
        });

        // Inicializar timer
        resetTimer();

        // Cleanup function
        return () => {
          events.forEach(event => {
            document.removeEventListener(event, handleActivity, true);
          });
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current);
          }
        };
      }
    });

    return unsubscribe;
  }, [timeoutMinutes]);

  // Cleanup en unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);
};

export default useAutoLogout;