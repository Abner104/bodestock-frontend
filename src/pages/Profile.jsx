import React, { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Calendar,
  LogOut,
  Shield,
  BookOpen,
  Download,
  Briefcase,
  CheckCircle
} from "lucide-react";
import { getWorkerByEmail } from "../services/workers-service";

export default function Profile() {
  const navigate = useNavigate();
  const [currentWorker, setCurrentWorker] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadWorkerInfo = async () => {
      if (auth.currentUser?.email) {
        try {
          const worker = await getWorkerByEmail(auth.currentUser.email);
          if (worker) {
            setCurrentWorker(worker);
            setIsAdmin(worker.role === 'ADMIN');
          } else {
            // Admin legacy sin worker document
            setIsAdmin(true);
            setCurrentWorker({
              name: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
              email: auth.currentUser.email,
              role: 'ADMIN'
            });
          }
        } catch (error) {
          console.error('Error cargando información del trabajador:', error);
        }
      }
    };

    loadWorkerInfo();
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('redirectAfterLogin');
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión", error.message);
    }
  };

  const getRoleInfo = () => {
    switch (currentWorker?.role) {
      case 'ADMIN':
        return {
          label: 'Administrador',
          color: 'from-blue-600 to-blue-700',
          icon: Shield,
          guideUrl: '/GUIA_DE_USO_CLIENTES.pdf',
          guideName: 'Bodestock_Guia_Admin.pdf'
        };
      case 'SUPERVISOR':
        return {
          label: 'Supervisor',
          color: 'from-indigo-600 to-indigo-700',
          icon: Briefcase,
          guideUrl: '/GUIA_DE_USO_CLIENTES.pdf',
          guideName: 'Bodestock_Guia_Supervisor.pdf'
        };
      case 'WORKER':
        return {
          label: 'Trabajador',
          color: 'from-cyan-600 to-cyan-700',
          icon: User,
          guideUrl: '/GUIA_TRABAJADOR.html',
          guideName: 'Bodestock_Guia_Trabajador.html'
        };
      default:
        return {
          label: 'Usuario',
          color: 'from-gray-600 to-gray-700',
          icon: User,
          guideUrl: '/GUIA_DE_USO_CLIENTES.pdf',
          guideName: 'Bodestock_Guia_Usuario.pdf'
        };
    }
  };

  const roleInfo = getRoleInfo();
  const RoleIcon = roleInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black flex items-center justify-center p-4 md:p-8">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          {/* Header Section */}
          <div className={`relative bg-gradient-to-r ${roleInfo.color} p-8 md:p-12`}>
            <motion.div
              className="absolute inset-0 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            />

            <div className="relative flex flex-col items-center text-center">
              {/* Avatar */}
              <motion.div
                className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/20 backdrop-blur-xl border-4 border-white/40 flex items-center justify-center mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                whileHover={{ scale: 1.05 }}
              >
                <User className="w-12 h-12 md:w-16 md:h-16 text-white" />
              </motion.div>

              {/* Name */}
              <motion.h1
                className="text-2xl md:text-3xl font-bold text-white mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {auth.currentUser?.displayName || currentWorker?.name || "Usuario"}
              </motion.h1>

              {/* Role Badge */}
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-xl rounded-full border border-white/30"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <RoleIcon className="w-4 h-4 text-white" />
                <span className="text-sm font-semibold text-white">{roleInfo.label}</span>
              </motion.div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6 md:p-8 space-y-4">
            {/* Info Cards */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {/* Email Card */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-blue-500/50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium mb-1">Email</p>
                    <p className="text-sm text-white font-medium truncate">
                      {auth.currentUser?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Member Since Card */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-blue-500/50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 font-medium mb-1">Miembro desde</p>
                    <p className="text-sm text-white font-medium">
                      {new Date(auth.currentUser?.metadata.creationTime).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Status Card */}
            <motion.div
              className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl p-4 border border-green-500/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-green-400 font-medium mb-1">Estado de la cuenta</p>
                  <p className="text-sm text-white font-semibold">
                    ✓ Cuenta Verificada y Activa
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              className="space-y-3 pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              {/* Logout Button */}
              <motion.button
                onClick={handleLogout}
                className="w-full bg-white/5 hover:bg-white/10 text-white py-3.5 px-6 rounded-xl font-semibold border border-white/20 flex items-center justify-center gap-2 transition-all"
                whileHover={{
                  scale: 1.02,
                  borderColor: "rgba(239, 68, 68, 0.5)"
                }}
                whileTap={{ scale: 0.98 }}
              >
                <LogOut className="w-5 h-5" />
                Cerrar Sesión
              </motion.button>
            </motion.div>
          </div>
        </div>

        {/* Footer Info */}
        <motion.div
          className="text-center mt-6 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p>Bodestock - Sistema de Gestión de Inventario</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
