import { STORAGE } from '../config/constants.js';

class _SaveManager {
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // quota exceeded or storage disabled — silently ignore
    }
  }

  // ---- High Score (per mode) ----
  getHighScore(mode = 'normal') {
    const map = this.load(STORAGE.highscore, {});
    return map[mode] || 0;
  }

  setHighScore(mode, score) {
    const map = this.load(STORAGE.highscore, {});
    if (!map[mode] || score > map[mode]) {
      map[mode] = score;
      this.save(STORAGE.highscore, map);
      return true; // new record
    }
    return false;
  }

  // ---- Settings ----
  getSettings() {
    return this.load(STORAGE.settings, { music: true, sfx: true, vibe: true });
  }

  setSettings(s) {
    this.save(STORAGE.settings, s);
  }

  // ---- Mode ----
  getMode() {
    return this.load(STORAGE.mode, 'normal');
  }

  setMode(m) {
    this.save(STORAGE.mode, m);
  }

  // ---- Ads stats ----
  getAdsStats() {
    return this.load(STORAGE.ads, { gameOversSinceInterstitial: 0 });
  }

  setAdsStats(s) {
    this.save(STORAGE.ads, s);
  }
}

export const SaveManager = new _SaveManager();
