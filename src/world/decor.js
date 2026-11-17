import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mats } from './materials.js';
import { createProp, createSearchable, createPickup } from './props.js';
import { Rng } from '../core/utils.js';
import { TILE, WORLD_W, WORLD_H } from './layout.js';

/** Room bounds in metres. */
export function roomBounds(room) {
  return {
    x0: room.x1 * TILE - WORLD_W / 2,
    x1: (room.x2 + 1) * TILE - WORLD_W / 2,
    z0: room.z1 * TILE - WORLD_H / 2,
    z1: (room.z2 + 1) * TILE - WORLD_H / 2,
    get w() { return this.x1 - this.x0; },
    get d() { return this.z1 - this.z0; },
  };
}

const FOOT = {
  bed: [1.06, 2.12], gurney: [0.86, 1.92], wheelchair: [0.66, 0.95], cabinet: [0.95, 0.46],
  locker: [0.9, 0.5], wardrobe: [1.06, 0.6], desk: [1.6, 0.8], counter: [6, 0.72],
  shelf: [1.85, 0.55], crate: [0.62, 0.62], filingCabinet: [0.65, 0.6],
  morgueDrawers: [1.7, 0.95], morgueTable: [0.86, 2.05], operatingTable: [0.95, 2.15],
  labBench: [2.4, 0.75], generator: [1.95, 1.15], boiler: [1.65, 1.65],
  toilet: [1.45, 1.4], sink: [0.6, 0.45], ivStand: [0.3, 0.3], tv: [0.68, 0.6],
  storage: [0.7, 0.55],
};

/** A theme returns furniture placed in room-local metres (0..W, 0..D). */
const THEMES = {
  reception(rng, W, D) {
    const props = [];
    const cx = W / 2;
    props.push({ type: 'counter', x: cx - 1, z: 3.4, ry: 0, params: { len: 6.4 } });
    props.push({ type: 'desk', x: cx + 3.2, z: 2.2, ry: Math.PI, params: { w: 1.5, d: 0.8 } });
    props.push({ type: 'computer', x: cx + 3.2, z: 2.25, y: 0.78, ry: Math.PI });
    props.push({ type: 'officeChair', x: cx + 3.2, z: 3.1, ry: Math.PI + 0.4 });
    props.push({ type: 'waitingChair', x: cx - 4.4, z: 5.2, ry: 0.1 });
    props.push({ type: 'waitingChair', x: cx - 3.6, z: 5.2, ry: -0.05 });
    props.push({ type: 'waitingChair', x: cx - 4.0, z: 6.0, ry: Math.PI + 0.2 });
    props.push({ type: 'bench', x: W - 4.5, z: D - 1.2, ry: Math.PI, params: { len: 2.6 } });
    props.push({ type: 'plant', x: W - 1.1, z: 1.1 });
    props.push({ type: 'plant', x: 1.1, z: 1.0 });
    props.push({ type: 'wheelchair', x: cx - 5.5, z: D - 2.4, ry: 1.1 });
    props.push({ type: 'gurney', x: W - 2.0, z: 7.6, ry: Math.PI / 2 + 0.1 });
    props.push({ type: 'papers', x: cx - 2, z: D - 2.2 });
    props.push({ type: 'papers', x: cx + 4.4, z: D - 3.4 });
    props.push({ type: 'radiator', x: 0.4, z: 8.4, ry: Math.PI / 2 });
    props.push({ type: 'extinguisher', x: W - 0.5, z: 6.2, ry: -Math.PI / 2 });
    props.push({ type: 'sign', x: cx - 1, z: 3.0, y: 2.05, ry: 0, params: { text: 'RECEPTION' } });
    props.push({ type: 'container', kind: 'drawer', x: cx + 4.6, z: 1.2, ry: Math.PI, hide: false });
    props.push({ type: 'container', kind: 'cabinet', x: 1.2, z: D - 1.0, ry: Math.PI });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.2, z: 4.4, ry: -Math.PI / 2 });
    return props;
  },

  waiting(rng, W, D) {
    const props = [];
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 4; i++) {
        props.push({
          type: 'waitingChair',
          x: W / 2 - 2.4 + i * 0.62,
          z: 3.0 + r * 1.0,
          ry: Math.PI + (rng() - 0.5) * 0.3,
        });
      }
    }
    props.push({ type: 'waitingChair', x: W - 2.2, z: 2.4, ry: -0.8 });
    props.push({ type: 'tv', x: W / 2, z: 0.6, y: 1.0, ry: 0 });
    props.push({ type: 'bench', x: 2.4, z: D - 1.1, ry: Math.PI });
    props.push({ type: 'plant', x: 0.9, z: D - 1.1 });
    props.push({ type: 'bin', x: W - 1.0, z: D - 1.0 });
    props.push({ type: 'wheelchair', x: W - 1.4, z: 6.0, ry: -0.5 });
    props.push({ type: 'papers', x: W / 2 + 1.6, z: 6.8 });
    props.push({ type: 'papers', x: W / 2 - 2.2, z: 5.6 });
    props.push({ type: 'radiator', x: 0.4, z: 3.2, ry: Math.PI / 2 });
    props.push({ type: 'container', kind: 'cabinet', x: W - 0.9, z: 4.4, ry: -Math.PI / 2 });
    props.push({ type: 'container', kind: 'drawer', x: 1.2, z: 1.0, ry: 0 });
    return props;
  },

  office(rng, W, D) {
    const props = [];
    props.push({ type: 'desk', x: W / 2 - 0.2, z: 2.4, ry: 0, params: { w: 1.6, d: 0.75 } });
    props.push({ type: 'computer', x: W / 2 - 0.9, z: 2.4, y: 0.78, ry: 0 });
    props.push({ type: 'officeChair', x: W / 2 + 0.2, z: 3.3, ry: Math.PI * 0.15 });
    props.push({ type: 'desk', x: 1.3, z: 6.4, ry: Math.PI / 2, params: { w: 1.4, d: 0.75 } });
    props.push({ type: 'officeChair', x: 2.3, z: 6.4, ry: Math.PI / 2 });
    props.push({ type: 'filingCabinet', x: W - 1.0, z: 1.4, ry: -Math.PI / 2 });
    props.push({ type: 'filingCabinet', x: W - 1.0, z: 2.2, ry: -Math.PI / 2 });
    props.push({ type: 'filingCabinet', x: W - 1.0, z: 3.0, ry: -Math.PI / 2 });
    props.push({ type: 'shelf', x: W / 2, z: D - 0.6, ry: Math.PI, params: { w: 1.8, h: 1.9 } });
    props.push({ type: 'papers', x: W / 2 + 1.4, z: 2.0 });
    props.push({ type: 'papers', x: 2.2, z: 5.2 });
    props.push({ type: 'clock', x: W - 0.05, z: 6.4, y: 2.2, ry: -Math.PI / 2 });
    props.push({ type: 'bin', x: W - 1.2, z: D - 1.2 });
    props.push({ type: 'container', kind: 'drawer', x: W / 2 - 1.3, z: 1.6, ry: 0 });
    props.push({ type: 'container', kind: 'desk', x: 1.3, z: 4.6, ry: Math.PI / 2 });
    props.push({ type: 'container', kind: 'cabinet', x: 1.0, z: D - 1.2, ry: 0 });
    return props;
  },

  cctv(rng, W, D) {
    const props = [];
    props.push({ type: 'counter', x: W / 2, z: 1.2, ry: Math.PI, params: { len: 4.6 } });
    props.push({ type: 'desk', x: W / 2, z: 2.6, ry: 0, params: { w: 2.2, d: 0.8 } });
    props.push({ type: 'officeChair', x: W / 2, z: 3.8, ry: 0 });
    for (let i = 0; i < 4; i++) {
      props.push({ type: 'crt', x: W / 2 - 1.5 + i * 0.52, z: 1.15, y: 1.18, ry: Math.PI });
    }
    props.push({ type: 'crt', x: W / 2 - 1.6, z: 2.5, y: 0.81, ry: 0, params: { size: 0.3 } });
    props.push({ type: 'desk', x: W - 1.6, z: 3.4, ry: -Math.PI / 2, params: { w: 1.5, d: 0.75 } });
    props.push({ type: 'filingCabinet', x: W - 1.0, z: 5.0, ry: -Math.PI / 2 });
    props.push({ type: 'shelf', x: 1.4, z: 2.0, ry: Math.PI / 2, params: { w: 1.6, h: 1.8 } });
    props.push({ type: 'extinguisher', x: 0.45, z: 1.4 });
    props.push({ type: 'papers', x: W / 2 + 2.0, z: 2.0 });
    props.push({ type: 'container', kind: 'drawer', x: W - 2.4, z: 4.2, ry: -Math.PI / 2 });
    props.push({ type: 'container', kind: 'cabinet', x: 1.1, z: D - 1.1, ry: 0 });
    return props;
  },

  pharmacy(rng, W, D) {
    const props = [];
    for (let i = 0; i < 3; i++) props.push({ type: 'shelf', x: 1.2, z: 2.2 + i * 2.0, ry: Math.PI / 2, params: { w: 1.8, h: 2.1 } });
    props.push({ type: 'counter', x: W / 2 + 1.0, z: D - 2.0, ry: Math.PI, params: { len: 4.0 } });
    props.push({ type: 'cabinet', x: W - 1.0, z: 2.0, ry: -Math.PI / 2, params: { glass: true } });
    props.push({ type: 'cabinet', x: W - 1.0, z: 2.9, ry: -Math.PI / 2, params: { glass: true } });
    props.push({ type: 'stool', x: W / 2 + 1.0, z: D - 3.2 });
    props.push({ type: 'papers', x: W - 3.0, z: 1.0 });
    props.push({ type: 'bin', x: 1.0, z: D - 1.0 });
    props.push({ type: 'container', kind: 'drawer', x: W / 2 - 1.4, z: D - 1.6, ry: 0 });
    props.push({ type: 'container', kind: 'cabinet', x: 4.4, z: D - 1.0, ry: 0 });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.2, z: 4.2, ry: -Math.PI / 2 });
    return props;
  },

  storage(rng, W, D) {
    const props = [];
    for (let i = 0; i < 3; i++) props.push({ type: 'shelf', x: 1.1, z: 1.6 + i * 2.3, ry: Math.PI / 2, params: { w: 2.1, h: 2.0 } });
    for (let i = 0; i < 3; i++) props.push({ type: 'shelf', x: W - 1.1, z: 1.8 + i * 2.4, ry: -Math.PI / 2, params: { w: 2.0, h: 2.0 } });
    props.push({ type: 'crate', x: W / 2 - 1.0, z: 1.4 });
    props.push({ type: 'crate', x: W / 2 - 0.2, z: 1.6, y: 0 });
    props.push({ type: 'crate', x: W / 2 - 0.6, z: 2.6 });
    props.push({ type: 'crate', x: W / 2 + 0.9, z: 3.8 });
    props.push({ type: 'gurney', x: W / 2 + 1.2, z: D - 2.4, ry: 0.4 });
    props.push({ type: 'locker', x: W / 2 - 2.2, z: D - 0.7, ry: Math.PI, params: { count: 2 } });
    props.push({ type: 'papers', x: W / 2 + 1.8, z: D - 1.2 });
    props.push({ type: 'container', kind: 'locker', x: W / 2 + 0.9, z: D - 0.6, ry: Math.PI, hide: 'locker' });
    props.push({ type: 'container', kind: 'cabinet', x: W / 2 + 2.6, z: 1.0, ry: 0 });
    props.push({ type: 'container', kind: 'drawer', x: W / 2 - 2.2, z: 4.2, ry: Math.PI / 2 });
    return props;
  },

  emergency(rng, W, D) {
    const props = [];
    for (let i = 0; i < 2; i++) {
      props.push({ type: 'bed', x: 2.2 + i * 3.0, z: 2.4, ry: 0 });
      props.push({ type: 'curtain', x: 2.2 + i * 3.0, z: 1.1, ry: 0, params: { w: 1.6 } });
      props.push({ type: 'ivStand', x: 1.1 + i * 3.0, z: 2.8 });
    }
    props.push({ type: 'gurney', x: W - 2.0, z: 2.0, ry: Math.PI / 2 });
    props.push({ type: 'trayTable', x: W - 2.6, z: 4.2 });
    props.push({ type: 'defibrillator', x: W - 1.4, z: 5.2 });
    props.push({ type: 'oxygen', x: W - 0.8, z: 6.2 });
    props.push({ type: 'sink', x: 1.0, z: D - 1.0, ry: Math.PI });
    props.push({ type: 'bin', x: 2.2, z: D - 1.0 });
    props.push({ type: 'monitor', x: 1.0, z: 1.2, y: 1.4, ry: 0 });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.0, z: 7.4, ry: -Math.PI / 2 });
    props.push({ type: 'container', kind: 'drawer', x: W - 3.6, z: 1.2, ry: 0 });
    props.push({ type: 'container', kind: 'cabinet', x: 5.4, z: D - 1.0, ry: 0 });
    return props;
  },

  restroom(rng, W, D) {
    const props = [];
    props.push({ type: 'toilet', x: 1.6, z: 2.0, ry: 0 });
    props.push({ type: 'toilet', x: 1.6, z: 4.0, ry: 0 });
    props.push({ type: 'toilet', x: 1.6, z: 6.0, ry: 0 });
    props.push({ type: 'sink', x: W - 1.2, z: 1.6, ry: -Math.PI / 2 });
    props.push({ type: 'sink', x: W - 1.2, z: 3.0, ry: -Math.PI / 2 });
    props.push({ type: 'sink', x: W - 1.2, z: 4.4, ry: -Math.PI / 2 });
    props.push({ type: 'bin', x: W - 2.4, z: 6.4 });
    props.push({ type: 'papers', x: W / 2, z: D - 2.0 });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.2, z: 7.6, ry: -Math.PI / 2 });
    return props;
  },

  theatre(rng, W, D) {
    const props = [];
    props.push({ type: 'operatingTable', x: W / 2, z: D / 2, ry: 0 });
    props.push({ type: 'operatingLamp', x: W / 2, z: D / 2, ry: Math.PI });
    props.push({ type: 'trayTable', x: W / 2 - 1.8, z: D / 2 - 1.2 });
    props.push({ type: 'trayTable', x: W / 2 + 1.8, z: D / 2 - 1.2 });
    props.push({ type: 'sink', x: 1.0, z: D - 1.2, ry: Math.PI });
    props.push({ type: 'cabinet', x: W - 1.0, z: 1.8, ry: -Math.PI / 2, params: { glass: true } });
    props.push({ type: 'ivStand', x: W / 2 + 1.3, z: D / 2 + 1.4 });
    props.push({ type: 'oxygen', x: W - 0.9, z: D - 1.4 });
    props.push({ type: 'defibrillator', x: W - 1.3, z: 4.2 });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.1, z: 3.0, ry: -Math.PI / 2 });
    props.push({ type: 'container', kind: 'drawer', x: 1.2, z: 1.6, ry: 0 });
    return props;
  },

  lab(rng, W, D) {
    const props = [];
    props.push({ type: 'labBench', x: W / 2, z: 2.2, ry: 0, params: { len: 3.2 } });
    props.push({ type: 'labBench', x: 1.2, z: D / 2 + 0.6, ry: Math.PI / 2, params: { len: 2.6 } });
    props.push({ type: 'stool', x: W / 2 - 1.0, z: 3.4 });
    props.push({ type: 'stool', x: W / 2 + 1.0, z: 3.4 });
    props.push({ type: 'shelf', x: W - 1.0, z: 2.4, ry: -Math.PI / 2, params: { w: 1.8, h: 2.0 } });
    props.push({ type: 'cabinet', x: W - 1.0, z: 5.4, ry: -Math.PI / 2, params: { glass: true } });
    props.push({ type: 'sink', x: 4.6, z: D - 1.1, ry: Math.PI });
    props.push({ type: 'bin', x: W / 2 + 1.8, z: 1.2 });
    props.push({ type: 'papers', x: W / 2 - 1.4, z: 1.4 });
    props.push({ type: 'container', kind: 'drawer', x: W / 2 + 1.4, z: 2.0, ry: 0 });
    props.push({ type: 'container', kind: 'cabinet', x: 1.2, z: D - 1.0, ry: 0 });
    return props;
  },

  ward(rng, W, D) {
    const props = [];
    props.push({ type: 'bed', x: 1.9, z: 3.0, ry: 0 });
    props.push({ type: 'bed', x: W - 1.9, z: 3.0, ry: 0 });
    props.push({ type: 'curtain', x: 1.9, z: 1.6, ry: 0, params: { w: 1.7 } });
    props.push({ type: 'curtain', x: W - 1.9, z: 1.6, ry: 0, params: { w: 1.7 } });
    props.push({ type: 'ivStand', x: 1.0, z: 4.4 });
    props.push({ type: 'ivStand', x: W - 1.0, z: 4.4 });
    props.push({ type: 'trayTable', x: 1.9, z: 4.4, });
    props.push({ type: 'trayTable', x: W - 1.9, z: 4.4 });
    props.push({ type: 'wardrobe', x: W / 2, z: 0.6, ry: 0 });
    props.push({ type: 'waitingChair', x: W / 2 + 0.9, z: D - 1.0, ry: Math.PI - 0.3 });
    props.push({ type: 'tv', x: W / 2 - 1.2, z: 0.5, y: 1.6, ry: 0 });
    props.push({ type: 'papers', x: W / 2 - 0.6, z: D - 2.0 });
    props.push({ type: 'container', kind: 'wardrobe', x: W / 2, z: 0.62, ry: 0, hide: 'wardrobe' });
    props.push({ type: 'container', kind: 'drawer', x: W / 2 + 2.4, z: D - 0.8, ry: Math.PI });
    return props;
  },

  ward13(rng, W, D) {
    const props = [];
    props.push({ type: 'bed', x: 2.0, z: 2.8, ry: 0.12 });
    props.push({ type: 'bed', x: 2.0, z: 6.4, ry: -0.08 });
    props.push({ type: 'bed', x: W - 2.0, z: 4.6, ry: Math.PI + 0.2 });
    props.push({ type: 'wheelchair', x: W / 2, z: 2.0, ry: 2.4 });
    props.push({ type: 'wheelchair', x: W / 2 - 1.4, z: 7.8, ry: -0.6 });
    props.push({ type: 'gurney', x: W / 2 + 1.6, z: 8.4, ry: 1.4 });
    props.push({ type: 'ivStand', x: W / 2 + 0.8, z: 3.6 });
    props.push({ type: 'desk', x: W - 1.5, z: 8.4, ry: Math.PI, params: { w: 1.4, d: 0.7 } });
    props.push({ type: 'filingCabinet', x: 1.0, z: D - 1.0, ry: Math.PI / 2 });
    props.push({ type: 'papers', x: W / 2, z: 5.6 });
    props.push({ type: 'papers', x: W / 2 - 2.4, z: 8.0 });
    props.push({ type: 'container', kind: 'wardrobe', x: W / 2 - 1.0, z: D - 0.7, ry: Math.PI, hide: 'wardrobe' });
    props.push({ type: 'container', kind: 'drawer', x: W - 1.4, z: 7.0, ry: Math.PI });
    props.push({ type: 'container', kind: 'cabinet', x: 1.0, z: 1.2, ry: Math.PI / 2 });
    return props;
  },

  isolation(rng, W, D) {
    const props = [];
    props.push({ type: 'bed', x: W / 2, z: 3.4, ry: 0 });
    props.push({ type: 'ivStand', x: W / 2 - 1.2, z: 2.4 });
    props.push({ type: 'trayTable', x: W / 2 + 1.2, z: 4.6 });
    props.push({ type: 'monitor', x: W - 1.2, z: 1.6, y: 1.5, ry: -Math.PI / 2 });
    props.push({ type: 'cabinet', x: 1.0, z: D - 1.2, ry: 0 });
    props.push({ type: 'wheelchair', x: W - 1.4, z: D - 1.6, ry: 1.9 });
    props.push({ type: 'papers', x: W / 2 - 1.6, z: 6.4 });
    props.push({ type: 'container', kind: 'cabinet', x: 1.2, z: 1.2, ry: 0 });
    props.push({ type: 'container', kind: 'drawer', x: W - 1.1, z: 4.6, ry: -Math.PI / 2 });
    return props;
  },

  morgue(rng, W, D) {
    const props = [];
    props.push({ type: 'morgueDrawers', x: W / 2, z: 0.7, ry: 0, params: { cols: 4, rows: 3 } });
    props.push({ type: 'morgueTable', x: W / 2 - 1.4, z: 4.0, ry: 0 });
    props.push({ type: 'morgueTable', x: W / 2 + 1.4, z: 4.0, ry: 0 });
    props.push({ type: 'bodyBag', x: W / 2 - 1.4, z: 4.0, y: 0.86, ry: 0.05 });
    props.push({ type: 'trayTable', x: 1.0, z: 6.4 });
    props.push({ type: 'sink', x: W - 1.0, z: D - 1.0, ry: Math.PI });
    props.push({ type: 'stool', x: W / 2, z: 6.6 });
    props.push({ type: 'container', kind: 'morgue', x: W - 3.2, z: 1.0, ry: 0 });
    props.push({ type: 'container', kind: 'drawer', x: 1.2, z: 2.2, ry: 0 });
    props.push({ type: 'container', kind: 'cabinet', x: 1.0, z: D - 1.2, ry: 0 });
    return props;
  },

  generator(rng, W, D) {
    const props = [];
    props.push({ type: 'generator', x: W / 2, z: D / 2, ry: 0 });
    props.push({ type: 'pipes', x: W / 2, z: 1.0, y: 2.4, params: { len: W - 1, count: 3 } });
    props.push({ type: 'crate', x: 1.0, z: 1.2 });
    props.push({ type: 'crate', x: 1.7, z: 1.6 });
    props.push({ type: 'extinguisher', x: W - 0.5, z: 1.2 });
    props.push({ type: 'shelf', x: W - 1.0, z: D - 1.6, ry: -Math.PI / 2, params: { w: 1.6, h: 1.7 } });
    props.push({ type: 'papers', x: W / 2 + 2.0, z: D - 2.0 });
    props.push({ type: 'container', kind: 'drawer', x: 1.2, z: D - 1.2, ry: 0 });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.0, z: 1.4, ry: -Math.PI / 2 });
    return props;
  },

  exit(rng, W, D) {
    const props = [];
    props.push({ type: 'pipes', x: W / 2, z: 0.6, y: 2.3, params: { len: W - 0.5, count: 2 } });
    props.push({ type: 'extinguisher', x: 0.5, z: 3.0 });
    return props;
  },

  tunnel(rng, W, D) {
    const props = [];
    props.push({ type: 'pipes', x: W / 2, z: 0.5, y: 2.2, params: { len: W - 0.4, count: 4 } });
    props.push({ type: 'valve', x: 1.0, z: 1.0 });
    props.push({ type: 'crate', x: W - 1.0, z: D - 1.2 });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.0, z: 3.0, ry: -Math.PI / 2 });
    return props;
  },

  secret(rng, W, D) {
    const props = [];
    props.push({ type: 'operatingTable', x: W / 2 + 0.4, z: D / 2, ry: 0 });
    props.push({ type: 'trayTable', x: W / 2 - 1.2, z: D / 2 - 1.2 });
    props.push({ type: 'ivStand', x: W / 2 + 1.4, z: D / 2 - 1.4 });
    props.push({ type: 'shelf', x: 1.0, z: D / 2, ry: Math.PI / 2, params: { w: 1.6, h: 1.8 } });
    props.push({ type: 'desk', x: W - 1.2, z: 1.8, ry: -Math.PI / 2, params: { w: 1.3, d: 0.7 } });
    props.push({ type: 'papers', x: W / 2, z: D - 1.4 });
    props.push({ type: 'container', kind: 'drawer', x: W - 1.2, z: 2.6, ry: -Math.PI / 2 });
    props.push({ type: 'container', kind: 'cabinet', x: 1.0, z: D - 1.2, ry: 0 });
    return props;
  },

  boiler(rng, W, D) {
    const props = [];
    props.push({ type: 'boiler', x: 1.6, z: 2.0 });
    props.push({ type: 'boiler', x: 1.6, z: 4.6 });
    props.push({ type: 'pipes', x: W / 2, z: 0.5, y: 2.2, params: { len: W - 0.5, count: 4 } });
    props.push({ type: 'valve', x: W - 1.4, z: 1.4 });
    props.push({ type: 'crate', x: W - 1.0, z: D - 1.2 });
    props.push({ type: 'shelf', x: W - 1.0, z: 4.4, ry: -Math.PI / 2, params: { w: 1.5, h: 1.7 } });
    props.push({ type: 'container', kind: 'cabinet', x: W - 1.2, z: 6.4, ry: -Math.PI / 2 });
    return props;
  },

  stairs(rng, W, D) {
    const props = [];
    props.push({ type: 'pipes', x: W / 2, z: 0.5, y: 2.5, params: { len: W - 0.5, count: 2 } });
    props.push({ type: 'sign', x: W / 2, z: 0.6, y: 2.2, ry: 0, params: { text: 'STAIRWELL' } });
    props.push({ type: 'bin', x: W - 0.6, z: D - 0.8 });
    return props;
  },

  elevator(rng, W, D) {
    const props = [];
    props.push({ type: 'bench', x: W - 1.0, z: D / 2, ry: -Math.PI / 2, params: { len: 2.2 } });
    props.push({ type: 'plant', x: 1.0, z: D - 1.0 });
    props.push({ type: 'wheelchair', x: W - 1.4, z: 1.4, ry: 2.0 });
    props.push({ type: 'sign', x: W / 2, z: D - 0.45, y: 2.3, ry: Math.PI, params: { text: 'ELEVATOR  /  WARD THIRTEEN' } });
    return props;
  },

  generic(rng, W, D) {
    return [
      { type: 'bench', x: W / 2, z: D - 1.0, ry: Math.PI, params: { len: 2.2 } },
      { type: 'bin', x: 1.0, z: 1.0 },
    ];
  },
};

// ------------------------------------------------------------------- batching

export class StaticBatcher {
  constructor() {
    this.map = new Map();
  }
  add(group, matrix) {
    group.updateMatrixWorld(true);
    const m = matrix || group.matrixWorld;
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material.transparent) return;
      if (o.material.isMeshBasicMaterial) return;
      const g = o.geometry.clone();
      const world = new THREE.Matrix4().multiplyMatrices(m, o.matrixWorld);
      g.applyMatrix4(world);
      if (!this.map.has(o.material)) this.map.set(o.material, []);
      this.map.get(o.material).push(g);
    });
  }
  finalize(parent, { castShadow = true } = {}) {
    for (const [mat, list] of this.map) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.map.clear();
  }
}

export function createSignPlate(text, w = 0.9, h = 0.22) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a201c';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = 'rgba(170,168,145,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = '#b9b59f';
  ctx.font = '600 44px "Special Elite", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0.2 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/** Instantiate a themed room. Returns runtime data used by the game. */
export function decorateRoom(room, opts) {
  const { floorY, loot = [], pickups = [], seed = 1, onContainer, onPickup } = opts;
  const b = roomBounds(room);
  const W = b.w, D = b.d;
  const y = floorY;
  const rng = new Rng(seed + room.id.length * 31 + room.x1 * 7 + room.z1 * 13);
  const theme = THEMES[room.theme] || THEMES.generic;
  const specs = theme(() => rng.next(), W, D);

  const out = {
    staticGroup: new THREE.Group(),
    colliders: [],
    containers: [],
    hides: [],
    lights: [],
    interactives: [],
    props: [],
  };

  const batch = new StaticBatcher();
  const obstacles = [];

  for (const spec of specs) {
    const worldPos = new THREE.Vector3(b.x0 + spec.x, y + (spec.y || 0), b.z0 + spec.z);
    if (spec.type === 'container') {
      const g = createSearchable(spec.kind === 'locker' ? 'locker' : spec.kind);
      g.position.copy(worldPos);
      g.rotation.y = spec.ry || 0;
      g.userData.baseRotY = spec.ry || 0;
      const foot = spec.kind === 'wardrobe' ? FOOT.wardrobe : spec.kind === 'cabinet' ? FOOT.cabinet
        : spec.kind === 'locker' ? FOOT.locker : spec.kind === 'morgue' ? FOOT.morgueDrawers : FOOT.cabinet;
      out.colliders.push({
        minX: worldPos.x - foot[0] / 2, maxX: worldPos.x + foot[0] / 2,
        minZ: worldPos.z - foot[1] / 2, maxZ: worldPos.z + foot[1] / 2,
      });
      out.containers.push(g);
      if (spec.hide) {
        out.hides.push({ type: spec.hide, x: worldPos.x, z: worldPos.z, ry: spec.ry || 0, object: g });
      }
      onContainer?.(g, room);
      continue;
    }
    if (spec.type === 'sign') {
      const plate = createSignPlate(spec.params?.text || room.name);
      plate.position.copy(worldPos);
      plate.rotation.y = spec.ry ?? 0;
      out.staticGroup.add(plate);
      continue;
    }
    if (spec.type === 'valve' || spec.type === 'stool' || spec.type === 'monitor') {
      // fallbacks for props with no builder
      spec.type = spec.type === 'valve' ? 'radiator' : spec.type === 'stool' ? 'officeChair' : 'crt';
      spec.params = spec.type === 'officeChair' ? {} : spec.params;
    }
    const group = createProp(spec.type, spec.params);
    group.position.copy(worldPos);
    group.rotation.y = spec.ry || 0;
    group.updateMatrixWorld(true);
    batch.add(group);

    const foot = FOOT[spec.type];
    if (foot && !spec.y) {
      const rot = Math.abs(Math.sin(spec.ry || 0)) > 0.7;
      const fw = rot ? foot[1] : foot[0];
      const fd = rot ? foot[0] : foot[1];
      obstacles.push({
        minX: worldPos.x - fw / 2, maxX: worldPos.x + fw / 2,
        minZ: worldPos.z - fd / 2, maxZ: worldPos.z + fd / 2,
      });
    }
    if (spec.type === 'bed' && spec.hide !== false) {
      out.hides.push({ type: 'underbed', x: worldPos.x, z: worldPos.z, ry: spec.ry || 0, y: y + 0.2 });
    }
    if (spec.type === 'wardrobe') {
      out.hides.push({ type: 'wardrobe', x: worldPos.x, z: worldPos.z, ry: spec.ry || 0 });
    }
    out.props.push({ type: spec.type, x: worldPos.x, z: worldPos.z, ry: spec.ry || 0 });
  }

  batch.finalize(out.staticGroup);
  out.colliders.push(...obstacles);

  // free-floating pickups
  for (const p of pickups) {
    const g = createPickup(p.kind);
    g.position.set(b.x0 + p.x, y + (p.y || 0.02), b.z0 + p.z);
    g.rotation.y = rng.range(0, Math.PI * 2);
    out.interactives.push({ object: g, pickup: p });
    onPickup?.(g, p, room);
  }

  return out;
}
