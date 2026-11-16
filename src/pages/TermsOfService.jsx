// src/pages/TermsOfService.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Scale } from 'lucide-react';
import Logo from '../components/ui/Logo';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>

          <div className="flex items-center justify-between mb-6">
            <Logo size="md" showText={true} />
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <Scale className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Términos y Condiciones de Uso</h1>
                <p className="text-gray-600">Última actualización: Noviembre 2025</p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Aceptación de los Términos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Al acceder y utilizar Bodestock ("el Servicio"), usted acepta estar sujeto a estos Términos y Condiciones.
                  Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestro servicio.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Descripción del Servicio</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Bodestock es una plataforma SaaS (Software as a Service) diseñada para la gestión de inventario,
                  cálculo de costos de productos y administración de equipos de trabajo. El servicio incluye:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Gestión de inventario multi-bodega</li>
                  <li>Cálculo automático de PPP (Precio Promedio Ponderado)</li>
                  <li>Sistema de alertas y notificaciones</li>
                  <li>Reportes mensuales automáticos</li>
                  <li>Gestión de trabajadores y permisos</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Registro y Cuenta de Usuario</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Para utilizar el Servicio, debe:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Proporcionar información precisa y completa durante el registro</li>
                  <li>Mantener la seguridad de su contraseña</li>
                  <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta</li>
                  <li>Ser responsable de todas las actividades realizadas bajo su cuenta</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Planes y Pagos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Bodestock ofrece diferentes planes de suscripción:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li><strong>Plan Gratuito:</strong> Funcionalidades limitadas para prueba</li>
                  <li><strong>Plan Básico:</strong> $19.990 CLP/mes</li>
                  <li><strong>Plan Profesional:</strong> $49.990 CLP/mes</li>
                  <li><strong>Plan Empresa:</strong> $79.990 CLP/mes</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Los pagos se procesan mensualmente. Puede cancelar su suscripción en cualquier momento,
                  pero no se realizarán reembolsos por períodos no utilizados.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Uso Aceptable</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Usted se compromete a NO:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Utilizar el Servicio para fines ilegales o no autorizados</li>
                  <li>Intentar acceder a sistemas o datos sin autorización</li>
                  <li>Sobrecargar o interferir con la infraestructura del Servicio</li>
                  <li>Copiar, modificar o distribuir el software sin permiso</li>
                  <li>Revender o sublicenciar el acceso al Servicio</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Propiedad Intelectual</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  El Servicio y todo su contenido, características y funcionalidad son propiedad de Bodestock
                  y están protegidos por derechos de autor, marcas registradas y otras leyes.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Usted conserva todos los derechos sobre los datos que carga en el Servicio.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Privacidad y Seguridad de Datos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Nos comprometemos a proteger su privacidad. Su información está:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Almacenada de forma segura en servidores encriptados</li>
                  <li>Separada por empresa (multi-tenancy)</li>
                  <li>No compartida con terceros sin su consentimiento</li>
                  <li>Respaldada diariamente</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Limitación de Responsabilidad</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  El Servicio se proporciona "tal cual". No garantizamos que:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>El Servicio estará disponible 100% del tiempo sin interrupciones</li>
                  <li>Los errores serán corregidos inmediatamente</li>
                  <li>El Servicio cumplirá con todos sus requisitos específicos</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  No seremos responsables por daños indirectos, incidentales o consecuentes derivados del uso del Servicio.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Cancelación y Terminación</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Puede cancelar su cuenta en cualquier momento desde la configuración.
                  Nos reservamos el derecho de suspender o terminar su acceso si viola estos términos.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Al cancelar, sus datos se conservarán durante 30 días antes de ser eliminados permanentemente.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Modificaciones</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Podemos modificar estos términos en cualquier momento. Los cambios importantes serán notificados
                  por email con 30 días de anticipación.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Ley Aplicable</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Estos términos se rigen por las leyes de Chile. Cualquier disputa será resuelta en los tribunales de Santiago.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Contacto</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Para preguntas sobre estos términos, contáctenos en:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-gray-800 font-medium">Email: soporte@bodestockgo.com</p>
                  <p className="text-gray-600 text-sm mt-2">Horario: Lunes a Viernes, 9:00 - 18:00</p>
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TermsOfService;
