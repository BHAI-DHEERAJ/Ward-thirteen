import * as THREE from 'three';
import { World } from './world/world.js';
import { Player, spawnPoint } from './gameplay/player.js';
import { Inventory } from './gameplay/inventory.js';
import { MissionSystem } from './gameplay/missions.js';
import { Interaction } from './gameplay/interaction.js';
import { Entity } from './gameplay/entity.js';
import { Director } from './gameplay/director.js';
import { CCTVSystem } from './gameplay/cctv.js';
import { itemFor, getDocument } from './gameplay/items.js';
import { AudioEngine } from './core/audio.js';
import { Input } from './core/input.js';
import { UI } from './ui/ui.js';
import { Save, Settings } from './core/save.js';
import { SPAWN, LEVEL_BY_ID, LEVELS, worldX, worldZ, GATE } from './world/layout.js';
import { createPickup } from './world/props.js';
import { roomBounds } from './world/decor.js';
import { makeCanvas } from './world/textures.js';
import { clamp, lerp } from './core/utils.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Game {
  constructor({ renderer, scene, camera, canvas }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;

    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.settings = Settings;
    this.flags = this.freshFlags();
    this.inventory = new Inventory();
    this.stats = { doorsOpened: 0, containersSearched: 0, itemsTaken: 0, docsRead: 0, distance: 0 };
    this.mode = 'loading';
    this.clock = 2 * 3600 + 47 * 60;
    this.time = 0;
    this.frameCount = 0;
    this.playTime = 0;
    this.menuTime = 0;
    this.checkpoint = null;
    this._saveTimer = null;
    this._hideDiscover = 0;
    this._introPlayed = false;
    this._lastLevel = 'gf';

    this.ui = new UI(this);
    this.onSettingsChanged = () => this.applySettings();
  }

  freshFlags() {
    return {
      gateOpen: false,
      powerOn: false,
      generatorFuelled: false,
      cctvAnomaly: false,
      entityActive: false,
      escaped: false,
      hiding: false,
      rooms: new Set(),
      docsRead: new Set(),
      visitedLevels: new Set(['gf']),
    };
  }

  // ------------------------------------------------------------------ boot
  async init(progress = () => {}) {
    progress(0.08, 'Pouring the foundations…');
    await wait(16);
    this.world = new World(this.scene, { onSound: (kind, data) => this.onWorldSound(kind, data) });
    this.outdoor = this.world.outdoor;
    progress(0.5, 'Breaking the windows…');
    await wait(16);

    for (const m of this.outdoor.interactives) this.world.interactMeshes.push(m);
    this.world.containers.forEach((c, i) => { c.userData.containerIndex = i; });
    this.world.pickups.forEach((p, i) => { p.group.userData.pickupIndex = i; });
    for (const level of Object.values(this.world.levels)) {
      for (const d of level.doors) {
        d.initialLocked = d.locked;
        d.initialKeyId = d.keyId;
      }
    }

    this.player = new Player(this.camera, this.world, this.input, this.audio, Settings.data);
    this.player.onRoom = (roomId) => this.onEnterRoom(roomId);
    this.player.onNoise = (strength) => this.noiseAt(this.player.position.x, this.player.position.z, strength);

    this.interaction = new Interaction(this);
    this.cctv = new CCTVSystem(this);
    this.cctv.buildHousings();
    this.cctv.buildConsole();
    progress(0.78, 'Waking something up…');
    await wait(16);

    this.entity = new Entity(this.world, this.audio, {
      onAttack: () => this.onEntityAttack(),
      onSeen: () => this.onEntitySeen(),
    });
    this.entity.onChaseStart = () => {
      this.world.surge = 1.4;
      this.subtitle('Run.', 1.8);
    };
    this.scene.add(this.entity.group);

    this.director = new Director(this);
    this.missions = new MissionSystem(this);
    this.buildSetPieces();
    this.buildHideProxies();

    progress(0.96, 'Turning off the lights…');
    await wait(60);

    this.applySettings();
    this.audio.setEnvironment({ inside: false, powered: false });
    this.resetToMenu();
    this.ui.setLoading(1, 'Ready');
    await wait(260);
    this.ui.showMenu(Save.exists());
  }

  resetToMenu() {
    this.mode = 'menu';
    this.menuTime = 0;
    this.ui.showMenu(Save.exists());
    this.ui.el.fade.style.opacity = '0';
    const sp = spawnPoint(SPAWN);
    this.player.reset({ x: sp.x, z: sp.z, y: sp.y, levelId: 'gf', yaw: 0 });
    this.entity.deactivate();
    this.director.clear();
  }

  applySettings() {
    const s = Settings.data;
    this.audio.setVolume(s.volume);
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.userData = this.renderer.userData || {};
    this.onQuality?.(s.quality);
    this.ui.applySettingsToInputs();
  }

  // ------------------------------------------------------------------ lifecycle
  async newGame() {
    this.audio.init();
    this.audio.resume();
    this.ui.el.fade.style.transition = 'opacity 800ms ease';
    this.ui.el.fade.style.opacity = '1';
    await wait(820);
    this.resetWorldState();
    this.flags = this.freshFlags();
    this.inventory = new Inventory();
    this.stats = { doorsOpened: 0, containersSearched: 0, itemsTaken: 0, docsRead: 0, distance: 0 };
    this.clock = 2 * 3600 + 47 * 60;
    this.playTime = 0;
    this.checkpoint = null;
    Save.clear();

    const sp = spawnPoint(SPAWN);
    this.player.reset({ x: sp.x, z: sp.z, y: sp.y, levelId: 'gf', yaw: 0 });
    this.player.setFlashlight(true);
    this.player.battery = 0.86;
    this.entity.deactivate();
    this.director.clear();
    this.director.cooldown = 30;

    this.ui.showHUD();
    this.ui.setBattery(this.player.battery);
    this.ui.setStamina(1);
    this.ui.setHealth(100);
    this.ui.setHideIndicator(false);
    this.mode = 'playing';
    this.audio.setEnvironment({ inside: false, powered: false });
    this.missions.start(0);
    this.ui.el.fade.style.opacity = '0';
    this.input.lock();
    this.audio.thunder(0.7);
    await wait(1200);
    this.ui.subtitle('2:47 AM. The gate is chained shut. Somebody left the cabin light on.', 6);
    this.ui.toast('WASD move · SHIFT run · E interact · F flashlight · TAB inventory');
    this.requestSave('start');
  }

  resetWorldState() {
    for (const level of Object.values(this.world.levels)) {
      for (const d of level.doors || []) {
        d.locked = d.initialLocked;
        d.keyId = d.initialKeyId;
        d.openAmount = 0;
        d.target = 0;
        d.angle = 0;
        for (const leaf of d.leaves || []) leaf.rotation.y = 0;
        d._updateCollider?.();
      }
    }
    for (const c of this.world.containers) {
      c.userData.container.searched = false;
      c.userData.setOpen?.(0);
    }
    for (const p of this.world.pickups) {
      if (p.group.userData.collected) {
        p.group.userData.collected = false;
        p.group.visible = true;
        if (!p.group.parent) {
          const lvl = this.world.levels[p.levelId];
          lvl?.group.add(p.group);
        }
      }
    }
    this.world.interactMeshes = this.world.interactMeshes.filter((m) => !m.userData?.pickupGroup?.userData?.collected);
    this.world.power = false;
    this.world.setPower(false);
    this.outdoor.gate.locked = true;
    this.outdoor.gate.open = 0;
    this.outdoor.gate.target = 0;
    for (const leaf of this.outdoor.gate.leaves || []) leaf.group.rotation.y = 0;
  }

  async continueGame() {
    const data = Save.load();
    if (!data) { this.newGame(); return; }
    this.audio.init();
    this.audio.resume();
    this.ui.el.fade.style.transition = 'opacity 700ms ease';
    this.ui.el.fade.style.opacity = '1';
    await wait(720);
    this.resetWorldState();
    this.deserialize(data);
    this.ui.showHUD();
    this.mode = 'playing';
    this.ui.el.fade.style.opacity = '0';
    this.input.lock();
    this.ui.setObjective(this.missions.current?.objective || '', this.missions.current?.hint || '');
    this.ui.subtitle(`Checkpoint — ${LEVEL_BY_ID[this.player.levelId]?.name || 'Hospital'}`, 4);
  }

  async resume() {
    if (this.mode !== 'paused') return;
    this.ui.closePause();
    this.mode = 'playing';
    this.input.lock();
    this.audio.resume();
  }

  pause() {
    if (this.mode !== 'playing' && this.mode !== 'inventory') return;
    if (this.mode === 'inventory') this.ui.closeInventory();
    this.mode = 'paused';
    this.ui.openPause();
    this.input.clear();
    this.input.unlock();
    this.requestSave('pause');
  }

  toMainMenu() {
    this.requestSave('menu');
    this.mode = 'menu';
    this.ui.closePause();
    this.ui.hideCCTV();
    this.entity.deactivate();
    this.director.clear();
    this.input.unlock();
    this.audio.elevatorMotor(false);
    this.resetToMenu();
  }

  async quitToDesktop() {
    this.ui.showEnding(
      'THE HOSPITAL IS STILL WAITING',
      'You can close this tab. The lights will stay on until you do.',
      [['TIME INSIDE', this.formatClock(this.clock)], ['MISSIONS', `${this.missions?.completed.length || 0} / 13`]]
    );
    this.input.unlock();
    this.mode = 'ending';
  }

  restartCheckpoint() {
    if (!this.checkpoint) this.checkpoint = this.serialize();
    this.ui.closePause();
    this.ui.el.fade.style.opacity = '1';
    setTimeout(async () => {
      this.resetWorldState();
      this.deserialize(this.checkpoint);
      this.mode = 'playing';
      this.ui.showHUD();
      this.ui.el.fade.style.opacity = '0';
      this.input.lock();
      this.ui.subtitle('You come back to yourself. The same corridor. The same hour.', 4);
    }, 700);
  }

  closeInventory() {
    this.ui.closeInventory();
    this.mode = 'playing';
    this.input.lock();
  }

  // ------------------------------------------------------------------ per-frame
  update(dt) {
    this.frameCount++;
    this.time += dt;
    const mode = this.mode;

    // world simulation always runs (doors, lifts, lights, weather)
    if (this.world) {
      for (const lvl of Object.values(this.world.levels)) {
        for (const d of lvl.doors || []) d.update(dt);
      }
      for (const lift of this.world.elevators) lift.update(dt);
      this.world.updateLights(dt, this.camera);
      this.world.updateVisibility(this.camera);
      this.outdoor.update(dt, this.time);
    }

    if (mode === 'menu') {
      this.menuTime += dt;
      this.updateMenuCamera();
      this.audio.update(dt, { entityDistance: 99 });
      return;
    }

    if (mode === 'loading' || mode === 'ending' || mode === 'dying') return;

    const playing = mode === 'playing';
    const inCCTV = mode === 'cctv';

    if (mode === 'inventory' || mode === 'document' || mode === 'cctv') this.handleUIInput(dt);

    if (playing) {
      this.playTime += dt;
      this.clock += dt * 1.0;
      this.handleInput(dt);
    }

    if (playing || inCCTV) {
      if (playing) {
        this.player.update(dt, { uiBlocking: false });
        this.interaction.update(dt);
        this.missions.update(dt);
        this.updateHUD();
      }
      this.director.update(dt);
      this.updateTVs(dt);
      const ed = this.entity?.active ? this.entity.distanceTo(this.player) : 99;
      this.entity?.update(dt, this.player, this);
      this.audio.update(dt, { entityDistance: ed, moving: this.player.speed > 0.4 });

      // hidden player discovered
      if (this.player.hiding && this.entity.active && this.entity.distanceTo(this.player) < 2.4) {
        this._hideDiscover += dt;
        this.audio.entityBreath(0, 0.4);
        if (this._hideDiscover > 5.5) {
          this._hideDiscover = 0;
          this.leaveHide(true);
          this.onEntityAttack();
        }
      } else this._hideDiscover = Math.max(0, this._hideDiscover - dt);

      this.audio.setEnvironment({ inside: this.isInside(), powered: this.world.power });
      if (playing && !this.player.alive) this.onDeath();
    } else if (mode === 'inventory' || mode === 'document') {
      this.player.update(dt, { uiBlocking: true });
    }

    if (inCCTV) {
      this.cctv.update(dt);
      this.ui.updateCCTV(this.clockString());
    }
  }

  render() {
    if (!this.world) return;
    this.cctv.renderFeeds(this.renderer);
    this.onRender?.(this);
  }

  updateMenuCamera() {
    const t = this.menuTime;
    const x = Math.sin(t * 0.045) * 3.4;
    const z = 36.5 + Math.cos(t * 0.037) * 1.6;
    this.camera.position.set(x, 2.35 + Math.sin(t * 0.11) * 0.06, z);
    this.camera.rotation.set(-0.012, Math.PI + Math.sin(t * 0.06) * 0.05, 0, 'YXZ');
    // subtle handheld drift
    this.camera.rotation.z = Math.sin(t * 0.21) * 0.0035;
  }

  handleInput(dt) {
    const i = this.input;
    this.ui.el.crosshair.style.opacity = this.mode === 'playing' ? '1' : '0';

    if (i.hit('Escape')) {
      if (this.mode === 'playing') this.pause();
      return;
    }
    if (i.hit('Tab') || i.hit('KeyJ')) {
      this.mode = 'inventory';
      this.input.unlock();
      this.ui.openInventory();
      i.consume('Tab');
      return;
    }
    if (i.hit('KeyF')) {
      this.player.toggleFlashlight();
      this.ui.setFlashlight(this.player.flashOn);
      i.consume('KeyF');
    }
    if (i.hit('KeyE')) {
      i.consume('KeyE');
      if (this.player.hiding) this.leaveHide();
      else this.interaction.interact();
    }
    if (i.hit('KeyG')) {
      i.consume('KeyG');
      this.quickDrop();
    }
    if (i.hit('KeyQ')) {
      i.consume('KeyQ');
      const doc = this.inventory.documents[this.inventory.documents.length - 1];
      if (doc) { this.mode = 'document'; this.input.unlock(); this.ui.openDocument(doc); }
      else this.toast('You are carrying nothing to read.');
    }

    // locked pointer recovery
    if (!this.input.locked && this.mode === 'playing' && !this._relocking) {
      this._relocking = true;
      this.canvas.addEventListener('click', () => {
        this._relocking = false;
        if (this.mode === 'playing') this.input.lock();
      }, { once: true });
    }
  }

  handleUIInput(dt) {
    const i = this.input;
    if (this.mode === 'inventory') {
      if (i.hit('Tab') || i.hit('KeyJ') || i.hit('Escape')) {
        i.consume('Tab'); i.consume('Escape');
        this.closeInventory();
      }
      return;
    }
    if (this.mode === 'document') {
      if (i.hit('KeyE') || i.hit('Escape') || i.hit('Tab')) {
        i.consume('KeyE'); i.consume('Escape'); i.consume('Tab');
        this.ui.closeDocument();
        this.mode = 'playing';
        if (this.player.hiding) this.input.unlock();
        else this.input.lock();
      }
      return;
    }
    if (this.mode === 'cctv') {
      for (let n = 1; n <= 4; n++) {
        if (i.hit(`Digit${n}`)) {
          i.consume(`Digit${n}`);
          this.cctv.setFocus(n - 1);
          this.audio.uiSelect();
          const cam = this.cctv.items[n - 1]?.cam;
          if (cam) this.ui.setCCTVMessage(`MONITOR 0${n} — ${cam.id} — ${cam.name}`);
        }
      }
      if (i.hit('Space') || i.hit('KeyE') || i.hit('Escape')) {
        i.consume('Space'); i.consume('KeyE'); i.consume('Escape');
        this.standFromCCTV();
      }
      this.cctv.update(0);
    }
  }

  updateHUD() {
    this.ui.setBattery(this.player.battery);
    this.ui.setStamina(this.player.stamina);
    this.ui.setHealth(this.player.health);
  }

  // ------------------------------------------------------------------ actions
  onWorldSound(kind, door) {
    if (kind === 'open' || kind === 'close') {
      const p = this.player;
      const pan = door ? clamp((door.worldX - p.position.x) / 9, -1, 1) : 0;
      if (kind === 'open') this.audio.doorOpen(pan);
      else this.audio.doorClose(pan);
      return;
    }
    if (kind === 'unlock') { this.audio.unlock(); return; }
    if (kind === 'locked') { this.audio.locked(); return; }
    if (kind === 'elevator_bell') { this.audio.elevatorBell(); return; }
    if (kind === 'elevator_motor') { this.audio.elevatorMotor(true); return; }
    if (kind === 'elevator_stop') { this.audio.elevatorMotor(false); return; }
    if (kind === 'elevator_doors') { this.audio.doorOpen(0); return; }
  }

  collectItem(id, source, group) {
    const def = itemFor(id);
    const res = this.inventory.add(id, 1);
    if (!res.ok) {
      if (res.full) { this.toast('Your pockets are full.'); this.audio.pickupDenied(); return; }
      if (res.duplicate) { this.toast('You already have that document.'); return; }
    }
    this.stats.itemsTaken++;
    this.audio.pickup();
    if (def.kind === 'documents') {
      this.toast(`Document — ${def.name}`);
      this.subtitle('Added to your journal. TAB to read.', 3.2);
    } else if (id === 'battery') {
      this.toast('Battery collected');
    } else if (id === 'fuelCan') {
      this.toast('Diesel can collected');
    } else {
      this.toast(`${def.name} collected`);
    }
    if (id === 'gateKey') this.subtitle('A gate key. The chain outside is the only way in.', 4);
    if (group) this.removePickup(group);
  }

  removePickup(group) {
    group.userData.collected = true;
    group.visible = false;
    group.parent?.remove(group);
    this.world.interactMeshes = this.world.interactMeshes.filter((m) => m.userData?.pickupGroup !== group);
    this.requestSave('pickup');
  }

  dropItem(id) {
    if (!this.inventory.has(id)) return;
    this.inventory.remove(id, 1);
    const g = createPickup(itemFor(id).pickup || 'battery');
    const p = this.player;
    const y = this.world.sampleGround(p.position.x, p.position.z, p.feetY)?.y ?? p.feetY;
    g.position.set(p.position.x + 0.5, y + 0.05, p.position.z);
    g.userData.pickupId = id;
    g.traverse((o) => { if (o.isMesh) o.userData.pickupGroup = g; });
    const lvl = this.world.levels[p.levelId];
    (lvl?.group || this.scene).add(g);
    g.traverse((o) => { if (o.isMesh) this.world.interactMeshes.push(o); });
    this.world.pickups.push({ id, group: g, levelId: p.levelId });
    this.audio.pickup();
    this.toast(`Dropped ${itemFor(id).name}`);
    this.noiseAt(p.position.x, p.position.z, 0.3);
    this.requestSave('drop');
  }

  quickDrop() {
    const slot = this.inventory.slots[this.inventory.slots.length - 1];
    if (!slot) { this.toast('Nothing to drop.'); return; }
    this.dropItem(slot.id);
  }

  useGenerator() {
    if (this.flags.powerOn) { this.toast('The generator is already running.'); return; }
    if (!this.flags.generatorFuelled) {
      if (!this.inventory.has('fuelCan')) {
        this.audio.pickupDenied();
        this.subtitle('The tank is dry. There must be diesel in the basement storage.', 5);
        return;
      }
      this.inventory.remove('fuelCan', 1);
      this.flags.generatorFuelled = true;
      this.audio.search();
      this.toast('Diesel poured into the tank');
      this.subtitle('The tank takes the whole can. Now the starter.', 3.5);
      return;
    }
    this.audio.generatorStart();
    this.world.setPower(true);
    this.flags.powerOn = true;
    this.world.surge = 2.4;
    this.toast('POWER RESTORED');
    this.subtitle('Somewhere above you, four floors of lights stutter awake.', 5);
    this.player.heal(10);
    setTimeout(() => this.startEntity(), 15000);
    this.requestSave('power');
  }

  startEntity() {
    if (this.flags.entityActive) return;
    this.flags.entityActive = true;
    const lvl = this.player.levelId;
    const level = this.world.levels[lvl] || this.world.levels.gf;
    const rooms = (level.rooms || []).filter((r) => !r.open);
    const far = rooms.reduce((acc, r) => {
      const cx = worldX((r.x1 + r.x2) / 2);
      const cz = worldZ((r.z1 + r.z2) / 2);
      const d = Math.hypot(cx - this.player.position.x, cz - this.player.position.z);
      return d > acc.d ? { d, x: cx, z: cz } : acc;
    }, { d: -1, x: 0, z: 0 });
    this.entity.activate(level.id, Math.floor((far.x + 48) / 2), Math.floor((far.z + 40) / 2));
    this.audio.sting();
    this.subtitle('Something moved. Not a curtain. Not the wind.', 5);
    this.world.surge = 1.2;
    this.requestSave('entity');
  }

  sitAtCCTV() {
    if (!this.world.power) {
      this.audio.pickupDenied();
      this.subtitle('Dead screens. The building needs power first.', 4);
      return;
    }
    if (!this.cctv.built) return;
    this.mode = 'cctv';
    this.cctv.sit();
    this.input.unlock();
    this.ui.showCCTV();
    this.player.frozen = true;
    this.camera.position.set(this.cctv.seat.x, this.cctv.seat.y + 1.22, this.cctv.seat.z);
    this.camera.rotation.set(this.cctv.seat.pitch, this.cctv.seat.yaw, 0, 'YXZ');
    this.audio.radioStatic(0.6);
    this.ui.setCCTVMessage('MONITOR 04 — CAM 07 — WARD 13 CORRIDOR');
    this.subtitle('The chair is still warm.', 3);
  }

  standFromCCTV() {
    this.mode = 'playing';
    this.cctv.stand();
    this.ui.hideCCTV();
    this.player.frozen = false;
    const p = this.player;
    this.camera.position.set(p.position.x, p.feetY + p.eyeHeight, p.position.z);
    this.camera.rotation.set(p.pitch, p.yaw + Math.PI, 0, 'YXZ');
    this.input.lock();
  }

  onCCTVAnomaly() {
    if (this.flags.cctvAnomaly) return;
    this.flags.cctvAnomaly = true;
    this.audio.sting();
    this.ui.setCCTVMessage('SIGNAL LOST — CAM 07');
    this.subtitle('There was a figure in the corridor. Camera 07. The corridor is empty now.', 7);
    this.world.surge = 1.8;
    this.requestSave('cctv');
    setTimeout(() => {
      this.ui.setCCTVMessage('MONITOR 04 — CAM 07 — NO SIGNAL');
    }, 2600);
  }

  enterHide(spot) {
    if (this.player.hiding) { this.leaveHide(); return; }
    const ground = this.world.sampleGround(spot.x, spot.z, this.player.feetY);
    this.player.feetY = ground ? ground.y : this.player.feetY;
    this.player.position.set(spot.x, this.player.feetY, spot.z);
    this.player.startHide(spot);
    this.flags.hiding = true;
    this.player.setFlashlight(false);
    this.ui.setHideIndicator(true, 'HIDING — <b>E</b> to leave');
    this.subtitle(spot.type === 'underbed' ? 'You slide under the bed. Dust. Cold floor.' : 'You pull the door almost shut.', 3.5);
    this.requestSave('hide');
  }

  leaveHide(force = false) {
    if (!this.player.hiding) return;
    const spot = this.player.hiding;
    this.player.stopHide();
    this.flags.hiding = false;
    this.ui.setHideIndicator(false);
    // step out in front of the hiding place
    const ahead = 1.0;
    this.player.position.x = spot.x + Math.sin(spot.ry || 0) * ahead;
    this.player.position.z = spot.z + Math.cos(spot.ry || 0) * ahead;
    if (force) this.audio.sting();
    this.noiseAt(this.player.position.x, this.player.position.z, 0.6);
  }

  onEnterRoom(roomId) {
    if (!this.flags.rooms.has(roomId)) {
      this.flags.rooms.add(roomId);
      this.requestSave('room');
    }
    if (this.player.levelId !== this._lastLevel) {
      this._lastLevel = this.player.levelId;
      this.flags.visitedLevels.add(this.player.levelId);
      const lvl = LEVEL_BY_ID[this.player.levelId];
      if (lvl && !this._announcedLevels?.has(lvl.id)) {
        this._announcedLevels = this._announcedLevels || new Set();
        this._announcedLevels.add(lvl.id);
        this.subtitle(lvl.name, 4.5);
      }
    }
  }

  onDocumentRead(id) {
    if (!id) return;
    const first = !this.flags.docsRead.has(id);
    this.flags.docsRead.add(id);
    if (first) {
      this.stats.docsRead++;
      const doc = getDocument(id);
      if (doc?.title) this.ui.subtitle(`${doc.title}`, 2.6);
    }
    // documents unlock things
    if (id === 'doc_truth') this.onTruthFound();
    this.requestSave('document');
  }

  onTruthFound() {
    if (this.flags.truthKnown) return;
    this.flags.truthKnown = true;
    this.director.surge = 3;
    this.world.surge = 3;
    this.audio.sting();
    setTimeout(() => this.audio.rumble(), 500);
    this.subtitle('You understand now. That is the worst part.', 6);
  }

  triggerEscape() {
    if (!this.flags.docsRead.has('doc_truth')) {
      this.audio.locked();
      this.subtitle('The passage is chained. You do not understand enough yet.', 4);
      return;
    }
    if (this.flags.escaped) return;
    this.flags.escaped = true;
    this.missions.completeMission(this.missions.index);
    this.missions.update(0.016);
    this.audio.rumble();
    this.ending();
  }

  async ending() {
    this.mode = 'ending';
    this.player.frozen = true;
    this.input.unlock();
    await this.ui.fade(1, 1600);
    this.audio.setEnvironment({ inside: false, powered: false });
    this.ui.showEnding(
      'YOU MADE IT OUT',
      `The gate is still open behind you. At 2:47 AM the ward lights come on, one window at a time, and stay on.\n\nWard Thirteen was never closed. It was only waiting for someone to count the beds.`,
      [
        ['TIME INSIDE', this.formatClock(this.playTime)],
        ['MISSIONS', `${this.missions.completed.length} / 13`],
        ['DOCUMENTS', `${this.inventory.documents.length}`],
        ['ROOMS ENTERED', `${this.flags.rooms.size}`],
      ]
    );
    this.ui.el.fade.style.opacity = '0';
    this.audio.missionComplete();
  }

  onEntitySeen() {
    this.audio.sting();
    this.subtitle('At the end of the corridor. It is not moving.', 4);
    this.world.surge = 1.2;
  }

  onEntityAttack() {
    if (this.mode !== 'playing') return;
    const dead = this.player.damage(48);
    this.ui.damageFlash(1);
    this.audio.sting();
    this.audio.rumble();
    this.player.pitch += 0.16;
    this.subtitle('Cold hands. Then nothing.', 3);
    this.world.surge = 2.2;
    this.entity.teleportAway(this.player);
    if (dead) this.onDeath();
  }

  async onDeath() {
    if (this.mode === 'dying') return;
    this.mode = 'dying';
    this.player.alive = false;
    this.player.frozen = true;
    this.input.unlock();
    this.audio.elevatorMotor(false);
    await this.ui.fade(1, 1400);
    this.ui.subtitle('You lost consciousness.', 3);
    this.audio.heartbeat(1);
    await wait(1600);
    if (this.checkpoint) {
      this.resetWorldState();
      this.deserialize(this.checkpoint);
      this.player.health = 55;
      this.player.alive = true;
      this.player.frozen = false;
      this.mode = 'playing';
      this.ui.showHUD();
      this.ui.el.fade.style.opacity = '0';
      this.input.lock();
      this.ui.subtitle('You wake where you last felt safe. It let you go.', 4.5);
    } else {
      this.player.health = 100;
      this.player.alive = true;
      this.player.frozen = false;
      const sp = spawnPoint(SPAWN);
      this.player.reset({ x: sp.x, z: sp.z, y: sp.y, levelId: 'gf', yaw: 0 });
      this.mode = 'playing';
      this.ui.showHUD();
      this.ui.el.fade.style.opacity = '0';
      this.input.lock();
    }
  }

  noiseAt(x, z, strength) {
    if (!this.entity?.active) return;
    this.entity.hearNoise(x, z, strength);
  }

  isInside() {
    const p = this.player;
    if (!p) return false;
    if (Math.abs(p.feetY) > 0.8) return true;
    return p.position.z < 14.6;
  }

  levelName(id) {
    return LEVEL_BY_ID[id]?.name || 'Hospital';
  }

  clockString() {
    const c = this.clock % 86400;
    const h = Math.floor(c / 3600);
    const m = Math.floor((c % 3600) / 60);
    const s = Math.floor(c % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  formatClock(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }

  toast(msg) { this.ui.toast(msg); }
  subtitle(text, dur) { this.ui.subtitle(text, dur); }
  flashScreen(v = 0.35) { this.ui.flashWhite(v); }

  // ------------------------------------------------------------------ set pieces
  buildSetPieces() {
    this._buildGenerator();
    this._buildEscape();
    this._buildExitSigns();
    this._buildTVs();
  }

  _buildGenerator() {
    const lvl = this.world.levels.b1;
    const room = (lvl.rooms || []).find((r) => r.id === 'generator');
    if (!room) return;
    const b = roomBounds(room);
    const x = (b.x0 + b.x1) / 2;
    const z = b.z0 + 1.7;
    const y = lvl.y;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.72, metalness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d1b, roughness: 0.9, metalness: 0.2 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.95 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 1.3), dark);
    base.position.y = 0.16;
    g.add(base);
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 1.0), steel);
    block.position.set(-0.15, 0.88, 0);
    g.add(block);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 1.05), steel);
    housing.position.set(1.05, 0.98, 0);
    g.add(housing);
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.1, 0.9), rust);
      fin.position.set(1.2 + i * 0.05, 0.98, 0);
      g.add(fin);
    }
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 10), dark);
    exhaust.position.set(-0.4, 2.2, 0.1);
    g.add(exhaust);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 8), steel);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0.2, 1.85, -0.55);
    g.add(pipe);
    // control panel
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.12), dark);
    panel.position.set(0.45, 1.15, 0.6);
    g.add(panel);
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), new THREE.MeshBasicMaterial({ color: 0xbfc8b0 }));
    gauge.position.set(0.35, 1.28, 0.67);
    g.add(gauge);
    this.genLed = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xa02010 }));
    this.genLed.position.set(0.62, 1.26, 0.58);
    g.add(this.genLed);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.12), new THREE.MeshBasicMaterial({
      map: this._textTexture('EMERGENCY GENERATOR', 256, 48),
      transparent: true,
    }));
    label.position.set(0, 1.62, 0.52);
    g.add(label);
    const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), steel);
    fuelTank.rotation.z = Math.PI / 2;
    fuelTank.position.set(-1.45, 0.62, 0);
    g.add(fuelTank);

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    lvl.group.add(g);

    const proxy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 1.5), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(x, y + 0.85, z + 0.2);
    proxy.userData.generator = true;
    lvl.group.add(proxy);
    this.interaction.addInteractive(proxy);
    lvl.colliders.push({ minX: x - 1.4, maxX: x + 1.4, minZ: z - 0.7, maxZ: z + 0.7 });

    const glow = new THREE.PointLight(0xbfc7a8, 2.0, 6, 2);
    glow.position.set(x, y + 2.3, z + 1.2);
    lvl.group.add(glow);
  }

  _buildEscape() {
    const lvl = this.world.levels.w13;
    if (!lvl) return;
    const room = (lvl.rooms || []).find((r) => r.id === 'w13Escape');
    if (!room) return;
    const b = roomBounds(room);
    const x = (b.x0 + b.x1) / 2;
    const z = b.z0 + 0.35;
    const y = lvl.y;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.9 }));
    frame.position.y = 1.2;
    g.add(frame);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.1, 0.16), new THREE.MeshStandardMaterial({ color: 0x4a4a3c, roughness: 0.85, metalness: 0.3 }));
    door.position.set(0, 1.05, 0.12);
    g.add(door);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.1), new THREE.MeshStandardMaterial({ color: 0x6d6a52, roughness: 0.6, metalness: 0.6 }));
    bar.position.set(0, 1.0, 0.24);
    g.add(bar);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({
      map: this._textTexture('EMERGENCY EXIT', 256, 64, '#3a1a12', '#ff8a5c'),
      transparent: true,
    }));
    sign.position.set(0, 2.32, 0.17);
    g.add(sign);
    const lamp = new THREE.PointLight(0xff7040, 1.2, 3.4, 2);
    lamp.position.set(0, 2.3, 0.5);
    g.add(lamp);
    lvl.group.add(g);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(x, y + 1.1, z + 0.6);
    proxy.userData.escapeExit = true;
    lvl.group.add(proxy);
    this.interaction.addInteractive(proxy);
  }

  /**
   * Televisions that turn themselves on. Most of the time the screen is dead
   * glass; occasionally it fills with snow and, rarely, with a word.
   */
  _buildTVs() {
    this.tvs = [];
    const specs = [
      { level: 'gf', room: 'waiting', words: ['STILL HERE', '13', 'DO NOT COUNT THE BEDS'] },
      { level: 'f1', room: 'nurses', words: ['02:47', 'SHE IS AWAKE', 'KEEP THE DOOR SHUT'] },
      { level: 'f4', room: 'activity', words: ['LET ME OUT', 'ADRIEN', 'IT IS STILL RUNNING'] },
    ];
    const shell = new THREE.MeshStandardMaterial({ color: 0x3a3733, roughness: 0.85, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14130f, roughness: 0.9 });
    for (const spec of specs) {
      const lvl = this.world.levels[spec.level];
      const room = (lvl?.rooms || []).find((r) => r.id === spec.room);
      if (!room) continue;
      const b = roomBounds(room);
      const x = b.x0 + 2.4;
      const z = b.z0 + 1.0;
      const y = lvl.y;

      const g = new THREE.Group();
      g.position.set(x, y, z);
      // a low cabinet to stand it on
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.62, 0.55), dark);
      cab.position.y = 0.31;
      g.add(cab);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.62, 0.46), shell);
      body.position.y = 0.95;
      g.add(body);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.3), shell);
      back.position.set(0, 0.95, -0.2);
      g.add(back);

      const c = makeCanvas(128, 96);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 128, 96);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0x2a2a2a });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), screenMat);
      screen.position.set(0, 0.97, 0.235);
      g.add(screen);
      // glass sheen
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.5), new THREE.MeshBasicMaterial({
        color: 0x2b3a3a, transparent: true, opacity: 0.12, depthWrite: false,
      }));
      glass.position.set(0, 0.97, 0.24);
      g.add(glass);

      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      lvl.group.add(g);
      lvl.colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.35, maxZ: z + 0.35 });

      this.tvs.push({
        levelId: spec.level, words: spec.words, x, z, y,
        canvas: c, ctx, tex, mat: screenMat,
        on: false, timer: 25 + Math.random() * 50, word: null, wordTimer: 0, drawTimer: 0,
      });
    }
  }

  updateTVs(dt) {
    if (!this.tvs || this.mode !== 'playing') return;
    const p = this.player;
    for (const tv of this.tvs) {
      if (tv.levelId !== p.levelId) { if (tv.on) { tv.on = false; tv.mat.color.setScalar(0.16); } continue; }
      const dist = Math.hypot(tv.x - p.position.x, tv.z - p.position.z);
      if (dist > 20) continue;
      tv.timer -= dt;
      if (tv.timer <= 0) {
        tv.on = !tv.on;
        tv.timer = tv.on ? 5 + Math.random() * 9 : 30 + Math.random() * 70;
        if (tv.on) {
          tv.mat.color.setScalar(1);
          this.audio.radioStatic(0.9);
          if (dist < 9) this.noiseAt(tv.x, tv.z, 0.35);
          tv.word = Math.random() < 0.45 ? tv.words[Math.floor(Math.random() * tv.words.length)] : null;
          tv.wordTimer = tv.word ? 1.6 : 0;
        } else {
          tv.mat.color.setScalar(0.16);
          this.audio.electrical();
        }
      }
      if (tv.on) {
        tv.wordTimer = Math.max(0, tv.wordTimer - dt);
        tv.drawTimer -= dt;
        if (tv.drawTimer <= 0) {
          tv.drawTimer = 0.09;
          this._drawTV(tv);
        }
      }
    }
  }

  _drawTV(tv) {
    const { ctx } = tv;
    const img = ctx.createImageData(128, 96);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 20 + Math.random() * 150;
      d[i] = v * 0.92; d[i + 1] = v; d[i + 2] = v * 0.95; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // rolling bright band
    const band = (this.time * 42) % 120;
    ctx.fillStyle = 'rgba(220,235,225,0.10)';
    ctx.fillRect(0, band, 128, 8);
    if (tv.word && tv.wordTimer > 0) {
      ctx.fillStyle = 'rgba(6,8,6,0.72)';
      ctx.fillRect(0, 34, 128, 28);
      ctx.fillStyle = '#d8e4d0';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tv.word, 64 + (Math.random() - 0.5) * 3, 48);
    }
    tv.tex.needsUpdate = true;
  }

  _buildExitSigns() {
    // a few unlit exit plates that help orientation in the stairwells
    for (const id of ['gf', 'f1', 'f2', 'f3', 'f4', 'f5']) {
      const lvl = this.world.levels[id];
      if (!lvl) continue;
      const mat = new THREE.MeshBasicMaterial({ map: this._textTexture('EXIT', 128, 48, '#101a10', '#7ce08a'), transparent: true });
      for (const sx of [-42.5, 42.5]) {
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), mat);
        plate.position.set(sx, lvl.y + 2.35, worldZ(15.9));
        plate.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
        lvl.group.add(plate);
      }
    }
  }

  _textTexture(text, w = 256, h = 64, bg = '#141712', fg = '#c8c2a6') {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(2, h * 0.05);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    ctx.fillStyle = fg;
    ctx.font = `600 ${Math.round(h * 0.42)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 1);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildHideProxies() {
    let count = 0;
    for (const hide of this.world.hides) {
      const lvl = this.world.levels[hide.levelId || this.player?.levelId || 'gf'];
      if (!lvl) continue;
      const isBed = hide.type === 'underbed';
      const geo = isBed ? new THREE.BoxGeometry(1.9, 0.5, 1.0) : new THREE.BoxGeometry(1.0, 2.0, 0.7);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
      const ground = this.world.sampleGround(hide.x, hide.z, lvl.y);
      m.position.set(hide.x, (ground?.y ?? lvl.y) + (isBed ? 0.25 : 1.0), hide.z);
      m.rotation.y = hide.ry || 0;
      hide.y = ground?.y ?? lvl.y;
      m.userData.hideSpot = hide;
      lvl.group.add(m);
      this.interaction.addInteractive(m);
      count++;
    }
    return count;
  }

  // ------------------------------------------------------------------ persistence
  serialize() {
    const doors = [];
    for (const level of Object.values(this.world.levels)) {
      for (const d of level.doors || []) {
        if (!d.locked || d.openAmount > 0.05) doors.push({ id: d.id, locked: d.locked, open: d.openAmount });
      }
    }
    return {
      v: 1,
      clock: this.clock,
      playTime: this.playTime,
      flags: {
        ...this.flags,
        rooms: [...this.flags.rooms],
        docsRead: [...this.flags.docsRead],
        visitedLevels: [...this.flags.visitedLevels],
      },
      inventory: this.inventory.toJSON(),
      missions: this.missions.toJSON(),
      player: this.player.toJSON(),
      stats: this.stats,
      doors,
      containers: this.world.containers.map((c, i) => (c.userData.container.searched ? i : -1)).filter((i) => i >= 0),
      pickups: this.world.pickups.map((p, i) => (p.group.userData.collected ? i : -1)).filter((i) => i >= 0),
      power: this.world.power,
    };
  }

  requestSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try {
        this.checkpoint = this.serialize();
        Save.write(this.checkpoint);
      } catch (e) { console.warn('save failed', e); }
    }, 900);
  }

  deserialize(data) {
    if (!data) return;
    const f = data.flags || {};
    this.flags = {
      ...this.freshFlags(),
      ...f,
      rooms: new Set(f.rooms || []),
      docsRead: new Set(f.docsRead || []),
      visitedLevels: new Set(f.visitedLevels || ['gf']),
    };
    this.clock = data.clock ?? this.clock;
    this.playTime = data.playTime || 0;
    this.inventory.fromJSON(data.inventory);
    this.missions.fromJSON(data.missions);
    this.stats = { doorsOpened: 0, containersSearched: 0, itemsTaken: 0, docsRead: 0, distance: 0, ...(data.stats || {}) };
    this.player.fromJSON(data.player);
    this._lastLevel = this.player.levelId;

    for (const rec of data.doors || []) {
      const [levelId] = String(rec.id).split(':');
      const level = this.world.levels[levelId];
      const door = level?.doors.find((d) => d.id === rec.id);
      if (!door) continue;
      door.locked = rec.locked;
      door.target = rec.open > 0.5 ? 1 : 0;
      door.openAmount = rec.open || 0;
      door._updateCollider?.();
    }
    for (const i of data.containers || []) {
      const c = this.world.containers[i];
      if (!c) continue;
      c.userData.container.searched = true;
      c.userData.setOpen?.(1);
    }
    for (const i of data.pickups || []) {
      const p = this.world.pickups[i];
      if (!p) continue;
      p.group.userData.collected = true;
      p.group.visible = false;
      p.group.parent?.remove(p.group);
    }
    this.world.interactMeshes = this.world.interactMeshes.filter((m) => !m.userData?.pickupGroup?.userData?.collected);

    this.world.setPower(!!data.power);
    this.outdoor.gate.locked = !this.flags.gateOpen;
    this.outdoor.gate.target = this.flags.gateOpen ? 1 : 0;
    this.outdoor.gate.open = this.flags.gateOpen ? 1 : 0;
    for (const leaf of this.outdoor.gate.leaves || []) leaf.group.rotation.y = -leaf.side * this.outdoor.gate.open * 1.35 * (this.outdoor.gate.open * this.outdoor.gate.open * (3 - 2 * this.outdoor.gate.open));

    if (this.flags.entityActive) this.startEntity();
    this.ui.setBattery(this.player.battery);
    this.ui.setHealth(this.player.health);
    this.ui.setObjective(this.missions.current?.objective || '', this.missions.current?.hint || '');
  }
}
