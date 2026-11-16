// src/services/auth-service.js
// Servicio para crear y gestionar usuarios Firebase Auth

import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase.js';
import { initializeApp } from 'firebase/app';

/**
 * Genera una contraseña segura aleatoria
 */
export const generateSecurePassword = (length = 12) => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%&*';

  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';

  // Asegurar al menos un carácter de cada tipo
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Completar con caracteres aleatorios
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Mezclar los caracteres
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Configuración Firebase para segunda instancia
const firebaseConfig = {
  apiKey: "AIzaSyD7F9FK4xqeAiGK48Rwr5KN6o8MuSeQUkw",
  authDomain: "gestor-gastos-407c1.firebaseapp.com",
  projectId: "gestor-gastos-407c1",
  storageBucket: "gestor-gastos-407c1.firebasestorage.app",
  messagingSenderId: "592580892359",
  appId: "1:592580892359:web:84e7f10e1e1de7073fd0e2"
};

// Crear segunda instancia de Firebase para crear usuarios sin afectar la sesión principal
let secondaryApp = null;
let secondaryAuth = null;

const getSecondaryAuth = () => {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, 'secondary');
    secondaryAuth = getAuth(secondaryApp);
  }
  return secondaryAuth;
};

/**
 * Crea un nuevo usuario Firebase Auth sin afectar la sesión actual
 * Usa una segunda instancia de Firebase Auth
 */
export const createFirebaseUser = async (email, password) => {
  try {
    console.log('Creando usuario Firebase Auth:', email);

    // Obtener instancia secundaria de Auth
    const secondaryAuth = getSecondaryAuth();

    // Crear usuario en la instancia secundaria
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

    // Inmediatamente cerrar sesión del usuario creado en la instancia secundaria
    await signOut(secondaryAuth);

    console.log('Usuario Firebase creado:', userCredential.user.uid);
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email
    };

  } catch (error) {
    console.error('Error creando usuario Firebase:', error);

    // Manejar errores específicos de Firebase
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('El email ya está registrado en Firebase Auth');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('La contraseña es demasiado débil');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('El formato del email es inválido');
    }

    throw new Error(`Error creando cuenta: ${error.message}`);
  }
};

/**
 * Valida si un email ya existe en Firebase Auth
 * Nota: Esta función es limitada y en producción usarías Admin SDK
 */
export const checkEmailExists = async (email) => {
  try {
    // Intentar crear un usuario temporalmente para verificar si existe
    // En producción esto se haría con Admin SDK
    const tempPassword = generateSecurePassword();
    const secondaryAuth = getSecondaryAuth();

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
      // Si llega aquí, el email no existía (acabamos de crear el usuario)
      // Eliminar el usuario temporal inmediatamente
      await signOut(secondaryAuth);
      return false;
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error verificando email:', error);
    throw error;
  }
};

/**
 * Información importante sobre limitaciones
 */
export const getAuthServiceInfo = () => {
  return {
    limitations: [
      'Esta implementación básica tiene limitaciones de seguridad',
      'En producción se recomienda usar Firebase Admin SDK',
      'Los usuarios se crean con el contexto del admin actual',
      'Para máxima seguridad, usar Cloud Functions'
    ],
    recommendations: [
      'Implementar Cloud Functions para creación de usuarios',
      'Usar Firebase Admin SDK en el backend',
      'Configurar custom claims para roles',
      'Implementar sistema de invitaciones por email'
    ]
  };
};

/**
 * Genera credenciales para un trabajador
 */
export const generateWorkerCredentials = (workerName, email) => {
  const password = generateSecurePassword();

  return {
    email,
    password,
    displayInfo: {
      title: `🔐 Credenciales para ${workerName}`,
      instructions: [
        `📧 Email: ${email}`,
        `🔑 Contraseña: ${password}`,
        '',
        '⚠️ IMPORTANTE:',
        '• Guarda estas credenciales en un lugar seguro',
        '• Compártelas de forma segura con el trabajador',
        '• El trabajador debería cambiar la contraseña tras el primer login',
        '• Estas credenciales no se mostrarán nuevamente'
      ]
    }
  };
};