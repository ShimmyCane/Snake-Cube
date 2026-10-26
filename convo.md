# Snake Cubes — design conversation

Running log of feature requests and open questions. Nothing here is implemented yet.
Status key: **open** = waiting on answers · **agreed** = decided, ready to build · **done**

---

## 1. Difficulty: growth pacing

**Request:** Once the player's snake is 8× or more larger than the board, the game gets boring. Give other snakes (and snacks) faster growth so the player keeps getting fed, which makes reaching a higher score more fun. Options mentioned: raise snack weight, or lower spawn rate and raise spawn difficulty.

**Status:** built (round 2) — see decisions below

**Questions**
- "8× larger than the board" — do you mean the snake's *length* compared to the board size, or its *head value* (e.g. 2048-style value) compared to the largest value on the board? These need different triggers.
- Which lever do you prefer: (a) snacks worth more (bigger `val` per snack), (b) more snacks spawn, or (c) fewer but higher-value snacks spawn? Or a mix?
- Should this apply only to the player's surroundings, or to bots too? Feeding bots faster would let them catch up to the player, which could make the late game harder as well as more fun.
- Should it kick in gradually (e.g. ramps up after the 8× point) or switch on at a fixed threshold?

---

## 2. Dad's mode: buildings appear left/right flipped

**Request:** The mapped buildings look mirrored. Flip them so they sit in the right places on the satellite image.

**Status:** built (round 2) — see decisions below

**Notes**
- I haven't confirmed the cause yet. The mirror could come from the map-builder export, the image-to-grid coordinate mapping in `dad.js`, or the WebGL ground texture. I'd want to compare a placed building in `map-builder.html` against the same spot in-game before changing anything.

**Questions**
- Is it only the *buildings* that look wrong, or do roads and trees also look mirrored? Are the snake's movements (left/right steering) correct relative to the ground?
- Is the satellite image itself correct (e.g. street names readable, not reversed)?

---

## 3. Start screen: simplify

**Request:** The start page is too busy. Reduce it to four choices:
- **Felix** (the main game)
- **Athena**
- **Dad**
- **Others** (multiplayer and rooms; currently not working and unlikely to work on GitHub Pages)

The difficulty toggle and controls go below those. Athena and Dad are different *environments/maps* that slightly alter gameplay, rather than separate games.

**Status:** built (round 2) — see decisions below

**Questions**
- Difficulty: should it be a single toggle that applies to whichever mode you pick, or does each mode remember its own setting?
- Should the "Others" button be hidden entirely while multiplayer is broken, or shown greyed out with "coming soon"?
- Do you want the current BEGINNER / EXPERT wording kept, or renamed (e.g. Easy / Hard)? Also, the "DAD'S MODE (HARD)" button currently exists separately — does it fold into the difficulty toggle?
- Do the Athena and Dad environments still need their own rules (Athena's shrinking boundary, Dad's buildings and roads), with Felix as the plain arena?

---

## 4. Round time by mode and difficulty

**Request:** Lower the default round time to **3 minutes**. For other modes and harder games, increase in **2-minute** steps.

**Status:** built (round 2) — see decisions below

**Questions**
- Does "harder games get more time" mean the *harder* difficulty gets longer rounds (3 → 5 → 7), or do you mean the other modes (Athena, Dad) get more time because they're harder to play? Please confirm which way it should go.
- Is it 3 / 5 / 7 minutes for three levels, or do you want a different ladder?
- Does the round time apply to the Athena mode too, which currently runs on its own levels?

---

## 5. Dad's mode: no starting skills, GTA-style missions

**Request:**
- Start Dad's mode with **no skills**.
- Add GTA-style missions: drive/walk to a location within a reasonable time limit.
- Completing a mission rewards one skill.
- A guide arrow points toward the target, and the route works a little like a maze.

**Status:** built (round 2) — see decisions below

**Questions**
- Which skills exist today in Dad's mode? I believe the hook, tail bullet and vacuum are the candidates, plus the burst (SPACE). Which of these should be earnable, and which (if any) should always be available?
- How many missions are needed for a first version, and should they repeat or run in a fixed order?
- What does "a reasonable allotted time" look like — a fixed number of seconds per mission, or scaled by distance?
- What happens on failure: retry the same mission, or lose progress?
- For the "maze" feel: should the guide arrow only point in a straight line toward the target (and the maze comes from the buildings and roads), or should it follow the road network to a route?
- Are missions for single-player only, or should they also work in multiplayer later?

---

## Cross-cutting questions

- Should we tackle these in order (1 → 5) or start with the quick ones (2 and 4)?
- Should each item get its own PR, or one branch for the whole batch?

---

## Round 2 — your answers and what was built

Answers you gave: head size = typical; the map flip is the texture only (3D objects are right), with a test script for a left-handed map; difficulty is per mode, using the current settings; round-time ladder confirmed; all five skills earned once, a pause of about a minute between missions, no penalty on failure, and the arrow follows the target.

### 1. Growth when dominant — built
- **Typical head** = median head value of the live bots (`typicalBotVal()` in `game-core.js`).
- **Dominant** = your head ≥ `CFG.DOMINANCE_RATIO` (8) × typical. Checked in `playerDominant()`.
- While dominant, each snack drop is `CFG.DOMINANCE_FOOD_MULT` (2) times bigger, and snack values reach up to `worldMax / 4` instead of `/ 16`.
- Tune both in `config.js`.

### 2. Flipped map — built, please check on your phone
- The cause was the U coordinate in `_dadBuildMesh()` (`dad.js`). It flipped the satellite texture against the buildings, which are correct.
- The flip is gone. Buildings should now sit on the matching part of the image.
- Test script for the left-handed version: a **MirrorMap** toggle in the dev panel (⚙), or add `?mirror=1` to the URL. It is off by default.

### 3. Start page — built
- Four tiles: **FELIX · ATHENA · DAD · OTHERS**. Each tile shows its own options below, then **Controls**, then **START**.
  - FELIX: EASY / HARD / INSANE
  - ATHENA: EASY / HARD
  - DAD: map, then NORMAL / HARD
- OTHERS holds create/join room and the name field. It also has a BACK button.
- The old BEGINNER/EXPERT panel was already hidden. Its Dad HARD buttons were unreachable, so they are gone. HARD now lives in the Dad options.
- Button labels changed: the old "GUEST" label (easy Felix) is now EASY.

### 4. Round time — built
- Felix: EASY 3 min · HARD 5 min · INSANE 7 min (was unlimited).
- Athena: EASY 5 min · HARD 7 min.
- Dad's mode: NORMAL 5 min · HARD 7 min.
- Multiplayer: co-op 5 min · versus 5 min (versus was 8 min).
- The dev-panel Round Time slider still overrides the value until you pick another mode.

### 5. Dad's missions — built
- **Skills** start locked and unlock in this order: HOOK → TAIL BULLET → BURST → VACUUM. Each one stays unlocked for the rest of the session.
- **Mission:** a random target between 40 and 300 steps away by walking route (a BFS over the collision grid). The HUD shows the target name and countdown.
- **Time limit** = route steps ÷ `CELLS_PER_TICK` × tick time × 1.5, plus 15 s. Tune in `CFG_DAD_MISSION`.
- **Arrival:** within 2.5 cells of the target unlocks the next skill and starts a 60 s pause.
- **Timeout:** the mission ends silently, then the same 60 s pause.
- **Arrow:** points from your head toward the target. It still works when the target is behind the camera.
- After all four skills are earned, missions stop and the HUD reads "ALL SKILLS UNLOCKED".

### Open points to confirm
- Bots share the hook switch (`HOOK_ENABLED`), so once you earn HOOK, bots in Dad's mode can hook too. Should bots keep their weapons regardless?
- Missions stop once all four skills are earned. Is that right, or should missions keep going with no reward?
- Versus is now 5 min. Keep 5 or go back to 8?
- The mission time assumes about 1 cell per tick. If missions feel too tight or too loose, change `CELLS_PER_TICK`.

---

## Round 3 — your answers (v4.0.0)

1. **Bots keep their own weapons.** Done: the player's hook follows the HOOK skill (`playerHookOn()`). `HOOK_ENABLED` now only controls bots.
2. **Missions carry on after all skills, rewarding bonus tiles.** Done: each mission drops a random bonus tile (x2, speed, radar, invincible, vacuum, clock) on its target.
3. **Round times 5 / 7 / 9 min, plus a time-extension tile.** Done: Felix 5/7/9. Other modes add 2 min. The new ⏱ clock tile adds 30 s.
4. **Trees don't block snakes.** Done: the collision item is dropped.
5. **`BOT_START_VAL`.** Checked: nothing references it. Dropped.
6. **Remove `athena_piano_3`, add a music tracker.** Done: entry removed. `MUSIC.md` lists the tracks in use.
7. **v4 with a changelog.** Done: `CHANGELOG.md` covers v4.0.0 and reconstructs history from the lessons-learned, process, schematic, and code notes. The repo's git history starts at a single commit, so older entries are reconstructed.

---

## Snake II — Roman numeral snake (plan, 2026-10-26)

The first draft was `snake2/schematic.html`. It has been replaced by `snake2/schematic_snake2.md` (see below).

**What you asked for:** a separate sub-game in its own subfolder, sharing assets where it can. It's a classic 2-D grid snake: tight field, solid walls, four directions, everyone at the same speed, cartoon look, one mode (medium, about 3 minutes), probably no skills.

**Core idea:** the snake *is* a number. Its body spells the value in Roman numerals, one symbol per cell. Eating I snacks counts up, and when the body spells something Romans wouldn't write, it collapses: IIII becomes IV and the tail gets shorter. So length is a puzzle. For example, VIII is 4 long but X is 1 long.

**Sharing:** the music player and tracks are shared. The load-error panel and masonry buttons are copied and trimmed. The 3-D engine is not reused; it's built for free 360° movement and powers of 2.

**Open questions** (defaults in brackets):
1. Field size [18 × 24]
2. Crashes: 3 lives or one-crash game over [3 lives]
3. Rivals: 3 bots or solo [3 bots]
4. MMXXVI: rare instant win, or the goal of a later endless mode [rare win]. Snacks alone reach about CCLXX (270) in 3 minutes.
5. Snacks: I/V/X mix or only I [mix]
6. Show the ordinary number under the Roman one [yes, with a toggle]
7. Round length: 3 or 2 minutes [3]

### Your answers (2026-10-26)

1. **Field:** 50 × 50. The camera follows you and a minimap shows the whole board, since 50 cells won't fit a phone at a readable size.
2. **Crashes:** one crash is game over.
3. **Bots:** 3 bots, which you can't eat. Touching any snake is a crash. Crashed bots turn into I snacks and respawn.
4. **Goal:** **MMXXI** (2021), Felix's birth year.
5. **Snacks:** Classic I·V·X by default. A snack-set setting (Extended, Imperial) speeds things up. Simulated pace: Classic reaches about CCXII in 3:00, and Endless takes about 28 min with Classic or about 7½ min with Extended.
6. **Ordinary numbers:** hidden by default, with a toggle in settings.
7. **Modes:** Timed (3:00) plus Endless (until MMXXI).

The full plan is in `snake2/schematic_snake2.md`. It still has four small open questions (section 22), each with a default.

### Snake II — built (M0–M5)

- Code is in `snake2/`, with `snake2/README.md` on how to run and test it.
- 36 node tests pass. Headless Chromium runs of the menu, a round, pause (button and P key), settings, a collapse and a wall crash show no console errors.
- The main game's OTHERS screen has a "Snake II" link.
- Two corrections to the schematic: a III → IV collapse drops one cell (III is 3 long, IV is 2), not two. The pop label is `III + I → IV`, which shows the sum and the rewrite.
- Still untested: on a real phone, the feel of swipes and the d-pad, and the bot wreck balance over full rounds.
