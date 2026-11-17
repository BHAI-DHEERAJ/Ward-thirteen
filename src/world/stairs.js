import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mats } from './materials.js';
import { TILE, LEVEL_BY_ID, worldX, worldZ } from './layout.js';
import { clamp, lerp } from '../core/utils.js';

const HALF_RISE = 2.5;

/**
 * One continuously traversable staircase shaft.
 *
 * Each floor pair is a dog-leg: landing (floor level) → flight A (half level) →
 * mid landing → flight B (next floor). Flights alternate lanes, so the shaft is
 * a stack of switchbacks and the player can walk from W13 to the roof without
 * any loading or teleporting.
 */
export class StairShaft {
  constructor(config, opts = {}) {
    this.id = config.id;
    this.cfg = config;
    this.levels = config.levels.map((id) => LEVEL_BY_ID[id]).filter(Boolean);
    this.levelsByY = [...this.levels].sort((a, b) => a.y - b.y);
    this.group = new THREE.Group();
    this.colliders = [];
    this.partsByLevel = {};
    this._buildGeometry(opts);
  }

  worldRect() {
    const c = this.cfg;
    return {
      minX: c.x1 * TILE - 48, maxX: (c.x2 + 1) * TILE - 48,
      minZ: c.z1 * TILE - 40, maxZ: (c.z2 + 1) * TILE - 40,
    };
  }

  _buildGeometry(opts) {
    const c = this.cfg;
    const x1 = c.x1 * TILE - 48, x2 = (c.x2 + 1) * TILE - 48;
    const zLand0 = c.landing[0] * TILE - 40, zLand1 = c.landing[1] * TILE - 40;
    const zA0 = c.flightA[0] * TILE - 40, zA1 = c.flightA[1] * TILE - 40;
    const zM0 = c.mid[0] * TILE - 40, zM1 = c.mid[1] * TILE - 40;
    const laneA = [c.laneA[0] * TILE - 48, c.laneA[1] * TILE - 48];
    const laneB = [c.laneB[0] * TILE - 48, c.laneB[1] * TILE - 48];
    const midX = (laneA[1] + laneB[0]) / 2;

    const stepMat = mats.concreteFloor;
    const railMat = mats.rust;

    const buckets = new Map();
    const add = (mat, geo, matrix) => {
      const g = geo.clone();
      g.applyMatrix4(matrix);
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(g);
    };
    const box = (mat, w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Matrix4().makeTranslation(x, y, z);
      add(mat, g, m);
    };

    const sorted = [...this.levelsByY];
    for (let i = 0; i < sorted.length; i++) {
      const level = sorted[i];
      this.partsByLevel[level.id] = new THREE.Group();
      // landing at this level (z landing range)
      box(stepMat, x2 - x1, 0.3, zLand1 - zLand0, (x1 + x2) / 2, level.y - 0.15, (zLand0 + zLand1) / 2);
      // handrail around the landing edge
      box(railMat, 0.05, 1.05, 0.05, x1 + 0.06, level.y + 0.5, zLand1 - 0.1);
      box(railMat, 0.05, 1.05, 0.05, x2 - 0.06, level.y + 0.5, zLand1 - 0.1);
      box(railMat, x2 - x1, 0.05, 0.05, (x1 + x2) / 2, level.y + 1.02, zLand1 - 0.1);

      const lower = sorted[i - 1];
      if (!lower) continue;
      const drop = level.y - lower.y;
      const flightTop = level.y;
      const flightBottom = level.y - drop / 2;

      // flight A — lane A, descending north → south (zA0 to zA1)
      this._flight(
        (mat, g, m) => add(mat, g, m),
        { x0: laneA[0], x1: laneA[1], z0: zA0, z1: zA1, yTop: flightTop, yBottom: flightBottom, mat: stepMat, rail: railMat }
      );
      // mid landing
      box(stepMat, x2 - x1, 0.3, zM1 - zM0, (x1 + x2) / 2, flightBottom - 0.15, (zM0 + zM1) / 2);
      box(railMat, 0.05, 1.05, 0.05, x1 + 0.06, flightBottom + 0.5, zM0 + 0.1);
      box(railMat, 0.05, 1.05, 0.05, x2 - 0.06, flightBottom + 0.5, zM0 + 0.1);
      // flight B — lane B, descending south → north (zM1 to zA0)
      this._flight(
        (mat, g, m) => add(mat, g, m),
        { x0: laneB[0], x1: laneB[1], z0: zM1, z1: zM0 - 2, yTop: flightBottom, yBottom: lower.y, mat: stepMat, rail: railMat }
      );
      // divider between the two flights
      box(mats.concreteWall, 0.12, 1.02, Math.abs(zM1 - zLand1) - 0.2, midX, (level.y + lower.y) / 2 + 0.9, (zLand1 + zM1) / 2);
    }

    for (const [mat, list] of buckets) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    // floor-level colliders for shaft walls are built by the World (room walls)
    this.rect = { x1, x2, z0: zLand0, z1: zM1, laneA, laneB, zLand1, zM0, zM1, zA0, zA1, midX };
    this._computeSurfaces();
  }

  _flight(add, o) {
    const run = Math.abs(o.z1 - o.z0);
    const rise = o.yTop - o.yBottom;
    const steps = Math.max(8, Math.round(run / 0.7));
    const tread = run / steps;
    const dir = Math.sign(o.z0 - o.z1) || 1; // descending direction along z
    const sign = o.z1 > o.z0 ? 1 : -1;
    for (let s = 0; s < steps; s++) {
      const z = o.z0 + sign * (s + 0.5) * tread;
      const y = o.yTop - (rise * (s + 0.5)) / steps;
      const g = new THREE.BoxGeometry(o.x1 - o.x0, Math.abs(rise / steps) + 0.06, tread);
      const m = new THREE.Matrix4().makeTranslation((o.x0 + o.x1) / 2, y - 0.03, z);
      add(o.mat, g, m);
    }
    // steel handrail following the flight
    const railLen = Math.hypot(run, rise);
    const angle = Math.atan2(rise, run) * (o.z1 > o.z0 ? 1 : -1);
    const g = new THREE.BoxGeometry(0.045, 0.045, railLen);
    const m = new THREE.Matrix4().makeTranslation(
      (o.x0 + o.x1) / 2 + (o.x1 - o.x0) / 2 - 0.05,
      (o.yTop + o.yBottom) / 2 + 1.0,
      (o.z0 + o.z1) / 2
    );
    const rot = new THREE.Matrix4().makeRotationX(-angle);
    m.multiply(rot);
    add(o.rail, g, m);
    // stringer wall under the rail
    const sw = new THREE.BoxGeometry(0.1, 1.0, railLen);
    const sm = new THREE.Matrix4().makeTranslation(
      (o.x0 + o.x1) / 2 + (o.x1 - o.x0) / 2 - 0.05,
      (o.yTop + o.yBottom) / 2 + 0.5,
      (o.z0 + o.z1) / 2
    );
    sm.multiply(new THREE.Matrix4().makeRotationX(-angle));
    add(o.rail, sw, sm);
    void dir;
  }

  _computeSurfaces() {
    this.levelsByY = [...this.levels].sort((a, b) => a.y - b.y);
    this.surfaces = [];
    const r = this.rect;
    for (const level of this.levelsByY) {
      this.surfaces.push({ kind: 'landing', y: level.y, x0: r.x1, x1: r.x2, z0: r.z0, z1: r.zLand1, level });
      const lower = this.levelsByY[this.levelsByY.indexOf(level) - 1];
      if (!lower) continue;
      const midY = level.y - (level.y - lower.y) / 2;
      this.surfaces.push({
        kind: 'flightA', x0: r.laneA[0], x1: r.laneA[1], z0: Math.min(r.zLand1, r.zM0), z1: Math.max(r.zLand1, r.zM0),
        yAt: (z) => lerp(level.y, midY, clamp((z - r.zLand1) / (r.zM0 - r.zLand1), 0, 1)),
      });
      this.surfaces.push({ kind: 'mid', y: midY, x0: r.x1, x1: r.x2, z0: r.zM0, z1: r.zM1 });
      this.surfaces.push({
        kind: 'flightB', x0: r.laneB[0], x1: r.laneB[1], z0: Math.min(r.zM1, r.zA0), z1: Math.max(r.zM1, r.zA0),
        yAt: (z) => lerp(midY, lower.y, clamp((r.zM1 - z) / (r.zM1 - r.zA0), 0, 1)),
      });
    }
  }

  /** Returns the best walkable surface at (x,z) at or below y+0.85. */
  sample(x, z, y) {
    const r = this.rect;
    if (x < r.x1 - 0.1 || x > r.x2 + 0.1 || z < r.z0 - 0.1 || z > r.z1 + 0.1) return null;
    let best = null;
    for (const s of this.surfaces) {
      if (x < s.x0 - 0.05 || x > s.x1 + 0.05) continue;
      if (z < s.z0 - 0.05 || z > s.z1 + 0.05) continue;
      const yy = s.yAt ? s.yAt(z) : s.y;
      if (yy > y + 0.85) continue;
      if (!best || yy > best.y) best = { y: yy, kind: s.kind };
    }
    return best;
  }

  isInside(x, z) {
    const r = this.rect;
    return x >= r.x1 && x <= r.x2 && z >= r.z0 && z <= r.z1;
  }

  levelForY(y) {
    let best = this.levelsByY[0];
    let d = Infinity;
    for (const l of this.levelsByY) {
      const dd = Math.abs(l.y - y);
      if (dd < d) { d = dd; best = l; }
    }
    return best;
  }
}
