// Dino Egg Pop — entry point.
// Boots: splash → menu, sets up canvas, RAF game loop, scene switching.

import { PLAY_AREA } from './config/constants.js';
import { SceneManager } from './managers/SceneManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { AssetManager } from './managers/AssetManager.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { DailyScene } from './scenes/DailyScene.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------- Resize handling ----------
let dpr = 1;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  // size to the STAGE (portrait column), not the whole window
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width) || window.innerWidth;
  const h = Math.round(rect.height) || window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  // letterbox to PLAY_AREA aspect
  const ar = PLAY_AREA.width / PLAY_AREA.height;
  const screenAr = w / h;
  let drawW, drawH;
  if (screenAr > ar) {
    drawH = h;
    drawW = h * ar;
  } else {
    drawW = w;
    drawH = w / ar;
  }
  scale = (drawW / PLAY_AREA.width) * dpr;
  offsetX = ((w - drawW) / 2) * dpr;
  offsetY = ((h - drawH) / 2) * dpr;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas();
// recompute once after layout settles (stage size depends on CSS dvh)
requestAnimationFrame(resizeCanvas);

// ---------- Splash sequence ----------
// Real asset preload — the progress bar tracks sprite loading.
async function runSplash() {
  const fill = document.getElementById('splashFill');
  const splash = document.getElementById('splash');
  const hint = document.querySelector('.splash-hint');

  await AssetManager.preload((loaded, total) => {
    const pct = Math.round((loaded / total) * 100);
    fill.style.width = pct + '%';
    if (hint) hint.textContent = `Loading… ${loaded}/${total}`;
  });

  fill.style.width = '100%';
  if (hint) hint.textContent = 'Ready!';
  await new Promise(r => setTimeout(r, 280));
  splash.classList.add('hidden');
}

// ---------- Scene registration ----------
const menuScene = new MenuScene();
const gameScene = new GameScene();
const gameOverScene = new GameOverScene();
const dailyScene = new DailyScene();

SceneManager.register('menu', menuScene);
SceneManager.register('game', gameScene);
SceneManager.register('gameover', gameOverScene);
SceneManager.register('daily', dailyScene);

// expose for ad-hoc debugging (no harm in production — read-only refs)
window.__DINO__ = { SceneManager, gameScene, menuScene };

// ---------- Boot ----------
async function boot() {
  await runSplash();
  SceneManager.switchTo('menu');
  // unlock audio after first user gesture (browser policy)
  const unlock = () => {
    AudioManager.resume();
    AudioManager.startMusic();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  loop(performance.now());
}

// ---------- Main loop ----------
let last = 0;
function loop(now) {
  let dt = (now - last) / 1000;
  if (dt > 0.05) dt = 0.05; // clamp big jumps (e.g. tab inactive)
  last = now;

  SceneManager.update(dt);

  // clear & draw
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0524';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  SceneManager.draw(ctx);

  requestAnimationFrame(loop);
}

boot();

// ---------- PWA service worker ----------
// network-first SW makes new deploys reach players without a hard refresh,
// and enables install-to-home-screen + offline play.
// Skipped on localhost so it never interferes with local development.
{
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  if ('serviceWorker' in navigator && !isLocal) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}
