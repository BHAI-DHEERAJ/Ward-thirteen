/**
 * WARD THIRTEEN — hospital architecture.
 *
 * One building, ten levels, one shared tile grid (2 m). Every level occupies a
 * real Y position; the stairs and elevators are physically continuous.
 *
 *   W13   y = -15   secret ward (sealed)
 *   B2    y = -10   restricted research
 *   B1    y =  -5   morgue / storage / generator
 *   GF    y =   0   reception / emergency / security
 *   F1    y =   5   patient wards / records
 *   F2    y =  10   surgical department
 *   F3    y =  15   ICU / restricted ward
 *   F4    y =  20   psychiatric department
 *   F5    y =  25   administration / research
 *   ROOF  y =  30   plant, water tanks, helipad
 *
 * Grid: 48 × 40 tiles = 96 × 80 m.
 * Building shell x 1..46, z 1..26. Court z 27..33, gate z 34, spawn z 37.
 */

export const TILE = 2.0;
export const GRID_W = 48;
export const GRID_H = 40;
export const FLOOR_GAP = 5.0;
export const WORLD_W = GRID_W * TILE;
export const WORLD_H = GRID_H * TILE;

export const worldX = (tx) => (tx + 0.5) * TILE - WORLD_W / 2;
export const worldZ = (tz) => (tz + 0.5) * TILE - WORLD_H / 2;
export const tileX = (x) => (x + WORLD_W / 2) / TILE - 0.5;
export const tileZ = (z) => (z + WORLD_H / 2) / TILE - 0.5;

export const CORRIDOR = { x1: 6, x2: 41, z1: 13, z2: 15, floor: 'linoleum', wall: 'plaster' };

// --------------------------------------------------------------- vertical core
export const CORE = {
  elevatorPublic: { x1: 20, x2: 23, z1: 1, z2: 11, id: 'core_public' },
  elevatorService: { x1: 20, x2: 23, z1: 17, z2: 26, id: 'core_service' },
  elevatorRestricted: { x1: 43, x2: 46, z1: 1, z2: 11, id: 'core_restricted' },
  stairsWest: { x1: 1, x2: 4, z1: 17, z2: 25, id: 'stairs_west' },
  stairsEast: { x1: 43, x2: 46, z1: 17, z2: 25, id: 'stairs_east' },
};

const room = (id, name, side, x1, x2, theme, opts = {}) => ({
  id, name, side, x1, x2, theme,
  z1: side === 'n' ? 1 : 17,
  z2: side === 'n' ? 11 : 26,
  floor: opts.floor || (side === 'n' ? 'linoleum' : 'liner'),
  wall: opts.wall || 'plaster',
  doors: [], windows: [], ...opts,
});

const N = (id, name, x1, x2, theme, opts) => room(id, name, 'n', x1, x2, theme, opts);
const S = (id, name, x1, x2, theme, opts) => room(id, name, 's', x1, x2, theme, opts);

// A floor's rooms must not overlap, and must leave a 1-tile gap for a wall.
const GF_ROOMS = [
  N('security', 'SECURITY OFFICE', 6, 12, 'office'),
  N('cctv', 'CCTV MONITORING', 14, 18, 'cctv', { locked: 'securityKey', keyName: 'Security Key' }),
  N('emergency', 'EMERGENCY DEPT.', 25, 33, 'emergency', { floor: 'tileFloor', wall: 'tileWall' }),
  N('pharmacy', 'PHARMACY', 35, 38, 'pharmacy', { floor: 'tileFloor', wall: 'tileWall' }),
  N('storage', 'MEDICAL STORAGE', 40, 41, 'storage', { floor: 'concreteFloor' }),

  S('registration', 'PATIENT REGISTRATION', 6, 12, 'office'),
  S('reception', 'MAIN RECEPTION', 14, 18, 'reception', { floor: 'tileFloor', exterior: 16 }),
  S('waiting', 'WAITING HALL', 25, 33, 'waiting', { floor: 'tileFloor' }),
  S('billing', 'BILLING / ADMIN', 35, 38, 'office'),
  S('restrooms', 'PUBLIC RESTROOMS', 40, 41, 'restroom', { floor: 'tileFloor', wall: 'tileWall' }),
];

const F1_ROOMS = [
  N('ward12a', 'PATIENT ROOM 12A', 6, 12, 'ward'),
  N('ward12b', 'PATIENT ROOM 12B', 14, 18, 'ward'),
  N('ward13', 'WARD THIRTEEN', 25, 30, 'ward13', { locked: 'wardCard', keyName: 'Ward Thirteen Access Card', floor: 'linoleum', wall: 'tileWall' }),
  N('pediatric', 'PEDIATRIC WARD', 32, 36, 'ward'),
  N('linen', 'CLEAN LINEN', 38, 41, 'storage'),

  S('nurses', 'NURSES STATION', 6, 12, 'office'),
  S('treatment', 'TREATMENT ROOM', 14, 18, 'emergency', { floor: 'tileFloor', wall: 'tileWall' }),
  S('visitors', "VISITORS' LOUNGE", 25, 30, 'waiting'),
  S('records', 'MEDICAL RECORDS', 32, 36, 'office', { locked: 'recordsKey', keyName: 'Records Room Key' }),
  S('restrooms2', 'PATIENT RESTROOMS', 38, 41, 'restroom', { floor: 'tileFloor', wall: 'tileWall' }),
];

const F2_ROOMS = [
  N('preop', 'PRE-OPERATION', 6, 12, 'emergency', { floor: 'tileFloor', wall: 'tileWall' }),
  N('ot1', 'OPERATION THEATRE 1', 14, 18, 'theatre', { floor: 'tileFloor', wall: 'tileWall', locked: 'surgeryCard', keyName: 'Surgical Access Card' }),
  N('ot2', 'OPERATION THEATRE 2', 25, 30, 'theatre', { floor: 'tileFloor', wall: 'tileWall' }),
  N('sterile', 'STERILIZATION', 32, 36, 'lab', { floor: 'tileFloor', wall: 'tileWall' }),
  N('anesthesia', 'ANESTHESIA STORE', 38, 41, 'pharmacy'),

  S('surgical', 'SURGICAL RECEPTION', 6, 12, 'office'),
  S('recovery', 'RECOVERY ROOM', 14, 18, 'ward'),
  S('postop', 'POST-OP WARD', 25, 30, 'ward'),
  S('equipment', 'EQUIPMENT STORE', 32, 36, 'storage'),
  S('waste', 'MEDICAL WASTE', 38, 41, 'storage', { floor: 'concreteFloor' }),
];

const F3_ROOMS = [
  N('icu1', 'INTENSIVE CARE 1', 6, 12, 'emergency', { floor: 'tileFloor', wall: 'tileWall' }),
  N('icu2', 'INTENSIVE CARE 2', 14, 18, 'emergency', { floor: 'tileFloor', wall: 'tileWall' }),
  N('monitoring', 'CENTRAL MONITORING', 25, 30, 'cctv'),
  N('respiratory', 'RESPIRATORY CARE', 32, 36, 'lab'),
  N('oxygen', 'OXYGEN SUPPLY', 38, 41, 'storage'),

  S('icuReception', 'ICU RECEPTION', 6, 12, 'office'),
  S('restrictedWard', 'RESTRICTED WARD', 14, 18, 'isolation', { locked: 'icuKey', keyName: 'ICU Ward Key' }),
  S('observation', 'OBSERVATION ROOM', 25, 30, 'office'),
  S('isoCorridor', 'ISOLATION CORRIDOR', 32, 36, 'isolation'),
  S('icuRecords', 'RESTRICTED RECORDS', 38, 41, 'office'),
];

const F4_ROOMS = [
  N('psychReception', 'PSYCHIATRIC RECEPTION', 6, 12, 'office'),
  N('psychObserve', 'PATIENT OBSERVATION', 14, 18, 'isolation'),
  N('therapy', 'GROUP THERAPY', 25, 30, 'waiting'),
  N('consult', "PSYCHIATRIST'S OFFICE", 32, 36, 'office'),
  N('medstore', 'MEDICATION STORE', 38, 41, 'pharmacy'),

  S('psychRooms', 'PATIENT ROOMS', 6, 12, 'isolation'),
  S('secureIso', 'SECURE ISOLATION', 14, 18, 'isolation', { locked: 'psychKey', keyName: 'Psych Ward Key' }),
  S('activity', 'ACTIVITY ROOM', 25, 30, 'waiting'),
  S('psychRecords', 'PATIENT RECORDS', 32, 36, 'office'),
  S('electro', 'TREATMENT ROOM', 38, 41, 'emergency'),
];

const F5_ROOMS = [
  N('admin', 'ADMINISTRATION', 6, 12, 'office'),
  N('director', "DIRECTOR'S OFFICE", 14, 18, 'office', { locked: 'adminKey', keyName: "Director's Office Key" }),
  N('server', 'SERVER ROOM', 25, 30, 'cctv'),
  N('research', 'RESEARCH LABORATORY', 32, 36, 'lab'),
  N('specimen', 'SPECIMEN STORAGE', 38, 41, 'storage'),

  S('meeting', 'STAFF MEETING ROOM', 6, 12, 'waiting'),
  S('it', 'IT DEPARTMENT', 14, 18, 'office'),
  S('archive', 'ARCHIVE STORAGE', 25, 30, 'storage'),
  S('privateOffice', 'PRIVATE RESEARCH OFFICE', 32, 36, 'office'),
  S('secretCorridor', 'SEALED CORRIDOR', 38, 41, 'tunnel', { locked: 'b2Card', keyName: 'Research Access Card' }),
];

const B1_ROOMS = [
  N('morgue', 'MORGUE', 6, 12, 'morgue', { floor: 'tileFloor', wall: 'tileWall' }),
  N('autopsy', 'AUTOPSY ROOM', 14, 18, 'morgue', { floor: 'tileFloor', wall: 'tileWall' }),
  N('cold', 'COLD STORAGE', 25, 30, 'morgue', { floor: 'tileFloor', wall: 'tileWall' }),
  N('supply', 'MEDICAL SUPPLY', 32, 36, 'storage'),
  N('workshop', 'MAINTENANCE WORKSHOP', 38, 41, 'boiler'),

  S('morgueReception', 'MORGUE RECEPTION', 6, 12, 'office'),
  S('generator', 'GENERATOR ROOM', 14, 18, 'generator'),
  S('pumps', 'WATER PUMP ROOM', 25, 30, 'boiler'),
  S('laundry', 'OLD LAUNDRY', 32, 36, 'storage'),
  S('waste', 'WASTE DISPOSAL', 38, 41, 'storage', { floor: 'concreteFloor' }),
];

const B2_ROOMS = [
  N('securityGate', 'RESTRICTED SECURITY', 6, 12, 'cctv', { locked: 'researchKey', keyName: 'Research Key' }),
  N('biometric', 'BIOMETRIC ACCESS', 14, 18, 'lab'),
  N('researchLab', 'EXPERIMENT LABORATORY', 25, 30, 'lab', { wall: 'tileWall', floor: 'tileFloor' }),
  N('observation', 'OBSERVATION CHAMBER', 32, 36, 'isolation'),
  N('specimen2', 'SPECIMEN STORAGE', 38, 41, 'morgue', { floor: 'tileFloor' }),

  S('testing', 'MEDICAL TESTING', 6, 12, 'emergency', { wall: 'tileWall', floor: 'tileFloor' }),
  S('control', 'RESEARCH CONTROL', 14, 18, 'cctv'),
  S('archive2', 'RESTRICTED ARCHIVE', 25, 30, 'office'),
  S('armory', 'SECURITY ARMORY', 32, 36, 'storage'),
  S('containment', 'CONTAINMENT ROOM', 38, 41, 'secret'),
];

const W13_ROOMS = [
  N('w13Sealed', 'SEALED ENTRANCE', 6, 12, 'secret', { locked: 'wardCard', keyName: 'Ward Thirteen Access Card' }),
  N('w13Patient1', 'PATIENT ROOM 01', 14, 18, 'ward13'),
  N('w13Patient2', 'PATIENT ROOM 02', 25, 30, 'ward13'),
  N('w13Exam', 'EXAMINATION ROOM', 32, 36, 'theatre'),
  N('w13Containment', 'CONTAINMENT', 38, 41, 'secret'),

  S('w13Checkpoint', 'SECURITY CHECKPOINT', 6, 12, 'cctv'),
  S('w13Corridor', 'MAIN WARD CORRIDOR', 14, 18, 'ward13'),
  S('w13Records', 'PATIENT RECORDS', 25, 30, 'office'),
  S('w13Unknown', 'UNKNOWN CHAMBER', 32, 36, 'secret'),
  S('w13Escape', 'EMERGENCY ESCAPE', 38, 41, 'tunnel'),
];

const ALL_INTERIOR = ['b2', 'b1', 'gf', 'f1', 'f2', 'f3', 'f4', 'f5', 'w13'];

function withDoors(rooms) {
  return rooms.map((r) => {
    const doorX = Math.floor((r.x1 + r.x2) / 2);
    const z = r.side === 'n' ? 12 : 16;
    return {
      ...r,
      floor: r.floor === 'liner' ? (r.side === 'n' ? 'linoleum' : 'linoleum') : r.floor,
      doors: [
        {
          x: doorX, z, side: r.side,
          locked: r.locked || null,
          keyName: r.keyName || null,
          label: r.name,
        },
        ...(r.exterior != null ? [{ x: r.exterior, z: 27, wide: true, label: 'Main Entrance', exterior: true, axis: 'z' }] : []),
      ],
      windows: r.exterior != null ? [{ x: r.exterior - 4, z: 27 }, { x: r.exterior + 4, z: 27 }] : [],
    };
  });
}

const LEVEL_DEFS = [
  {
    id: 'w13', name: 'WARD THIRTEEN', short: 'W13', y: -15, ceil: 3.2, kind: 'interior',
    rooms: W13_ROOMS, corridor: { ...CORRIDOR, floor: 'concreteFloor', wall: 'concreteWall' }, darkness: 0.028,
    secret: true,
  },
  {
    id: 'b2', name: 'BASEMENT B2 — RESTRICTED RESEARCH', short: 'B2', y: -10, ceil: 3.4, kind: 'interior',
    rooms: B2_ROOMS, corridor: { ...CORRIDOR, floor: 'concreteFloor', wall: 'concreteWall' }, darkness: 0.03,
  },
  {
    id: 'b1', name: 'BASEMENT B1 — MORGUE & STORAGE', short: 'B1', y: -5, ceil: 3.4, kind: 'interior',
    rooms: B1_ROOMS, corridor: { ...CORRIDOR, floor: 'concreteFloor', wall: 'concreteWall' }, darkness: 0.035,
  },
  {
    id: 'gf', name: 'GROUND FLOOR — RECEPTION & EMERGENCY', short: 'GF', y: 0, ceil: 3.5, kind: 'interior',
    rooms: GF_ROOMS, corridor: { ...CORRIDOR }, darkness: 0.05,
    outdoor: { x1: 1, z1: 27, x2: 46, z2: 33 },
    approach: { x1: 1, z1: 35, x2: 46, z2: 39 },
  },
  {
    id: 'f1', name: 'FLOOR 1 — PATIENT WARDS', short: '1F', y: 5, ceil: 3.5, kind: 'interior',
    rooms: F1_ROOMS, corridor: { ...CORRIDOR }, darkness: 0.045,
  },
  {
    id: 'f2', name: 'FLOOR 2 — SURGICAL', short: '2F', y: 10, ceil: 3.5, kind: 'interior',
    rooms: F2_ROOMS, corridor: { ...CORRIDOR, floor: 'tileFloor' }, darkness: 0.04,
  },
  {
    id: 'f3', name: 'FLOOR 3 — INTENSIVE CARE', short: '3F', y: 15, ceil: 3.5, kind: 'interior',
    rooms: F3_ROOMS, corridor: { ...CORRIDOR, floor: 'tileFloor' }, darkness: 0.04,
  },
  {
    id: 'f4', name: 'FLOOR 4 — PSYCHIATRIC', short: '4F', y: 20, ceil: 3.5, kind: 'interior',
    rooms: F4_ROOMS, corridor: { ...CORRIDOR }, darkness: 0.038,
  },
  {
    id: 'f5', name: 'FLOOR 5 — ADMINISTRATION', short: '5F', y: 25, ceil: 3.5, kind: 'interior',
    rooms: F5_ROOMS, corridor: { ...CORRIDOR }, darkness: 0.042,
  },
  {
    id: 'roof', name: 'ROOFTOP — PLANT & HELIPAD', short: 'RF', y: 30, ceil: 0, kind: 'roof',
    rooms: [], corridor: null, darkness: 0.05,
  },
];

for (const def of LEVEL_DEFS) {
  if (def.kind === 'interior') {
    def.rooms = withDoors(def.rooms).map((r) => ({ ...r, level: def.id }));
  }
}

export const LEVELS = LEVEL_DEFS;
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
export const getLevel = (id) => LEVEL_BY_ID[id];
export const INTERIOR_LEVELS = ALL_INTERIOR;

/** Vertical shafts. All coordinates are tiles. */
export const STAIR_SHAFTS = [
  {
    id: 'west', name: 'STAIRCASE A — WEST', x1: 1, x2: 4, z1: 17, z2: 26,
    landing: [17, 20], flightA: [20, 24.5], mid: [24.5, 26], flightB: [26, 20],
    laneA: [1, 2.5], laneB: [2.5, 4],
    levels: ['w13', 'b2', 'b1', 'gf', 'f1', 'f2', 'f3', 'f4', 'f5', 'roof'],
    door: { x: 2, z: 16 },
    bottom: 'w13', top: 'roof',
  },
  {
    id: 'east', name: 'STAIRCASE B — EAST', x1: 43, x2: 46, z1: 17, z2: 26,
    landing: [17, 20], flightA: [20, 24.5], mid: [24.5, 26], flightB: [26, 20],
    laneA: [43, 44.5], laneB: [44.5, 46],
    levels: ['w13', 'b2', 'b1', 'gf', 'f1', 'f2', 'f3', 'f4', 'f5', 'roof'],
    door: { x: 44, z: 16 },
    bottom: 'w13', top: 'roof',
  },
];

export const ELEVATORS = [
  {
    id: 'public', name: 'ELEVATOR A — PUBLIC',
    centre: { tx: 21.5, tz: 3.2 }, innerW: 2.4, innerD: 2.5,
    stops: ['gf', 'f1', 'f2', 'f3', 'f4', 'f5', 'roof'],
    lobbyRoom: 'core_public',
    doorFacing: 'south',
    panelOffset: { x: 1.65, z: 1.55 },
  },
  {
    id: 'service', name: 'ELEVATOR B — SERVICE',
    centre: { tx: 21.5, tz: 19.4 }, innerW: 2.4, innerD: 2.5,
    stops: ['b2', 'b1', 'gf', 'f1', 'f2', 'f3', 'f4', 'f5'],
    lobbyRoom: 'core_service',
    doorFacing: 'north',
    panelOffset: { x: 1.65, z: -1.55 },
  },
  {
    id: 'restricted', name: 'ELEVATOR D — RESTRICTED',
    centre: { tx: 44.5, tz: 3.2 }, innerW: 2.2, innerD: 2.4,
    stops: ['b2', 'w13'],
    lobbyRoom: 'core_restricted',
    doorFacing: 'south',
    panelOffset: { x: 1.35, z: 1.5 },
    requires: 'wardCard',
  },
];

/** Where each level's stair landing opens into its rooms (door already in rooms). */
export const CORE_ROOMS = {
  // every interior level gets these lobby rooms, which are not in the room lists
  core_public: { x1: 20, x2: 23, z1: 1, z2: 11, name: 'ELEVATOR LOBBY', theme: 'elevator', floor: 'tileFloor', side: 'n' },
  core_service: { x1: 20, x2: 23, z1: 17, z2: 26, name: 'SERVICE LOBBY', theme: 'elevator', floor: 'concreteFloor', side: 's' },
  core_restricted: { x1: 43, x2: 46, z1: 1, z2: 11, name: 'RESTRICTED LOBBY', theme: 'elevator', floor: 'tileFloor', side: 'n' },
  stairs_west: { x1: 1, x2: 4, z1: 17, z2: 25, name: 'STAIRWELL A', theme: 'stairs', floor: 'concreteFloor', wall: 'concreteWall', side: 's', open: true },
  stairs_east: { x1: 43, x2: 46, z1: 17, z2: 25, name: 'STAIRWELL B', theme: 'stairs', floor: 'concreteFloor', wall: 'concreteWall', side: 's', open: true },
};

/** Every interior level: attach core rooms + their doors. */
for (const def of LEVELS) {
  if (def.kind !== 'interior') continue;
  const cores = ['core_public', 'core_service', 'core_restricted', 'stairs_west', 'stairs_east'];
  def.cores = {};
  for (const cid of cores) {
    const c = CORE_ROOMS[cid];
    const r = {
      ...c, id: cid, level: def.id,
      z2: c.z2,
      doors: [{ x: Math.floor((c.x1 + c.x2) / 2), z: c.side === 'n' ? 12 : 16, side: c.side, label: c.name }],
      windows: [],
    };
    if (cid === 'stairs_west' || cid === 'stairs_east') {
      // the stair landing is open to the shaft; no floor slab mesh
      r.floor = 'concreteFloor';
      r.doors = [{ x: c.side === 'n' ? 2 : (cid === 'stairs_west' ? 2 : 44), z: 16, side: 's', label: 'Stairwell', openDoor: true }];
      if (def.id === 'b2') { r.doors[0].locked = 'b2Card'; r.doors[0].keyName = 'Research Access Card'; }
      if (def.id === 'w13') { r.doors[0].locked = 'wardCard'; r.doors[0].keyName = 'Ward Thirteen Access Card'; }
    }
    if (cid === 'core_restricted') {
      const sealed = def.id !== 'b2' && def.id !== 'w13';
      r.sealed = sealed;
      if (sealed) { r.doors[0].locked = 'restricted'; r.doors[0].keyName = 'Restricted Access'; }
      else if (def.id === 'b2') { r.doors[0].locked = 'b2Card'; r.doors[0].keyName = 'Research Access Card'; }
      else { r.doors[0].locked = null; }
    }
    if (cid === 'core_service' && def.id === 'b2') {
      r.doors[0].locked = 'b2Card';
      r.doors[0].keyName = 'Research Access Card';
    }
    def.cores[cid] = r;
  }
}

/** Loot per level/room. Mission items are always visible, documents hide in furniture. */
export const LOOT = {
  gf: {
    security: ['securityKey', 'note_watchlog', 'battery'],
    cctv: ['note_cctv', 'battery'],
    emergency: ['maintenanceKey', 'medicine', 'note_emergency'],
    pharmacy: ['medicine', 'medicine', 'battery', 'note_pharmacy'],
    storage: ['battery', 'fuelCan', 'note_storage'],
    registration: ['recordsKey', 'note_registration', 'battery'],
    reception: ['battery', 'note_reception', 'doc_directory', 'medicine'],
    waiting: ['note_waiting', 'battery'],
    billing: ['note_billing', 'medicine'],
    restrooms: ['note_restroom'],
    cabin: ['gateKey', 'note_cabin'],
  },
  f1: {
    ward12a: ['note_patient12', 'battery', 'medicine'],
    ward12b: ['note_ward_call', 'medicine'],
    ward13: ['doc_ward13_log', 'note_scratch', 'battery'],
    pediatric: ['note_pediatric', 'battery'],
    linen: ['battery', 'note_linen'],
    nurses: ['note_nurses', 'medicine'],
    treatment: ['medicine', 'battery', 'note_treatment'],
    visitors: ['note_visitors', 'battery'],
    records: ['patientFile', 'doc_ward13_seal', 'note_records'],
    restrooms2: ['battery'],
  },
  f2: {
    preop: ['note_preop', 'medicine'],
    ot1: ['doc_surgery_log', 'note_ot', 'battery'],
    ot2: ['note_ot2', 'medicine'],
    sterile: ['battery', 'note_sterile'],
    anesthesia: ['medicine', 'note_anesthesia'],
    surgical: ['surgeryCard', 'note_surgical', 'battery'],
    recovery: ['note_recovery', 'medicine'],
    postop: ['battery', 'note_postop'],
    equipment: ['battery', 'note_equipment'],
    waste: ['note_waste'],
  },
  f3: {
    icu1: ['note_icu', 'battery'],
    icu2: ['note_icu2', 'medicine'],
    monitoring: ['icuKey', 'note_monitoring', 'battery'],
    respiratory: ['medicine', 'battery'],
    oxygen: ['battery', 'note_oxygen'],
    icuReception: ['note_icuReception', 'medicine'],
    restrictedWard: ['doc_patientzero', 'note_restrictedWard', 'battery'],
    observation: ['note_observation'],
    isoCorridor: ['note_isolation', 'battery'],
    icuRecords: ['doc_icu_records', 'note_icu_records'],
  },
  f4: {
    psychReception: ['note_psychReception', 'battery'],
    psychObserve: ['note_observation2', 'medicine'],
    therapy: ['note_therapy', 'battery'],
    consult: ['psychKey', 'doc_psych_notes', 'note_consult'],
    medstore: ['medicine', 'medicine', 'battery'],
    psychRooms: ['note_psych_rooms', 'battery'],
    secureIso: ['doc_isolation', 'note_secureIso', 'medicine'],
    activity: ['note_activity', 'battery'],
    psychRecords: ['adminKey', 'doc_psych_records', 'note_psychRecords'],
    electro: ['note_electro', 'medicine'],
  },
  f5: {
    admin: ['note_admin', 'battery'],
    director: ['b2Card', 'note_director', 'doc_director'],
    server: ['note_server', 'battery'],
    research: ['doc_research', 'note_research', 'medicine'],
    specimen: ['note_specimen', 'battery'],
    meeting: ['note_meeting'],
    it: ['note_it', 'battery'],
    archive: ['doc_archive', 'note_archive2'],
    privateOffice: ['doc_private', 'note_private', 'battery'],
    secretCorridor: ['note_sealed'],
  },
  b1: {
    morgue: ['researchKey', 'note_morgue', 'battery'],
    autopsy: ['doc_autopsy', 'note_autopsy', 'medicine'],
    cold: ['note_cold', 'battery'],
    supply: ['fuelCan', 'battery', 'battery', 'note_supply'],
    workshop: ['note_workshop', 'tool'],
    morgueReception: ['note_morgueReception', 'medicine'],
    generator: ['note_generator'],
    pumps: ['note_pumps', 'battery'],
    laundry: ['note_laundry', 'battery'],
    waste: ['note_wasteB1'],
  },
  b2: {
    securityGate: ['note_b2gate', 'battery'],
    biometric: ['note_biometric', 'medicine'],
    researchLab: ['doc_experiment', 'note_researchLab', 'battery'],
    observation: ['doc_observation', 'note_observationB2'],
    specimen2: ['note_specimen2', 'battery'],
    testing: ['doc_testing', 'medicine'],
    control: ['doc_control', 'note_control', 'battery'],
    archive2: ['doc_ward13_file', 'wardCard', 'note_archiveB2'],
    armory: ['note_armory', 'battery'],
    containment: ['note_containment', 'medicine'],
  },
  w13: {
    w13Sealed: ['note_w13entry'],
    w13Patient1: ['doc_w13_patient1', 'note_w13_p1', 'battery'],
    w13Patient2: ['doc_w13_patient2', 'note_w13_p2'],
    w13Exam: ['doc_w13_exam', 'note_w13_exam'],
    w13Containment: ['note_w13_containment', 'battery'],
    w13Checkpoint: ['note_w13_checkpoint'],
    w13Corridor: ['note_w13_corridor'],
    w13Records: ['doc_w13_records', 'note_w13_records'],
    w13Unknown: ['doc_truth', 'note_w13_unknown'],
    w13Escape: ['note_w13_escape'],
  },
};

export const SCATTER = {
  gf: [
    { item: 'battery', tx: 15.2, tz: 18.4 }, { item: 'medicine', tx: 27.4, tz: 20.2 },
    { item: 'battery', tx: 8.6, tz: 14.2 }, { item: 'paper', tx: 18.2, tz: 14.6 },
    { item: 'battery', tx: 36.4, tz: 18.2 },
  ],
  f1: [
    { item: 'battery', tx: 16.2, tz: 9.4 }, { item: 'medicine', tx: 30.4, tz: 22.4 },
    { item: 'battery', tx: 39.4, tz: 8.2 }, { item: 'paper', tx: 8.2, tz: 21.2 },
  ],
  f2: [
    { item: 'battery', tx: 15.4, tz: 6.2 }, { item: 'medicine', tx: 33.2, tz: 21.4 },
    { item: 'paper', tx: 26.4, tz: 15.8 }, { item: 'battery', tx: 9.2, tz: 18.2 },
  ],
  f3: [
    { item: 'medicine', tx: 16.2, tz: 3.2 }, { item: 'battery', tx: 26.4, tz: 20.2 },
    { item: 'paper', tx: 34.2, tz: 10.4 }, { item: 'battery', tx: 8.2, tz: 14.4 },
  ],
  f4: [
    { item: 'battery', tx: 16.4, tz: 8.2 }, { item: 'medicine', tx: 27.4, tz: 21.2 },
    { item: 'paper', tx: 33.2, tz: 14.2 }, { item: 'battery', tx: 40.2, tz: 10.4 },
  ],
  f5: [
    { item: 'battery', tx: 8.4, tz: 8.2 }, { item: 'paper', tx: 20.4, tz: 22.4 },
    { item: 'medicine', tx: 28.2, tz: 10.4 }, { item: 'battery', tx: 34.2, tz: 20.4 },
  ],
  b1: [
    { item: 'battery', tx: 8.2, tz: 20.2 }, { item: 'medicine', tx: 15.4, tz: 15.2 },
    { item: 'battery', tx: 26.4, tz: 8.2 }, { item: 'paper', tx: 33.2, tz: 21.4 },
  ],
  b2: [
    { item: 'battery', tx: 16.2, tz: 8.4 }, { item: 'medicine', tx: 27.4, tz: 15.2 },
    { item: 'paper', tx: 34.2, tz: 21.4 }, { item: 'battery', tx: 40.2, tz: 8.2 },
  ],
  w13: [
    { item: 'battery', tx: 16.2, tz: 8.4 }, { item: 'battery', tx: 27.2, tz: 20.4 },
    { item: 'paper', tx: 34.2, tz: 14.4 },
  ],
};

// ------------------------------------------------------------------ cameras
export const CAMERAS = [
  { id: 'CAM 03', name: 'MAIN RECEPTION', level: 'gf', tx: 15.2, tz: 24.5, y: 2.9, lookTx: 20, lookTz: 14.5, fov: 64 },
  { id: 'CAM 07', name: 'F1 CORRIDOR', level: 'f1', tx: 7.5, tz: 14, y: 7.4, lookTx: 20, lookTz: 14.05, fov: 52, anomaly: true },
  { id: 'CAM 11', name: 'MORGUE', level: 'b1', tx: 7.4, tz: 3.5, y: 2.4, lookTx: 12, lookTz: 8.5, fov: 60 },
  { id: 'CAM 12', name: 'RESEARCH LAB', level: 'b2', tx: 26.4, tz: 3.6, y: 2.4, lookTx: 30, lookTz: 9.5, fov: 58 },
  { id: 'CAM 04', name: 'SURGICAL WING', level: 'f2', tx: 15.4, tz: 14, y: 12.4, lookTx: 25, lookTz: 14.1, fov: 55 },
  { id: 'CAM 09', name: 'PSYCHIATRIC WARD', level: 'f4', tx: 40.2, tz: 22, y: 22.4, lookTx: 30, lookTz: 22.1, fov: 58 },
];

// ------------------------------------------------------------------- world fixtures
export const GATE = { z: 34, x1: 1, x2: 46, openingX1: 21.2, openingX2: 25.8, sign: ['WARD THIRTEEN', 'HOSPITAL'] };
export const SECURITY_CABIN = { tx: 29, tz: 30.5, w: 3.6, d: 3.0, h: 2.7 };
export const AMBULANCE = { tx: 12, tz: 30.5, rot: -0.18 };
export const SPAWN = { tx: 23.5, tz: 37.2, yaw: Math.PI };
export const BUS_STOP = { tx: 40, tz: 36.5 };

export const FLOOR_LABEL = (id) => (LEVEL_BY_ID[id]?.short || '??');

export function roomBoundsOf(r) {
  return {
    x0: r.x1 * TILE - WORLD_W / 2,
    x1: (r.x2 + 1) * TILE - WORLD_W / 2,
    z0: r.z1 * TILE - WORLD_H / 2,
    z1: (r.z2 + 1) * TILE - WORLD_H / 2,
  };
}
