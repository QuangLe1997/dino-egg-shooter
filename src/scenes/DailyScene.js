import { DAILY_REWARDS } from '../config/constants.js';
import { EconomyManager } from '../managers/EconomyManager.js';
import { AudioManager } from '../managers/AudioManager.js';

export class DailyScene {
  constructor() {
    this.el = document.getElementById('daily');
    this.grid = document.getElementById('dailyGrid');
    this.msg = document.getElementById('dailyMsg');
    this.btnClaim = document.getElementById('btnDailyClaim');
    this.btnClose = document.getElementById('btnDailyClose');

    this.btnClaim.addEventListener('click', () => this._onClaim());
    this.btnClose.addEventListener('click', () => this._onClose());
  }

  enter(payload = {}) {
    this.payload = payload;
    this.el.classList.remove('hidden');
    this._render();
  }

  exit() {
    this.el.classList.add('hidden');
  }

  _render() {
    const status = EconomyManager.getDailyStatus();

    // clear grid safely (no innerHTML)
    while (this.grid.firstChild) this.grid.removeChild(this.grid.firstChild);

    for (const r of DAILY_REWARDS) {
      const cell = document.createElement('div');
      cell.className = 'daily-cell';
      if (r.day === 7) cell.classList.add('day-7');

      if (r.day < status.day) cell.classList.add('claimed');
      else if (r.day === status.day && status.alreadyClaimedToday) cell.classList.add('claimed');
      else if (r.day === status.day) cell.classList.add('today');

      const day = document.createElement('div');
      day.className = 'daily-cell-day';
      day.textContent = r.day === 7 ? 'DAY 7' : 'Day ' + r.day;

      const reward = document.createElement('div');
      reward.className = 'daily-cell-reward';
      if (r.type === 'coin') reward.textContent = `${r.amount} 🪙`;
      else if (r.type === 'boost') reward.textContent = `+${r.amount} ${r.booster === 'hammer' ? '🌈' : r.booster === 'bomb' ? '💣' : '⬆️'}`;
      else if (r.type === 'mega') reward.textContent = r.label;

      cell.appendChild(day);
      cell.appendChild(reward);
      this.grid.appendChild(cell);
    }

    if (status.alreadyClaimedToday) {
      this.msg.textContent = 'You already claimed today. Come back tomorrow!';
      this.btnClaim.disabled = true;
      this.btnClaim.style.opacity = 0.5;
    } else {
      this.msg.textContent = `Day ${status.day} — claim your reward!`;
      this.btnClaim.disabled = false;
      this.btnClaim.style.opacity = 1;
    }
  }

  _onClaim() {
    AudioManager.playClick();
    const r = EconomyManager.claimDaily();
    if (r) {
      AudioManager.playReward();
      this._render();
      const t = document.getElementById('toast');
      let msg = 'Reward claimed!';
      if (r.type === 'coin') msg = `+${r.amount} 🪙`;
      else if (r.type === 'boost') msg = `+${r.amount} ${r.booster}!`;
      else if (r.type === 'mega') msg = '🎁 MEGA reward!';
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 1600);
    }
  }

  _onClose() {
    AudioManager.playClick();
    this._mgr.switchTo(this.payload.from || 'menu');
  }

  update() {}
  draw() {}
}
