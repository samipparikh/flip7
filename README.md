# FLIP 7

A press-your-luck card game for 2-20 players. Play locally, online, or use companion mode to track a real card game.

**Play now:** https://samipparikh.github.io/flip7/

## How to Play

Flip cards one at a time from a shared deck. If you flip a number you already have — you bust and score 0 for the round. Stop early to bank your points. First to 200 wins.

### The Deck

- **Number cards:** 1-12 (quantity matches the number — one 1, two 2s, three 3s, etc.)
- **Special cards:** +2, +4, +6, +8, +10, x2, Second Chance, Freeze, Flip 3

### Special Cards

| Card | Effect |
|------|--------|
| +2/+4/+6/+8/+10 | Adds bonus points to your score |
| x2 | Doubles your total score for the round |
| Second Chance | Saves you from one bust (discards the duplicate) |
| Freeze | Forces another player to stop and bank their current points |
| Flip 3 | Draw 3 cards for any active player |

### 7-Card Bonus

Collect 7 number cards without busting to earn a +15 point bonus.

## Game Modes

- **Local Game** — Pass and play on one device
- **Play Online** — Create or join a room with a 5-letter code (Firebase)
- **Companion Mode** — Full game management for playing with physical cards (deck tracking, bust detection, special card effects)
- **Score Tracker** — Simple manual score entry per round

## Deck Settings

Customize the count of each special card from the main menu before starting a game.

## Tech Stack

- Vanilla HTML/CSS/JS (no framework)
- Firebase Realtime Database (online multiplayer)
- GitHub Pages (hosting)

## Run Locally

Open `index.html` in a browser. No build step needed.

For online multiplayer, you'll need your own Firebase project — update `firebase-config.js` with your credentials.
