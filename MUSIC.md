# Music

Which tracks the game plays. The source of truth is `CFG_AUDIO.PLAYLIST` in `js/config.js`. Files live in `music/`.

Playback: the playlist shuffles on each load (`AUTO_SHUFFLE`), at volume `0.55`. Tracks advance on end or error, so a missing file is skipped.

## Tracks in use

| File | In playlist | Piece / composer | Notes |
|---|---|---|---|
| `felix_piano_1.mp4` | yes | — | |
| `ying_piano_1.mp4` | yes | — | |
| `athena_piano_1.mp4` | yes | — | |
| `athena_piano_2.mp4` | yes | — | |

Fill in the piece and composer columns when known.

## Removed

| File | Removed in | Reason |
|---|---|---|
| `athena_piano_3.mp4` | v4.0.0 | Listed in the playlist, but the file was not in `music/`. |

## Adding a track

1. Copy the `.mp4` into `music/`.
2. Add its filename to `PLAYLIST` in `js/config.js`.
3. Add a row to the table above.
