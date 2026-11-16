// src/pages/AyudaPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  HelpCircle,
  MessageSquare,
  ArrowLeft,
  Search,
  BookOpen,
  Users,
  Package,
  Warehouse,
  CreditCard,
  Shield,
  Zap
} from 'lucide-react';
import Logo from '../components/ui/Logo';

const FAQ_CATEGORIES = [
  {
    id: 'plans',
    label: 'Planes y Precios',
    icon: CreditCard,
    color: 'from-blue-500 to-indigo-600',
    items: [
      {
        q: '¿Cuáles son los planes disponibles y cuánto cuestan?',
        a: 'Bodestock tiene 2 planes: Básico ($29.990/mes): inventario, control de ventas, escáner de barras, exportar Excel/PDF, alertas de stock, trabajadores y roles, modo oscuro y app móvil. Profesional ($59.990/mes): todo lo del Básico más add-ons incluidos. También puedes agregar Facturación SII como add-on opcional por $14.990/mes adicional.'
      },
      {
        q: '¿Qué diferencia hay entre el plan Básico y el Profesional?',
        a: 'El plan Básico ($29.990/mes) incluye todo lo esencial: inventario, control de ventas, escáner de barras, costeo PPP, exportar Excel/PDF, alertas de stock, trabajadores y roles, modo oscuro y app móvil. Puedes agregar Facturación SII como add-on por $14.990/mes adicional, que también incluye cartera de clientes y gestión de pedidos.'
      },
      {
        q: '¿Hay un período de prueba gratuito?',
        a: 'Sí, todos los planes tienen 30 días de prueba gratis al registrarte. No necesitas ingresar datos de pago para empezar. Al vencer el trial tienes 5 días hábiles adicionales (período de gracia) para elegir un plan antes de que se bloquee el acceso.'
      },
      {
        q: '¿Puedo cancelar mi suscripción en cualquier momento?',
        a: 'Sí, no hay contratos de permanencia. Puedes cancelar en cualquier momento desde Configuración → Planes con un solo click. Tu acceso se suspende de inmediato al cancelar.'
      },
      {
        q: '¿Qué métodos de pago aceptan?',
        a: 'Aceptamos Mercado Pago, que incluye tarjetas de crédito/débito, transferencia bancaria y otros métodos disponibles. Todos los precios están en CLP (pesos chilenos).'
      },
    ]
  },
  {
    id: 'inventory',
    label: 'Inventario y Productos',
    icon: Package,
    color: 'from-green-500 to-emerald-600',
    items: [
      {
        q: '¿Cuántos productos puedo agregar?',
        a: 'Ambos planes no tienen límite fijo de productos. Bodestock está diseñado para crecer con tu negocio sin restricciones artificiales en el catálogo.'
      },
      {
        q: '¿Qué incluye la gestión de inventario?',
        a: 'Ambos planes incluyen: inventario en tiempo real, control de salidas y ventas, escáner de código de barras, costeo PPP (Precio Promedio Ponderado), exportar a Excel y PDF, alertas de stock bajo por email, trabajadores y roles, modo oscuro y app móvil.'
      },
      {
        q: '¿Puedo importar productos desde Excel?',
        a: 'Sí. Desde el inventario hay un botón "Importar Excel" que te permite subir una planilla con tus productos. El sistema procesa el archivo y agrega los productos automáticamente.'
      },
      {
        q: '¿Cómo funciona el costeo PPP?',
        a: 'El Precio Promedio Ponderado se recalcula automáticamente cada vez que registras una compra. Considera el stock existente y el nuevo precio de compra para darte siempre el costo real actualizado de cada producto.'
      },
    ]
  },
  {
    id: 'warehouses',
    label: 'Bodegas y Sucursales',
    icon: Warehouse,
    color: 'from-orange-500 to-amber-600',
    items: [
      {
        q: '¿Cuántas bodegas/sucursales puedo tener?',
        a: 'El plan Básico incluye 1 sucursal/bodega. Puedes agregar sucursales adicionales como add-on por $10.990/mes cada una. Cada sucursal tiene su propio inventario, trabajadores y reportes completamente independientes.'
      },
      {
        q: '¿Puedo transferir stock entre bodegas?',
        a: 'Sí. Desde cualquier producto puedes hacer una transferencia de stock entre bodegas. El sistema registra el movimiento y actualiza los saldos de ambas bodegas automáticamente. Disponible desde el plan Profesional (multi-bodega).'
      },
    ]
  },
  {
    id: 'workers',
    label: 'Trabajadores y Permisos',
    icon: Users,
    color: 'from-purple-500 to-violet-600',
    items: [
      {
        q: '¿Cuántos usuarios/trabajadores puedo agregar?',
        a: 'El plan Básico incluye hasta 5 usuarios. Puedes agregar usuarios adicionales por $7.990/mes cada uno. Bodestock muestra el conteo actual en el botón "Nuevo Trabajador".'
      },
      {
        q: '¿Cómo creo un trabajador?',
        a: 'Ve a "Trabajadores" en el menú y presiona "Nuevo Trabajador". Ingresa nombre, email y elige el rol. El sistema genera las credenciales automáticamente (email + contraseña) y puedes compartirlas con el trabajador para que inicie sesión.'
      },
      {
        q: '¿Qué roles existen?',
        a: 'Admin (acceso total y configuración), Encargado (gestión sin configuración), Cajero (solo registrar salidas y ventas), Trabajador (consulta y registro básico). También puedes personalizar permisos individuales por usuario.'
      },
      {
        q: '¿Puedo limitar cuánto puede vender un trabajador por día?',
        a: 'Sí. Al crear o editar un trabajador puedes establecer un límite diario en pesos ($) o en unidades. Si el trabajador intenta superar ese límite, el sistema lo bloquea y le avisa.'
      },
    ]
  },
  {
    id: 'billing',
    label: 'Facturación Electrónica',
    icon: BookOpen,
    color: 'from-cyan-500 to-blue-600',
    items: [
      {
        q: '¿Cómo conecto SimpleFactura?',
        a: 'Dentro de Bodestock, ve a Configuración → Facturación e ingresa tus credenciales de SimpleFactura (RUT empresa, API Key y ambiente). Una vez conectado, podrás emitir facturas directamente desde Bodestock.'
      },
      {
        q: '¿Necesito certificarme ante el SII?',
        a: 'Depende. Con SimpleFactura: ellos se encargan de todo el proceso de certificación, es más rápido. Con el SII directamente: es gratuito pero requiere conocimiento técnico. Para la mayoría recomendamos SimpleFactura.'
      },
      {
        q: '¿Puedo usar Bodestock sin facturación electrónica?',
        a: 'Sí, absolutamente. La facturación electrónica es un add-on opcional por $14.990/mes adicional. Puedes usar Bodestock para gestión de inventario, control de salidas, trabajadores y reportes sin necesidad de activarla.'
      },
    ]
  },
  {
    id: 'security',
    label: 'Seguridad y Datos',
    icon: Shield,
    color: 'from-red-500 to-pink-600',
    items: [
      {
        q: '¿Mis datos están seguros?',
        a: 'Sí. Bodestock utiliza Firebase de Google como base de datos con encriptación en tránsito y en reposo. Los datos de cada empresa están completamente aislados entre sí. Cumplimos con normativas de privacidad de datos.'
      },
      {
        q: '¿Puedo exportar mis datos?',
        a: 'Sí. Desde el inventario e historial puedes exportar a Excel o PDF en cualquier momento mientras tu cuenta esté activa.'
      },
    ]
  },
];

export default function AyudaPage() {
  const navigate = useNavigate();
  const [openItem, setOpenItem] = useState(null); // "categoryId-index"
  const [activeCategory, setActiveCategory] = useState('plans');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrado por búsqueda
  const filteredCategories = searchQuery.trim()
    ? FAQ_CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(
          item =>
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.items.length > 0)
    : FAQ_CATEGORIES.filter(cat => cat.id === activeCategory);

  const displayCategories = searchQuery.trim() ? filteredCategories : FAQ_CATEGORIES.filter(c => c.id === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Logo size="sm" animated={false} />
            <span className="text-white/40 hidden sm:block">/</span>
            <span className="font-semibold text-white/80 hidden sm:block">Centro de Ayuda</span>
          </div>
          <a
            href="https://wa.me/56948487391?text=Hola%2C%20necesito%20ayuda%20con%20Bodestock"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Soporte por WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Título */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Centro de Ayuda</h1>
          <p className="text-white/50 text-lg">Encuentra respuestas a las preguntas más frecuentes</p>
        </motion.div>

        {/* Búsqueda */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-8"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            placeholder="Buscar en preguntas frecuentes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
          />
        </motion.div>

        {/* Categorías (solo si no hay búsqueda) */}
        {!searchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8"
          >
            {FAQ_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setOpenItem(null); }}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all text-sm font-semibold ${
                    activeCategory === cat.id
                      ? 'border-blue-500/40 bg-blue-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cat.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  {cat.label}
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Preguntas */}
        <div className="space-y-3">
          {displayCategories.map(cat =>
            cat.items.map((item, i) => {
              const key = `${cat.id}-${i}`;
              const isOpen = openItem === key;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isOpen
                      ? 'border-blue-500/40 bg-blue-500/5'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <button
                    onClick={() => setOpenItem(isOpen ? null : key)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                  >
                    <span className="text-white font-semibold text-sm sm:text-base">{item.q}</span>
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 text-blue-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="px-6 pb-5 text-white/60 text-sm leading-relaxed">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}

          {/* Sin resultados */}
          {searchQuery.trim() && displayCategories.length === 0 && (
            <div className="text-center py-12 text-white/40">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-semibold">No se encontraron resultados</p>
              <p className="text-sm mt-1">Intenta con otras palabras o contáctanos por WhatsApp</p>
            </div>
          )}
        </div>

        {/* CTA WhatsApp */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-12 text-center bg-white/5 border border-white/10 rounded-2xl p-8"
        >
          <Zap className="w-8 h-8 text-green-400 mx-auto mb-3" />
          <h3 className="text-xl font-bold mb-2">¿No encontraste lo que buscabas?</h3>
          <p className="text-white/50 text-sm mb-5">Nuestro equipo responde en menos de 24 horas</p>
          <a
            href="https://wa.me/56948487391?text=Hola%2C%20necesito%20ayuda%20con%20Bodestock"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 !text-white font-semibold transition-all shadow-lg shadow-green-500/20"
          >
            <MessageSquare className="w-5 h-5" />
            Contactar soporte por WhatsApp
          </a>
        </motion.div>
      </div>
    </div>
  );
}
