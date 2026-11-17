import * as THREE from 'three';
import { mulberry32, clamp } from '../core/utils.js';

/**
 * Every surface in the hospital is painted procedurally at boot: no external
 * texture files, no downloaded assets. The generator is seeded so the building
 * looks identical every session, and every texture is tiling (wrap-safe).
 */

function canvas(size, height) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = height || size;
  return c;
}

function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth tileable value noise over a lattice of `cells` cells. */
function valueNoise(size, cells, seed, px, py) {
  const fx = (px / size) * cells;
  const fy = (py / size) * cells;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const w = (x, y) => hash2(((x % cells) + cells) % cells, ((y % cells) + cells) % cells, seed);
  const a = w(x0, y0), b = w(x0 + 1, y0), c = w(x0, y0 + 1), d = w(x0 + 1, y0 + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

function fbm(size, px, py, seed, octaves = 4, base = 4, gain = 0.5) {
  let v = 0, amp = 1, total = 0, cells = base;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(size, cells, seed + i * 17, px, py) * amp;
    total += amp;
    amp *= gain;
    cells *= 2;
  }
  return v / total;
}

function paint(size, fn) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const col = fn(x, y);
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
      d[i + 3] = col.length > 3 ? col[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grain(ctx, size, amount, alpha, seed = 1) {
  const rnd = mulberry32(seed);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  if (alpha) {
    ctx.fillStyle = alpha;
    ctx.fillRect(0, 0, size, size);
  }
}

function blotches(ctx, size, seed, count, color, minR, maxR, alpha = 0.1) {
  const rnd = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size;
    const r = minR + rnd() * (maxR - minR);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('ALPHA', String(alpha)));
    g.addColorStop(0.65, color.replace('ALPHA', String(alpha * 0.45)));
    g.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function cracks(ctx, size, seed, count, color) {
  const rnd = mulberry32(seed);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    let x = rnd() * size, y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rnd() * 10);
    ctx.lineWidth = 0.6 + rnd() * 1.3;
    for (let s = 0; s < segs; s++) {
      a += (rnd() - 0.5) * 1.1;
      const len = 3 + rnd() * 16;
      x += Math.cos(a) * len; y += Math.sin(a) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- textures

function concreteWall(seed = 11) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 5, 4) * 0.7 + fbm(S, x, y, seed + 9, 3, 40) * 0.3;
    const streak = Math.max(0, fbm(S, x, y * 0.15, seed + 31, 3, 6) - 0.5) * 1.5;
    const base = 116 + n * 42;
    return [
      clamp(base * 0.98 - streak * 34, 0, 255),
      clamp(base * 1.01 - streak * 30, 0, 255),
      clamp(base * 0.93 - streak * 26, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 3, 22, 'rgba(58,52,38,ALPHA)', 20, 90, 0.16);
  blotches(ctx, S, seed + 7, 12, 'rgba(92,88,62,ALPHA)', 10, 40, 0.11);
  blotches(ctx, S, seed + 12, 5, 'rgba(30,34,28,ALPHA)', 40, 130, 0.13);
  cracks(ctx, S, seed + 5, 5, 'rgba(38,36,28,0.35)');
  grain(ctx, S, 16, null, seed + 1);
  return c;
}

function plasterGreen(seed = 23) {
  // faded institutional green paint over plaster, scuffed skirt
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 4, 5);
    const peel = fbm(S, x, y, seed + 4, 5, 8);
    const skirting = y > S * 0.86 ? 0.72 : 1;
    const dirt = Math.max(0, fbm(S, x, y, seed + 21, 3, 3) - 0.42) * 1.4;
    return [
      clamp((92 + n * 26) * skirting - dirt * 22, 0, 255),
      clamp((108 + n * 30) * skirting - dirt * 20, 0, 255),
      clamp((92 + n * 24) * skirting - dirt * 18, 0, 255),
      peel > 0.7 ? 255 : 255,
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 1, 26, 'rgba(48,44,30,ALPHA)', 20, 100, 0.2);
  blotches(ctx, S, seed + 8, 9, 'rgba(120,116,90,ALPHA)', 20, 70, 0.14);
  // paint peeling away to bare plaster
  const rnd = mulberry32(seed + 44);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, w = 8 + rnd() * 46, h = 6 + rnd() * 34;
    ctx.fillStyle = `rgba(126,120,104,${0.1 + rnd() * 0.24})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  cracks(ctx, S, seed + 2, 8, 'rgba(40,36,28,0.4)');
  grain(ctx, S, 14, null, seed + 3);
  return c;
}

function tileWall(seed = 31, tint = [176, 186, 168]) {
  const S = 512;
  const N = 8;
  const cell = S / N;
  const c = paint(S, (x, y) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    const inGroutX = x % cell < 2.2 || x % cell > cell - 2.2;
    const inGroutY = y % cell < 2.2 || y % cell > cell - 2.2;
    const tileJitter = hash2(gx, gy, seed) * 14 - 7;
    const n = fbm(S, x, y, seed, 3, 30);
    if (inGroutX || inGroutY) {
      const g = 96 + n * 26;
      return [g, g * 0.98, g * 0.9];
    }
    const brown = Math.max(0, fbm(S, x, y, seed + 5, 3, 6) - 0.5) * 2;
    return [
      clamp(tint[0] + tileJitter + n * 12 - brown * 26, 0, 255),
      clamp(tint[1] + tileJitter + n * 12 - brown * 22, 0, 255),
      clamp(tint[2] + tileJitter + n * 10 - brown * 18, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  // missing / cracked tiles
  const rnd = mulberry32(seed + 17);
  for (let i = 0; i < 9; i++) {
    const gx = Math.floor(rnd() * N), gy = Math.floor(rnd() * N);
    ctx.fillStyle = `rgba(78,74,62,${0.35 + rnd() * 0.4})`;
    ctx.fillRect(gx * cell + 3, gy * cell + 3, cell - 6, cell - 6);
  }
  blotches(ctx, S, seed + 2, 22, 'rgba(52,48,34,ALPHA)', 18, 80, 0.15);
  blotches(ctx, S, seed + 6, 6, 'rgba(60,74,56,ALPHA)', 30, 110, 0.12);
  cracks(ctx, S, seed + 9, 6, 'rgba(50,46,38,0.45)');
  grain(ctx, S, 12, null, seed + 4);
  return c;
}

function floorTile(seed = 57) {
  const S = 512;
  const N = 4; // 2m of floor = 4x 50cm tiles
  const cell = S / N;
  const c = paint(S, (x, y) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    const check = (gx + gy) % 2 === 0;
    const grout = x % cell < 3 || y % cell < 3;
    const n = fbm(S, x, y, seed, 4, 20);
    if (grout) { const g = 62 + n * 20; return [g, g * 0.98, g * 0.92]; }
    const base = check ? 148 : 118;
    const dirt = Math.max(0, fbm(S, x, y, seed + 2, 4, 3) - 0.44) * 1.6;
    return [
      clamp(base + n * 26 - dirt * 46, 0, 255),
      clamp(base * 0.99 + n * 24 - dirt * 44, 0, 255),
      clamp(base * 0.94 + n * 20 - dirt * 40, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 3, 26, 'rgba(38,36,28,ALPHA)', 16, 90, 0.2);
  blotches(ctx, S, seed + 5, 8, 'rgba(70,60,40,ALPHA)', 30, 120, 0.12);
  cracks(ctx, S, seed + 8, 7, 'rgba(40,38,32,0.4)');
  grain(ctx, S, 12, null, seed + 9);
  return c;
}

function linoleum(seed = 71, tint = [138, 132, 108]) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 4, 6);
    const speck = hash2(x, y, seed + 3) > 0.94 ? 34 : 0;
    const dirt = Math.max(0, fbm(S, x, y, seed + 9, 3, 2) - 0.4) * 1.8;
    return [
      clamp(tint[0] + n * 28 + speck - dirt * 40, 0, 255),
      clamp(tint[1] + n * 26 + speck - dirt * 38, 0, 255),
      clamp(tint[2] + n * 22 + speck - dirt * 32, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 1, 18, 'rgba(44,40,28,ALPHA)', 20, 110, 0.16);
  blotches(ctx, S, seed + 7, 5, 'rgba(96,86,60,ALPHA)', 40, 150, 0.1);
  grain(ctx, S, 10, null, seed + 2);
  return c;
}

function concreteFloor(seed = 83, tint = [92, 90, 84]) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 5, 5);
    const wet = Math.max(0, fbm(S, x, y, seed + 4, 3, 2) - 0.5) * 1.2;
    return [
      clamp(tint[0] + n * 34 - wet * 30, 0, 255),
      clamp(tint[1] + n * 32 - wet * 30, 0, 255),
      clamp(tint[2] + n * 30 - wet * 28, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 3, 20, 'rgba(20,20,18,ALPHA)', 20, 120, 0.24);
  cracks(ctx, S, seed + 5, 10, 'rgba(30,30,26,0.5)');
  grain(ctx, S, 16, null, seed + 6);
  return c;
}

function wood(seed = 97) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const plank = Math.floor(y / 64);
    const seam = y % 64 < 2;
    const n = fbm(S, x * 0.4, y * 5, seed + plank, 3, 4);
    const base = 84 + hash2(plank, 0, seed) * 24;
    if (seam) return [26, 22, 17];
    return [
      clamp(base + n * 26, 0, 255),
      clamp(base * 0.72 + n * 20, 0, 255),
      clamp(base * 0.52 + n * 14, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 2, 16, 'rgba(28,22,16,ALPHA)', 20, 90, 0.3);
  grain(ctx, S, 18, null, seed + 3);
  return c;
}

function metalPainted(seed = 113, tint = [104, 108, 100]) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 4, 8);
    const scratch = Math.abs(fbm(S, x * 6, y * 0.4, seed + 4, 2, 12) - 0.5) < 0.02 ? 40 : 0;
    return [
      clamp(tint[0] + n * 30 + scratch, 0, 255),
      clamp(tint[1] + n * 28 + scratch, 0, 255),
      clamp(tint[2] + n * 26 + scratch, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 1, 18, 'rgba(58,38,22,ALPHA)', 6, 40, 0.4);
  grain(ctx, S, 14, null, seed + 2);
  return c;
}

function rust(seed = 127) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 5, 5);
    const n2 = fbm(S, x, y, seed + 8, 4, 18);
    const t = clamp(n * 0.7 + n2 * 0.5, 0, 1);
    return [
      clamp(64 + t * 96, 0, 255),
      clamp(44 + t * 58, 0, 255),
      clamp(30 + t * 34, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 3, 30, 'rgba(30,20,12,ALPHA)', 6, 46, 0.3);
  grain(ctx, S, 22, null, seed + 4);
  return c;
}

function fabric(seed = 131, tint = [150, 156, 136]) {
  const S = 256;
  const c = paint(S, (x, y) => {
    const weave = (Math.sin(x * 1.9) * Math.cos(y * 1.9)) * 5;
    const n = fbm(S, x, y, seed, 4, 6);
    return [
      clamp(tint[0] + n * 20 + weave, 0, 255),
      clamp(tint[1] + n * 20 + weave, 0, 255),
      clamp(tint[2] + n * 18 + weave, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 2, 12, 'rgba(58,52,34,ALPHA)', 10, 60, 0.22);
  grain(ctx, S, 12, null, seed + 3);
  return c;
}

function mattress(seed = 149) {
  const S = 256;
  const c = paint(S, (x, y) => {
    const stripe = (y % 32 < 4) ? 16 : 0;
    const n = fbm(S, x, y, seed, 4, 8);
    const stain = Math.max(0, fbm(S, x, y, seed + 6, 4, 4) - 0.42) * 2;
    return [
      clamp(150 + n * 22 + stripe - stain * 74, 0, 255),
      clamp(146 + n * 20 - stain * 66, 0, 255),
      clamp(128 + n * 18 - stain * 52, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 1, 20, 'rgba(78,58,34,ALPHA)', 6, 40, 0.35);
  blotches(ctx, S, seed + 4, 6, 'rgba(52,30,22,ALPHA)', 8, 30, 0.4);
  grain(ctx, S, 14, null, seed + 5);
  return c;
}

function grass(seed = 167) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 5, 4);
    const blade = hash2(x, Math.floor(y / 3), seed) > 0.72 ? 16 : 0;
    return [
      clamp(26 + n * 34 + blade, 0, 255),
      clamp(34 + n * 40 + blade, 0, 255),
      clamp(24 + n * 22, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 2, 20, 'rgba(30,26,18,ALPHA)', 20, 110, 0.3);
  grain(ctx, S, 20, null, seed + 3);
  return c;
}

function asphalt(seed = 181) {
  const S = 512;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 5, 8);
    const pebble = hash2(x, y, seed + 2) > 0.93 ? 26 : 0;
    return [clamp(30 + n * 28 + pebble, 0, 255), clamp(31 + n * 28 + pebble, 0, 255), clamp(32 + n * 26 + pebble, 0, 255)];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 3, 14, 'rgba(10,12,12,ALPHA)', 30, 140, 0.34);
  grain(ctx, S, 16, null, seed + 4);
  return c;
}

function ceilingPanel(seed = 199) {
  const S = 256;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 5, 10);
    const pit = hash2(x, y, seed + 4) > 0.9 ? 18 : 0;
    const stain = Math.max(0, fbm(S, x, y, seed + 8, 4, 3) - 0.46) * 2.2;
    return [
      clamp(138 + n * 22 + pit - stain * 64, 0, 255),
      clamp(136 + n * 20 + pit - stain * 58, 0, 255),
      clamp(122 + n * 18 - stain * 46, 0, 255),
    ];
  });
  const ctx = c.getContext('2d');
  blotches(ctx, S, seed + 2, 12, 'rgba(70,58,34,ALPHA)', 10, 70, 0.3);
  grain(ctx, S, 12, null, seed + 3);
  return c;
}

function grimeDecal(seed = 211) {
  const S = 256;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  blotches(ctx, S, seed, 24, 'rgba(22,20,16,ALPHA)', 6, 60, 0.42);
  blotches(ctx, S, seed + 5, 10, 'rgba(48,42,28,ALPHA)', 10, 80, 0.24);
  return c;
}

function bloodDecal(seed = 223) {
  const S = 256;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  for (let i = 0; i < 5; i++) {
    const cx = S / 2 + (rnd() - 0.5) * 60;
    const cy = S / 2 + (rnd() - 0.5) * 40;
    const r = 20 + rnd() * 52;
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(62,10,8,0.85)');
    g.addColorStop(0.6, 'rgba(48,8,6,0.5)');
    g.addColorStop(1, 'rgba(40,6,4,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  // spatter
  for (let i = 0; i < 80; i++) {
    const a = rnd() * Math.PI * 2, d = 10 + rnd() * 105;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
    ctx.fillStyle = `rgba(46,8,6,${0.2 + rnd() * 0.5})`;
    ctx.beginPath(); ctx.arc(x, y, 0.6 + rnd() * 3.2, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function paper(seed = 239) {
  const S = 256;
  const c = paint(S, (x, y) => {
    const n = fbm(S, x, y, seed, 4, 8);
    const stain = Math.max(0, fbm(S, x, y, seed + 3, 4, 4) - 0.5) * 1.6;
    return [clamp(186 + n * 30 - stain * 50, 0, 255), clamp(180 + n * 28 - stain * 48, 0, 255), clamp(160 + n * 26 - stain * 44, 0, 255)];
  });
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(70,66,54,0.28)';
  ctx.lineWidth = 1;
  for (let y = 28; y < S; y += 18) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(S - 16, y); ctx.stroke(); }
  grain(ctx, S, 8, null, seed + 4);
  return c;
}

function staticNoise(seed = 251) {
  const S = 256;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const rnd = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 150) + 24;
    img.data[i] = v * 0.92; img.data[i + 1] = v; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function normalMapFrom(canvasEl, strength = 2.2) {
  const S = canvasEl.width;
  const src = canvasEl.getContext('2d').getImageData(0, 0, S, S).data;
  const out = canvas(S);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(S, S);
  const lum = (x, y) => {
    const xx = (x + S) % S, yy = (y + S) % S;
    const i = (yy * S + xx) * 4;
    return (src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11) / 255;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Simple stencilled sign texture (used for the hospital gate and room plates). */
export function signTexture(lines, opts = {}) {
  const W = opts.width || 1024;
  const H = opts.height || 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || '#232a25';
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberry32(7);
  // weathering
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${30 + rnd() * 40},${28 + rnd() * 34},${22 + rnd() * 26},${rnd() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 4 + rnd() * 60, 3 + rnd() * 30, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = opts.border || 'rgba(150,145,120,0.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = opts.size || Math.min(H / (lines.length + 0.4), W / 12);
  ctx.font = `${opts.weight || 'bold'} ${size}px "Special Elite", "Courier New", monospace`;
  ctx.fillStyle = opts.color || '#c9c3a8';
  lines.forEach((line, i) => {
    const y = H / 2 + (i - (lines.length - 1) / 2) * size * 1.15;
    ctx.fillText(line, W / 2, y);
  });
  // rust bleed
  for (let i = 0; i < 34; i++) {
    const x = rnd() * W;
    const g = ctx.createLinearGradient(x, 0, x, H);
    g.addColorStop(0, `rgba(96,56,30,${rnd() * 0.2})`);
    g.addColorStop(1, 'rgba(96,56,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + rnd() * 10, H);
  }
  return c;
}

class TextureLibrary {
  constructor() {
    this.cache = new Map();
    this.all = [];
  }

  _make(key, canvasEl, { repeat = [1, 1], srgb = true, normalStrength = 0, anisotropy = 4 } = {}) {
    const tex = new THREE.CanvasTexture(canvasEl);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
    const entry = { map: tex };
    if (normalStrength > 0) {
      const nm = new THREE.CanvasTexture(normalMapFrom(canvasEl, normalStrength));
      nm.wrapS = nm.wrapT = THREE.RepeatWrapping;
      nm.repeat.set(repeat[0], repeat[1]);
      nm.colorSpace = THREE.NoColorSpace;
      entry.normal = nm;
      this.all.push(nm);
    }
    this.all.push(tex);
    this.cache.set(key, entry);
    return entry;
  }

  get(name, opts) {
    if (this.cache.has(name)) return this.cache.get(name);
    let key = name, el;
    switch (name) {
      case 'plaster': el = plasterGreen(23); break;
      case 'concreteWall': el = concreteWall(11); break;
      case 'tileWall': el = tileWall(31); break;
      case 'tileWallGreen': el = tileWall(37, [148, 164, 140]); break;
      case 'tileFloor': el = floorTile(57); break;
      case 'linoleum': el = linoleum(71); break;
      case 'linoleumGreen': el = linoleum(79, [112, 124, 96]); break;
      case 'concreteFloor': el = concreteFloor(83); break;
      case 'wood': el = wood(97); break;
      case 'metal': el = metalPainted(113); break;
      case 'metalDark': el = metalPainted(117, [74, 76, 72]); break;
      case 'rust': el = rust(127); break;
      case 'fabric': el = fabric(131); break;
      case 'fabricWhite': el = fabric(137, [172, 170, 152]); break;
      case 'mattress': el = mattress(149); break;
      case 'grass': el = grass(167); break;
      case 'asphalt': el = asphalt(181); break;
      case 'ceiling': el = ceilingPanel(199); break;
      case 'grime': el = grimeDecal(211); break;
      case 'blood': el = bloodDecal(223); break;
      case 'paper': el = paper(239); break;
      default: el = concreteWall(11);
    }
    const normalStrength = ['plaster', 'tileWall', 'tileWallGreen', 'tileFloor', 'concreteWall', 'concreteFloor', 'wood', 'rust', 'mattress'].includes(name) ? 1.6 : 0;
    return this._make(key, el, { repeat: opts?.repeat || [1, 1], normalStrength, srgb: true });
  }

  setAnisotropy(max) {
    for (const t of this.all) { t.anisotropy = max; t.needsUpdate = true; }
  }

  // Canvas textures that are refreshed at runtime (monitors, TV static, screens)
  dynamic(key, canvasEl, { srgb = true } = {}) {
    if (this.cache.has(key)) return this.cache.get(key).map;
    const tex = new THREE.CanvasTexture(canvasEl);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    this.cache.set(key, { map: tex });
    this.all.push(tex);
    return tex;
  }
}

export const textures = new TextureLibrary();
export { staticNoise, canvas as makeCanvas, blotches, mulberry32 };
