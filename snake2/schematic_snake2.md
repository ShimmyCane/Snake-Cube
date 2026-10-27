# Snake II — full plan (MVP)

A classic 2-D grid snake where your snake **is** a number, written in Roman numerals.

- **Status:** built (M0–M5). Code lives in `snake2/`; see `snake2/README.md` for how to run and test it.
- **Folder:** `snake2/`, separate from Felix's Snake Cubes.
- **Source of truth:** this file. It replaces the earlier `schematic.html` draft.

---

## 1. Decisions so far

| # | Question | Your answer | What it means in the build |
|---|---|---|---|
| 1 | Field size | 50 × 50 | 48 × 48 playable cells inside a stone wall. The camera follows you, because the whole board won't fit a phone screen at a readable size (section 9). |
| 2 | Crashes | 1 crash = game over | No lives. Classic. |
| 3 | Rivals | 3 bots by default, up to 10 in settings; can't eat them | Bots are moving obstacles that also race you for snacks. Touching any snake is a crash, for whoever runs into whom. |
| 4 | Winning number | **2021**, Felix's birth year | **MMXXI** (5 symbols). Reaching it wins. |
| 5 | Snacks | Mix of 3 (I, V, X), with a setting for bigger mixes if it's too slow | Snack set setting: Classic / Extended / Imperial (section 5). |
| 6 | Show the ordinary number | No, toggle in settings | Off by default. Settings → "Show numbers". |
| 7 | Round | 3 minutes, plus an endless mode up to the limit | Two modes: **Timed** (3:00) and **Endless** (until MMXXI or a crash). |

The earlier draft said "one mode"; your answer to 7 makes it two. Everything else in the draft still stands except where this table changes it.

---

## 2. The core mechanic: the body spells the number

```
 value 3        value 4             value 8            value 9         value 10
 [I][I][I]  +I  [I][V]        ...   [V][I][I][I]  +I   [I][X]    +I    [X]
 3 long         2 long  ← collapse  4 long             2 long          1 long

 head ─────────────────▶ tail       the head carries the first symbol;
                                    new symbols grow from the tail end
```

The snake stores one integer, `value`. The body is always `toRoman(value)`, one symbol per cell, read from head to tail. The head is cell 0 and carries the first symbol, so it is part of the number: XX is a head X and a tail X, VI is V then I. When the value changes:

| The numeral gets… | On the field |
|---|---|
| longer | Classic growth. The tail stays put one tick per extra symbol, so the body grows out of the tail. |
| ligature | Subtractive pairs (IV, IX, XL, XC, CD, CM) are one symbol and one cell. So 4 is just a head with no tail. |
| shorter | Collapse. The extra tail cells drop off at once, with a floating pop "III + I → IV". |
| the same length | The tiles just relabel (IV + V = IX). |

### Why it's a puzzle

These lengths are computed, not typed by hand.

| Value | Numeral | Length | Lesson |
|---|---|---|---|
| 3 → 4 | III → IV | 3 → 1 | Eating can leave you as just a head |
| 8 → 9 → 10 | VIII → IX → X | 4 → 1 → 1 | One snack and you're a single cell |
| 38 → 40 | XXXVIII → XL | 7 → 1 | Count your way out of a tight spot |
| 88 → 90 | LXXXVIII → XC | 8 → 1 | The longest snakes are close to tiny |
| 1888 | MDCCCLXXXVIII | 13 | Longest numeral below the goal |
| 2021 | MMXXI | 5 | The goal |

Romans had no zero, so every snake starts at **I** and can never go below it. That's a nice fact for kids.

---

## 3. Rules

| Rule | Behaviour |
|---|---|
| Board | 50 × 50 cells. The outer ring is stone wall, leaving 48 × 48 cells to play in. |
| Movement | Up, down, left or right. One cell per tick. You can't reverse into yourself (a 180° turn is ignored). |
| Speed | One speed for every snake: 243 ms per step (30% slower than the first build). Size never changes it. |
| Start | You start as **I** near the middle, facing right. Rival snakes start as **I** at spread-out spots, facing inward. |
| Snacks | 20 on the field. When one is eaten, a new one appears on a random free cell. Values come from the snack set (section 5) and never scale up. |
| Eating | Your head enters a snack's cell: `value += snack value`. |
| Crash | You crash if your head moves into a wall, any part of your own body, or any part of another snake (head or body). |
| Your crash | You break apart in a small explosion: each body symbol becomes a coin of its value, thrown within 3 cells. Then the screen holds about a second and fades into the game-over screen. |
| Bot crash | Same: it breaks apart and its coins are thrown within 3 cells. It respawns as I after 3 s on a free cell far from you. Any crash does this: wall, own body, another snake, head-on. |
| Head-on | Two heads entering the same cell, or swapping cells: both crash. If one of them is you, game over. |
| Your tail rule | Moving into the cell your own tail is leaving this tick is allowed (classic). It doesn't apply on a tick when you're growing. |
| Goal | Reach **MMXXI** (2021). Your value can't go past it. A snack that would take you over 2021 sets you to exactly 2021 and you win. |
| Timed mode | 3:00 countdown. Score = your final number. Reaching MMXXI before time wins early. |
| Endless mode | No timer. The run ends at MMXXI (win) or a crash (game over). Score = your final number, plus your time when you win. |
| Skills / bonus tiles | None in the MVP. |

**Why bot crashes turn into snacks:** without it, bots dying would just remove them. Turning a crashed bot into I snacks makes "let them run into you" a small strategy. It's within your "can't eat them" rule, because you never eat a living bot.

---

## 4. Collisions

All snakes move in the same tick, so these are decided on the *new* head cells.

| My head moves into… | Result |
|---|---|
| a wall | I crash |
| my own body (not my tail cell that's leaving) | I crash |
| another snake's body | I crash |
| the same cell as another head (or we swap) | both crash |
| a snack | I eat it |
| an empty cell | I move |

The same table applies to bots, with "game over" replaced by "respawn".

---

## 5. Snack sets (setting)

Expected pace, simulated on 48 × 48 with 20 snacks and 3 bots competing. Each snack takes about 1.7 s to reach.

| Snack set | Mix | Average snack | Timed 3:00 reaches about | Endless to MMXXI takes about |
|---|---|---|---|---|
| **Classic** (default) | I 80% · V 15% · X 5% | 2.05 | **CCXII** (212) | 28 min |
| **Extended** | I 60% · V 20% · X 12% · L 6% · C 2% | 7.8 | **DCCCIX** (809) | 7½ min |
| **Imperial** | I 50% · V 20% · X 15% · L 8% · C 5% · D 1.5% · M 0.5% | 24.5 | over MMXXI | 2½ min |

- **Classic** is the "mix of 3" you asked for. In Timed mode it's a counting game where you won't reach MMXXI.
- **Extended** is the one I'd suggest for Endless: about 7–8 minutes to win.
- **Imperial** is for playing around. It wins fast and shows off D and M.

These are estimates, so the numbers will be tuned after real play.

---

## 6. Modes and settings

**Start menu:**

```
          SNAKE II
     [ TIMED · 3:00 ]  [ ENDLESS ]        ← masonry stones, like the main menu
              ⚙ SETTINGS
         best scores (both modes)
          ← Felix's Snake Cubes
```

**Settings** (saved in `localStorage`, key `snake2.settings`):

| Setting | Options | Default |
|---|---|---|
| Show numbers | on / off. Shows the ordinary number under the Roman one in the HUD only. The clock, scores and menus are always Roman. | off |
| Rival snakes | 1 to 10, shown in Roman numerals. More rivals also means more snacks on the field. | III (3) |
| Snack set | Classic / Extended / Imperial | Classic |
| Music | on / off | on |
| Controls hint | on / off. Shows "swipe or use the arrows" at the start. | on |

---

## 7. Folder and file map

```
Snake-Cube/
  music/*.mp4               ← SHARED: same tracks
  js/music.js               ← SHARED: loaded as ../js/music.js
  index.html                ← main game; gets one "Snake II" link under OTHERS (M5)
  snake2/
    index.html              ← page skeleton: canvas, HUD, overlays, d-pad, load-error panel
    schematic_snake2.md     ← this plan
    README.md               ← how to run, test, and where to change things
    css/
      snake2.css            ← cartoon styles, masonry menu, HUD, d-pad
    js/
      config.js             ← CFG2, SNACK_SETS, SYMBOL_COLOURS, CFG_AUDIO (for music.js)
      roman.js              ← toRoman, fromRoman, romanLength (pure)
      grid.js               ← board, isWall, occupancy, freeCell (pure)
      snake.js              ← newSnake2, planMove, applyMove, setValue (pure)
      rules.js              ← resolveTick: moves + collisions for all snakes (pure)
      bots.js               ← botChooseDir: BFS to a snack, avoid danger (pure)
      game.js               ← G2 state, start/end, tick, snacks, timer, win/lose
      camera.js             ← follow-the-player viewport
      render.js             ← 2-D canvas drawing
      input.js              ← keys, swipe, d-pad → queued turns
      ui.js                 ← menu, settings, HUD, countdown, overlays, best scores
      main.js               ← boot + requestAnimationFrame loop
    tests/
      roman.test.js
      snake.test.js
      rules.test.js
      bots.test.js
```

### Shared, copied, or new

| Piece | Decision | Why |
|---|---|---|
| Music player and tracks | Shared | `music.js` only needs `CFG_AUDIO.FOLDER = '../music/'`. |
| Load-error panel | Copied and trimmed | Proven pattern; lists Snake II's own files. |
| Masonry stone buttons | Copied into `snake2.css` | Same family look. Later: one shared `css/masonry.css`. |
| 3-D engine, game core, weapons, Dad, Athena | Not used | They're built for free 360° movement and powers of 2. A grid game is smaller written fresh. |
| Head face (eyes) | Redrawn in 2-D | So the games feel related. |

Snake II never loads the main game's `config.js` or `game-core.js`, so global names can't collide (lessons-learned #21). Snake II globals use a `2` suffix where a clash would confuse a reader (`G2`, `CFG2`).

**Pure modules:** `roman.js`, `grid.js`, `snake.js`, `rules.js` and `bots.js` don't touch the DOM. Each ends with `if (typeof module !== 'undefined') module.exports = {...}`, so the browser uses them as plain scripts and `node --test` can `require` them.

---

## 8. Script load order

```
 1. js/config.js
 2. js/roman.js
 3. js/grid.js
 4. js/snake.js
 5. js/rules.js
 6. js/bots.js
 7. js/game.js
 8. js/camera.js
 9. js/render.js
10. js/input.js
11. js/ui.js
12. ../js/music.js     (shared)
13. js/main.js         ← starts the loop last
```

---

## 9. Board, camera and screen

A 50 × 50 board on a phone at 390 px wide would make each cell about 7 px, too small for letters. So the board is bigger than the screen and the camera follows you.

| Screen | Cell size | Cells visible (about) |
|---|---|---|
| Phone portrait (390 × 844) | 35 px | 11 wide × 24 tall (room left for HUD and the pad) |
| Tablet (820 × 1180) | 35 px | 23 × 33 |
| Desktop (1440 × 900) | 35 px | 41 × 26 |

- The camera keeps you centred and slides smoothly. It stops at the walls, so the edge of the world always looks solid.
- A **minimap** in a corner shows the whole 50 × 50: you, the bots, snacks as dots. On a big field this is how you find food.
- Cells are 35 px on every device (`CFG2.CELL_PX`), so tiles, coins and buttons look the same on an iPhone, an iPad and a laptop. A bigger screen shows more of the map instead, and the minimap scales up with it (110 px on a phone, up to 260 px). The page re-checks the screen size every frame, because iPhones and iPads report it late.

---

## 10. One tick (every 243 ms, all snakes together)

```
1. Turns       player: take the next queued turn (ignore 180° reversals)
               bots:   botChooseDir(bot, board)
2. Plan        each live snake's next head cell = head + dir
3. Resolve     rules.resolveTick(snakes, board) → crashes, using section 4
               (tail-leaving cells count as free for their own snake)
4. Move        survivors: unshift the new head; pop the tail unless pendingGrow > 0
5. Eat         head on a snack → value += snack (capped at 2021); spawn a new snack
6. Rewrite     len = romanLength(value)
                 len > cells + pendingGrow → pendingGrow += difference
                 len < cells               → drop the extra tail cells; add a pop "old → new"
7. Crashed bots → their cells become I snacks; respawn timer 3 s
8. Check       player crashed → OVER · value == 2021 → WON · timer 0 (Timed) → OVER
```

**Invariant** (checked by the tests after every tick): `cells.length + pendingGrow === romanLength(value)`.

---

## 11. Data model

```js
G2 = {
  state:      'menu' | 'countdown' | 'playing' | 'paused' | 'over' | 'won',
  mode:       'timed' | 'endless',
  timeLeftMs, elapsedMs,
  lastTickAt,                       // for drawing between grid steps
  board:      { cols: 50, rows: 50 },
  snakes:     [player, bot1, bot2, bot3],
  player,
  snacks:     [{ c, r, value }],
  pops:       [{ c, r, text, at }], // "III + I → IV"
  best,                             // highest value this run
  seed,                             // random seed, so tests and replays are repeatable
}

snake = {
  id, name, isPlayer, colour,
  value: 1,                         // the only source of truth
  cells: [{ c, r }],                // head first
  dir: { dc, dr },
  turnQueue: [],                    // player only, up to 2 turns
  pendingGrow: 0,
  alive: true,
  respawnAt: 0,                     // bots only
}
```

Body symbols are never stored. They're always `toRoman(snake.value)` at draw time.

---

## 12. Bots

```
botChooseDir(bot, board):
  candidates = the 3 non-reversing directions
  safe       = candidates whose next cell is not a wall, not a body, and not a
               cell another head could also enter this tick
  if safe is empty → keep the current direction (it will crash and respawn)
  path       = BFS from the head to the nearest snack, through free cells only
  if path → take its first step if that step is safe
  else   → pick the safe move with the most free space around it (a flood-fill count)
```

- BFS on 2,304 cells × 3 bots per tick is cheap. It's capped at 600 visited cells per bot in case the board fills up.
- Bot names come from a Roman list: Marcus, Julia, Livia, Gaius, Octavia, Lucius, Cornelia… (Felix is Latin for "lucky", so it's saved for the player.)
- Bots never chase you. With "can't eat them", chasing would only mean bots trying to make you crash, which feels mean in a kids' game.

---

## 13. Look and feel: cartoon, stylised

| Element | Look |
|---|---|
| Floor | Warm parchment or marble with a faint mosaic grid |
| Walls | Chunky cartoon stone blocks, matching the masonry menu |
| Body tiles | Rounded squares, thick dark outline, one bold serif letter each |
| Symbol colours | I green · V yellow · X orange · L red · C purple · D blue · M gold |
| Snake identity | Each snake's head has its own coloured ring and eyes; your ring is teal, like the main game |
| Snacks | Coins coloured by symbol (I green, V yellow, X orange, L red, C purple, D blue, M gold), gently bobbing. A crashed snake's coins fly out from its body. |
| Collapse | Dropped tail tiles squash and fade; a floating "III + I → IV" |
| Motion | Steps on the grid, but drawn eased between cells so it reads smoothly |
| Crash | A puff and a short screen shake |
| Win | Laurel wreath and "MMXXI — FELIX!" banner |
| HUD | Your number big in Roman; the ordinary number underneath only if the setting is on. Timer (Timed) or clock-up (Endless). Best. |
| Rendering | Plain 2-D canvas, sharp on high-DPI phones. No images needed for the MVP. |

---

## 14. Controls

| Device | Input |
|---|---|
| Keyboard | Arrows or WASD to turn; P or Esc to pause |
| Phone | Swipe anywhere on the board, or the W / A / S / D pad in the lower left (both always on). The lower right is kept free for skill buttons later. |
| Turn queue | Up to 2 turns are queued, so a quick "up, left" between ticks isn't lost |
| Pause | Leaving the tab or opening settings pauses the game |

---

## 15. Screens (state machine)

```
 menu ──TIMED/ENDLESS──▶ countdown (III · II · I · IRE!) ──▶ playing ⇄ paused
                                                              │
                     crash, or timer 0 in Timed ──▶ over      │      value = 2021 ──▶ won
                                       └────── PLAY AGAIN / MENU ──────┘
```

"IRE!" is Latin for "go!".

---

## 16. Saved data

| Key | Content |
|---|---|
| `snake2.settings` | `{ showNumbers, snackSet, music, hint }` |
| `snake2.best.timed` | top 5 `{ value, date }` |
| `snake2.best.endless` | top 5 `{ value, timeMs, won, date }` |

These keys are separate from the main game's, so resetting one game's scores never touches the other.

---

## 17. Config (`CFG2` in `js/config.js`)

| Key | Default | Meaning |
|---|---|---|
| `COLS`, `ROWS` | 50, 50 | Board including the wall ring |
| `CELL_PX` | 35 | Drawn cell size, the same on every device |
| `TICK_MS` | 243 | One step for every snake |
| `ROUND_MS` | 180000 | Timed mode length |
| `GOAL` | 2021 | MMXXI: the cap and the win |
| `SNACKS_ON_FIELD` | 20 | Snacks kept on the board |
| `SNACK_SETS` | Classic / Extended / Imperial | Odds in section 5 |
| `BOTS` | 3 | Rival snakes |
| `BOT_RESPAWN_MS` | 3000 | Bot comeback delay |
| `TURN_QUEUE` | 2 | Buffered player turns |

---

## 18. Testing

| Layer | What is checked | How |
|---|---|---|
| Roman | 1..2021 round-trip through `toRoman`/`fromRoman`; the length table in section 2; no zero; 2021 = MMXXI | `node --test snake2/tests/` |
| Snake | Growth from the tail; III → IV drops 2 cells (III is 3 long, IV is 1); IV + V relabels; the invariant after every step; cap at 2021 | node, fixed seed |
| Rules | Wall crash, self crash, body crash, head-on, head swap, tail-leaving cell allowed (but not when growing), bots → I snacks | node, hand-built boards |
| Bots | Never pick an unsafe move when a safe one exists; reach a snack in an open room; BFS cap respected | node |
| Browser | The page loads with no console errors; menu → countdown → playing → crash → over; settings persist; the camera stays inside walls | Headless Chromium (as used for v4) |
| Phone | Swipe and d-pad feel, letter size, minimap usefulness | You |

---

## 19. Execution plan

Each step leaves a page you can open and play, so you can redirect after any of them.

| Step | Build | Done when |
|---|---|---|
| **M0 Skeleton** | `snake2/index.html` with all script tags and the load-error panel; empty board; menu with TIMED / ENDLESS | Loads with no errors; the panel lists every file as loaded |
| **M1 Roman core** | `roman.js` + tests | 1..2021 round-trip; section 2 lengths match |
| **M2 Solo snake** | `grid.js`, `snake.js`, `rules.js`, `game.js`, `input.js`; walls; I-only snacks; grow and collapse; crash = game over | You can play alone and watch III become IV; snake and rules tests pass |
| **M3 Board and look** | `camera.js`, `render.js`: follow camera, minimap, stone walls, letter tiles, faces, coins, eased motion, collapse pops | Readable on a phone; you've checked screenshots |
| **M4 Rivals and modes** | `bots.js`, bot respawn → snacks, Timed and Endless, snack sets, MMXXI win, best scores | Full Timed and Endless runs play start to finish; bot tests pass |
| **M5 Settings and polish** | Settings panel, show-numbers toggle, d-pad, countdown, pause, shared music, README, link from the main game's OTHERS screen, CHANGELOG, process.html file map | Browser smoke test clean; your phone test |

---

## 20. Risks

| Risk | Plan |
|---|---|
| 50 × 50 makes the snake feel small and the field empty. The longest numeral below 2021 is only 13 tiles. | Camera keeps it tight on screen. 20 snacks plus 3 bots keep it busy. If it still feels empty, try 36 × 36. |
| Classic snacks are slow for Endless (about 28 min) | Snack set setting. Extended is about 7–8 min. |
| Head-on crashes with bots feel unfair | Bots avoid cells that another head could also enter, so head-ons should be rare and mostly your choice. |
| Letters unreadable on small phones | `CELL_PX` setting. Serif letters at 60% of the tile. |
| Shared `music.js` changes in the main game | It's small and stable; the README notes the dependency. |

---

## 21. Later ideas (not in the MVP)

| Idea | Shape |
|---|---|
| ⏳ Hourglass | Rare tile: bots freeze for 3 s. Fits the Roman-time theme. |
| 🛡 Scutum | Survive one crash |
| Exact landing | Win only by landing exactly on MMXXI; overshooting bounces you back. A harder puzzle. |
| BCE / CE | Parked (you called it too much) |
| Sounds | Coin, collapse pop, crash |
| Shared masonry CSS | One `css/masonry.css` for both games |

---

## 22. Remaining open questions

The build uses the defaults in brackets unless you say otherwise.

1. **Overshoot:** a snack that would pass 2021 snaps you to MMXXI and wins [yes]. Or should it be an exact-landing puzzle?
2. **Crashed bots become I snacks** [yes]. Or should they just vanish?
3. **Bots never chase you** [yes]. Or should they hunt a little on a harder setting?
4. **Minimap** always on [yes]. Or a setting?


---

## 23. Changes after the first phone test (2026-10-27)

| Change | Detail |
|---|---|
| Zoom | Cells grew from 26 to 35 px (about 35% bigger) on an iPhone. |
| Same size everywhere | Cells, tiles and buttons are the same size on every device. A bigger screen shows more map, and the minimap grows. The screen size is re-checked every frame, which fixes the stale-size clipping on iPad. Safe-area insets keep the HUD and pad off the notch and home bar. |
| Coin colours | Each coin takes the colour of its symbol. |
| Rival snakes | A settings stepper from 1 to 10, default 3. Snack count grows by 4 per extra rival. |
| Controls | The pad moves to the lower left, labelled W / A / S / D. The minimap moves to the lower right. |
| Crashes | Instead of biting smaller snakes, any snake that crashes breaks apart: a small explosion, with each symbol thrown as a coin of the same value within 3 cells. The player's crash fades into the game-over screen after about a second. Coin values are conserved, so a big snake's wreck is worth a lot. |
| Roman everywhere | The clock reads in Roman numerals (II:LIX), with N for zero. Scores and best lists are Roman only. |
| Homepage | A "← Snake I" button links back to the first game. The pause screen has the same link. |
