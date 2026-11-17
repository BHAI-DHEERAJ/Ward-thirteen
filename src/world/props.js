import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mats, makeSign } from './materials.js';
import { Rng } from '../core/utils.js';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Accumulates geometry into per-material buckets and merges them into a group. */
export class PropBuilder {
  constructor() { this.buckets = new Map(); }

  add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = geo.clone();
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(1, 1, 1));
    g.applyMatrix4(_m);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
    return this;
  }

  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = UNIT_BOX.clone();
    g.scale(w, h, d);
    return this.add(mat, g, x, y, z, rx, ry, rz);
  }

  cyl(mat, rTop, rBottom, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1);
    return this.add(mat, g, x, y, z, rx, ry, rz);
  }

  sphere(mat, r, seg, x, y, z) {
    return this.add(mat, new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2)), x, y, z);
  }

  torus(mat, r, tube, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
    return this.add(mat, new THREE.TorusGeometry(r, tube, 6, seg), x, y, z, rx, ry, rz);
  }

  build() {
    const group = new THREE.Group();
    for (const [mat, list] of this.buckets) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

const B = () => new PropBuilder();

// ------------------------------------------------------------------ furniture

function bed({ rail = true, wheels = true, makeBed = true } = {}) {
  const b = B();
  // frame
  b.box(mats.metalDark, 0.95, 0.06, 2.0, 0, 0.62, 0);
  b.box(mats.metalDark, 0.06, 0.62, 0.06, -0.44, 0.31, -0.94);
  b.box(mats.metalDark, 0.06, 0.62, 0.06, 0.44, 0.31, -0.94);
  b.box(mats.metalDark, 0.06, 0.62, 0.06, -0.44, 0.31, 0.94);
  b.box(mats.metalDark, 0.06, 0.62, 0.06, 0.44, 0.31, 0.94);
  // head / foot boards
  b.box(mats.metalDark, 0.97, 0.5, 0.05, 0, 0.92, -1.0);
  b.box(mats.metalDark, 0.97, 0.36, 0.05, 0, 0.86, 1.0);
  b.box(mats.metalDark, 0.06, 0.16, 0.62, -0.5, 0.78, -0.72);
  b.box(mats.metalDark, 0.06, 0.16, 0.62, 0.5, 0.78, -0.72);
  if (rail) {
    b.cyl(mats.steel, 0.018, 0.018, 1.1, 6, -0.53, 1.02, 0.1, Math.PI / 2);
    b.cyl(mats.steel, 0.018, 0.018, 1.1, 6, 0.53, 1.02, 0.1, Math.PI / 2);
    b.box(mats.steel, 0.02, 0.3, 0.02, -0.53, 0.9, -0.45);
    b.box(mats.steel, 0.02, 0.3, 0.02, 0.53, 0.9, -0.45);
  }
  // mattress
  b.box(mats.mattress, 0.88, 0.16, 1.9, 0, 0.72, 0);
  if (makeBed) {
    b.box(mats.fabricWhite, 0.9, 0.04, 1.1, 0, 0.81, 0.32);
    b.box(mats.fabricWhite, 0.6, 0.1, 0.34, 0, 0.86, -0.72);
  }
  if (wheels) {
    for (const [x, z] of [[-0.4, -0.9], [0.4, -0.9], [-0.4, 0.9], [0.4, 0.9]]) {
      b.cyl(mats.plasticDark, 0.05, 0.05, 0.04, 8, x, 0.05, z, 0, 0, Math.PI / 2);
      b.box(mats.metalDark, 0.04, 0.22, 0.04, x, 0.16, z);
    }
  }
  return b.build();
}

function gurney() {
  const b = B();
  b.box(mats.steel, 0.8, 0.05, 1.85, 0, 0.7, 0);
  b.box(mats.mattress, 0.78, 0.1, 1.8, 0, 0.78, 0);
  for (const [x, z] of [[-0.33, -0.82], [0.33, -0.82], [-0.33, 0.82], [0.33, 0.82]]) {
    b.box(mats.steel, 0.04, 0.66, 0.04, x, 0.35, z);
    b.cyl(mats.plasticDark, 0.05, 0.05, 0.03, 8, x, 0.05, z, 0, 0, Math.PI / 2);
  }
  b.cyl(mats.steel, 0.02, 0.02, 0.8, 6, 0, 1.1, -0.9, 0, 0, Math.PI / 2);
  b.box(mats.fabricWhite, 0.7, 0.06, 1.3, 0, 0.86, 0.1);
  return b.build();
}

function wheelchair() {
  const b = B();
  b.box(mats.fabricBlue, 0.46, 0.06, 0.44, 0, 0.5, 0);
  b.box(mats.fabricBlue, 0.46, 0.5, 0.05, 0, 0.75, -0.22);
  b.box(mats.rust, 0.03, 0.5, 0.03, -0.25, 0.25, -0.2);
  b.box(mats.rust, 0.03, 0.5, 0.03, 0.25, 0.25, -0.2);
  b.box(mats.rust, 0.5, 0.03, 0.03, 0, 0.25, 0.2);
  for (const s of [-1, 1]) {
    b.torus(mats.metalDark, 0.28, 0.022, 16, s * 0.3, 0.3, 0, 0, Math.PI / 2, 0);
    b.cyl(mats.metalDark, 0.03, 0.03, 0.04, 8, s * 0.3, 0.3, 0, 0, 0, Math.PI / 2);
    b.torus(mats.plasticDark, 0.07, 0.02, 10, s * 0.28, 0.07, 0.34, 0, Math.PI / 2, 0);
    b.box(mats.steel, 0.04, 0.04, 0.4, s * 0.24, 0.1, 0.16);
  }
  b.box(mats.metalDark, 0.36, 0.04, 0.1, 0, 0.1, 0.36);
  b.box(mats.metalDark, 0.36, 0.22, 0.02, 0, 0.2, 0.38, 0.4, 0, 0);
  return b.build();
}

function cabinet({ w = 0.9, h = 1.8, d = 0.42, glass = true } = {}) {
  const b = B();
  b.box(mats.metal, w, h, d, 0, h / 2, 0);
  b.box(mats.metalDark, w + 0.04, 0.05, d + 0.02, 0, h + 0.02, 0);
  b.box(mats.metalDark, w - 0.1, 0.03, d - 0.06, 0, 0.06, 0.01);
  // shelves visible through glass
  for (let i = 1; i < 4; i++) b.box(mats.steel, w - 0.12, 0.02, d - 0.1, 0, (h / 4) * i, 0.01);
  const doorMat = glass ? mats.glassDirty : mats.metal;
  b.box(doorMat, w / 2 - 0.04, h - 0.16, 0.02, -w / 4, h / 2, d / 2 + 0.01);
  b.box(doorMat, w / 2 - 0.04, h - 0.16, 0.02, w / 4, h / 2, d / 2 + 0.01);
  b.box(mats.metalDark, 0.02, 0.18, 0.03, -0.03, h * 0.52, d / 2 + 0.03);
  b.box(mats.metalDark, 0.02, 0.18, 0.03, 0.03, h * 0.52, d / 2 + 0.03);
  // a few bottles inside
  b.cyl(mats.plasticWhite, 0.035, 0.035, 0.14, 8, -0.2, h * 0.28, 0);
  b.cyl(mats.bone, 0.03, 0.03, 0.1, 8, 0.15, h * 0.52, 0.02);
  return b.build();
}

function lockerUnit({ count = 2 } = {}) {
  const b = B();
  const w = 0.42 * count, h = 1.85, d = 0.45;
  b.box(mats.metalDark, w + 0.04, h, d, 0, h / 2, 0);
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + 0.21 + i * 0.42;
    b.box(mats.metal, 0.38, h - 0.08, 0.03, x, h / 2, d / 2);
    // vents
    for (let v = 0; v < 4; v++) b.box(mats.plasticDark, 0.2, 0.012, 0.01, x, h - 0.16 - v * 0.035, d / 2 + 0.02);
    b.box(mats.steel, 0.03, 0.1, 0.02, x + 0.13, h * 0.52, d / 2 + 0.03);
    b.box(mats.steel, 0.06, 0.02, 0.02, x, h - 0.08, d / 2 + 0.02);
  }
  b.box(mats.metalDark, w + 0.04, 0.06, d + 0.02, 0, 0.03, 0);
  return b.build();
}

function wardrobe() {
  const b = B();
  const w = 1.0, h = 2.05, d = 0.55;
  b.box(mats.woodDark, w, h, d, 0, h / 2, 0);
  b.box(mats.woodDark, w + 0.06, 0.07, d + 0.04, 0, h + 0.02, 0);
  b.box(mats.wood, w / 2 - 0.02, h - 0.12, 0.02, -w / 4, h / 2, d / 2 + 0.01);
  b.box(mats.wood, w / 2 - 0.02, h - 0.12, 0.02, w / 4, h / 2, d / 2 + 0.01);
  b.cyl(mats.rust, 0.01, 0.01, 0.08, 6, -0.02, h * 0.5, d / 2 + 0.03);
  b.cyl(mats.rust, 0.01, 0.01, 0.08, 6, 0.02, h * 0.5, d / 2 + 0.03);
  b.box(mats.woodDark, w - 0.06, 0.03, d - 0.08, 0, 1.0, 0);
  return b.build();
}

function desk({ w = 1.6, d = 0.75, h = 0.75 } = {}) {
  const b = B();
  b.box(mats.wood, w, 0.05, d, 0, h, 0);
  b.box(mats.woodDark, w, 0.44, 0.04, 0, h - 0.24, -d / 2 + 0.03);
  b.box(mats.woodDark, 0.05, h, d, -w / 2 + 0.03, h / 2, 0);
  b.box(mats.woodDark, 0.05, h, d, w / 2 - 0.03, h / 2, 0);
  b.box(mats.woodDark, w - 0.1, 0.3, d - 0.08, 0, h - 0.2, 0.02);
  b.box(mats.steel, 0.16, 0.02, 0.02, -w / 2 + 0.2, h - 0.2, d / 2 - 0.02);
  return b.build();
}

function receptionCounter({ len = 5 } = {}) {
  const b = B();
  b.box(mats.woodDark, len, 1.1, 0.6, 0, 0.55, 0);
  b.box(mats.wood, len + 0.1, 0.06, 0.72, 0, 1.13, 0);
  b.box(mats.wood, len, 0.5, 0.08, 0, 0.75, -0.32);
  for (let i = 0; i < Math.floor(len / 1.4); i++) {
    b.box(mats.woodDark, 0.03, 0.8, 0.02, -len / 2 + 0.7 + i * 1.4, 0.5, 0.31);
  }
  return b.build();
}

function officeChair() {
  const b = B();
  b.box(mats.fabricBlue, 0.5, 0.08, 0.48, 0, 0.46, 0);
  b.box(mats.fabricBlue, 0.48, 0.55, 0.07, 0, 0.75, -0.2);
  b.cyl(mats.metalDark, 0.03, 0.03, 0.3, 8, 0, 0.3, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.box(mats.metalDark, 0.28, 0.03, 0.03, Math.cos(a) * 0.14, 0.16, Math.sin(a) * 0.14, 0, -a, 0);
    b.cyl(mats.plasticDark, 0.03, 0.03, 0.025, 6, Math.cos(a) * 0.27, 0.03, Math.sin(a) * 0.27, 0, 0, Math.PI / 2);
  }
  return b.build();
}

function waitingChair() {
  const b = B();
  b.box(mats.plasticDark, 0.5, 0.06, 0.46, 0, 0.44, 0);
  b.box(mats.plasticDark, 0.5, 0.5, 0.05, 0, 0.68, -0.2);
  b.box(mats.metalDark, 0.04, 0.44, 0.04, -0.2, 0.22, 0.18);
  b.box(mats.metalDark, 0.04, 0.44, 0.04, 0.2, 0.22, 0.18);
  b.box(mats.metalDark, 0.04, 0.5, 0.04, -0.2, 0.44, -0.2);
  b.box(mats.metalDark, 0.04, 0.5, 0.04, 0.2, 0.44, -0.2);
  b.box(mats.rust, 0.5, 0.03, 0.03, 0, 0.24, 0.19);
  return b.build();
}

function bench({ len = 2.6 } = {}) {
  const b = B();
  b.box(mats.woodDark, len, 0.05, 0.42, 0, 0.44, 0);
  b.box(mats.woodDark, len, 0.06, 0.1, 0, 0.68, -0.16);
  b.box(mats.metalDark, 0.05, 0.44, 0.38, -len / 2 + 0.15, 0.22, 0);
  b.box(mats.metalDark, 0.05, 0.44, 0.38, len / 2 - 0.15, 0.22, 0);
  b.box(mats.metalDark, 0.05, 0.45, 0.03, -len / 2 + 0.15, 0.46, -0.16);
  b.box(mats.metalDark, 0.05, 0.45, 0.03, len / 2 - 0.15, 0.46, -0.16);
  return b.build();
}

function shelfUnit({ w = 1.8, h = 2.0, d = 0.5 } = {}) {
  const b = B();
  for (let i = 0; i < 5; i++) b.box(mats.rust, w, 0.03, d, 0, 0.15 + i * ((h - 0.2) / 4), 0);
  for (const s of [-1, 1]) {
    b.box(mats.rust, 0.04, h, 0.04, (s * w) / 2, h / 2, -d / 2 + 0.02);
    b.box(mats.rust, 0.04, h, 0.04, (s * w) / 2, h / 2, d / 2 - 0.02);
  }
  b.box(mats.rust, w, 0.03, 0.03, 0, h * 0.55, -d / 2 + 0.02, 0, 0, 0);
  return b.build();
}

function crate({ s = 0.6 } = {}) {
  const b = B();
  b.box(mats.cardboard, s, s * 0.8, s, 0, s * 0.4, 0);
  b.box(mats.woodDark, s + 0.01, 0.02, 0.06, 0, s * 0.7, 0);
  b.box(mats.paper, s * 0.5, s * 0.12, s * 0.02, 0, s * 0.5, s / 2 + 0.01);
  return b.build();
}

function filingCabinet({ h = 1.4 } = {}) {
  const b = B();
  b.box(mats.metalDark, 0.6, h, 0.55, 0, h / 2, 0);
  for (let i = 0; i < 4; i++) {
    const y = 0.2 + i * ((h - 0.25) / 4);
    b.box(mats.metal, 0.55, (h - 0.3) / 4 - 0.03, 0.03, 0, y + 0.1, 0.28);
    b.box(mats.steel, 0.16, 0.02, 0.03, 0, y + 0.1, 0.3);
  }
  return b.build();
}

function ivStand() {
  const b = B();
  b.cyl(mats.steel, 0.02, 0.02, 1.85, 6, 0, 0.92, 0);
  b.cyl(mats.steel, 0.16, 0.16, 0.02, 10, 0, 0.02, 0);
  b.cyl(mats.steel, 0.03, 0.03, 0.07, 8, 0, 0.04, 0);
  b.box(mats.steel, 0.3, 0.02, 0.02, 0, 1.8, 0);
  b.box(mats.steel, 0.06, 0.16, 0.02, -0.12, 1.72, 0);
  b.box(mats.plasticWhite, 0.18, 0.26, 0.06, 0.12, 1.6, 0);
  b.cyl(mats.plasticWhite, 0.02, 0.02, 0.4, 6, 0.12, 1.36, 0);
  return b.build();
}

function trayTable() {
  const b = B();
  b.box(mats.steel, 0.5, 0.03, 0.36, 0, 0.85, 0);
  b.cyl(mats.steel, 0.02, 0.02, 0.85, 6, 0, 0.43, 0);
  for (const [x, z] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.12], [0.18, 0.12]]) {
    b.box(mats.steel, 0.02, 0.03, 0.2, x, 0.02, z, 0, 0, 0);
  }
  b.box(mats.steel, 0.04, 0.03, 0.3, 0, 0.03, 0);
  b.box(mats.plasticWhite, 0.2, 0.04, 0.14, -0.08, 0.88, 0.02);
  b.box(mats.plasticWhite, 0.06, 0.1, 0.06, 0.12, 0.9, -0.02);
  return b.build();
}

// ------------------------------------------------------------------ machines

function crtMonitor({ size = 0.34, screenMat = mats.screenStatic } = {}) {
  const b = B();
  b.box(mats.plasticDark, size, size * 0.85, size * 0.95, 0, 0, 0);
  b.box(mats.plasticDark, size * 0.62, size * 0.5, size * 0.5, 0, -size * 0.1, -size * 0.6);
  b.box(mats.screenOff, size * 0.94, size * 0.8, 0.01, 0, 0, size * 0.48);
  b.cyl(mats.metalDark, 0.03, 0.03, 0.2, 6, 0, -size * 0.42, -size * 0.7);
  return b.build();
}

function television() {
  const b = B();
  b.box(mats.plasticDark, 0.62, 0.5, 0.52, 0, 0.32, 0);
  b.box(mats.screenOff, 0.54, 0.4, 0.01, 0, 0.34, 0.26);
  b.box(mats.plasticDark, 0.44, 0.2, 0.3, 0, 0.16, -0.28);
  b.box(mats.metalDark, 0.5, 0.04, 0.4, 0, 0.06, 0);
  b.cyl(mats.steel, 0.008, 0.008, 0.35, 4, -0.16, 0.72, -0.1, 0.35, 0, 0.2);
  b.cyl(mats.steel, 0.008, 0.008, 0.35, 4, 0.1, 0.72, -0.1, -0.2, 0, -0.3);
  return b.build();
}

function computer() {
  const b = B();
  b.box(mats.plasticDark, 0.44, 0.32, 0.05, 0, 0.18, 0);
  b.box(mats.screenOff, 0.4, 0.28, 0.01, 0, 0.18, 0.03);
  b.box(mats.plasticDark, 0.16, 0.04, 0.14, 0, 0.02, 0);
  b.box(mats.plasticDark, 0.42, 0.03, 0.16, 0, 0.02, 0.28);
  b.box(mats.plasticDark, 0.2, 0.38, 0.42, 0, 0.19, -0.4);
  b.box(mats.steel, 0.02, 0.02, 0.02, 0, 0.04, 0.1);
  return b.build();
}

function defibrillator() {
  const b = B();
  b.box(mats.plasticWhite, 0.5, 0.24, 0.34, 0, 0.9, 0);
  b.box(mats.screenOff, 0.18, 0.12, 0.01, -0.1, 0.94, 0.18);
  b.cyl(mats.plasticDark, 0.04, 0.04, 0.03, 8, 0.14, 0.94, 0.18);
  b.cyl(mats.steel, 0.02, 0.02, 0.75, 6, 0, 0.45, 0);
  b.cyl(mats.steel, 0.2, 0.2, 0.03, 10, 0, 0.05, 0);
  b.box(mats.plasticDark, 0.16, 0.06, 0.1, 0.3, 0.72, 0.1);
  return b.build();
}

function oxygenCylinder() {
  const b = B();
  b.cyl(mats.metalDark, 0.11, 0.11, 1.1, 12, 0, 0.55, 0);
  b.cyl(mats.metal, 0.09, 0.11, 0.12, 12, 0, 1.14, 0);
  b.cyl(mats.steel, 0.03, 0.03, 0.14, 8, 0, 1.24, 0);
  b.torus(mats.steel, 0.07, 0.012, 10, 0, 1.3, 0, Math.PI / 2, 0, 0);
  b.box(mats.metalDark, 0.18, 0.04, 0.18, 0, 0.03, 0);
  return b.build();
}

function sinkUnit() {
  const b = B();
  b.box(mats.plasticWhite, 0.55, 0.16, 0.42, 0, 0.78, 0);
  b.box(mats.steel, 0.5, 0.02, 0.36, 0, 0.7, 0);
  b.cyl(mats.steel, 0.02, 0.02, 0.16, 6, 0, 0.88, -0.16);
  b.cyl(mats.steel, 0.015, 0.015, 0.16, 6, 0, 0.96, -0.09, Math.PI / 2);
  b.box(mats.rust, 0.55, 0.62, 0.3, 0, 0.34, 0.04);
  b.box(mats.glassDirty, 0.5, 0.6, 0.02, 0, 1.5, -0.22);
  return b.build();
}

function toiletStall() {
  const b = B();
  b.box(mats.plasticWhite, 0.38, 0.42, 0.6, 0, 0.21, 0);
  b.box(mats.plasticWhite, 0.4, 0.1, 0.44, 0, 0.46, -0.06);
  b.box(mats.plasticWhite, 0.38, 0.42, 0.12, 0, 0.62, -0.3);
  b.box(mats.tileWall, 0.05, 1.9, 1.6, -0.7, 0.95, 0.2);
  b.box(mats.tileWall, 0.05, 1.9, 0.05, 0, 0.95, 0.72);
  return b.build();
}

function trashBin() {
  const b = B();
  b.cyl(mats.plasticDark, 0.19, 0.16, 0.5, 10, 0, 0.25, 0);
  b.cyl(mats.steel, 0.2, 0.2, 0.02, 10, 0, 0.5, 0);
  return b.build();
}

function extinguisher() {
  const b = B();
  b.cyl(mats.plasticRed, 0.09, 0.09, 0.5, 10, 0, 0.25, 0);
  b.cyl(mats.metalDark, 0.04, 0.04, 0.1, 8, 0, 0.55, 0);
  b.box(mats.metalDark, 0.02, 0.3, 0.02, 0.09, 0.42, 0);
  return b.build();
}

function radiator() {
  const b = B();
  for (let i = 0; i < 9; i++) b.box(mats.rust, 0.04, 0.5, 0.14, -0.4 + i * 0.1, 0.3, 0);
  b.cyl(mats.rust, 0.02, 0.02, 0.9, 6, 0, 0.54, 0, 0, 0, Math.PI / 2);
  return b.build();
}

function wallClock() {
  const b = B();
  b.cyl(mats.plasticWhite, 0.18, 0.18, 0.05, 16, 0, 0, 0, Math.PI / 2, 0, 0);
  b.cyl(mats.plasticDark, 0.155, 0.155, 0.055, 16, 0, 0, 0.005, Math.PI / 2, 0, 0);
  b.box(mats.plasticWhite, 0.01, 0.1, 0.01, 0, 0.05, 0.035);
  b.box(mats.plasticWhite, 0.07, 0.01, 0.01, 0.035, 0, 0.035);
  return b.build();
}

function plant() {
  const b = B();
  b.cyl(mats.rustDark, 0.16, 0.12, 0.34, 8, 0, 0.17, 0);
  b.cyl(mats.woodDark, 0.02, 0.03, 0.5, 5, 0, 0.5, 0);
  const rng = new Rng(9);
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2);
    b.box(mats.woodDark, 0.4, 0.01, 0.12, Math.cos(a) * 0.12, 0.6 + rng.range(0, 0.25), Math.sin(a) * 0.12, rng.range(-0.5, 0.5), a, rng.range(-0.4, 0.4));
  }
  return b.build();
}

function ceilingLight({ len = 1.2, dual = false } = {}) {
  const b = B();
  b.box(mats.metalDark, len + 0.1, 0.06, 0.16, 0, 0, 0);
  b.box(mats.emissiveTube, len, 0.035, 0.1, 0, -0.045, 0);
  if (dual) b.box(mats.emissiveTube, len, 0.035, 0.1, 0, -0.045, 0.12);
  return b.build();
}

function morgueDrawers({ cols = 3, rows = 3 } = {}) {
  const b = B();
  const w = cols * 0.8, h = rows * 0.62;
  b.box(mats.steel, w + 0.1, h + 0.1, 0.9, 0, h / 2, 0);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      b.box(mats.metalDark, 0.74, 0.54, 0.04, -w / 2 + 0.4 + c * 0.8, 0.34 + r * 0.62, 0.46);
      b.box(mats.steel, 0.24, 0.03, 0.04, -w / 2 + 0.4 + c * 0.8, 0.34 + r * 0.62, 0.49);
    }
  }
  return b.build();
}

function morgueTable() {
  const b = B();
  b.box(mats.steel, 0.8, 0.05, 2.0, 0, 0.8, 0);
  b.box(mats.steel, 0.7, 0.06, 0.85, 0, 0.84, 0);
  for (const [x, z] of [[-0.32, -0.85], [0.32, -0.85], [-0.32, 0.85], [0.32, 0.85]]) {
    b.cyl(mats.steel, 0.03, 0.03, 0.8, 8, x, 0.4, z);
  }
  b.box(mats.steel, 0.75, 0.04, 0.04, 0, 0.2, -0.85);
  return b.build();
}

function bodyBag() {
  const b = B();
  b.box(mats.plasticDark, 0.6, 0.22, 1.85, 0, 0.12, 0);
  b.cyl(mats.plasticDark, 0.3, 0.3, 0.55, 10, 0, 0.12, -0.86, 0, 0, Math.PI / 2);
  b.box(mats.steel, 0.02, 0.02, 0.4, 0.28, 0.13, 0.3);
  b.box(mats.steel, 0.02, 0.02, 0.4, -0.28, 0.13, -0.2);
  return b.build();
}

function operatingTable() {
  const b = B();
  b.box(mats.steel, 0.9, 0.14, 2.1, 0, 0.95, 0);
  b.box(mats.steel, 0.6, 0.85, 0.4, 0, 0.45, 0);
  b.box(mats.steel, 0.7, 0.06, 0.8, 0, 0.04, 0);
  b.box(mats.fabricBlue, 0.8, 0.06, 1.9, 0, 1.04, 0);
  b.box(mats.steel, 0.1, 0.06, 0.5, -0.4, 1.1, -0.7);
  b.box(mats.steel, 0.1, 0.06, 0.4, -0.4, 1.1, 0.5);
  return b.build();
}

function operatingLamp() {
  const b = B();
  b.cyl(mats.steel, 0.04, 0.04, 2.4, 8, 0, 1.2, 0);
  b.cyl(mats.steel, 0.3, 0.3, 0.03, 10, 0, 0.03, 0);
  b.cyl(mats.steel, 0.03, 0.03, 0.9, 6, 0.45, 2.4, 0, 0, 0, Math.PI / 2);
  b.cyl(mats.metalDark, 0.34, 0.26, 0.16, 14, 0.9, 2.32, 0);
  b.sphere(mats.emissiveWarm, 0.22, 12, 0.9, 2.24, 0);
  return b.build();
}

function labBench({ len = 2.4 } = {}) {
  const b = B();
  b.box(mats.steel, len, 0.05, 0.7, 0, 0.9, 0);
  b.box(mats.plasticWhite, len - 0.1, 0.08, 0.62, 0, 0.86, 0);
  b.box(mats.woodDark, len, 0.85, 0.06, 0, 0.45, -0.3);
  b.box(mats.metalDark, 0.06, 0.9, 0.66, -len / 2 + 0.05, 0.45, 0);
  b.box(mats.metalDark, 0.06, 0.9, 0.66, len / 2 - 0.05, 0.45, 0);
  b.cyl(mats.glassDirty, 0.06, 0.06, 0.24, 8, -0.5, 1.03, 0);
  b.cyl(mats.glassDirty, 0.04, 0.04, 0.3, 8, -0.3, 1.06, 0.1);
  b.box(mats.glassDirty, 0.3, 0.02, 0.2, 0.4, 0.94, 0);
  b.cyl(mats.steel, 0.015, 0.015, 0.4, 4, 0.8, 1.1, 0, 0, 0, 0.2);
  return b.build();
}

function generatorSet() {
  const b = B();
  b.box(mats.metalDark, 1.9, 1.1, 1.1, 0, 0.6, 0);
  b.box(mats.rust, 1.7, 0.5, 0.95, 0, 1.3, 0);
  b.cyl(mats.rust, 0.22, 0.22, 1.0, 12, -0.5, 1.5, 0, 0, 0, Math.PI / 2);
  b.cyl(mats.metal, 0.14, 0.14, 0.4, 10, 0.5, 1.7, 0);
  b.box(mats.metalDark, 0.5, 0.5, 0.3, 0.2, 0.4, 0.65);
  b.cyl(mats.steel, 0.05, 0.05, 0.6, 8, -0.6, 1.7, 0.4, 0.4, 0, 0.6);
  b.box(mats.plasticRed, 0.24, 0.3, 0.06, -0.75, 1.05, 0.58);
  b.cyl(mats.plasticDark, 0.05, 0.05, 0.02, 8, -0.75, 1.05, 0.62, Math.PI / 2);
  b.box(mats.metal, 1.9, 0.1, 1.1, 0, 0.05, 0);
  return b.build();
}

function boiler() {
  const b = B();
  b.cyl(mats.rustDark, 0.8, 0.8, 2.2, 14, 0, 1.1, 0);
  b.cyl(mats.metalDark, 0.82, 0.82, 0.12, 14, 0, 2.24, 0);
  b.cyl(mats.rust, 0.1, 0.1, 1.2, 8, 0.7, 2.0, 0, 0, 0, 0.6);
  b.cyl(mats.rust, 0.1, 0.1, 1.0, 8, -0.6, 0.9, 0.5, 0, 0, Math.PI / 2);
  b.box(mats.metalDark, 0.4, 0.6, 0.16, 0, 0.7, 0.78);
  for (let i = 0; i < 4; i++) b.cyl(mats.steel, 0.02, 0.02, 0.1, 6, -0.15 + i * 0.1, 0.3, 0.86, Math.PI / 2);
  return b.build();
}

function pipes({ len = 6, y = 2.6, count = 3 } = {}) {
  const b = B();
  for (let i = 0; i < count; i++) {
    const r = 0.05 + i * 0.015;
    b.cyl(mats.rust, r, r, len, 8, 0, y - i * 0.16, -0.1 + i * 0.22, 0, 0, Math.PI / 2);
  }
  for (let i = 0; i < Math.floor(len / 1.8); i++) {
    b.box(mats.metalDark, 0.06, 0.6, 0.5, -len / 2 + 1 + i * 1.8, y - 0.16, 0.1);
  }
  return b.build();
}

function ceilingPanelHole() {
  const b = B();
  b.box(mats.ceilingDark, 1.8, 0.04, 1.8, 0, 0, 0);
  return b.build();
}

function wallPlate() {
  const b = B();
  b.box(mats.metal, 0.3, 0.2, 0.02, 0, 0, 0);
  b.box(mats.plasticWhite, 0.26, 0.16, 0.01, 0, 0, 0.02);
  return b.build();
}

function curtain({ w = 1.4, h = 2.1 } = {}) {
  const b = B();
  b.cyl(mats.steel, 0.014, 0.014, w + 0.3, 6, 0, h, 0, 0, 0, Math.PI / 2);
  // a gathered curtain: a stack of thin folded panels
  const folds = 7;
  for (let i = 0; i < folds; i++) {
    const x = -w / 2 + (i / (folds - 1)) * w;
    b.box(mats.fabricWhite, w / folds + 0.02, h - 0.1, 0.06 + (i % 2) * 0.04, x, (h - 0.1) / 2, 0);
  }
  return b.build();
}

function papers() {
  const b = B();
  const rng = new Rng(41);
  for (let i = 0; i < 4; i++) {
    const x = rng.range(-0.3, 0.3), z = rng.range(-0.25, 0.25);
    b.box(mats.paper, 0.21, 0.002, 0.29, x, 0.004 + i * 0.002, z, 0, rng.range(0, 3), 0);
  }
  return b.build();
}

function deadTree() {
  const b = B();
  const rng = new Rng(77);
  b.cyl(mats.rustDark, 0.16, 0.26, 3.2, 7, 0, 1.6, 0);
  const branch = (x, y, z, ax, az, len, depth) => {
    b.cyl(mats.rustDark, 0.05 * depth, 0.07 * depth, len, 5, x, y, z, ax, 0, az);
    if (depth > 1) {
      const ex = x + Math.sin(az) * Math.sin(ax) * len * 0.5;
      const ey = y + Math.cos(ax) * len * 0.5;
      const ez = z + Math.cos(az) * Math.sin(ax) * len * 0.5;
      for (let i = 0; i < 2; i++) {
        branch(ex, ey, ez, ax + rng.range(-0.6, 0.6), az + rng.range(-0.9, 0.9), len * 0.6, depth - 1);
      }
    }
  };
  for (let i = 0; i < 5; i++) {
    const a = rng.range(0, Math.PI * 2);
    branch(Math.cos(a) * 0.1, 2.4 + i * 0.16, Math.sin(a) * 0.1, rng.range(0.4, 1.1), a, rng.range(1, 1.8), 3);
  }
  return b.build();
}

function ironFence({ len = 6, h = 2.0 } = {}) {
  const b = B();
  b.box(mats.concreteWall, len, 0.5, 0.26, 0, 0.25, 0);
  for (let i = 0; i < Math.floor(len / 0.22); i++) {
    b.box(mats.rust, 0.02, h - 0.5, 0.02, -len / 2 + 0.11 + i * 0.22, 0.5 + (h - 0.5) / 2, 0);
  }
  b.cyl(mats.rust, 0.025, 0.025, len, 6, 0, 0.6, 0, 0, 0, Math.PI / 2);
  b.cyl(mats.rust, 0.025, 0.025, len, 6, 0, h - 0.1, 0, 0, 0, Math.PI / 2);
  b.box(mats.concreteWall, 0.34, h + 0.4, 0.34, len / 2, (h + 0.4) / 2, 0);
  b.box(mats.concreteWall, 0.34, h + 0.4, 0.34, -len / 2, (h + 0.4) / 2, 0);
  return b.build();
}

function ambulance() {
  const b = B();
  // boxy old van
  b.box(mats.plasticWhite, 1.9, 1.7, 3.4, 0, 1.5, -0.3);
  b.box(mats.plasticWhite, 1.85, 0.9, 1.2, 0, 1.0, 1.9);
  b.box(mats.glassDirty, 1.7, 0.6, 0.05, 0, 1.45, 2.48);
  b.box(mats.glassDirty, 1.72, 0.55, 0.05, 0, 1.5, -1.98);
  b.box(mats.rust, 1.95, 0.05, 3.5, 0, 0.65, -0.3);
  for (const [x, z] of [[-0.9, 1.6], [0.9, 1.6], [-0.9, -1.4], [0.9, -1.4]]) {
    b.cyl(mats.plasticDark, 0.36, 0.36, 0.24, 12, x, 0.36, z, 0, 0, Math.PI / 2);
    b.cyl(mats.steel, 0.17, 0.17, 0.26, 10, x, 0.36, z, 0, 0, Math.PI / 2);
  }
  b.box(mats.plasticRed, 1.86, 0.1, 2.0, 0, 1.55, 0);
  b.box(mats.plasticWhite, 1.92, 0.14, 0.2, 0, 0.85, 2.4);
  b.cyl(mats.rust, 0.02, 0.02, 0.8, 4, -0.8, 2.6, -0.5, 0.3, 0, 0.4);
  b.box(mats.plasticDark, 0.24, 0.12, 0.08, 0, 2.4, 0.4);
  return b.build();
}

function cobweb({ s = 0.8 } = {}) {
  const b = B();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa9aca2, transparent: true, opacity: 0.22, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 0.5;
    b.box(mat, s, 0.004, 0.004, Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, 0, 0, 0, a);
  }
  for (let r = 1; r <= 3; r++) {
    const rr = (r / 4) * s;
    const pts = [];
    for (let i = 0; i <= 7; i++) {
      const a = (i / 7) * Math.PI * 0.5;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    b.add(mat, new THREE.TubeGeometry(curve, 16, 0.002, 3, false), 0, 0, 0);
  }
  return b.build();
}

// ------------------------------------------------------------------ pickups

function battery() {
  const b = B();
  b.cyl(mats.plasticDark, 0.033, 0.033, 0.16, 10, 0, 0.08, 0);
  b.cyl(mats.steel, 0.033, 0.033, 0.03, 10, 0, 0.055, 0);
  b.cyl(mats.steel, 0.012, 0.012, 0.012, 6, 0, 0.17, 0);
  b.box(mats.plasticRed, 0.066, 0.045, 0.066, 0, 0.12, 0);
  return b.build();
}

function medicine() {
  const b = B();
  b.cyl(mats.plasticWhite, 0.042, 0.042, 0.13, 10, 0, 0.065, 0);
  b.cyl(mats.plasticWhite, 0.03, 0.04, 0.03, 10, 0, 0.145, 0);
  b.box(mats.paper, 0.06, 0.08, 0.001, 0, 0.07, 0.043);
  return b.build();
}

function syringe() {
  const b = B();
  b.cyl(mats.glassDirty, 0.014, 0.014, 0.12, 8, 0, 0.06, 0);
  b.cyl(mats.steel, 0.004, 0.004, 0.12, 5, 0, 0.14, 0);
  b.box(mats.plasticWhite, 0.04, 0.01, 0.01, 0, 0.0, 0);
  return b.build();
}

function keyProp() {
  const b = B();
  b.box(mats.metal, 0.07, 0.005, 0.16, 0, 0.01, 0);
  b.torus(mats.metal, 0.016, 0.004, 8, 0, 0.01, -0.08, Math.PI / 2, 0, 0);
  return b.build();
}

function cardProp() {
  const b = B();
  b.box(mats.plasticWhite, 0.085, 0.004, 0.055, 0, 0.005, 0);
  b.box(mats.metal, 0.03, 0.003, 0.02, -0.02, 0.008, -0.01);
  return b.build();
}

function paperProp() {
  const b = B();
  b.box(mats.paper, 0.21, 0.003, 0.29, 0, 0.004, 0, 0, 0.3, 0);
  b.box(mats.paper, 0.2, 0.003, 0.28, 0.02, 0.007, 0.01, 0, -0.2, 0);
  return b.build();
}

function fuelCan() {
  const b = B();
  b.box(mats.plasticRed, 0.24, 0.3, 0.14, 0, 0.17, 0);
  b.box(mats.plasticRed, 0.1, 0.06, 0.06, 0.06, 0.34, 0);
  b.cyl(mats.metalDark, 0.03, 0.03, 0.03, 8, 0.06, 0.37, 0);
  b.box(mats.metalDark, 0.14, 0.02, 0.02, 0, 0.34, 0.0);
  return b.build();
}

function patientFile() {
  const b = B();
  b.box(mats.cardboard, 0.25, 0.03, 0.32, 0, 0.015, 0);
  b.box(mats.paper, 0.22, 0.02, 0.28, 0, 0.035, 0);
  b.box(mats.paper, 0.1, 0.001, 0.05, 0, 0.047, -0.12);
  return b.build();
}

function photoProp() {
  const b = B();
  b.box(mats.paper, 0.14, 0.003, 0.1, 0, 0.003, 0, 0, 0.4, 0);
  b.box(matBlack, 0.045, 0.002, 0.06, -0.02, 0.006, 0, 0, 0.4, 0);
  return b.build();
}
const matBlack = new THREE.MeshStandardMaterial({ color: 0x1a1a18, roughness: 0.9 });

function toolProp() {
  const b = B();
  b.cyl(mats.woodDark, 0.018, 0.018, 0.3, 6, 0, 0.15, 0);
  b.box(mats.metalDark, 0.05, 0.06, 0.16, 0, 0.31, 0.05);
  return b.build();
}

const PICKUP_MODELS = {
  battery, medicine, syringe, key: keyProp, accessCard: cardProp, paper: paperProp,
  fuelCan, patientFile, photo: photoProp, tool: toolProp,
};

export function createPickup(kind) {
  const fn = PICKUP_MODELS[kind] || battery;
  const g = fn();
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// ------------------------------------------------------------------ factory

const PROP_BUILDERS = {
  bed, gurney, wheelchair, cabinet, locker: lockerUnit, wardrobe, desk,
  counter: receptionCounter, officeChair, waitingChair, bench, shelf: shelfUnit,
  crate, filingCabinet, ivStand, trayTable, crt: crtMonitor, tv: television,
  computer, defibrillator, oxygen: oxygenCylinder, sink: sinkUnit, toilet: toiletStall,
  bin: trashBin, extinguisher, radiator, clock: wallClock, plant, ceilingLight,
  morgueDrawers, morgueTable, bodyBag, operatingTable, operatingLamp, labBench,
  generator: generatorSet, boiler, pipes, ceilingPanel: ceilingPanelHole,
  wallPlate, curtain, papers, deadTree, ironFence, ambulance, cobweb,
};

export function createProp(type, params) {
  const fn = PROP_BUILDERS[type];
  if (!fn) {
    console.warn('Unknown prop', type);
    return new THREE.Group();
  }
  return fn(params || {});
}

export function createSearchable(kind) {
  // returns group + animated pivot + open state
  const group = new THREE.Group();
  const b = B();
  let pivot = null;
  let slid = null;

  if (kind === 'cabinet') {
    const w = 0.9, h = 1.7, d = 0.42;
    b.box(mats.metal, w, h, d, 0, h / 2, 0);
    b.box(mats.metalDark, w + 0.04, 0.05, d + 0.02, 0, h + 0.02, 0);
    for (let i = 1; i < 4; i++) b.box(mats.steel, w - 0.14, 0.02, d - 0.1, 0, (h / 4) * i, 0);
    b.box(mats.metalDark, w - 0.1, 0.04, d - 0.02, 0, 0.03, 0);
    b.cyl(mats.plasticWhite, 0.035, 0.035, 0.14, 8, -0.2, h * 0.28, 0);
    b.box(mats.paper, 0.2, 0.02, 0.14, 0.2, h * 0.52, 0.03);
    group.add(b.build());

    // left-hand glass door on a hinge, plus a static right-hand panel
    const doorW = w / 2 - 0.05;
    const doorGeo = B();
    doorGeo.box(mats.glassDirty, doorW, h - 0.18, 0.015, doorW / 2, 0, 0);
    doorGeo.box(mats.metalDark, doorW, 0.02, 0.026, doorW / 2, -h / 2 + 0.12, 0);
    doorGeo.box(mats.metalDark, 0.02, 0.15, 0.03, doorW - 0.04, 0, 0.02);
    const doorMesh = doorGeo.build();
    const hinge = new THREE.Group();
    hinge.position.set(-w / 2 + 0.02, h / 2, d / 2 + 0.01);
    hinge.add(doorMesh);
    group.add(hinge);
    pivot = hinge;

    const fixed = B();
    fixed.box(mats.glassDirty, doorW, h - 0.18, 0.015, 0, 0, 0);
    fixed.box(mats.metalDark, doorW, 0.02, 0.026, 0, -h / 2 + 0.12, 0);
    fixed.box(mats.metalDark, 0.02, 0.15, 0.03, -doorW + 0.04, 0, 0.02);
    const fixedMesh = fixed.build();
    fixedMesh.position.set(w / 2 - doorW / 2 - 0.02, h / 2, d / 2 + 0.01);
    group.add(fixedMesh);
  } else if (kind === 'drawer') {
    const w = 0.62, h = 1.1, d = 0.5;
    b.box(mats.metalDark, w, h, d, 0, h / 2, 0);
    b.box(mats.metalDark, w + 0.03, 0.04, d + 0.02, 0, h + 0.02, 0);
    const base = b.build();
    group.add(base);
    slid = new THREE.Group();
    const drawerB = B();
    for (let i = 0; i < 3; i++) {
      drawerB.box(mats.metal, w - 0.04, 0.28, 0.03, 0, 0.28 + i * 0.32, 0);
      drawerB.box(mats.steel, 0.14, 0.02, 0.03, 0, 0.28 + i * 0.32, 0.02);
    }
    const drawers = drawerB.build();
    drawers.position.set(0, 0.08, d / 2);
    slid.add(drawers);
    group.add(slid);
  } else if (kind === 'locker') {
    const g = lockerUnit({ count: 2 });
    group.add(g);
    slid = null;
  } else if (kind === 'wardrobe') {
    const g = wardrobe();
    group.add(g);
  } else if (kind === 'morgue') {
    const g = morgueDrawers({ cols: 2, rows: 3 });
    group.add(g);
  } else if (kind === 'desk') {
    const g = desk({ w: 1.4, d: 0.7 });
    group.add(g);
  } else {
    const g = cabinet({ w: 0.9, h: 1.6, d: 0.4 });
    group.add(g);
  }

  group.userData.container = { kind, opened: false, pivot, slid };
  group.userData.openAmount = 0;
  group.userData.setOpen = (v) => { group.userData.openTarget = v; };
  group.userData.openTarget = 0;
  return group;
}

export function animateContainer(group, dt) {
  const c = group.userData.container;
  if (!c) return;
  const target = group.userData.openTarget || 0;
  group.userData.openAmount = THREE.MathUtils.damp(group.userData.openAmount, target, 8, dt);
  const a = group.userData.openAmount;
  if (c.kind === 'drawer' && c.slid) c.slid.position.z = 0.25 + a * 0.22;
  else if (c.kind === 'cabinet' && c.pivot) c.pivot.rotation.y = a * 1.75;
  else if (c.kind === 'wardrobe') group.rotation.y = group.userData.baseRotY || 0;
}

export { mats };
