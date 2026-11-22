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
| Move | Tap the board to turn toward the tap, measured from the middle of the screen. Swipe, or push the stick in the lower-left corner. Arrow keys and WASD work too. |
| Pause | P or Esc, or the II button. Leaving the tab also pauses. |
| Goal | None. FreePlay has no timer and no grade: keep going as long as you like, and the run ends only in a crash. |
| Crash | Into a wall, your own body, or another snake, and you break apart in a small explosion, then fade to the game-over screen. Head-on crashes count too. |
| Rivals | Three by default, 1 to 10 in settings. You can't eat them. Any snake that crashes breaks apart into coins worth its symbols, thrown within 3 cells. A bot comes back after 3 s. |
| Numbers | Numerals are Roman only. The largest one is MMMCMXCIX (3999). |

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
    input.js            keys, taps, swipes, corner stick            (browser)
    ui.js               screens, HUD, settings                       (browser)
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
| Speed, board size, cell size, numeral ceiling, stick sensitivity, rival limits, respawn time, crash radius | `js/config.js` → `CFG2` |
| Snack odds | `js/config.js` → `SNACK_SETS` |
| Symbol colours | `js/config.js` → `SYMBOL_COLOURS` |
| How numerals collapse | `js/snake.js` → `setValue()` |
| Who crashes | `js/rules.js` → `resolveTick()` |
| Tap, swipe, stick, keys | `js/input.js` → `installInput()`, direction from `js/grid.js` → `directionFromOffset()` |
| Bot behaviour | `js/bots.js` → `botChooseDir()` |
| Look | `js/render.js` and `css/snake2.css` |

## Notes

- **Music** is shared with the main game (`../js/music.js`, `../music/`). Its mute setting is stored under the same key, so muting in Snake II also mutes Felix's Snake Cubes.
- **Saved data** uses the `snake2.settings` localStorage key only. Earlier builds also kept best scores under `snake2.best.*`; FreePlay no longer reads or writes them.
- **Multiplayer** is not part of Snake II.
