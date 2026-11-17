# WARD THIRTEEN — hospital map

Automatically generated from `src/world/layout.js` by `node tools/export-map.mjs`.
Do not hand-edit: change the layout and regenerate.

Grid: 48 × 40 tiles of 2 m (96 × 80 m).
Every interior level shares the same shell: corridor on rows 13–15, north rooms on
rows 1–11, south rooms on rows 17–26, doors on rows 12 and 16.

## Vertical section

| Level | Code | Y (m) | Ceiling | Above ground |
|-------|------|-------|---------|--------------|
| ROOFTOP — PLANT & HELIPAD | RF | 30 | — | yes |
| FLOOR 5 — ADMINISTRATION | 5F | 25 | 3.5 | yes |
| FLOOR 4 — PSYCHIATRIC | 4F | 20 | 3.5 | yes |
| FLOOR 3 — INTENSIVE CARE | 3F | 15 | 3.5 | yes |
| FLOOR 2 — SURGICAL | 2F | 10 | 3.5 | yes |
| FLOOR 1 — PATIENT WARDS | 1F | 5 | 3.5 | yes |
| GROUND FLOOR — RECEPTION & EMERGENCY | GF | 0 | 3.5 | yes |
| BASEMENT B1 — MORGUE & STORAGE | B1 | -5 | 3.4 | no |
| BASEMENT B2 — RESTRICTED RESEARCH | B2 | -10 | 3.4 | no |
| WARD THIRTEEN | W13 | -15 | 3.2 | no |

Stairwells A (west) and B (east) rise from Ward Thirteen through both basements,
the ground floor and all five upper floors to the roof. Three lifts serve the
building: A public, B service, D restricted.

## WARD THIRTEEN (W13) — y -15

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| W13-01 | SEALED ENTRANCE | 6,1 → 12,11 | (9,12) | wardCard | secret |
| W13-02 | PATIENT ROOM 01 | 14,1 → 18,11 | (16,12) | — | ward13 |
| W13-03 | PATIENT ROOM 02 | 25,1 → 30,11 | (27,12) | — | ward13 |
| W13-04 | EXAMINATION ROOM | 32,1 → 36,11 | (34,12) | — | theatre |
| W13-05 | CONTAINMENT | 38,1 → 41,11 | (39,12) | — | secret |
| W13-06 | SECURITY CHECKPOINT | 6,17 → 12,26 | (9,16) | — | cctv |
| W13-07 | MAIN WARD CORRIDOR | 14,17 → 18,26 | (16,16) | — | ward13 |
| W13-08 | PATIENT RECORDS | 25,17 → 30,26 | (27,16) | — | office |
| W13-09 | UNKNOWN CHAMBER | 32,17 → 36,26 | (34,16) | — | secret |
| W13-10 | EMERGENCY ESCAPE | 38,17 → 41,26 | (39,16) | — | tunnel |
| W13-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| W13-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| W13-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | — | elevator |
| W13-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | wardCard | stairs |
| W13-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | wardCard | stairs |

## BASEMENT B2 — RESTRICTED RESEARCH (B2) — y -10

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| B2-01 | RESTRICTED SECURITY | 6,1 → 12,11 | (9,12) | researchKey | cctv |
| B2-02 | BIOMETRIC ACCESS | 14,1 → 18,11 | (16,12) | — | lab |
| B2-03 | EXPERIMENT LABORATORY | 25,1 → 30,11 | (27,12) | — | lab |
| B2-04 | OBSERVATION CHAMBER | 32,1 → 36,11 | (34,12) | — | isolation |
| B2-05 | SPECIMEN STORAGE | 38,1 → 41,11 | (39,12) | — | morgue |
| B2-06 | MEDICAL TESTING | 6,17 → 12,26 | (9,16) | — | emergency |
| B2-07 | RESEARCH CONTROL | 14,17 → 18,26 | (16,16) | — | cctv |
| B2-08 | RESTRICTED ARCHIVE | 25,17 → 30,26 | (27,16) | — | office |
| B2-09 | SECURITY ARMORY | 32,17 → 36,26 | (34,16) | — | storage |
| B2-10 | CONTAINMENT ROOM | 38,17 → 41,26 | (39,16) | — | secret |
| B2-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| B2-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | b2Card | elevator |
| B2-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | b2Card | elevator |
| B2-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | b2Card | stairs |
| B2-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | b2Card | stairs |

Keys and cards on this level: wardCard (archive2).

## BASEMENT B1 — MORGUE & STORAGE (B1) — y -5

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| B1-01 | MORGUE | 6,1 → 12,11 | (9,12) | — | morgue |
| B1-02 | AUTOPSY ROOM | 14,1 → 18,11 | (16,12) | — | morgue |
| B1-03 | COLD STORAGE | 25,1 → 30,11 | (27,12) | — | morgue |
| B1-04 | MEDICAL SUPPLY | 32,1 → 36,11 | (34,12) | — | storage |
| B1-05 | MAINTENANCE WORKSHOP | 38,1 → 41,11 | (39,12) | — | boiler |
| B1-06 | MORGUE RECEPTION | 6,17 → 12,26 | (9,16) | — | office |
| B1-07 | GENERATOR ROOM | 14,17 → 18,26 | (16,16) | — | generator |
| B1-08 | WATER PUMP ROOM | 25,17 → 30,26 | (27,16) | — | boiler |
| B1-09 | OLD LAUNDRY | 32,17 → 36,26 | (34,16) | — | storage |
| B1-10 | WASTE DISPOSAL | 38,17 → 41,26 | (39,16) | — | storage |
| B1-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| B1-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| B1-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | restricted | elevator |
| B1-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | — | stairs |
| B1-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | — | stairs |

Keys and cards on this level: researchKey (morgue).

## GROUND FLOOR — RECEPTION & EMERGENCY (GF) — y 0

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| G-01 | SECURITY OFFICE | 6,1 → 12,11 | (9,12) | — | office |
| G-02 | CCTV MONITORING | 14,1 → 18,11 | (16,12) | securityKey | cctv |
| G-03 | EMERGENCY DEPT. | 25,1 → 33,11 | (29,12) | — | emergency |
| G-04 | PHARMACY | 35,1 → 38,11 | (36,12) | — | pharmacy |
| G-05 | MEDICAL STORAGE | 40,1 → 41,11 | (40,12) | — | storage |
| G-06 | PATIENT REGISTRATION | 6,17 → 12,26 | (9,16) | — | office |
| G-07 | MAIN RECEPTION | 14,17 → 18,26 | (16,16) (16,27) | — | reception |
| G-08 | WAITING HALL | 25,17 → 33,26 | (29,16) | — | waiting |
| G-09 | BILLING / ADMIN | 35,17 → 38,26 | (36,16) | — | office |
| G-10 | PUBLIC RESTROOMS | 40,17 → 41,26 | (40,16) | — | restroom |
| G-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| G-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| G-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | restricted | elevator |
| GF-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | — | stairs |
| GF-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | — | stairs |

Keys and cards on this level: securityKey (security), maintenanceKey (emergency), recordsKey (registration), gateKey (cabin).

## FLOOR 1 — PATIENT WARDS (1F) — y 5

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| F1-01 | PATIENT ROOM 12A | 6,1 → 12,11 | (9,12) | — | ward |
| F1-02 | PATIENT ROOM 12B | 14,1 → 18,11 | (16,12) | — | ward |
| F1-03 | WARD THIRTEEN | 25,1 → 30,11 | (27,12) | wardCard | ward13 |
| F1-04 | PEDIATRIC WARD | 32,1 → 36,11 | (34,12) | — | ward |
| F1-05 | CLEAN LINEN | 38,1 → 41,11 | (39,12) | — | storage |
| F1-06 | NURSES STATION | 6,17 → 12,26 | (9,16) | — | office |
| F1-07 | TREATMENT ROOM | 14,17 → 18,26 | (16,16) | — | emergency |
| F1-08 | VISITORS' LOUNGE | 25,17 → 30,26 | (27,16) | — | waiting |
| F1-09 | MEDICAL RECORDS | 32,17 → 36,26 | (34,16) | recordsKey | office |
| F1-10 | PATIENT RESTROOMS | 38,17 → 41,26 | (39,16) | — | restroom |
| F1-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| F1-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| F1-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | restricted | elevator |
| 1F-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | — | stairs |
| 1F-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | — | stairs |

## FLOOR 2 — SURGICAL (2F) — y 10

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| F2-01 | PRE-OPERATION | 6,1 → 12,11 | (9,12) | — | emergency |
| F2-02 | OPERATION THEATRE 1 | 14,1 → 18,11 | (16,12) | surgeryCard | theatre |
| F2-03 | OPERATION THEATRE 2 | 25,1 → 30,11 | (27,12) | — | theatre |
| F2-04 | STERILIZATION | 32,1 → 36,11 | (34,12) | — | lab |
| F2-05 | ANESTHESIA STORE | 38,1 → 41,11 | (39,12) | — | pharmacy |
| F2-06 | SURGICAL RECEPTION | 6,17 → 12,26 | (9,16) | — | office |
| F2-07 | RECOVERY ROOM | 14,17 → 18,26 | (16,16) | — | ward |
| F2-08 | POST-OP WARD | 25,17 → 30,26 | (27,16) | — | ward |
| F2-09 | EQUIPMENT STORE | 32,17 → 36,26 | (34,16) | — | storage |
| F2-10 | MEDICAL WASTE | 38,17 → 41,26 | (39,16) | — | storage |
| F2-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| F2-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| F2-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | restricted | elevator |
| 2F-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | — | stairs |
| 2F-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | — | stairs |

Keys and cards on this level: surgeryCard (surgical).

## FLOOR 3 — INTENSIVE CARE (3F) — y 15

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| F3-01 | INTENSIVE CARE 1 | 6,1 → 12,11 | (9,12) | — | emergency |
| F3-02 | INTENSIVE CARE 2 | 14,1 → 18,11 | (16,12) | — | emergency |
| F3-03 | CENTRAL MONITORING | 25,1 → 30,11 | (27,12) | — | cctv |
| F3-04 | RESPIRATORY CARE | 32,1 → 36,11 | (34,12) | — | lab |
| F3-05 | OXYGEN SUPPLY | 38,1 → 41,11 | (39,12) | — | storage |
| F3-06 | ICU RECEPTION | 6,17 → 12,26 | (9,16) | — | office |
| F3-07 | RESTRICTED WARD | 14,17 → 18,26 | (16,16) | icuKey | isolation |
| F3-08 | OBSERVATION ROOM | 25,17 → 30,26 | (27,16) | — | office |
| F3-09 | ISOLATION CORRIDOR | 32,17 → 36,26 | (34,16) | — | isolation |
| F3-10 | RESTRICTED RECORDS | 38,17 → 41,26 | (39,16) | — | office |
| F3-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| F3-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| F3-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | restricted | elevator |
| 3F-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | — | stairs |
| 3F-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | — | stairs |

Keys and cards on this level: icuKey (monitoring).

## FLOOR 4 — PSYCHIATRIC (4F) — y 20

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| F4-01 | PSYCHIATRIC RECEPTION | 6,1 → 12,11 | (9,12) | — | office |
| F4-02 | PATIENT OBSERVATION | 14,1 → 18,11 | (16,12) | — | isolation |
| F4-03 | GROUP THERAPY | 25,1 → 30,11 | (27,12) | — | waiting |
| F4-04 | PSYCHIATRIST'S OFFICE | 32,1 → 36,11 | (34,12) | — | office |
| F4-05 | MEDICATION STORE | 38,1 → 41,11 | (39,12) | — | pharmacy |
| F4-06 | PATIENT ROOMS | 6,17 → 12,26 | (9,16) | — | isolation |
| F4-07 | SECURE ISOLATION | 14,17 → 18,26 | (16,16) | psychKey | isolation |
| F4-08 | ACTIVITY ROOM | 25,17 → 30,26 | (27,16) | — | waiting |
| F4-09 | PATIENT RECORDS | 32,17 → 36,26 | (34,16) | — | office |
| F4-10 | TREATMENT ROOM | 38,17 → 41,26 | (39,16) | — | emergency |
| F4-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| F4-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| F4-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | restricted | elevator |
| 4F-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | — | stairs |
| 4F-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | — | stairs |

Keys and cards on this level: psychKey (consult), adminKey (psychRecords).

## FLOOR 5 — ADMINISTRATION (5F) — y 25

| Code | Room | Tile rect (x1,z1 → x2,z2) | Doors (tile) | Lock | Theme |
|------|------|---------------------------|--------------|------|-------|
| F5-01 | ADMINISTRATION | 6,1 → 12,11 | (9,12) | — | office |
| F5-02 | DIRECTOR'S OFFICE | 14,1 → 18,11 | (16,12) | adminKey | office |
| F5-03 | SERVER ROOM | 25,1 → 30,11 | (27,12) | — | cctv |
| F5-04 | RESEARCH LABORATORY | 32,1 → 36,11 | (34,12) | — | lab |
| F5-05 | SPECIMEN STORAGE | 38,1 → 41,11 | (39,12) | — | storage |
| F5-06 | STAFF MEETING ROOM | 6,17 → 12,26 | (9,16) | — | waiting |
| F5-07 | IT DEPARTMENT | 14,17 → 18,26 | (16,16) | — | office |
| F5-08 | ARCHIVE STORAGE | 25,17 → 30,26 | (27,16) | — | storage |
| F5-09 | PRIVATE RESEARCH OFFICE | 32,17 → 36,26 | (34,16) | — | office |
| F5-10 | SEALED CORRIDOR | 38,17 → 41,26 | (39,16) | b2Card | tunnel |
| F5-11 | ELEVATOR LOBBY | 20,1 → 23,11 | (21,12) | — | elevator |
| F5-12 | SERVICE LOBBY | 20,17 → 23,26 | (21,16) | — | elevator |
| F5-13 | RESTRICTED LOBBY | 43,1 → 46,11 | (44,12) | restricted | elevator |
| 5F-STAIR-A | STAIRWELL A | 1,17 → 4,25 | (2,16) | — | stairs |
| 5F-STAIR-B | STAIRWELL B | 43,17 → 46,25 | (44,16) | — | stairs |

Keys and cards on this level: b2Card (director).

## ROOFTOP — PLANT & HELIPAD (RF) — y 30

Open rooftop: plant room, water tanks, helipad, aerial masts. Reached by
lift A, stairwell A and stairwell B.

## Lifts

- **ELEVATOR A — PUBLIC** — stops: GF, 1F, 2F, 3F, 4F, 5F, RF
- **ELEVATOR B — SERVICE** — stops: B2, B1, GF, 1F, 2F, 3F, 4F, 5F
- **ELEVATOR D — RESTRICTED** — stops: B2, W13; needs the wardCard

## Stairs

- **STAIRCASE A — WEST** — tiles x 1–4, z 17–26; serves W13 → B2 → B1 → GF → 1F → 2F → 3F → 4F → 5F → RF
- **STAIRCASE B — EAST** — tiles x 43–46, z 17–26; serves W13 → B2 → B1 → GF → 1F → 2F → 3F → 4F → 5F → RF

## Cameras

| Camera | Room | Level | Position |
|--------|------|-------|----------|
| CAM 03 | MAIN RECEPTION | GF | x 15.2, z 24.5, y 2.9 |
| CAM 07 | F1 CORRIDOR | 1F | x 7.5, z 14, y 7.4 |
| CAM 11 | MORGUE | B1 | x 7.4, z 3.5, y 2.4 |
| CAM 12 | RESEARCH LAB | B2 | x 26.4, z 3.6, y 2.4 |
| CAM 04 | SURGICAL WING | 2F | x 15.4, z 14, y 12.4 |
| CAM 09 | PSYCHIATRIC WARD | 4F | x 40.2, z 22, y 22.4 |

Camera 07 (first-floor corridor) carries the scripted anomaly for Mission 3.
