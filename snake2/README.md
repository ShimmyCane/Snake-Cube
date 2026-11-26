# Snake II — Roman numeral snake

A snake that is a number. Its body is the number written in Roman numerals, one symbol per step along the body. Eat coins to count up. When the body would spell something Romans wouldn't write, it collapses: `III + I → IV`, and the body shortens.

Movement is smooth and free: no grid, any direction, including diagonals. The world has no border: it goes on in every direction, and the camera follows you. The design history is in [`schematic_snake2.md`](schematic_snake2.md). This README covers running and testing it.

## Run it

Serve the repo root over http (not `file://`), so `../music/` and `../js/music.js` load:

```bash
npx serve .            # or: python3 -m http.server 8000
# open http://localhost:8000/snake2/
```

## Play

| | |
|---|---|
| Aim | Push the stick in the lower-left corner in any direction. Or tap the board: Felix aims toward the tap, measured from the middle of the screen. Or swipe. Or hold arrow keys / WASD (two keys together aim diagonally). Felix turns at once to the direction you aim, with no easing. |
| Pause | P or Esc, or the II button. Leaving the tab also pauses. |
| Goal | None. FreePlay has no timer and no grade: keep going as long as you like. The run ends only when you have no symbols left. |
| Crash | Your head touching an artifact (a stone column or a clay amphora), or a head-on with a bigger snake, costs you one or two symbols from the head end. The lost symbols fall as coins, the head moves back onto the first symbol left, and the numeral drops with them. Crashes do not end the run. When no symbol is left, you break apart in a small explosion and the game ends. A crash gives a short grace, so one crash is not counted twice. |
| Bump | Your head touching another snake's body cuts that body at the contact. The pieces past the cut fall away as coins, and you survive. Your own body never hurts you. |
| Eating | You eat snacks from a tenth of your size up, and at least I. A C eats V and up; an M eats L and up. |
| Rivals | Three by default, 1 to 10 in settings. Bump them to take their pieces, or crash a smaller one into your head to eat it. Any snake that dies breaks apart into coins worth its symbols. A bot comes back after 3 s. |
| Numbers | Roman numerals, with no largest. Past MMMCMXCIX they go on with overlines: a bar multiplies a letter by a thousand, so IV̅ is 4000 and M̅ is a million. |

## Layout

```
snake2/
  index.html            page skeleton and screens
  css/snake2.css        cartoon style, masonry stones
  js/
    config.js           CFG2, SNACK_SETS, colours, names
    roman.js            toRoman, fromRoman, romanLength, popLabel   (pure)
    geom.js             angles, distances, trails                    (pure)
    arena.js            endless world: artifacts per cell, random    (pure)
    snake.js            snake model: body length, turning, moving    (pure)
    rules.js            who crashes each step                        (pure)
    bots.js             bot aim: clearance and snacks                (pure)
    game.js             game state, one step, snacks, crashes, bots  (pure)
    camera.js           follow camera (no edge)                      (browser)
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

The suites cover the numeral maths (round trips past 20000, overlines, the length table, no zero), angles and trails, body growth and collapse (the body settles to the numeral), turning at a limited rate, the collision rules (artifact, head-on by size, bump, own body harmless, no edge), the crash penalty (one or two symbols, head pulled back, grace), the snack threshold, bot behaviour, and random play for thousands of steps.

## Change things

| To change | Edit |
|---|---|
| Speed, head and body size, symbol spacing, neck, snack reach, artifact density and safe zone, crash penalty and grace, rival limits, respawn time | `js/config.js` → `CFG2` |
| Snack odds | `js/config.js` → `SNACK_SETS` |
| Symbol colours | `js/config.js` → `SYMBOL_COLOURS` |
| How numerals grow and collapse | `js/snake.js` → `setValue()`, `growBody()` |
| Who crashes | `js/rules.js` → `resolveTick()`, `bodyContact()` |
| Crash penalty (symbols lost, grace) | `js/game.js` → `crashPenalty()` |
| Artifacts (kinds, where they sit) | `js/arena.js` → `ARTIFACT_KINDS`, `artifactsInCell()` |
| Numerals past 3999 | `js/roman.js` → `numeralTokens()` |
| Bot behaviour | `js/bots.js` → `botChooseAim()` |
| Stick, taps, swipes, keys | `js/input.js` → `installInput()` |
| Look | `js/render.js` and `css/snake2.css` |

## Notes

- **Music** is shared with the main game (`../js/music.js`, `../music/`). Its mute setting is stored under the same key, so muting in Snake II also mutes Felix's Snake Cubes.
- **Saved data** uses the `snake2.settings` localStorage key only. Earlier builds also kept best scores under `snake2.best.*`; FreePlay no longer reads or writes them.
- **Multiplayer** is not part of Snake II.
