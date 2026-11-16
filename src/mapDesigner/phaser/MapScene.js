// src/mapDesigner/phaser/MapScene.js
// Fase 2 del pedido original: "Map Designer -> JSON -> Phaser Renderer".
// Esta Scene lee EXACTAMENTE el mismo modelo de datos que exporta el
// editor (mapModel.js / mapDesigner/assetCatalog.js) -- mismas unidades de
// mundo (x, y en px, scale, rotation en grados), mismo orden de capas
// (LAYERS). No reinterpreta nada: si algo se ve distinto acá que en el
// editor, es un bug de esta Scene, no una libertad de diseño.
//
// Alcance de esta primera pasada (confirmado con el usuario): solo cámara
// (pan/zoom) + el mundo dibujado en sus posiciones reales. Nada se mueve
// solo todavía, no hay input en los objetos -- eso es semilla para la Fase
// 3 (agentes) y una iteración futura de interacción, no de esta.
import Phaser from 'phaser';
import { getAsset } from '../assetCatalog';
import { LAYERS } from '../assetCatalog';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

// Mismo set de colores/formas que EditorCanvas.jsx (AssetShape) para los
// assets del catálogo base que todavía no tienen sprite real -- el
// preview de Phaser debe verse consistente con lo que el usuario armó en
// el editor, no una interpretación distinta.
function drawPlaceholder(scene, asset, width, height) {
  const g = scene.add.graphics();
  const color = Phaser.Display.Color.HexStringToColor(asset.color || '#9aa5b8').color;

  switch (asset.shape) {
    case 'building': {
      g.fillStyle(color, 1);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(-width / 2, -height / 2, width, 14, { tl: 10, tr: 10, bl: 0, br: 0 });
      break;
    }
    case 'agent':
    case 'circle':
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, width / 2);
      break;
    case 'diamond': {
      g.fillStyle(color, 1);
      const r = width / 2;
      g.fillPoints([
        { x: 0, y: -r }, { x: r, y: 0 }, { x: 0, y: r }, { x: -r, y: 0 },
      ], true);
      break;
    }
    case 'zone':
      g.lineStyle(2, 0xffffff, 0.4);
      g.strokeRect(-width / 2, -height / 2, width, height);
      g.fillStyle(0xffffff, 0.04);
      g.fillRect(-width / 2, -height / 2, width, height);
      break;
    case 'road-h':
    case 'road-v':
    case 'road-x':
    case 'road-corner':
    case 'rect':
    default:
      g.fillStyle(color, 1);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, asset.shape === 'rect' ? 4 : 0);
      break;
  }
  return g;
}

export default class MapScene extends Phaser.Scene {
  constructor() {
    super('MapScene');
    this.mapDoc = null;
    this.worldContainer = null;
  }

  init(data) {
    this.mapDoc = data.mapDoc;
  }

  create() {
    const { world, objects } = this.mapDoc;

    this.cameras.main.setBackgroundColor('#141b2b');
    this.cameras.main.setBounds(
      -world.width * 0.5, -world.height * 0.5,
      world.width * 2, world.height * 2
    );

    this.worldContainer = this.add.container(0, 0);

    // Fondo del mundo -- mismo rectángulo con borde que EditorCanvas
    // dibuja para el área "oficial" del mapa (0,0)-(width,height).
    const bg = this.add.graphics();
    bg.fillStyle(0x141b2b, 1);
    bg.fillRect(0, 0, world.width, world.height);
    bg.lineStyle(2, 0xffffff, 0.15);
    bg.strokeRect(0, 0, world.width, world.height);
    this.worldContainer.add(bg);

    // Agrupa objetos por capa y respeta el orden de LAYERS (de atrás hacia
    // adelante) -- mismo criterio que EditorCanvas.jsx, así el orden de
    // profundidad visual es idéntico entre editor y preview.
    const byLayer = {};
    objects.forEach((o) => {
      if (!byLayer[o.layer]) byLayer[o.layer] = [];
      byLayer[o.layer].push(o);
    });

    LAYERS.forEach((layerId) => {
      (byLayer[layerId] || []).forEach((obj) => this.renderObject(obj));
    });

    this.setupCameraControls();
    this.centerOnWorld();
  }

  renderObject(obj) {
    if (obj.visible === false) return;
    const asset = getAsset(obj.asset);
    if (!asset) return;

    const container = this.add.container(obj.x, obj.y);
    container.setRotation(Phaser.Math.DegToRad(obj.rotation || 0));
    container.setScale(obj.scale || 1);

    if (asset.src) {
      const textureKey = `asset-${asset.id}`;
      if (!this.textures.exists(textureKey)) {
        // Los sprites de usuario ya están decodificados en memoria como
        // dataURL (ver userAssetStore.js) -- Phaser puede registrar una
        // textura desde una imagen ya cargada sin pasar por su loader de
        // preload, así no hace falta declarar cada asset de antemano.
        const img = new window.Image();
        img.onload = () => {
          if (!this.textures.exists(textureKey)) this.textures.addImage(textureKey, img);
          if (container.active) this.addSpriteToContainer(container, textureKey, obj);
        };
        img.src = asset.src;
      } else {
        this.addSpriteToContainer(container, textureKey, obj);
      }
    } else {
      const shape = drawPlaceholder(this, asset, obj.width, obj.height);
      container.add(shape);
      if (asset.emoji) {
        const label = this.add.text(0, 0, asset.emoji, { fontSize: `${Math.min(obj.width, obj.height) * 0.5}px` });
        label.setOrigin(0.5);
        container.add(label);
      }
    }

    if (asset.category !== 'roads') {
      const nameText = this.add.text(0, obj.height / 2 + 4, obj.name, {
        fontSize: '11px',
        fontStyle: '600',
        color: '#e8ecf6',
        align: 'center',
      });
      nameText.setOrigin(0.5, 0);
      container.add(nameText);
    }

    this.worldContainer.add(container);
  }

  addSpriteToContainer(container, textureKey, obj) {
    const img = this.add.image(0, 0, textureKey);
    img.setDisplaySize(obj.width, obj.height);
    container.addAt(img, 0);
  }

  centerOnWorld() {
    const { width, height } = this.mapDoc.world;
    this.cameras.main.centerOn(width / 2, height / 2);
    const fitZoom = Math.min(this.scale.width / width, this.scale.height / height) * 0.85;
    this.cameras.main.setZoom(Phaser.Math.Clamp(fitZoom, MIN_ZOOM, MAX_ZOOM));
  }

  setupCameraControls() {
    const cam = this.cameras.main;
    let isDragging = false;
    let dragStart = null;
    let camStart = null;

    this.input.on('pointerdown', (pointer) => {
      isDragging = true;
      dragStart = { x: pointer.x, y: pointer.y };
      camStart = { x: cam.scrollX, y: cam.scrollY };
    });

    this.input.on('pointermove', (pointer) => {
      if (!isDragging) return;
      const dx = (pointer.x - dragStart.x) / cam.zoom;
      const dy = (pointer.y - dragStart.y) / cam.zoom;
      cam.setScroll(camStart.x - dx, camStart.y - dy);
    });

    this.input.on('pointerup', () => { isDragging = false; });
    this.input.on('pointerupoutside', () => { isDragging = false; });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const factor = deltaY > 0 ? 0.9 : 1.1;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM));
    });

    // Pellizco de 2 dedos -- Phaser expone hasta 2 punteros activos si
    // input.addPointer(1) se llamó al crear el juego (ver
    // PhaserMapPreview.jsx). Sin eso, pointer2 nunca se activa y esto no
    // hace nada, no rompe.
    let pinchDist = null;
    this.input.on('pointermove', () => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (!p1?.isDown || !p2?.isDown) { pinchDist = null; return; }
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (pinchDist != null) {
        const factor = dist / pinchDist;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM));
      }
      pinchDist = dist;
    });
  }
}
