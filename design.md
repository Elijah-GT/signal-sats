# Relay: Game Design (working title)

A daily satellite puzzle for Reddit's Game of the Day Hackathon (deadline **Dec 8, 2026**).

**One-line pitch:** A broken transmission comes in from deep space. Each day you aim satellite reflectors to route the signal down to Earth. Each satellite it passes through scrambles or unscrambles the text, and only the right route turns noise into a word. Every solve also earns a fragment of a week-long message the whole subreddit decodes together.

**Two layers**
| Layer | Cadence | Who | Payoff |
|---|---|---|---|
| **Relay** (daily puzzle) | New puzzle every day | Solo | Decode today's word, keep your streak, earn a fragment |
| **The Signal** (weekly message) | One message per week (Mon–Sun) | Whole subreddit | Fragments combine into a shared message. Guess it first for rank and flair |

---

## 1. The daily puzzle

### Board
- **Grid:** 5 wide × 6 tall, sized for a phone held upright.
- **Signal source:** a fixed point on the top edge where the transmission enters.
- **Earth (the receiver):** the **whole bottom edge**. Any beam that comes down onto Earth delivers its text, and a beam that leaves through the top or sides is lost in space. *(Changed in Phase 2: with a single dish point, almost every board had only one route that reached it, so players could find the answer by steering without decoding anything. With all of Earth as the target there are several routes, each delivering different text, and only one spells a real word.)*
- **Satellites:** 3–7 per puzzle. Each has a reflector with two angles, `/` and `\`. Tapping a satellite flips its angle.
- **Debris:** blocked cells. A beam that hits debris or leaves the grid is lost.
- The beam moves in straight lines and turns 90° at each satellite it hits. **The beam's path is always drawn live**, so routing is visible and never a guess.

### Cipher operations
Each satellite applies one operation to the text, shown by an icon on the satellite. A 5-letter string passes through each satellite on the path in order.

| Op | Icon idea | Effect on `ORBIT` |
|---|---|---|
| **Reverse** | ⇄ | `TIBRO` |
| **Swap** (swap adjacent pairs) | ⤨ | `ROIBT` (swaps letters 1↔2 and 3↔4) |
| **Rotate** (first letter to end) | ↻ | `RBITO` |
| **Shift +n** (Caesar shift) | +1, +2 | `PSCJU` (for +1) |
| **Mirror** (A↔Z, B↔Y…) | ◐ | `LIYRG` |

The order of operations matters. Reverse and Swap give different results depending on which comes first, and that's where the puzzle depth comes from. **Shift** and **Mirror** are hard to work out in your head, so they only appear later in the week. Tapping a satellite's icon shows a small example, such as `ABCDE → BCDEA`.

### Decoding loop: three transmissions
- The beam path is live, but **the decoded text only shows when you press _Transmit_**. This makes it a reasoning puzzle instead of tapping until something works.
- You get **3 scored transmissions**. Each one shows the text that reached the receiver, plus a step-by-step trace of how each satellite on the path changed it.
- Solving on transmission 1, 2 or 3 is your score (shared as 🛰️ marks, Wordle-style).
- After 3 misses you can keep going unscored. A late solve still earns a smaller fragment, so everyone contributes.

> **Playtest question:** If testers find three tries too punishing, switch to a live decode preview scored by taps against par. The engine supports both, so it's a one-flag change.

### Difficulty across the week
| Day | Satellites | Ops in play | Notes |
|---|---|---|---|
| Mon | 3 | Reverse, Rotate | Gentle start |
| Tue–Wed | 4–5 | + Swap | Order starts to matter |
| Thu–Fri | 5–6 | + Shift | Some satellites are decoys |
| Sat–Sun | 6–7 | + Mirror, debris | Hardest boards |

### Generator and solver (offline script)
- Puzzles are **pre-generated and hand-picked**, then stored as JSON. Nothing is generated at runtime, which keeps it predictable and testable.
- The solver checks **every reflector setting**. Seven satellites have only 2⁷ = 128 settings, so this is instant. It traces the beam and records the text that reaches the receiver.
- A puzzle is accepted only when:
  1. Exactly **one** dictionary word is reachable, and it's the target.
  2. The starting setting is at least a set number of taps from any solution.
  3. It matches the day's difficulty band: satellite count, operations, debris, decoys off the route, and a **minimum number of distinct routes to Earth** (2 on Monday, 4 at the weekend), so trying every route isn't enough.
  4. Every satellite on the route visibly changes the text, and no two in a row cancel out (such as Reverse then Reverse).
  5. No route ever shows an offensive word, even part-way through.
- **Routes always pass through an even number of satellites.** The beam enters heading down and leaves heading down, and each reflector turns it 90°.
- Each day's target word is chosen as a **hint for that week's Signal message**.
- **How to use it:** write `content/weeks/<id>.json` (start Monday, message, 7 words), run `npm run puzzles:generate -- content/weeks/<id>.json`, then `npm run puzzles:preview` and open `content/preview.html` to check the boards by eye.

---

## 2. The Signal (weekly community layer)

- Each week has one original message of about 30–45 characters, such as a short radio log entry from a fictional probe.
- **Fragments:** each solve reveals a few characters of the message: 3 for solving on the first transmission, 2 on the second, 1 on the third or later. Positions are chosen per player, favoring ones nobody has revealed yet, so the community uncovers the message faster together.
- **Signal Board:** a shared view of the message with every revealed character filled in. Your own contributions are highlighted, along with a count of how many people helped decode it.
- **Guessing:** one guess per player per day. Correct guessers are ranked by when they solved it, and the early ones get flair such as `📡 Decoder · Wk 47`.
- **End of week:** the full message is revealed on Sunday, with a recap of the top decoders and how many people contributed.
- **Must work with one player.** Judges will likely play alone, so the dish also reveals about 1/7 of the message each day by itself. Combined with the daily word hints, the message can be solved solo by the end of the week.

---

## 3. Screens and flow

1. **Feed card / start screen:** game name, `Transmission #23 · Day 3/7`, today's decode rate (e.g. "61% decoded"), a weekly progress bar, and a **Play** button. Nothing else.
2. **Puzzle:** the board, the decoded-text readout at the receiver, three transmission markers, and a **Transmit** button. Secondary actions stay hidden during play.
3. **Result card (one screen):** today's word, transmissions used, streak 🔥, the new fragment flying into the Signal Board, and two buttons: **View the Signal** and **Share**.
4. **Signal Board:** the shared message, your fragments, and the daily guess box.

**First-time onboarding:** the first board a new player sees is a one-satellite puzzle with an arrow hint, "Tap to aim," then Transmit. A second board introduces a second satellite. Any further help appears in context; there's no wall of instructions.

**Share text (copy, or post as a comment if Devvit allows):**
```
Relay #23 📡 2/3
🛰️🛰️⬛
🔥 5-day streak · Signal 64% decoded
```

---

## 4. Reddit integration

| Feature | Use |
|---|---|
| **Scheduled job** | Posts the day's puzzle automatically at 00:00 UTC, and the Signal recap on Sundays |
| **Redis** | Per-player state, streaks, fragments, the shared Signal Board, and the guess leaderboard |
| **User flair** | Weekly decoder rank and streak tiers |
| **Comments** | Share results; the daily post becomes the discussion thread for theories about the weekly message |
| **Journeys** | Events: `puzzle_start`, `transmit`, `solve`, `fragment_earned`, `signal_guess`, `streak_extended` |

> Check in the Devvit docs: the exact Journeys API, and whether the app can post a comment on the player's behalf.

---

## 5. Look and feel
- A mission-control look: deep navy sky, faint orbit arcs, an amber or teal beam with a glow, and a monospace readout.
- The text visibly changes letter by letter as it moves along the beam. **This is the signature moment**, so it's worth most of the polish time.
- Space theme, not a shooter. No Reddit mascots or karma jokes.
- Accessibility: high contrast, satellites identified by icon and color together, and nothing that depends on color alone.

## 6. Tech
- **Devvit Web + React + SVG** for the board. SVG keeps it crisp, makes the beam easy to animate, and needs no game engine.
- **Puzzle engine in pure TypeScript** (grid, beam tracing, cipher ops) with unit tests. The app and the offline generator share it.

## 7. Plan to Dec 8
| Dates | Milestone |
|---|---|
| Nov 12–18 | Engine (beam tracing, ops) with tests. Generator and solver script. Playable prototype in the browser |
| Nov 19–25 | Devvit app: Redis state, daily scheduled post, transmit flow, result card, streaks. Upload and playtest |
| Nov 26–Dec 2 | Signal Board, fragments, guessing, flair, Journeys. Onboarding and visual polish |
| Dec 3–8 | Content (2+ weeks of puzzles and messages), demo subreddit and posts, outside playtesting, submission. Keep 2 days spare |

## 8. Open questions
- **Name:** "Relay" is a working title. Alternatives: Uplink, Skywire, Bounce, Deep Relay.
- Three transmissions vs. live decode (decide after playtesting).
- Story: who the fictional probe is and why it's broadcasting.
