# Snake II — Roman numeral snake

A snake that is a number. Its body is the number written in Roman numerals, one symbol per step along the body. Eat coins to count up. When the body would spell something Romans wouldn't write, it collapses: `III + I → IV`, and the body shortens.

Movement is smooth and free: no grid, any direction, including diagonals. The design history is in [`schematic_snake2.md`](schematic_snake2.md). This README covers running and testing it.

## Run it

Serve the repo root over http (not `file://`), so `../music/` and `../js/music.js` load:

```bash
npx serve .            # or: python3 -m http.server 8000
# open http://localhost:8000/snake2/
```

## Play

| | |
|---|---|
| Aim | Push the stick in the lower-left corner in any direction. Or tap the board: Felix aims toward the tap, measured from the middle of the screen. Or swipe. Or hold arrow keys / WASD (two keys together aim diagonally). Felix turns toward the aim a little each step. |
| Pause | P or Esc, or the II button. Leaving the tab also pauses. |
| Goal | None. FreePlay has no timer and no grade: keep going as long as you like, and the run ends only in a crash. |
| Crash | Into the stone border, your own body (past your neck), or another snake, and you break apart in a small explosion, then fade to the game-over screen. Head-on crashes count too. |
| Rivals | Three by default, 1 to 10 in settings. You can't eat them. Any snake that crashes breaks apart into coins worth its symbols. A bot comes back after 3 s. |
| Numbers | Numerals are Roman only. The largest one is MMMCMXCIX (3999). |

## Layout

```
snake2/
  index.html            page skeleton and screens
  css/snake2.css        cartoon style, masonry stones
  js/
    config.js           CFG2, SNACK_SETS, colours, names
    roman.js            toRoman, fromRoman, romanLength, popLabel   (pure)
    geom.js             angles, distances, trails                    (pure)
    arena.js            stone border, random points, seeded random   (pure)
    snake.js            snake model: body length, turning, moving    (pure)
    rules.js            who crashes each step                        (pure)
    bots.js             bot aim: clearance and snacks                (pure)
    game.js             game state, one step, snacks, bots           (pure)
    camera.js           follow camera                                (browser)
    render.js           canvas drawing                               (browser)
    input.js            keys, taps, swipes, corner stick             (browser)
    ui.js               screens, HUD, settings                       (browser)
    main.js             boot and the frame loop                      (browser)
  tests/                node:test suites for the pure modules
```

The pure modules have no DOM code, so the tests load them the same way the page does (one shared global scope). See `tests/load.js`.

## Test

```bash
cd snake2
node --test tests/*.test.js
```

The suites cover the numeral maths (1–2021 round trips, the length table, no zero), angles and trails, body growth and collapse (the body settles to the numeral), turning at a limited rate, every collision case (wall, body, self with the neck exempt, head-on), bot behaviour, and random play for thousands of steps.

## Change things

| To change | Edit |
|---|---|
| Speed, turn rate, head and body size, symbol spacing, neck, snack reach, board size, rival limits, respawn time | `js/config.js` → `CFG2` |
| Snack odds | `js/config.js` → `SNACK_SETS` |
| Symbol colours | `js/config.js` → `SYMBOL_COLOURS` |
| How numerals grow and collapse | `js/snake.js` → `setValue()`, `growBody()` |
| Who crashes | `js/rules.js` → `resolveTick()`, `bodyHit()` |
| Bot behaviour | `js/bots.js` → `botChooseAim()` |
| Stick, taps, swipes, keys | `js/input.js` → `installInput()` |
| Look | `js/render.js` and `css/snake2.css` |

## Notes

- **Music** is shared with the main game (`../js/music.js`, `../music/`). Its mute setting is stored under the same key, so muting in Snake II also mutes Felix's Snake Cubes.
- **Saved data** uses the `snake2.settings` localStorage key only. Earlier builds also kept best scores under `snake2.best.*`; FreePlay no longer reads or writes them.
- **Multiplayer** is not part of Snake II.
