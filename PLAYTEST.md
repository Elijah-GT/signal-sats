# Signal Sats: Playtest Guide (Phase 3)

**Goal:** find out whether the puzzle is fun and learnable, and settle three decisions before the real Reddit app is built.

1. **Scoring mode:** *3 transmissions* (text only revealed when you transmit, 3 scored tries) or *Live decode* (text at Earth updates as you tap, scored by taps).
2. **Difficulty curve:** is Monday easy enough, and is Sunday hard but fair?
3. **The operations:** do people understand the satellite symbols from the legend alone?

---

## Running it

On your computer, in `reddit-game-of-day/app`:

```
npm run prototype
```

Then open **http://localhost:5174**. It works on a phone-sized window too.

- **Testers on the same Wi-Fi:** run `npm run prototype -- --host` and give them the network address it prints, such as `http://192.168.x.x:5174`.
- **Testers elsewhere:** use the hosted link, **https://claude.ai/artifact/Gk53TAawAoEcSRKmynn4b1**. It's private until you share it from the page's **Share** menu. After changing the prototype, rebuild it with `npm run prototype:artifact` and ask Claude to republish it to the same link.
- The toolbar at the top switches the **puzzle** (one per weekday) and the **mode**, and has **Restart** and **Give up** buttons. The toolbar isn't part of the real game.

---

## Each session (about 15 minutes per person)

**Say only:** "A signal is coming in from space. Decode it." Don't explain the rules, symbols or scoring. How far people get on their own *is* the test.

Alternate the starting mode between testers so neither mode always gets the fresh, unpractised player:

| Order | Tester A | Tester B |
|---|---|---|
| 1 | Monday · 3 transmissions | Monday · Live decode |
| 2 | Wednesday · 3 transmissions | Wednesday · Live decode |
| 3 | Friday · Live decode | Friday · 3 transmissions |
| 4 | Sunday · Live decode | Sunday · 3 transmissions |

**Watch for, and note down:**
- **First 30 seconds:** do they find tapping on their own? Do they understand that the beam has to reach Earth?
- **Operations:** do they read the "What the satellites do" panel? Do they predict the text before transmitting, or just try routes?
- **Moments of confusion:** what they say out loud, and where they hesitate.
- **Frustration** when they miss in 3-transmission mode: is it "ugh, one more try" or "this is unfair"?
- **After solving:** do they ask to play another one?

**Ask afterwards:**
1. Which mode did you enjoy more, and why?
2. Was there a moment you felt clever? A moment you felt stuck?
3. What did ⇄, ⤨, ↻, +n and ◐ mean to you before you read the panel?
4. Would you come back tomorrow for a new one?
5. Anything that looked broken or confusing?

**Collect the numbers:** at the bottom of the page, tap **Copy results** and paste the result into your notes. It lists the day, mode, whether they solved it, which try solved it, taps and seconds. Then tap **Clear** before the next tester.

---

## Deciding

| Question | Good sign | Change to make if not |
|---|---|---|
| Is it learnable? | Most testers solve **Monday within 3 minutes** without help | Add a guided first puzzle; reword the hint and status lines |
| Which scoring mode? | Most testers prefer it, *and* Friday/Sunday solve rate is at least half | If 3 transmissions feels punishing, switch to Live decode (one setting) |
| Is the curve right? | Monday under 3 min, Sunday under 10 min, few give-ups | Adjust the weekday rules in `scripts/lib/bands.ts` (routes, decoys, operations) and regenerate |
| Is it replayable? | People ask to play another | Revisit the core loop before Phase 4 |

Bring the notes and pasted results back to Claude, which will turn them into changes before Phase 4.
