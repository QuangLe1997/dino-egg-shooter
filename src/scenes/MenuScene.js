import { SaveManager } from '../managers/SaveManager.js';
import { EconomyManager } from '../managers/EconomyManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { ProgressManager } from '../managers/ProgressManager.js';

export class MenuScene {
  constructor() {
    this.el = document.getElementById('menu');
    this.btnPlay = document.getElementById('btnPlay');
    this.btnDaily = document.getElementById('btnDaily');
    this.btnSettings = document.getElementById('btnSettings');
    this.btnShare = document.getElementById('btnShare');
    this.btnStats = document.getElementById('btnStats');
    this.modesEl = document.getElementById('menuModes');
    this.highEl = document.getElementById('menuHighScore');
    this.coinsEl = document.getElementById('menuCoins');
    this.dailyDot = document.getElementById('dailyDot');
    this.dcChip = document.getElementById('dailyChallengeChip');
    this.dcLabel = document.getElementById('dcLabel');
    this.dcMeta = document.getElementById('dcMeta');

    this.btnPlay.addEventListener('click', () => this._onPlay());
    this.btnDaily.addEventListener('click', () => this._onDaily());
    this.btnSettings.addEventListener('click', () => this._onSettings());
    this.btnShare.addEventListener('click', () => this._onShare());
    this.btnStats.addEventListener('click', () => this._onStats());
    this.dcChip.addEventListener('click', () => this._onPlay()); // tapping the challenge starts a game

    this.onboardEl = document.getElementById('onboard');
    document.getElementById('btnOnboard').addEventListener('click', () => {
      AudioManager.playClick();
      SaveManager.save('dino_onboarded_v1', true);
      this.onboardEl.classList.add('hidden');
    });

    document.getElementById('btnStatsClose').addEventListener('click', () => {
      AudioManager.playClick();
      document.getElementById('stats').classList.add('hidden');
    });

    this.modesEl.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioManager.playClick();
        SaveManager.setMode(btn.dataset.mode);
        this._refresh();
      });
    });
  }

  enter() {
    this.el.classList.remove('hidden');
    AudioManager.resume();
    AudioManager.startMusic();
    this._refresh();
    // first-run how-to-play
    if (!SaveManager.load('dino_onboarded_v1', false)) {
      this.onboardEl.classList.remove('hidden');
    }
  }

  exit() {
    this.el.classList.add('hidden');
  }

  _refresh() {
    const mode = SaveManager.getMode();
    this.highEl.textContent = SaveManager.getHighScore(mode);
    this.coinsEl.textContent = EconomyManager.coins;
    this.modesEl.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    // show a notification dot on the Daily button when a reward is claimable
    if (this.dailyDot) {
      const canClaim = EconomyManager.getDailyStatus().canClaim;
      this.dailyDot.classList.toggle('hidden', !canClaim);
    }
    // daily challenge chip
    const ch = ProgressManager.getDailyChallenge();
    this.dcLabel.textContent = ch.label;
    if (ch.done) {
      this.dcMeta.textContent = '✓ Done';
      this.dcChip.classList.add('done');
    } else {
      this.dcMeta.textContent = `${Math.min(ch.progress, ch.n)}/${ch.n} · +${ch.reward}🪙`;
      this.dcChip.classList.remove('done');
    }
  }

  _onStats() {
    AudioManager.playClick();
    const mode = SaveManager.getMode();

    // leaderboard
    const lb = ProgressManager.getLeaderboard(mode);
    const lbList = document.getElementById('lbList');
    while (lbList.firstChild) lbList.removeChild(lbList.firstChild);
    if (!lb.length) {
      const e = document.createElement('div');
      e.className = 'lb-empty';
      e.textContent = 'No scores yet — play a game!';
      lbList.appendChild(e);
    } else {
      lb.slice(0, 5).forEach((sc, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row' + (i === 0 ? ' top' : '');
        const r = document.createElement('span');
        r.className = 'lb-rank';
        r.textContent = (['🥇', '🥈', '🥉'][i]) || ('#' + (i + 1));
        const s = document.createElement('span');
        s.className = 'lb-score';
        s.textContent = sc;
        row.appendChild(r);
        row.appendChild(s);
        lbList.appendChild(row);
      });
    }

    // achievements
    const ach = ProgressManager.getAchievements();
    const grid = document.getElementById('achGrid');
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    ach.forEach(a => {
      const cell = document.createElement('div');
      cell.className = 'ach-cell ' + (a.unlocked ? 'unlocked' : 'locked');
      const ic = document.createElement('div');
      ic.className = 'ach-ic';
      ic.textContent = a.unlocked ? a.icon : '🔒';
      const nm = document.createElement('div');
      nm.className = 'ach-name';
      nm.textContent = a.title;
      const ds = document.createElement('div');
      ds.className = 'ach-desc';
      ds.textContent = a.desc;
      cell.appendChild(ic);
      cell.appendChild(nm);
      cell.appendChild(ds);
      grid.appendChild(cell);
    });
    document.getElementById('achCount').textContent = `(${ProgressManager.unlockedCount()}/${ach.length})`;

    document.getElementById('stats').classList.remove('hidden');
  }

  _onPlay() {
    AudioManager.playClick();
    this._mgr.switchTo('game');
  }

  _onDaily() {
    AudioManager.playClick();
    this._mgr.switchTo('daily', { from: 'menu' });
  }

  _onSettings() {
    AudioManager.playClick();
    // Open the in-game pause dialog as settings; it has the audio toggles.
    const dlg = document.getElementById('pause');
    const title = dlg.querySelector('.dialog-title');
    title.textContent = 'SETTINGS';
    document.getElementById('btnResume').textContent = 'Close';
    document.getElementById('btnRestart').style.display = 'none';
    document.getElementById('btnToMenu').style.display = 'none';
    dlg.classList.remove('hidden');
    const close = () => {
      dlg.classList.add('hidden');
      title.textContent = 'PAUSED';
      document.getElementById('btnResume').textContent = 'Resume';
      document.getElementById('btnRestart').style.display = '';
      document.getElementById('btnToMenu').style.display = '';
      document.getElementById('btnResume').removeEventListener('click', close);
    };
    document.getElementById('btnResume').addEventListener('click', close, { once: true });
  }

  _onShare() {
    AudioManager.playClick();
    const url = location.href;
    const text = `I'm playing Dino Egg Pop — score ${SaveManager.getHighScore(SaveManager.getMode())}! Try it: ${url}`;
    if (navigator.share) {
      navigator.share({ title: 'Dino Egg Pop', text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      this._toast('Link copied!');
    }
  }

  _toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1600);
  }

  update() { /* DOM-driven */ }
  draw() {}
}
