import { SaveManager } from '../managers/SaveManager.js';
import { EconomyManager } from '../managers/EconomyManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { AdManager } from '../managers/AdManager.js';

export class GameOverScene {
  constructor() {
    this.el = document.getElementById('gameover');
    this.titleEl = document.getElementById('goTitle');
    this.scoreEl = document.getElementById('goScore');
    this.bestEl = document.getElementById('goBest');
    this.coinsEl = document.getElementById('goCoins');
    this.levelEl = document.getElementById('goLevel');
    this.btnRevive = document.getElementById('btnRevive');
    this.btnPlayAgain = document.getElementById('btnPlayAgain');
    this.btnShare = document.getElementById('btnShareScore');
    this.btnMenu = document.getElementById('btnGoMenu');

    this.btnRevive.addEventListener('click', () => this._onRevive());
    this.btnPlayAgain.addEventListener('click', () => this._onPlayAgain());
    this.btnShare.addEventListener('click', () => this._onShare());
    this.btnMenu.addEventListener('click', () => this._onMenu());
  }

  enter(payload = {}) {
    this.payload = payload;
    this.scoreEl.textContent = payload.score || 0;
    this.bestEl.textContent = SaveManager.getHighScore(payload.mode || 'normal');
    this.coinsEl.textContent = payload.coins || 0;
    if (this.levelEl) this.levelEl.textContent = payload.level || 1;
    this.titleEl.textContent = payload.newRecord ? 'NEW RECORD!' : 'GAME OVER';
    this.titleEl.classList.toggle('newrec', !!payload.newRecord);

    this.btnRevive.style.display = payload.revive ? '' : 'none';
    this.el.classList.remove('hidden');
    if (payload.newRecord) AudioManager.playNewRecord();

    // possibly fire interstitial first
    if (AdManager.noteGameOverShouldInterstitial()) {
      AdManager.showInterstitial();
    }
  }

  exit() {
    this.el.classList.add('hidden');
  }

  async _onRevive() {
    AudioManager.playClick();
    const rewarded = await AdManager.showRewarded('Watch ad to revive');
    if (rewarded && this.payload.revive) {
      const ok = await this.payload.revive();
      if (ok) {
        this.el.classList.add('hidden');
        // resume into the running game scene without re-entering it
        this._mgr.current = this._mgr.scenes.game;
      }
    }
  }

  _onPlayAgain() {
    AudioManager.playClick();
    this._mgr.switchTo('game');
  }

  _onShare() {
    AudioManager.playClick();
    const text = `I scored ${this.payload.score} on Dino Egg Pop! ${location.href}`;
    if (navigator.share) {
      navigator.share({ title: 'Dino Egg Pop', text, url: location.href }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
      const t = document.getElementById('toast');
      t.textContent = 'Score copied to clipboard!';
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 1600);
    }
  }

  _onMenu() {
    AudioManager.playClick();
    this._mgr.switchTo('menu');
  }

  update() {}
  draw() {}
}
