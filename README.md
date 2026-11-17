# WARD THIRTEEN

**Some doors should never be opened.**

A first-person survival-horror game set in a derelict hospital at 2:47 AM. Everything you
see is generated at runtime — geometry, textures, lighting, sound and the documents you
read were written for this project. There are no imported models, images or audio files.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
npm test           # headless world + gameplay tests
```

Runs in any WebGL2 browser. Headphones recommended — the audio is positional and the
silence is part of the design.

---

## The hospital

Ten connected levels, all walkable, all served by two staircases:

| Level | Height | Contents |
|-------|--------|----------|
| Ward Thirteen | −15 m | the sealed ward, patient rooms, unknown chamber, escape passage |
| Basement B2 | −10 m | restricted research: experiment lab, observation, archive, containment |
| Basement B1 | −5 m | morgue, autopsy, cold storage, generator room, laundry, waste |
| Ground floor | 0 m | reception, security, CCTV, emergency, waiting, pharmacy, storage |
| Floors 1–5 | 5 → 25 m | wards, theatres, ICU, psychiatric, administration, records |
| Rooftop | 30 m | plant room, water tanks, helipad |

Three lifts (public, service, restricted) plus `MAP.md` / `map.json`, which are generated
from the same layout data the game builds from (`node tools/export-map.mjs`).

## Controls

| Key | Action |
|-----|--------|
| `W A S D` | walk |
| Mouse | look |
| `Shift` | sprint (uses stamina — and it is loud) |
| `Ctrl` / `C` | crouch (quieter, harder to see) |
| `E` | interact — doors, drawers, documents, lifts, hiding places |
| `F` | flashlight (limited battery, collects D-cells) |
| `G` | drop the last item in your pockets |
| `Q` | read the most recent document |
| `Tab` / `J` | inventory and journal |
| `Esc` | pause |

## What is in here

- **Procedural hospital.** Grid-based architecture data drives floors, walls, doors,
  furniture, signage, decals, lights and navigation. Rooms have themes (ward, theatre,
  morgue, lab, generator…) that decide their props and their light colour.
- **Real doors and lifts.** Doors are hinged leaves with jambs, locks, colliders and
  animation. Lifts run on a state machine with per-floor lobbies, call buttons, indicators,
  arrival bells and a motor you can hear through the shaft.
- **Flashlight.** A shadow-casting spotlight with a battery that drains, flickers when
  low, and brightens the dust and wet floors.
- **Surveillance.** The CCTV desk renders four live feeds to texture — the same world,
  other floors — and Camera 07 has something in it.
- **An intelligence in the corridors.** A pathfinding figure with hearing, line of sight,
  a suspicion value and seven states. It can hear you run, open doors, and it will search
  where it last heard you. You can hide in wardrobes, lockers and under beds.
- **A director.** Thunder, whisper events, figures crossing the corridor, a lift that
  arrives empty, lights that surge — paced so the building is mostly quiet.
- **Thirteen missions** that advance only when you actually reach a place or read a page.
- **A story told in paper.** Patient files, duty logs, memos, an autopsy report and a
  letter that was never sent. Read them in the journal.
- **Synthesised audio.** Wind, rain-threat, fluorescent hum, dripping, footsteps that
  change with the floor, doors, elevator motors and a heartbeat that rises as the thing
  gets closer. All built from oscillators and filtered noise at runtime.

## Layout of the source

```
src/
  main.js              renderer, post-processing, game loop
  game.js              the game object: modes, missions, save/load, set pieces
  core/                utils, input, save/settings, audio engine
  world/               layout data, textures, materials, props, doors, decor,
                       stairs, lifts, the world assembler, the exterior
  gameplay/            items, documents, inventory, missions, interaction,
                       player controller, entity AI, director, CCTV
  ui/                  DOM UI module + stylesheet
tests/run.mjs          headless tests (canvas shim, no GPU)
tools/export-map.mjs   generates MAP.md and map.json
```

## Testing

`npm test` boots the real `World` and the real `Game` in Node with a canvas shim: it
verifies the layout (no overlapping rooms, every door on a corridor wall, every key
obtainable, the whole mission chain completable), builds every prop and texture, pathfinds
the entity across floors, runs the player controller, restores power, sits at the CCTV
desk and round-trips a save. It cannot verify pixels — that needs a browser.

## Notes

- Saves live in `localStorage`; progress is written at checkpoints (mission changes,
  pickups, rooms entered) and restored on death.
- Graphics quality, FOV, grain and volume are in Settings and persist between sessions.
- The first click after a menu captures the mouse; `Esc` releases it and pauses.
