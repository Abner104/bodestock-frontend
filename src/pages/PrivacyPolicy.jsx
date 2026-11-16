// src/pages/PrivacyPolicy.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye } from 'lucide-react';
import Logo from '../components/ui/Logo';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
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
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Política de Privacidad</h1>
                <p className="text-gray-600">Última actualización: Noviembre 2025</p>
              </div>
            </div>

            <div className="prose prose-slate max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introducción</h2>
                <p className="text-gray-700 leading-relaxed">
                  En Bodestock, nos comprometemos a proteger su privacidad y sus datos personales.
                  Esta Política de Privacidad explica qué información recopilamos, cómo la usamos y sus derechos.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Información que Recopilamos</h2>

                <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.1 Información de Cuenta</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Nombre completo</li>
                  <li>Dirección de correo electrónico</li>
                  <li>Nombre de la empresa</li>
                  <li>Contraseña (encriptada)</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.2 Información de Uso</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Datos de inventario (productos, stock, precios)</li>
                  <li>Información de trabajadores que usted agrega</li>
                  <li>Movimientos de inventario (entradas, salidas)</li>
                  <li>Reportes generados</li>
                  <li>Logs de actividad en el sistema</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-4">2.3 Información Técnica</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Dirección IP</li>
                  <li>Tipo de navegador y dispositivo</li>
                  <li>Fecha y hora de acceso</li>
                  <li>Páginas visitadas</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Cómo Usamos Su Información</h2>
                <p className="text-gray-700 leading-relaxed mb-4">Utilizamos su información para:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Proporcionar y mantener el servicio de Bodestock</li>
                  <li>Procesar sus transacciones y pagos</li>
                  <li>Enviar notificaciones importantes (alertas de stock, reportes)</li>
                  <li>Mejorar y personalizar su experiencia</li>
                  <li>Detectar y prevenir fraudes o abusos</li>
                  <li>Cumplir con obligaciones legales</li>
                  <li>Enviar actualizaciones del producto (con opción de desuscribirse)</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Compartir Información</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  <strong>NO vendemos ni alquilamos sus datos personales a terceros.</strong>
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">Compartimos información solo cuando:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li><strong>Con su consentimiento:</strong> Si usted autoriza explícitamente</li>
                  <li><strong>Proveedores de servicios:</strong> Firebase (hosting), procesadores de pago (Stripe/MercadoPago)</li>
                  <li><strong>Requerimiento legal:</strong> Si es exigido por ley o autoridades</li>
                  <li><strong>Protección de derechos:</strong> Para proteger nuestros derechos legales</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Seguridad de Datos</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-gray-800 font-semibold mb-2">Medidas de Seguridad Implementadas:</p>
                      <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                        <li>Encriptación SSL/TLS para todas las conexiones</li>
                        <li>Contraseñas hasheadas con bcrypt</li>
                        <li>Arquitectura multi-tenant (datos separados por empresa)</li>
                        <li>Autenticación de dos factores disponible</li>
                        <li>Respaldos automáticos diarios</li>
                        <li>Monitoreo de actividad sospechosa</li>
                        <li>Acceso restringido por roles y permisos</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  A pesar de nuestros esfuerzos, ningún método de transmisión por Internet es 100% seguro.
                  Hacemos todo lo posible para proteger sus datos, pero no podemos garantizar seguridad absoluta.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Retención de Datos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Conservamos su información mientras su cuenta esté activa o según sea necesario para:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Proporcionar el servicio</li>
                  <li>Cumplir obligaciones legales</li>
                  <li>Resolver disputas</li>
                  <li>Hacer cumplir nuestros acuerdos</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Cuando cancela su cuenta, sus datos se conservan durante <strong>30 días</strong> antes de ser eliminados permanentemente.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Sus Derechos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">Usted tiene derecho a:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-800 mb-1">Acceso</p>
                        <p className="text-sm text-gray-600">Solicitar una copia de sus datos personales</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Eye className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-800 mb-1">Corrección</p>
                        <p className="text-sm text-gray-600">Actualizar información incorrecta</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Eye className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-800 mb-1">Eliminación</p>
                        <p className="text-sm text-gray-600">Solicitar borrado de sus datos</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Eye className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-800 mb-1">Portabilidad</p>
                        <p className="text-sm text-gray-600">Exportar sus datos en formato Excel/PDF</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Para ejercer estos derechos, contáctenos en <strong>soporte@bodestockgo.com</strong>
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Cookies y Tecnologías Similares</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Utilizamos cookies para:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li>Mantener su sesión iniciada</li>
                  <li>Recordar sus preferencias (tema claro/oscuro)</li>
                  <li>Analizar el uso del servicio</li>
                  <li>Prevenir fraudes</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Puede configurar su navegador para rechazar cookies, pero esto puede afectar la funcionalidad del servicio.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Transferencias Internacionales</h2>
                <p className="text-gray-700 leading-relaxed">
                  Sus datos pueden ser transferidos y almacenados en servidores ubicados fuera de Chile
                  (Firebase - servidores de Google). Nos aseguramos de que estos proveedores cumplan con estándares
                  de protección de datos equivalentes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Privacidad de Menores</h2>
                <p className="text-gray-700 leading-relaxed">
                  Nuestro servicio no está dirigido a menores de 18 años. No recopilamos intencionalmente
                  información de menores. Si descubrimos que hemos recopilado datos de un menor, los eliminaremos inmediatamente.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Cambios a Esta Política</h2>
                <p className="text-gray-700 leading-relaxed">
                  Podemos actualizar esta Política de Privacidad ocasionalmente. Los cambios importantes
                  serán notificados por email con 30 días de anticipación. Le recomendamos revisar esta página periódicamente.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Contacto</h2>
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <p className="text-gray-800 font-semibold mb-2">¿Preguntas sobre su privacidad?</p>
                  <p className="text-gray-700 mb-4">Estamos aquí para ayudarle:</p>
                  <div className="space-y-2">
                    <p className="text-gray-800"><strong>Email:</strong> soporte@bodestockgo.com</p>
                    <p className="text-gray-800"><strong>Horario:</strong> Lunes a Viernes, 9:00 - 18:00 (Chile)</p>
                    <p className="text-gray-600 text-sm mt-4">Responderemos su solicitud en un plazo máximo de 48 horas hábiles.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
