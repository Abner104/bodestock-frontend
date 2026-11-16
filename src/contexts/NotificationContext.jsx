// src/contexts/NotificationContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { useTheme } from './ThemeContext';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const { isDark } = useTheme();

  const playSound = useCallback(() => {
    try {
      // Crear un sonido más audible usando Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Primer tono
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();

      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);

      oscillator1.frequency.value = 1000; // Frecuencia más alta
      oscillator1.type = 'sine';

      gainNode1.gain.setValueAtTime(0.5, audioContext.currentTime); // Volumen más alto
      gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.15);

      // Segundo tono para efecto de notificación
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();

      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);

      oscillator2.frequency.value = 1200;
      oscillator2.type = 'sine';

      gainNode2.gain.setValueAtTime(0.5, audioContext.currentTime + 0.1);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

      oscillator2.start(audioContext.currentTime + 0.1);
      oscillator2.stop(audioContext.currentTime + 0.25);
    } catch (error) {
      console.log('Audio not supported:', error);
    }
  }, []);

  const showNotification = useCallback(({
    type = 'info',
    title,
    message,
    duration = 4000
  }) => {
    const id = Date.now() + Math.random();

    // Reproducir sonido
    playSound();

    setNotifications(prev => [...prev, { id, type, title, message }]);

    // Auto dismiss
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);

    return id;
  }, [playSound]);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getColors = (type) => {
    // Todos los tipos usan azul como color principal
    return {
      bg: isDark ? 'bg-blue-500/20' : 'bg-blue-50',
      border: 'border-blue-500/30',
      icon: 'text-blue-500',
      text: isDark ? 'text-blue-100' : 'text-blue-900'
    };
  };

  return (
    <NotificationContext.Provider value={{ showNotification, dismissNotification }}>
      {children}

      {/* Notification Container - Centered Style */}
      <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none flex items-center justify-center">
        <div className="w-full flex flex-col items-center px-4 sm:px-6 pt-4">
          <AnimatePresence mode="popLayout">
            {notifications.map((notification, index) => {
              const colors = getColors(notification.type);
              const icon = getIcon(notification.type);

              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{
                    opacity: 0,
                    y: -150,
                    scale: 0.5,
                    rotateX: -90,
                  }}
                  animate={{
                    opacity: 1,
                    y: index * 80,
                    scale: 1,
                    rotateX: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -150,
                    scale: 0.5,
                    rotateX: -90,
                    transition: { duration: 0.3, ease: "easeInOut" }
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                    mass: 0.8
                  }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.3}
                  onDragEnd={(e, { offset, velocity }) => {
                    if (offset.y < -50 || velocity.y < -500) {
                      dismissNotification(notification.id);
                    }
                  }}
                  className="pointer-events-auto mb-3 w-full max-w-md mx-auto"
                  whileHover={{ scale: 1.02 }}
                >
                  {/* Notification Card with Enhanced Effects */}
                  <motion.div
                    className={`
                      backdrop-blur-2xl rounded-3xl border-2 shadow-2xl
                      ${colors.bg} ${colors.border}
                      ${isDark ? 'shadow-black/50 shadow-blue-500/20' : 'shadow-blue-500/30'}
                      ring-2 ring-blue-400/20
                    `}
                    animate={{
                      boxShadow: [
                        '0 20px 25px -5px rgba(59, 130, 246, 0.3), 0 10px 10px -5px rgba(59, 130, 246, 0.2)',
                        '0 25px 35px -5px rgba(59, 130, 246, 0.4), 0 15px 15px -5px rgba(59, 130, 246, 0.3)',
                        '0 20px 25px -5px rgba(59, 130, 246, 0.3), 0 10px 10px -5px rgba(59, 130, 246, 0.2)',
                      ]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <div className="px-5 py-4 flex items-start gap-3">
                      {/* Icon with Pulse Effect */}
                      <motion.div
                        className={`flex-shrink-0 ${colors.icon} relative`}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{
                          scale: [1, 1.2, 1],
                          rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                          scale: {
                            duration: 0.6,
                            repeat: 3,
                            ease: "easeInOut"
                          },
                          rotate: {
                            duration: 0.5,
                            ease: "easeInOut"
                          }
                        }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-50"
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 0.8, 0.5]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                        <div className="relative">{icon}</div>
                      </motion.div>

                      {/* Content with Enhanced Animations */}
                      <div className="flex-1 min-w-0">
                        {notification.title && (
                          <motion.h4
                            className={`font-bold text-base mb-1 ${colors.text} drop-shadow-sm`}
                            initial={{ opacity: 0, x: -30, scale: 0.8 }}
                            animate={{
                              opacity: 1,
                              x: 0,
                              scale: [0.8, 1.1, 1],
                            }}
                            transition={{
                              delay: 0.1,
                              duration: 0.5,
                              ease: "easeOut"
                            }}
                          >
                            {notification.title}
                          </motion.h4>
                        )}
                        {notification.message && (
                          <motion.p
                            className={`text-sm ${colors.text} drop-shadow-sm`}
                            initial={{ opacity: 0, x: -30 }}
                            animate={{
                              opacity: 1,
                              x: 0,
                            }}
                            transition={{
                              delay: 0.25,
                              duration: 0.4,
                              ease: "easeOut"
                            }}
                          >
                            {notification.message}
                          </motion.p>
                        )}
                      </div>

                      {/* Close Button */}
                      <motion.button
                        onClick={() => dismissNotification(notification.id)}
                        className={`flex-shrink-0 ${colors.icon} opacity-50 hover:opacity-100 transition-opacity`}
                        whileTap={{ scale: 0.85 }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 0.5, scale: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Enhanced Progress Bar with Glow */}
                    <div className="relative h-2 bg-blue-200/30 rounded-b-3xl overflow-hidden">
                      <motion.div
                        className={`absolute inset-0 ${colors.icon} bg-gradient-to-r from-blue-400 to-blue-600`}
                        initial={{ scaleX: 1, opacity: 1 }}
                        animate={{
                          scaleX: 0,
                          opacity: [1, 0.8, 0.6]
                        }}
                        transition={{ duration: 4, ease: 'linear' }}
                        style={{ transformOrigin: 'left' }}
                      />
                      <motion.div
                        className="absolute inset-0 bg-blue-400 blur-sm"
                        initial={{ scaleX: 1, opacity: 0.5 }}
                        animate={{
                          scaleX: 0,
                          opacity: [0.5, 0.3, 0]
                        }}
                        transition={{ duration: 4, ease: 'linear' }}
                        style={{ transformOrigin: 'left' }}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
