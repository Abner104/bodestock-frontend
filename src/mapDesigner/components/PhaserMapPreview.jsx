// src/mapDesigner/components/PhaserMapPreview.jsx
// Wrapper React <-> Phaser. Phaser maneja su propio game loop y su propio
// <canvas> -- este componente solo le da un <div> contenedor y se encarga
// de crear el juego una vez al montar y destruirlo al desmontar. Nunca
// re-crea el juego por cambios de props menores (eso reiniciaría cámara,
// texturas cacheadas, todo) -- si el mapDoc cambia de verdad (ej. el
// usuario importa otro JSON), el padre debe forzar un remount con `key`,
// no confiar en que este componente reaccione solo.
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import MapScene from '../phaser/MapScene';

export default function PhaserMapPreview({ mapDoc }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: '#0d1420',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
      },
      input: {
        activePointers: 2, // habilita pointer2 para el pellizco de 2 dedos en MapScene
      },
      scene: [MapScene],
    });

    gameRef.current = game;
    game.scene.start('MapScene', { mapDoc });

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
    // mapDoc se pasa solo en el create() inicial a propósito (ver comentario
    // de arriba del componente) -- deps vacío es intencional, no un olvido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
