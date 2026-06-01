// GameScene — Dino Egg Pop (bubble shooter).
// Aim with drag, release to fire an egg up into a hex grid. 3+ same-colour eggs
// touching → they pop. Eggs no longer connected to the ceiling drop for bonus.
// A new row descends every few shots; lose if an egg crosses the danger line.

import { PLAY_AREA, DIFFICULTY } from '../config/constants.js';
import { EGG_COLORS, GRID, SHOT_MIN, SHOT_MAX } from '../config/eggs.js';
import { levelForScore, themeForLevel, nextThreshold } from '../config/themes.js';
import { ParticleSystem } from '../effects/Particles.js';
import { PopupSystem } from '../effects/Popups.js';
import { ScreenShake } from '../effects/ScreenShake.js';
import { CoinFly } from '../effects/CoinFly.js';
import { AudioManager } from '../managers/AudioManager.js';
import { SaveManager } from '../managers/SaveManager.js';
import { EconomyManager } from '../managers/EconomyManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { ProgressManager } from '../managers/ProgressManager.js';

const AUTO_FIRE_SEC = 5; // auto-shoot if the player idles this long (tightens per level)

export class GameScene {
  constructor() {
    this.canvas = document.getElementById('game');
    this.hudEl = document.getElementById('hud');
    this.pauseEl = document.getElementById('pause');
    this.scoreEl = document.getElementById('hudScore');
    this.levelEl = document.getElementById('hudLevel');
    this.levelFillEl = document.getElementById('hudLevelFill');
    this.bestEl = document.getElementById('hudBest');
    this.walletEl = document.getElementById('hudWallet');
    this.walletCountEl = document.getElementById('hudWalletCount');
    this.nextEl = document.getElementById('hudNext');
    this.levelBanner = document.getElementById('levelBanner');
    this.comboBanner = document.getElementById('comboBanner');
    this.hammerEl = document.getElementById('boostHammer');
    this.bombEl = document.getElementById('boostBomb');
    this.freezeEl = document.getElementById('boostFreeze');
    this.optMusic = document.getElementById('optMusic');
    this.optSfx = document.getElementById('optSfx');
    this.optVibe = document.getElementById('optVibe');

    this.particles = new ParticleSystem();
    this.popups = new PopupSystem();
    this.shake = new ScreenShake();
    this.coinFly = new CoinFly();
    this._spotCache = new Map();

    // pause / settings
    document.getElementById('btnPause').addEventListener('click', () => {
      AudioManager.playClick();
      this.paused ? this.resume() : this.pause();
    });
    document.getElementById('btnResume').addEventListener('click', () => { AudioManager.playClick(); this.resume(); });
    document.getElementById('btnRestart').addEventListener('click', () => { AudioManager.playClick(); this.resume(); this._restart(); });
    document.getElementById('btnToMenu').addEventListener('click', () => { AudioManager.playClick(); this.resume(); this._mgr.switchTo('menu'); });
    [this.optMusic, this.optSfx, this.optVibe].forEach((el) => el && el.addEventListener('change', () => this._applySettings()));

    // boosters
    // power-ups: a top-left button opens a popup panel (keeps the bottom clear)
    this.boostBtn = document.getElementById('btnBoosters');
    this.boostPanel = document.getElementById('boosterPanel');
    this.boostTotalEl = document.getElementById('boostTotal');
    this.boostBtn.addEventListener('click', (e) => { e.stopPropagation(); AudioManager.playClick(); this._toggleBoostPanel(); });

    this.boosterBtns = [...document.querySelectorAll('.booster-btn')];
    this.boosterBtns.forEach((btn) => btn.addEventListener('click', () => this._useBooster(btn.dataset.booster)));

    this.anchor = { x: PLAY_AREA.width / 2, y: 592 }; // slingshot pouch rest point
    this.maxPull = 70;   // bigger draw now the bottom bar is gone
    this.minPull = 14;   // below this on release = no shot (snaps back)
    this._setupInput();
  }

  // ---------- lifecycle ----------
  enter() {
    this.hudEl.classList.remove('hidden');
    this._closeBoostPanel();
    this._loadSettingsIntoUI();
    this._initNewGame();
    AudioManager.resume();
    AudioManager.startMusic();
  }

  exit() {
    this.hudEl.classList.add('hidden');
    this.pauseEl.classList.add('hidden');
    AudioManager.stopMusic();
  }

  _loadSettingsIntoUI() {
    const s = SaveManager.getSettings();
    this.optMusic.checked = !!s.music;
    this.optSfx.checked = !!s.sfx;
    this.optVibe.checked = !!s.vibe;
  }

  _applySettings() {
    AudioManager.setSettings({ music: this.optMusic.checked, sfx: this.optSfx.checked, vibe: this.optVibe.checked });
  }

  _initNewGame() {
    this.mode = SaveManager.getMode();
    this.diff = DIFFICULTY[this.mode] || DIFFICULTY.normal;

    // geometry
    this.cellD = GRID.cellD;
    this.eggR = GRID.R;
    this.rowH = GRID.rowH;
    this.marginX = GRID.marginX;
    this.originX = this.marginX + this.cellD / 2;
    this.originY = GRID.topY + this.eggR;
    this.colsEven = GRID.cols;
    this.colorsInPlay = this.diff.colors;
    this.deathY = this.diff.dangerY;

    // level + theme
    this.level = 1;
    this.theme = themeForLevel(1);
    this.bgImg = AssetManager.get(this.theme.bg);
    this.bgPrev = null;
    this.bgFade = 1;

    // state
    this.score = 0;
    this.combo = 0;
    this.gameOver = false;
    this.paused = false;
    this.projectile = null;
    this.pull = { x: 0, y: 0 };  // slingshot pull vector (ball offset from anchor)
    this._pullLen = 0;
    this._tension = 0;           // 0..1 → shot power
    this._wallFlash = null;      // transient wall-impact glow
    this._aiming = false;
    this._idle = 0;     // seconds since last shot / interaction (auto-fire timer)
    this._recoil = 0;   // launch kick, decays to 0
    this.activeBooster = null;
    this.curBomb = false;
    this.curRainbow = false;
    this.revivesUsed = 0;
    this._dangerNear = false;

    // grid + queue
    this.grid = new Map();
    this._fillWave(this.diff.startRows);
    this.current = this._newEgg();
    this.next = this._newEgg();
    this.shotsLeft = this._rowEvery();

    // coins / wallet
    this.runCoins = 0;
    this.walletCount = EconomyManager.coins;
    this.coinFly.clear();

    // boosters
    this.boosters = { ...EconomyManager.getBoosters() };
    Object.entries(this.diff.startingBoosters).forEach(([k, v]) => { if (!this.boosters[k]) this.boosters[k] = v; });

    // UI
    this._updateWalletUI();
    this._updateHUD();
    this._refreshBoosterUI();
    this._refreshNextPreview();
    this.bestEl.textContent = SaveManager.getHighScore(this.mode);
  }

  _restart() { this._initNewGame(); }

  // ---------- grid helpers ----------
  _colsForRow(r) { return (r & 1) ? this.colsEven - 1 : this.colsEven; }
  _inBounds(r, c) { return r >= 0 && c >= 0 && c < this._colsForRow(r); }
  _key(r, c) { return r + ',' + c; }

  _cellToWorld(r, c) {
    const off = (r & 1) ? this.cellD / 2 : 0;
    return { x: this.originX + c * this.cellD + off, y: this.originY + r * this.rowH };
  }

  _worldToCell(x, y) {
    let r = Math.round((y - this.originY) / this.rowH);
    if (r < 0) r = 0;
    const off = (r & 1) ? this.cellD / 2 : 0;
    let c = Math.round((x - this.originX - off) / this.cellD);
    const cols = this._colsForRow(r);
    if (c < 0) c = 0; if (c > cols - 1) c = cols - 1;
    return { r, c };
  }

  _neighbors(r, c) {
    const base = [[r, c - 1], [r, c + 1]];
    if (r & 1) { // odd row shifted right
      return base.concat([[r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]);
    }
    return base.concat([[r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]]);
  }

  _seed() { return (Math.random() * 100000) | 0; }
  _newEgg() { return { color: this._randColorIdx(), seed: this._seed() }; }

  _randColorIdx() {
    const n = this.colorsInPlay;
    if (this.grid && this.grid.size && Math.random() < 0.6) {
      const present = [...new Set([...this.grid.values()].map((v) => v.color))].filter((c) => c < n);
      if (present.length) return present[(Math.random() * present.length) | 0];
    }
    return (Math.random() * n) | 0;
  }

  _rowEvery() { return Math.max(3, this.diff.rowEveryShots - Math.floor((this.level - 1) / 2)); }

  _fillWave(rows) {
    for (let r = 0; r < rows; r++) {
      const cols = this._colsForRow(r);
      for (let c = 0; c < cols; c++) {
        // top rows are dense (anchor); lower rows a touch sparser for shape
        const p = r === 0 ? 0.96 : 0.82 - r * 0.04;
        if (Math.random() < p) this.grid.set(this._key(r, c), { r, c, color: (Math.random() * this.colorsInPlay) | 0, seed: this._seed() });
      }
    }
  }

  // ---------- input ----------
  _setupInput() {
    const canvas = this.canvas;
    const toPlay = (evt) => {
      const rect = canvas.getBoundingClientRect();
      const t = evt.touches ? evt.touches[0] : evt;
      return {
        x: (t.clientX - rect.left) * (PLAY_AREA.width / rect.width),
        y: (t.clientY - rect.top) * (PLAY_AREA.height / rect.height),
      };
    };
    const down = (e) => {
      if (this.paused || this.gameOver || this.projectile) return;
      // a tap anywhere closes the power-ups panel (instead of starting a shot)
      if (this.boostPanel && !this.boostPanel.classList.contains('hidden')) { this._closeBoostPanel(); return; }
      AudioManager.resume();
      e.preventDefault();
      // capture the pointer so the drag keeps tracking even over other UI
      if (e.pointerId != null && canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch {} }
      this._aiming = true;
      this._idle = 0;
      this._updatePull(toPlay(e));
      AudioManager.startStretch();
      AudioManager.updateStretch(this._tension);
    };
    const move = (e) => {
      if (!this._aiming || this.paused || this.gameOver) return;
      e.preventDefault();
      this._idle = 0;
      this._updatePull(toPlay(e));
      AudioManager.updateStretch(this._tension);
    };
    const up = (e) => {
      if (!this._aiming) return;
      this._aiming = false;
      AudioManager.stopStretch();
      if (this.paused || this.gameOver) { this._resetPull(); return; }
      if (e.cancelable) e.preventDefault();
      this._updatePull(toPlay(e));
      if (this._pullLen >= this.minPull) this._fire();
      else this._resetPull(); // too weak — snap back, no shot
    };
    canvas.addEventListener('pointerdown', down, { passive: false });
    canvas.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up, { passive: false });
    window.addEventListener('pointercancel', () => { this._aiming = false; AudioManager.stopStretch(); this._resetPull(); }, { passive: false });
  }

  // Pull the pouch toward the finger; the shot launches the OPPOSITE way (like a
  // real slingshot). The draw has RISING RESISTANCE — the band stretches quickly
  // at first, then much more slowly near full draw (force grows with stretch), so
  // the last bit of power takes a big extra finger pull. Clamped to an upward cone.
  _updatePull(p) {
    let dx = p.x - this.anchor.x;
    let dy = p.y - this.anchor.y;
    if (dy < 6) dy = 6; // must pull downward → launches upward
    let ang = Math.atan2(dy, dx);                  // pull angle, downward ∈ (0, π)
    const minAng = 0.34, maxAng = Math.PI - 0.34;  // keep the launch off the side walls
    ang = Math.max(minAng, Math.min(maxAng, ang));
    // finger may travel ~1.9× maxPull, but the ball stretch eases out (concave),
    // so it resists more the harder you pull and % climbs much slower near the top.
    const fingerRange = this.maxPull * 1.6;
    const norm = Math.min(1, Math.hypot(dx, dy) / fingerRange);
    const eased = 1 - Math.pow(1 - norm, 2.3);
    const len = eased * this.maxPull;
    this.pull = { x: Math.cos(ang) * len, y: Math.sin(ang) * len };
    this._pullLen = len;
    this._tension = Math.max(0, Math.min(1, (len - this.minPull) / (this.maxPull - this.minPull)));
  }

  _resetPull() { this.pull = { x: 0, y: 0 }; this._pullLen = 0; this._tension = 0; }

  // launch direction (unit) = opposite the pull; defaults to straight up
  _launchDir() {
    const len = this._pullLen;
    if (len < 0.01) return { x: 0, y: -1 };
    return { x: -this.pull.x / len, y: -this.pull.y / len };
  }

  _fire() {
    if (this.projectile || this.gameOver || this.paused) return false;
    const len = this._pullLen || 0;
    if (len < this.minPull) { this._resetPull(); return false; }
    const t = this._tension;
    const speed = SHOT_MIN + t * (SHOT_MAX - SHOT_MIN);
    const dir = this._launchDir();
    const a = this.anchor;
    this.projectile = {
      x: a.x, y: a.y,
      vx: dir.x * speed, vy: dir.y * speed,
      color: this.current.color, seed: this.current.seed,
      bomb: this.curBomb, rainbow: this.curRainbow,
      power: t,
    };
    // release feedback — twang scales with power, plus kick / flash / haptic
    AudioManager.playTwang(t);
    if (navigator.vibrate && SaveManager.getSettings().vibe) navigator.vibrate(Math.round(10 + t * 45));
    this._idle = 0;
    this._recoil = 8 + t * 16;
    const glow = this.curRainbow ? '#ffffff' : EGG_COLORS[this.current.color].glow;
    this.particles.flash(a.x, a.y - 6, 50 + t * 40, glow);
    this.particles.shockwave(a.x, a.y - 6, glow, 38 + t * 36, 3);
    this.shake.trigger(3 + t * 6, 0.14);
    this.curBomb = false; this.curRainbow = false;
    this.current = this.next;
    this.next = this._newEgg();
    this._resetPull();
    this._refreshNextPreview();
    return true;
  }

  _autoFireSec() { return Math.max(2.6, AUTO_FIRE_SEC - (this.level - 1) * 0.3); }

  // ---------- projectile / settle ----------
  _updateProjectile(dt) {
    const p = this.projectile;
    const steps = Math.max(1, Math.ceil((SHOT_MAX * dt) / (this.eggR * 0.5)));
    const h = dt / steps;
    const left = this.marginX + this.eggR, right = PLAY_AREA.width - this.marginX - this.eggR;
    for (let i = 0; i < steps; i++) {
      p.x += p.vx * h; p.y += p.vy * h;
      if (p.x < left) {
        p.x = left;
        // strong shots bounce lively (≈elastic); weak shots lose horizontal energy
        p.vx = Math.abs(p.vx) * (0.78 + (p.power || 0) * 0.22);
        this._wallImpact(left, p.y, p.power || 0);
      } else if (p.x > right) {
        p.x = right;
        p.vx = -Math.abs(p.vx) * (0.78 + (p.power || 0) * 0.22);
        this._wallImpact(right, p.y, p.power || 0);
      }
      if (p.y <= this.originY) { this._settle(p, null); return; }
      const hit = this._collideEgg(p.x, p.y);
      if (hit) { this._settle(p, hit); return; }
    }
  }

  // Wall-bounce feedback — scales hard with shot power so a max-pull shot slams
  // the wall (big burst, flash, shake, deep thud) while a soft shot barely ticks.
  _wallImpact(x, y, power) {
    const p = Math.max(0, Math.min(1, power));
    this._wallFlash = { x, y, t: 1, power: p };
    this.particles.burst(x, y, ['#ffffff', this.theme.accent2 || '#fff'], 2 + Math.round(p * 9));
    this.particles.flash(x, y, 16 + p * 44, `rgba(255,255,255,${0.25 + p * 0.5})`);
    this.shake.trigger(1.5 + p * 8, 0.1 + p * 0.12);
    AudioManager.playWallHit(p);
  }

  _collideEgg(x, y) {
    const rr = (this.eggR * 2 * 0.86) ** 2;
    let best = null, bd = rr;
    for (const v of this.grid.values()) {
      const w = this._cellToWorld(v.r, v.c);
      const d = (w.x - x) ** 2 + (w.y - y) ** 2;
      if (d <= bd) { bd = d; best = { r: v.r, c: v.c }; }
    }
    return best;
  }

  _placeCell(px, py, hit) {
    const cand = [];
    const seen = new Set();
    const add = (r, c) => {
      const k = this._key(r, c);
      if (seen.has(k)) return; seen.add(k);
      if (this._inBounds(r, c) && !this.grid.has(k)) cand.push({ r, c });
    };
    if (hit) for (const [r, c] of this._neighbors(hit.r, hit.c)) add(r, c);
    const rc = this._worldToCell(px, py);
    add(rc.r, rc.c);
    for (const [r, c] of this._neighbors(rc.r, rc.c)) add(r, c);
    if (!cand.length) for (let dr = -1; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) add(rc.r + dr, rc.c + dc);
    let best = null, bd = 1e18;
    for (const k of cand) {
      const w = this._cellToWorld(k.r, k.c);
      const d = (w.x - px) ** 2 + (w.y - py) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  _settle(p, hit) {
    const cell = this._placeCell(p.x, p.y, hit);
    this.projectile = null;
    if (!cell) { this._afterShot(false); return; }

    let color = p.color;
    if (p.rainbow) color = this._dominantNeighborColor(cell) ?? color;
    this.grid.set(this._key(cell.r, cell.c), { r: cell.r, c: cell.c, color, seed: p.seed });

    let scored = false;
    if (p.bomb) {
      this._bombAt(cell);
      scored = true;
    } else {
      const cluster = this._cluster(cell.r, cell.c, color);
      if (cluster.length >= 3) { this._popCluster(cluster); scored = true; }
      else {
        const w = this._cellToWorld(cell.r, cell.c);
        this.particles.drop(w.x, w.y, EGG_COLORS[color].glow);
        this.particles.shockwave(w.x, w.y, EGG_COLORS[color].glow, 32, 2);
        this.shake.trigger(3, 0.1);
        AudioManager.playThud(0.4, 2);
      }
    }
    if (this._dropFloaters() > 0) scored = true;
    this._afterShot(scored);
  }

  _dominantNeighborColor(cell) {
    const counts = {};
    let best = null, bc = 0;
    for (const [r, c] of this._neighbors(cell.r, cell.c)) {
      const v = this.grid.get(this._key(r, c));
      if (!v) continue;
      counts[v.color] = (counts[v.color] || 0) + 1;
      if (counts[v.color] > bc) { bc = counts[v.color]; best = v.color; }
    }
    return best;
  }

  _cluster(r, c, color) {
    const out = [], seen = new Set([this._key(r, c)]);
    const stack = [{ r, c }];
    while (stack.length) {
      const cur = stack.pop();
      const v = this.grid.get(this._key(cur.r, cur.c));
      if (!v || v.color !== color) continue;
      out.push(cur);
      for (const [nr, nc] of this._neighbors(cur.r, cur.c)) {
        const nk = this._key(nr, nc);
        if (seen.has(nk)) continue;
        const nv = this.grid.get(nk);
        if (nv && nv.color === color) { seen.add(nk); stack.push({ r: nr, c: nc }); }
      }
    }
    return out;
  }

  _popCluster(cluster) {
    const n = cluster.length;
    let cx = 0, cy = 0;
    for (const k of cluster) {
      const w = this._cellToWorld(k.r, k.c);
      cx += w.x; cy += w.y;
      const col = EGG_COLORS[this.grid.get(this._key(k.r, k.c)).color];
      this.particles.burst(w.x, w.y, [col.glow, col.shell, '#ffffff'], Math.min(11, n));
      this.grid.delete(this._key(k.r, k.c));
    }
    cx /= n; cy /= n;
    const mul = 1 + this.combo * 0.3;
    const pts = Math.round(n * 10 * mul + Math.max(0, n - 3) * 15);
    this.score += pts;
    this.popups.add('+' + pts, cx, cy, { color: '#ffffff', size: 22 + Math.min(16, n) });
    this.particles.shockwave(cx, cy, this.theme.accent2 || '#fff', 64 + n * 8, 5);
    this.particles.flash(cx, cy, 64 + n * 5, 'rgba(255,255,255,0.7)');
    if (n >= 4) {
      this.particles.shockwave(cx, cy, '#ffffff', 104 + n * 9, 3);
      this.particles.confetti(cx, cy, [this.theme.accent, this.theme.accent2, '#fff']);
    }
    this.shake.trigger(Math.min(22, 6 + n * 1.4), 0.3);
    AudioManager.playMerge(Math.min(11, 2 + n));
    ProgressManager.noteMerge(n);
    const coins = Math.max(1, Math.round((n / 3) * this.diff.coinReward));
    this._flyCoins(coins, cx, cy);
    ProgressManager.progressDaily('merges', 1);
    if (n >= 5) { const d = ProgressManager.progressDaily('big', 1); if (d) this._onDailyComplete(d); }
  }

  _dropFloaters() {
    const anchored = new Set();
    const stack = [];
    for (const [k, v] of this.grid) if (v.r === 0) { anchored.add(k); stack.push(v); }
    while (stack.length) {
      const cur = stack.pop();
      for (const [nr, nc] of this._neighbors(cur.r, cur.c)) {
        const nk = this._key(nr, nc);
        if (this.grid.has(nk) && !anchored.has(nk)) { anchored.add(nk); stack.push(this.grid.get(nk)); }
      }
    }
    let dropped = 0, cx = 0, cy = 0;
    for (const [k, v] of [...this.grid]) {
      if (!anchored.has(k)) {
        const w = this._cellToWorld(v.r, v.c);
        this.particles.burst(w.x, w.y, [EGG_COLORS[v.color].glow, '#ffffff'], 4);
        this.particles.confetti(w.x, w.y);
        this.grid.delete(k);
        dropped++; cx += w.x; cy += w.y;
      }
    }
    if (dropped > 0) {
      cx /= dropped; cy /= dropped;
      const pts = dropped * 25;
      this.score += pts;
      this.popups.add('DROP +' + pts, cx, cy, { color: '#ffd166', size: 24 });
      AudioManager.playReward();
      this._flyCoins(Math.max(1, Math.round((dropped / 2) * this.diff.coinReward)), cx, cy);
      ProgressManager.noteMerge(dropped);
    }
    return dropped;
  }

  _bombAt(cell) {
    const w0 = this._cellToWorld(cell.r, cell.c);
    const R = this.cellD * 1.7;
    let cnt = 0;
    for (const [k, v] of [...this.grid]) {
      const w = this._cellToWorld(v.r, v.c);
      if ((w.x - w0.x) ** 2 + (w.y - w0.y) ** 2 <= R * R) {
        this.particles.burst(w.x, w.y, [EGG_COLORS[v.color].glow, '#fff'], 6);
        this.grid.delete(k); cnt++;
      }
    }
    this.score += cnt * 12;
    this.shake.trigger(18, 0.4);
    this.particles.flash(w0.x, w0.y, 150, 'rgba(255,200,80,0.7)');
    this.particles.shockwave(w0.x, w0.y, '#ffb072', 150, 5);
    AudioManager.playGameOver();
    this.popups.add('BOOM +' + cnt * 12, w0.x, w0.y - 16, { color: '#ffb072', size: 26 });
    this._flyCoins(Math.max(1, Math.round(cnt / 3)), w0.x, w0.y);
  }

  _afterShot(scored) {
    if (scored) {
      this.combo++;
      ProgressManager.noteCombo(this.combo);
      if (this.combo >= 2) this._showCombo(this.combo);
      const d = ProgressManager.progressDaily('score', this.score, true);
      if (d) this._onDailyComplete(d);
    } else {
      this.combo = 0;
    }
    this.shotsLeft--;
    if (this.shotsLeft <= 0) { this._addRow(); this.shotsLeft = this._rowEvery(); }
    if (this.grid.size === 0) this._boardCleared();
    this._checkLevelUp();
    this._updateHUD();
    this._checkDeath();
  }

  _addRow() {
    if (this.gameOver) return;
    const ng = new Map();
    for (const [, v] of this.grid) {
      const nr = v.r + 1;
      ng.set(this._key(nr, v.c), { r: nr, c: v.c, color: v.color, seed: v.seed });
    }
    const cols = this._colsForRow(0);
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.85) ng.set(this._key(0, c), { r: 0, c, color: (Math.random() * this.colorsInPlay) | 0, seed: this._seed() });
    }
    this.grid = ng;
    this.shake.trigger(5, 0.2);
    AudioManager.playDrop();
  }

  _boardCleared() {
    this.score += 500;
    this.popups.add('NEST CLEARED +500', PLAY_AREA.width / 2, PLAY_AREA.height * 0.4, { color: '#caffbf', size: 26 });
    this.particles.confetti(PLAY_AREA.width / 2, PLAY_AREA.height * 0.4);
    this.particles.flash(PLAY_AREA.width / 2, PLAY_AREA.height * 0.4, 260, 'rgba(255,255,255,0.6)');
    AudioManager.playNewRecord();
    ProgressManager.noteClear();
    this._flyCoins(Math.round(40 * this.diff.coinReward), PLAY_AREA.width / 2, PLAY_AREA.height * 0.4);
    this._fillWave(this.diff.startRows);
    this.shotsLeft = this._rowEvery();
  }

  _checkDeath() {
    let maxY = -1;
    for (const v of this.grid.values()) {
      const y = this.originY + v.r * this.rowH;
      if (y > maxY) maxY = y;
    }
    this._dangerNear = maxY > this.deathY - this.rowH * 1.5;
    if (maxY + this.eggR * 0.2 >= this.deathY) this._triggerGameOver();
  }

  // ---------- level / theme ----------
  _checkLevelUp() {
    const newLevel = levelForScore(this.score);
    if (newLevel > this.level) this._levelUp(newLevel);
  }

  _levelUp(newLevel) {
    this.level = newLevel;
    const theme = themeForLevel(newLevel);
    if (theme.key !== this.theme.key) {
      this.bgPrev = this.bgImg;
      this.theme = theme;
      this.bgImg = AssetManager.get(theme.bg);
      this.bgFade = 0;
    } else {
      this.theme = theme;
    }
    ProgressManager.noteLevel(newLevel);
    AudioManager.playLevelUp();
    this.shake.trigger(8, 0.4);
    this.particles.flash(PLAY_AREA.width / 2, PLAY_AREA.height / 2, 320, 'rgba(255,255,255,0.5)');
    this._flyCoins(15 + newLevel * 3, PLAY_AREA.width / 2, PLAY_AREA.height * 0.5);
    this._showLevelBanner(newLevel, theme);
  }

  _onDailyComplete(ch) {
    EconomyManager.addCoins(ch.reward);
    this.walletCount = EconomyManager.coins;
    this._updateWalletUI();
    this.popups.add(`DAILY ✓ +${ch.reward}`, PLAY_AREA.width / 2, PLAY_AREA.height * 0.45, { color: '#9bf6ff', size: 24 });
    AudioManager.playReward();
  }

  // ---------- boosters ----------
  _useBooster(key) {
    if (!this.boosters[key] || this.boosters[key] <= 0) { this._toast('Out of boosters'); return; }
    if (this.gameOver || this.paused) return;
    AudioManager.playClick();
    if (key === 'freeze') {
      // push-back: remove the lowest (most dangerous) row
      this._removeLowestRow();
      this.boosters.freeze -= 1;
    } else if (key === 'bomb') {
      this.curBomb = true; this.curRainbow = false;
      this.boosters.bomb -= 1;
      this._toast('💣 Bomb egg — fire it!');
    } else if (key === 'hammer') {
      this.curRainbow = true; this.curBomb = false;
      this.boosters.hammer -= 1;
      this._toast('🌈 Rainbow egg — matches any!');
    }
    this._refreshBoosterUI();
    EconomyManager.setBoosters(this.boosters);
    this._closeBoostPanel();
  }

  _removeLowestRow() {
    let maxR = -1;
    for (const v of this.grid.values()) if (v.r > maxR) maxR = v.r;
    if (maxR < 0) return;
    for (const [k, v] of [...this.grid]) {
      if (v.r === maxR) {
        const w = this._cellToWorld(v.r, v.c);
        this.particles.burst(w.x, w.y, [EGG_COLORS[v.color].glow, '#fff'], 4);
        this.grid.delete(k);
      }
    }
    this.shake.trigger(6, 0.25);
    AudioManager.playWoosh();
    this.popups.add('PUSH BACK', PLAY_AREA.width / 2, this.deathY - 30, { color: '#7ad7f0', size: 24 });
    this._dropFloaters();
    this._checkDeath();
  }

  // ---------- coins / wallet ----------
  _walletTargetCoords() {
    const canvas = this.canvas, wallet = this.walletEl;
    if (!canvas || !wallet) return [PLAY_AREA.width / 2, 44];
    const cr = canvas.getBoundingClientRect();
    const wr = wallet.getBoundingClientRect();
    return [
      (wr.left + wr.width / 2 - cr.left) * (PLAY_AREA.width / cr.width),
      (wr.top + wr.height / 2 - cr.top) * (PLAY_AREA.height / cr.height),
    ];
  }

  _flyCoins(amount, x, y) {
    if (amount <= 0) return;
    this.runCoins += amount;
    const [tx, ty] = this._walletTargetCoords();
    const n = Math.min(16, Math.max(3, Math.round(amount / 2)));
    this.coinFly.spawn(n, x, y, tx, ty, {
      onAllDone: () => {
        EconomyManager.addCoins(amount);
        this.walletCount = EconomyManager.coins;
        this._updateWalletUI();
        this._bumpWallet();
        AudioManager.playCoin();
      },
    });
  }

  _updateWalletUI() { if (this.walletCountEl) this.walletCountEl.textContent = this.walletCount; }
  _bumpWallet() {
    if (!this.walletEl) return;
    this.walletEl.classList.remove('bump');
    void this.walletEl.offsetWidth;
    this.walletEl.classList.add('bump');
  }

  // ---------- banners ----------
  _showCombo(n) {
    const b = this.comboBanner; if (!b) return;
    b.textContent = 'COMBO ×' + n + '!';
    b.classList.remove('hidden', 'show');
    void b.offsetWidth;
    b.classList.add('show');
    AudioManager.playCombo(n);
    clearTimeout(this._comboTo);
    this._comboTo = setTimeout(() => b.classList.remove('show'), 900);
  }

  _showLevelBanner(level, theme) {
    if (!this.levelBanner) return;
    this.levelBanner.textContent = `LEVEL ${level} · ${theme.name}`;
    this.levelBanner.style.setProperty('--lvl-accent', theme.accent2);
    this.levelBanner.classList.remove('hidden', 'show');
    void this.levelBanner.offsetWidth;
    this.levelBanner.classList.add('show');
    clearTimeout(this._lvlTo);
    this._lvlTo = setTimeout(() => this.levelBanner.classList.remove('show'), 2000);
  }

  _achToast(a) {
    this._toast(`🏅 ${a.title}`);
    AudioManager.playReward();
  }

  // ---------- HUD ----------
  _updateHUD() {
    this.scoreEl.textContent = this.score;
    if (this.levelEl) this.levelEl.textContent = this.level;
    if (this.levelFillEl) {
      const next = nextThreshold(this.level);
      if (next === null) this.levelFillEl.style.width = '100%';
      else {
        const prev = nextThreshold(this.level - 1) ?? 0;
        const pct = Math.max(0, Math.min(100, ((this.score - prev) / (next - prev)) * 100));
        this.levelFillEl.style.width = pct + '%';
      }
    }
  }

  _refreshNextPreview() {
    const col = EGG_COLORS[this.next.color];
    this.nextEl.style.background = `radial-gradient(circle at 32% 30%, ${col.glow}, ${col.shell} 62%, ${this._darken(col.shell, 0.25)})`;
    this.nextEl.style.boxShadow = 'none';
  }

  _refreshBoosterUI() {
    this.hammerEl.textContent = this.boosters.hammer || 0;
    this.bombEl.textContent = this.boosters.bomb || 0;
    this.freezeEl.textContent = this.boosters.freeze || 0;
    const total = (this.boosters.hammer || 0) + (this.boosters.bomb || 0) + (this.boosters.freeze || 0);
    if (this.boostTotalEl) {
      this.boostTotalEl.textContent = total;
      this.boostTotalEl.classList.toggle('hidden', total <= 0);
    }
  }

  _toggleBoostPanel() {
    const open = !this.boostPanel.classList.toggle('hidden');
    this.boostBtn.classList.toggle('open', open);
  }

  _closeBoostPanel() {
    if (!this.boostPanel) return;
    this.boostPanel.classList.add('hidden');
    this.boostBtn.classList.remove('open');
  }

  // ---------- pause / game over ----------
  pause() { if (this.gameOver) return; this.paused = true; this.pauseEl.classList.remove('hidden'); AudioManager.stopMusic(); }
  resume() { this.paused = false; this._idle = 0; this.pauseEl.classList.add('hidden'); AudioManager.startMusic(); }

  _triggerGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.projectile = null;
    AudioManager.playGameOver();
    this.shake.trigger(14, 0.6);
    EconomyManager.setBoosters(this.boosters);
    const coinReward = this.runCoins;
    const isNew = SaveManager.setHighScore(this.mode, this.score);
    const newlyAch = ProgressManager.recordGame(this.mode, this.score, this.level);
    newlyAch.forEach((a, i) => setTimeout(() => this._achToast(a), 500 + i * 1500));
    setTimeout(() => {
      this._mgr.switchTo('gameover', {
        score: this.score, coins: coinReward, level: this.level,
        newRecord: isNew, mode: this.mode, revive: () => this._reviveFromAd(),
      });
    }, 600);
  }

  async _reviveFromAd() {
    if (this.revivesUsed >= 1) return false;
    this.revivesUsed++;
    // remove the two lowest rows to relieve pressure
    const rows = [...new Set([...this.grid.values()].map((v) => v.r))].sort((a, b) => b - a).slice(0, 2);
    const kill = new Set(rows);
    for (const [k, v] of [...this.grid]) {
      if (kill.has(v.r)) {
        const w = this._cellToWorld(v.r, v.c);
        this.particles.burst(w.x, w.y, [EGG_COLORS[v.color].glow, '#fff'], 5);
        this.grid.delete(k);
      }
    }
    this.gameOver = false;
    this._idle = 0;
    this._dropFloaters();
    this.shake.trigger(6, 0.3);
    AudioManager.playReward();
    this.hudEl.classList.remove('hidden');
    return true;
  }

  // ---------- update / draw ----------
  update(dt) {
    if (this.paused || this.gameOver) {
      this.coinFly.update(dt);
      return;
    }
    if (this.projectile) {
      this._updateProjectile(dt);
      if (this.projectile) {
        const glow = this.projectile.rainbow ? '#ffffff' : EGG_COLORS[this.projectile.color].glow;
        this.particles.trail(this.projectile.x, this.projectile.y, glow);
      }
    } else if (!this._aiming) {
      // idle auto-fire: a medium-power straight-up shot if the player stalls
      this._idle += dt;
      if (this._idle >= this._autoFireSec()) {
        this.pull = { x: 0, y: this.minPull + (this.maxPull - this.minPull) * 0.55 };
        this._pullLen = this.pull.y;
        this._tension = 0.55;
        this._fire();
      }
    }
    if (this._recoil > 0) this._recoil = Math.max(0, this._recoil - dt * 60);
    if (this._wallFlash) { this._wallFlash.t -= dt * 3; if (this._wallFlash.t <= 0) this._wallFlash = null; }
    this.particles.update(dt);
    this.popups.update(dt);
    this.shake.update(dt);
    this.coinFly.update(dt);
    if (this.bgFade < 1) this.bgFade = Math.min(1, this.bgFade + dt * 1.2);
  }

  draw(ctx) {
    const W = PLAY_AREA.width, H = PLAY_AREA.height;
    this._drawBackground(ctx, W, H);
    const [sx, sy] = this.shake.getOffset();
    ctx.save();
    ctx.translate(sx, sy);

    this._drawDeathLine(ctx);
    this._drawWallFlash(ctx);
    for (const v of this.grid.values()) {
      const w = this._cellToWorld(v.r, v.c);
      this._drawEgg(ctx, w.x, w.y, v.color, v.seed);
    }
    if (!this.projectile && !this.gameOver && !this.paused) this._drawAim(ctx);
    if (this.projectile) {
      const p = this.projectile;
      this._drawEgg(ctx, p.x, p.y, p.rainbow ? -1 : p.color, p.seed);
    }
    this._drawSlingshot(ctx);
    this.particles.draw(ctx);
    this.popups.draw(ctx);
    ctx.restore();

    this.coinFly.draw(ctx);
  }

  _drawBackground(ctx, W, H) {
    ctx.fillStyle = this.theme.field || '#0a0524';
    ctx.fillRect(0, 0, W, H);
    if (this.bgFade < 1 && this.bgPrev) {
      ctx.globalAlpha = (1 - this.bgFade) * (this.theme.dim ?? 0.5);
      this._drawImageCover(ctx, this.bgPrev, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth) {
      ctx.globalAlpha = (this.theme.dim ?? 0.5) * (this.bgFade < 1 ? this.bgFade : 1);
      this._drawImageCover(ctx, this.bgImg, W, H);
      ctx.globalAlpha = 1;
    }
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.5, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, this.theme.scrim || 'rgba(5,8,20,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  _drawImageCover(ctx, img, W, H) {
    const ar = img.naturalWidth / img.naturalHeight;
    const tar = W / H;
    let dw, dh;
    if (ar > tar) { dh = H; dw = H * ar; } else { dw = W; dh = W / ar; }
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  _drawDeathLine(ctx) {
    const y = this.deathY;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    if (this._dangerNear) {
      const a = 0.5 + 0.4 * Math.abs(Math.sin(performance.now() / 180));
      ctx.strokeStyle = `rgba(255,80,90,${a})`;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    }
    ctx.beginPath();
    ctx.moveTo(this.marginX, y);
    ctx.lineTo(PLAY_AREA.width - this.marginX, y);
    ctx.stroke();
    ctx.restore();
  }

  _powerColor(t) {
    if (t < 0.4) return '#6be37a';   // gentle
    if (t < 0.75) return '#ffd23f';  // medium
    return '#ff4d5e';                // hard
  }

  _drawWallFlash(ctx) {
    const f = this._wallFlash;
    if (!f || f.t <= 0) return;
    const wx = f.x < PLAY_AREA.width / 2 ? this.marginX : PLAY_AREA.width - this.marginX;
    const h = 40 + f.power * 90;
    ctx.save();
    ctx.globalAlpha = f.t * (0.4 + f.power * 0.5);
    const g = ctx.createRadialGradient(wx, f.y, 2, wx, f.y, h / 2);
    g.addColorStop(0, this._powerColor(f.power));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(wx - 34, f.y - h / 2, 68, h);
    ctx.restore();
  }

  // Trace the shot path exactly like _updateProjectile: same walls, same
  // restitution-on-bounce (so the dotted line matches where the egg really goes),
  // and the same _collideEgg test. Returns the dot points + landing + hit cell.
  _simulateAim(dir, t) {
    const a = this.anchor;
    let x = a.x, y = a.y, vx = dir.x, vy = dir.y;
    const left = this.marginX + this.eggR, right = PLAY_AREA.width - this.marginX - this.eggR;
    const step = 8;
    const rest = 0.78 + t * 0.22; // MUST match the wall restitution in _updateProjectile
    const pts = [];
    let landing = null, lastHit = null;
    for (let i = 0; i < 280; i++) {
      const inv = step / Math.hypot(vx, vy); // advance a fixed length along the (tilted) heading
      x += vx * inv; y += vy * inv;
      if (x < left) { x = left; vx = Math.abs(vx) * rest; }        // lose horizontal energy on bounce
      else if (x > right) { x = right; vx = -Math.abs(vx) * rest; }
      if (y <= this.originY) { landing = { x, y }; break; }
      const hit = this._collideEgg(x, y);
      if (hit) { landing = { x, y }; lastHit = hit; break; }
      pts.push({ x, y });
    }
    return { pts, landing, lastHit };
  }

  _drawAim(ctx) {
    const aiming = this._pullLen >= this.minPull;
    const dir = aiming ? this._launchDir() : { x: 0, y: -1 };
    const t = this._tension;
    const { pts, landing, lastHit } = this._simulateAim(dir, t);
    const cr = 255, cg = Math.round(255 - t * 150), cb = Math.round(255 - t * 210); // white → hot
    const drawN = aiming ? pts.length : Math.min(pts.length, 22); // short hint when resting
    ctx.save();
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    for (let i = 0; i < drawN; i += 3) {
      ctx.globalAlpha = (aiming ? 0.85 : 0.3) * (1 - i / pts.length);
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, aiming ? 3.2 + t * 1.6 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (landing && aiming) {
      const cell = this._placeCell(landing.x, landing.y, lastHit);
      if (cell) {
        const w = this._cellToWorld(cell.r, cell.c);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = `rgb(${cr},${cg},${cb})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(w.x, w.y, this.eggR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  _drawSlingshot(ctx) {
    const a = this.anchor;
    const ry = (this._recoil || 0) * 0.4;
    const bx = a.x + this.pull.x;
    const by = a.y + this.pull.y + ry;     // ball / pouch position
    const tipY = a.y - 2;
    const Lx = a.x - 38, Rx = a.x + 38;     // fork tips
    const baseY = 686, splitY = a.y + 30;

    // --- wooden Y frame ---
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40,24,12,0.9)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(a.x, baseY); ctx.lineTo(a.x, splitY);
    ctx.moveTo(a.x, splitY); ctx.lineTo(Lx, tipY);
    ctx.moveTo(a.x, splitY); ctx.lineTo(Rx, tipY);
    ctx.stroke();
    const wood = ctx.createLinearGradient(a.x - 40, 0, a.x + 40, 0);
    wood.addColorStop(0, '#7a4a22'); wood.addColorStop(0.5, '#b07636'); wood.addColorStop(1, '#7a4a22');
    ctx.strokeStyle = wood;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(a.x, baseY); ctx.lineTo(a.x, splitY);
    ctx.moveTo(a.x, splitY); ctx.lineTo(Lx, tipY);
    ctx.moveTo(a.x, splitY); ctx.lineTo(Rx, tipY);
    ctx.stroke();
    ctx.fillStyle = '#5a3414';
    for (const tx of [Lx, Rx]) { ctx.beginPath(); ctx.arc(tx, tipY, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();

    if (this.current && !this.gameOver) {
      const t = this._tension;
      const bandW = 5 + t * 3;
      const bandCol = `rgb(235,${Math.round(180 - t * 140)},${Math.round(120 - t * 90)})`; // amber → hot red

      // back bands (behind the ball)
      ctx.save();
      ctx.lineCap = 'round';
      if (t > 0.6) { ctx.shadowColor = 'rgba(255,80,60,0.7)'; ctx.shadowBlur = 10; }
      ctx.strokeStyle = bandCol;
      ctx.lineWidth = bandW;
      ctx.beginPath();
      ctx.moveTo(Lx, tipY); ctx.lineTo(bx, by);
      ctx.moveTo(Rx, tipY); ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();

      // leather pouch behind the ball
      ctx.save();
      ctx.fillStyle = 'rgba(30,18,10,0.92)';
      ctx.beginPath();
      ctx.ellipse(bx, by, this.eggR * 0.95, this.eggR * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // auto-fire countdown ring (only while resting & idle)
      const ct = Math.min(1, this._idle / this._autoFireSec());
      if (ct > 0.22 && !this.projectile && !this._aiming) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.strokeStyle = ct > 0.7
          ? `rgba(255,86,96,${0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 110))})`
          : 'rgba(255,255,255,0.72)';
        ctx.beginPath();
        ctx.arc(0, 0, this.eggR + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ct));
        ctx.stroke();
        ctx.restore();
      }

      // loaded egg
      this._drawEgg(ctx, bx, by, this.curRainbow ? -1 : this.current.color, this.current.seed);
      if (this.curBomb) {
        ctx.save();
        ctx.font = '20px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('💣', bx, by + 1);
        ctx.restore();
      }

      // front strands wrapping over the ball edges (depth)
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,${Math.round(210 - t * 120)},${Math.round(160 - t * 110)},0.85)`;
      ctx.lineWidth = Math.max(2, bandW - 3);
      ctx.beginPath();
      ctx.moveTo(Lx, tipY); ctx.lineTo(bx - this.eggR * 0.5, by);
      ctx.moveTo(Rx, tipY); ctx.lineTo(bx + this.eggR * 0.5, by);
      ctx.stroke();
      ctx.restore();

      // power / tension gauge floating above the pulled ball
      if (this._aiming && this._pullLen >= this.minPull) {
        const tw = 60, th = 9, gx = bx - tw / 2, gy = by - this.eggR - 24;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        this._roundRect(ctx, gx - 3, gy - 3, tw + 6, th + 6, 6); ctx.fill();
        ctx.fillStyle = this._powerColor(t);
        this._roundRect(ctx, gx, gy, Math.max(3, tw * t), th, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        for (let k = 1; k < 4; k++) { const xx = gx + tw * k / 4; ctx.beginPath(); ctx.moveTo(xx, gy); ctx.lineTo(xx, gy + th); ctx.stroke(); }
        ctx.fillStyle = '#fff';
        ctx.font = "800 13px 'Fredoka', system-ui, sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('⚡ ' + Math.round(t * 100) + '%', bx, gy - 6);
        ctx.restore();
      }
    }
  }

  _spots(seed) {
    if (this._spotCache.has(seed)) return this._spotCache.get(seed);
    let s = seed || 1;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const out = [];
    const n = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const rad = rnd() * 0.58;
      out.push({ dx: Math.cos(a) * rad, dy: Math.sin(a) * rad - 0.08, rr: 0.09 + rnd() * 0.11 });
    }
    this._spotCache.set(seed, out);
    return out;
  }

  _drawEgg(ctx, x, y, ci, seed, scale = 1) {
    const rainbow = ci < 0;
    const col = rainbow ? null : EGG_COLORS[ci];
    const r = this.eggR * scale;
    ctx.save();
    ctx.translate(x, y);

    // soft coloured glow halo — makes eggs pop off the dark field
    const haloCol = rainbow ? '#ffffff' : col.glow;
    ctx.globalAlpha = 0.3;
    const halo = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.55);
    halo.addColorStop(0, haloCol);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(2, 3, r * 0.9, r * 1.03, 0, 0, Math.PI * 2);
    ctx.fill();

    // glossy shell — bright hot-spot at the top for a candy sheen
    let g;
    if (rainbow) {
      g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, '#ff5d8f'); g.addColorStop(0.3, '#ffd23f');
      g.addColorStop(0.6, '#28e07a'); g.addColorStop(1, '#1fa8ff');
    } else {
      g = ctx.createRadialGradient(-r * 0.34, -r * 0.46, r * 0.12, 0, 0, r * 1.18);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.16, col.glow);
      g.addColorStop(0.56, col.shell);
      g.addColorStop(1, this._darken(col.shell, 0.3));
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.9, r * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // darker rim for crisp definition
    ctx.lineWidth = 2;
    ctx.strokeStyle = rainbow ? 'rgba(255,255,255,0.5)' : this._rgba(col.spot, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.9, r * 1.04, 0, 0, Math.PI * 2);
    ctx.stroke();

    // speckles
    if (!rainbow) {
      ctx.fillStyle = this._rgba(col.spot, 0.82);
      for (const sp of this._spots(seed)) {
        ctx.beginPath();
        ctx.ellipse(sp.dx * r, sp.dy * r, sp.rr * r, sp.rr * r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // big soft highlight + tiny sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.44, r * 0.3, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(r * 0.26, -r * 0.5, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- colour helpers ----------
  _parse(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  _darken(hex, amt) {
    const [r, g, b] = this._parse(hex);
    const f = 1 - amt;
    return `rgb(${(r * f) | 0},${(g * f) | 0},${(b * f) | 0})`;
  }
  _rgba(hex, a) {
    const [r, g, b] = this._parse(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1400);
  }
}
