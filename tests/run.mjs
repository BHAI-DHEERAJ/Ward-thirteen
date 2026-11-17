/**
 * Headless test harness. Node has no WebGL, so this exercises everything that
 * does not need a GPU: the layout, the item/document database, the inventory,
 * the mission chain and — with a small canvas shim — the full world build,
 * collision sampling and pathfinding.
 *
 *   node tests/run.mjs
 */
import { createCanvas } from '@napi-rs/canvas';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, extra = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(`${label}${extra ? ` — ${extra}` : ''}`); console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`); }
}
function section(name) { console.log(`\n── ${name}`); }

// ------------------------------------------------------------------ DOM shim
const elementCache = new Map();
const RANGE_IDS = new Set(['set-sens', 'set-vol', 'set-fov']);
const CHECK_IDS = new Set(['set-invert', 'set-grain']);
function makeEl(id) {
  const el = {
    id, style: {}, children: [], textContent: '', innerHTML: '', value: '', checked: false,
    disabled: false, offsetWidth: 100, type: RANGE_IDS.has(id) ? 'range' : CHECK_IDS.has(id) ? 'checkbox' : 'text',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); return c; },
    append(...c) { this.children.push(...c); },
    appendTo() {}, remove() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return null; }, focus() {}, click() {}, setAttribute() {},
  };
  return el;
}
function installDom() {
  const doc = {
    createElement(tag) {
      if (tag === 'canvas') {
        const c = createCanvas(2, 2);
        c.style = {};
        c.addEventListener = () => {};
        c.removeEventListener = () => {};
        c.requestPointerLock = () => {};
        c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
        return c;
      }
      return makeEl(tag);
    },
    createElementNS(_ns, tag) { return doc.createElement(tag); },
    addEventListener() {}, removeEventListener() {},
    getElementById(id) {
      if (!elementCache.has(id)) elementCache.set(id, makeEl(id));
      return elementCache.get(id);
    },
    querySelector() { return null; }, querySelectorAll() { return []; },
    body: { appendChild() {}, style: {} },
    documentElement: { style: {} },
    hidden: false,
    pointerLockElement: null,
    exitPointerLock() {},
  };
  globalThis.document = doc;
  globalThis.window = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame() { return 0; },
    location: { href: 'http://localhost/' },
  };
  globalThis.HTMLCanvasElement = function HTMLCanvasElement() {};
  globalThis.Image = function Image() {};
  globalThis.self = globalThis.window;
  globalThis.localStorage = {
    _d: new Map(),
    getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
    setItem(k, v) { this._d.set(k, String(v)); },
    removeItem(k) { this._d.delete(k); },
  };
}
installDom();

const { LEVELS, LEVEL_BY_ID, GRID_W, GRID_H, TILE, LOOT, SCATTER, ELEVATORS, STAIR_SHAFTS, CAMERAS, SPAWN, worldX, worldZ, tileX, tileZ, GATE } =
  await import('../src/world/layout.js');
const { ITEMS, DOCUMENTS, itemFor, getDocument } = await import('../src/gameplay/items.js');
const { Inventory } = await import('../src/gameplay/inventory.js');
const { MISSIONS } = await import('../src/gameplay/missions.js');

// ------------------------------------------------------------------ layout
section('layout');
ok(LEVELS.length === 10, 'ten levels defined', `got ${LEVELS.length}`);
ok(LEVEL_BY_ID.w13.y === -15 && LEVEL_BY_ID.b2.y === -10 && LEVEL_BY_ID.roof.y === 30, 'level heights match the map spec');
const ids = LEVELS.map((l) => l.id);
ok(new Set(ids).size === ids.length, 'level ids unique');

for (const level of LEVELS) {
  if (level.kind !== 'interior') continue;
  const rooms = level.rooms || [];
  ok(rooms.length >= 10, `${level.id} has at least 10 rooms`, `${rooms.length}`);
  // rooms must not overlap
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const overlap = a.x1 <= b.x2 && b.x1 <= a.x2 && a.z1 <= b.z2 && b.z1 <= a.z2;
      ok(!overlap, `${level.id}: rooms ${a.id}/${b.id} do not overlap`);
    }
  }
  for (const r of rooms) {
    ok(r.x2 >= r.x1 && r.z2 >= r.z1, `${level.id}/${r.id} has a valid rectangle`);
    ok(!!r.theme, `${level.id}/${r.id} has a theme`);
  }
}

// doors must sit on the corridor wall rows
section('doors');
const gf = LEVEL_BY_ID.gf;
for (const level of LEVELS) {
  if (level.kind !== 'interior') continue;
  for (const r of level.rooms || []) {
    for (const d of r.doors || []) {
      ok(d.z === 12 || d.z === 16 || !!d.exterior, `${level.id}/${r.id} door sits on a corridor wall or is an exterior entrance`, `z=${d.z}`);
    }
  }
}

// every key in the game must be obtainable
section('key chain');
const allLoot = [];
for (const perLevel of Object.values(LOOT)) for (const arr of Object.values(perLevel)) allLoot.push(...arr);
const obtainable = new Set(allLoot.filter(Boolean));
const lockKeys = new Set();
for (const level of LEVELS) {
  if (level.kind !== 'interior') continue;
  for (const r of level.rooms || []) {
    for (const d of r.doors || []) {
      if (d.locked && d.locked !== 'restricted') lockKeys.add(d.locked);
    }
  }
  for (const key of Object.keys(level.cores || {})) {
    for (const d of level.cores[key].doors || []) {
      if (d.locked && d.locked !== 'restricted') lockKeys.add(d.locked);
    }
  }
}
for (const cfg of ELEVATORS) if (cfg.requires) lockKeys.add(cfg.requires);
for (const key of lockKeys) {
  ok(obtainable.has(key), `lock key "${key}" is placed somewhere in the loot tables`);
}
// the ward card must not be inside the room it unlocks
const wardRoomLoot = LOOT.f1?.ward13 || [];
ok(!wardRoomLoot.includes('wardCard'), 'ward card is not sealed inside the room it opens');
ok(obtainable.has('wardCard'), 'ward card exists in the world');

// every loot id must resolve to a real item/document
section('loot resolves');
const badLoot = new Set();
for (const id of allLoot) {
  if (!id) continue;
  const def = itemFor(id);
  if (!def || def.name === id) badLoot.add(id);
  if (id.startsWith('note_') || id.startsWith('doc_')) {
    if (!DOCUMENTS[id]) badLoot.add(`missing-doc:${id}`);
  }
}
ok(badLoot.size === 0, 'all loot ids resolve to items or documents', [...badLoot].join(', '));

for (const mission of MISSIONS) {
  const src = mission.check.toString();
  const m = [...src.matchAll(/docsRead\.has\('([^']+)'\)/g)];
  for (const [, docId] of m) {
    ok(!!DOCUMENTS[docId], `mission ${mission.id} references an existing document ${docId}`);
    ok(allLoot.includes(docId), `mission ${mission.id} document ${docId} is obtainable`);
  }
}

// ------------------------------------------------------------------ inventory
section('inventory');
{
  const inv = new Inventory();
  ok(inv.add('battery').ok, 'adds a battery');
  inv.add('battery');
  ok(inv.count('battery') === 2, 'batteries stack');
  inv.add('medicine');
  ok(inv.used === 2, 'distinct items use two slots', `${inv.used}`);
  ok(inv.add('patientFile').document === true, 'documents go to the journal');
  ok(inv.used === 2, 'documents do not consume slots');
  ok(inv.hasDocument('patientFile'), 'document is readable');
  const json = inv.toJSON();
  const inv2 = new Inventory();
  inv2.fromJSON(json);
  ok(inv2.count('battery') === 2 && inv2.hasDocument('patientFile'), 'inventory round-trips through a save');
  inv.remove('battery', 2);
  ok(!inv.has('battery'), 'removing the last stack removes the slot');
  const fill = Object.keys(ITEMS).filter((k) => itemFor(k).kind !== 'documents');
  for (const k of fill) inv.add(k);
  ok(inv.used === 14, 'capacity is 14 slots', `${inv.used}`);
  ok(inv.add('tool').full === true, 'a full inventory reports being full');
}

// ------------------------------------------------------------------ missions
section('mission chain');
{
  const flags = {
    gateOpen: false, powerOn: false, cctvAnomaly: false, escaped: false,
    rooms: new Set(), docsRead: new Set(),
  };
  const game = { flags, inventory: new Inventory() };
  const order = [];
  // walk the chain, granting the flag each mission requires
  const steps = [
    () => { flags.gateOpen = true; flags.rooms.add('reception'); },
    () => { flags.powerOn = true; },
    () => { flags.cctvAnomaly = true; },
    () => { flags.docsRead.add('patientFile'); },
    () => { flags.docsRead.add('doc_surgery_log'); },
    () => { flags.docsRead.add('doc_patientzero'); },
    () => { flags.docsRead.add('doc_psych_records'); },
    () => { flags.docsRead.add('doc_autopsy'); game.inventory.add('researchKey'); },
    () => { flags.docsRead.add('doc_experiment'); flags.docsRead.add('doc_observation'); },
    () => { flags.docsRead.add('doc_ward13_file'); },
    () => { flags.rooms.add('w13Corridor'); },
    () => { flags.docsRead.add('doc_truth'); },
    () => { flags.escaped = true; },
  ];
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = MISSIONS[i];
    ok(!m.check(game), `mission ${m.id} is not complete before its step`);
    steps[i]();
    ok(m.check(game), `mission ${m.id} (${m.title}) completes with its objective`, m.title);
    order.push(m.id);
  }
  ok(order.length === 13, 'there are thirteen missions');
  ok(MISSIONS.every((m) => m.objective && m.hint && m.title), 'every mission has title/objective/hint');
}

// ------------------------------------------------------------------ world build
section('world build');
const { World } = await import('../src/world/world.js');
const THREE = await import('three');
const scene = new THREE.Scene();
let world;
try {
  world = new World(scene, {});
  ok(true, 'World constructs without throwing');
} catch (e) {
  ok(false, 'World constructs without throwing', e.stack?.split('\n').slice(0, 4).join(' | '));
}

if (world) {
  ok(Object.keys(world.levels).length === 10, 'all ten levels exist', `${Object.keys(world.levels).length}`);
  const countLevels = (key) => Object.values(world.levels).reduce((n, l) => n + (l[key]?.length || 0), 0);
  ok(world.doors.length > 80, 'doors were built', `${world.doors.length}`);
  ok(world.interactMeshes.length > 200, 'interactive meshes are registered', `${world.interactMeshes.length}`);
  ok(world.pickups.length > 30, 'items are placed in the world', `${world.pickups.length}`);
  ok(world.containers.length > 90, 'searchable furniture exists', `${world.containers.length}`);
  ok(world.hides.length > 30, 'hiding spots exist', `${world.hides.length}`);
  ok(countLevels('pickups') === world.pickups.length, 'pickup registry matches the levels', `${countLevels('pickups')} vs ${world.pickups.length}`);
  ok(countLevels('doors') === world.doors.length, 'door registry matches the levels', `${countLevels('doors')} vs ${world.doors.length}`);
  ok(world.elevators.length === 3, 'three elevator systems', `${world.elevators.length}`);
  ok(world.stairs.length === 2, 'two staircases', `${world.stairs.length}`);
  ok(!!world.outdoor?.gate, 'the exterior gate exists');

  // every pickup sits on a real floor
  let floating = 0, buried = 0;
  for (const p of world.pickups) {
    const lvl = world.levels[p.levelId];
    const dy = p.group.position.y - lvl.y;
    if (dy > 1.7) floating++;
    if (dy < -0.15) buried++;
  }
  ok(floating === 0, 'no pickups float above their floor', `${floating}`);
  ok(buried === 0, 'no pickups are buried below their floor', `${buried}`);

  // spawn + walkability
  const sx = worldX(SPAWN.tx), sz = worldZ(SPAWN.tz);
  const g = world.sampleGround(sx, sz, 0.02);
  ok(!!g && Math.abs(g.y) < 0.1, 'the player spawns on the ground outside the gate');

  // corridor must be walkable on the ground floor
  let corridorWalkable = 0, corridorTiles = 0;
  const gfBuilt = world.levels.gf;
  for (let x = 6; x <= 41; x++) {
    for (let z = 13; z <= 15; z++) {
      corridorTiles++;
      if (gfBuilt.grid[z * GRID_W + x] !== 0) corridorWalkable++;
    }
  }
  ok(corridorWalkable === corridorTiles, 'the entire ground corridor is walkable', `${corridorWalkable}/${corridorTiles}`);

  // every room centre must be reachable (grid walkable, not blocked by props)
  let blockedRooms = [];
  for (const level of Object.values(world.levels)) {
    if (level.def.kind !== 'interior') continue;
    for (const r of level.rooms || []) {
      // scan the room for at least one free tile
      let free = 0;
      for (let z = r.z1; z <= r.z2; z++) {
        for (let x = r.x1; x <= r.x2; x++) {
          const i = z * GRID_W + x;
          if (level.grid[i] !== 0 && !level.navBlocked.has(i)) free++;
        }
      }
      if (free < 2) blockedRooms.push(`${level.id}/${r.id}`);
    }
  }
  ok(blockedRooms.length === 0, 'every room has walkable floor', blockedRooms.slice(0, 6).join(', '));

  // pathfinding across the ground floor corridor
  const { Entity } = await import('../src/gameplay/entity.js');
  const audioStub = new Proxy({}, { get: () => () => {} });
  const ent = new Entity(world, audioStub, {});
  ent.activate('gf', 8, 14);
  const found = ent._pathTo(worldX(38), worldZ(14), world.levels.gf);
  ok(found && ent.path && ent.path.length > 10, 'entity pathfinds down the corridor', `path=${ent.path?.length}`);
  ent.activate('f1', 8, 14);
  const foundUp = ent._pathTo(worldX(38), worldZ(14), world.levels.f1);
  ok(foundUp, 'entity pathfinds on the first floor');

  // a locked door must block the entity's sight line
  const door = world.doors.find((d) => d.id.includes('ward13'));
  ok(!!door && door.locked, 'Ward 13 is locked at the start');

  // flashlight / player controller
  const { Player } = await import('../src/gameplay/player.js');
  const camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.1, 300);
  const input = {
    mouse: { dx: 0, dy: 0 }, down: () => false, hit: () => false, consume() {},
  };
  const player = new Player(camera, world, input, audioStub, { sensitivity: 1 });
  player.reset({ x: sx, z: sz, y: 0, levelId: 'gf', yaw: 0 });
  for (let i = 0; i < 600; i++) player.update(1 / 60, { uiBlocking: false });
  ok(Number.isFinite(player.camera.position.y), 'player camera stays finite');
  ok(Math.abs(player.position.z - sz) < 1.5, 'player does not drift while idle');
  ok(player.battery < 0.99 && player.battery > 0.5, 'flashlight battery drains slowly', `${player.battery.toFixed(3)}`);

  // world light pool
  world.updateLights(0.1, camera);
  world.setPower(true);
  ok(world.power === true, 'power can be restored');
  world.setPower(false);
}

// ------------------------------------------------------------------ game boot
section('game boot (end to end)');
{
  const { Game } = await import('../src/game.js');
  const rendererStub = {
    userData: {},
    shadowMap: {},
    setRenderTarget() {}, getRenderTarget() { return null; }, clear() {},
    render() {}, setPixelRatio() {}, setSize() {}, setClearColor() {},
    info: { render: {} },
  };
  const cam = new THREE.PerspectiveCamera(74, 16 / 9, 0.1, 400);
  const bootScene = new THREE.Scene();
  let game;
  try {
    game = new Game({ renderer: rendererStub, scene: bootScene, camera: cam, canvas: document.getElementById('scene') });
    ok(true, 'Game constructs');
  } catch (e) {
    ok(false, 'Game constructs', e.stack?.split('\n').slice(0, 5).join(' | '));
  }

  if (game) {
    try {
      await game.init(() => {});
      ok(true, 'Game.init completes');
    } catch (e) {
      ok(false, 'Game.init completes', e.stack?.split('\n').slice(0, 6).join(' | '));
    }

    if (game.world) {
      ok(game.mode === 'menu', 'boots into the main menu', game.mode);
      try {
        await game.newGame();
        ok(game.mode === 'playing', 'New Game enters play mode', game.mode);
        ok(game.missions.index === 0 && game.missions.started, 'the first mission starts');
        ok(Math.abs(game.player.position.z - worldZ(SPAWN.tz)) < 2, 'the player starts outside the gate');
        ok(!game.flags.powerOn, 'the building starts without power');
        ok(game.entity && !game.entity.active, 'the entity starts dormant');

        // 120 frames of simulation in the dark, outside
        let threw = null;
        try {
          for (let i = 0; i < 120; i++) game.update(1 / 60);
        } catch (e) { threw = e; }
        ok(!threw, '120 update ticks run without throwing', threw?.stack?.split('\n').slice(0, 4).join(' | '));
        ok(Number.isFinite(game.player.camera.position.y), 'camera position stays finite');
        ok(game.audio.started === false, 'audio degrades gracefully without WebAudio');

        // gate key -> gate opens -> walk into reception
        game.collectItem('gateKey', 'test');
        ok(game.inventory.has('gateKey'), 'the gate key can be picked up');
        game.outdoor.gate.unlock();
        game.outdoor.gate.toggle();
        game.flags.gateOpen = true;
        game.world.levels.gf && (game.player.position.z = 10);
        game.player.feetY = 0;
        game.flags.rooms.add('reception');
        game.missions.update(0.016);
        ok(game.missions.index >= 1, 'mission 1 completes once inside reception', `index ${game.missions.index}`);

        // generator: dry, then fuelled, then running
        game.world.levels.b1 && game.player.position.set(worldX(16), -5, worldZ(20));
        game.player.feetY = -5;
        game.useGenerator();
        ok(!game.flags.powerOn, 'the generator will not start without diesel');
        game.inventory.add('fuelCan');
        game.useGenerator();
        ok(game.flags.generatorFuelled, 'diesel fuels the generator');
        game.useGenerator();
        ok(game.flags.powerOn && game.world.power, 'the generator restores power');

        // CCTV
        game.sitAtCCTV();
        ok(game.mode === 'cctv' && game.cctv.seated, 'the CCTV desk can be sat at');
        try {
          game.cctv.renderFeeds(rendererStub);
          ok(true, 'CCTV feed rendering does not throw');
        } catch (e) { ok(false, 'CCTV feed rendering does not throw', e.message); }
        game.cctv.startAnomaly();
        for (let i = 0; i < 500; i++) game.cctv.update(1 / 60);
        ok(game.cctv.anomalyStage >= 2, 'the Camera 07 event advances', `stage ${game.cctv.anomalyStage}`);
        game.standFromCCTV();
        ok(game.mode === 'playing', 'standing up returns control');

        // hiding
        const hide = game.world.hides[0];
        if (hide) {
          game.enterHide(hide);
          ok(!!game.player.hiding, 'the player can hide');
          game.leaveHide();
          ok(!game.player.hiding, 'the player can leave the hiding place');
        }

        // save / load round-trip
        const snap = game.serialize();
        const before = { missions: game.missions.index, docs: game.inventory.documents.length, power: game.world.power };
        game.deserialize(snap);
        ok(game.missions.index === before.missions, 'save restores the mission index');
        ok(game.world.power === before.power, 'save restores the power state');
        ok(game.flags.powerOn === true, 'save restores flags');

        // document reading marks progress
        game.onDocumentRead('patientFile');
        ok(game.flags.docsRead.has('patientFile'), 'reading a document is recorded');

        // inventory UI renders with items
        try {
          game.ui.openInventory();
          ok(true, 'inventory UI renders');
          game.ui.closeInventory();
        } catch (e) { ok(false, 'inventory UI renders', e.message); }
      } catch (e) {
        ok(false, 'gameplay scenario runs', e.stack?.split('\n').slice(0, 6).join(' | '));
      }
    }
  }
}

// ------------------------------------------------------------------ summary
console.log(`\n${'─'.repeat(48)}`);
console.log(`  ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  · ${f}`);
}
process.exit(fail ? 1 : 0);
