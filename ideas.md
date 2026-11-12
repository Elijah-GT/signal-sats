# Reddit Game of the Day Hackathon: Ideas

**Event:** https://redditgameofday2026.devpost.com/
**Dates:** Nov 11 – Dec 8, 2026
**Platform:** Devvit Web (Interactive Posts)
**Judging:** Delightful UX · Polish · Reddit-y · Daily Content
**Avoid:** space shooters, simple platformers, trivia, collaborative storytelling, clones, on-the-nose Reddit theming, generic "AI slop" UI

---

## Community-driven ideas

### 1. Commons
- **Daily loop:** The subreddit shares a fish stock. Each day every player chooses how much to catch. If the total catch is more than the stock can regrow, tomorrow's stock shrinks for everyone.
- **Why it fits:** One shared world that changes every day. Comments fill with "who overfished?" arguments, and flair can mark sustainable fishers and greedy ones.
- **Risk:** Balancing it at different player counts. It needs a scaling formula.

### 2. Lowest Unique
- **Daily loop:** Pick a number from 1 to 100. Whoever picks the lowest number nobody else chose wins the day, and results appear at midnight.
- **Why it fits:** A mind game against the crowd, and people come back the next day to see what happened. Very quick to build.
- **Risk:** Thin by itself. Rotating twists ("today only primes count") would add variety.

### 3. Rare Words
- **Daily loop:** Everyone gets the same 9 letters. Each word scores higher the fewer other players found it.
- **Why it fits:** A normal word game becomes a guess about what everyone else will find. Scores keep changing during the day.
- **Risk:** Close to existing word games, but the crowd scoring sets it apart.

### 4. Fogbound
- **Daily loop:** A new island hidden under fog each day. Every player clears 3 tiles that everyone can see, so the community maps the island together. Each player also secretly marks where they think the treasure is.
- **Why it fits:** Players work together on the map and compete on the guess. Late players have more information but fewer points left to win.
- **Risk:** Shared real-time state means more backend work.

### 5. Median
- **Daily loop:** A daily question ("How many hours of sleep is enough?"). Place a pin on a scale and score by how close you land to the crowd's median.
- **Why it fits:** The questions come from the community, and the results start discussions.
- **Risk:** Close to trivia. Scoring on prediction instead of facts is what separates it.

## Single-player puzzles

### 6. Heist
- **Daily loop:** A small grid with guards on visible patrol routes. Plan a route that grabs the loot in the fewest moves.
- **Why it fits:** The best routes get shared in comments under spoiler tags. Easy to learn, with real depth.
- **Risk:** Designing levels takes time. Needs a generator plus a solver to check each level can be solved.

### 7. Overlay
- **Daily loop:** Stack and rotate 3–4 see-through tiles so they match a target silhouette.
- **Why it fits:** Strong visual identity, satisfying "aha" moments, and a share card in emoji grids.
- **Risk:** Needs good art direction to avoid looking generic.

### 8. Tremor
- **Daily loop:** A hidden building collapses in a set order. Seismograph-style clues help you place supports to keep the most floors standing.
- **Why it fits:** Unusual theme with clear deduction.
- **Risk:** Novel idea, so it may need more playtesting to make clear.

**Earlier picks:** Commons (most original), Rare Words (low risk), Lowest Unique (small scope, room for polish).

---

## Satellite direction (current favorite)

Core idea: use satellites to receive and decode a message.

### A. Downlink: pass scheduling
- **Daily loop:** Satellites cross the sky on visible orbits, and each one carries part of the message. You have one ground dish and a limited time window. Each satellite is only in range for part of its orbit, so you choose which pass to listen to at each step. Reconstruct the phrase using as few passes as possible.
- **Note:** Fragments overlap and partly reveal letters, so the challenge is planning which passes to take plus deducing the missing letters.

### B. Triangulate: find the transmitter
- **Daily loop:** A hidden transmitter is somewhere on a map. Each satellite you place shows a ring for its distance to the signal. With a limited number of satellites, pinpoint the source; where it sits reveals the message.

### C. Relay: route the signal and decode it
- **Daily loop:** Rotate satellite dishes so a signal beam bounces from deep space down to Earth. Each satellite it passes through changes the text with a simple cipher step (shift, reverse, swap pairs). Only the right route turns the noise into a readable message.
- **Note:** The route you choose is the decoding, which ties the two puzzles together.

### D. The Signal: community decode over a week
- **Weekly arc:** One long transmission from deep space. Each day each player wins a few characters through their daily puzzle (A or C), and different players get different pieces. The community combines its pieces to work out the message, and the players who solve it get flair.
- **Why it fits:** Very Reddit-y: shared purpose, discussion in the comments, and a weekly payoff on top of the daily loop.

**Chosen (2026-11-12):** C + D. Relay is the daily puzzle and The Signal is the weekly community layer. See [design.md](design.md).
