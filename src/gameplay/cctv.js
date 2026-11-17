import * as THREE from 'three';
import { CAMERAS, worldX, worldZ, LEVEL_BY_ID, GRID_W, GRID_H } from '../world/layout.js';
import { textures, makeCanvas } from '../world/textures.js';
import { roomBounds } from '../world/decor.js';

const FEEDS = [
  CAMERAS[0], CAMERAS[1], CAMERAS[2], CAMERAS[3],
];

/**
 * Working surveillance desk: four CRT-shaped monitors fed by render targets
 * placed around the hospital, plus the Camera 07 event.
 */
export class CCTVSystem {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.items = this._buildFeedItems();
    this.built = false;
    this.seated = false;
    this.focus = 0;
    this.timeSeated = 0;
    this.anomalyStage = 0;
    this.anomalyTimer = 0;
    this.flickerTimer = 2;
    this.staticTimer = 0;
    this.phantom = null;
    this.monitorMats = [];
    this.screens = [];
  }

  _buildFeedItems() {
    return FEEDS.map((cam) => {
      const camObj = new THREE.PerspectiveCamera(cam.fov || 60, 4 / 3, 0.12, 70);
      camObj.position.set(worldX(cam.tx), cam.y, worldZ(cam.tz));
      camObj.lookAt(worldX(cam.lookTx), cam.y - 0.45, worldZ(cam.lookTz));
      const target = new THREE.WebGLRenderTarget(384, 288, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        depthBuffer: true,
      });
      return { cam, camObj, target, material: null };
    });
  }

  buildHousings() {
    const gm = new THREE.MeshStandardMaterial({ color: 0x2c2e2c, roughness: 0.7, metalness: 0.4 });
    for (const cam of CAMERAS) {
      const level = this.world.levels[cam.level];
      if (!level) continue;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), gm);
      body.rotation.x = 0.35;
      g.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.2, metalness: 0.8 }));
      lens.rotation.x = Math.PI / 2 + 0.35;
      lens.position.set(0, 0, 0.16);
      g.add(lens);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.26), gm);
      bracket.position.set(0, 0.13, -0.12);
      bracket.rotation.x = -0.5;
      g.add(bracket);
      g.position.set(worldX(cam.tx), cam.y, worldZ(cam.tz));
      const yaw = Math.atan2(worldX(cam.lookTx) - worldX(cam.tx), worldZ(cam.lookTz) - worldZ(cam.tz));
      g.rotation.y = yaw;
      g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
      level.group.add(g);
      level.cameraHousings = level.cameraHousings || [];
      level.cameraHousings.push(g);
    }
  }

  buildConsole() {
    if (this.built) return;
    const gf = this.world.levels.gf;
    const room = (gf.rooms || []).find((r) => r.id === 'cctv');
    if (!room) return;
    const b = roomBounds(room);
    const W = b.w;
    const baseX = b.x0 + W / 2;
    const y = gf.y;

    const group = new THREE.Group();
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x3b3a33, roughness: 0.85 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2c2b, roughness: 0.55, metalness: 0.45 });

    // desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.85), deskMat);
    desk.position.set(baseX, y + 0.76, b.z0 + 2.35);
    desk.castShadow = desk.receiveShadow = true;
    group.add(desk);
    for (const dx of [-2.0, 2.0]) {
      for (const dz of [-0.35, 0.35]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), metalMat);
        leg.position.set(baseX + dx, y + 0.38, b.z0 + 2.35 + dz);
        group.add(leg);
      }
    }
    // riser shelf for monitors
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.5), deskMat);
    shelf.position.set(baseX, y + 1.02, b.z0 + 1.25);
    group.add(shelf);
    for (const dx of [-2.05, 2.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), metalMat);
      post.position.set(baseX + dx, y + 0.89, b.z0 + 1.25);
      group.add(post);
    }

    // monitor bank
    const offX = [-1.62, -0.54, 0.54, 1.62];
    offX.forEach((dx, i) => {
      const feed = this.items[i];
      const casing = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.78, 0.42), new THREE.MeshStandardMaterial({ color: 0x24221e, roughness: 0.8 }));
      casing.position.set(baseX + dx, y + 1.44, b.z0 + 1.25);
      group.add(casing);
      const screenMat = new THREE.MeshBasicMaterial({ map: feed.target.texture, color: 0xdcdcd2 });
      feed.material = screenMat;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.6), screenMat);
      plane.position.set(baseX + dx, y + 1.44, b.z0 + 1.47);
      group.add(plane);
      this.monitorMats.push(screenMat);

      // scanlines / glass
      const scanMat = new THREE.MeshBasicMaterial({
        map: textures.dynamic('cctvScan', scanlineTexture()), transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.6), scanMat);
      scan.position.set(baseX + dx, y + 1.44, b.z0 + 1.478);
      group.add(scan);

      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      led.position.set(baseX + dx + 0.42, y + 1.79, b.z0 + 1.47);
      group.add(led);

      const label = this._label(feed.cam.id);
      label.position.set(baseX + dx, y + 1.44 - 0.42, b.z0 + 1.5);
      group.add(label);
      this.screens.push({ plane, label, feed });
    });

    // keyboard + mouse + mug + paper log
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 0.17), new THREE.MeshStandardMaterial({ color: 0x1e1d1a, roughness: 0.9 }));
    kb.position.set(baseX - 0.2, y + 0.82, b.z0 + 2.15);
    group.add(kb);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x6d6355, roughness: 0.9 }));
    mug.position.set(baseX + 1.2, y + 0.85, b.z0 + 2.5);
    group.add(mug);
    const logbook = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), new THREE.MeshStandardMaterial({ color: 0xb9b39f, roughness: 1 }));
    logbook.rotation.y = 0.3;
    logbook.position.set(baseX - 1.35, y + 0.83, b.z0 + 2.55);
    group.add(logbook);

    // chair
    const chairGroup = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x2f3230, roughness: 0.9 }));
    seat.position.y = 0.48;
    chairGroup.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.09), new THREE.MeshStandardMaterial({ color: 0x2f3230, roughness: 0.9 }));
    back.position.set(0, 0.78, 0.22);
    chairGroup.add(back);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), metalMat);
    pole.position.y = 0.24;
    chairGroup.add(pole);
    for (let i = 0; i < 5; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.06), metalMat);
      leg.position.set(Math.cos(i / 5 * Math.PI * 2) * 0.15, 0.04, Math.sin(i / 5 * Math.PI * 2) * 0.15);
      leg.rotation.y = i / 5 * Math.PI * 2;
      chairGroup.add(leg);
    }
    chairGroup.position.set(baseX, y, b.z0 + 3.05);
    chairGroup.rotation.y = Math.PI;
    group.add(chairGroup);

    // interaction proxy
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.0, 0.9),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    proxy.position.set(baseX, y + 0.9, b.z0 + 2.4);
    proxy.userData.cctvConsole = true;
    group.add(proxy);

    // dim green monitor glow
    const glow = new THREE.PointLight(0x8fdcb0, 4.2, 6.5, 2);
    glow.position.set(baseX, y + 1.55, b.z0 + 2.0);
    group.add(glow);
    this.glow = glow;

    gf.group.add(group);
    this.consoleGroup = group;
    this.seat = { x: baseX, y, z: b.z0 + 2.85, yaw: 0.02, pitch: -0.06 };
    this.proxy = proxy;
    this.built = true;
    this.game.interaction.addInteractive(proxy);

    // remove the decorative CRTs that would overlap the live bank
    if (room.decorGroup) {
      room.decorGroup.traverse((o) => {
        if (o.userData?.isCrt) o.visible = false;
      });
    }
  }

  _label(text) {
    const c = makeCanvas(128, 32);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0c0b';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#7dc49a';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 17);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    return new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), m);
  }

  sit() {
    this.seated = true;
    this.timeSeated = 0;
    this.anomalyStage = 0;
    this.anomalyTimer = 0;
    this.focus = 0;
  }

  stand() {
    this.seated = false;
    this._clearPhantom();
  }

  setFocus(i) {
    this.focus = Math.max(0, Math.min(3, i));
  }

  _clearPhantom() {
    if (this.phantom) {
      this.phantom.parent?.remove(this.phantom);
      this.phantom = null;
    }
    this.anomalyStage = 0;
  }

  startAnomaly() {
    if (this.anomalyStage > 0) return;
    this.anomalyStage = 1;
    this.anomalyTimer = 0;
    const level = this.world.levels.f1;
    const cam = CAMERAS[1];
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x030303 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.24), mat);
    torso.position.y = 1.18;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), mat);
    head.position.y = 1.66;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.82, 0.2), mat);
    legs.position.y = 0.41;
    const arms = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.12), mat);
    arms.position.y = 1.3;
    g.add(torso, head, legs, arms);
    const startX = worldX(cam.tx) + 9.5;
    const z = worldZ(cam.lookTz) + 0.1;
    g.position.set(startX, level.y, z);
    g.rotation.y = Math.PI / 2;
    level.group.add(g);
    this.phantom = g;
    this.game.audio.electrical();
    this.game.audio.whisper(0.4);
    this.staticTimer = 1.4;
  }

  update(dt, renderer) {
    // flicker on screens
    this.flickerTimer -= dt;
    if (this.flickerTimer <= 0) {
      this.flickerTimer = 1.4 + Math.random() * 6;
      if (Math.random() < 0.6 && this.monitorMats.length) {
        const m = this.monitorMats[Math.floor(Math.random() * this.monitorMats.length)];
        m.color.setScalar(0.55);
        setTimeout(() => m.color.setScalar(1), 60 + Math.random() * 90);
      }
    }

    if (this.seated) {
      this.timeSeated += dt;
      if (this.anomalyStage === 1) {
        this.anomalyTimer += dt;
        const t = Math.min(1, this.anomalyTimer / 6);
        if (this.phantom) {
          this.phantom.position.x = worldX(CAMERAS[1].tx) + 9.5 - t * 5.5;
          this.phantom.visible = this.anomalyTimer > 1.2;
        }
        if (this.anomalyTimer > 7.2) {
          this.anomalyStage = 2;
          this.anomalyTimer = 0;
          this.game.onCCTVAnomaly?.();
        }
      } else if (this.anomalyStage === 2) {
        this.anomalyTimer += dt;
        if (this.anomalyTimer > 2.4) { this._clearPhantom(); this.anomalyStage = 3; }
      }
    }

    if (this.monitorMats.length) {
      if (this.staticTimer > 0) this.staticTimer -= dt;
      const staticMat = this.staticTimer > 0 && this._staticMat();
      for (let i = 0; i < this.items.length; i++) {
        const m = this.monitorMats[i];
        if (staticMat && Math.random() < 0.5) m.map = staticMat;
        else m.map = this.items[i].target.texture;
      }
    }
  }

  _staticMat() {
    if (!this._static) {
      const c = makeCanvas(128, 96);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(128, 96);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 90 | 0;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      this._static = textures.dynamic('cctvStatic', c);
    }
    return this._static;
  }

  renderFeeds(renderer) {
    if (!this.seated || !this.built) return;
    // render two feeds per frame, alternating — keeps the cost low
    const frame = this.game.frameCount | 0;
    const a = frame % this.items.length;
    const b = (frame + 2) % this.items.length;
    const prevTarget = renderer.getRenderTarget();
    for (const i of [a, b]) {
      const feed = this.items[i];
      feed.camObj.updateMatrixWorld(true);
      renderer.setRenderTarget(feed.target);
      renderer.clear();
      renderer.render(this.game.scene, feed.camObj);
    }
    renderer.setRenderTarget(prevTarget);
  }
}

function scanlineTexture() {
  const c = makeCanvas(4, 64);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 64; y++) {
    ctx.fillStyle = y % 3 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, y, 4, 1);
  }
  return c;
}

export { GRID_W, GRID_H, LEVEL_BY_ID };
