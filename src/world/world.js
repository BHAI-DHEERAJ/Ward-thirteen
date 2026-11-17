import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TILE, GRID_W, GRID_H, WORLD_W, WORLD_H, LEVELS, LEVEL_BY_ID, CORRIDOR,
  STAIR_SHAFTS, ELEVATORS, LOOT, SCATTER, CAMERAS, roomBoundsOf, worldX, worldZ, tileX, tileZ,
} from './layout.js';
import { mats, makeFloorMaterial, makeWallMaterial, makeSign } from './materials.js';
import { textures } from './textures.js';
import { Door } from './doors.js';
import { decorateRoom, StaticBatcher, roomBounds, createSignPlate } from './decor.js';
import { createPickup } from './props.js';
import { StairShaft } from './stairs.js';
import { Elevator } from './elevator.js';
import { createOutdoors } from './outdoor.js';
import { Rng, clamp } from '../core/utils.js';

const MISSION_ITEMS = new Set([
  'gateKey', 'maintenanceKey', 'securityKey', 'recordsKey', 'surgeryCard',
  'icuKey', 'psychKey', 'adminKey', 'b2Card', 'researchKey', 'wardCard',
  'patientFile', 'fuelCan',
]);

const SURFACE_Y = {
  desk: 0.78, counter: 1.16, labBench: 0.94, trayTable: 0.87, morgueTable: 0.86,
  filingCabinet: 1.42, shelf: 1.15, bed: 0.82, waitingChair: 0.5, bench: 0.47,
  generator: 1.35, operatingTable: 1.05, crate: 0.5, sink: 0.9, tv: 1.45,
};

const FIXTURE_COLOR = {
  reception: 0xb9c9bd, waiting: 0xc3ccb8, office: 0xb3c1b6, cctv: 0x9fb6a8,
  emergency: 0xb6c6b8, pharmacy: 0xc0cdb8, storage: 0xaab6a4, restroom: 0xa8bcb8,
  theatre: 0xc9d5cd, lab: 0xb4c2b8, ward: 0xbcc8b4, ward13: 0x8c9a86,
  isolation: 0xa6b6ac, morgue: 0x9fb8b8, generator: 0xb8a478, tunnel: 0x94a08e,
  secret: 0xa89878, boiler: 0xa89a86, stairs: 0xa6b0a2, elevator: 0xc2c9b4,
  generic: 0xb4bfb2,
};

export class World {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
    this.levels = {};
    this.doors = [];
    this.elevators = [];
    this.stairs = [];
    this.interactMeshes = [];
    this.pickups = [];
    this.containers = [];
    this.hides = [];
    this.lightDefs = [];
    this.cameraProps = [];
    this.power = false;
    this.onSound = opts.onSound || (() => {});
    this.rng = new Rng(1313);
    this._buildAll();
  }

  // =============================================================== top level
  _buildAll() {
    for (const def of LEVELS) {
      if (def.kind === 'interior') this._buildInteriorLevel(def);
      else if (def.kind === 'roof') this._buildRoof(def);
    }
    this._buildStairs();
    this._buildElevators();
    this.outdoor = createOutdoors(this);
    this.root.add(this.outdoor.group);
    this._buildLightPool();
    this._buildDoorsColliders();
    this._finaliseNav();
  }

  // ================================================================== levels
  _buildInteriorLevel(def) {
    const group = new THREE.Group();
    group.name = def.id;
    this.root.add(group);
    const grid = new Uint8Array(GRID_W * GRID_H).fill(0);
    const floorMask = new Uint8Array(GRID_W * GRID_H);
    const roomMap = new Array(GRID_W * GRID_H).fill(null);
    const level = {
      def, id: def.id, y: def.y, group, grid, floorMask, roomMap,
      colliders: [], doors: [], containers: [], hides: [], pickups: [],
      rooms: [], lights: [], navBlocked: new Set(), fixtures: [],
    };
    this.levels[def.id] = level;

    const rooms = [...def.rooms, ...Object.values(def.cores || {})];
    level.rooms = rooms;
    const idx = (x, z) => z * GRID_W + x;

    // walkable interior tiles
    for (const r of rooms) {
      for (let z = r.z1; z <= r.z2; z++) {
        for (let x = r.x1; x <= r.x2; x++) {
          grid[idx(x, z)] = 1;
          roomMap[idx(x, z)] = r;
        }
      }
    }
    for (let z = CORRIDOR.z1; z <= CORRIDOR.z2; z++) {
      for (let x = CORRIDOR.x1; x <= CORRIDOR.x2; x++) {
        grid[idx(x, z)] = 2;
        roomMap[idx(x, z)] = { id: 'corridor', name: 'CORRIDOR', theme: 'corridor', x1: CORRIDOR.x1, x2: CORRIDOR.x2, z1: CORRIDOR.z1, z2: CORRIDOR.z2, floor: CORRIDOR.floor, wall: CORRIDOR.wall };
      }
    }

    // doorways
    const doorSeeds = [];
    for (const r of rooms) {
      for (const d of r.doors || []) {
        const dIdx = idx(d.x, d.z);
        if (grid[dIdx] === 1 || grid[dIdx] === 2) continue;
        grid[dIdx] = 3;
        doorSeeds.push({ r, d });
      }
    }
    // stair shafts are open voids: their floor does not exist (the shaft builds it)
    for (const core of Object.values(def.cores || {})) {
      if (core.open) {
        for (let z = 17; z <= 25; z++) for (let x = core.x1; x <= core.x2; x++) floorMask[idx(x, z)] = 0;
      }
    }

    // floors + ceilings + fixtures
    for (const r of rooms) {
      const isStair = r.open;
      this._buildRoomFloor(level, r, isStair);
      if (!isStair) this._buildRoomCeiling(level, r);
      this._buildRoomFixtures(level, r);
    }
    this._buildCorridor(level);
    this._buildDoorwayFloors(level);

    // walls
    this._buildWalls(level);
    this._buildSlab(level);
    this._buildFacadeWindows(level);

    // doors
    for (const { r, d } of doorSeeds) {
      const door = this._makeDoor(level, r, d);
      if (door) level.doors.push(door);
    }

    // decor
    this._decorateLevel(level);
    // decals
    this._addDecals(level);
    // signage
    this._addSignage(level);

    // floor mask from grid
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === 1 || grid[i] === 2 || grid[i] === 3) floorMask[i] = 1;
    }
    for (const core of Object.values(def.cores || {})) {
      if (core.open) for (let z = 17; z <= 25; z++) for (let x = core.x1; x <= core.x2; x++) floorMask[z * GRID_W + x] = 0;
    }
  }

  _buildRoomFloor(level, r, skip) {
    const b = roomBounds(r);
    const y = level.y;
    if (!skip) {
      const geo = new THREE.PlaneGeometry(b.w, b.d);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b.w / 2), uv.getY(i) * (b.d / 2));
      const mat = makeFloorMaterial(r);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((b.x0 + b.x1) / 2, y + 0.001, (b.z0 + b.z1) / 2);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      level.group.add(mesh);
    }
    // baseboard trim
    const trimGeo = new THREE.BoxGeometry(b.w, 0.12, 0.04);
    const trimMat = mats.metalDark;
    for (const [x, z, ry] of [[(b.x0 + b.x1) / 2, b.z0 + 0.03, 0], [(b.x0 + b.x1) / 2, b.z1 - 0.03, 0]]) {
      const m = new THREE.Mesh(trimGeo, trimMat);
      m.position.set(x, level.y + 0.06, z);
      m.rotation.y = ry;
      level.group.add(m);
    }
  }

  /**
   * Doorway tiles sit between a room and the corridor, so neither the room
   * floor nor the corridor floor covers them. Without this the player would
   * walk across a two-metre strip of void in front of every door.
   */
  _buildDoorwayFloors(level) {
    const quads = [];
    for (let z = 0; z < GRID_H; z++) {
      for (let x = 0; x < GRID_W; x++) {
        if (level.grid[z * GRID_W + x] !== 3) continue;
        const geo = new THREE.PlaneGeometry(TILE + 0.02, TILE + 0.02);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TILE / 2), uv.getY(i) * (TILE / 2));
        geo.rotateX(-Math.PI / 2);
        geo.translate(worldX(x), level.y + 0.002, worldZ(z));
        quads.push(geo);
      }
    }
    if (!quads.length) return;
    const merged = mergeGeometries(quads, false);
    quads.forEach((g) => g.dispose());
    const corridor = level.def.corridor || {};
    const mat = makeFloorMaterial({ floor: corridor.floor || 'linoleum' });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    level.group.add(mesh);
  }

  _buildRoomCeiling(level, r) {
    const b = roomBounds(r);
    const geo = new THREE.PlaneGeometry(b.w, b.d);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b.w / 2), uv.getY(i) * (b.d / 2));
    const mat = level.def.id === 'w13' || level.def.id === 'b2' ? mats.ceilingDark : mats.ceiling;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set((b.x0 + b.x1) / 2, level.y + level.def.ceil - 0.01, (b.z0 + b.z1) / 2);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    level.group.add(mesh);
  }

  _buildCorridor(level) {
    const c = CORRIDOR;
    const b = roomBounds({ x1: c.x1, x2: c.x2, z1: c.z1, z2: c.z2 });
    const geo = new THREE.PlaneGeometry(b.w, b.d);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b.w / 2), uv.getY(i) * (b.d / 2));
    const mesh = new THREE.Mesh(geo, level.def.corridor.floor === 'tileFloor' ? mats.floorTile : level.def.corridor.floor === 'concreteFloor' ? mats.concreteFloor : mats.linoleum);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, level.y + 0.001, (b.z0 + b.z1) / 2);
    mesh.receiveShadow = true;
    level.group.add(mesh);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), mats.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, level.y + level.def.ceil - 0.01, (b.z0 + b.z1) / 2);
    level.group.add(ceil);

    // corridor props: benches, gurneys, signs, pipes, wheelchairs
    const rng = new Rng(level.def.short.charCodeAt(0) * 71 + 13);
    const batcher = new StaticBatcher();
    for (let x = 8; x < 41; x += 6) {
      const type = rng.pick(['bench', 'gurney', 'wheelchair', 'bin', 'plant', 'trayTable']);
      const g = createPropSafe(type, rng);
      g.position.set(worldX(x + rng.range(-0.6, 0.6)), level.y, worldZ(rng.sign() > 0 ? 13.4 : 14.6));
      g.rotation.y = rng.range(-0.3, 0.3);
      g.updateMatrixWorld(true);
      batcher.add(g);
    }
    // wall signs along the corridor
    batcher.finalize(level.group);
    for (const x of [10, 24, 38]) {
      const plate = createSignPlate(level.def.name.split('—')[0].trim(), 1.6, 0.34);
      plate.position.set(worldX(x), level.y + 2.5, worldZ(13) + 0.02);
      plate.rotation.y = 0;
      level.group.add(plate);
    }
    // pipes
    const pipe = createPropSafe('pipes', null, { len: 62, count: 2 });
    pipe.position.set(0, level.y + level.def.ceil - 0.3, worldZ(15) - 0.6);
    pipe.rotation.y = 0;
    level.group.add(pipe);
    // corridor emergency lights (always on, very dim)
    for (const x of [9, 20, 33]) {
      this.lightDefs.push({
        level: level.id, x: worldX(x), y: level.y + level.def.ceil - 0.25, z: worldZ(14),
        color: 0x7f8f74, intensity: 3.2, distance: 9, flicker: 0.2, always: true, room: 'corridor',
      });
    }
  }

  _buildRoomFixtures(level, r) {
    const b = roomBounds(r);
    const positions = [];
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    positions.push([cx, cz]);
    if (b.w > 12 && b.d > 12) {
      positions.push([(b.x0 + cx) / 2, cz], [(b.x1 + cx) / 2, cz]);
    }
    const fixtures = level.fixtures;
    const color = FIXTURE_COLOR[r.theme] || FIXTURE_COLOR.generic;
    const emissiveMat = new THREE.MeshStandardMaterial({
      color: 0xcfd6c8, emissive: color, emissiveIntensity: 1.2, roughness: 0.55,
    });
    r._emissiveMat = emissiveMat;
    r._fixtureMeshes = [];

    const housing = new StaticBatcher();
    for (const [x, z] of positions) {
      const y = level.y + level.def.ceil - 0.06;
      const g = new THREE.Group();
      const h = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.07, 0.2), mats.metalDark);
      h.position.y = -0.05;
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.1), emissiveMat);
      tube.position.y = -0.1;
      g.add(h, tube);
      g.position.set(x, y, z);
      g.updateMatrixWorld(true);
      housing.add(g);
      r._fixtureMeshes.push(tube);
      this.lightDefs.push({
        level: level.id, x, y: y - 0.2, z, color, intensity: 12, distance: Math.max(8, Math.min(16, b.w * 0.7)),
        flicker: r.theme === 'ward13' ? 0.75 : r.theme === 'theatre' ? 0.1 : 0.2,
        room: r.id, always: r.theme === 'stairs' || r.theme === 'elevator',
      });
    }
    housing.finalize(level.group);
    if (level.def.id === 'w13' || level.def.id === 'b2') emissiveMat.emissive.setHex(0x8a5a3a);
  }

  // ==================================================================== walls
  _buildWalls(level) {
    const def = level.def;
    const idx = (x, z) => z * GRID_W + x;
    const buckets = new Map();
    const addTile = (x, z) => {
      if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_H) return;
      // the shell ends at row 26; the exterior doorway occupies row 27, and
      // nothing beyond it may be walled or the entrance would be sealed from
      // the courtyard side
      if (z >= 28) return;
      const i = idx(x, z);
      if (level.grid[i] !== 0) return;
      // only shells: solid tiles that touch an interior walkable tile
      let touch = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= GRID_W || nz >= GRID_H) continue;
        if (level.grid[idx(nx, nz)] !== 0) { touch = true; break; }
      }
      if (!touch) return;
      const near = this._nearRoom(level, x, z);
      const wallMat = near ? makeWallMaterial(near) : mats.concreteWall;
      if (!buckets.has(wallMat)) buckets.set(wallMat, []);
      const g = new THREE.BoxGeometry(TILE, def.ceil, TILE);
      g.translate(worldX(x), level.y + def.ceil / 2, worldZ(z));
      buckets.get(wallMat).push(g);
      level.colliders.push({
        wall: true,
        minX: worldX(x) - TILE / 2, maxX: worldX(x) + TILE / 2,
        minZ: worldZ(z) - TILE / 2, maxZ: worldZ(z) + TILE / 2,
      });
    };
    for (let z = 0; z < GRID_H; z++) for (let x = 0; x < GRID_W; x++) addTile(x, z);

    for (const [mat, list] of buckets) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      level.group.add(mesh);
    }
  }

  _nearRoom(level, x, z) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID_W || nz >= GRID_H) continue;
      const r = level.roomMap[nz * GRID_W + nx];
      if (r) return r;
    }
    return null;
  }

  _isFloor(x, z, level) {
    if (x < 0 || z < 0 || x >= GRID_W || z >= GRID_H) return false;
    return level.grid[z * GRID_W + x] !== 0;
  }

  /** Exterior / courtyard-side walls for the ground floor, with windows. */
  _buildFacadeWindows(level) {
    if (level.id !== 'gf') return;
    const windows = new Set();
    for (const r of level.def.rooms) for (const w of r.windows || []) windows.add(`${w.x},${w.z}`);
    // the outdoor grid lives in the outdoor builder; walls between interior and
    // the courtyard are built there for accurate window openings.
    level.windowTiles = windows;
  }

  _buildSlab(level) {
    const def = level.def;
    const holes = [];
    for (const s of STAIR_SHAFTS) holes.push({ x1: s.x1, x2: s.x2, z1: s.z1, z2: s.z2 });
    for (const e of ELEVATORS) {
      const tx = e.centre.tx, tz = e.centre.tz;
      holes.push({
        x1: tx - e.innerW / TILE / 2 - 0.4, x2: tx + e.innerW / TILE / 2 + 0.4,
        z1: tz - e.innerD / TILE / 2 - 0.4, z2: tz + e.innerD / TILE / 2 + 0.4,
      });
    }
    const inHole = (x, z) => holes.some((h) => x >= h.x1 - 0.5 && x <= h.x2 + 0.5 && z >= h.z1 - 0.5 && z <= h.z2 + 0.5);
    const thickness = 1.5;
    const y = level.y + def.ceil + thickness / 2;
    const buckets = [];
    for (let z = 0; z < 27; z++) {
      let start = null;
      for (let x = 0; x <= 47; x++) {
        const solid = x < 47 && !inHole(x + 0.5, z + 0.5);
        if (solid && start === null) start = x;
        if (!solid && start !== null) {
          const w = x - start;
          const geo = new THREE.BoxGeometry(w * TILE, thickness, TILE);
          geo.translate((start + w / 2) * TILE - WORLD_W / 2, y, (z + 0.5) * TILE - WORLD_H / 2);
          buckets.push(geo);
          start = null;
        }
      }
    }
    if (!buckets.length) return;
    const merged = mergeGeometries(buckets, false);
    buckets.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, def.id === 'b2' || def.id === 'w13' ? mats.concreteFloor : mats.ceiling);
    mesh.receiveShadow = true;
    level.group.add(mesh);
  }

  // ==================================================================== doors
  _makeDoor(level, room, d) {
    const axis = d.axis || (room.side === 'n' || room.side === 's' ? 'z' : 'x');
    const locked = !!d.locked && d.locked !== 'restricted' ? true : d.locked === 'restricted';
    const door = new Door({
      id: `${level.id}:${room.id}:${d.x}-${d.z}`,
      tx: d.x, tz: d.z,
      worldX: worldX(d.x), worldZ: worldZ(d.z),
      y: level.y,
      axis,
      wide: !!d.wide,
      locked,
      keyId: d.locked || null,
      keyName: d.keyName || 'Key',
      label: d.label || room.name,
      roomName: d.label || room.name,
      hidden: !!d.hidden,
      exterior: !!d.exterior,
      swing: (d.x + d.z) % 2 === 0 ? 1 : -1,
      wallMat: makeWallMaterial(room),
      height: level.def.ceil,
      onSound: (kind, dRef) => this.onSound(kind, dRef),
    });
    level.group.add(door.group);
    door.registerInteractive(this.interactMeshes);
    this.doors.push(door);
    this.interactMeshes.push(...(door.interactMeshes || []));
    // the door's own group must be visible when the level is
    door.group.userData.levelId = level.id;
    return door;
  }

  _buildDoorsColliders() {
    for (const level of Object.values(this.levels)) {
      for (const door of level.doors) {
        // door colliders are queried dynamically
        void door;
      }
    }
  }

  // =================================================================== decor
  _decorateLevel(level) {
    const def = level.def;
    const rooms = [...def.rooms, ...Object.values(def.cores || {})];
    let seedBase = def.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const scaleLoot = LOOT[def.id] || {};
    for (const r of rooms) {
      if (r.open) {
        // stairwell: sign only
        const plate = createSignPlate(r.name, 1.2, 0.26);
        const b = roomBounds(r);
        plate.position.set((b.x0 + b.x1) / 2, level.y + 2.3, b.z1 - 0.06);
        plate.rotation.y = Math.PI;
        level.group.add(plate);
        continue;
      }
      const loot = [...(scaleLoot[r.id] || [])];
      const visible = loot.filter((i) => MISSION_ITEMS.has(i) || i === 'paper');
      const hidden = loot.filter((i) => !MISSION_ITEMS.has(i) && i !== 'paper');
      const res = decorateRoom(r, {
        floorY: level.y,
        seed: seedBase + r.x1 * 3 + r.z1,
        loot: hidden,
        pickups: [],
        onContainer: (g, room) => this._registerContainer(level, g, room, hidden),
        onPickup: () => {},
      });
      level.group.add(res.staticGroup);
      level.colliders.push(...res.colliders);
      level.containers.push(...res.containers);
      level.hides.push(...res.hides);
      const containerCount = res.containers.length;
      res.containers.forEach((c, ci) => {
        c.userData.container.loot = hidden.filter((_, li) => li % Math.max(1, containerCount) === ci);
        c.traverse((o) => {
          if (o.isMesh) {
            o.userData.containerGroup = c;
            this.interactMeshes.push(o);
          }
        });
      });
      if (containerCount === 0 && hidden.length) {
        const b = roomBounds(r);
        hidden.forEach((itemId, i) => {
          this._spawnPickup(level, itemId, (b.x0 + b.x1) / 2 + (i % 3) * 0.45, level.y + 0.03, (b.z0 + b.z1) / 2 + Math.floor(i / 3) * 0.45);
        });
      }
      for (const hide of res.hides) {
        hide.levelId = level.id;
        this.hides.push(hide);
      }
      // visible mission loot on a surface
      const surface = this._pickSurface(res.props, level.y);
      visible.forEach((itemId, i) => {
        const spot = surface ? { x: surface.x + (i % 2) * 0.3 - 0.15, z: surface.z + Math.floor(i / 2) * 0.3, y: surface.y + (itemId === 'paper' ? 0.01 : 0.03) }
          : { x: (roomBounds(r).x0 + roomBounds(r).x1) / 2 + i * 0.4, z: (roomBounds(r).z0 + roomBounds(r).z1) / 2, y: level.y + 0.03 };
        this._spawnPickup(level, itemId, spot.x, spot.y, spot.z);
      });
      // scatter items
      for (const s of SCATTER[def.id] || []) {
        if (s.tx >= r.x1 && s.tx <= r.x2 + 1 && s.tz >= r.z1 && s.tz <= r.z2 + 1) {
          this._spawnPickup(level, s.item, worldX(s.tx), level.y + 0.03, worldZ(s.tz));
        }
      }
    }
    // corridor pickups (scatter that landed in corridors)
    for (const s of SCATTER[def.id] || []) {
      if (s.tz > 12.5 && s.tz < 15.5) this._spawnPickup(level, s.item, worldX(s.tx), level.y + 0.03, worldZ(s.tz));
    }
  }

  _pickSurface(props, floorY) {
    const order = ['counter', 'desk', 'labBench', 'trayTable', 'morgueTable', 'filingCabinet', 'shelf', 'crate', 'waitingChair'];
    for (const type of order) {
      const p = props.find((pp) => pp.type === type);
      if (p) return { x: p.x, z: p.z, y: (floorY || 0) + SURFACE_Y[type] + 0.06 };
    }
    return null;
  }

  _registerContainer(level, group, room, lootPool) {
    group.userData.container = group.userData.container || {};
    group.userData.container.room = room.name;
    group.userData.container.loot = [];
    group.userData.container.searched = false;
    group.userData.container.levelId = level.id;
    if (group.userData.containerIndex === undefined) {
      group.userData.containerIndex = this.containers.length;
      this.containers.push(group);
    }
  }

  _spawnPickup(level, itemId, x, y, z) {
    const kind = itemId === 'gateKey' || itemId === 'maintenanceKey' || itemId === 'securityKey'
      || itemId === 'recordsKey' || itemId === 'icuKey' || itemId === 'psychKey' || itemId === 'adminKey'
      ? 'key' : itemId === 'wardCard' || itemId === 'b2Card' || itemId === 'surgeryCard' || itemId === 'researchKey'
        ? 'accessCard' : itemId === 'fuelCan' ? 'fuelCan' : itemId === 'patientFile' ? 'patientFile'
          : itemId === 'battery' ? 'battery' : itemId === 'medicine' ? 'medicine'
            : itemId === 'paper' ? 'paper' : itemId.startsWith('note_') || itemId.startsWith('doc_') ? 'patientFile' : 'battery';
    const g = createPickup(kind);
    g.position.set(x, y, z);
    g.rotation.y = this.rng.range(0, Math.PI * 2);
    g.userData.pickupId = itemId;
    g.userData.levelId = level.id;
    g.traverse((o) => { if (o.isMesh) { o.userData.pickupGroup = g; this.interactMeshes.push(o); } });
    level.group.add(g);
    level.pickups.push(g);
    this.pickups.push({ id: itemId, group: g, levelId: level.id });
    return g;
  }

  // =================================================================== decals
  _addDecals(level) {
    const rng = new Rng(level.id.charCodeAt(0) * 131 + 7);
    const def = level.def;
    const makeDecal = (map, opacity, size, x, y, z, rot) => {
      const mat = new THREE.MeshStandardMaterial({
        map, transparent: true, opacity, depthWrite: false, roughness: 1,
        polygonOffset: true, polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.7), mat);
      mesh.rotation.set(-Math.PI / 2, 0, rot);
      mesh.position.set(x, y, z);
      level.group.add(mesh);
    };
    const grime = textures.get('grime').map;
    const blood = textures.get('blood').map;
    const rooms = [...def.rooms, ...Object.values(def.cores || {})];
    for (const r of rooms) {
      if (r.open) continue;
      const b = roomBounds(r);
      const count = def.id === 'w13' || def.id === 'b2' ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const x = rng.range(b.x0 + 1, b.x1 - 1);
        const z = rng.range(b.z0 + 1, b.z1 - 1);
        makeDecal(grime, 0.5, rng.range(1.4, 3.2), x, level.y + 0.006, z, rng.range(0, 6.28));
      }
      if (['morgue', 'ward13', 'theatre', 'secret', 'emergency', 'isolation', 'tunnel'].includes(r.theme) || (def.id === 'w13' && rng.chance(0.6))) {
        const x = rng.range(b.x0 + 1.5, b.x1 - 1.5);
        const z = rng.range(b.z0 + 1.5, b.z1 - 1.5);
        makeDecal(blood, 0.75, rng.range(1.2, 2.6), x, level.y + 0.008, z, rng.range(0, 6.28));
      }
    }
  }

  // ================================================================= signage
  _addSignage(level) {
    const def = level.def;
    if (level.id === 'gf') {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), makeSign(['WARD THIRTEEN HOSPITAL'], {
        bg: '#1a211c', color: '#c8c4ad', border: 'rgba(150,145,120,0.5)',
      }));
      sign.position.set(worldX(20), level.y + 2.9, worldZ(13) - 1.0);
      level.group.add(sign);
    }
    for (const r of def.rooms) {
      if (r.theme !== 'elevator' && r.theme !== 'stairs') continue;
    }
    // floor directory plates at each corridor end
    const plate = createSignPlate(`${def.short} — ${def.name.split('—')[0].trim()}`, 2.2, 0.4);
    plate.position.set(worldX(7), level.y + 2.35, worldZ(13) + 0.03);
    level.group.add(plate);
  }

  // ==================================================================== roof
  _buildRoof(def) {
    const group = new THREE.Group();
    this.root.add(group);
    const level = {
      def, id: def.id, y: def.y, group, grid: new Uint8Array(GRID_W * GRID_H), floorMask: new Uint8Array(GRID_W * GRID_H),
      roomMap: new Array(GRID_W * GRID_H).fill(null), colliders: [], doors: [], containers: [], hides: [], pickups: [],
      rooms: [], lights: [], navBlocked: new Set(), fixtures: [], isRoof: true,
    };
    this.levels[def.id] = level;

    // deck
    const geo = new THREE.PlaneGeometry(92, 52);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 46, uv.getY(i) * 26);
    const deck = new THREE.Mesh(geo, mats.concreteFloor);
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(0, def.y + 0.02, -6);
    deck.receiveShadow = true;
    group.add(deck);

    // parapet
    const parapetMat = mats.concreteWall;
    const walls = [
      [0, -6 - 26, 92, 0.4], [0, -6 + 26, 92, 0.4],
      [-46, -6, 0.4, 52], [46, -6, 0.4, 52],
    ];
    for (const [x, z, w, d] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), parapetMat);
      m.position.set(x, def.y + 0.6, z);
      m.castShadow = true;
      group.add(m);
      level.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }

    // stair + elevator head houses
    for (const s of STAIR_SHAFTS) {
      const b = roomBounds({ x1: s.x1, x2: s.x2, z1: s.z1, z2: s.z2 });
      for (const [x, z, w, d] of [
        [(b.x0 + b.x1) / 2, b.z0 + 0.15, b.w, 0.3], [(b.x0 + b.x1) / 2, b.z1 - 0.15, b.w, 0.3],
        [b.x0 + 0.15, (b.z0 + b.z1) / 2, 0.3, b.d], [b.x1 - 0.15, (b.z0 + b.z1) / 2, 0.3, b.d],
      ]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), mats.concreteWall);
        m.position.set(x, def.y + 1.3, z);
        group.add(m);
      }
      level.colliders.push({ minX: b.x0, maxX: b.x0 + 0.3, minZ: b.z0, maxZ: b.z1 });
      level.colliders.push({ minX: b.x1 - 0.3, maxX: b.x1, minZ: b.z0, maxZ: b.z1 });
    }

    // rooftop props
    const rng = new Rng(5001);
    const batcher = new StaticBatcher();
    const place = (type, x, z, ry, params) => {
      const g = createPropSafe(type, rng, params);
      g.position.set(x, def.y, z);
      g.rotation.y = ry;
      g.updateMatrixWorld(true);
      batcher.add(g);
      level.colliders.push({ minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 });
    };
    place('boiler', -34, -22, 0.3);
    place('boiler', -28, -22, 1.2);
    place('generator', 30, -24, 0.5);
    place('generator', 36, -20, -0.3);
    place('pipes', 0, -8, 0, { len: 30, count: 3, y: 0.6 });
    for (let i = 0; i < 7; i++) place('crate', rng.range(-20, 25), rng.range(-26, 12), rng.range(0, 3));
    for (let i = 0; i < 4; i++) place('radiator', rng.range(-30, 30), rng.range(-26, 12), rng.range(0, 3));
    batcher.finalize(group);

    // water tanks
    for (const [x, z] of [[-38, 8], [-32, 8]]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.2, 16), mats.metalDark);
      tank.position.set(x, def.y + 2.1, z);
      tank.castShadow = true;
      group.add(tank);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 0.8, 16), mats.rust);
      cap.position.set(x, def.y + 4.4, z);
      group.add(cap);
      level.colliders.push({ minX: x - 2.2, maxX: x + 2.2, minZ: z - 2.2, maxZ: z + 2.2 });
    }

    // helipad
    const heli = new THREE.Mesh(new THREE.CircleGeometry(5, 32), mats.asphalt);
    heli.rotation.x = -Math.PI / 2;
    heli.position.set(26, def.y + 0.03, 6);
    group.add(heli);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.7, 32), new THREE.MeshStandardMaterial({ color: 0x9a9a88, roughness: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(26, def.y + 0.04, 6);
    group.add(ring);
    const hMat = new THREE.MeshStandardMaterial({ color: 0xa8a894, roughness: 0.8 });
    const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.4), hMat);
    h1.rotation.x = -Math.PI / 2; h1.position.set(24.6, def.y + 0.05, 6); group.add(h1);
    const h2 = h1.clone(); h2.position.x = 27.4; group.add(h2);
    const h3 = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.5), hMat);
    h3.rotation.x = -Math.PI / 2; h3.position.set(26, def.y + 0.05, 6); group.add(h3);

    // antenna + dish
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 7, 8), mats.metalDark);
    mast.position.set(-20, def.y + 3.5, 10);
    group.add(mast);
    level.colliders.push({ minX: -20.3, maxX: -19.7, minZ: 9.7, maxZ: 10.3 });
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mats.metal);
    dish.rotation.x = -1.1;
    dish.position.set(20, def.y + 2.2, -18);
    group.add(dish);

    // emergency lights
    for (const x of [-30, 0, 30]) {
      this.lightDefs.push({ level: 'roof', x, y: def.y + 2.6, z: -6, color: 0x8fa0b8, intensity: 8, distance: 18, flicker: 0, always: true, room: 'roof' });
    }

    // make the whole roof walkable in the height sampler
    level.walkableAll = true;
    level.roofBounds = { x0: -46, x1: 46, z0: -32, z1: 20 };
    level.def.ceil = 3;
  }

  // ================================================================== stairs
  _buildStairs() {
    for (const cfg of STAIR_SHAFTS) {
      const shaft = new StairShaft(cfg);
      this.stairs.push(shaft);
      this.root.add(shaft.group);
    }
  }

  // ================================================================ elevators
  _buildElevators() {
    for (const cfg of ELEVATORS) {
      const lift = new Elevator(cfg, { onSound: (k, e) => this.onSound(`elevator_${k}`, e) });
      this.elevators.push(lift);
      this.root.add(lift.group);
      for (const stop of lift.stops) {
        const level = this.levels[stop.id];
        if (!level) continue;
        const g = lift.buildForLevel(stop);
        level.group.add(g);
        level.colliders.push(...(lift.staticColliders[stop.id] || []));
      }
      for (const mesh of lift.interactables) this.interactMeshes.push(mesh);
      // car is only visible near its y; handled in updateVisibility
    }
  }

  // ================================================================== lights
  _buildLightPool() {
    this.pool = [];
    for (let i = 0; i < 7; i++) {
      const l = new THREE.PointLight(0xb8c4b4, 0, 12, 2);
      l.castShadow = false;
      this.root.add(l);
      this.pool.push(l);
    }
    this.poolTimer = 0;
    this.activeLights = [];
  }

  updateLights(dt, camera) {
    this.poolTimer -= dt;
    if (this.poolTimer <= 0) {
      this.poolTimer = 0.22;
      const px = camera.position.x, pz = camera.position.z, py = camera.position.y;
      const candidates = this.lightDefs
        .filter((l) => Math.abs(LEVEL_BY_ID[l.level].y - py) < 7)
        .map((l) => ({ l, d: Math.hypot(l.x - px, l.y - py, l.z - pz) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 7);
      this.activeLights = candidates.map((c) => c.l);
      for (let i = 0; i < this.pool.length; i++) {
        const def = this.activeLights[i];
        const light = this.pool[i];
        if (!def) { light.intensity = 0; continue; }
        light.position.set(def.x, def.y, def.z);
        light.color.setHex(def.color);
        light.distance = def.distance;
      }
    }
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.pool.length; i++) {
      const def = this.activeLights[i];
      if (!def) continue;
      const light = this.pool[i];
      let target = this._lightPower(def);
      if (target <= 0) { light.intensity = 0; continue; }
      if (def.flicker > 0) {
        const n = Math.sin(t * 11 + def.x) * Math.sin(t * 3.7 + def.z) * Math.sin(t * 27.3);
        if (n > 0.93 - def.flicker * 0.1) target *= 0.06;
        else target *= 0.94 + Math.sin(t * 60 + def.z) * 0.06;
      }
      light.intensity = target;
    }
    // emissive fixtures follow power
    for (const level of Object.values(this.levels)) {
      for (const r of level.rooms || []) {
        if (!r._emissiveMat) continue;
        const on = this._roomPowered(level, r);
        r._emissiveMat.emissiveIntensity = on ? (level.id === 'w13' ? 0.7 : 1.15) : 0.04;
      }
    }
  }

  _roomPowered(level, r) {
    if (r.theme === 'stairs' || r.theme === 'elevator') return true;
    if (level.id === 'w13' || level.id === 'b2') return this.power;
    return this.power;
  }

  _lightPower(def) {
    if (!this.power) {
      return def.always ? def.intensity * 0.55 : 0;
    }
    return def.intensity;
  }

  setPower(on) {
    this.power = on;
    for (const level of Object.values(this.levels)) {
      if (!level.doors) continue;
      for (const d of level.doors) if (d.elevatorLobby) d.locked = false;
    }
  }

  // ================================================================ collision
  /** All static colliders from levels within 5.5 m of a world Y. */
  collidersNear(y) {
    const out = [];
    for (const level of Object.values(this.levels)) {
      // only the floor you are standing on: walls are full storey height, so a
      // collider five metres up must never block you
      if (Math.abs(level.y - y) > 2.6) continue;
      out.push(...level.colliders);
      for (const d of level.doors || []) {
        if (d.colliders.length) out.push(...d.colliders);
      }
    }
    for (const lift of this.elevators) {
      if (Math.abs(lift.y - y) < 2.6) {
        out.push(...lift.doorColliders().filter((c) => Math.abs((LEVEL_BY_ID[c.levelId]?.y ?? 0) - y) < 2.6));
      }
    }
    return out;
  }

  /** Walkable surface at (x,z) at or below y+0.85. */
  sampleGround(x, z, y, opts = {}) {
    let best = null;
    const consider = (yy, levelId, kind) => {
      if (yy > y + 0.9) return;
      if (!best || yy > best.y) best = { y: yy, levelId, kind };
    };
    for (const level of Object.values(this.levels)) {
      if (level.isRoof) {
        const b = level.roofBounds;
        if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) consider(level.y, level.id, 'roof');
        continue;
      }
      const tx = Math.floor(tileX(x) + 0.5);
      const tz = Math.floor(tileZ(z) + 0.5);
      if (tx < 0 || tz < 0 || tx >= GRID_W || tz >= GRID_H) continue;
      if (!level.floorMask[tz * GRID_W + tx]) continue;
      consider(level.y, level.id, 'floor');
    }
    for (const s of this.stairs) {
      if (!s.isInside(x, z)) continue;
      const surf = s.sample(x, z, y);
      if (surf) consider(surf.y, s.levelForY(surf.y).id, 'stairs');
    }
    for (const e of this.elevators) {
      if (e.isInside(x, z, y)) consider(e.y, e.levelAtY(e.y).id, 'elevator');
    }
    if (x > -46 && x < 46 && z > 16 && z < 40) {
      if (!opts.noOutdoor) consider(0, 'gf', 'outdoor');
    }
    return best;
  }

  levelAtY(y) {
    let best = LEVELS[0], d = Infinity;
    for (const l of LEVELS) {
      const dd = Math.abs(l.y - y);
      if (dd < d) { d = dd; best = l; }
    }
    return best;
  }

  // =================================================================== doors
  doorAt(x, z, y) {
    for (const level of Object.values(this.levels)) {
      if (Math.abs(level.y - y) > 1.2) continue;
      for (const d of level.doors) {
        if (Math.abs(d.worldX - x) < 1.2 && Math.abs(d.worldZ - z) < 1.2) return d;
      }
    }
    return null;
  }

  // ===================================================================== nav
  _finaliseNav() {
    for (const level of Object.values(this.levels)) {
      if (level.isRoof) continue;
      const blocked = new Set(level.navBlocked);
      // block tiles under large props
      const txOf = (x) => Math.floor((x + WORLD_W / 2) / TILE);
      const tzOf = (z) => Math.floor((z + WORLD_H / 2) / TILE);
      for (const c of level.colliders) {
        if (c.wall) continue;
        const area = (c.maxX - c.minX) * (c.maxZ - c.minZ);
        if (area < 2.0) continue;
        const tx0 = txOf(c.minX), tx1 = txOf(c.maxX - 0.01);
        const tz0 = tzOf(c.minZ), tz1 = tzOf(c.maxZ - 0.01);
        for (let tz = tz0; tz <= tz1; tz++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            if (tx < 0 || tz < 0 || tx >= GRID_W || tz >= GRID_H) continue;
            const i = tz * GRID_W + tx;
            if (level.grid[i] === 1 || level.grid[i] === 2) blocked.add(i);
          }
        }
      }
      level.navBlocked = blocked;
      level.walkable = (tx, tz) => {
        if (tx < 0 || tz < 0 || tx >= GRID_W || tz >= GRID_H) return false;
        const i = tz * GRID_W + tx;
        if (level.grid[i] === 0) return false;
        if (blocked.has(i) && level.grid[i] === 1) return false;
        return true;
      };
      level.doorAtTile = (tx, tz) => {
        for (const d of level.doors) {
          if ((d.tx === tx && d.tz === tz) || (Math.abs(d.worldX - worldX(tx)) < 1.1 && Math.abs(d.worldZ - worldZ(tz)) < 1.1)) return d;
        }
        return null;
      };
    }
  }

  // ================================================================ visibility
  updateVisibility(camera) {
    const py = camera.position.y;
    for (const level of Object.values(this.levels)) {
      const visible = Math.abs(level.y - py) < 7.5;
      level.group.visible = visible;
    }
    for (const lift of this.elevators) {
      lift.group.visible = Math.abs(lift.y - py) < 8;
    }
    if (this.outdoor) this.outdoor.group.visible = py < 4 && camera.position.z > 8;
  }

  setLevelVisible() {}
}

// small helper so the world never explodes on a missing prop type
import { createProp } from './props.js';
function createPropSafe(type, rng, params) {
  try {
    return createProp(type, params);
  } catch (e) {
    console.warn('prop failed', type, e);
    return new THREE.Group();
  }
}
