# Snake II — Roman numeral snake

A classic grid snake where your snake **is** a number. Its body is the number written in Roman numerals, one symbol per tile. Eat coins to count up. When the body would spell something Romans wouldn't write, it collapses: `III + I → IV`, and the tail shortens.

The full design is in [`schematic_snake2.md`](schematic_snake2.md). This README covers running and testing it.

## Run it

Serve the repo root over http (not `file://`), so `../music/` and `../js/music.js` load:

```bash
npx serve .            # or: python3 -m http.server 8000
# open http://localhost:8000/snake2/
```

## Play

| | |
|---|---|
| Move | Arrow keys or WASD. Swipe on the board, or use the W / A / S / D pad in the lower left. |
| Pause | P or Esc, or the II button. Leaving the tab also pauses. |
| Goal | Reach **MMXXI** (2021). Timed mode is 3:00. Endless runs until you win or crash. |
| Crash | Into a wall, your own body, or another snake, and you break apart in a small explosion, then fade to the game-over screen. Head-on crashes count too. |
| Rivals | Three by default, 1 to 10 in settings. You can't eat them. Any snake that crashes breaks apart into coins worth its symbols, thrown within 3 cells. A bot comes back after 3 s. |
| Numbers | The clock, scores and menus are Roman only. Zero is N (nulla): 3:00 is III:N. |

## Layout

```
snake2/
  index.html            page skeleton and screens
  css/snake2.css        cartoon style, masonry stones
  js/
    config.js           CFG2, SNACK_SETS, colours, names
    roman.js            toRoman, fromRoman, romanLength, popLabel   (pure)
    grid.js             board, walls, cell keys, seeded random      (pure)
    snake.js            snake model: value, body, grow and collapse (pure)
    rules.js            who crashes each tick                       (pure)
    bots.js             bot direction: BFS to coins, stay safe      (pure)
    game.js             game state, one tick, snacks, clock         (pure)
    camera.js           follow camera                               (browser)
    render.js           canvas drawing                              (browser)
    input.js            keys, swipes, d-pad                         (browser)
    ui.js               screens, HUD, settings, best scores         (browser)
    main.js             boot and the frame loop                     (browser)
  tests/                node:test suites for the pure modules
```

The pure modules have no DOM code, so the tests load them the same way the page does (one shared global scope). See `tests/load.js`.

## Test

```bash
cd snake2
node --test tests/*.test.js
```

The suites cover the numeral maths (1–2021 round trips, the length table, no zero), snake growth and collapse (including the invariant `cells + pending = romanLength(value)` after every step), every collision case, bot behaviour, and random play for thousands of ticks.

## Change things

| To change | Edit |
|---|---|
| Speed, board size, cell size, goal, rival limits, respawn time, crash radius | `js/config.js` → `CFG2` |
| Snack odds | `js/config.js` → `SNACK_SETS` |
| Symbol colours | `js/config.js` → `SYMBOL_COLOURS` |
| How numerals collapse | `js/snake.js` → `setValue()` |
| Who crashes | `js/rules.js` → `resolveTick()` |
| Bot behaviour | `js/bots.js` → `botChooseDir()` |
| Look | `js/render.js` and `css/snake2.css` |

## Notes

- **Music** is shared with the main game (`../js/music.js`, `../music/`). Its mute setting is stored under the same key, so muting in Snake II also mutes Felix's Snake Cubes.
- **Saved data** uses the `snake2.*` localStorage keys only: settings, and the best timed and endless scores.
- **Multiplayer** is not part of Snake II.
