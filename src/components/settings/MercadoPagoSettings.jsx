// src/components/settings/MercadoPagoSettings.jsx
// Conexión de la cuenta de Mercado Pago de ESTA empresa para cobrar los
// pedidos de su tienda pública (ver PublicStore.jsx) -- cada empresa pega
// su propio Access Token, así el dinero va directo a su cuenta, nunca a la
// de Bodestock. Mismo patrón visual que LibreDTESettings.jsx (credenciales
// enmascaradas hasta que se pide editar).
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Info, CheckCircle, AlertCircle, CreditCard, ExternalLink, Pencil, Lock } from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebase.js';
import { getUserCompanyId } from '../../services/companyService.js';
import { FUNCTIONS_ENDPOINTS } from '../../config/functions.js';

const MercadoPagoSettings = () => {
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [savedToken, setSavedToken] = useState(false); // true cuando ya hay un token guardado en Firestore

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return;
      const snap = await getDoc(doc(db, `companies/${companyId}/settings`, 'mercadopago'));
      if (snap.exists() && snap.data().accessToken) {
        setAccessToken(snap.data().accessToken);
        setSavedToken(true);
        setEditing(false);
      }
    } catch (error) {
      console.error('Error cargando configuración de Mercado Pago:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accessToken || !accessToken.trim()) {
      toast?.addToast?.('Pega tu Access Token de Mercado Pago', 'error');
      return;
    }
    setSaving(true);
    try {
      // companies/{id}.mpConnected (el flag que lee la tienda pública sin
      // sesión para saber si ofrecer "pagar online") solo lo puede escribir
      // el servidor -- companies/{id} es write: super-admin-only en las
      // reglas de Firestore. Por eso esto pasa por una Cloud Function en
      // vez de setDoc directo, que además valida que quien llama sea
      // ADMIN de su propia empresa antes de tocar nada.
      const user = auth.currentUser;
      if (!user) throw new Error('Debes iniciar sesión');
      const idToken = await user.getIdToken();

      const resp = await fetch(FUNCTIONS_ENDPOINTS.SAVE_MERCADOPAGO_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ accessToken: accessToken.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo guardar el Access Token');

      setSaved(true);
      setSavedToken(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
      toast?.addToast?.('Mercado Pago conectado', 'success');
    } catch (error) {
      console.error('Error guardando Access Token:', error);
      toast?.addToast?.('Error al guardar: ' + error.message, 'error');
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

  const mask = accessToken ? `${accessToken.slice(0, 8)}••••••••${accessToken.slice(-4)}` : '';

  return (
    <div className="space-y-6">
      {/* Header explicativo */}
      <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Cobra tus pedidos online con Mercado Pago</p>
          <p className="text-blue-700">
            Conecta tu propia cuenta de Mercado Pago para que el dinero de los pedidos de tu tienda llegue
            directo a ti (tarjeta y transferencia). Bodestock nunca toca ese dinero.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {/* De dónde sacar el token */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Cuenta de Mercado Pago
          </h3>
          <div className="p-4 bg-sky-50 border-2 border-sky-300 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm">
                <p className="font-bold text-sky-900">Access Token de producción</p>
                <p className="text-sky-700">
                  Sácalo en{' '}
                  <a
                    href="https://www.mercadopago.cl/developers/panel/app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1"
                  >
                    tu panel de Mercado Pago <ExternalLink className="w-3 h-3" />
                  </a>
                  {' '}→ Tus integraciones → Credenciales de producción.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Token: enmascarado si ya está guardado, editable si no */}
        <div>
          {savedToken && !editing ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                  <Lock className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Mercado Pago conectado</p>
                  <p className="text-xs text-green-600">{mask}</p>
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
              >
                <Pencil className="w-3.5 h-3.5" />
                Cambiar
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Access Token <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="APP_USR-xxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxx"
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Empieza con "APP_USR-". Nunca lo compartas: con él se pueden crear cobros a tu nombre.
              </p>
            </div>
          )}
        </div>

        {/* Estado */}
        {savedToken ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">
              Tu tienda ya puede cobrar pedidos con tarjeta y transferencia
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">
              Sin conectar: los pedidos de tu tienda se pagan en caja al retirar
            </span>
          </div>
        )}

        {(!savedToken || editing) && (
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                saved ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Access Token'}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MercadoPagoSettings;
