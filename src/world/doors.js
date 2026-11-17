import * as THREE from 'three';
import { mats } from './materials.js';
import { TILE } from './layout.js';

const DOOR_H = 2.06;
const DOOR_W = 0.98;

/**
 * A hinged door living inside a single doorway tile. Normal doors leave 50 cm
 * of wall on each side (jambs); wide doors are double leaves across the whole
 * tile. Locked doors refuse to open until the matching key is held.
 */
export class Door {
  constructor(opts) {
    this.id = opts.id;
    this.tx = opts.tx;
    this.tz = opts.tz;
    this.worldX = opts.worldX;
    this.worldZ = opts.worldZ;
    this.axis = opts.axis;           // 'x' or 'z' — direction you walk through
    this.wide = !!opts.wide;
    this.height = opts.height || 2.9;
    this.locked = !!opts.locked;
    this.keyId = opts.keyId || null;
    this.keyName = opts.keyName || 'Key';
    this.label = opts.label || 'Door';
    this.hidden = !!opts.hidden;
    this.exterior = !!opts.exterior;
    this.roomName = opts.roomName || '';
    this.swing = opts.swing || 1;
    this.angle = 0;
    this.target = 0;
    this.openAmount = 0;
    this.onSound = opts.onSound || (() => {});
    this.colliders = [];
    this.group = new THREE.Group();
    this.group.position.set(this.worldX, opts.y || 0, this.worldZ);
    // local +x runs across the doorway
    this.group.rotation.y = this.axis === 'z' ? 0 : Math.PI / 2;
    this._build(opts.wallMat || mats.plaster);
    this._updateCollider();
  }

  _build(wallMat) {
    const leafW = this.wide ? DOOR_W * 0.98 : DOOR_W;
    const jambW = this.wide ? (TILE - leafW * 2) / 2 : (TILE - leafW) / 2;
    const wallH = this.height || 2.9;

    const frameGeo = new THREE.BoxGeometry(1, 1, 1);
    const add = (mat, w, h, d, x, y, z) => {
      const mesh = new THREE.Mesh(frameGeo, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };

    // jambs (permanent — they also own collision)
    if (jambW > 0.02) {
      add(wallMat, jambW, wallH, 0.26, -(leafW + jambW) / 2, wallH / 2, 0);
      add(wallMat, jambW, wallH, 0.26, (leafW + jambW) / 2, wallH / 2, 0);
    }
    // lintel above the door
    add(wallMat, TILE, wallH - DOOR_H, 0.26, 0, DOOR_H + (wallH - DOOR_H) / 2, 0);
    // metal threshold + frame trim
    add(mats.metalDark, leafW + 0.08, 0.03, 0.3, 0, 0.015, 0);
    add(mats.metalDark, 0.055, DOOR_H, 0.09, -leafW / 2 - 0.02, DOOR_H / 2, 0);
    add(mats.metalDark, 0.055, DOOR_H, 0.09, leafW / 2 + 0.02, DOOR_H / 2, 0);

    // sign plate above the door
    if (this.roomName && !this.hidden) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1c231e'; ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = 'rgba(150,150,130,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, 248, 56);
      ctx.fillStyle = '#b8b49d';
      ctx.font = '600 20px "Courier New", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.roomName.slice(0, 20), 128, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.2 });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.165), mat);
      plate.position.set(0, 2.34, 0.135);
      this.group.add(plate);
    }

    // leaves
    this.leaves = [];
    const leafMat = this.exterior ? mats.metalDark : mats.woodDark;
    const makeLeaf = (hingeX, dir, leafW, h) => {
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, 0, 0);
      const leaf = new THREE.Group();
      const slab = add(leafMat, leafW, h, 0.055, (dir * leafW) / 2, h / 2, 0);
      slab.userData.leaf = true;
      // small window in some doors
      if (this.exterior || Math.random() > 0.72) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.55, h * 0.34, 0.02), mats.glassDirty);
        pane.position.set((dir * leafW) / 2, h * 0.68, 0.035);
        leaf.add(pane);
      }
      // handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), mats.steel);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(dir * (leafW - 0.12), h * 0.48, 0.06);
      leaf.add(handle);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.02), mats.metalDark);
      plate.position.set(dir * (leafW - 0.14), h * 0.48, 0.04);
      leaf.add(plate);
      pivot.add(leaf);
      pivot.userData.dir = dir;
      this.group.add(pivot);
      this.leaves.push(pivot);
      return pivot;
    };

    if (this.wide) {
      makeLeaf(-leafW, 1, leafW, DOOR_H);
      makeLeaf(leafW, -1, leafW, DOOR_H);
    } else {
      makeLeaf(-leafW / 2, 1, leafW, DOOR_H);
    }

    // collision for jambs (world space, computed from orientation)
    const halfSpan = TILE / 2;
    const jambSpan = jambW;
    if (jambSpan > 0.02) {
      this.jambColliders = [];
      for (const s of [-1, 1]) {
        const centre = s * ((leafW + jambW) / 2);
        if (this.axis === 'z') {
          this.jambColliders.push({
            minX: this.worldX + centre - jambW / 2, maxX: this.worldX + centre + jambW / 2,
            minZ: this.worldZ - 0.13, maxZ: this.worldZ + 0.13,
          });
        } else {
          this.jambColliders.push({
            minX: this.worldX - 0.13, maxX: this.worldX + 0.13,
            minZ: this.worldZ + centre - jambW / 2, maxZ: this.worldZ + centre + jambW / 2,
          });
        }
      }
    }
    this.halfSpan = halfSpan;
  }

  _updateCollider() {
    const open = this.openAmount > 0.45;
    this.colliders.length = 0;
    if (!open) {
      const w = this.wide ? TILE - 0.1 : DOOR_W;
      if (this.axis === 'z') {
        this.colliders.push({ minX: this.worldX - w / 2, maxX: this.worldX + w / 2, minZ: this.worldZ - 0.09, maxZ: this.worldZ + 0.09 });
      } else {
        this.colliders.push({ minX: this.worldX - 0.09, maxX: this.worldX + 0.09, minZ: this.worldZ - w / 2, maxZ: this.worldZ + w / 2 });
      }
    }
    if (this.jambColliders) this.colliders.push(...this.jambColliders);
  }

  get isOpen() { return this.openAmount > 0.45; }

  toggle(unlock = false) {
    if (this.locked && !unlock) {
      this.onSound('locked', this);
      return false;
    }
    this.target = this.target > 0.5 ? 0 : 1;
    this.onSound(this.target > 0.5 ? 'open' : 'close', this);
    return true;
  }

  unlock() {
    this.locked = false;
    this.onSound('unlock', this);
  }

  forceOpen() {
    this.locked = false;
    this.target = 1;
    this.onSound('open', this);
  }

  update(dt) {
    if (Math.abs(this.target - this.openAmount) > 0.001) {
      const speed = this.wide ? 1.35 : 1.6;
      this.openAmount += Math.sign(this.target - this.openAmount) * Math.min(Math.abs(this.target - this.openAmount), dt * speed);
      const eased = this.openAmount * this.openAmount * (3 - 2 * this.openAmount);
      for (const leaf of this.leaves) {
        leaf.rotation.y = leaf.userData.dir * this.swing * eased * (Math.PI * 0.52);
      }
      this._updateCollider();
      this.updateMeshInteract();
    }
  }

  updateMeshInteract() {
    if (this.mesh) this.mesh.userData.door = this;
  }

  /** Meshes that should be raycastable for interaction. */
  registerInteractive(list) {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.userData.door = this;
        list.push(o);
      }
    });
    this.mesh = this.group.children[this.group.children.length - 1];
  }
}
