import * as THREE from 'three';
import {
  GRID_W, GRID_H, TILE, WORLD_W, WORLD_H, worldX, worldZ, tileX, tileZ, LEVEL_BY_ID, LEVELS,
} from '../world/layout.js';
import { clamp, damp, lerp, angleDelta } from '../core/utils.js';

function gridWalkable(level, tx, tz) {
  if (!level || tx < 0 || tz < 0 || tx >= GRID_W || tz >= GRID_H) return false;
  const i = tz * GRID_W + tx;
  if (level.grid[i] === 0) return false;
  return !level.navBlocked.has(i) || level.grid[i] === 3;
}

function doorBlocking(level, tx, tz) {
  for (const d of level.doors) {
    if (d.tx === tx && d.tz === tz) return d;
  }
  return null;
}

function astar(level, start, goal) {
  if (!level) return null;
  const key = (x, z) => z * GRID_W + x;
  const open = [{ x: start.x, z: start.z, g: 0, f: 0 }];
  const best = new Map([[key(start.x, start.z), 0]]);
  const came = new Map();
  const closed = new Set();
  let guard = 0;
  while (open.length && guard++ < 9000) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    const ck = key(cur.x, cur.z);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === goal.x && cur.z === goal.z) {
      const path = [];
      let k = ck;
      while (k !== undefined) {
        path.push({ x: k % GRID_W, z: Math.floor(k / GRID_W) });
        k = came.get(k);
      }
      return path.reverse();
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (!gridWalkable(level, nx, nz)) continue;
      if (dx && dz) {
        if (!gridWalkable(level, cur.x + dx, cur.z) || !gridWalkable(level, cur.x, cur.z + dz)) continue;
      }
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const step = dx && dz ? 1.414 : 1;
      const g = cur.g + step;
      if (best.has(nk) && best.get(nk) <= g) continue;
      best.set(nk, g);
      came.set(nk, ck);
      const h = Math.abs(nx - goal.x) + Math.abs(nz - goal.z);
      open.push({ x: nx, z: nz, g, f: g + h });
    }
  }
  return null;
}

function lineOfSight(level, a, b) {
  // grid march from a to b in tile space
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = lerp(a.x, b.x, t);
    const z = lerp(a.z, b.z, t);
    const tx = Math.floor(x), tz = Math.floor(z);
    const i2 = tz * GRID_W + tx;
    if (level.grid[i2] === 0) return false;
    const d = doorBlocking(level, tx, tz);
    if (d && d.openAmount < 0.4) return false;
  }
  return true;
}

export class Entity {
  constructor(world, audio, opts = {}) {
    this.world = world;
    this.audio = audio;
    this.onAttack = opts.onAttack || (() => {});
    this.onSeen = opts.onSeen || (() => {});
    this.group = new THREE.Group();
    this.buildModel();
    this.audible = false;
    this.state = 'dormant';
    this.levelId = 'f1';
    this.position = new THREE.Vector3(0, 5, -20);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.path = null;
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.stateTimer = 0;
    this.target = null;
    this.lastKnown = null;
    this.suspicion = 0;
    this.attackCooldown = 0;
    this.stepTimer = 0;
    this.stepPhase = 0;
    this.active = false;
    this.speed = 1.0;
    this.hidden = true;
    this.seenOnce = false;
    this.relocateTimer = 0;
    this.group.visible = false;
  }

  buildModel() {
    const skin = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 1, metalness: 0 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x0b0d0e, roughness: 0.98, metalness: 0 });
    const pale = new THREE.MeshStandardMaterial({ color: 0x8f8d80, roughness: 0.85, metalness: 0, emissive: 0x141412, emissiveIntensity: 0.3 });
    const body = new THREE.Group();

    // torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.66, 0.24), cloth);
    torso.position.y = 1.18;
    body.add(torso);
    // hips
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.22), cloth);
    hips.position.y = 0.83;
    body.add(hips);
    // head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.25, 0.21), skin);
    head.position.y = 1.64;
    body.add(head);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), pale);
    face.position.set(0, 1.64, 0.107);
    body.add(face);
    const socket = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    socket.position.set(0, 1.68, 0.11);
    body.add(socket);
    // neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 6), skin);
    neck.position.y = 1.49;
    body.add(neck);

    // limbs on pivots
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    const armGeo = new THREE.BoxGeometry(0.09, 0.62, 0.09);
    const upper = new THREE.Mesh(armGeo, skin);
    upper.position.y = -0.31;
    this.armL.add(upper);
    this.armR.add(upper.clone());
    this.armL.position.set(-0.27, 1.42, 0);
    this.armR.position.set(0.27, 1.42, 0);
    body.add(this.armL, this.armR);

    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    const legGeo = new THREE.BoxGeometry(0.12, 0.82, 0.12);
    const thigh = new THREE.Mesh(legGeo, cloth);
    thigh.position.y = -0.41;
    this.legL.add(thigh);
    this.legR.add(thigh.clone());
    this.legL.position.set(-0.1, 0.82, 0);
    this.legR.position.set(0.1, 0.82, 0);
    body.add(this.legL, this.legR);

    // tattered gown
    const gownMat = new THREE.MeshStandardMaterial({ color: 0x1a1d1b, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5), gownMat);
      strip.position.set(-0.24 + i * 0.12, 0.62, 0.12);
      strip.rotation.x = 0.06;
      body.add(strip);
    }

    body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    this.body = body;
    this.group.add(body);
    this.group.scale.setScalar(1.02);
  }

  activate(levelId, tx, tz) {
    this.active = true;
    this.hidden = false;
    this.levelId = levelId;
    const level = this.world.levels[levelId];
    this.position.set(worldX(tx), level.y, worldZ(tz));
    this.state = 'wander';
    this.stateTimer = 2;
    this.suspicion = 0;
    this.path = null;
    this.group.visible = false;
    this._level();
  }

  deactivate() {
    this.active = false;
    this.state = 'dormant';
    this.group.visible = false;
  }

  _level() {
    return this.world.levels[this.levelId];
  }

  hearNoise(x, z, strength) {
    if (!this.active) return;
    const d = Math.hypot(x - this.position.x, z - this.position.z);
    if (d > 26 * strength) return;
    this.lastKnown = { x, z };
    if (this.state === 'wander' || this.state === 'observe') {
      this.state = 'investigate';
      this.stateTimer = 22;
      this.path = null;
    } else if (this.state === 'investigate') {
      this.path = null;
    }
  }

  _pickWanderTarget() {
    const level = this._level();
    if (!level || !level.rooms) return null;
    const rooms = level.rooms.filter((r) => !r.open);
    const r = rooms[Math.floor(Math.random() * rooms.length)];
    if (!r) return null;
    const tx = Math.floor(lerp(r.x1 + 0.5, r.x2 - 0.5, Math.random()));
    const tz = Math.floor(lerp(r.z1 + 0.5, r.z2 - 0.5, Math.random()));
    return { x: tx, z: tz };
  }

  _canSee(player) {
    const level = this._level();
    if (!level) return false;
    if (player.hiding) return false;
    if (Math.abs(player.feetY - level.y) > 2.5) return false;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const maxDist = this.state === 'chase' ? 30 : 20;
    if (dist > maxDist) return false;
    // field of view (wider when it already knows you are there)
    const facing = Math.atan2(-dx, -dz);
    const delta = Math.abs(angleDelta(this.yaw, facing));
    const fov = this.state === 'chase' ? Math.PI * 0.85 : Math.PI * 0.42;
    if (delta > fov && dist > 2.2) return false;
    if (player.crouching && dist > 8) return false;
    const a = { x: tileX(player.position.x), z: tileZ(player.position.z) };
    const b = { x: tileX(this.position.x), z: tileZ(this.position.z) };
    if (!lineOfSight(level, a, b)) return false;
    return true;
  }

  update(dt, player, game) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (!this.active) return;
    const level = this._level();
    if (!level) return;

    // stay on the player's floor (it uses the stairs when out of sight)
    if (level.id !== player.levelId && this.state !== 'chase') {
      this.relocateTimer += dt;
      if (this.relocateTimer > 7) {
        this.relocateTimer = 0;
        this._relocate(player);
      }
    } else {
      this.relocateTimer = 0;
    }

    const canSee = this._canSee(player);
    if (canSee) {
      this.suspicion = clamp(this.suspicion + dt * 1.6, 0, 1.2);
      this.lastKnown = { x: player.position.x, z: player.position.z };
      if (!this.seenOnce) {
        this.seenOnce = true;
        this.onSeen();
      }
      if (this.suspicion > 0.75 || this.state === 'chase') {
        if (this.state !== 'chase') {
          this.state = 'chase';
          this.audio.sting();
          this.onChaseStart?.();
        }
        this.stateTimer = 6;
      } else if (this.state === 'wander') {
        this.state = 'observe';
        this.stateTimer = 3.5;
      }
    } else {
      this.suspicion = clamp(this.suspicion - dt * 0.28, 0, 1.2);
      if (this.state === 'chase') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.state = 'hunt';
      }
    }

    this.stateTimer -= dt;
    switch (this.state) {
      case 'observe': this.velocity.multiplyScalar(0.8); if (this.stateTimer <= 0) this.state = 'wander'; break;
      case 'chase': this.speed = 2.55; this._moveToward(player.position.x, player.position.z, dt, level); break;
      case 'hunt':
        this.speed = 1.85;
        if (this.lastKnown) {
          if (this._moveToward(this.lastKnown.x, this.lastKnown.z, dt, level, 0.9)) {
            this.state = 'search';
            this.stateTimer = 8;
            this.path = null;
          }
        } else this.state = 'wander';
        break;
      case 'investigate':
        this.speed = 1.25;
        if (this.lastKnown) {
          if (this._moveToward(this.lastKnown.x, this.lastKnown.z, dt, level, 0.9)) {
            this.state = 'search';
            this.stateTimer = 7;
          }
        } else this.state = 'wander';
        if (this.stateTimer <= 0) this.state = 'wander';
        break;
      case 'search': {
        this.speed = 1.15;
        if (this.stateTimer <= 0) { this.state = 'wander'; this.path = null; }
        else if (!this.path) {
          const spot = this.lastKnown || { x: this.position.x + (Math.random() - 0.5) * 8, z: this.position.z + (Math.random() - 0.5) * 8 };
          this._pathTo(spot.x + (Math.random() - 0.5) * 6, spot.z + (Math.random() - 0.5) * 6, level);
        }
        this._follow(dt, level);
        break;
      }
      case 'wander':
      default: {
        this.speed = 0.62;
        if (!this.path || this.pathIndex >= this.path.length) {
          const t = this._pickWanderTarget();
          if (t) this._pathTo(worldX(t.x), worldZ(t.z), level);
          else this.velocity.multiplyScalar(0.9);
          this.stateTimer = 6 + Math.random() * 10;
        }
        this._follow(dt, level);
        if (this.stateTimer <= 0) this.path = null;
        break;
      }
    }

    // rotate toward movement
    if (this.velocity.lengthSq() > 0.05) {
      const desired = Math.atan2(-this.velocity.x, -this.velocity.z);
      this.yaw += angleDelta(this.yaw, desired) * Math.min(1, dt * 4.5);
    } else if (canSee) {
      const desired = Math.atan2(-(player.position.x - this.position.x), -(player.position.z - this.position.z));
      this.yaw += angleDelta(this.yaw, desired) * Math.min(1, dt * 2.2);
    }

    // gravity/ground
    const ground = this.world.sampleGround(this.position.x, this.position.z, this.position.y);
    if (ground) this.position.y = lerp(this.position.y, ground.y, 1 - Math.exp(-12 * dt));

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // gait animation
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.stepPhase += dt * (speed * 3.4 + 0.4);
    const swing = Math.min(0.8, speed * 0.28);
    this.legL.rotation.x = Math.sin(this.stepPhase) * swing;
    this.legR.rotation.x = -Math.sin(this.stepPhase) * swing;
    this.armL.rotation.x = -Math.sin(this.stepPhase) * swing * 0.7;
    this.armR.rotation.x = Math.sin(this.stepPhase) * swing * 0.7;
    this.body.position.y = Math.sin(this.stepPhase * 2) * 0.02;
    this.body.rotation.z = Math.sin(this.stepPhase) * 0.02;

    // footsteps
    if (speed > 0.3) {
      this.stepTimer -= dt * speed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 1.6;
        const d = this.position.distanceTo(player.position);
        this.audio.entityStep(Math.max(-1, Math.min(1, (this.position.x - player.position.x) / 10)), d * 0.3);
      }
    } else if (canSee && Math.random() < dt * 0.25) {
      this.audio.entityBreath(0, 1);
    }

    // attack
    const dist = this.position.distanceTo(player.position);
    if (dist < 1.35 && this.attackCooldown <= 0 && this.state === 'chase' && !player.hiding) {
      this.attackCooldown = 3;
      this.onAttack();
    }

    // reveal only when it should be seen
    this.group.visible = this.active && Math.abs(this.position.y - player.camera.position.y) < 9;
  }

  _relocate(player) {
    const level = this.world.levels[player.levelId];
    if (!level || level.isRoof) return;
    this.levelId = player.levelId;
    const rooms = (level.rooms || []).filter((r) => !r.open);
    let best = null, bestD = -1;
    for (const r of rooms) {
      const cx = worldX((r.x1 + r.x2) / 2), cz = worldZ((r.z1 + r.z2) / 2);
      const d = Math.hypot(cx - player.position.x, cz - player.position.z);
      if (d > bestD && d < 55) { bestD = d; best = { x: cx, z: cz }; }
    }
    if (best) {
      this.position.set(best.x, level.y, best.z);
      this.path = null;
      this.state = 'wander';
    }
  }

  _pathTo(x, z, level) {
    const start = { x: Math.round(tileX(this.position.x)), z: Math.round(tileZ(this.position.z)) };
    const goal = { x: Math.round(tileX(x)), z: Math.round(tileZ(z)) };
    if (!gridWalkable(level, goal.x, goal.z)) return false;
    const path = astar(level, start, goal);
    if (!path || path.length < 2) { this.path = null; return false; }
    this.path = path;
    this.pathIndex = 1;
    return true;
  }

  _moveToward(x, z, dt, level, threshold = 0.8) {
    if (Math.hypot(x - this.position.x, z - this.position.z) < threshold) {
      this.velocity.multiplyScalar(0.6);
      return true;
    }
    this.repathTimer -= dt;
    if (!this.path || this.repathTimer <= 0) {
      this.repathTimer = 0.8;
      this._pathTo(x, z, level);
    }
    this._follow(dt, level);
    return false;
  }

  _follow(dt, level) {
    if (!this.path || this.pathIndex >= this.path.length) {
      this.velocity.multiplyScalar(0.85);
      return;
    }
    const node = this.path[this.pathIndex];
    const wx = worldX(node.x), wz = worldZ(node.z);
    const dx = wx - this.position.x, dz = wz - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.55) { this.pathIndex++; return; }
    // open a closed door we are about to walk through
    const door = doorBlocking(level, node.x, node.z);
    if (door && door.openAmount < 0.5) {
      if (door.locked) {
        // locked: path is invalid, pick another
        this.path = null;
        this.velocity.multiplyScalar(0.5);
        return;
      }
      door.forceOpen();
      this.audio.doorOpen(0);
    }
    const speed = this.speed;
    this.velocity.x = (dx / d) * speed;
    this.velocity.z = (dz / d) * speed;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
  }

  /** Distance to player, used by the director + audio. */
  distanceTo(player) {
    return this.position.distanceTo(player.position);
  }

  teleportAway(player) {
    this.state = 'hunt';
    this.lastKnown = null;
    this.path = null;
    this._relocate(player);
    this.suspicion = 0;
  }
}


