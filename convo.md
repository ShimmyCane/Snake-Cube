# Snake Cubes — design conversation

Running log of feature requests and open questions. Nothing here is implemented yet.
Status key: **open** = waiting on answers · **agreed** = decided, ready to build · **done**

---

## 1. Difficulty: growth pacing

**Request:** Once the player's snake is 8× or more larger than the board, the game gets boring. Give other snakes (and snacks) faster growth so the player keeps getting fed, which makes reaching a higher score more fun. Options mentioned: raise snack weight, or lower spawn rate and raise spawn difficulty.

**Status:** open

**Questions**
- "8× larger than the board" — do you mean the snake's *length* compared to the board size, or its *head value* (e.g. 2048-style value) compared to the largest value on the board? These need different triggers.
- Which lever do you prefer: (a) snacks worth more (bigger `val` per snack), (b) more snacks spawn, or (c) fewer but higher-value snacks spawn? Or a mix?
- Should this apply only to the player's surroundings, or to bots too? Feeding bots faster would let them catch up to the player, which could make the late game harder as well as more fun.
- Should it kick in gradually (e.g. ramps up after the 8× point) or switch on at a fixed threshold?

---

## 2. Dad's mode: buildings appear left/right flipped

**Request:** The mapped buildings look mirrored. Flip them so they sit in the right places on the satellite image.

**Status:** open

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

**Status:** open

**Questions**
- Difficulty: should it be a single toggle that applies to whichever mode you pick, or does each mode remember its own setting?
- Should the "Others" button be hidden entirely while multiplayer is broken, or shown greyed out with "coming soon"?
- Do you want the current BEGINNER / EXPERT wording kept, or renamed (e.g. Easy / Hard)? Also, the "DAD'S MODE (HARD)" button currently exists separately — does it fold into the difficulty toggle?
- Do the Athena and Dad environments still need their own rules (Athena's shrinking boundary, Dad's buildings and roads), with Felix as the plain arena?

---

## 4. Round time by mode and difficulty

**Request:** Lower the default round time to **3 minutes**. For other modes and harder games, increase in **2-minute** steps.

**Status:** open

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

**Status:** open

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
