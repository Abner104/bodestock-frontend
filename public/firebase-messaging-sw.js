// public/firebase-messaging-sw.js
// Service Worker para recibir push notifications de FCM en background

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD7F9FK4xqeAiGK48Rwr5KN6o8MuSeQUkw",
  authDomain: "gestor-gastos-407c1.firebaseapp.com",
  projectId: "gestor-gastos-407c1",
  storageBucket: "gestor-gastos-407c1.firebasestorage.app",
  messagingSenderId: "592580892359",
  appId: "1:592580892359:web:84e7f10e1e1de7073fd0e2",
});

const messaging = firebase.messaging();

// Notificación en background (cuando el tab está cerrado o en segundo plano)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || '¡Nuevo pedido!', {
    body: body || 'Hay un pedido esperando',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'nuevo-pedido',          // reemplaza la anterior (no se acumulan)
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'open', title: 'Ver pedido' },
    ],
    data: payload.data || {},
  });
});

// Click en la notificación → abrir /cocina
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/pedidos-caja';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/cocina'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
