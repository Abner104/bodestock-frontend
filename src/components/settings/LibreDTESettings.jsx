// src/components/settings/LibreDTESettings.jsx
// Configuración de SimpleFactura para facturación electrónica

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Info, CheckCircle, AlertCircle, FileText, RefreshCw, Plus, ExternalLink, Eye, EyeOff, Pencil, Lock } from 'lucide-react';
import { getLibreDTEConfig } from '../../services/libredte-service.js';
import { useToast } from '../ui/Toast.jsx';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/firebase.js';
import { getUserCompanyId } from '../../services/companyService.js';
import { FUNCTIONS_ENDPOINTS } from '../../config/functions.js';

const LibreDTESettings = () => {
  const [config, setConfig] = useState({
    proveedor: 'simplefactura',
    ambiente: 'certificacion',
    sfEmail: '',
    sfPassword: '',
    sucursal: 'Casa Matriz',
    rutEmisor: '',
    razonSocial: '',
    giro: '',
    actividadEconomica: '',
    direccion: '',
    comuna: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  // Credenciales: si ya están guardadas, ocultarlas hasta que el usuario haga click en "Editar"
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState(false); // true cuando vienen de Firestore

  // Folios
  const [foliosData, setFoliosData] = useState(null); // { 33: {disponibles: 50}, 39: {...}, ... }
  const [loadingFolios, setLoadingFolios] = useState(false);
  const [solicitando, setSolicitando] = useState(null); // tipoDTE que se está solicitando
  const [cantidadSolicitar, setCantidadSolicitar] = useState({}); // { tipoDTE: cantidad }
  const [foliosSinUso, setFoliosSinUso] = useState({}); // { tipoDTE: [{folioInicio, folioTermino}] }
  const [loadingSinUso, setLoadingSinUso] = useState(null); // tipoDTE cargando
  const [anulando, setAnulando] = useState(null); // tipoDTE anulando
  const [confirmAnular, setConfirmAnular] = useState(null); // { tipo, label, rangos }

  const DTE_TIPOS = [
    { tipo: 33, label: 'Factura Electrónica', color: 'blue' },
    { tipo: 39, label: 'Boleta Electrónica', color: 'green' },
    { tipo: 52, label: 'Guía de Despacho', color: 'purple' },
    { tipo: 61, label: 'Nota de Crédito', color: 'red' },
  ];

  const consultarFolios = async () => {
    if (!config.sfEmail || !config.sfPassword || !config.rutEmisor) {
      toast?.addToast?.('Completa las credenciales primero', 'error');
      return;
    }
    setLoadingFolios(true);
    setFoliosSinUso({});
    try {
      // 1. Consultar disponibles
      const resp = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_FOLIOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sfEmail: config.sfEmail,
          sfPassword: config.sfPassword,
          rutEmpresa: config.rutEmisor,
          ambiente: config.ambiente,
          action: 'consultar'
        })
      });
      const data = await resp.json();
      if (resp.status === 401 || (data.error && data.error.toLowerCase().includes('credencial'))) {
        throw new Error('Credenciales incorrectas. Verifica tu email y contraseña de SimpleFactura.');
      }
      if (!resp.ok) throw new Error(data.error || 'Error consultando folios');
      setFoliosData(data.folios);
    } catch (err) {
      toast?.addToast?.('Error consultando folios: ' + err.message, 'error');
    } finally {
      setLoadingFolios(false);
    }
  };

  const solicitarFolios = async (tipoDTE) => {
    const cantidad = cantidadSolicitar[tipoDTE] || 100;
    setSolicitando(tipoDTE);
    try {
      const resp = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_FOLIOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sfEmail: config.sfEmail,
          sfPassword: config.sfPassword,
          rutEmpresa: config.rutEmisor,
          ambiente: config.ambiente,
          sucursal: config.sucursal || 'Casa Matriz',
          action: 'solicitar',
          tipoDTE,
          cantidad
        })
      });
      const data = await resp.json();
      if (resp.status === 401 || resp.status === 403 || (data.error && data.error.toLowerCase().includes('credencial'))) {
        throw new Error('Credenciales incorrectas. Verifica tu email y contraseña de SimpleFactura.');
      }
      if (!resp.ok) throw new Error(data.error || 'Error solicitando folios');
      toast?.addToast?.(`✅ Folios solicitados correctamente`, 'success');
      await consultarFolios(); // refrescar
    } catch (err) {
      toast?.addToast?.('Error solicitando folios: ' + err.message, 'error');
    } finally {
      setSolicitando(null);
    }
  };

  const consultarSinUso = async (tipoDTE) => {
    setLoadingSinUso(tipoDTE);
    try {
      const resp = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_FOLIOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sfEmail: config.sfEmail,
          sfPassword: config.sfPassword,
          rutEmpresa: config.rutEmisor,
          ambiente: config.ambiente,
          sucursal: config.sucursal || 'Casa Matriz',
          action: 'sin-uso',
          tipoDTE,
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error consultando folios sin uso');
      setFoliosSinUso(prev => ({ ...prev, [tipoDTE]: data.foliosSinUso }));
    } catch (err) {
      toast?.addToast?.('Error: ' + err.message, 'error');
    } finally {
      setLoadingSinUso(null);
    }
  };

  const anularFolios = async (tipoDTE, rangos) => {
    if (!rangos || rangos.length === 0) return;
    setAnulando(tipoDTE);
    try {
      let anulados = 0;
      for (const rango of rangos) {
        const resp = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_FOLIOS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sfEmail: config.sfEmail,
            sfPassword: config.sfPassword,
            rutEmpresa: config.rutEmisor,
            ambiente: config.ambiente,
            sucursal: rango.sucursal || config.sucursal || 'Casa Matriz',
            action: 'anular',
            tipoDTE,
            folioInicio: rango.desde,
            folioTermino: rango.hasta,
            motivoAnulacion: 'Folios sin uso'
          })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Error anulando folios');
        anulados++;
      }
      toast?.addToast?.(`✅ ${anulados} rango(s) anulados correctamente. El SII desbloqueará el timbraje en breve.`, 'success');
      setFoliosSinUso(prev => ({ ...prev, [tipoDTE]: [] }));
      setConfirmAnular(null);
      await consultarFolios(); // refrescar
    } catch (err) {
      toast?.addToast?.('Error anulando: ' + err.message, 'error');
    } finally {
      setAnulando(null);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await getLibreDTEConfig();
      if (savedConfig) {
        setConfig(prev => ({ ...prev, ...savedConfig, proveedor: 'simplefactura' }));
        if (savedConfig.sfEmail && savedConfig.sfPassword) {
          setSavedCredentials(true);
          setEditingCredentials(false);
        }
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!config.sfEmail || !config.sfPassword || !config.rutEmisor || !config.razonSocial) {
        alert('Completa los campos obligatorios: Email, Contraseña, RUT y Razón Social');
        setSaving(false);
        return;
      }

      const companyId = await getUserCompanyId();
      if (!companyId) {
        throw new Error('No se pudo obtener el companyId');
      }

      await setDoc(doc(db, `companies/${companyId}/settings`, 'libredte'), {
        ...config,
        proveedor: 'simplefactura',
        updatedAt: new Date()
      }, { merge: true });

      setSaved(true);
      setSavedCredentials(true);
      setEditingCredentials(false);
      setTimeout(() => setSaved(false), 3000);

      try {
        toast?.addToast?.('Configuración guardada', 'success');
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isConfigComplete = config.sfEmail && config.sfPassword && config.rutEmisor && config.razonSocial;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Configuración de Facturación Electrónica SII</p>
          <p className="text-blue-700">
            Conecta tu cuenta de{' '}
            <a href="https://www.simplefactura.cl" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
              SimpleFactura
            </a>
            {' '}para emitir boletas y facturas válidas ante el SII de Chile.
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* Proveedor fijo */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Proveedor de Facturación
          </h3>
          <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-purple-900">SimpleFactura</p>
                <p className="text-xs text-purple-700">
                  Registrate en{' '}
                  <a href="https://www.simplefactura.cl" target="_blank" rel="noopener noreferrer" className="underline">
                    simplefactura.cl
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de Ambiente */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Ambiente de Operación
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleChange('ambiente', 'certificacion')}
              className={`py-4 px-4 rounded-xl font-bold transition-all border-2 ${
                config.ambiente === 'certificacion'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-lg'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'
              }`}
            >
              Certificación (Pruebas)
            </button>
            <button
              onClick={() => handleChange('ambiente', 'produccion')}
              className={`py-4 px-4 rounded-xl font-bold transition-all border-2 ${
                config.ambiente === 'produccion'
                  ? 'bg-green-600 text-white border-green-700 shadow-lg'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-green-400'
              }`}
            >
              Producción (Real)
            </button>
          </div>

          {config.ambiente === 'certificacion' && (
            <div className="mt-3 p-3 bg-amber-50 border-2 border-amber-300 rounded-lg">
              <p className="text-sm text-amber-900 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Modo Certificación: Los documentos NO serán válidos ante el SII. Solo para pruebas.
              </p>
            </div>
          )}

          {config.ambiente === 'produccion' && (
            <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg">
              <p className="text-sm text-red-900 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Modo Producción: Los documentos serán REALES y válidos ante el SII.
              </p>
            </div>
          )}
        </div>

        {/* Credenciales SimpleFactura */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Credenciales SimpleFactura
          </h3>

          {/* Si ya están guardadas y no se está editando: mostrar enmascaradas */}
          {savedCredentials && !editingCredentials ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                  <Lock className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Credenciales guardadas</p>
                  <p className="text-xs text-green-600">{config.sfEmail} · ••••••••</p>
                </div>
              </div>
              <button
                onClick={() => setEditingCredentials(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email de SimpleFactura <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={config.sfEmail}
                  onChange={(e) => handleChange('sfEmail', e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Contraseña de SimpleFactura <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={config.sfPassword}
                  onChange={(e) => handleChange('sfPassword', e.target.value)}
                  placeholder="Tu contraseña"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sucursal
              </label>
              <input
                type="text"
                value={config.sucursal}
                onChange={(e) => handleChange('sucursal', e.target.value)}
                placeholder="Casa Matriz"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Nombre de la sucursal configurada en SimpleFactura
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mt-8">
                Usa las mismas credenciales con las que inicias sesión en SimpleFactura.
              </p>
            </div>
          </div>
        </div>

        {/* Datos del Emisor */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Datos del Emisor (Tu Empresa)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                RUT Emisor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.rutEmisor}
                onChange={(e) => handleChange('rutEmisor', e.target.value)}
                placeholder="76123456-7"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.razonSocial}
                onChange={(e) => handleChange('razonSocial', e.target.value)}
                placeholder="Minimarket El Buen Precio SpA"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Giro Comercial
              </label>
              <input
                type="text"
                value={config.giro}
                onChange={(e) => handleChange('giro', e.target.value)}
                placeholder="Venta al por menor en minimarket"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Actividad Económica (Código)
              </label>
              <input
                type="text"
                value={config.actividadEconomica}
                onChange={(e) => handleChange('actividadEconomica', e.target.value)}
                placeholder="471110"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Código de actividad económica del SII
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Dirección
              </label>
              <input
                type="text"
                value={config.direccion}
                onChange={(e) => handleChange('direccion', e.target.value)}
                placeholder="Av. Principal 123"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Comuna
              </label>
              <input
                type="text"
                value={config.comuna}
                onChange={(e) => handleChange('comuna', e.target.value)}
                placeholder="Santiago"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Estado de configuración */}
        {isConfigComplete ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">
              Configuración completa - Listo para emitir boletas
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">
              Completa los campos obligatorios para activar la emisión de boletas
            </span>
          </div>
        )}

        {/* Botón Guardar */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white ${
              saved
                ? 'bg-green-500'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Configuración'}
          </motion.button>
        </div>

        {/* ── Sección Folios ── */}
        {isConfigComplete && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Stock de Folios
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Consulta y solicita folios al SII vía SimpleFactura</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.sii.cl/servicios_online/1039-.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  SII
                </a>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={consultarFolios}
                  disabled={loadingFolios}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFolios ? 'animate-spin' : ''}`} />
                  {loadingFolios ? 'Consultando...' : 'Consultar'}
                </motion.button>
              </div>
            </div>

            {foliosData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DTE_TIPOS.map(({ tipo, label }) => {
                  const info = foliosData[tipo];
                  const disponibles = info?.disponibles ?? null;
                  const errorSII = !info?.ok && info?.error ? info.error : null;
                  const sinUso = foliosSinUso[tipo];
                  const tieneSinUso = Array.isArray(sinUso) && sinUso.length > 0;
                  const totalSinUso = tieneSinUso ? sinUso.reduce((acc, r) => acc + (r.cantidad || 0), 0) : 0;
                  const alerta = disponibles !== null && disponibles < 20;
                  const cantidad = cantidadSolicitar[tipo] || 100;

                  return (
                    <div key={tipo} className={`rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                      errorSII ? 'border-red-500/30 bg-slate-800/60' :
                      alerta ? 'border-red-400/40 bg-slate-800/60' :
                      'border-slate-600/50 bg-slate-800/60'
                    }`}>

                      {/* Nombre del tipo */}
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>

                      {/* Métrica principal */}
                      {errorSII ? (
                        <p className="text-3xl font-bold text-red-400">—</p>
                      ) : (
                        <div className={`rounded-xl p-4 ${alerta ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-700/50'}`}>
                          <p className={`text-4xl font-bold ${alerta ? 'text-red-400' : 'text-white'}`}>
                            {disponibles ?? '—'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">disponibles para emitir</p>
                        </div>
                      )}

                      {/* Error SII */}
                      {errorSII && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-400 leading-relaxed">
                            {errorSII.length > 120 ? errorSII.slice(0, 120) + '…' : errorSII}
                          </p>
                        </div>
                      )}

                      {/* Alerta pocos folios */}
                      {alerta && !errorSII && (
                        <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <p className="text-xs text-red-400">Quedan pocos folios, solicita más</p>
                        </div>
                      )}

                      {/* Solicitar folios */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={cantidad}
                          onChange={e => setCantidadSolicitar(prev => ({ ...prev, [tipo]: Number(e.target.value) }))}
                          className="w-24 text-sm px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-700/80 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => solicitarFolios(tipo)}
                          disabled={solicitando === tipo}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50 transition"
                        >
                          {solicitando === tipo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {solicitando === tipo ? 'Solicitando...' : 'Solicitar folios'}
                        </motion.button>
                      </div>

                      {/* Folios sin uso — solo aparece si hay rangos */}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-600 rounded-2xl">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Haz clic en <strong className="text-slate-300">Consultar</strong> para ver el stock de folios
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Modal confirmación anular */}

    {confirmAnular && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmAnular(null)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Anular folios sin uso</h3>
              <p className="text-slate-400 text-sm mt-1">
                Vas a anular los folios sin uso de <strong className="text-white">{confirmAnular.label}</strong>. Esta acción es irreversible y se reportará al SII.
              </p>
            </div>
          </div>

          <div className="mb-5 p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rangos a anular</p>
            {confirmAnular.rangos.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{r.sucursal || 'Casa Matriz'}</span>
                <span className="text-red-400 font-medium">Folio {r.desde} → {r.hasta} <span className="text-slate-500">({r.cantidad} folios)</span></span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setConfirmAnular(null)}
              className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold transition"
            >
              Cancelar
            </button>
            <button
              onClick={() => anularFolios(confirmAnular.tipo, confirmAnular.rangos)}
              disabled={anulando === confirmAnular.tipo}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {anulando === confirmAnular.tipo && <RefreshCw className="w-4 h-4 animate-spin" />}
              {anulando === confirmAnular.tipo ? 'Anulando...' : 'Confirmar anulación'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
    </>
  );
};

export default LibreDTESettings;
