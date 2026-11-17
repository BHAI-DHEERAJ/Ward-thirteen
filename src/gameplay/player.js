import * as THREE from 'three';
import { clamp, damp, lerp, smoothstep } from '../core/utils.js';
import { worldX, worldZ, LEVEL_BY_ID, LEVELS } from '../world/layout.js';

const EYE = 1.64;
const CROUCH_EYE = 1.06;
const RADIUS = 0.34;

/**
 * Human-scale first-person movement: inertia, bob, crouch, sprint stamina,
 * footsteps that change with the floor, and a flashlight with a real battery.
 */
export class Player {
  constructor(camera, world, input, audio, settings) {
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.audio = audio;
    this.settings = settings;

    this.position = new THREE.Vector3(0, 0.02, 34);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.feetY = 0;
    this.eyeHeight = EYE;
    this.crouching = false;
    this.sprinting = false;
    this.stamina = 1;
    this.health = 100;
    this.alive = true;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.speed = 0;
    this.lastSurface = 'linoleum';
    this.stepTimer = 0;
    this.hiding = null;
    this.frozen = false;
    this.inElevator = null;
    this.currentLevelId = 'gf';
    this.roomsVisited = new Set();

    // flashlight
    this.flashOn = true;
    this.battery = 1;
    this.flashFlicker = 0;
    this._buildFlashlight();

    this.camera.rotation.order = 'YXZ';
  }

  _buildFlashlight() {
    this.spot = new THREE.SpotLight(0xfff2d8, 0, 26, 0.36, 0.55, 1.4);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.near = 0.4;
    this.spot.shadow.camera.far = 24;
    this.spot.shadow.bias = -0.0009;
    this.spot.shadow.normalBias = 0.03;
    this.spot.position.set(0.18, -0.12, 0.1);
    this.spot.target.position.set(0, -0.05, -8);
    this.fill = new THREE.PointLight(0xbfc9b8, 0.9, 4.5, 2);
    this.fill.position.set(0, -0.1, -0.4);
    this.camera.add(this.spot, this.spot.target, this.fill);
  }

  reset({ x, z, y, levelId, yaw = 0 }) {
    this.position.set(x, y ?? 0.02, z);
    this.feetY = y ?? 0;
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.stamina = 1;
    this.health = 100;
    this.alive = true;
    this.hiding = null;
    this.currentLevelId = levelId || 'gf';
    this.camera.position.set(x, this.feetY + EYE, z);
    this.camera.rotation.set(0, yaw, 0);
  }

  get levelId() {
    const world = this.world;
    let best = LEVELS[0], d = Infinity;
    for (const l of LEVELS) {
      const dd = Math.abs(l.y - this.feetY);
      if (dd < d) { d = dd; best = l; }
    }
    void world;
    return best.id;
  }

  get eyeY() { return this.feetY + this.eyeHeight; }

  setFlashlight(on) {
    this.flashOn = on;
    this.audio.flashlightClick();
  }

  toggleFlashlight() {
    if (this.battery <= 0) { this.audio.flashlightClick(); return; }
    this.setFlashlight(!this.flashOn);
  }

  recharge(amount = 0.4) {
    this.battery = clamp(this.battery + amount, 0, 1);
  }

  heal(amount = 35) {
    this.health = clamp(this.health + amount, 0, 100);
  }

  damage(amount) {
    this.health = clamp(this.health - amount, 0, 100);
    return this.health <= 0;
  }

  startHide(spot) {
    this.hiding = spot;
    this.velocity.set(0, 0, 0);
    this.audio.creak(0);
  }

  stopHide() {
    this.hiding = null;
  }

  update(dt, { uiBlocking = false } = {}) {
    const input = this.input;
    const settings = this.settings;

    if (!this.hiding && !this.frozen) {
      const sens = 0.0022 * (settings.sensitivity || 1);
      this.yaw -= input.mouse.dx * sens;
      this.pitch -= input.mouse.dy * sens * (settings.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.35, 1.35);
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let wish = new THREE.Vector3();
    if (!this.hiding && !this.frozen && !uiBlocking) {
      if (input.down('KeyW')) wish.add(forward);
      if (input.down('KeyS')) wish.sub(forward);
      if (input.down('KeyD')) wish.add(right);
      if (input.down('KeyA')) wish.sub(right);
    }
    if (wish.lengthSq() > 0) wish.normalize();

    const wantCrouch = !this.hiding && !uiBlocking && (input.down('ControlLeft') || input.down('ControlRight') || input.down('KeyC'));
    this.crouching = wantCrouch;
    const canSprint = !this.crouching && this.stamina > 0.02;
    this.sprinting = canSprint && !uiBlocking && (input.down('ShiftLeft') || input.down('ShiftRight')) && wish.lengthSq() > 0;

    const maxSpeed = this.crouching ? 1.35 : this.sprinting ? 4.55 : 2.65;
    const accel = this.crouching ? 8 : this.sprinting ? 6.5 : 10;
    const targetVel = wish.clone().multiplyScalar(maxSpeed);
    this.velocity.x = damp(this.velocity.x, targetVel.x, accel, dt);
    this.velocity.z = damp(this.velocity.z, targetVel.z, accel, dt);

    if (this.sprinting) {
      this.stamina = clamp(this.stamina - dt * 0.16, 0, 1);
      if (this.stamina <= 0.001) this.sprinting = false;
    } else {
      this.stamina = clamp(this.stamina + dt * (this.crouching ? 0.3 : 0.11), 0, 1);
    }

    // horizontal move with axis-separated collision
    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    if (dx) this._moveAxis(dx, 0);
    if (dz) this._moveAxis(0, dz);

    // vertical
    const ground = this.world.sampleGround(this.position.x, this.position.z, this.feetY);
    if (ground) {
      const target = ground.y;
      if (target <= this.feetY + 0.62) {
        const diff = target - this.feetY;
        this.feetY = Math.abs(diff) > 0.9 ? target : lerp(this.feetY, target, 1 - Math.exp(-14 * dt));
        if (Math.abs(diff) > 0.9) this.feetY = target;
      }
    } else {
      this.feetY -= 9 * dt;
      if (this.feetY < -22) this.health = 0;
    }
    this.position.y = this.feetY;

    // head bob + footsteps
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speed = speed;
    const moving = speed > 0.25;
    this.bobPhase += dt * speed * 2.6;
    const bobTarget = this.crouching ? 0.018 : this.sprinting ? 0.055 : 0.03;
    this.bobAmount = damp(this.bobAmount, moving ? bobTarget : 0, 6, dt);
    const bobY = Math.sin(this.bobPhase * 2) * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * this.bobAmount * 0.7;

    const eyeTarget = this.crouching ? CROUCH_EYE : EYE;
    this.eyeHeight = damp(this.eyeHeight, eyeTarget, 9, dt);

    if (moving && !this.hiding) {
      this.stepTimer -= dt * (this.sprinting ? 1.55 : this.crouching ? 0.7 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.31 : this.crouching ? 0.72 : 0.47;
        this.lastSurface = this._surface();
        this.audio.footstep(this.lastSurface, this.sprinting);
        if (this.sprinting) this.audio.breath();
        this.onNoise?.(this.sprinting ? 1.0 : this.crouching ? 0.14 : 0.42);
      }
    }

    // hiding camera
    if (this.hiding) {
      const spot = this.hiding;
      this.position.x = spot.x;
      this.position.z = spot.z;
      const y = spot.type === 'underbed' ? spot.y ?? this.feetY + 0.24 : this.feetY;
      this.camera.position.set(spot.x, y + (spot.type === 'underbed' ? 0.32 : 1.15), spot.z);
      const limit = spot.type === 'underbed' ? 0.5 : 0.85;
      this.camera.rotation.set(
        clamp(this.pitch, -limit, limit),
        this.yaw + (spot.ry || 0),
        clamp(this.roll || 0, -0.06, 0.06),
        'YXZ'
      );
    } else {
      this.camera.position.set(this.position.x + bobX, this.eyeY + bobY, this.position.z);
      this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase) * 0.006, 'YXZ');
    }

    // flashlight battery + flicker
    if (this.flashOn && this.battery > 0) {
      this.battery = clamp(this.battery - dt * 0.0042, 0, 1);
      if (this.battery <= 0) {
        this.flashOn = false;
        this.audio.flashlightClick();
      }
    }
    const flicker = this.battery < 0.22 && Math.random() < 0.02 ? 1 : 0;
    this.flashFlicker = flicker ? 1 : this.flashFlicker * 0.85;
    const power = this.flashOn && this.battery > 0 ? (1 - this.flashFlicker * 0.82) : 0;
    this.spot.intensity = damp(this.spot.intensity, power * 62, 20, dt);
    this.fill.intensity = damp(this.fill.intensity, power * 1.1, 12, dt);
    this.spot.visible = power > 0.01;
    this.fill.visible = power > 0.01;

    // track rooms
    const tx = Math.round((this.position.x + 48) / 2 - 0.5);
    const tz = Math.round((this.position.z + 40) / 2 - 0.5);
    this._trackRoom(tx, tz);
  }

  _trackRoom(tx, tz) {
    const levelId = this.levelId;
    const level = this.world.levels[levelId];
    if (!level) return;
    this.currentLevelId = levelId;
    if (level.isRoof) { this.roomsVisited.add('roof'); this.onRoom?.('roof', levelId); return; }
    if (tx < 0 || tz < 0 || tx >= 48 || tz >= 40) return;
    const r = level.roomMap[tz * 48 + tx];
    if (r && !this.roomsVisited.has(r.id)) {
      this.roomsVisited.add(r.id);
      this.onRoom?.(r.id, levelId);
    }
  }

  _surface() {
    const levelId = this.levelId;
    const level = this.world.levels[levelId];
    const tx = Math.floor((this.position.x + 48) / 2);
    const tz = Math.floor((this.position.z + 40) / 2);
    const r = level && !level.isRoof ? level.roomMap[tz * 48 + tx] : null;
    if (!r) return 'concrete';
    if (r.floor === 'tileFloor') return 'tile';
    if (r.floor === 'concreteFloor') return 'concrete';
    if (r.theme === 'ward') return 'carpet';
    return 'linoleum';
  }

  _moveAxis(dx, dz) {
    const nx = this.position.x + dx;
    const nz = this.position.z + dz;
    const colliders = this.world.collidersNear(this.feetY);
    const outdoor = this.world.outdoor?.colliders || [];
    const gate = this.world.outdoor?.collidersForGate?.() || [];
    const all = colliders.concat(this.feetY < 2 ? outdoor : [], this.feetY < 2 ? gate : []);
    const r = RADIUS;
    for (const c of all) {
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
        // ignore colliders we can step over (none currently) or that are far in y
        return;
      }
    }
    // keep the player inside the building footprint / compound
    if (nx < -46.5 || nx > 46.5 || nz < -33 || nz > 39.5) return;
    this.position.x = nx;
    this.position.z = nz;
  }

  toJSON() {
    return {
      x: this.position.x, z: this.position.z, y: this.feetY,
      yaw: this.yaw, pitch: this.pitch, battery: this.battery,
      health: this.health, flashOn: this.flashOn, levelId: this.currentLevelId,
    };
  }
  fromJSON(d) {
    if (!d) return;
    this.position.set(d.x, d.y, d.z);
    this.feetY = d.y;
    this.yaw = d.yaw;
    this.pitch = d.pitch || 0;
    this.battery = d.battery ?? 1;
    this.health = d.health ?? 100;
    this.flashOn = d.flashOn ?? true;
    this.currentLevelId = d.levelId || 'gf';
    this.camera.position.set(d.x, d.y + EYE, d.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}

export function spawnPoint(spawn) {
  return { x: worldX(spawn.tx), z: worldZ(spawn.tz), y: 0.02 };
}

export { LEVEL_BY_ID };
