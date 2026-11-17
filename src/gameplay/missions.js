/**
 * Thirteen missions, each tied to a real place in the building and to an
 * artefact the player can hold in their hands. Nothing completes because a
 * timer ran out — you have to walk there and read the thing.
 */
export const MISSIONS = [
  {
    id: 1, title: 'THE ENTRANCE', sub: '2:47 AM · WARD THIRTEEN HOSPITAL',
    objective: 'Find a way inside the hospital.',
    hint: 'The security cabin by the gate. The night officer left in a hurry.',
    check: (g) => g.flags.gateOpen && g.flags.rooms.has('reception'),
  },
  {
    id: 2, title: 'NO POWER', sub: 'GROUND FLOOR',
    objective: 'Restore electricity to the building.',
    hint: 'The generator is in the basement. It needs diesel — the storage room on B1 has a can.',
    check: (g) => g.flags.powerOn,
  },
  {
    id: 3, title: 'THE SECURITY ROOM', sub: 'CCTV MONITORING · GROUND FLOOR',
    objective: 'Access the CCTV system and check the camera feeds.',
    hint: 'The security office keeps the key. Camera 07 is the one nobody will talk about.',
    check: (g) => g.flags.cctvAnomaly,
  },
  {
    id: 4, title: 'PATIENT ZERO', sub: 'PATIENT WARDS · FLOOR 1',
    objective: 'Find the records of a missing patient.',
    hint: 'The records room on the first floor is locked. The registration desk on the ground floor keeps a key.',
    check: (g) => g.flags.docsRead.has('patientFile'),
  },
  {
    id: 5, title: 'THE SURGICAL DEPARTMENT', sub: 'OPERATION THEATRES · FLOOR 2',
    objective: 'Search the operating theatres for the procedure log.',
    hint: 'Theatre 1 needs a consultant card. Surgical reception will have one.',
    check: (g) => g.flags.docsRead.has('doc_surgery_log'),
  },
  {
    id: 6, title: 'THE RESTRICTED WARD', sub: 'INTENSIVE CARE · FLOOR 3',
    objective: 'Find the chart of subject 13-00.',
    hint: 'Central monitoring holds the ICU ward key. The restricted ward is at the end of the floor.',
    check: (g) => g.flags.docsRead.has('doc_patientzero'),
  },
  {
    id: 7, title: 'THE PSYCHIATRIC DEPARTMENT', sub: 'PSYCHIATRIC WARD · FLOOR 4',
    objective: 'Recover Dr. Voss\u2019s personnel file from the psychiatric records.',
    hint: 'The psychiatrist\u2019s office keeps the secure wing key. Patient records hold what administration wants forgotten.',
    check: (g) => g.flags.docsRead.has('doc_psych_records'),
  },
  {
    id: 8, title: 'THE MORGUE', sub: 'BASEMENT B1',
    objective: 'Descend to B1 and find the key to the restricted facility.',
    hint: 'The morgue intake log is worth reading. The body was never found.',
    check: (g) => g.flags.docsRead.has('doc_autopsy') && g.inventory.has('researchKey'),
  },
  {
    id: 9, title: 'THE RESEARCH FACILITY', sub: 'BASEMENT B2',
    objective: 'Enter B2 and find out what was done here.',
    hint: 'The service lift needs a research card — the director had one. Floor 5.',
    check: (g) => g.flags.docsRead.has('doc_experiment') && g.flags.docsRead.has('doc_observation'),
  },
  {
    id: 10, title: 'WARD THIRTEEN', sub: 'RESTRICTED ARCHIVE · B2',
    objective: 'Discover what Ward Thirteen was.',
    hint: 'The restricted archive on B2 still has the project file.',
    check: (g) => g.flags.docsRead.has('doc_ward13_file'),
  },
  {
    id: 11, title: 'THE THIRTEENTH WARD', sub: 'SUB-LEVEL 13',
    objective: 'Take the restricted lift down to Ward Thirteen.',
    hint: 'The ward card opens the restricted lift in the B2 lobby.',
    check: (g) => g.flags.rooms.has('w13Corridor'),
  },
  {
    id: 12, title: 'SOMETHING IS HERE', sub: 'WARD THIRTEEN',
    objective: 'Find the truth in the unknown chamber.',
    hint: 'The chamber at the end of the ward. The machine is still running.',
    check: (g) => g.flags.docsRead.has('doc_truth'),
  },
  {
    id: 13, title: 'ESCAPE', sub: 'WARD THIRTEEN · EMERGENCY PASSAGE',
    objective: 'Get out. The east stairwell leads up.',
    hint: 'Do not run. It hears running. Reach the emergency escape passage.',
    check: (g) => g.flags.escaped,
  },
];

export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.started = false;
    this.completed = [];
    this.timeOnMission = 0;
    this._shown = new Set();
  }

  get current() { return MISSIONS[this.index] || null; }

  start(index = 0) {
    this.index = Math.max(0, Math.min(index, MISSIONS.length - 1));
    this.started = true;
    this.completed = MISSIONS.slice(0, this.index).map((m) => m.id);
    this._showBanner();
    this._announce();
  }

  _showBanner() {
    const m = this.current;
    if (!m) return;
    this.game.ui.showMissionBanner(m.title, m.sub);
  }

  _announce() {
    const m = this.current;
    if (!m) return;
    this.game.ui.setObjective(m.objective, m.hint);
  }

  completeMission(index = this.index) {
    const m = MISSIONS[index];
    if (!m) return;
    if (!this.completed.includes(m.id)) this.completed.push(m.id);
    this.game.audio?.missionComplete();
    if (index === this.index && this.index < MISSIONS.length - 1) {
      this.index++;
      if (this.current) {
        this.game.ui.setObjective(this.current.objective, this.current.hint);
        this.game.ui.showMissionBanner(this.current.title, this.current.sub);
        this.game.toast(`MISSION ${this.current.id} — ${this.current.title}`);
      }
      this.game.requestSave('mission');
    } else {
      this.game.ui.setObjective(m.objective, '');
    }
  }

  update(dt) {
    if (!this.started) return;
    this.timeOnMission += dt;
    const m = this.current;
    if (!m) return;
    if (m.check(this.game)) {
      this.completeMission();
    }
  }

  toJSON() {
    return { index: this.index, completed: [...this.completed] };
  }
  fromJSON(data) {
    if (!data) return;
    this.index = data.index ?? 0;
    this.completed = data.completed ? [...data.completed] : [];
  }
}
