// src/components/ErrorBoundary.jsx
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Error Boundary Component
 * Captura errores en el árbol de componentes de React y muestra una UI de fallback
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Actualizar estado para mostrar UI de fallback
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error Boundary capturó un error:', error, errorInfo);

    this.setState({ error, errorInfo });

    // Enviar error a Firestore para diagnóstico remoto
    Promise.all([
      import('../firebase/firebase'),
      import('firebase/firestore'),
    ]).then(([{ db }, { addDoc, collection, serverTimestamp }]) => {
      addDoc(collection(db, 'error_logs'), {
        message: error?.message || String(error),
        stack: error?.stack || '',
        componentStack: errorInfo?.componentStack || '',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: serverTimestamp(),
      });
    }).catch(() => {});
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // UI de fallback personalizada
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
          >
            {/* Icono de error */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>
            </div>

            {/* Título y descripción */}
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              ¡Oops! Algo salió mal
            </h1>
            <p className="text-white/70 text-center mb-6">
              La aplicación encontró un error inesperado. No te preocupes, tus datos están seguros.
            </p>

            {/* Botones de acción */}
            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleReload}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Recargar Página
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={this.handleGoHome}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-white/20"
              >
                <Home className="w-5 h-5" />
                Ir al Inicio
              </motion.button>
            </div>

            {/* Detalles del error (solo en desarrollo) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-sm">
                <summary className="text-white/50 cursor-pointer hover:text-white/70 transition-colors">
                  Detalles técnicos
                </summary>
                <div className="mt-3 p-3 bg-black/30 rounded-lg overflow-auto max-h-40">
                  <p className="text-red-400 font-mono text-xs mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-white/50 font-mono text-xs overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Footer */}
            <p className="text-white/40 text-xs text-center mt-6">
              Si el problema persiste, contacta a soporte
            </p>
          </motion.div>
        </div>
      );
    }

    // Si no hay error, renderizar children normalmente
    return this.props.children;
  }
}

export default ErrorBoundary;
