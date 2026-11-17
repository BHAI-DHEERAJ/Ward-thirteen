import { getDocument, itemFor } from '../gameplay/items.js';
import { Settings } from '../core/save.js';

const $ = (id) => document.getElementById(id);

/** Tiny procedural item icons — no image assets anywhere in this project. */
function iconFor(def) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.strokeStyle = '#cfc7ae';
  x.fillStyle = 'rgba(207,199,174,0.12)';
  x.lineWidth = 2.4;
  x.lineJoin = 'round';
  const kind = def.kind;
  if (kind === 'keys') {
    x.beginPath(); x.arc(22, 22, 8, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(27, 27); x.lineTo(47, 47); x.stroke();
    x.beginPath(); x.moveTo(41, 41); x.lineTo(46, 36); x.moveTo(45, 45); x.lineTo(50, 40); x.stroke();
  } else if (def.pickup === 'accessCard') {
    x.beginPath(); x.rect(14, 20, 36, 24); x.stroke();
    x.beginPath(); x.moveTo(14, 27); x.lineTo(50, 27); x.stroke();
    x.fillRect(18, 32, 14, 3);
  } else if (kind === 'batteries') {
    x.beginPath(); x.rect(24, 16, 16, 34); x.stroke();
    x.fillRect(24, 16, 16, 34);
    x.beginPath(); x.rect(29, 11, 6, 5); x.stroke();
    x.beginPath(); x.moveTo(32, 22); x.lineTo(28, 34); x.lineTo(34, 34); x.lineTo(30, 45); x.stroke();
  } else if (kind === 'medicines') {
    x.beginPath(); x.rect(20, 18, 24, 30); x.stroke();
    x.beginPath(); x.rect(26, 12, 12, 6); x.stroke();
    x.beginPath(); x.moveTo(24, 32); x.lineTo(40, 32); x.moveTo(24, 39); x.lineTo(40, 39); x.stroke();
  } else if (kind === 'tools') {
    x.beginPath(); x.rect(18, 18, 28, 32); x.stroke();
    x.beginPath(); x.moveTo(24, 18); x.lineTo(24, 12); x.lineTo(40, 12); x.lineTo(40, 18); x.stroke();
    x.beginPath(); x.moveTo(18, 30); x.lineTo(14, 30); x.stroke();
  } else if (kind === 'documents') {
    x.beginPath(); x.rect(18, 12, 28, 40); x.stroke();
    for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(23, 20 + i * 5); x.lineTo(41 - (i % 2) * 6, 20 + i * 5); x.stroke(); }
  } else {
    x.beginPath(); x.rect(18, 18, 28, 28); x.stroke();
  }
  return c.toDataURL();
}

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      loading: $('loading'), loadFill: $('load-fill'), loadStatus: $('load-status'),
      menu: $('menu'), hud: $('hud'), inventory: $('inventory'), document: $('document'),
      pause: $('pause'), settings: $('settings'), cctv: $('cctv-ui'), ending: $('ending'),
      fade: $('fade'), damage: $('damage'),
      objectiveText: $('objective-text'), objectiveSub: $('objective-sub'),
      prompt: $('prompt'), promptKey: $('prompt-key'), promptText: $('prompt-text'),
      batteryFill: $('battery-fill'), batteryPct: $('battery-pct'), flashState: $('flash-state'),
      staminaFill: $('stamina-fill'), vitality: $('vitals'), vitalFill: $('vital-fill'),
      subtitle: $('subtitle'), toast: $('toast'), banner: $('mission-banner'),
      bannerTitle: $('mb-title'), bannerSub: $('mb-sub'),
      hideIndicator: $('hide-indicator'), crosshair: $('crosshair'),
      invGrid: $('inv-grid'), invDetail: $('inv-detail'), invCap: $('inv-cap'), invFloors: $('inv-floors'),
      docDept: $('doc-dept'), docDate: $('doc-date'), docTitle: $('doc-title'),
      docBody: $('doc-body'), docSig: $('doc-sig'),
      pauseStatus: $('pause-status'), cctvList: $('cctv-list'), cctvClock: $('cctv-clock'), cctvMsg: $('cctv-msg'),
      endTitle: $('end-title'), endText: $('end-text'), endStats: $('end-stats'),
    };
    this.selected = null;
    this.subtitleTimer = null;
    this.toastTimer = null;
    this.bannerTimer = null;
    this.settingsReturn = 'menu';
    this.currentScreen = 'loading';
    this.iconCache = new Map();
    this.bind();
    this.applySettingsToInputs();
  }

  // ------------------------------------------------------------------ basics
  hideAll() {
    for (const k of ['loading', 'menu', 'hud', 'inventory', 'document', 'pause', 'settings', 'cctv', 'ending']) {
      this.el[k]?.classList.add('hidden');
    }
  }
  showEl(name) {
    this.el[name]?.classList.remove('hidden');
  }
  hideEl(name) {
    this.el[name]?.classList.add('hidden');
  }
  setLoading(p, status) {
    if (this.el.loadFill) this.el.loadFill.style.width = `${Math.round(p * 100)}%`;
    if (status && this.el.loadStatus) this.el.loadStatus.textContent = status;
  }

  showMenu(canContinue) {
    this.hideAll();
    this.showEl('menu');
    this.currentScreen = 'menu';
    const btn = $('btn-continue');
    if (btn) btn.disabled = !canContinue;
    this.el.menu.classList.remove('menu-in');
    void this.el.menu.offsetWidth;
    this.el.menu.classList.add('menu-in');
  }

  showHUD() {
    this.hideAll();
    this.showEl('hud');
    this.currentScreen = 'hud';
  }

  // ------------------------------------------------------------------ HUD
  setObjective(text, hint = '') {
    if (!this.el.objectiveText) return;
    this.el.objectiveText.textContent = text || '—';
    this.el.objectiveSub.textContent = hint || '';
    const panel = $('objective-panel');
    panel.classList.remove('pulse');
    void panel.offsetWidth;
    panel.classList.add('pulse');
  }

  setPrompt(p) {
    if (!p) { this.el.prompt.classList.add('hidden'); return; }
    this.el.prompt.classList.remove('hidden');
    this.el.prompt.classList.toggle('locked', !!p.locked);
    this.el.promptKey.textContent = p.key || 'E';
    this.el.promptText.textContent = p.text;
  }

  setBattery(f) {
    const pct = Math.round(Math.max(0, Math.min(1, f)) * 100);
    this.el.batteryFill.style.width = `${pct}%`;
    this.el.batteryPct.textContent = `${pct}%`;
    this.el.batteryFill.classList.toggle('low', pct < 22);
    this.el.flashState.textContent = f > 0 ? 'FLASHLIGHT' : 'DEAD';
  }

  setStamina(f) {
    this.el.staminaFill.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
    $('stamina').style.opacity = f < 0.98 ? '1' : '0.25';
  }

  setHealth(h) {
    const pct = Math.round(h);
    this.el.vitalFill.style.width = `${pct}%`;
    this.el.vitalFill.classList.toggle('low', pct < 45);
    if (pct < 100) this.el.vitality.classList.remove('hidden');
  }

  setFlashlight(on) {
    this.el.flashState.textContent = on ? 'FLASHLIGHT' : 'FLASHLIGHT OFF';
  }

  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  subtitle(text, dur = 4.5) {
    const s = this.el.subtitle;
    s.textContent = text;
    s.classList.add('show');
    clearTimeout(this.subtitleTimer);
    this.subtitleTimer = setTimeout(() => s.classList.remove('show'), dur * 1000);
  }

  showMissionBanner(title, sub) {
    const b = this.el.banner;
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    b.classList.remove('hidden');
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      b.classList.remove('show');
      setTimeout(() => b.classList.add('hidden'), 900);
    }, 4200);
  }

  setHideIndicator(on, label) {
    this.el.hideIndicator.classList.toggle('hidden', !on);
    if (label) this.el.hideIndicator.innerHTML = label;
  }

  damageFlash(amount = 1) {
    this.el.damage.style.opacity = String(0.55 * amount);
    setTimeout(() => { this.el.damage.style.opacity = '0'; }, 420);
  }

  fade(to, ms = 900) {
    return new Promise((res) => {
      this.el.fade.style.transition = `opacity ${ms}ms ease`;
      this.el.fade.style.opacity = String(to);
      setTimeout(res, ms);
    });
  }

  flashWhite(v = 0.8) {
    const d = this.el.damage;
    d.style.background = 'rgba(255,255,255,0.9)';
    d.style.opacity = String(v);
    setTimeout(() => {
      d.style.opacity = '0';
      d.style.background = 'rgba(120,0,0,0.75)';
    }, 130);
  }

  // ------------------------------------------------------------------ inventory
  openInventory() {
    this.hideEl('document');
    this.showEl('inventory');
    this.renderInventory();
    this.currentScreen = 'inventory';
  }

  closeInventory() {
    this.hideEl('inventory');
    this.currentScreen = 'hud';
    this.selected = null;
  }

  renderInventory() {
    const inv = this.game.inventory;
    const grid = this.el.invGrid;
    grid.innerHTML = '';
    this.el.invCap.textContent = `${inv.used} / ${inv.capacity}`;
    this.el.invFloors.textContent = this.game.levelName(this.game.player?.levelId || 'gf').toUpperCase();

    const entries = inv.list().map((s) => ({ id: s.id, count: s.count, def: s.def }));
    for (const d of inv.documentList()) {
      entries.push({ id: d.id, count: 1, def: d.def, doc: true });
    }
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Your pockets are empty.';
      grid.appendChild(empty);
    }
    for (const e of entries) {
      const slot = document.createElement('button');
      slot.className = 'inv-slot';
      if (this.selected === e.id) slot.classList.add('sel');
      if (e.doc) slot.classList.add('doc');
      const key = e.def.kind + (e.def.pickup || '');
      if (!this.iconCache.has(key)) this.iconCache.set(key, iconFor(e.def));
      const img = document.createElement('img');
      img.src = this.iconCache.get(key);
      img.alt = '';
      slot.appendChild(img);
      const name = document.createElement('span');
      name.className = 'slot-name';
      name.textContent = e.def.name.length > 20 ? `${e.def.name.slice(0, 19)}…` : e.def.name;
      slot.appendChild(name);
      if (e.count > 1) {
        const c = document.createElement('b');
        c.className = 'slot-count';
        c.textContent = `×${e.count}`;
        slot.appendChild(c);
      }
      slot.addEventListener('click', () => this.selectItem(e));
      slot.addEventListener('dblclick', () => this.primaryAction(e));
      grid.appendChild(slot);
    }
    if (this.selected) {
      const e = entries.find((x) => x.id === this.selected);
      if (e) this.selectItem(e, true);
      else { this.selected = null; this.showEmptyDetail(); }
    } else {
      this.showEmptyDetail();
    }
  }

  showEmptyDetail() {
    this.el.invDetail.innerHTML = '<div class="detail-empty">Select an item to inspect.</div>';
  }

  selectItem(entry, silent = false) {
    this.selected = entry.id;
    const def = entry.def || itemFor(entry.id);
    if (!silent) {
      for (const el of this.el.invGrid.querySelectorAll('.inv-slot')) el.classList.remove('sel');
      const slots = [...this.el.invGrid.children];
      const idx = [...this.el.invGrid.children].findIndex((s) => s.querySelector('.slot-name')?.textContent === (def.name.length > 20 ? `${def.name.slice(0, 19)}…` : def.name));
      if (slots[idx]) slots[idx].classList.add('sel');
      this.game.audio.uiSelect();
    }
    const detail = this.el.invDetail;
    detail.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = def.name;
    const kind = document.createElement('div');
    kind.className = 'detail-kind';
    kind.textContent = `${def.kind || 'item'}${entry.count > 1 ? ` · ×${entry.count}` : ''}`;
    const p = document.createElement('p');
    p.textContent = def.desc || '';
    detail.append(h, kind, p);

    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    if (def.use === 'heal') {
      actions.appendChild(this._action('USE', () => {
        if (this.game.player.health >= 100) { this.toast('You are not hurt.'); return; }
        this.game.player.heal(38);
        this.game.inventory.remove(entry.id, 1);
        this.game.toast('The pain dulls a little.');
        this.game.audio.pickup();
        this.renderInventory();
      }));
    }
    if (entry.id === 'battery') {
      actions.appendChild(this._action('INSERT', () => {
        this.game.player.recharge(0.42);
        this.game.inventory.remove('battery', 1);
        this.game.toast('Battery replaced. The beam steadies.');
        this.game.audio.flashlightClick();
        this.renderInventory();
      }));
    }
    if (def.kind === 'documents' || entry.doc) {
      actions.appendChild(this._action('READ', () => {
        this.openDocument(entry.id);
      }));
    }
    if (def.kind !== 'keys' && !entry.doc) {
      actions.appendChild(this._action('DROP', () => {
        this.game.dropItem(entry.id);
        this.renderInventory();
      }));
    }
    const use = this._action('INSPECT', () => {
      this.game.audio.paper();
      this.subtitle(`You turn the ${def.name.toLowerCase()} over in your hands.`, 3);
    });
    actions.appendChild(use);
    detail.appendChild(actions);
  }

  _action(label, fn) {
    const b = document.createElement('button');
    b.className = 'detail-btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  primaryAction(entry) {
    const def = entry.def;
    if (def.kind === 'documents') this.openDocument(entry.id);
    else if (def.use === 'heal') {
      if (this.game.player.health >= 100) { this.toast('You are not hurt.'); return; }
      this.game.player.heal(38);
      this.game.inventory.remove(entry.id, 1);
      this.game.audio.pickup();
      this.renderInventory();
    } else if (entry.id === 'battery') {
      this.game.player.recharge(0.42);
      this.game.inventory.remove('battery', 1);
      this.game.audio.flashlightClick();
      this.renderInventory();
    } else this.selectItem(entry);
  }

  // ------------------------------------------------------------------ documents
  openDocument(id) {
    const doc = getDocument(id);
    this.el.docDept.textContent = doc.dept;
    this.el.docDate.textContent = doc.date;
    this.el.docTitle.textContent = doc.title;
    this.el.docBody.textContent = doc.body;
    this.el.docSig.textContent = doc.sig || '';
    this.hideEl('inventory');
    this.showEl('document');
    this.currentScreen = 'document';
    this.game.mode = 'document';
    this.game.input.unlock();
    this.game.onDocumentRead?.(id);
    this.game.audio.paper();
  }

  closeDocument() {
    this.hideEl('document');
    this.game.mode = 'playing';
    this.showHUD();
    this.game.input.lock();
  }

  // ------------------------------------------------------------------ pause / settings
  openPause() {
    this.showEl('pause');
    this.currentScreen = 'pause';
    const m = this.game.missions;
    const mission = m?.current();
    this.el.pauseStatus.textContent = mission
      ? `Checkpoint: ${mission.title}`
      : 'Checkpoint: Entrance';
  }

  closePause() {
    this.hideEl('pause');
    this.currentScreen = 'hud';
  }

  openSettings(from = 'menu') {
    this.settingsReturn = from;
    this.hideEl(from === 'pause' ? 'pause' : 'menu');
    this.showEl('settings');
    this.currentScreen = 'settings';
    this.applySettingsToInputs();
  }

  closeSettings() {
    this.hideEl('settings');
    if (this.settingsReturn === 'pause') { this.showEl('pause'); this.currentScreen = 'pause'; }
    else { this.showEl('menu'); this.currentScreen = 'menu'; }
    Settings.save();
  }

  applySettingsToInputs() {
    const s = Settings.data;
    const set = (id, v) => { const e = $(id); if (e) { if (e.type === 'checkbox') e.checked = !!v; else e.value = v; } };
    set('set-sens', s.sensitivity);
    set('set-vol', s.volume);
    set('set-fov', s.fov);
    set('set-invert', s.invertY);
    set('set-grain', s.grain);
    set('set-quality', s.quality);
    this.refreshSettingLabels();
  }

  refreshSettingLabels() {
    const s = Settings.data;
    const t = (id, txt) => { const e = $(id); if (e) e.textContent = txt; };
    t('set-sens-val', Number(s.sensitivity).toFixed(2));
    t('set-vol-val', `${Math.round(s.volume * 100)}%`);
    t('set-fov-val', String(s.fov));
  }

  // ------------------------------------------------------------------ CCTV
  showCCTV() {
    this.showEl('cctv');
    this.currentScreen = 'cctv';
    this.renderCCTVList();
  }
  hideCCTV() {
    this.hideEl('cctv');
    this.currentScreen = 'hud';
  }

  renderCCTVList() {
    const cams = this.game.cctv?.items || [];
    this.el.cctvList.innerHTML = '';
    cams.forEach((feed, i) => {
      const d = document.createElement('div');
      d.className = 'cctv-row';
      d.innerHTML = `<b>${i + 1}</b><span class="cam-id">${feed.cam.id}</span><span class="cam-name">${feed.cam.name}</span><i class="cam-led"></i>`;
      d.addEventListener('click', () => this.game.cctv.setFocus(i));
      this.el.cctvList.appendChild(d);
    });
  }

  updateCCTV(clock) {
    this.el.cctvClock.textContent = clock;
    const rows = this.el.cctvList.querySelectorAll('.cctv-row');
    rows.forEach((r, i) => r.classList.toggle('active', i === this.game.cctv?.focus));
  }

  setCCTVMessage(msg) {
    if (this.el.cctvMsg) this.el.cctvMsg.textContent = msg;
  }

  // ------------------------------------------------------------------ ending
  showEnding(title, text, stats) {
    this.hideAll();
    this.showEl('ending');
    this.currentScreen = 'ending';
    this.el.endTitle.textContent = title;
    this.el.endText.textContent = text;
    this.el.endStats.innerHTML = stats
      .map(([k, v]) => `<div class="end-stat"><span>${k}</span><b>${v}</b></div>`)
      .join('');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ------------------------------------------------------------------ bindings
  bind() {
    const g = this.game;
    const click = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', (ev) => { ev.preventDefault(); g.audio.init?.(); g.audio.uiSelect(); fn(); }); };

    click('btn-new', () => g.newGame());
    click('btn-continue', () => g.continueGame());
    click('btn-settings', () => this.openSettings('menu'));
    click('btn-quit', () => g.quitToDesktop());
    click('btn-resume', () => g.resume());
    click('btn-p-settings', () => this.openSettings('pause'));
    click('btn-restart', () => g.restartCheckpoint());
    click('btn-mainmenu', () => g.toMainMenu());
    click('settings-close', () => this.closeSettings());
    click('doc-close', () => this.closeDocument());
    click('btn-end-menu', () => g.toMainMenu());

    const bindRange = (id, key, label, fmt = (v) => v) => {
      const e = $(id);
      if (!e) return;
      e.addEventListener('input', () => {
        Settings.data[key] = parseFloat(e.value);
        this.refreshSettingLabels();
        g.onSettingsChanged?.();
        Settings.save();
      });
      if (label) { const l = $(label); if (l) l.textContent = fmt(Settings.data[key]); }
    };
    bindRange('set-sens', 'sensitivity');
    bindRange('set-vol', 'volume');
    bindRange('set-fov', 'fov');
    const inv = $('set-invert');
    inv?.addEventListener('change', () => { Settings.data.invertY = inv.checked; Settings.save(); g.onSettingsChanged?.(); });
    const grain = $('set-grain');
    grain?.addEventListener('change', () => { Settings.data.grain = grain.checked; Settings.save(); g.onSettingsChanged?.(); });
    const q = $('set-quality');
    q?.addEventListener('change', () => { Settings.data.quality = q.value; Settings.save(); g.onSettingsChanged?.(); });

    $('inventory')?.addEventListener('click', (e) => {
      if (e.target.id === 'inventory') g.closeInventory();
    });
  }
}
