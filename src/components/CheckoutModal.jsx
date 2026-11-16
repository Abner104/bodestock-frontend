// src/components/CheckoutModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ShoppingBag,
  CheckCircle,
  Loader,
  AlertCircle,
  Search
} from 'lucide-react';
import { createOrder } from '../services/orders-service';
import { getCustomersByRutPublic } from '../services/customers-service';

const CheckoutModal = ({ cart, cartTotal, companyId, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Datos cliente, 2: Confirmación, 3: Éxito
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchingRut, setSearchingRut] = useState(false);
  const [rutFound, setRutFound] = useState(false);
  const [customerDirecciones, setCustomerDirecciones] = useState([]);
  const [multipleCustomers, setMultipleCustomers] = useState([]); // varios clientes con mismo RUT
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const [customerData, setCustomerData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    rut: '',
    direccion: '',
    comuna: '',
    notes: ''
  });

  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const applyCustomer = (customer) => {
    const dirs = customer.direcciones?.length > 0
      ? customer.direcciones
      : customer.direccion
        ? [{ label: 'Principal', direccion: customer.direccion, comuna: customer.comuna || '' }]
        : [];
    setCustomerDirecciones(dirs);
    const primeraDireccion = dirs[0] || { direccion: '', comuna: '' };
    setCustomerData(prev => ({
      ...prev,
      nombre: customer.razonSocial || customer.nombre || prev.nombre,
      email: customer.email || prev.email,
      telefono: customer.telefono || prev.telefono,
      direccion: primeraDireccion.direccion || prev.direccion,
      comuna: primeraDireccion.comuna || prev.comuna
    }));
    setRutFound(true);
  };

  // Autocompletado por RUT con debounce
  const searchByRut = useCallback(async (rut) => {
    if (!rut || rut.length < 8 || !companyId) return;

    setSearchingRut(true);
    setRutFound(false);
    setMultipleCustomers([]);
    setShowCustomerPicker(false);
    try {
      const customers = await getCustomersByRutPublic(companyId, rut);
      if (customers.length > 1) {
        // Varios clientes con mismo RUT → mostrar selector de razón social/giro
        setMultipleCustomers(customers);
        setShowCustomerPicker(true);
      } else if (customers.length === 1) {
        applyCustomer(customers[0]);
      }
    } catch (err) {
      console.error('Error buscando cliente:', err);
    } finally {
      setSearchingRut(false);
    }
  }, [companyId]);

  // Debounce para búsqueda por RUT
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerData.rut.length >= 8) {
        searchByRut(customerData.rut);
      } else {
        setRutFound(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [customerData.rut, searchByRut]);

  const validateStep1 = () => {
    if (!customerData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return false;
    }
    if (!customerData.telefono.trim()) {
      setError('El teléfono es obligatorio');
      return false;
    }
    if (customerData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
      setError('El email no es válido');
      return false;
    }

    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmitOrder = async () => {
    setLoading(true);
    setError(null);

    try {
      const orderData = {
        customerInfo: {
          nombre: customerData.nombre,
          email: customerData.email || null,
          telefono: customerData.telefono,
          rut: customerData.rut || null,
          direccion: customerData.direccion || null,
          comuna: customerData.comuna || null
        },
        items: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.salePrice,
          totalPrice: item.salePrice * item.quantity,
          presentacion: item.presentacion || null
        })),
        totalAmount: cartTotal,
        notes: customerData.notes || '',
        source: 'PUBLIC_CATALOG'
      };

      const orderId = await createOrder(orderData, companyId);
      console.log('Pedido creado exitosamente:', orderId);
      setStep(3);
    } catch (err) {
      console.error('Error creando pedido:', err);
      setError(err.message || 'Error al enviar el pedido. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-7 h-7" />
              <div>
                <h2 className="text-2xl font-bold">
                  {step === 1 && 'Datos de Contacto'}
                  {step === 2 && 'Confirmar Pedido'}
                  {step === 3 && 'Pedido Enviado!'}
                </h2>
                <p className="text-green-100 text-sm">
                  {step === 1 && 'Paso 1 de 2'}
                  {step === 2 && 'Paso 2 de 2'}
                  {step === 3 && 'Pedido completado'}
                </p>
              </div>
            </div>
            {step !== 3 && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-green-700 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Paso 1: Datos del cliente */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* RUT con autocompletado */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    RUT (opcional - autocompleta tus datos)
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={customerData.rut}
                      onChange={(e) => setCustomerData({ ...customerData, rut: e.target.value })}
                      placeholder="12.345.678-9"
                      className="w-full pl-10 pr-10 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    {searchingRut && (
                      <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {rutFound && !searchingRut && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                  </div>
                  {rutFound && (
                    <p className="text-xs text-green-600 mt-1 font-semibold">
                      Cliente encontrado - datos autocompletados
                    </p>
                  )}
                </div>

                {/* Selector de empresa/giro cuando hay varios clientes con el mismo RUT */}
                {showCustomerPicker && multipleCustomers.length > 1 && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-blue-800 mb-2">
                      Este RUT tiene varias empresas. ¿Cuál es?
                    </p>
                    <div className="space-y-1">
                      {multipleCustomers.map((c, i) => (
                        <button
                          key={c.id || i}
                          type="button"
                          onClick={() => {
                            applyCustomer(c);
                            setShowCustomerPicker(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg bg-white border border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-800">{c.razonSocial || c.nombre}</p>
                          {c.giro && <p className="text-xs text-slate-500">{c.giro}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nombre completo <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={customerData.nombre}
                      onChange={(e) => setCustomerData({ ...customerData, nombre: e.target.value })}
                      placeholder="Juan Pérez"
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      value={customerData.telefono}
                      onChange={(e) => setCustomerData({ ...customerData, telefono: e.target.value })}
                      placeholder="+56 9 1234 5678"
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email (opcional)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={customerData.email}
                      onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                      placeholder="correo@ejemplo.com"
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                {/* Selector de dirección si el cliente tiene múltiples */}
                {customerDirecciones.length > 1 && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      <MapPin className="inline w-4 h-4 mr-1 text-green-500" />
                      Seleccionar dirección de entrega
                    </label>
                    <select
                      onChange={(e) => {
                        const d = customerDirecciones[parseInt(e.target.value)];
                        setCustomerData(prev => ({ ...prev, direccion: d.direccion, comuna: d.comuna }));
                      }}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                    >
                      {customerDirecciones.map((d, i) => (
                        <option key={i} value={i}>
                          {d.label ? `${d.label}: ` : ''}{d.direccion}{d.comuna ? `, ${d.comuna}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Dirección de entrega (opcional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={customerData.direccion}
                      onChange={(e) => setCustomerData({ ...customerData, direccion: e.target.value })}
                      placeholder="Calle Ejemplo 123"
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Comuna (opcional)
                  </label>
                  <input
                    type="text"
                    value={customerData.comuna}
                    onChange={(e) => setCustomerData({ ...customerData, comuna: e.target.value })}
                    placeholder="Santiago"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    value={customerData.notes}
                    onChange={(e) => setCustomerData({ ...customerData, notes: e.target.value })}
                    placeholder="Instrucciones de entrega, preferencias, etc."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  />
                </div>
              </motion.div>
            )}

            {/* Paso 2: Confirmación */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Resumen del cliente */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Datos de contacto
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nombre:</strong> {customerData.nombre}</p>
                    <p><strong>Teléfono:</strong> {customerData.telefono}</p>
                    {customerData.email && <p><strong>Email:</strong> {customerData.email}</p>}
                    {customerData.rut && <p><strong>RUT:</strong> {customerData.rut}</p>}
                    {customerData.direccion && (
                      <p><strong>Dirección:</strong> {customerData.direccion}{customerData.comuna ? `, ${customerData.comuna}` : ''}</p>
                    )}
                    {customerData.notes && (
                      <p className="mt-2 pt-2 border-t border-blue-200">
                        <strong>Notas:</strong> {customerData.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Editar datos
                  </button>
                </div>

                {/* Resumen del pedido */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
                  <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    Resumen del pedido
                  </h3>
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-sm text-slate-600">
                            {item.quantity} x {formatCLP(item.salePrice)}
                          </p>
                        </div>
                        <p className="font-bold text-green-600">
                          {formatCLP(item.salePrice * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t-2 border-slate-300 flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">Total:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCLP(cartTotal)}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-900">
                    <strong>Nota:</strong> Al confirmar tu pedido, te contactaremos por teléfono
                    para coordinar el pago y la entrega.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Paso 3: Éxito */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </motion.div>

                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  Pedido Enviado Exitosamente!
                </h3>
                <p className="text-slate-600 mb-6">
                  Hemos recibido tu pedido. Nos pondremos en contacto contigo al <strong>{customerData.telefono}</strong> para coordinar el pago y la entrega.
                </p>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-sm text-blue-900">
                    <strong>Próximos pasos:</strong>
                  </p>
                  <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                    <li>Te llamaremos para confirmar tu pedido</li>
                    <li>Coordinaremos el método de pago</li>
                    <li>Acordaremos la fecha y hora de entrega</li>
                    <li>Recibirás tu boleta o factura electrónica</li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                  Cerrar
                </button>
              </motion.div>
            )}
          </div>

          {/* Footer con botones - Solo en pasos 1 y 2 */}
          {step !== 3 && (
            <div className="border-t border-slate-200 p-6 bg-slate-50 flex gap-3">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Atrás
                </button>
              )}

              {step === 1 && (
                <button
                  onClick={handleNext}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                  Continuar
                </button>
              )}

              {step === 2 && (
                <button
                  onClick={handleSubmitOrder}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Enviando pedido...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Confirmar Pedido
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CheckoutModal;
