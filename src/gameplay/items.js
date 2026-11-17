/**
 * Items + documents. Ward Thirteen's story is told through the paperwork the
 * staff left behind, so every note is written as a real artefact: a memo, a
 * chart, a duty log, a letter that was never sent.
 */

export const ITEMS = {
  gateKey: { name: 'Gate Key', kind: 'keys', desc: 'A heavy brass key on a ring marked "MAIN GATE — NIGHT SHIFT". The tag is water-stained.', pickup: 'key' },
  maintenanceKey: { name: 'Maintenance Key', kind: 'keys', desc: 'A chipped steel key. The tape label reads "PLANT / STAIRWELL".', pickup: 'key' },
  securityKey: { name: 'Security Key', kind: 'keys', desc: 'A dented key with a red plastic collar. "CCTV / G-202".', pickup: 'key' },
  recordsKey: { name: 'Records Room Key', kind: 'keys', desc: 'Small brass key stamped 1F-025. A nurse\u2019s initials are scratched into it.', pickup: 'key' },
  surgeryCard: { name: 'Surgical Access Card', kind: 'keys', desc: 'A magnetic card, warped by heat. "THEATRE 1 — CONSULTANT ONLY".', pickup: 'accessCard' },
  icuKey: { name: 'ICU Ward Key', kind: 'keys', desc: 'A long key with a worn blue tab. It smells faintly of disinfectant.', pickup: 'key' },
  psychKey: { name: 'Psych Ward Key', kind: 'keys', desc: 'A heavy key on a chain. The tag says "SECURE WING — 4F".', pickup: 'key' },
  adminKey: { name: "Director's Office Key", kind: 'keys', desc: 'A brass key with a black enamel fob embossed S.A.H. It is warm to the touch.', pickup: 'key' },
  b2Card: { name: 'Research Access Card', kind: 'keys', desc: 'A blank white card. Under the lamp you can see a magnetic stripe and the print "B2 — CLEARANCE 4".', pickup: 'accessCard' },
  researchKey: { name: 'Research Key', kind: 'keys', desc: 'A short steel key, hand-stamped "B2" on the bow.', pickup: 'key' },
  wardCard: { name: 'Ward 13 Access Card', kind: 'keys', desc: 'A grey card with a thin red stripe. The number 13 is printed so small it is almost a smudge.', pickup: 'accessCard' },

  battery: { name: 'Battery', kind: 'batteries', desc: 'A D-cell battery. Still cold. It should be good for a few more minutes of light.', pickup: 'battery', stack: true },
  medicine: { name: 'Painkillers', kind: 'medicines', desc: 'A blister pack of painkillers, expired years ago. It will dull the pain.', pickup: 'medicine', stack: true, use: 'heal' },
  tool: { name: 'Pipe Wrench', kind: 'tools', desc: 'A heavy wrench, the jaw scored by years of use. Someone scratched a tally into the handle.', pickup: 'battery' },
  fuelCan: { name: 'Diesel Can', kind: 'tools', desc: 'A red can, half full. The cap is loose and the smell is overwhelming.', pickup: 'fuelCan' },
  patientFile: { name: "Kell, Adrien — File 13-00", kind: 'documents', desc: 'A patient file so often handled the corner has worn through.', pickup: 'patientFile', document: 'patientFile' },
  paper: { name: 'Torn Paper', kind: 'documents', desc: 'A loose sheet, mostly illegible.', pickup: 'paper', document: 'paper_scrap' },
};

// --------------------------------------------------------------- documents
const D = (title, dept, date, body, sig = '') => ({ title, dept, date, body, sig });

export const DOCUMENTS = {
  patientFile: D(
    'PATIENT RECORD — KELL, ADRIEN',
    'ST. AUGUSTINE HOSPITAL · WARD 13',
    'ADMITTED 03.11.1989',
    `NAME: Kell, Adrien
AGE: 11
REFERRING: Dr. E. Voss (Ward 13 Programme)

PRESENTING: Persistent night terrors. Reports "a man in the corridor who
does not have a face". No physical pathology. No response to sedation.

COURSE: Transferred from Paediatrics to Ward 13 on 03.11.1989 for
"observation". Guardian not informed. Guardian is listed as deceased.

NOTE (Dr. Voss, 21.11): Subject 13-00 tolerates the procedure far better
than the others. He does not sleep now. He does not appear to need to.

NOTE (Dr. Voss, 02.12): He asked me today why the other children stopped
moving. I told him they were resting. He said, "No. They are waiting."

DISCHARGE: —
STATUS: OPEN`,
    'FILE CLOSED BY ORDER OF THE HOSPITAL DIRECTOR — 1996'
  ),
  doc_ward13_seal: D(
    'MEMORANDUM — WARD 13 CLOSURE',
    'OFFICE OF THE HOSPITAL DIRECTOR',
    '14.08.1994',
    `Effective immediately, Ward 13 is to be sealed.

All records relating to the "Somatic Recalibration" programme are to be
transferred to the restricted archive on B2. No staff are to descend below
B1 without my written authority. The lift to sub-level 13 is to be
disconnected and the landing door welded shut.

This is not a discussion. I have seen the corridor. I have counted the
patients twice and I will not do it a third time.

Any employee who speaks of this to the press will be dismissed without
reference.`,
    '— H. MERCER, HOSPITAL DIRECTOR'
  ),
  doc_ward13_log: D(
    'WARD 13 — NIGHT LOG',
    'SENIOR NURSING STAFF',
    '31.10.1994',
    `23:40 — All 43 patients accounted for at handover.
00:15 — Restraint check complete. 13-00 is awake again. He watches the door.
01:02 — Emergency lighting on B2 failed. Generator is running; the fault is
         not power.
02:47 — Something walked past the nurses' station. I counted the patients.
         There are 44.
03:10 — I have locked the ward from the inside. Do not open the door.
         Whatever is in the corridor is not a patient. It is wearing a
         hospital gown and it does not have a face.
03:11 — It is hitting the door. It knows my name.`,
    '— NURSE I. HALVORSEN'
  ),
  doc_surgery_log: D(
    'OPERATION THEATRE 1 — PROCEDURE LOG',
    'SURGICAL DEPARTMENT · FLOOR 2',
    '09.06.1993',
    `PROCEDURE: Exploratory — "Recalibration" (see B2 protocol)
SURGEON: E. Voss
ASSISTING: Dr. M. Aldous, Nurse J. Reyes
ANAESTHESIA: None

NOTES: Subject 13-07 was conscious throughout. Vital signs remained
stable at a level inconsistent with life. Core temperature 21°C.

At 02:10 the subject's heart stopped. At 02:14 it started again without
intervention. The monitor recorded an electrical pattern we cannot
reproduce on any other patient. I have kept the strip.

I am no longer certain the procedure is treatment.`,
    '— DR. E. VOSS'
  ),
  doc_patientzero: D(
    'RESTRICTED PATIENT CHART — SUBJECT 13-00',
    'INTENSIVE CARE · RESTRICTED WARD',
    '17.02.1995',
    `Subject does not eat. Does not sleep. Does not age beyond the day he
arrived in 1989.

He has been moved three times because staff refuse to work near him.
He does not speak any more, except at 02:47, when he asks for the ward
to be opened.

Last night he was found standing in the isolation corridor, forty metres
from a room that was locked from the outside. The lock was still engaged.
The window was still sealed. There was frost on the inside of the glass.

Recommendation: do not move him again. Do not answer him.`,
    '— DR. M. ALDOUS'
  ),
  doc_psych_notes: D(
    'PSYCHIATRIC DEPARTMENT — PATIENT DRAWING',
    'FLOOR 4 · OCCUPATIONAL THERAPY',
    'UNKNOWN DATE',
    `[A childlike drawing is clipped to the page: a long corridor drawn in
thick black crayon. At the end of it, a tall shape with no features. Every
door along the corridor is drawn open. Underneath, in careful capitals:]

  THE DOCTOR KEEPS THE DOOR OPEN
  AT 2:47 HE COMES UP THE STAIRS
  DO NOT LOOK AT HIS FACE
  HE WILL ASK YOU TO COUNT THE BEDS

[On the reverse, in an adult hand:]

Patient 13-04 drew this in 1990. She was seven. She had never been below
the ground floor. She described the B2 corridor accurately: the pipes on
the left, the yellow stripe, the door with no handle.

I am transferring her file. I am sorry.`,
    '— DR. R. OKONKWO, PSYCHIATRY'
  ),
  doc_psych_records: D(
    'PERSONNEL FILE — DR. ELIAS VOSS',
    'HUMAN RESOURCES · FLOOR 5',
    '19.01.1994',
    `POSITION: Consultant, Somatic Research
EMPLOYED: 1981 — present
DISCIPLINARY: Three complaints (1988, 1990, 1993) — all withdrawn.
NOTE (HR): Dr. Voss has not used his office on Floor 5 since 1991. Security
have logged him entering B2 at 02:40 on fifteen separate occasions.
NOTE (Security, 1994): Dr. Voss requested that his name be removed from the
staff directory. Request granted.

APPENDED NOTE (Director): Dr. Voss no longer works here. Dr. Voss has not
worked here for some time. I would prefer that we stop writing his name
in the building.`,
    '— H. MERCER'
  ),
  doc_director: D(
    'LETTER — UNSENT',
    'DIRECTOR\u2019S OFFICE · FLOOR 5',
    '30.10.1996',
    `To the Board,

I am closing St. Augustine's on Friday. I will not give a reason that the
papers will print, and I will not sign a document that admits what we did
in the basement. I am writing this because I need one honest page in this
building.

We did not lose 43 patients. We kept them. Dr. Voss wanted to hold a human
being at the exact boundary between life and death, because he believed
that is where the soul could be measured. He was wrong about the soul.
He was right about the boundary. Something stayed there.

I have been down to Ward 13 twice. Both times I counted 44.

The building is sealed. Nobody will come here again. If someone does, and
if they read this: the lift to sub-level 13 is behind the B2 archive. The
ward is not empty. Do not count the beds.

Forgive us.`,
    '— H. MERCER'
  ),
  doc_research: D(
    'RESEARCH SUMMARY — SOMATIC RECALIBRATION',
    'MEDICAL RESEARCH · FLOOR 5',
    '04.03.1992',
    `Hypothesis: a patient held at the threshold of death for extended
periods exhibits measurable changes in electrical activity that are not
explainable by known physiology.

Method: hypothermic suspension (21°C), no anaesthesia, continuous
monitoring. 43 subjects, all "untreatable" children from the long-stay
wards.

Results: 41 of 43 showed no change. Subject 13-00 showed sustained
activity after cardiac arrest: 14 minutes, 22 minutes, 38 minutes.

Discussion: we may be observing the moment the body gives up its claim on
the person. If that moment can be held, it can be studied.

Ethics: approved by internal committee (2 votes to 1).`,
    '— DR. E. VOSS'
  ),
  doc_experiment: D(
    'EXPERIMENT LOG — CHAMBER 13',
    'B2 RESEARCH FACILITY',
    '02.12.1994',
    `02:40 — Chamber opened. Subject present. Subject has been present in
this room since 1989 and has never used the door.
02:41 — Temperature drop, 8°C in ninety seconds. Cameras fog.
02:43 — Subject speaks. No microphone picks it up; both technicians hear
it in their skulls.
02:44 — "Open the ward."
02:45 — We are leaving. Sealing B2 behind us.
02:47 — The lift is not answering.`,
    '— TECHNICIAN 4 (RECORDING ENDS)'
  ),
  doc_observation: D(
    'OBSERVATION CHAMBER — SUBJECT BEHAVIOUR',
    'B2 · RESTRICTED RESEARCH',
    '11.09.1993',
    `Subject 13-00 is the only subject retained below B1.

He does not move when observed. He moves when the observation window is
dark. We installed a second camera with the lens pointed at the door so we
could confirm this. In 217 hours of footage he has left the chamber 43
times. Each time he returns inside the hour.

Each time he returns, he is wet. There is no water on B2.

We asked him where he goes. He said: "Up. To check the beds."`,
    '— DR. M. ALDOUS'
  ),
  doc_control: D(
    'RESEARCH CONTROL — SHIFT HANDOVER',
    'B2 · CONTROL ROOM',
    '31.10.1994',
    `DO NOT descend to the ward after 02:00.

If the lift arrives without being called: do not get in. It will take you
down and the doors will not open at your floor.

If you hear someone counting in the corridor, count with them. Do not let
them reach forty-four. Start again at one, out loud, even if you are
alone. It loses interest when the number resets.

— This is not a joke. It is in the incident log eleven times.`,
    'CONTROL SUPERVISOR'
  ),
  doc_ward13_file: D(
    'PROJECT FILE — WARD THIRTEEN',
    'B2 ARCHIVE · CLEARANCE 4',
    'SEALED 1996',
    `WARD 13 does not appear on any public directory, fire plan or lift
plate. It was built in 1986 beneath B2 and decommissioned in 1994.

Access: restricted lift (B2 → W13) and the east stairwell landing, both
sealed by director's order.

Contents: 43 long-stay beds, one observation room, one treatment chamber,
one records room, one containment room. See attached plan.

All 43 patients remain listed as MISSING, not deceased. This was a legal
decision, not a medical one.

The WARD THIRTEEN access card is held by the archive supervisor.`,
    '— H. MERCER'
  ),
  doc_truth: D(
    'THE LAST ENTRY',
    'WARD THIRTEEN · UNKNOWN CHAMBER',
    '02:47',
    `I am the one who stayed.

They put a boy in a room and cooled him until he stopped, and then they
wrote down how long it took him to come back. They did it forty-three
times. On the forty-third time the body came back but I did not.

I have been here since 1989. I have walked the corridors of this hospital
every night at 2:47. I have counted the beds. I have counted the beds
every night because when the count is wrong it means someone is still
alive down here, and I do not want anyone to be alive down here.

You are alive. That is why I came up the stairs.

Do not be afraid of me. Be afraid of the room behind me. It is still
running. The machine is still running. It has been running since 1989 and
it is the reason I cannot stop.

Turn it off. Then I can count the beds one last time and be finished.`,
    '— A. KELL, 13-00'
  ),

  // shorter environmental notes
  note_cabin: D('SECURITY CABIN — SHIFT NOTES', 'CONTRACT SECURITY', '01.11.1996',
    `Gate key is in the drawer. Don't lose it, the estate agent only gave us one.

If the gate is chained, use the bolt cutters. If the chain is already cut,
do not go in. I mean it, Dave. Do not go in.`,
    '— R.'),
  note_watchlog: D('WATCH LOG — NIGHT SHIFT', 'SECURITY OFFICE · G-201', '31.10.1996',
    `02:00 — Gate secure. Perimeter secure.
02:12 — Camera 07 (1F corridor) showing movement. Checked the corridor myself.
         Nothing there. Feed keeps doing it.
02:30 — All monitors went to static for four seconds. All of them. At once.
02:41 — Someone is walking around upstairs. I am the only officer on shift.
02:47 — I am not going up there.`,
    '— OFFICER D. BRENNAN'),
  note_cctv: D('CCTV MONITOR NOTES', 'SECURITY / CCTV · G-202', '—',
    `SWITCH PANEL:
01 — Reception
02 — Emergency corridor
03 — Main reception hall
04 — Surgical wing
07 — First floor corridor (FAULTY)
09 — Psychiatric ward (FAULTY)
11 — Morgue
12 — Research lab

Camera 07 has been "faulty" since 1994. It is not the camera.`,
    ''),
  note_reception: D('RECEPTION DESK — LOST PROPERTY', 'MAIN RECEPTION', 'OCTOBER 1996',
    `One umbrella, black.
One child's shoe (left).
One set of keys, unclaimed since 1989. No name on the tag.
Two letters addressed to Dr. E. Voss, returned to sender.

Please do not leave food at the desk overnight. Something keeps taking it.`,
    ''),
  doc_directory: D('HOSPITAL DIRECTORY', 'MAIN RECEPTION', 'REVISED 1993',
    `GF   Reception · Emergency · Security · Pharmacy
1F   General wards · Records · Treatment
2F   Surgical department · Recovery
3F   Intensive care · Restricted ward
4F   Psychiatric department
5F   Administration · Research
B1   Morgue · Storage · Generator · Plant
B2   — NOT LISTED —

Visitors are reminded that the basement is a staff area.
Visitors are reminded not to use the east stairwell.`,
    'ST. AUGUSTINE HOSPITAL'),
  note_reception2: D('HANDWRITTEN NOTE', 'MAIN RECEPTION', '—',
    `If you are here about the missing patients: stop.

There is no one left to ask. The files on 1F list forty-three names and
every one of them is still open. Nobody died here. That is the problem.`,
    ''),
  note_emergency: D('TRIAGE BOARD', 'EMERGENCY DEPARTMENT', '31.10.1996',
    `02:09 — Male, 40s, lacerations to hands. Says he cut himself on a door.
02:19 — Female, 30s, shock. Found in the east stairwell. Refuses to speak.
02:31 — Both patients left without treatment.
02:44 — Ambulance crew called to collect a third casualty. Cannot locate
         the patient. The stretcher is in the bay with the straps done up.

— R. OKONKWO, NIGHT COORDINATOR`,
    ''),
  note_storage: D('STORES INVENTORY', 'MEDICAL STORAGE', '30.10.1996',
    `Diesel: 2 cans (1 empty, 1 half)
Batteries: box of 12, mostly gone
Dressings: adequate
Morphine: MISSING — all of it. Cabinet forced. Again.

Request resupply. This is the fourth time this month.`,
    '— J. REYES'),
  note_pharmacy: D('PHARMACY — DISPENSARY LOG', 'PHARMACY', '29.10.1996',
    `Prescriptions filled: 6
Prescriptions forged: 1 (Voss — still using his old number)
Stock discrepancy: 60mg morphine, 12 vials

I have told the director. He said to stop counting.`,
    ''),
  note_waiting: D('WAITING HALL', 'MAIN RECEPTION', '—',
    `[Someone has scratched into the plastic of seat 14, over and over, in
tiny letters:] count the beds count the beds count the beds count the beds
count the beds count the beds`,
    ''),
  note_billing: D('BILLING — OUTSTANDING ACCOUNTS', 'BILLING / ADMIN', '1996',
    `43 accounts remain open. 43. Every one is a long-stay patient from the
sub-level. None of their families have ever been billed. None of their
families have ever asked.

The board has asked me to write them off. I am not going to.`,
    '— FINANCE'),
  note_restroom: D('GRAFFITI', 'PUBLIC RESTROOMS', '—',
    `"THE DOCTOR IS STILL DOWN THERE"

Underneath, in different ink: "there is no doctor. there is only the thing
that learned his name."`,
    ''),
  note_patient12: D('PATIENT ROOM 12A — LETTER', 'FLOOR 1', 'UNSENT',
    `Mum,

They moved me to a different floor last week. The window looks at the car
park now, so I can see your car if you come. I keep looking.

The nurses are kind but they do not answer when I ask about the boy in the
corridor. He stands at the end by the stairs at night. He is not allowed
up here, I think. He looks at the beds. He counts them.

I am going to sleep now. Please come.`,
    '— L.'),
  note_ward_call: D('CALL BELL LOG', 'FLOOR 1 · NURSES STATION', '31.10.1996',
    `02:47 — Call bell, room 12B. Room is empty. Bell rang eleven times.
02:52 — Call bell, room 12A. Room is empty.
02:58 — Call bell, all rooms on corridor 1. Simultaneously.

Maintenance found nothing. I am not going back up there alone.`,
    ''),
  note_scratch: D('SCRATCHED INTO THE DOORFRAME', 'WARD 13 · 1F DOOR', '—',
    `I AM NOT DEAD I AM NOT DEAD I AM NOT DEAD I AM NOT DEAD I AM NOT DEAD
I AM NOT DEAD I AM NOT DEAD I AM NOT DEAD I AM NOT DEAD I AM NOT DEAD`,
    ''),
  note_pediatric: D("CHILDREN'S PLAYROOM", 'PEDIATRIC WARD', '—',
    `[A row of chairs is arranged in a circle around a single empty chair.
On the table, a drawing: 44 stick figures in a line. One of them is drawn
in pencil so hard the paper has torn.]`,
    ''),
  note_linen: D('LINEN CUPBOARD', 'CLEAN LINEN', '—',
    `Every folded gown in this cupboard is the same size. Child's size.

There is a laundry tag on one: 13-00.`,
    ''),
  note_nurses: D("NURSES' STATION — HANDOVER", 'FLOOR 1', '31.10.1996',
    `Do not do the 02:00 round alone.

If you hear the stairwell door open, do not go to look. It does not use
the door. It is already on the ward.

If you see a tall figure at the end of the corridor, walk the other way.
Do not look at it twice. It only moves when you have looked twice.`,
    ''),
  note_treatment: D('TREATMENT ROOM — STICKY NOTE', 'FLOOR 1', '—',
    `Bed 3 restraints have been cut again. Third time.

Whoever is doing this: I know it looks like a favour. It isn't. Whatever
gets out of that bed at night is not the patient.`,
    ''),
  note_visitors: D("VISITORS' LOUNGE", 'FLOOR 1', '—',
    `[A visitors' book, last entry dated 1996:]

"Visiting Adrien K. — no bed allocated. Told to wait. Waited 6 hours.
Nobody came."

Below, in the same hand, much later: "I came back. The ward is locked.
There is a boy at the window. He is not eleven any more. He is not
anything any more."`,
    ''),
  note_records: D('RECORDS ROOM — INSTRUCTION', 'MEDICAL RECORDS', '—',
    `Files beginning 13- are not to be removed from this room.

If a file is missing, do not search for it. Fill in a yellow slip and
leave it in the tray. Someone will come for the slip.

Nobody has ever come for the slips.`,
    ''),
  doc_icu_records: D('ICU — MONITORING SUMMARY', 'FLOOR 3', '11.09.1996',
    `At 02:47 on eleven separate nights this year, every cardiac monitor in
the ICU recorded a rhythm.

There is nobody in the ICU.`,
    ''),
  note_monitoring: D('CENTRAL MONITORING — ALARM LOG', 'FLOOR 3', '—',
    `ALARM: Bed 13 unoccupied.
SOURCE: Sub-level 13. No registered device.
CLEARED BY: —

The alarm recurs at the same time each night. We have stopped clearing it.`,
    ''),
  note_isolation: D('ISOLATION CORRIDOR', 'FLOOR 3', '—',
    `[The observation window is cracked in a spiderweb pattern. On the
corridor side, at the height of a child's hand, there is a smear of frost
that does not melt.]`,
    ''),
  note_restrictedWard: D('RESTRICTED WARD — BEDSIDE', 'FLOOR 3', '—',
    `The bed is made. The restraints are folded neatly on the pillow. There
is a glass of water on the side table and it is still cold.`,
    ''),
  note_therapy: D('GROUP THERAPY — TRANSCRIPT', 'FLOOR 4', '12.03.1994',
    `DR O: Can anyone tell me what they dream about?
PATIENT: The corridor.
DR O: Which corridor?
PATIENT: The one under us. It has a yellow stripe.
DR O: You've never been to the basement.
PATIENT: I know. That's what I dream about.`,
    ''),
  note_consult: D('PSYCHIATRIST\u2019S DESK — NOTE', 'FLOOR 4', '—',
    `Key to the secure wing is in the top drawer. Do not give it to agency
staff. Do not leave it in the ward.

If a patient tells you they have been to Ward Thirteen, do not correct
them. Note the time and the date. They are always right.`,
    ''),
  note_psych_rooms: D('PATIENT ROOM — WALL', 'FLOOR 4', '—',
    `[Painted over, but still visible in raking light, in metre-high letters:]
I CAN HEAR THE BEDS BEING COUNTED`,
    ''),
  doc_isolation: D('SECURE ISOLATION — OBSERVATION SHEET', 'FLOOR 4', '1995',
    `Patient 13-04 was returned to the secure wing after being found 6 floors
below her registered location. She was barefoot. She had no access card.

She drew the same corridor she had drawn six years earlier. This time she
added a second figure: a small boy, standing at the end, holding one shoe.

She said: "He's waiting for someone to count him."`,
    ''),
  note_activity: D('ACTIVITY ROOM', 'FLOOR 4', '—',
    `[Forty-four chairs arranged in a circle. Forty-three are upright. One
has been knocked over and left on its side, facing the door.]`,
    ''),
  note_admin: D('ADMINISTRATION — MEMO', 'FLOOR 5', '28.10.1996',
    `All staff are reminded that the B2 archive requires director-level
clearance.

All staff are reminded that there is no such thing as "Ward Thirteen".
Please do not use the phrase in written correspondence.`,
    '— H. MERCER'),
  note_director: D('DIRECTOR\u2019S DESK — PHOTOGRAPH', 'FLOOR 5', '—',
    `[A framed photograph, turned face down. On the back, in faded pencil:
"Staff, Ward 13, 1989. Do not display."]

The photograph shows fourteen people in white coats in a corridor with a
yellow stripe. There are fifteen people in the picture.`,
    ''),
  note_server: D('SERVER ROOM — PRINT OUT', 'FLOOR 5', '31.10.1996 · 02:47',
    `INTRUDER ALERT — SUB-LEVEL 13
SENSOR: 13-CORRIDOR-01
EVENT: 1 PERSON ENTERED
EVENT: 1 PERSON LEFT
EVENT: 1 PERSON REMAINS

No active staff are scheduled below B1.`,
    ''),
  note_it: D('IT DEPARTMENT — TICKET', 'FLOOR 5', '—',
    `TICKET #4471: Camera 07 returns a valid image but the timestamp is always
02:47. Rebooted. Replaced. New camera. Same timestamp.

Closed as "cannot reproduce".`,
    ''),
  doc_archive: D('ARCHIVE — INVENTORY', 'FLOOR 5', '—',
    `BOX 11: Ward 13 admission records (43 files). All present.
BOX 12: Somatic research files. 6 of 11 present. 5 destroyed by order.
BOX 13: Board correspondence 1994–1996. Sealed.
BOX 14: —
BOX 15: —

Boxes 14 and 15 are listed as "returned to origin". Nobody can tell me
what that means.`,
    ''),
  note_archive2: D('ARCHIVE — BROKEN SHELF', 'FLOOR 5', '—',
    `Something bent this shelf outward from behind. The wall behind it is
solid. The shelf is bolted to the wall.`,
    ''),
  doc_private: D('PRIVATE RESEARCH OFFICE — LOCKED DRAWER', 'FLOOR 5', '1994',
    `I have removed the 13-00 file from the ward records. It is the only one
that matters.

He is not a patient any more. He is a fixture. The building keeps him, the
way a lung keeps air.

If we are ever to close this hospital we must first switch off the
machine on B2 and then, and only then, open the ward and let him out.

I do not think he will be grateful.`,
    '— DR. E. VOSS'),
  note_specimen: D('SPECIMEN STORAGE', 'FLOOR 5', '—',
    `[Forty-three glass slides in a rack. Each is labelled 13-01 through
13-43. The last slot in the rack is empty and labelled 13-00.]`,
    ''),
  note_sealed: D('SEALED CORRIDOR', 'FLOOR 5', '—',
    `The door at the end of this corridor was welded shut in 1996 and then
painted over. There is a lift behind it.

You cannot see the lift from here. You can hear it.`,
    ''),
  note_b2gate: D('B2 SECURITY GATE — SIGN IN', 'RESTRICTED RESEARCH', '—',
    `Last entry: 31.10.1994. 14 staff descended. 13 staff ascended.

The remaining name is Dr. E. Voss. The column for "time out" is blank.`,
    ''),
  note_researchLab: D('EXPERIMENT LAB — WHITEBOARD', 'B2', '—',
    `43 subjects. 43 beds. 43 charts.

Do not write his name on the board. He reads the board.`,
    ''),
  note_observationB2: D('OBSERVATION CHAMBER — GLASS', 'B2', '—',
    `[The observation glass is intact. On the inside there are handprints.
They are small. They are all at the same height. They are all facing
outward.]`,
    ''),
  note_specimen2: D('SPECIMEN STORE', 'B2', '—',
    `[Rows of steel canisters. Each has a paper tag. The tags are blank. The
frost on the canisters has been disturbed by someone recently.]`,
    ''),
  doc_testing: D('TESTING ROOM — SUBJECT REPORT', 'B2', '1993',
    `Subject: 13-22
Procedure: 4th recalibration
Duration of arrest: 31 minutes
Return: spontaneous, 02:47

Subject reports: "I was in a corridor. Someone was counting."
Subject has not been informed of the duration of the arrest.`,
    ''),
  note_armory: D('SECURITY ARMORY', 'B2', '—',
    `[The gun rack is empty. The log shows four weapons drawn on 31.10.1994
and none returned. There are four sets of handcuffs on the floor and no
keys.]`,
    ''),
  note_containment: D('CONTAINMENT ROOM', 'B2', '—',
    `The door is three inches thick and opens inward.

It is open.`,
    ''),
  note_biometric: D('BIOMETRIC ACCESS', 'B2', '—',
    `AUTHORISED PERSONNEL: 14
REGISTERED: 14
PRESENT: 15`,
    ''),
  note_archiveB2: D('RESTRICTED ARCHIVE — B2', 'B2', '—',
    `The ward card is in the second drawer. It opens the lift, the ward and
the east landing.

Take it. Do not take anything else. Do not stay past 02:47.`,
    ''),
  note_morgue: D('MORGUE — INTAKE LOG', 'B1', '31.10.1996',
    `02:41 — One body, female, 30s. Found in the east stairwell. No ID.
02:47 — Drawer 4 opened. Body gone. Drawer closed from the inside.

I am not opening drawer 4 again.`,
    ''),
  doc_autopsy: D('AUTOPSY REPORT — UNIDENTIFIED', 'B1 MORGUE', '1994',
    `The incision is old and healed. The subject has been dead for six years
according to the tissue, and for six hours according to the temperature.

There is frost in the lungs. There is no water in the lungs. The frost
formed after death.

Cause of death: indeterminate.`,
    ''),
  note_generator: D('GENERATOR ROOM — PLATE', 'B1', '—',
    `DIESEL ONLY. DO NOT USE PETROL.

1. Fill tank.
2. Prime (red lever, left).
3. Hold starter for 3 seconds.
4. If it does not catch, wait. It is listening.`,
    '— FACILITIES'),
  note_morgueReception: D('MORGUE RECEPTION — CALL SHEET', 'B1', '—',
    `Three calls tonight from extension 13. There is no extension 13.`,
    ''),
  note_supply: D('SUPPLY STORE — REQUEST', 'B1', '—',
    `Two diesel cans for the generator. One is missing from this shelf.

The strap is cut. Not unfastened. Cut.`,
    ''),
  note_workshop: D('MAINTENANCE WORKSHOP', 'B1', '—',
    `The lift to sub-level 13 was disconnected in 1994. I checked the motor
last week. It was warm.

I did not reconnect it. I am not going to.`,
    ''),
  note_pumps: D('PUMP ROOM', 'B1', '—',
    `The pumps are running. There has been no water in this building since
1996. I have checked the pipes. They are dry.`,
    ''),
  note_laundry: D('OLD LAUNDRY', 'B1', '—',
    `[A row of industrial dryers. Every one of them is full of folded
children's hospital gowns. They are warm.]`,
    ''),
  note_wasteB1: D('WASTE DISPOSAL', 'B1', '—',
    `[A sealed plastic bin, labelled "SPECIMENS — DO NOT OPEN". The seal is
broken. Inside: forty-three patient wristbands, all cut in the same way.]`,
    ''),
  note_cold: D('COLD STORAGE', 'B1', '—',
    `[The refrigeration unit has been switched off for years. The room is
still colder than the corridor. There is frost on the inside of the door.]`,
    ''),
  note_autopsy: D('AUTOPSY ROOM — TOOLS', 'B1', '—',
    `[The instruments have been laid out in a neat row. They are clean. They
are the only clean things in this building.]`,
    ''),
  note_w13entry: D('WARD 13 — SEALED ENTRANCE', 'SUB-LEVEL 13', '—',
    `You are inside the ward.

Do not run. It hears running.`,
    ''),
  doc_w13_patient1: D('PATIENT ROOM 01 — CHART', 'WARD 13', '1989–1994',
    `BED 1 — 13-00 (Kell, A.)
BED 2 — 13-01 (—)
BED 3 — 13-02 (—)
BED 4 — 13-03 (—)

All charts end on the same date. All charts end with the same word:
"WAITING".`,
    ''),
  doc_w13_patient2: D('PATIENT ROOM 02 — DRAWING', 'WARD 13', '1990',
    `[A child's drawing: a bed, a boy in the bed, and a tall figure at the
foot of it drawn in black. Underneath, in the careful capitals of a
seven-year-old:]

HE IS NOT A MONSTER. HE IS THE ONE WHO COUNTED US.`,
    ''),
  doc_w13_exam: D('EXAMINATION ROOM — PROCEDURE CARD', 'WARD 13', '—',
    `RECALIBRATION — WARD PROTOCOL
1. Cool to 21°C
2. Withdraw sedation
3. Record until the heart stops
4. Record until the heart starts
5. Do not speak to the patient while the heart is stopped
6. If the patient speaks first, end the session

Note: rule 6 was added after 13-00.`,
    ''),
  note_w13_exam: D('TREATMENT CHAMBER — CHAIR', 'WARD 13', '—',
    `[A steel chair bolted to the floor. The restraints are still fastened.
They have been cut from the inside.]`,
    ''),
  note_w13_containment: D('CONTAINMENT — DOOR', 'WARD 13', '—',
    `The door has been forced from this side. There is nothing inside except
a bed and forty-three tally marks on the wall.`,
    ''),
  note_w13_checkpoint: D('SECURITY CHECKPOINT', 'WARD 13', '—',
    `[A sign-in book. The last page has one line:]

02:47 — A. KELL — RETURNED`,
    ''),
  note_w13_corridor: D('MAIN WARD CORRIDOR', 'WARD 13', '—',
    `[Forty-three doors. Forty-three beds. Count them if you like.

You will get forty-four.]`,
    ''),
  doc_w13_records: D('WARD 13 — PATIENT RECORDS', 'WARD 13', '—',
    `Forty-three files. Each has a photograph of a child. Each child is
smiling. Each file is stamped: OPEN.

At the back of the drawer there is a forty-fourth file with no photograph
and no name. Inside, one line: "Subject requested to be counted."`,
    ''),
  note_w13_records: D('RECORDS ROOM — DESK', 'WARD 13', '—',
    `[A typewriter with a half-finished page. The last words on the page are
"and then he asked us to—"]`,
    ''),
  note_w13_unknown: D('UNKNOWN CHAMBER — MACHINE', 'WARD 13', '—',
    `[The machine is still running. There is a counter on the front panel.
It reads 44.

There is a switch beside it, labelled in tape: OFF.]`,
    ''),
  note_w13_escape: D('EMERGENCY ESCAPE', 'WARD 13', '—',
    `[The escape passage is open. Daylight is not, but the stairs are, and
above them the roof, and above that the sky.]`,
    ''),
  note_w13_p1: D('PATIENT ROOM 01', 'WARD 13', '—', `[A bed with the sheets still holding the shape of a small body.]`, ''),
  note_w13_p2: D('PATIENT ROOM 02', 'WARD 13', '—', `[A row of shoes beneath the beds. All the same size.]`, ''),
  paper_scrap: D('TORN PAPER', '—', '—', `[…the count is wrong again. I have started at one, as instructed, but the number keeps arriving at forty-four regardless of where I begin.]`, ''),
  note_emergency2: D('EMERGENCY — TREATMENT CARD', 'EMERGENCY DEPT.', '—', `[A laminated card: "In the event of a patient arriving from sub-level 13, do not admit. Call the director. Do not count the patient."]`, ''),
  note_treatment2: D('TREATMENT ROOM — CHART', 'FLOOR 1', '—', `[Every entry ends with the same note: "Patient stable. Patient does not require sleep."]`, ''),
  note_preop: D('PRE-OPERATION — CHECKLIST', 'FLOOR 2', '—', `[A checklist with every item ticked. At the bottom, handwritten: "Subject 13-00 does not require anaesthetic. Subject is awake. Subject is aware."]`, ''),
  note_ot: D('THEATRE 1 — MIRROR', 'FLOOR 2', '—', `[A steel instrument tray, polished to a mirror. In the reflection of the room behind you there are two people standing at the table. You are alone.]`, ''),
  note_ot2: D('THEATRE 2 — TABLE', 'FLOOR 2', '—', `[The operating table is set out for a procedure. The instruments are warm.]`, ''),
  note_sterile: D('STERILIZATION', 'FLOOR 2', '—', `[The autoclave log shows a cycle run at 02:47 every night since 1996. There is no power to the machine.]`, ''),
  note_anesthesia: D('ANESTHESIA STORE', 'FLOOR 2', '—', `[A locked cabinet with the glass broken outward. All the anaesthetic is untouched.]`, ''),
  note_surgical: D('SURGICAL RECEPTION', 'FLOOR 2', '—', `[A rota for November 1996. Every night shift is allocated to a doctor who left in 1994.]`, ''),
  note_recovery: D('RECOVERY ROOM', 'FLOOR 2', '—', `[Six beds. Six heart monitors. All six monitors show a rhythm.]`, ''),
  note_postop: D('POST-OP WARD', 'FLOOR 2', '—', `[A patient gown folded on a bed. Still warm.]`, ''),
  note_equipment: D('EQUIPMENT STORE', 'FLOOR 2', '—', `[43 wheelchairs, folded and stacked. All child-sized.]`, ''),
  note_waste: D('MEDICAL WASTE', 'FLOOR 2', '—', `[Yellow bags, all empty. The labels say "WARD 13 — SPECIMEN".]`, ''),
  note_icu: D('ICU 1 — MONITOR', 'FLOOR 3', '—', `[A monitor showing a heartbeat. The lead is not connected to anything.]`, ''),
  note_icu2: D('ICU 2 — BED', 'FLOOR 3', '—', `[The bed is made. There is a dent in the pillow, the size of a child's head.]`, ''),
  note_oxygen: D('OXYGEN SUPPLY', 'FLOOR 3', '—', `[Every cylinder is full. The gauges are all pointing at 02:47.]`, ''),
  note_icuReception: D('ICU RECEPTION', 'FLOOR 3', '—', `[The visitor log is blank for every day since 1996 except one. 02:47. "A. Kell — visiting."]`, ''),
  note_observation: D('OBSERVATION ROOM', 'FLOOR 3', '—', `[A chair facing the observation window. It has been sat in so long the foam has compressed into a shape.]`, ''),
  note_psychReception: D('PSYCHIATRIC RECEPTION', 'FLOOR 4', '—', `[An appointment book. Every appointment is at 02:47. The patient name is always the same: KELL, A.]`, ''),
  note_observation2: D('PATIENT OBSERVATION', 'FLOOR 4', '—', `[A one-way mirror. On the other side, a small chair facing the glass.]`, ''),
  note_secureIso: D('SECURE ISOLATION', 'FLOOR 4', '—', `[The padding has been torn away from one wall. Underneath, a child has written a single word four hundred times: STILL.]`, ''),
  note_psychRecords: D('PATIENT RECORDS — FLOOR 4', 'FLOOR 4', '—', `[A drawer of patient drawings. Each one shows the same corridor. Each one has a small figure at the end. In fourteen of them the figure is holding a key.]`, ''),
  note_electro: D('TREATMENT ROOM — MACHINE', 'FLOOR 4', '—', `[An ECT machine, unplugged. The dial is set to 43.]`, ''),
  note_meeting: D('STAFF MEETING ROOM', 'FLOOR 5', '—', `[A whiteboard with the agenda: 1. Ward 13 closure 2. Records transfer 3. What to tell the families. Item 3 is circled, then crossed out.]`, ''),
  note_it: D('IT DEPARTMENT', 'FLOOR 5', '—', `[A server rack. One drive is still spinning. The label: "CCTV 07 — DO NOT ERASE".]`, ''),
  note_research2: D('RESEARCH OFFICE — MEMO', 'FLOOR 5', '—', `[A memo from Dr. Voss: "We are close. The subject is stable at the threshold. Two more sessions and we will be able to measure what remains."]`, ''),
  note_private: D('PRIVATE OFFICE — DESK', 'FLOOR 5', '—', `[A single photograph of a boy, aged about eleven, in a hospital gown. On the back: "Adrien. 1989. Do not forget why we are doing this."]`, ''),
  note_researchLab2: D('EXPERIMENT LAB — FLOOR PLAN', 'B2', '—', `[A floor plan of B2. Below it, a second plan, unlabelled, showing a ward of 43 beds reached by a single lift.]`, ''),
  note_b2gate2: D('SECURITY GATE — INTERCOM', 'B2', '—', `[An intercom handset. The line is open. Someone is breathing on the other end.]`, ''),
  note_control2: D('CONTROL ROOM — SCREEN', 'B2', '—', `[A terminal showing a live feed of the corridor outside. The corridor is empty. The door behind you is open.]`, ''),
  note_experiment2: D('CHAMBER 13 — DOOR', 'B2', '—', `[A sealed chamber. The seal has been broken from the inside.]`, ''),
  note_registration: D('PATIENT REGISTRATION', 'GROUND FLOOR', '—', `[A ledger open at a page dated 03.11.1989. Every line has the same admission time: 02:47. The ward column reads 13 in red pencil, forty-three times.]`, ''),
  note_icu_records: D('RESTRICTED RECORDS — FLOOR 3', 'INTENSIVE CARE', '—', `[A ring binder of charts. Patient name blacked out with marker. The vital signs never change across four hundred pages: 36.1, 61, 118/74. Someone has written in the margin: "still here".]`, ''),
  note_research: D('RESEARCH OFFICE', 'FLOOR 5', '—', `[A grant application, refused. The reviewer's comment: "The methodology is sound, but the ethics committee cannot approve a study that requires the subject to die." Someone has underlined the word die eleven times.]`, ''),
  note_control: D('RESEARCH CONTROL — B2', 'BASEMENT 2', '—', `[A console of switches, all labelled with handwritten tape: LIGHTS, LIFT, DOORS, SUBJECT. The SUBJECT switch is in the on position. The tape over it is new.]`, ''),
  note_truth2: D('UNKNOWN CHAMBER — PLAQUE', 'WARD 13', '—', `WARD THIRTEEN
SOMATIC RECALIBRATION UNIT
43 SUBJECTS · 1986–1994
"WE ARE MEASURING THE MOMENT"`, ''),
};

export function getDocument(id) {
  return DOCUMENTS[id] || D('ILLEGIBLE PAGE', 'ST. AUGUSTINE HOSPITAL', '—',
    `The ink has run. Only a few words survive: "…count the beds… do not answer… 02:47…"`, '');
}

export function itemFor(id) {
  if (ITEMS[id]) return ITEMS[id];
  if (DOCUMENTS[id]) {
    return {
      name: DOCUMENTS[id].title.split('—').pop().trim().slice(0, 42),
      kind: 'documents',
      desc: 'A document recovered from the hospital.',
      pickup: 'patientFile',
      document: id,
    };
  }
  return { name: id, kind: 'misc', desc: '', pickup: 'battery' };
}

export const PICKUP_NAME = (id) => itemFor(id).name;
