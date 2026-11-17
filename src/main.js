import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Game } from './game.js';
import { Settings } from './core/save.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);
scene.fog = new THREE.FogExp2(0x0a0f13, 0.014);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 420);
camera.position.set(0, 2.4, 36);

Settings.load();

/** Film grain + vignette + a restrained grade. No colour wash. */
const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uGrain: { value: Settings.data.grain ? 0.055 : 0 },
    uVignette: { value: 0.62 },
    uDesat: { value: 0.07 },
    uBright: { value: 1.0 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uDesat;
    uniform float uBright;
    uniform float uFlash;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float g = hash(vUv * uRes + fract(uTime) * 91.7) - 0.5;
      c += g * uGrain;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.92, 0.24, length(d * vec2(1.06, 1.0)));
      c *= mix(1.0, v, uVignette);
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(lum), uDesat);
      c = pow(max(c, 0.0), vec3(1.02)) * uBright;
      c += uFlash;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const grainPass = new ShaderPass(GrainShader);
composer.addPass(grainPass);

let useComposer = true;

function setQuality(quality) {
  const q = quality || 'medium';
  useComposer = q !== 'low';
  const ratio = q === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : q === 'medium' ? 1 : Math.min(window.devicePixelRatio || 1, 1);
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = q !== 'low';
  grainPass.uniforms.uGrain.value = Settings.data.grain ? (q === 'low' ? 0.03 : 0.055) : 0;
  resize();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  grainPass.uniforms.uRes.value.set(w, h);
}

window.addEventListener('resize', resize);

const game = new Game({ renderer, scene, camera, canvas });
game.onQuality = (q) => setQuality(q);
game.onRender = () => {};

// pointer lock: clicking the canvas re-captures the mouse while playing
canvas.addEventListener('click', () => {
  if (game.mode === 'playing' && !game.input.locked) game.input.lock();
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.mode === 'playing') {
    // small delay so a lock request from a menu transition doesn't cause a pause
    setTimeout(() => {
      if (!document.pointerLockElement && game.mode === 'playing') game.pause();
    }, 350);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') game.pause();
});

let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, Math.max(0.0005, raw || 0.016));
  acc += dt;

  try {
    game.update(dt);
  } catch (e) {
    console.error('update error', e);
  }

  grainPass.uniforms.uTime.value = acc;
  grainPass.uniforms.uGrain.value = Settings.data.grain ? 0.05 : 0;
  grainPass.uniforms.uFlash.value = 0;

  try {
    if (game.cctv && game.cctv.seated && game.mode === 'cctv') {
      game.cctv.renderFeeds(renderer);
    }
    if (useComposer) composer.render();
    else renderer.render(scene, camera);
  } catch (e) {
    console.error('render error', e);
  }

  game.input.endFrame();
}

(async function boot() {
  try {
    await game.init((p, status) => game.ui.setLoading(p, status));
  } catch (e) {
    console.error('init failed', e);
    const st = document.getElementById('load-status');
    if (st) st.textContent = `Failed to initialise: ${e.message}`;
    return;
  }
  setQuality(Settings.data.quality);
  requestAnimationFrame(frame);
})();

// expose for debugging from the console without polluting the bundle
window.__ward13 = game;
