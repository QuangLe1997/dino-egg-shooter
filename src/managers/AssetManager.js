// AssetManager — preloads & caches the few images the shooter needs
// (theme backgrounds + the coin sprite). Eggs are drawn procedurally.

import { THEMES } from '../config/themes.js';

export const COIN_SRC = 'assets/images/coin.png';
export const MENU_BG = 'assets/images/menu-bg.webp';
export const UI_IMAGES = { coin: COIN_SRC, menuBg: MENU_BG };

class _AssetManager {
  constructor() {
    this.images = {}; // src -> HTMLImageElement
    this.ready = false;
  }

  // Resolves when all images are loaded (or errored). onProgress(loaded,total).
  preload(onProgress) {
    const paths = [COIN_SRC, MENU_BG, ...THEMES.map((t) => t.bg)];
    const total = paths.length;
    let loaded = 0;

    return Promise.all(
      paths.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.images[src] = img;
              loaded++;
              if (onProgress) onProgress(loaded, total);
              resolve();
            };
            img.onerror = () => {
              loaded++;
              if (onProgress) onProgress(loaded, total);
              resolve();
            };
            img.src = src;
          })
      )
    ).then(() => { this.ready = true; });
  }

  get(src) {
    return this.images[src] || null;
  }
}

export const AssetManager = new _AssetManager();
