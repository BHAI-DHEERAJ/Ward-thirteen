import * as THREE from 'three';
import { textures, signTexture, staticNoise } from './textures.js';

/** Shared PBR materials. Created once and reused across every floor. */
function standard(name, opts = {}) {
  const t = textures.get(name);
  const m = new THREE.MeshStandardMaterial({
    map: t.map,
    normalMap: t.normal || null,
    normalScale: new THREE.Vector2(opts.normalScale ?? 0.55, opts.normalScale ?? 0.55),
    roughness: opts.roughness ?? 0.86,
    metalness: opts.metalness ?? 0.02,
    color: opts.color ?? 0xffffff,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    envMapIntensity: opts.envMapIntensity ?? 0.25,
    depthWrite: opts.depthWrite ?? true,
  });
  return m;
}

export const mats = {
  plaster: standard('plaster', { roughness: 0.92 }),
  concreteWall: standard('concreteWall', { roughness: 0.94, color: 0x9a9c96 }),
  tileWall: standard('tileWall', { roughness: 0.55 }),
  tileWallGreen: standard('tileWallGreen', { roughness: 0.58 }),
  wallDark: standard('concreteWall', { roughness: 0.95, color: 0x5d615c }),
  floorTile: standard('tileFloor', { roughness: 0.42, metalness: 0.03 }),
  linoleum: standard('linoleum', { roughness: 0.5, metalness: 0.02 }),
  linoleumGreen: standard('linoleumGreen', { roughness: 0.55 }),
  concreteFloor: standard('concreteFloor', { roughness: 0.7, metalness: 0.02 }),
  ceiling: standard('ceiling', { roughness: 0.95, color: 0xbdbdb4 }),
  ceilingDark: standard('ceiling', { roughness: 0.96, color: 0x6a6d66 }),
  wood: standard('wood', { roughness: 0.75 }),
  woodDark: standard('wood', { roughness: 0.8, color: 0x8a7a63 }),
  metal: standard('metal', { roughness: 0.52, metalness: 0.55 }),
  metalDark: standard('metalDark', { roughness: 0.48, metalness: 0.62 }),
  steel: standard('metal', { roughness: 0.34, metalness: 0.78, color: 0xb9bdb6 }),
  rust: standard('rust', { roughness: 0.88, metalness: 0.25 }),
  rustDark: standard('rust', { roughness: 0.92, metalness: 0.2, color: 0x8a7c6b }),
  fabric: standard('fabric', { roughness: 0.95, color: 0xbfc4b2 }),
  fabricBlue: standard('fabric', { roughness: 0.95, color: 0x6c7c80 }),
  fabricWhite: standard('fabricWhite', { roughness: 0.94, color: 0xd8d6c6 }),
  mattress: standard('mattress', { roughness: 0.95 }),
  grass: standard('grass', { roughness: 1 }),
  asphalt: standard('asphalt', { roughness: 0.72, metalness: 0.05 }),
  paper: standard('paper', { roughness: 0.9, side: THREE.DoubleSide }),
  cardboard: standard('wood', { roughness: 0.95, color: 0xa08d6c }),
  plasticWhite: new THREE.MeshStandardMaterial({ color: 0xc9c7bb, roughness: 0.42, metalness: 0.02 }),
  plasticDark: new THREE.MeshStandardMaterial({ color: 0x242724, roughness: 0.6, metalness: 0.05 }),
  plasticRed: new THREE.MeshStandardMaterial({ color: 0x6c2b22, roughness: 0.5 }),
  bone: new THREE.MeshStandardMaterial({ color: 0xb9b4a2, roughness: 0.7 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x9fb0ad, roughness: 0.14, metalness: 0.0, transmission: 0.0,
    transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  }),
  glassDirty: new THREE.MeshPhysicalMaterial({
    color: 0x8b958e, roughness: 0.4, transparent: true, opacity: 0.3,
    depthWrite: false, side: THREE.DoubleSide,
  }),
  screenOff: new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.22, metalness: 0.1 }),
  emissiveTube: new THREE.MeshStandardMaterial({
    color: 0xcfd8cc, emissive: 0xc8d6c4, emissiveIntensity: 1.4, roughness: 0.6,
  }),
  emissiveExit: new THREE.MeshStandardMaterial({
    color: 0x1b241d, emissive: 0x6f8a5f, emissiveIntensity: 1.2, roughness: 0.7,
  }),
  emissiveWarm: new THREE.MeshStandardMaterial({
    color: 0xa8916a, emissive: 0xc79a52, emissiveIntensity: 0.9, roughness: 0.7,
  }),
  blood: new THREE.MeshStandardMaterial({ color: 0x2c0806, roughness: 0.55 }),
  water: new THREE.MeshStandardMaterial({ color: 0x101617, roughness: 0.06, metalness: 0.9 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x1c1e1c, roughness: 0.8 }),
  screenStatic: new THREE.MeshBasicMaterial({ map: textures.dynamic('static', staticNoise(251)), toneMapped: false }),
};

export function makeSign(lines, opts) {
  const tex = new THREE.CanvasTexture(signTexture(lines, opts));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.6, metalness: 0.25,
    emissive: opts?.emissive ? new THREE.Color(0x3a3a2c) : 0x000000,
    emissiveIntensity: 0.6,
  });
}

export function makeFloorMaterial(room) {
  if (room.floor === 'tileFloor') return mats.floorTile;
  if (room.floor === 'linoleum') return mats.linoleum;
  if (room.floor === 'linoleumGreen') return mats.linoleumGreen;
  if (room.floor === 'concreteFloor') return mats.concreteFloor;
  return mats.linoleum;
}

export function makeWallMaterial(room) {
  if (room.wall === 'concreteWall') return mats.concreteWall;
  if (room.wall === 'tileWall') return mats.tileWall;
  if (room.wall === 'tileWallGreen') return mats.tileWallGreen;
  return mats.plaster;
}

export function applyQuality(quality) {
  const table = {
    low: { aniso: 1, normal: false },
    medium: { aniso: 4, normal: true },
    high: { aniso: 8, normal: true },
  };
  const q = table[quality] || table.medium;
  textures.setAnisotropy(q.aniso);
  for (const m of Object.values(mats)) {
    if (m && m.isMeshStandardMaterial && m.normalMap) m.normalScale.setScalar(q.normal ? 0.55 : 0.01);
  }
}
