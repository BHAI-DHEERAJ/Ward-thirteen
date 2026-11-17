import * as THREE from 'three';
import { worldX, worldZ, tileX, tileZ, TILE, LEVEL_BY_ID } from '../world/layout.js';
import { clamp, lerp, Rng } from '../core/utils.js';

/**
 * The director decides when the hospital is allowed to frighten you. It keeps
 * a tension budget: after a scare it goes quiet for minutes, and it only
 * stages events in places you can actually perceive.
 */
export class Director {
  constructor(game) {
    this.game = game;
    this.rng = new Rng(1313);
    this.cooldown = 22;
    this.tension = 0;
    this.surge = 0;
    this.lastEvent = '';
    this.figures = [];
    this.eventLog = [];
    this.enabled = true;
    this.crossingCooldown = 0;
  }

  update(dt) {
    const game = this.game;
    if (!game || game.mode !== 'playing' || !this.enabled) return;
    this.surge = Math.max(0, this.surge - dt);
    this.cooldown -= dt;
    this._updateFigures(dt);

    const player = game.player;
    const entity = game.entity;
    const chasing = entity?.active && (entity.state === 'chase' || entity.state === 'hunt');
    if (chasing) { this.cooldown = Math.max(this.cooldown, 20); return; }

    // ambient thunder outdoors
    if (!this._thunderTimer) this._thunderTimer = 14 + Math.random() * 30;
    this._thunderTimer -= dt;
    if (this._thunderTimer <= 0) {
      this._thunderTimer = 18 + Math.random() * 45;
      const inside = game.isInside();
      game.audio.thunder(inside ? 3.2 : 0.8);
      if (!inside) game.flashScreen?.(0.0);
    }

    if (this.cooldown > 0) return;
    if (player.hiding) { this.cooldown = 6; return; }
    this.cooldown = 26 + this.rng.range(0, 44);
    this._chooseEvent();
  }

  _chooseEvent() {
    const game = this.game;
    const player = game.player;
    const level = game.world.levels[player.levelId];
    if (!level || level.isRoof) return;
    const roll = this.rng.next();
    const near = this._findCrossingSpot();
    if (roll > 0.9 && this.elevatorEvent()) return;
    if (near && roll < 0.42) return this.crossing(near);
    if (roll < 0.55) return this.standingFigure(near);
    if (roll < 0.68) return this.distantSteps();
    if (roll < 0.78) return this.whisper();
    if (roll < 0.87) return this.flickerSurge();
    if (roll < 0.94) return this.doorSlam();
    return this.tvStatic();
  }

  _findCrossingSpot() {
    const game = this.game;
    const p = game.player;
    const level = game.world.levels[p.levelId];
    if (!level || level.isRoof) return null;
    // look down the corridor in the direction the player faces
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    for (let dist = 9; dist < 26; dist += 3) {
      for (const side of [-1, 1]) {
        const x = p.position.x + fx * dist + -fz * side * 2.2;
        const z = p.position.z + fz * dist + fx * side * 2.2;
        const tx = Math.floor(tileX(x)), tz = Math.floor(tileZ(z));
        if (tx < 0 || tz < 0 || tx >= 48 || tz >= 40) continue;
        if (level.grid[tz * 48 + tx] === 0) continue;
        const room = level.roomMap[tz * 48 + tx];
        if (!room) continue;
        if (room.id !== 'corridor' && !room.open) continue;
        // check the tile is visible from the player roughly
        const toX = x - p.position.x, toZ = z - p.position.z;
        const len = Math.hypot(toX, toZ);
        if ((toX * fx + toZ * fz) / len < 0.55) continue;
        return { x, z, y: level.y, levelId: level.id };
      }
    }
    return null;
  }

  _shadowFigure(opacity = 1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.22), mat);
    body.position.y = 1.18;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat);
    head.position.y = 1.65;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.2), mat);
    legs.position.y = 0.42;
    const arms = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.12), mat);
    arms.position.y = 1.32;
    g.add(body, head, legs, arms);
    g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    return g;
  }

  crossing(spot) {
    const game = this.game;
    const fig = this._shadowFigure(0.92);
    fig.position.set(spot.x, spot.y, spot.z);
    game.world.root.add(fig);
    const dir = this.rng.sign();
    const perp = { x: -Math.sin(game.player.yaw + Math.PI / 2), z: -Math.cos(game.player.yaw + Math.PI / 2) };
    // cross perpendicular to the view direction
    const from = { x: spot.x - perp.x * dir * 3.4, z: spot.z - perp.z * dir * 3.4 };
    const to = { x: spot.x + perp.x * dir * 3.4, z: spot.z + perp.z * dir * 3.4 };
    fig.position.set(from.x, spot.y, from.z);
    this.figures.push({ obj: fig, mode: 'cross', t: 0, dur: 1.15, from, to, levelId: spot.levelId });
    game.audio.entityStep(0, 6);
    setTimeout(() => game.audio.entityStep(dir * 0.6, 4), 300);
    setTimeout(() => { game.noiseAt(spot.x, spot.z, 0.2); }, 500);
    this.lastEvent = 'crossing';
  }

  standingFigure(spot) {
    if (!spot) return this.distantSteps();
    const game = this.game;
    const fig = this._shadowFigure(0.8);
    const yawToPlayer = Math.atan2(-(game.player.position.x - spot.x), -(game.player.position.z - spot.z));
    fig.position.set(spot.x, spot.y, spot.z);
    fig.rotation.y = yawToPlayer;
    game.world.root.add(fig);
    this.figures.push({ obj: fig, mode: 'stand', t: 0, dur: 999, levelId: spot.levelId, fadeAfter: 2.4, spot });
    this.lastEvent = 'standing';
  }

  distantSteps() {
    const game = this.game;
    const pan = this.rng.range(-0.9, 0.9);
    for (let i = 0; i < 7; i++) {
      setTimeout(() => game.audio.entityStep(pan * (1 - i / 9), 7), i * 420);
    }
    this.lastEvent = 'steps';
  }

  whisper() {
    const game = this.game;
    game.audio.whisper(this.rng.range(-0.8, 0.8));
    setTimeout(() => game.audio.whisper(this.rng.range(-0.8, 0.8)), 1500);
    this.lastEvent = 'whisper';
  }

  flickerSurge() {
    const game = this.game;
    this.surge = 2.2;
    game.world.surge = 2.6;
    game.audio.electrical();
    setTimeout(() => game.audio.electrical(), 700);
    setTimeout(() => game.audio.metalImpact(0.4), 1400);
    this.lastEvent = 'flicker';
  }

  doorSlam() {
    const game = this.game;
    const p = game.player;
    const level = game.world.levels[p.levelId];
    if (!level) return;
    let best = null, bestD = 99;
    for (const d of level.doors) {
      const dist = Math.hypot(d.worldX - p.position.x, d.worldZ - p.position.z);
      if (dist < 18 && dist > 2 && dist < bestD) { bestD = dist; best = d; }
    }
    if (!best) return this.distantSteps();
    best.target = 0;
    best.openAmount = 0;
    best._updateCollider();
    game.audio.doorClose(0.3);
    game.audio.metalImpact(0.2);
    setTimeout(() => game.audio.rumble(), 300);
    this.lastEvent = 'slam';
  }

  tvStatic() {
    const game = this.game;
    game.audio.radioStatic(1.4);
    setTimeout(() => game.audio.whisper(0.2), 800);
    this.lastEvent = 'static';
  }

  /**
   * The lift comes down by itself, the doors open on an empty car, and then it
   * leaves again. It only bothers to do this when you are close enough to hear.
   */
  elevatorEvent() {
    const game = this.game;
    const p = game.player;
    if (!game.world.power) return false;
    let best = null, bestD = 14;
    for (const lift of game.world.elevators) {
      if (!lift.cfg.stops.includes(p.levelId)) continue;
      if (lift.isInside(p.position.x, p.position.z, p.feetY)) continue;
      const d = Math.hypot(lift.x - p.position.x, lift.z - p.position.z);
      if (d < bestD) { bestD = d; best = lift; }
    }
    if (!best) return false;
    if (best.currentLevel?.id === p.levelId) return false;
    best.call(p.levelId);
    this.lastEvent = 'elevator';
    setTimeout(() => {
      if (game.mode === 'playing') game.subtitle('The lift arrives. The car is empty.', 4);
    }, 2600);
    setTimeout(() => {
      if (game.mode === 'playing' && Math.hypot(best.x - p.position.x, best.z - p.position.z) > 2.5) {
        best.call(best.cfg.stops[0]);
      }
    }, 9000);
    return true;
  }

  _updateFigures(dt) {
    const game = this.game;
    for (let i = this.figures.length - 1; i >= 0; i--) {
      const f = this.figures[i];
      f.t += dt;
      if (f.mode === 'cross') {
        const t = clamp(f.t / f.dur, 0, 1);
        f.obj.position.x = lerp(f.from.x, f.to.x, t);
        f.obj.position.z = lerp(f.from.z, f.to.z, t);
        f.obj.position.y = (LEVEL_BY_ID[f.levelId]?.y ?? 0);
        if (t >= 1) {
          f.obj.visible = false;
          game.world.root.remove(f.obj);
          this.figures.splice(i, 1);
        }
      } else if (f.mode === 'stand') {
        // vanishes when the player looks away — or after a while
        const p = game.player;
        const dx = f.obj.position.x - p.position.x;
        const dz = f.obj.position.z - p.position.z;
        const dist = Math.hypot(dx, dz);
        const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        const looking = dist > 0.1 && (dx * fx + dz * fz) / dist > 0.75;
        if (!looking) f.lostSight = (f.lostSight || 0) + dt;
        if ((f.lostSight || 0) > 0.35 || f.t > 9) {
          f.obj.visible = false;
          game.world.root.remove(f.obj);
          this.figures.splice(i, 1);
          if (f.t > 0.3) game.audio.whisper(0);
        } else if (looking && f.t > 1.6 && !f.reacted) {
          f.reacted = true;
          game.audio.sting();
        }
      }
    }
  }

  clear() {
    for (const f of this.figures) this.game.world.root.remove(f.obj);
    this.figures.length = 0;
  }
}
