import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mats } from './materials.js';
import { TILE, LEVEL_BY_ID, worldX, worldZ, LEVELS } from './layout.js';
import { clamp, damp, lerp } from '../core/utils.js';

const DOOR_H = 2.15;
const DOOR_W = 1.5;

function labelTexture(text, opts = {}) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || '#191d1a';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = opts.ring || 'rgba(190,190,170,0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(64, 64, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = opts.ink || '#c9c8b6';
  ctx.font = '600 44px "JetBrains Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Indicator {
  constructor(width = 0.42) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256; this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.375), this.mat);
    this.setText('--');
  }
  setText(text) {
    const ctx = this.ctx;
    ctx.fillStyle = '#050807';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = 'rgba(140,150,135,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 244, 84);
    ctx.fillStyle = '#c8d2b8';
    ctx.font = '600 46px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 52);
    this.texture.needsUpdate = true;
  }
}

export class Elevator {
  constructor(config, opts = {}) {
    this.cfg = config;
    this.id = config.id;
    this.name = config.name;
    this.stops = config.stops.map((id) => LEVEL_BY_ID[id]).filter(Boolean);
    this.stopsByY = [...this.stops].sort((a, b) => a.y - b.y);
    this.cx = worldX(config.centre.tx);
    this.cz = worldZ(config.centre.tz);
    this.innerW = config.innerW;
    this.innerD = config.innerD;
    this.doorSide = config.doorFacing === 'south' ? 1 : -1;
    this.doorZ = this.cz + (this.innerD / 2) * this.doorSide;
    this.onSound = opts.onSound || (() => {});
    this.interactables = [];
    this.levelGroups = {};
    this.levelDoors = {};
    this.indicators = {};
    this.callPanels = {};
    this.y = (LEVEL_BY_ID.gf || this.stops[0]).y;
    this.targetY = this.y;
    this.state = 'idle';
    this.doorOpen = 0;
    this.doorTarget = 0;
    this.speed = 2.3;
    this.velocity = 0;
    this.currentLevel = this.levelAtY(this.y);
    this.pendingStop = null;
    this.rideTarget = null;
    this.group = new THREE.Group();
    this.colliders = [];
    this._buildCar();
    this.group.position.set(this.cx, this.y, this.cz);
    this.setDoors(0);
    this._setIndicator(this.currentLevel);
  }

  levelAtY(y) {
    let best = this.stopsByY[0], d = Infinity;
    for (const s of this.stopsByY) {
      const dd = Math.abs(s.y - y);
      if (dd < d) { d = dd; best = s; }
    }
    return best;
  }

  get atStop() { return Math.abs(this.y - this.targetY) < 0.02; }
  get isMoving() { return this.state === 'moving'; }
  get isOpen() { return this.doorOpen > 0.7; }

  // ---------------------------------------------------------------- geometry
  _buildCar() {
    const w = this.innerW, d = this.innerD, h = 2.35;
    const b = new Map();
    const add = (mat, geo, x, y, z) => {
      geo.translate(x, y, z);
      if (!b.has(mat)) b.set(mat, []);
      b.get(mat).push(geo);
    };
    // floor and ceiling
    add(mats.metalDark, new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), 0, 0.0, 0);
    add(mats.metal, new THREE.BoxGeometry(w, 0.06, d), 0, 0.03, 0);
    add(mats.metalDark, new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), 0, h, 0);
    add(mats.emissiveTube, new THREE.BoxGeometry(w * 0.6, 0.04, 0.12), 0, h - 0.08, 0);
    // walls: back, left, right (front stays open toward the doors)
    add(mats.metal, new THREE.BoxGeometry(w, h, 0.06), 0, h / 2, -d / 2);
    add(mats.metal, new THREE.BoxGeometry(0.06, h, d), -w / 2, h / 2, 0);
    add(mats.metal, new THREE.BoxGeometry(0.06, h, d), w / 2, h / 2, 0);
    // handrail
    add(mats.steel, new THREE.BoxGeometry(w - 0.1, 0.04, 0.04), 0, 1.0, -d / 2 + 0.08);
    add(mats.steel, new THREE.BoxGeometry(0.04, 0.04, d - 0.1), -w / 2 + 0.08, 1.0, 0);
    // mirror
    add(mats.glassDirty, new THREE.BoxGeometry(w * 0.66, 1.1, 0.02), 0, 1.55, -d / 2 + 0.04);

    const meshes = [];
    for (const [mat, list] of b) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      meshes.push(mesh);
    }
    // car light
    this.light = new THREE.PointLight(0xcfd8c4, 5, 6, 2);
    this.light.position.set(0, h - 0.2, 0);
    this.group.add(this.light);

    // floor buttons panel (child of the car)
    this.panel = new THREE.Group();
    this.panel.position.set(w / 2 - 0.03, 1.25, this.doorSide * (d / 2 - 0.55));
    this.panel.rotation.y = -Math.PI / 2;
    this.group.add(this.panel);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, this.stops.length * 0.14 + 0.14, 0.05), mats.metalDark);
    this.panel.add(back);
    this.stopButtons = {};
    this.stops.slice().sort((a, b2) => b2.y - a.y).forEach((stop, i) => {
      const tex = labelTexture(stop.short);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.2, emissive: 0x0a0f0a, emissiveIntensity: 0.6 });
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.026, 12), mat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, ((this.stops.length - 1) / 2 - i) * 0.14, 0.035);
      btn.userData.elevatorButton = { elevator: this, stop: stop.id, kind: 'floor' };
      this.panel.add(btn);
      this.stopButtons[stop.id] = { mesh: btn, mat, tex };
      this.interactables.push(btn);
    });

    this.indicator = new Indicator(0.5);
    this.indicator.mesh.position.set(0, 2.16, this.doorSide * (d / 2 - 0.03));
    this.indicator.mesh.rotation.y = this.doorSide > 0 ? 0 : Math.PI;
    this.group.add(this.indicator.mesh);
  }

  _buildLobbyStation() {
    // returns per level groups created lazily in buildForLevel()
  }

  buildForLevel(level) {
    const g = new THREE.Group();
    const w = this.innerW + 0.5;
    const wallMat = mats.metalDark;
    const doorH = DOOR_H;

    // shaft front wall segments beside the doorway
    const sideW = (w - DOOR_W) / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sideW, doorH + 0.2, 0.18), wallMat);
    wall.position.set(-(DOOR_W + sideW) / 2, (doorH + 0.2) / 2, this.doorZ);
    g.add(wall);
    const wall2 = wall.clone();
    wall2.position.x = (DOOR_W + sideW) / 2;
    g.add(wall2);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.18), wallMat);
    lintel.position.set(0, doorH + 0.35, this.doorZ);
    g.add(lintel);

    // doors
    const doors = [];
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W / 2, doorH, 0.05), mats.metal);
      panel.position.set(s * DOOR_W / 4, doorH / 2, this.doorZ + this.doorSide * 0.12);
      g.add(panel);
      doors.push(panel);
    }
    this.levelDoors[level.id] = doors;

    // indicator above the doors, facing the lobby
    const ind = new Indicator(0.5);
    ind.mesh.position.set(0, doorH + 0.62, this.doorZ + this.doorSide * 0.1);
    ind.mesh.rotation.y = this.doorSide > 0 ? 0 : Math.PI;
    g.add(ind.mesh);
    this.indicators[level.id] = ind;

    // call button panel on the wall next to the doors
    const panelGroup = new THREE.Group();
    panelGroup.position.set(this.cfg.panelOffset.x * this.doorSide * -1, 1.25, this.doorZ + this.doorSide * 0.14);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.04), mats.metalDark);
    panelGroup.add(plate);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xd8d4bc, emissive: 0x4a3a18, emissiveIntensity: 0.8, roughness: 0.4 });
    const callBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12), btnMat);
    callBtn.rotation.x = Math.PI / 2;
    callBtn.position.set(0, 0.02, 0.03);
    callBtn.userData.elevatorButton = { elevator: this, stop: level.id, kind: 'call' };
    panelGroup.add(callBtn);
    g.add(panelGroup);
    this.callPanels[level.id] = { group: panelGroup, btn: callBtn, mat: btnMat };
    this.interactables.push(callBtn);

    // colliders: door frame sides + doors themselves handled dynamically
    this.staticColliders = this.staticColliders || {};
    this.staticColliders[level.id] = [
      { minX: this.cx - w / 2, maxX: this.cx - DOOR_W / 2, minZ: this.doorZ - 0.12, maxZ: this.doorZ + 0.12 },
      { minX: this.cx + DOOR_W / 2, maxX: this.cx + w / 2, minZ: this.doorZ - 0.12, maxZ: this.doorZ + 0.12 },
    ];

    this.levelGroups[level.id] = g;
    this._setIndicator(this.currentLevel);
    return g;
  }

  // ------------------------------------------------------------------ state
  setDoors(amount) {
    this.doorOpen = clamp(amount, 0, 1);
    for (const levelId of Object.keys(this.levelDoors)) {
      const open = this.currentLevel && levelId === this.currentLevel.id && Math.abs(this.y - this.currentLevel.y) < 0.1;
      const doors = this.levelDoors[levelId];
      for (let i = 0; i < doors.length; i++) {
        const s = i === 0 ? -1 : 1;
        const shift = open ? this.doorOpen * (DOOR_W / 2 - 0.02) : 0;
        doors[i].position.x = s * (DOOR_W / 4) + s * shift;
      }
    }
  }

  /** Closed-door collision, per level, exported to the world collider lists. */
  doorColliders() {
    const out = [];
    for (const level of this.stops) {
      const open = this.currentLevel && level.id === this.currentLevel.id && this.doorOpen > 0.65;
      if (open) continue;
      out.push({
        levelId: level.id,
        minX: this.cx - DOOR_W / 2, maxX: this.cx + DOOR_W / 2,
        minZ: this.doorZ - 0.11, maxZ: this.doorZ + 0.11,
      });
    }
    return out;
  }

  _setIndicator(level) {
    for (const id of Object.keys(this.indicators)) {
      const ind = this.indicators[id];
      if (level && id === level.id) ind.setText(level.short);
      else if (this.state === 'moving') ind.setText('··');
      else ind.setText('--');
    }
    this.indicator.setText(level ? level.short : '--');
    for (const id of Object.keys(this.callPanels)) {
      const c = this.callPanels[id];
      const active = level && id === level.id;
      c.mat.emissiveIntensity = active ? 2.4 : 0.5;
    }
    for (const id of Object.keys(this.stopButtons || {})) {
      const s = this.stopButtons[id];
      s.mat.emissiveIntensity = (level && id === level.id) ? 1.8 : 0.25;
    }
  }

  canReach(levelId) { return this.stops.some((s) => s.id === levelId); }

  call(levelId) {
    if (!this.canReach(levelId)) return false;
    const stop = LEVEL_BY_ID[levelId];
    if (!stop) return false;
    this.onSound('call', this);
    if (Math.abs(this.y - stop.y) < 0.05 && this.state !== 'moving') {
      this.targetY = stop.y;
      this.currentLevel = stop;
      this.state = 'doorsOpening';
      this.doorTarget = 1;
      this._setIndicator(stop);
      this.onSound('bell', this);
      return true;
    }
    this.pendingStop = stop;
    if (this.doorOpen > 0.02) {
      this.state = 'doorsClosing';
      this.doorTarget = 0;
    } else {
      this._beginTravel(stop);
    }
    return true;
  }

  _beginTravel(stop) {
    this.currentLevel = null;
    this.targetY = stop.y;
    this.pendingStop = stop;
    this.state = 'moving';
    this.onSound('motor', this);
    this._setIndicator(null);
  }

  update(dt) {
    if (this.state === 'doorsOpening') {
      this.doorOpen = Math.min(1, this.doorOpen + dt * 1.2);
      this.setDoors(this.doorOpen);
      if (this.doorOpen >= 1) this.state = 'open';
    } else if (this.state === 'open') {
      // stay open
    } else if (this.state === 'doorsClosing') {
      this.doorOpen = Math.max(0, this.doorOpen - dt * 1.4);
      this.setDoors(this.doorOpen);
      if (this.doorOpen <= 0) {
        if (this.pendingStop && Math.abs(this.pendingStop.y - this.y) > 0.05) this._beginTravel(this.pendingStop);
        else { this.state = 'idle'; this.currentLevel = this.levelAtY(this.y); this._setIndicator(this.currentLevel); }
      }
    } else if (this.state === 'moving') {
      const dir = Math.sign(this.targetY - this.y);
      this.velocity = damp(this.velocity, 2.4, 3.2, dt);
      this.y += dir * this.velocity * dt;
      if ((dir > 0 && this.y >= this.targetY) || (dir < 0 && this.y <= this.targetY) || Math.abs(this.targetY - this.y) < 0.02) {
        this.y = this.targetY;
        this.currentLevel = this.levelAtY(this.y);
        this.velocity = 0;
        this.state = 'doorsOpening';
        this.doorTarget = 1;
        this.pendingStop = null;
        this.onSound('bell', this);
        this._setIndicator(this.currentLevel);
      }
      this.group.position.y = this.y;
      return dir * this.velocity;
    }
    this.group.position.set(this.cx, this.y, this.cz);
    return 0;
  }

  isInside(x, z, y) {
    return Math.abs(x - this.cx) < this.innerW / 2 - 0.05 &&
      Math.abs(z - this.cz) < this.innerD / 2 - 0.05 &&
      Math.abs(y - this.y) < 1.6;
  }

}


export function createElevators(opts) {
  return opts.configs.map((cfg) => new Elevator(cfg, opts));
}
