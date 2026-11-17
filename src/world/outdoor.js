import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mats, makeSign } from './materials.js';
import { GATE, SECURITY_CABIN, AMBULANCE, worldX, worldZ, TILE, WORLD_W, WORLD_H } from './layout.js';
import { createProp, createPickup, createSearchable } from './props.js';
import { StaticBatcher, createSignPlate } from './decor.js';
import { Rng } from '../core/utils.js';
import { textures, signTexture } from './textures.js';

export function createOutdoors(world) {
  const group = new THREE.Group();
  group.name = 'outdoors';
  const rng = new Rng(907);
  const colliders = [];
  const interactives = [];
  const gateWorldZ = worldZ(GATE.z);

  // ------------------------------------------------------------- ground
  const groundGeo = new THREE.PlaneGeometry(150, 110, 1, 1);
  const guv = groundGeo.attributes.uv;
  for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 40, guv.getY(i) * 30);
  const ground = new THREE.Mesh(groundGeo, mats.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.03, 10);
  ground.receiveShadow = true;
  group.add(ground);

  // courtyard asphalt / driveway
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(88, 22), mats.asphalt);
  const auv = asphalt.geometry.attributes.uv;
  for (let i = 0; i < auv.count; i++) auv.setXY(i, auv.getX(i) * 22, auv.getY(i) * 5);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0.0, 21);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(7, 14), mats.asphalt);
  const puv = path.geometry.attributes.uv;
  for (let i = 0; i < puv.count; i++) puv.setXY(i, puv.getX(i) * 2, puv.getY(i) * 4);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.005, 35);
  group.add(path);

  // wet patches
  for (let i = 0; i < 12; i++) {
    const s = rng.range(1.5, 5);
    const p = new THREE.Mesh(new THREE.CircleGeometry(s, 12), mats.water);
    p.rotation.x = -Math.PI / 2;
    p.position.set(rng.range(-40, 40), 0.012, rng.range(16, 32));
    p.scale.set(1, rng.range(0.4, 0.9), 1);
    group.add(p);
  }

  // ------------------------------------------------------------- boundary fence
  const fenceMat = mats.concreteWall;
  for (const x of [-46, 46]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 30), fenceMat);
    wall.position.set(x, 1.3, 26);
    wall.castShadow = true;
    group.add(wall);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: 11, maxZ: 41 });
  }
  // courtyard fence behind the gate line
  for (const [z, x1, x2] of [[39, -46, 46]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, 2.4, 0.5), fenceMat);
    wall.position.set(0, 1.2, z);
    group.add(wall);
    colliders.push({ minX: x1, maxX: x2, minZ: z - 0.4, maxZ: z + 0.4 });
  }

  // ------------------------------------------------------------- gate
  const gate = new THREE.Group();
  gate.position.set(0, 0, gateWorldZ);
  group.add(gate);
  const openX1 = worldX(GATE.openingX1), openX2 = worldX(GATE.openingX2);
  const gateW = openX2 - openX1;
  const pillarH = 3.2;
  for (const x of [openX1 - 0.55, openX2 + 0.55]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, pillarH, 1.1), mats.concreteWall);
    p.position.set(x, pillarH / 2, 0);
    p.castShadow = true;
    gate.add(p);
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: gateWorldZ - 0.6, maxZ: gateWorldZ + 0.6 });
  }
  // iron rails on either side of the gate opening
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -45.6 : openX2 + 0.6;
    const len = side < 0 ? (openX1 - 0.6) - (-45.6) : 45.6 - (openX2 + 0.6);
    const rail = new THREE.Group();
    const barCount = Math.max(4, Math.floor(len / 0.35));
    for (let i = 0; i < barCount; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.4, 0.05), mats.rust);
      b.position.set(x0 + (i / barCount) * len, 1.2, 0);
      rail.add(b);
    }
    for (const y of [0.35, 2.2]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), mats.rust);
      r.position.set(x0 + len / 2, y, 0);
      rail.add(r);
    }
    // concrete base
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.35), mats.concreteWall);
    base.position.set(x0 + len / 2, 0.25, 0);
    rail.add(base);
    gate.add(rail);
    colliders.push({ minX: x0, maxX: x0 + len, minZ: gateWorldZ - 0.3, maxZ: gateWorldZ + 0.3 });
  }

  // gate leaves (animated by the game)
  const leaves = [];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(side < 0 ? openX1 : openX2, 0, 0);
    const w = gateW / 2 - 0.05;
    for (let i = 0; i < 9; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.15, 0.05), mats.rust);
      bar.position.set(side * -1 * (i / 8) * w, 1.1, 0);
      leaf.add(bar);
    }
    for (const y of [0.25, 1.1, 2.0]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.07), mats.rust);
      bar.position.set(side * -1 * w / 2, y, 0);
      leaf.add(bar);
    }
    const snake = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 12), mats.metalDark);
    snake.rotation.y = Math.PI / 2;
    snake.position.set(side * -1 * (w - 0.25), 1.1, 0.06);
    leaf.add(snake);
    gate.add(leaf);
    leaves.push({ group: leaf, side, w });
  }

  // gate sign
  const signMat = makeSign(['WARD THIRTEEN HOSPITAL'], { width: 1024, height: 200, size: 92, bg: '#20261f' });
  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.85), signMat);
  signBoard.position.set(0, 4.2, gateWorldZ + 0.35);
  group.add(signBoard);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(9.7, 2.0, 0.1), mats.metalDark);
  signBack.position.set(0, 4.2, gateWorldZ + 0.28);
  group.add(signBack);
  // support posts holding the sign above the pillars
  for (const x of [openX1 - 0.55, openX2 + 0.55]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), mats.metalDark);
    post.position.set(x, 3.85, gateWorldZ + 0.28);
    post.castShadow = true;
    group.add(post);
  }

  // ------------------------------------------------------------- security cabin
  const cab = new THREE.Group();
  const cabX = worldX(SECURITY_CABIN.tx), cabZ = worldZ(SECURITY_CABIN.tz);
  cab.position.set(cabX, 0, cabZ);
  group.add(cab);
  const cw = SECURITY_CABIN.w, cd = SECURITY_CABIN.d, ch = SECURITY_CABIN.h;
  const wallT = 0.16;
  const cabWalls = [
    [0, -cd / 2, cw, wallT, 0], [0, cd / 2, cw, wallT, 0],
    [-cw / 2, 0, wallT, cd, 0],
  ];
  for (const [x, z, w, d] of cabWalls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, ch, d), mats.metalDark);
    m.position.set(x, ch / 2, z);
    cab.add(m);
  }
  // east wall with a doorway
  const doorW = 1.0;
  const sideLen = (cd - doorW) / 2;
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(wallT, ch, sideLen), mats.metalDark);
    m.position.set(cw / 2, ch / 2, s * (doorW / 2 + sideLen / 2));
    cab.add(m);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(wallT, ch - 2.1, cd + wallT), mats.metalDark);
  header.position.set(cw / 2, 2.1 + (ch - 2.1) / 2, 0);
  cab.add(header);
  // cabin door (ajar)
  const cabDoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.05, doorW), mats.woodDark);
  cabDoor.position.set(cw / 2 + 0.2, 1.02, doorW / 2);
  cabDoor.rotation.y = 0.6;
  cab.add(cabDoor);
  // roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.5, 0.16, cd + 0.5), mats.rustDark);
  roof.position.set(0, ch + 0.08, 0);
  cab.add(roof);
  // broken light — a dying bulb over the cabin door
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), mats.metalDark);
  lamp.position.set(cw / 2 - 0.2, ch - 0.2, -0.3);
  cab.add(lamp);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffcf95, toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bulbMat);
  bulb.position.set(cw / 2 - 0.2, ch - 0.3, -0.3);
  cab.add(bulb);
  const cabLight = new THREE.PointLight(0xffb877, 1.8, 7.5, 2);
  cabLight.position.set(cw / 2 + 0.25, ch - 0.4, 0);
  cab.add(cabLight);

  // cabin interior
  const batcher = new StaticBatcher();
  const desk = createProp('desk', { w: 1.5, d: 0.65 });
  desk.position.set(-0.4, 0, -0.5);
  desk.updateMatrixWorld(true);
  batcher.add(desk);
  const chair = createProp('officeChair');
  chair.position.set(-0.3, 0, 0.3);
  chair.rotation.y = 2.4;
  chair.updateMatrixWorld(true);
  batcher.add(chair);
  const board = createProp('filingCabinet');
  board.position.set(-cw / 2 + 0.4, 0, 0.6);
  board.rotation.y = Math.PI / 2;
  board.updateMatrixWorld(true);
  batcher.add(board);
  batcher.finalize(cab);
  const cabPlate = createSignPlate('SECURITY', 0.9, 0.22);
  cabPlate.position.set(cw / 2 + 0.02, 2.42, 0);
  cabPlate.rotation.y = Math.PI / 2;
  cab.add(cabPlate);

  colliders.push({ minX: cabX - cw / 2 - 0.2, maxX: cabX - cw / 2 + 0.2, minZ: cabZ - cd / 2, maxZ: cabZ + cd / 2 });
  colliders.push({ minX: cabX + cw / 2 - 0.2, maxX: cabX + cw / 2 + 0.2, minZ: cabZ - cd / 2, maxZ: cabZ - doorW / 2 });
  colliders.push({ minX: cabX + cw / 2 - 0.2, maxX: cabX + cw / 2 + 0.2, minZ: cabZ + doorW / 2, maxZ: cabZ + cd / 2 });
  colliders.push({ minX: cabX - cw / 2, maxX: cabX + cw / 2, minZ: cabZ - cd / 2 - 0.2, maxZ: cabZ - cd / 2 + 0.2 });
  colliders.push({ minX: cabX - cw / 2, maxX: cabX + cw / 2, minZ: cabZ + cd / 2 - 0.2, maxZ: cabZ + cd / 2 + 0.2 });

  // searchable cabinet with the gate key
  const searchCab = createSearchable('drawer');
  searchCab.position.set(cabX - cw / 2 + 0.55, 0, cabZ + 0.55);
  searchCab.rotation.y = Math.PI / 2;
  searchCab.userData.container = { kind: 'drawer', opened: false, room: 'SECURITY CABIN', loot: ['gateKey', 'note_cabin'], searched: false };
  searchCab.userData.setOpen = (v) => { searchCab.userData.openTarget = v; };
  searchCab.traverse((o) => {
    if (o.isMesh) { o.userData.containerGroup = searchCab; interactives.push(o); }
  });
  group.add(searchCab);

  // ------------------------------------------------------------- ambulance
  const amb = createProp('ambulance');
  amb.position.set(worldX(AMBULANCE.tx), 0, worldZ(AMBULANCE.tz));
  amb.rotation.y = AMBULANCE.rot;
  group.add(amb);
  colliders.push({ minX: worldX(AMBULANCE.tx) - 1.6, maxX: worldX(AMBULANCE.tx) + 1.6, minZ: worldZ(AMBULANCE.tz) - 3.4, maxZ: worldZ(AMBULANCE.tz) + 3.4 });

  // dead trees + debris
  const treeSpots = [[-38, 18], [-30, 30], [-12, 24], [15, 25], [30, 18], [38, 30], [-42, 36], [42, 37], [8, 32], [-20, 36]];
  for (const [x, z] of treeSpots) {
    const t = createProp('deadTree');
    t.position.set(x, 0, z);
    t.rotation.y = rng.range(0, 6.28);
    group.add(t);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }

  // scattered papers and debris in the courtyard
  const deb = new StaticBatcher();
  for (let i = 0; i < 26; i++) {
    const p = createProp('papers');
    p.position.set(rng.range(-40, 40), 0.01, rng.range(15, 38));
    p.rotation.y = rng.range(0, 6.28);
    p.updateMatrixWorld(true);
    deb.add(p);
  }
  for (let i = 0; i < 8; i++) {
    const c = createProp('crate');
    c.position.set(rng.range(-40, 40), 0, rng.range(16, 37));
    c.rotation.y = rng.range(0, 6.28);
    c.updateMatrixWorld(true);
    deb.add(c);
  }
  deb.finalize(group);

  // exterior benches
  for (const [x, z, ry] of [[-8, 24, 0], [10, 24, Math.PI]]) {
    const b = createProp('bench');
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    group.add(b);
    colliders.push({ minX: x - 1.4, maxX: x + 1.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }

  // faded helipad-style courtyard markings / parking lines
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x8b8a76, roughness: 0.9, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 6; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 5), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-30 + i * 8, 0.015, 26);
    group.add(line);
  }

  // exterior lamp posts (one flickering)
  for (const [x, z] of [[-24, 18], [24, 18]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.5, 8), mats.metalDark);
    pole.position.set(x, 2.75, z);
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), mats.metalDark);
    head.position.set(x, 5.5, z);
    group.add(head);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.2), mats.emissiveWarm);
    glow.position.set(x, 5.38, z);
    group.add(glow);
    colliders.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15 });
  }

  // ------------------------------------------------------------- sky & moon
  const skyGeo = new THREE.SphereGeometry(320, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x02040a) }, bottom: { value: new THREE.Color(0x0b1014) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y/320.0*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  world.scene.add(sky);

  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = 256; moonCanvas.height = 256;
  const mctx = moonCanvas.getContext('2d');
  const grad = mctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  grad.addColorStop(0, 'rgba(226,232,226,0.95)');
  grad.addColorStop(0.16, 'rgba(210,220,215,0.9)');
  grad.addColorStop(0.22, 'rgba(150,170,180,0.28)');
  grad.addColorStop(0.55, 'rgba(90,110,130,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  mctx.fillStyle = grad;
  mctx.fillRect(0, 0, 256, 256);
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, toneMapped: false }));
  moon.scale.set(70, 70, 1);
  moon.position.set(-110, 130, -250);
  world.scene.add(moon);

  // drifting clouds
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256; cloudCanvas.height = 128;
  const cctx = cloudCanvas.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const g2 = cctx.createRadialGradient(rng.range(40, 216), rng.range(30, 98), 2, rng.range(40, 216), rng.range(30, 98), rng.range(18, 52));
    g2.addColorStop(0, 'rgba(24,30,34,0.7)');
    g2.addColorStop(1, 'rgba(24,30,34,0)');
    cctx.fillStyle = g2;
    cctx.fillRect(0, 0, 256, 128);
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.45, depthWrite: false }));
    sp.scale.set(rng.range(150, 260), rng.range(50, 90), 1);
    sp.position.set(rng.range(-180, 180), rng.range(90, 150), rng.range(-220, -120));
    world.scene.add(sp);
    clouds.push(sp);
  }

  // moonlight — weak directional light, cool tone
  const moonLight = new THREE.DirectionalLight(0x93aec4, 0.65);
  moonLight.position.set(-60, 80, -120);
  moonLight.target.position.set(0, 0, 10);
  world.scene.add(moonLight, moonLight.target);
  const hemi = new THREE.HemisphereLight(0x2a3a44, 0x05070a, 0.35);
  world.scene.add(hemi);

  // ------------------------------------------------------------- interaction
  const gateState = {
    locked: true,
    open: 0,
    target: 0,
    leaves,
    gateWorldZ,
    unlock() { this.locked = false; },
    toggle() {
      if (this.locked) return false;
      this.target = this.target > 0.5 ? 0 : 1;
      return true;
    },
  };

  // invisible interaction proxy for the gate
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(gateW + 2, 2.4, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(0, 1.2, gateWorldZ);
  proxy.userData.gate = gateState;
  group.add(proxy);
  interactives.push(proxy);

  return {
    group,
    colliders,
    interactives,
    gate: gateState,
    moon,
    clouds,
    update(dt, time) {
      // failing security-cabin bulb
      if (cabLight) {
        const n = Math.sin(time * 13.7) * Math.sin(time * 3.11) * Math.sin(time * 29.3);
        const on = n > 0.34 ? 0.12 : 1;
        cabLight.intensity = 2.0 * on * (0.82 + Math.sin(time * 6.3) * 0.16);
        bulbMat.color.setScalar(0.35 + 0.65 * on);
      }
      // animate clouds
      for (let i = 0; i < clouds.length; i++) {
        clouds[i].position.x += dt * (2 + i * 0.4);
        if (clouds[i].position.x > 200) clouds[i].position.x = -200;
      }
      // gate swing
      const g = gateState;
      if (Math.abs(g.target - g.open) > 0.001) {
        g.open += Math.sign(g.target - g.open) * Math.min(Math.abs(g.target - g.open), dt * 0.9);
        const eased = g.open * g.open * (3 - 2 * g.open);
        for (const leaf of g.leaves) {
          leaf.group.rotation.y = -leaf.side * eased * 1.35;
        }
      }
      void time;
    },
    collidersForGate() {
      if (gateState.open > 0.5) return [];
      return [{ minX: openX1, maxX: openX2, minZ: gateWorldZ - 0.2, maxZ: gateWorldZ + 0.2 }];
    },
  };
}
