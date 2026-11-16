// src/components/agents3d/mapDesignerBridge.js
// Puente entre el Map Designer (editor 2D, src/mapDesigner/) y el mundo 3D
// (Bodestock HQ, este directorio).
//
// Alcance (decidido con el usuario, dos rondas): el Map Designer NO agrega
// agentes nuevos al mundo 3D -- los 6 agentes de su catálogo (CEO,
// Contabilidad, Ventas, RRHH, Finanzas, Inventario) no son todos productos
// reales todavía (solo pricing/finance/inventory/marketing tienen página y
// datos de Firestore detrás). Conectar cualquier asset del catálogo como
// isla clickeable dejaría el panel mostrando "Analizando..." para siempre
// o un link roto para los que no existen como producto.
//
// Lo que SÍ hace: si el Map Designer tiene guardados los 4 agentes reales
// (uno de cada asset en ASSET_ID_BY_AGENT_ID), usa esas 4 posiciones para
// las 4 islas -- TODO o NADA, nunca una mezcla de "2 agentes movidos en el
// editor + 2 en su posición vieja de agentsData.js". Esa mezcla fue
// justamente el bug reportado ("cambió la posición pero mira las
// posiciones reales... estoy confundido") -- con un agente movido y 3
// quietos, el layout se veía roto porque en realidad eran dos fuentes de
// verdad compitiendo sin que el usuario pudiera saber cuál mandaba. Ahora
// hay una sola: si el mapa tiene los 4, el mapa manda; si falta alguno, se
// ignora el mapa entero y manda agentsData.js hasta que estén los 4.
// Todo lo demás del agente (route, department, status derivado de datos
// reales, etc.) sigue viniendo de agentsData.js sin tocar -- este puente
// solo pisa position/islandRotationY, y solo cuando puede pisarlas todas.
import { getAsset } from '../../mapDesigner/assetCatalog';
import { deserializeMap } from '../../mapDesigner/mapModel';
import { AGENTS_3D } from './agentsData';

const MAP_STORAGE_KEY = 'bodestockMapDesigner:lastMap';

// Qué asset del catálogo del Map Designer representa a cada agente real --
// los 4 tienen su propio asset dedicado (pricing-agent, finance-agent,
// inventory-agent, marketing-agent), separados de otros agentes del
// catálogo que hoy son solo decorativos/futuros (ceo-agent,
// accounting-agent, sales-agent, hr-agent no tienen producto real detrás
// todavía).
const ASSET_ID_BY_AGENT_ID = {
  pricing: 'pricing-agent',
  finance: 'finance-agent',
  inventory: 'inventory-agent',
  marketing: 'marketing-agent',
};

// La escala tiene que ser fiel a lo que el usuario ve en el Map Designer:
// si en el editor separa dos agentes el doble de lejos, en el mundo 3D
// tienen que quedar el doble de lejos EN PROPORCIÓN AL TAMAÑO DE LA ISLA,
// no comprimido a una fracción arbitraria. El ícono de un agente en el
// catálogo del Map Designer mide 64px (ver assetCatalog.js, width/height
// de *-agent) -- esa es la unidad de referencia real del editor, así que
// la escala se deriva de "cuántas unidades-3D ocupa la isla" dividido
// "cuántos px ocupa el ícono", en vez de una constante inventada en
// función del tamaño total del mundo 2D (3000px). El intento anterior
// (12/1500) comprimía tanto las distancias que las 4 islas quedaban casi
// superpuestas en 3D aunque estuvieran bien separadas en el editor -- ese
// era el bug real detrás de "no están ubicados como en el Map Design".
const AGENT_ICON_PX = 64; // width/height de *-agent en assetCatalog.js
const ISLAND_RADIUS_3D = 1.7; // debe coincidir con ISLAND_RADIUS de CityLayout.jsx
const WORLD_TO_3D_SCALE = ISLAND_RADIUS_3D / (AGENT_ICON_PX / 2);

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function loadMapDoc() {
  let saved;
  try {
    saved = localStorage.getItem(MAP_STORAGE_KEY);
  } catch {
    return null; // localStorage no disponible (ej. modo privado)
  }
  if (!saved) return null;
  try {
    return deserializeMap(saved);
  } catch (e) {
    console.error('El mapa guardado del Map Designer no se pudo leer, se ignora:', e.message);
    return null;
  }
}

// Para un assetId dado, encuentra el primer objeto del mapa 2D que lo usa
// (si el usuario puso varios del mismo tipo, se toma el primero -- no hay
// forma de saber cuál "es" el agente real sin más contexto).
function findObjectByAsset(objects, assetId) {
  return objects.find((o) => o.asset === assetId && o.visible !== false) || null;
}

function objectToPosition(obj, world) {
  const centeredX = obj.x - world.width / 2;
  const centeredZ = obj.y - world.height / 2;
  return {
    position: {
      x: centeredX * WORLD_TO_3D_SCALE,
      z: centeredZ * WORLD_TO_3D_SCALE,
    },
    islandRotationY: degToRad(obj.rotation || 0),
    // Tamaño relativo de la isla en el mundo 3D -- fiel al "scale" que el
    // usuario le dio al ícono en el editor (Transformer, panel de
    // propiedades). Antes ISLAND_RADIUS era fijo e igual para las 4 islas
    // sin importar qué tan grande se veía cada una en el Map Designer.
    islandScale: obj.scale || 1,
  };
}

/**
 * Devuelve AGENTS_3D con position/islandRotationY reemplazadas por lo que
 * haya en el Map Designer -- SOLO si los 4 agentes reales están presentes
 * en el mapa guardado (ver comentario de arriba: nunca una mezcla parcial).
 * Si no hay mapa guardado, o falta cualquiera de los 4, devuelve
 * AGENTS_3D tal cual, sin tocar nada.
 */
export function getAgents3D() {
  const mapDoc = loadMapDoc();
  if (!mapDoc) return AGENTS_3D;

  const positionByAgentId = {};
  for (const [agentId, assetId] of Object.entries(ASSET_ID_BY_AGENT_ID)) {
    if (!getAsset(assetId)) return AGENTS_3D; // catálogo cambió, ya no existe ese asset -- fallback completo
    const obj = findObjectByAsset(mapDoc.objects, assetId);
    if (!obj) return AGENTS_3D; // falta este agente en el mapa -- no aplicar una mezcla parcial
    positionByAgentId[agentId] = objectToPosition(obj, mapDoc.world);
  }

  return AGENTS_3D.map((agent) => {
    const fromMap = positionByAgentId[agent.id];
    return fromMap ? { ...agent, ...fromMap } : agent;
  });
}

/**
 * True si el Map Designer ya tiene los 4 agentes reales colocados (o sea,
 * si getAgents3D() está leyendo del mapa en vez del fallback). Lo usa el
 * propio Map Designer para saber si debe ofrecer "traer las posiciones
 * actuales" como punto de partida o ya está todo servido.
 */
export function mapHasAllRealAgents() {
  const mapDoc = loadMapDoc();
  if (!mapDoc) return false;
  return Object.values(ASSET_ID_BY_AGENT_ID).every(
    (assetId) => getAsset(assetId) && findObjectByAsset(mapDoc.objects, assetId)
  );
}

/**
 * Conversión inversa: da las 4 posiciones ACTUALES de agentsData.js (el
 * layout original en cruz) ya traducidas a coordenadas 2D del Map
 * Designer, junto con el assetId que le corresponde a cada una. La usa el
 * botón "Traer posiciones actuales" del Map Designer para sembrar los 4
 * agentes reales en el editor la primera vez, en vez de que el usuario
 * tenga que adivinar dónde ponerlos a mano sin ninguna referencia.
 */
export function getRealAgentSeedPositions(world) {
  return AGENTS_3D
    .filter((agent) => ASSET_ID_BY_AGENT_ID[agent.id])
    .map((agent) => ({
      assetId: ASSET_ID_BY_AGENT_ID[agent.id],
      name: agent.name,
      x: agent.position.x / WORLD_TO_3D_SCALE + world.width / 2,
      y: agent.position.z / WORLD_TO_3D_SCALE + world.height / 2,
      rotation: ((agent.islandRotationY || 0) * 180) / Math.PI,
    }));
}

/**
 * Devuelve todos los edificios (categoría "buildings" del Map Designer)
 * que tengan un sprite real (asset.src) -- los edificios placeholder sin
 * imagen (Casa Matriz, Finanzas, etc., dibujados como emoji/forma en el
 * editor 2D) no tienen forma de mostrarse en el mundo 3D todavía, así que
 * se ignoran acá en vez de intentar dibujar algo genérico sin que el
 * usuario lo haya pedido.
 *
 * A diferencia de getAgents3D() (todo-o-nada, exactamente 4 agentes
 * reales con identidad fija), acá se listan TODOS los edificios que haya
 * en el mapa, tantos como el usuario haya puesto -- un edificio no tiene
 * "identidad" única como un agente, son decoración repetible.
 */
export function getBuildings3D() {
  const mapDoc = loadMapDoc();
  if (!mapDoc) return [];

  return mapDoc.objects
    .filter((o) => o.visible !== false)
    .map((o) => {
      const asset = getAsset(o.asset);
      if (!asset || asset.category !== 'buildings' || !asset.src) return null;
      const { position, islandRotationY, islandScale } = objectToPosition(o, mapDoc.world);
      return {
        id: o.id,
        name: o.name || asset.name,
        src: asset.src,
        color: asset.color,
        position,
        rotationY: islandRotationY,
        scale: islandScale,
      };
    })
    .filter(Boolean);
}

export { ASSET_ID_BY_AGENT_ID, WORLD_TO_3D_SCALE };
