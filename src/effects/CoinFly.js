// CoinFly — a stream of golden coins that arc from a source point into the
// wallet target, with staggered launch, eased bezier flight, and a flip spin.
// Coordinates are in play-area space (same as the particle system).

import { AssetManager, COIN_SRC } from '../managers/AssetManager.js';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CoinFly {
  constructor() {
    this.coins = [];
  }

  /**
   * @param {number} n        number of coins
   * @param {number} fromX,fromY  launch point (play-area coords)
   * @param {number} toX,toY      wallet target (play-area coords)
   * @param {object} opts     { stagger, dur, onArrive, onAllDone, radius }
   */
  spawn(n, fromX, fromY, toX, toY, opts = {}) {
    const stagger = opts.stagger ?? 0.045;
    const dur = opts.dur ?? 0.72;
    const radius = opts.radius ?? 9;
    let remaining = n;
    for (let i = 0; i < n; i++) {
      const sx = fromX + (Math.random() - 0.5) * 40;
      const sy = fromY + (Math.random() - 0.5) * 40;
      // control point: lift upward + slight lateral arc
      const midX = (sx + toX) / 2 + (Math.random() - 0.5) * 120;
      const midY = Math.min(sy, toY) - (60 + Math.random() * 120);
      this.coins.push({
        sx, sy, toX, toY, cx: midX, cy: midY,
        t: -i * stagger,
        dur: dur + Math.random() * 0.12,
        radius,
        rot: Math.random() * Math.PI,
        rotVel: 10 + Math.random() * 8,
        arrived: false,
        onArrive: () => {
          if (opts.onArrive) opts.onArrive();
          remaining--;
          if (remaining === 0 && opts.onAllDone) opts.onAllDone();
        },
        x: sx, y: sy, scaleX: 1,
      });
    }
  }

  get active() { return this.coins.length > 0; }

  update(dt) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt / c.dur;
      c.rot += c.rotVel * dt;
      c.scaleX = Math.abs(Math.cos(c.rot)) * 0.85 + 0.15; // flip illusion
      if (c.t < 0) { c.x = c.sx; c.y = c.sy; continue; }
      if (c.t >= 1) {
        c.arrived = true;
        c.onArrive && c.onArrive();
        this.coins.splice(i, 1);
        continue;
      }
      const e = easeInOutCubic(c.t);
      const u = 1 - e;
      c.x = u * u * c.sx + 2 * u * e * c.cx + e * e * c.toX;
      c.y = u * u * c.sy + 2 * u * e * c.cy + e * e * c.toY;
    }
  }

  draw(ctx) {
    const img = AssetManager.get(COIN_SRC);
    for (const c of this.coins) {
      if (c.t < 0) continue;
      const r = c.radius;
      ctx.save();
      ctx.translate(c.x, c.y);

      // soft glow (drawn before the flip scale so it stays round)
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(255, 211, 92, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.scale(Math.max(0.18, c.scaleX), 1); // flip illusion

      if (img && img.complete && img.naturalWidth) {
        const s = r * 2.3;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
      } else {
        // fallback: drawn gold disc
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
        g.addColorStop(0, '#fff2b8');
        g.addColorStop(0.5, '#ffd35c');
        g.addColorStop(1, '#e6a121');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 110, 20, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  clear() { this.coins.length = 0; }
}
