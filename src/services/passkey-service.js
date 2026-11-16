// src/services/passkey-service.js
// Servicio WebAuthn/Passkeys para super-admin Y usuarios normales (clientes/trabajadores)
// Super-admin: guarda en 'superadmin_passkeys/{deviceId}'
// Usuarios normales: guarda en localStorage (la verificación biométrica es local al dispositivo)

import { db } from '../firebase/firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

const SUPERADMIN_COLLECTION = 'superadmin_passkeys';

// Convierte ArrayBuffer a Base64URL
function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convierte Base64URL a ArrayBuffer
function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const str = atob(padded);
  const buf = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return buf;
}

// Genera un ID único para este dispositivo (guardado en localStorage)
function getDeviceId() {
  let id = localStorage.getItem('bodestock_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('bodestock_device_id', id);
  }
  return id;
}

// Keys de localStorage para usuarios normales (por email)
function getUserPasskeyKey(email) {
  return `bodestock_passkey_id_${btoa(email).replace(/=/g, '')}`;
}
function getUserPasskeyEmailKey(email) {
  return `bodestock_passkey_email_${btoa(email).replace(/=/g, '')}`;
}
function getUserPasskeyNameKey(email) {
  return `bodestock_passkey_name_${btoa(email).replace(/=/g, '')}`;
}

// Verifica si el navegador soporta WebAuthn
export function isWebAuthnSupported() {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    navigator.credentials.create &&
    navigator.credentials.get
  );
}

// ============================================================
// SUPER ADMIN (backward compat)
// ============================================================

// Verifica si hay una passkey del super-admin registrada en este dispositivo
export function hasPasskeyRegistered() {
  if (!isWebAuthnSupported()) return false;
  return !!localStorage.getItem('bodestock_passkey_id');
}

// Registra una nueva passkey para el super-admin
export async function registerPasskey(userEmail) {
  if (!isWebAuthnSupported()) throw new Error('Tu navegador no soporta passkeys.');

  const deviceId = getDeviceId();
  const userId = new TextEncoder().encode(deviceId);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyOptions = {
    challenge,
    rp: {
      name: 'Bodestock Super Admin',
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: userEmail,
      displayName: 'Super Admin',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  };

  const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
  if (!credential) throw new Error('No se pudo crear la passkey.');

  const credentialData = {
    credentialId: bufferToBase64url(credential.rawId),
    userEmail,
    deviceId,
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };

  await setDoc(doc(db, SUPERADMIN_COLLECTION, deviceId), credentialData);
  localStorage.setItem('bodestock_passkey_id', credentialData.credentialId);
  localStorage.setItem('bodestock_passkey_email', userEmail);

  return credentialData;
}

// Autentica usando la passkey del super-admin
export async function authenticateWithPasskey() {
  if (!isWebAuthnSupported()) throw new Error('Tu navegador no soporta passkeys.');

  const credentialId = localStorage.getItem('bodestock_passkey_id');
  const userEmail = localStorage.getItem('bodestock_passkey_email');
  if (!credentialId || !userEmail) throw new Error('No hay passkey registrada en este dispositivo.');

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertionOptions = {
    challenge,
    allowCredentials: [
      {
        type: 'public-key',
        id: base64urlToBuffer(credentialId),
        transports: ['internal'],
      },
    ],
    userVerification: 'required',
    timeout: 60000,
  };

  const assertion = await navigator.credentials.get({ publicKey: assertionOptions });
  if (!assertion) throw new Error('Autenticación cancelada.');

  const deviceId = getDeviceId();
  try {
    await setDoc(doc(db, SUPERADMIN_COLLECTION, deviceId), { lastUsed: new Date().toISOString() }, { merge: true });
  } catch (_) {
    // No hay sesión activa aún, se actualiza después del login
  }

  return userEmail;
}

// Elimina la passkey del super-admin
export async function removePasskey() {
  const deviceId = getDeviceId();
  await deleteDoc(doc(db, SUPERADMIN_COLLECTION, deviceId));
  localStorage.removeItem('bodestock_passkey_id');
  localStorage.removeItem('bodestock_passkey_email');
}

// ============================================================
// USUARIOS NORMALES (clientes y trabajadores)
// La verificación biométrica es local al dispositivo.
// El credentialId se guarda en localStorage por email.
// ============================================================

// Verifica si el usuario tiene huella registrada en ESTE dispositivo
export function hasUserPasskeyRegistered(userEmail) {
  if (!isWebAuthnSupported() || !userEmail) return false;
  return !!localStorage.getItem(getUserPasskeyKey(userEmail));
}

// Verifica si HAY ALGUNA huella registrada en este dispositivo (sin conocer el email)
export function hasAnyUserPasskey() {
  if (!isWebAuthnSupported()) return false;
  // Busca cualquier key con prefijo bodestock_passkey_id_
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('bodestock_passkey_id_')) return true;
  }
  return false;
}

// Obtiene el email del usuario cuya passkey está guardada en este dispositivo
// (si hay varias, retorna la primera — usar getAllStoredPasskeys() en dispositivos compartidos)
export function getStoredPasskeyEmail() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('bodestock_passkey_email_')) {
      return localStorage.getItem(key);
    }
  }
  return null;
}

// Obtiene TODAS las huellas registradas en este dispositivo — [{ email, name }]
// Útil en dispositivos compartidos (ej: tablet de un restaurante con varios garzones)
export function getAllStoredPasskeys() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('bodestock_passkey_email_')) {
      const email = localStorage.getItem(key);
      if (!email) continue;
      const name = localStorage.getItem(getUserPasskeyNameKey(email)) || email;
      results.push({ email, name });
    }
  }
  return results;
}

// Registra huella para un usuario normal (cliente/trabajador)
export async function registerUserPasskey(userEmail, displayName = '') {
  if (!isWebAuthnSupported()) throw new Error('Tu dispositivo no soporta autenticación biométrica.');

  const deviceId = getDeviceId();
  const userId = new TextEncoder().encode(`${deviceId}_${userEmail}`);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyOptions = {
    challenge,
    rp: {
      name: 'Bodestock',
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: userEmail,
      displayName: displayName || userEmail,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Solo huella/Face ID del dispositivo
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  };

  const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
  if (!credential) throw new Error('No se pudo registrar la huella.');

  const credentialId = bufferToBase64url(credential.rawId);

  // Guardar en localStorage por email
  localStorage.setItem(getUserPasskeyKey(userEmail), credentialId);
  localStorage.setItem(getUserPasskeyEmailKey(userEmail), userEmail);
  if (displayName) localStorage.setItem(getUserPasskeyNameKey(userEmail), displayName);

  return credentialId;
}

// Autentica un usuario normal con huella
// Retorna el email si la autenticación fue exitosa
export async function authenticateUserWithPasskey(userEmail) {
  if (!isWebAuthnSupported()) throw new Error('Tu dispositivo no soporta autenticación biométrica.');

  const credentialId = localStorage.getItem(getUserPasskeyKey(userEmail));
  if (!credentialId) throw new Error('No hay huella registrada para este usuario en este dispositivo.');

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertionOptions = {
    challenge,
    allowCredentials: [
      {
        type: 'public-key',
        id: base64urlToBuffer(credentialId),
        transports: ['internal'],
      },
    ],
    userVerification: 'required',
    timeout: 60000,
  };

  let assertion;
  try {
    assertion = await navigator.credentials.get({ publicKey: assertionOptions });
  } catch (err) {
    if (err.name === 'NotAllowedError') throw err;
    if (err.name === 'InvalidStateError' || err.message?.toLowerCase().includes('not allowed')) throw err;
    // Credential not found in this device/domain
    throw new Error('La huella registrada no es válida en este dominio. Por favor vuelve a registrarla.');
  }
  if (!assertion) throw new Error('Autenticación cancelada.');

  return userEmail;
}

// Elimina la huella de un usuario normal en este dispositivo
export function removeUserPasskey(userEmail) {
  localStorage.removeItem(getUserPasskeyKey(userEmail));
  localStorage.removeItem(getUserPasskeyEmailKey(userEmail));
  localStorage.removeItem(getUserPasskeyNameKey(userEmail));
}
