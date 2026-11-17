/**
 * Generates MAP.md and map.json from the architecture data so the documentation
 * can never drift away from the building the game actually builds.
 *
 *   node tools/export-map.mjs
 */
import { writeFileSync } from 'node:fs';
import {
  LEVELS, LEVEL_BY_ID, TILE, GRID_W, GRID_H, WORLD_W, WORLD_H,
  STAIR_SHAFTS, ELEVATORS, CAMERAS, SPAWN, GATE, LOOT, CORE_ROOMS,
} from '../src/world/layout.js';

const codesByLevel = {};
const codeFor = (level) => {
  const prefix = { w13: 'W13', b2: 'B2', b1: 'B1', gf: 'G', f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', roof: 'RF' }[level.id] || level.id.toUpperCase();
  codesByLevel[level.id] = codesByLevel[level.id] || 0;
  codesByLevel[level.id] += 1;
  return `${prefix}-${String(codesByLevel[level.id]).padStart(2, '0')}`;
};

const map = {
  game: 'WARD THIRTEEN',
  version: 2,
  generated: new Date().toISOString().slice(0, 10),
  grid: { tileMetres: TILE, width: GRID_W, height: GRID_H, worldWidth: WORLD_W, worldDepth: WORLD_H },
  spawn: { x: SPAWN.tx, z: SPAWN.tz, yaw: SPAWN.yaw, note: 'approach road, outside the chained gate' },
  gate: { z: GATE.z, opening: [GATE.openingX1, GATE.openingX2] },
  levels: [],
  elevators: ELEVATORS.map((e) => ({
    id: e.id, name: e.name, stops: e.stops, requires: e.requires || null,
    centre: e.centre, car: { width: e.innerW, depth: e.innerD },
  })),
  stairs: STAIR_SHAFTS.map((s) => ({ id: s.id, name: s.name, x: [s.x1, s.x2], z: [s.z1, s.z2], levels: s.levels })),
  cameras: CAMERAS.map((c) => ({ id: c.id, name: c.name, level: c.level, at: [c.tx, c.tz], y: c.y })),
};

const lines = [];
lines.push('# WARD THIRTEEN — hospital map');
lines.push('');
lines.push('Automatically generated from `src/world/layout.js` by `node tools/export-map.mjs`.');
lines.push('Do not hand-edit: change the layout and regenerate.');
lines.push('');
lines.push(`Grid: ${GRID_W} × ${GRID_H} tiles of ${TILE} m (${WORLD_W} × ${WORLD_H} m).`);
lines.push('Every interior level shares the same shell: corridor on rows 13–15, north rooms on');
lines.push('rows 1–11, south rooms on rows 17–26, doors on rows 12 and 16.');
lines.push('');

// vertical summary
lines.push('## Vertical section');
lines.push('');
lines.push('| Level | Code | Y (m) | Ceiling | Above ground |');
lines.push('|-------|------|-------|---------|--------------|');
for (const l of [...LEVELS].sort((a, b) => b.y - a.y)) {
  lines.push(`| ${l.name} | ${l.short} | ${l.y} | ${l.ceil || '—'} | ${l.y >= 0 ? 'yes' : 'no'} |`);
}
lines.push('');
lines.push('Stairwells A (west) and B (east) rise from Ward Thirteen through both basements,');
lines.push('the ground floor and all five upper floors to the roof. Three lifts serve the');
lines.push('building: A public, B service, D restricted.');
lines.push('');

for (const level of LEVELS) {
  if (level.kind !== 'interior') {
    lines.push(`## ${level.name} (${level.short}) — y ${level.y}`);
    lines.push('');
    lines.push('Open rooftop: plant room, water tanks, helipad, aerial masts. Reached by');
    lines.push('lift A, stairwell A and stairwell B.');
    lines.push('');
    map.levels.push({ id: level.id, name: level.name, y: level.y, kind: level.kind, rooms: [] });
    continue;
  }
  const rooms = [...level.rooms, ...Object.values(level.cores || {})];
  const entry = {
    id: level.id, name: level.name, short: level.short, y: level.y, ceiling: level.ceil, kind: level.kind,
    rooms: [],
  };
  lines.push(`## ${level.name} (${level.short}) — y ${level.y}`);
  lines.push('');
  lines.push('| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |');
  lines.push('|------|------|---------------------------|--------------|------|-------|');
  for (const r of rooms) {
    const code = r.open ? `${level.short}-STAIR-${r.id.endsWith('west') ? 'A' : 'B'}` : codeFor(level);
    const doors = (r.doors || []).map((d) => `(${d.x},${d.z})`).join(' ') || '—';
    const lock = (r.doors || []).map((d) => d.locked).filter(Boolean).join(', ') || '—';
    lines.push(`| ${code} | ${r.name} | ${r.x1},${r.z1} → ${r.x2},${r.z2} | ${doors} | ${lock} | ${r.theme || '—'} |`);
    entry.rooms.push({
      code, id: r.id, name: r.name, theme: r.theme || null,
      rect: { x1: r.x1, z1: r.z1, x2: r.x2, z2: r.z2 },
      doors: (r.doors || []).map((d) => ({ x: d.x, z: d.z, locked: d.locked || null, keyName: d.keyName || null, exterior: !!d.exterior })),
      loot: (LOOT[level.id] || {})[r.id] || [],
    });
  }
  lines.push('');
  const loot = LOOT[level.id] || {};
  const keys = [];
  for (const [room, items] of Object.entries(loot)) {
    for (const it of items) {
      if (/Key$|Card$/.test(it)) keys.push(`${it} (${room})`);
    }
  }
  if (keys.length) {
    lines.push(`Keys and cards on this level: ${keys.join(', ')}.`);
    lines.push('');
  }
  map.levels.push(entry);
}

lines.push('## Lifts');
lines.push('');
for (const e of ELEVATORS) {
  lines.push(`- **${e.name}** — stops: ${e.stops.map((s) => LEVEL_BY_ID[s]?.short || s).join(', ')}${e.requires ? `; needs the ${e.requires}` : ''}`);
}
lines.push('');
lines.push('## Stairs');
lines.push('');
for (const s of STAIR_SHAFTS) {
  lines.push(`- **${s.name}** — tiles x ${s.x1}–${s.x2}, z ${s.z1}–${s.z2}; serves ${s.levels.map((l) => LEVEL_BY_ID[l]?.short).join(' → ')}`);
}
lines.push('');
lines.push('## Cameras');
lines.push('');
lines.push('| Camera | Room | Level | Position |');
lines.push('|--------|------|-------|----------|');
for (const c of CAMERAS) lines.push(`| ${c.id} | ${c.name} | ${LEVEL_BY_ID[c.level]?.short || c.level} | x ${c.tx}, z ${c.tz}, y ${c.y} |`);
lines.push('');
lines.push('Camera 07 (first-floor corridor) carries the scripted anomaly for Mission 3.');
lines.push('');

writeFileSync(new URL('../MAP.md', import.meta.url), lines.join('\n'));
writeFileSync(new URL('../map.json', import.meta.url), JSON.stringify(map, null, 2));
console.log(`MAP.md: ${lines.length} lines · map.json: ${map.levels.reduce((n, l) => n + l.rooms.length, 0)} rooms`);
