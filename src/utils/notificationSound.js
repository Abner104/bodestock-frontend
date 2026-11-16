// src/utils/notificationSound.js
// Beep de alerta vía Web Audio API -- no requiere archivo de audio ni
// permisos extra del navegador. Usado por las pantallas que necesitan
// avisar sonoramente de algo nuevo en tiempo real (KitchenDisplay,
// OrdersManagement).
export function playBeep(count = 2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.25);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.25);
    }
  } catch {}
}
