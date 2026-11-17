import * as THREE from 'three';
import { itemFor, getDocument } from './items.js';

const RANGE = 2.9;

function ancestorVisible(o) {
  let n = o;
  for (let i = 0; i < 8 && n; i++) {
    if (!n.visible) return false;
    n = n.parent;
  }
  return true;
}

export class Interaction {
  constructor(game) {
    this.game = game;
    this.ray = new THREE.Raycaster();
    this.ray.far = RANGE;
    this.center = new THREE.Vector2(0, 0);
    this.target = null;
    this.prompt = null;
    this.extra = [];      // game-added interactables (CCTV console, generator, notes)
    this.cooldown = 0;
  }

  addInteractive(obj) { this.extra.push(obj); }

  candidates() {
    const w = this.game.world;
    const list = this.extra;
    return { list: list.concat(w.interactMeshes) };
  }

  update(dt) {
    const game = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (game.mode !== 'playing') { this.setTarget(null); return; }

    this.ray.setFromCamera(this.center, game.player.camera);
    const meshes = game.world.interactMeshes.concat(this.extra);
    const hits = this.ray.intersectObjects(meshes, false);
    let hit = null;
    for (const h of hits) {
      if (!ancestorVisible(h.object)) continue;
      hit = h;
      break;
    }
    if (!hit) { this.setTarget(null); return; }

    const obj = hit.object;
    const ud = obj.userData;
    if (ud.door) this.setTarget({ kind: 'door', door: ud.door, obj, dist: hit.distance });
    else if (ud.containerGroup) this.setTarget({ kind: 'container', group: ud.containerGroup, obj, dist: hit.distance });
    else if (ud.pickupGroup) this.setTarget({ kind: 'pickup', group: ud.pickupGroup, obj, dist: hit.distance });
    else if (ud.gate) this.setTarget({ kind: 'gate', gate: ud.gate, obj, dist: hit.distance });
    else if (ud.elevatorButton) this.setTarget({ kind: 'elevator', data: ud.elevatorButton, obj, dist: hit.distance });
    else if (ud.cctvConsole) this.setTarget({ kind: 'cctv', obj, dist: hit.distance });
    else if (ud.generator) this.setTarget({ kind: 'generator', obj, dist: hit.distance });
    else if (ud.hideSpot) this.setTarget({ kind: 'hide', spot: ud.hideSpot, obj, dist: hit.distance });
    else if (ud.escapeExit) this.setTarget({ kind: 'escape', obj, dist: hit.distance });
    else if (ud.customInteract) this.setTarget({ kind: 'custom', data: ud.customInteract, obj, dist: hit.distance });
    else this.setTarget(null);
  }

  setTarget(t) {
    const prev = this.target;
    this.target = t;
    const prompt = t ? this.describe(t) : null;
    if (!prompt) { this.game.ui.setPrompt(null); return; }
    if (!prev || !this.prompt || prev.kind !== t.kind || this.prompt.text !== prompt.text) {
      this.game.ui.setPrompt(prompt);
    }
    this.prompt = prompt;
  }

  describe(t) {
    const g = this.game;
    const E = { key: 'E', text: '', locked: false };
    switch (t.kind) {
      case 'door': {
        const d = t.door;
        if (d.locked) {
          const hasKey = d.keyId && g.inventory.has(d.keyId);
          return {
            key: 'E',
            text: hasKey ? `Unlock ${d.label} — ${d.keyName}` : `${d.label} — locked (${d.keyName})`,
            locked: !hasKey,
          };
        }
        if (d.openAmount > 0.5) return { key: 'E', text: `Close ${d.label}` };
        return { key: 'E', text: `Open ${d.label}` };
      }
      case 'container': {
        const c = t.group.userData.container;
        if (c && c.searched) return { key: 'E', text: `${c.kind === 'wardrobe' ? 'Wardrobe' : 'Drawer'} — empty` };
        return { key: 'E', text: `Search ${c?.kind === 'wardrobe' ? 'Wardrobe' : c?.kind === 'locker' ? 'Locker' : c?.kind === 'morgue' ? 'Cold Drawer' : 'Cabinet'}` };
      }
      case 'pickup': {
        const id = t.group.userData.pickupId;
        const def = itemFor(id);
        return { key: 'E', text: `Take ${def.name}` };
      }
      case 'gate': {
        if (!t.gate.locked) return { key: 'E', text: t.gate.target > 0.5 ? 'Close Main Gate' : 'Open Main Gate' };
        const has = g.inventory.has('gateKey');
        return { key: 'E', text: has ? 'Unlock Main Gate — Gate Key' : 'Main Gate — chained and locked', locked: !has };
      }
      case 'elevator': {
        const { elevator, stop, kind } = t.data;
        if (!g.world.power) return { key: 'E', text: 'Elevator — no power', locked: true };
        const stopName = g.levelName(stop);
        if (kind === 'call') {
          if (elevator.currentLevel?.id === stop) return { key: 'E', text: `${elevator.name} — doors opening` };
          return { key: 'E', text: `Call elevator — ${stopName}` };
        }
        if (elevator.cfg.requires && !g.inventory.has(elevator.cfg.requires)) {
          return { key: 'E', text: 'Restricted elevator — card required', locked: true };
        }
        return { key: 'E', text: `Select floor — ${stopName}` };
      }
      case 'cctv': return { key: 'E', text: 'Use the CCTV system' };
      case 'generator': {
        if (g.flags.powerOn) return { key: 'E', text: 'Generator — running' };
        if (!g.flags.generatorFuelled) {
          return { key: 'E', text: g.inventory.has('fuelCan') ? 'Refuel generator' : 'Generator — tank is dry' };
        }
        return { key: 'E', text: 'Start the generator' };
      }
      case 'hide': return { key: 'E', text: t.spot.type === 'underbed' ? 'Hide under the bed' : t.spot.type === 'locker' ? 'Hide in the locker' : 'Hide in the wardrobe' };
      case 'escape': return { key: 'E', text: 'Climb out through the service exit' };
      case 'custom': return t.data.prompt || { key: 'E', text: 'Interact' };
      default: return null;
    }
    return E;
  }

  interact() {
    const t = this.target;
    if (!t || this.cooldown > 0) return;
    const g = this.game;
    this.cooldown = 0.25;

    switch (t.kind) {
      case 'door': {
        const d = t.door;
        if (d.locked) {
          if (d.keyId && g.inventory.has(d.keyId)) {
            d.unlock();
            g.toast(`${d.label} unlocked`);
            g.ui.setPrompt(null);
            return;
          }
          g.audio.locked();
          g.subtitle(`It's locked. It needs the ${d.keyName}.`);
          return;
        }
        d.toggle();
        g.stats.doorsOpened++;
        g.noiseAt(d.worldX, d.worldZ, 0.35);
        return;
      }
      case 'container': {
        const c = t.group.userData.container;
        if (!c) return;
        if (c.searched) { g.toast('Empty.'); g.audio.pickupDenied(); return; }
        c.searched = true;
        t.group.userData.setOpen?.(1);
        g.audio.search();
        g.stats.containersSearched++;
        const loot = c.loot || [];
        if (!loot.length) {
          setTimeout(() => g.toast('Nothing useful.'), 260);
          return;
        }
        let delay = 300;
        for (const id of loot) {
          setTimeout(() => {
            g.collectItem(id, 'container');
            if (loot.length > 1) g.toast('You search the compartment…');
          }, delay);
          delay += 420;
        }
        return;
      }
      case 'pickup': {
        const id = t.group.userData.pickupId;
        g.collectItem(id, 'pickup', t.group);
        return;
      }
      case 'gate': {
        const gate = t.gate;
        if (gate.locked) {
          if (g.inventory.has('gateKey')) {
            gate.unlock();
            gate.toggle();
            g.flags.gateOpen = true;
            g.audio.unlock();
            g.audio.metalImpact();
            g.toast('The gate swings open.');
            g.noiseAt(0, 29, 1);
          } else {
            g.audio.locked();
            g.subtitle('A chain and a padlock. The key must be somewhere.');
          }
          return;
        }
        gate.toggle();
        g.audio.doorOpen(0);
        g.flags.gateOpen = gate.target > 0.5 || g.flags.gateOpen;
        return;
      }
      case 'elevator': {
        const { elevator, stop, kind } = t.data;
        if (!g.world.power) { g.audio.pickupDenied(); g.toast('No power.'); return; }
        if (elevator.cfg.requires && !g.inventory.has(elevator.cfg.requires)) {
          g.audio.locked();
          g.toast('Access denied — card required.');
          return;
        }
        if (kind === 'call') {
          elevator.call(stop);
          g.toast(`${elevator.name} called.`);
        } else {
          elevator.call(stop);
          g.toast(`Floor selected: ${g.levelName(stop)}`);
        }
        return;
      }
      case 'cctv': g.sitAtCCTV(); return;
      case 'generator': g.useGenerator(); return;
      case 'hide': g.enterHide(t.spot); return;
      case 'escape': g.triggerEscape(); return;
      case 'custom': t.data.action?.(); return;
      default: return;
    }
  }

  _pan(x) {
    const p = this.game.player;
    const dx = x - p.position.x;
    return Math.max(-1, Math.min(1, dx / 8));
  }
}
