# Changelog

Felix's Snake Cubes. Entries are grouped by version, newest first.

The git history here starts at a single "initialize" commit, so entries before v4.0.0 are reconstructed from in-repo notes: `lessons-learned.html`, `process.html`, `schematic.html`, `todo-archive.html`, code header comments, and `convo.md`. Dates appear only where the source gives one. Items with no version were recorded in the old TO DO list without one.

---

## Unreleased — Snake II, after the first phone test

- **Bigger and the same everywhere:** cells are 35 px on every device (about 35% bigger on an iPhone). Bigger screens show more map, and the minimap scales up. The page re-checks the screen size every frame, and uses safe-area insets for the notch.
- **Coins coloured by symbol.** A "Rival snakes" setting from 1 to 10 (default 3).
- **Controls:** a W / A / S / D pad in the lower left, the minimap in the lower right.
- **Crashes:** any crash makes the snake break apart in a small explosion, with its symbols thrown as coins of the same value within 3 cells. Your own crash fades into the game-over screen.
- **Roman only:** the clock (III:N, II:LIX, with N for zero), scores and best lists. The HUD can still show Arabic numbers from a setting.
- **Homepage:** a "← Snake I" button back to the first game.
- Fixed `clampBots(0)` returning the default instead of 1. 47 node tests.

---

## Unreleased — Snake II (new sub-game)

A separate Roman-numeral grid snake in `snake2/`, linked from Felix's OTHERS screen. It shares only the music player and tracks with the main game.

- The body spells the snake's value in Roman numerals. Eating coins counts up, and an invalid numeral collapses (`III + I → IV`).
- Timed (3:00) and Endless modes, goal MMXXI (2021), one crash ends the round.
- Three bots you can't eat. A crashed bot's body becomes I coins.
- Snack sets Classic / Extended / Imperial, a show-numbers toggle, and saved best scores.
- IV, IX, XL, XC, CD and CM are one symbol and one cell, so 4 is just a head with no tail. The head carries the first symbol of the numeral.
- The tick is 243 ms, 30% slower than the first build.
- 37 node tests for the numeral maths, snake growth and collapse, collisions, bots, and random play.

---

## v4.1.0 — 2026-10-26

### Action buttons
- Hook, tail bullet, tail bomb and burst buttons now show in Felix steering mode too. They were only shown with the joystick pad.
- The tail bullet button now appears in every mode. It was hidden everywhere except Dad's mode, because its visibility depended on a flag that only Dad's mode set.
- In Dad's mode, locked skill buttons stay visible but dimmed until a mission unlocks them.
- Fixed the tail cooldown ring on the buttons, which read a property name that no code set.

### Tail bomb (new)
- Drop your last segment as a mine: **B** key or 💣 button, 8 s cooldown.
- A rival head within 3 cells starts a 1 s blinking fuse, then the bomb blasts.
- The blast shreds rival body inside a 3.5-cell radius. The chain is cut at the first segment caught, and the rest becomes food. Heads are immune, so a rival can still burst or run clear with its head.
- The owner's own body is immune to the owner's bombs.
- Dad's mode: TAIL BOMB is the third skill, after HOOK and TAIL BULLET.

---

## v4.0.0 — 2026-10-25

### Start menu
- New start page: **FELIX · ATHENA · DAD · OTHERS** tiles. Each mode shows its own options, then **Controls**, then **START**.
  - FELIX: EASY / HARD / INSANE
  - ATHENA: EASY / HARD
  - DAD: map, then NORMAL / HARD
- **OTHERS** holds the multiplayer room buttons and the name field, with a BACK button.
- Menu styled with the polygonal masonry look from ShimmyCane/Index (cream background, clip-path stones).
- Removed the Dad HARD buttons from the hidden BEGINNER/EXPERT panel. They could never be reached.
- The easy Felix button now reads EASY, not GUEST.

### Round times
- Default round is now 5 min. Harder modes and other modes add 2 min per step.
- Felix: EASY 5 · HARD 7 · INSANE 9 min. INSANE was previously unlimited.
- Athena: EASY 7 · HARD 9 min.
- Dad's mode: NORMAL 7 · HARD 9 min.
- Multiplayer: co-op and versus 7 min. Versus was 8 min.

### Growth
- When the player's head is at least 8× the median bot head (`DOMINANCE_RATIO`), snack batches double (`DOMINANCE_FOOD_MULT`) and snacks can reach up to a quarter of the player's head instead of a sixteenth.

### Bonus tiles
- New **⏱ clock** tile adds 30 s to the round (`CLOCK_BONUS_SEC`). It spawns every 40 s (`CLOCK_INTERVAL_MS`). Athena's broken-object rewards can also drop it.

### Dad's mode
- **Map mirror fixed.** A U flip in the satellite mesh mirrored the image against the buildings. The flip is removed. A **MirrorMap** toggle (dev panel, or `?mirror=1`) mirrors the ground for testing a left-handed map.
- **Missions.** Skills start locked and are unlocked one per completed mission, in this order: HOOK, TAIL BULLET, BURST, VACUUM.
  - Each mission sends you to a random target. Its time limit comes from the walking route.
  - A HUD arrow points toward the target, and a 60 s pause follows each mission.
  - Running out of time ends the mission silently.
  - After all four skills are earned, each mission drops a random bonus tile on its target.
- **Weapons split.** The player's hook follows the HOOK skill. `HOOK_ENABLED` now only controls bot hooks, so bots keep the weapons their difficulty gives them.
- Skill gates for the burst, tail bullet and vacuum also apply. The burst bar is hidden while burst is locked.
- Trees do not block the snake.

### Dev tools
- Dev-panel sliders (BotMax, Range, Chase, BotSpd, Snacks, Terrain Z, RoadBoost) start from their CFG values. Before, they showed hardcoded numbers that did not match the game.
- Added RoadBoost and MirrorMap controls.

### Music
- Removed `athena_piano_3.mp4` from the playlist (the file was missing).
- Added `MUSIC.md` to track which tracks are in use.

### Fixes and cleanup
- Removed the dead audio-controls block (`#startBtn`, `#a1`, `#a2`) from the multiplayer overlay. Its "30:00" heading was visible in the menu.
- Corrected the `schematic.html` CFG table against `config.js`.
- Version strings in `index.html`, `config.js`, `dad.js` and `process.html` now read v4.0.0.

### Docs
- `TO DO` list rebuilt in `process.html`. The old list is in `todo-archive.html`.
- `convo.md` records the design decisions behind this release.
- `lessons-learned.html` #22 (sliders must init from CFG), #23 (UV flip), #24 (hidden start screens).

---

## v3.3.1 — (undated)
- Version comment in `index.html` only. No other notes were recorded.

## v3.2.0 — Dad's mode MVP (undated)
- `js/dad.js`: WebGL satellite ground, 3D building massing, tree billboards (trunk and canopy), road speed boost, `DAD._isWall()` collision grid, bundle loading via `walteria-map.js`.
- "Dad's Mode Hard" button wired in `dad.js`. It was later hidden with the old start panel.
- Spawn filtering: food, bots and the initial bot loop avoid building cells.
- Duplicate `const CFG_DAD` fixed. Road-boost fields merged into `config.js`.
- Dad's mode skeleton: `schematic.html` still describes the planned Mapbox and Three.js design. The shipped version uses WebGL and the map builder's JSON.

## Unversioned work (from the old TO DO list, in order of listing)
- Map builder MVP (`map-builder.html`): tree, building and road tools, 3D massing preview, JSON and JS export.
- Skip-track button: `MUS.skip()` in `music.js`, wired to the ⏭ HUD button.
- Athena decoration objects drawn two-sided, depth-sorted per frame.
- Radar bonus dots are twice the standard size (radius 2 → 4).
- `PLAYER_START_VAL` works across the player, initial bots, `_worldMax` and the slider.

## v3.1.1 — slim HTML
- Settings panel, MP overlay and joystick HTML are generated by their JS files. `index.html` is about 70 lines of skeleton.
- Duplicate `#s-over` removed. Only the instance in the main body remains.

## v3.0.2
- `PLAYER_START_VAL` fixed in all its places (player, initial bots, `_worldMax`, slider).
- Slider init bug fixed: `applyStartValSlider()` reads from CFG and no longer overwrites it (`lessons-learned` #11).

## v3.0.1 — monolithic file (undated)
- Monolithic `snake2048_v3.0.1.html`, 5226 lines. It was later split into modular files (`lessons-learned` #7). The versioned single-file snapshots mentioned in `process.html` were not kept in this repo.

## v3.0.x — refactor session
- Split the monolith into `index.html`, `css/` and `js/`. Plain script tags share one global scope (`lessons-learned` #1).
- Added the DOM injection pattern (`lessons-learned` #12) and terrain-conforming cubes (#14).

## v2.3.0 — 2026-05-03 (multiplayer)
- Peer IDs encode the mode: `snakecubes-cXX` for co-op, `snakecubes-vXX` for versus. Lobby shows the mode badge.
- Co-op: friendly fire off. A human killing a bot with head value 64 or more scatters bonus food ("big kill").
- Competitive: players can eat each other. Respawn at 2^(x−2), floored at 2. The host respawns instead of ending the game.
- Competitive speed handicap: the smaller human gains 2% speed per level gap, up to 10%.
- Terrain Z-scale dev slider.

## v1.x (referenced only)
- `v1.0.1`: merge speed was 0.24 (`js/config.js`, now 0.36).
- `v1.0.2`: eye radius was changed (`js/render.js`).
- No v1.x or v2.0–2.2 notes survive in this repo.
