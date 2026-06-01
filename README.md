# Dino Egg Pop — Bubble Shooter (HTML5)

A juicy **bubble-shooter** ("bắn trứng khủng long") built in pure HTML5 + Canvas. Aim, shoot and match **3+ same-colour dino eggs** to pop them; eggs cut off from the ceiling drop for bonus. No build step, no bundler — deploys straight to GitHub Pages.

> Drag to aim, release to fire an egg up into the nest. Match 3+ of a colour to pop. Don't let the eggs cross the danger line.

This game **reuses the engine** from its sibling [Suika Merge](https://github.com/QuangLe1997/suika-merge) — the scene manager, WebAudio SFX/music, particle/popup/shake/coin-fly effects, economy, achievements, daily challenge, themes and PWA shell are shared. Only the gameplay core (grid, aiming, matching) is new.

## ▶ Play it

**Live:** <https://quangle1997.github.io/dino-egg-shooter/>

Installable as a PWA (Add to Home Screen) and playable offline after first load.

## ✨ Features

**Core gameplay**
- Classic **bubble shooter** on a hex/offset grid, rendered on Canvas 2D
- **Drag-to-aim** with a dashed trajectory that bounces off the walls + a landing ghost
- **Match 3+** same-colour eggs → they pop (bigger clusters score more, with a juicy pitch ladder)
- **Floating-cluster drop** — eggs no longer connected to the ceiling fall for bonus points
- **Row feed** — a new row descends every few shots; clear the whole board for a big bonus and a fresh wave
- Lose when an egg crosses the **danger line**

**Eggs are procedural** — drawn on the canvas (shell gradient + speckles + gloss), no image assets, so colours/skins are trivial to tweak in [`src/config/eggs.js`](src/config/eggs.js).

**Difficulty & balance**
- 3 modes (Easy / Normal / Hard) change starting rows, colour count, feed rate and danger line
- Feed speeds up as you level up; mindless shooting fills the board and loses — aiming matters

**Boosters** (shared economy)
- 🌈 **Rainbow egg** — the current egg matches any colour it touches
- 💣 **Bomb egg** — explodes a radius on impact
- ⬆️ **Push back** — clears the lowest (most dangerous) row

**Juice & systems**
- Merge "wow": shockwave ring + flash + sparkle burst (object pooled)
- Screen shake, floating score popups, coin-fly-to-wallet animation
- Per-level **themes** (Ocean / Aurora / Twilight / Sunset) — background + accent cross-fade as you climb
- WebAudio synthesized SFX + ambient music (no audio files)
- Coin economy + 7-day Daily Reward, **Achievements**, local **Leaderboard** (per mode), **Daily Challenge**
- First-run onboarding, settings (Music / SFX / Vibration), revive-on-game-over (mock rewarded ad)
- **PWA** — installable, offline, network-first service worker so deploys land instantly

## 📁 Project layout

```
.
├── index.html              # entry: Fredoka font, PWA + OG meta, HUD/dialogs
├── style.css               # all UI styling (portrait stage, HUD, dialogs, themed menu)
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # service worker (network-first HTML/JS/CSS, cache-first images)
└── src/
    ├── main.js             # bootstrap, canvas resize, RAF loop, SW registration
    ├── config/
    │   ├── eggs.js         # egg colours + grid geometry + shot speed
    │   ├── themes.js       # 4 themes, level thresholds, theme-per-level
    │   └── constants.js    # play area, difficulty modes, daily rewards, storage keys
    ├── managers/
    │   ├── SceneManager.js · AssetManager.js · AudioManager.js
    │   ├── AdManager.js · SaveManager.js · EconomyManager.js · ProgressManager.js
    ├── scenes/
    │   ├── MenuScene.js
    │   ├── GameScene.js    # the bubble-shooter: grid, aim, fire, snap, match, floaters, feed
    │   ├── GameOverScene.js
    │   └── DailyScene.js
    └── effects/
        ├── Particles.js · CoinFly.js · Popups.js · ScreenShake.js

assets/
├── images/   # 4 theme backgrounds (.webp) + coin.png   (eggs are drawn, not images)
├── icons/    # PWA icons
└── og-card.jpg
```

## 🚀 Run locally

ES modules need an HTTP origin (not `file://`):

```bash
python3 -m http.server 8000   # or: npx serve .
```

Then open <http://localhost:8000>. (The service worker auto-disables on `localhost`.)

## 🌐 Deploy to GitHub Pages

Deploys directly from `main` / root, no build step:
1. Push to `main`
2. **Settings → Pages → Source: `main` / `(root)`**
3. Live at `https://<user>.github.io/<repo>/`

> If you fork/rename, update the absolute `og:image` / `og:url` URLs in `index.html`.

## 🎮 Controls

| Action | Input |
|---|---|
| Aim | Drag (mouse / finger) anywhere over the play area |
| Shoot | Release |
| Booster | Tap 🌈 / 💣 / ⬆️ in the bottom bar |
| Pause | Top-right pause button |

## 🧩 Tuning

- [`src/config/eggs.js`](src/config/eggs.js) — `EGG_COLORS`, `GRID` (cols/spacing/radius), `SHOT_SPEED`
- [`src/config/constants.js`](src/config/constants.js) — `DIFFICULTY` (startRows, rowEveryShots, colors, dangerY, coinReward)
- [`src/config/themes.js`](src/config/themes.js) — `THEMES`, `LEVEL_THRESHOLDS`

## 🎨 Art note

Eggs and effects are fully procedural. The PWA icons / OG share card are currently placeholders carried over from the sibling project — regenerate them for a dino-themed brand.

## 📜 License

MIT.
