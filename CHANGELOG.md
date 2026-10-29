# Changelog

Felix's Snake Cubes. Entries are grouped by version, newest first.

The git history here starts at a single "initialize" commit, so entries before v4.0.0 are reconstructed from in-repo notes: `lessons-learned.html`, `process.html`, `schematic.html`, `todo-archive.html`, code header comments, and `convo.md`. Dates appear only where the source gives one. Items with no version were recorded in the old TO DO list without one.

---

## Unreleased — Open saved maps

- **Open SAVED (2.0 and 3.0):** the 📂 OPEN SAVED button lists maps saved on this device and family favourites. Pick one to edit it again. Saving then updates the same map rather than making a copy.
- **What comes back:** 2.0 restores the picture, objects, cut-out outline (new saves), scale and name. 3.0 restores the exact wall grid, heights, floor colour and tile size.
- **Cross-builder:** opening a map of the other kind switches to its builder with the map loaded.
- **Older saves:** 2.0 maps saved before this change open without the cut-out outline, and 3.0 maps rebuild their grid from the wall rectangles, which drops zero-height walls.

## Unreleased — Family high scores

- **Family board:** every finished solo game (Felix, Athena, Dad's mode) is saved to a shared `snake_highscores` table in the Family database, with the player's name, mode and map. The start screen and the game-over screen show the family's top 8.
- **Local cache kept:** `sn2048` still holds this device's top 8 and is shown when the family database can't be reached. A score that fails to upload waits on the device (up to 50) and is sent with the next game.
- **Not on the board:** multiplayer rounds.
- **Access:** anyone with the page can read and add scores, as the family chose. Scores can't be edited or deleted from the page.
- **Reset:** RESET HIGH SCORES clears this device only. The family board is kept.

## Unreleased — Map Builder 2.0 (real world) and 3.0 (mazes)

- **Reaching the builders:** the start menu's DAD options and OTHERS screen link to Map Builder 1.0. Each builder has a lower-right switcher (1.0 ↔ 2.0 ↔ 3.0) and a 🏠 GAME link.
- **Map Builder 2.0 — real world** (`map-builder-2.html`): search a place or drop a pin on a Leaflet map (satellite / street / clean layers), cut out a circle, square or custom polygon, then PULL DATA & BAKE:
  - the ground texture is stitched from map tiles (Esri imagery, OSM or CARTO street map, or a mix) at 20 px per game cell, masked to the shape;
  - OpenStreetMap supplies buildings (heights from `height` / `building:levels`), streets, trees and parks through Overpass;
  - optional wall-off of everything outside the shape;
  - editor with select / tree / quick block / drawn block / erase, auto-generated trees (parks only, or anywhere free), a cell grid and a scale reference; works with touch (one finger pans, two pinch, tap to use the tool);
  - a three.js 3D preview, then SAVE TO THIS DEVICE or DOWNLOAD .json.
- **Map Builder 3.0 — mazes** (`map-builder-3.html`): open a maze JPEG / screenshot (or press SAMPLE MAZE), crop, rotate, then GENERATE WALLS. Solid lines become tall walls, hatching becomes lower textured walls. Paint-edit walls with a brush, set wall / hatch height, and set the scale (game cells per tile). A true-size snake ruler (also following the cursor) shows how the snake fits the corridors.
- **Dad's mode:** new WORLD row — CLASSIC MAPS (as before) or MY MAPS. MY MAPS lists maps saved by the builders in this browser (IndexedDB, `js/map-store.js`), loads a `.json` from a file, and can delete saved maps.
- **Loader changes (`js/dad.js`):** maps may carry their own `scale`; `exact` maps rasterise walls by cell centre so a wall drawn N cells thick blocks N cells; blocks may carry `color` and `texture: 'hatch'`; maps with many blocks cull the far ones each frame. Existing maps load exactly as before.
- **Pull what you tick (2.0):** "What to pull" is now a plain list: ① background, ② wall off outside, ③ 3D buildings, ④ streets (+ footpaths), ⑤ trees & parks. Unticked layers are not downloaded. BACKGROUND ONLY and EVERYTHING presets are added, and a line under the button says what will be pulled.
- **Pull doesn't hang (2.0):** every map tile times out after 12 s and the OSM request after 60 s. A live status line shows the step and elapsed seconds. The button becomes ✕ CANCEL PULL; cancelling keeps the current map.
- **Pull fixes (2.0):** OSM is asked one layer at a time (buildings, streets, trees), and a big area is split into four. Overpass errors and out-of-memory remarks are shown by name instead of silently giving no buildings.
- **Game scale (2.0):** a GAME SCALE slider (1–6, default 3). Higher means more, smaller cells, so the snake looks smaller and the map feels bigger.
- **Auto blocks (2.0):** AUTO-BLOCK FROM PICTURE finds rooftops in the baked picture from edges, brightness steps and colour (not green, water, shadow or roads), joins the cells into blocks, and skips real footprints. Sensitivity, minimum size and block height are adjustable. Clear removes them.
- **Map names:** the name field now sits at the top of the edit panel in 2.0 and 3.0.
- **Favorites (family database):** ★ SAVE FAVORITE uploads the map to the Family Supabase project (`snake_maps` table, registered in `app_table_registry`). Dad's menu has WORLD → ★ FAVORITES to play them. Anyone with the page can save and delete, as the family chose. Device saves remain under MY MAPS.
- **Planned:** import 3D masses (glTF / GLB first, then CityGML or 3D Tiles), per-tree species and 3D tree models, terrain elevation, per-wall textures.

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
