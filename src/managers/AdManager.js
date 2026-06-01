// Ads abstraction — currently a mock that simulates SDKs (AdSense for Games,
// GameDistribution, CrazyGames). Swap with real SDK in production.
import { AD } from '../config/constants.js';
import { SaveManager } from './SaveManager.js';

class _AdManager {
  constructor() {
    this.overlay = null;
    this.title = null;
    this.progress = null;
    this.skipBtn = null;
    this._initialized = false;
  }

  _init() {
    if (this._initialized) return;
    this.overlay = document.getElementById('adOverlay');
    this.title = document.getElementById('adTitle');
    this.progress = document.getElementById('adProgress');
    this.skipBtn = document.getElementById('adSkip');
    this._initialized = true;
  }

  // Returns a Promise that resolves true if reward should be granted.
  showRewarded(messageOverride) {
    return this._playAd({
      title: messageOverride || 'Watch a short ad to earn your reward…',
      duration: 4000,
      allowSkipAfter: 4000, // full watch required
      rewardOnComplete: true,
    });
  }

  showInterstitial() {
    const stats = SaveManager.getAdsStats();
    stats.gameOversSinceInterstitial = 0;
    SaveManager.setAdsStats(stats);
    return this._playAd({
      title: 'A short break…',
      duration: 2500,
      allowSkipAfter: 800,
      rewardOnComplete: false,
    });
  }

  // Decide whether an interstitial should fire on game over (every N).
  noteGameOverShouldInterstitial() {
    const stats = SaveManager.getAdsStats();
    stats.gameOversSinceInterstitial = (stats.gameOversSinceInterstitial || 0) + 1;
    SaveManager.setAdsStats(stats);
    return stats.gameOversSinceInterstitial >= AD.interstitialEveryN;
  }

  _playAd({ title, duration, allowSkipAfter, rewardOnComplete }) {
    this._init();
    return new Promise(resolve => {
      this.overlay.classList.remove('hidden');
      this.title.textContent = title;
      this.progress.style.width = '0%';
      this.skipBtn.classList.add('hidden');

      const start = performance.now();
      let raf;

      const tick = (t) => {
        const elapsed = t - start;
        const pct = Math.min(100, (elapsed / duration) * 100);
        this.progress.style.width = pct + '%';

        if (elapsed >= allowSkipAfter) {
          this.skipBtn.classList.remove('hidden');
          this.skipBtn.textContent = pct >= 100 ? 'Close' : 'Skip';
        }

        if (pct >= 100) {
          cancelAnimationFrame(raf);
          this._finish(resolve, rewardOnComplete);
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      this.skipBtn.onclick = () => {
        cancelAnimationFrame(raf);
        const elapsed = performance.now() - start;
        const completed = elapsed >= duration;
        this._finish(resolve, rewardOnComplete && completed);
      };
    });
  }

  _finish(resolve, rewarded) {
    this.overlay.classList.add('hidden');
    this.skipBtn.classList.add('hidden');
    resolve(!!rewarded);
  }
}

export const AdManager = new _AdManager();
