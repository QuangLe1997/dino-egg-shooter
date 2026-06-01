// Floating text popups (+5, +10, COMBO!) — animated on the canvas.

class Popup {
  constructor() {
    this.alive = false;
    this.x = 0;
    this.y = 0;
    this.vy = -80;
    this.text = '';
    this.color = '#fff';
    this.life = 0;
    this.maxLife = 1.0;
    this.size = 24;
    this.bold = true;
  }
}

const POOL = 64;

export class PopupSystem {
  constructor() {
    this.pool = Array.from({ length: POOL }, () => new Popup());
  }

  _spawn() {
    for (const p of this.pool) {
      if (!p.alive) { p.alive = true; return p; }
    }
    return null;
  }

  add(text, x, y, opts = {}) {
    const p = this._spawn();
    if (!p) return;
    p.text = String(text);
    p.x = x;
    p.y = y;
    p.vy = opts.vy ?? -80;
    p.maxLife = opts.life ?? 1.0;
    p.life = p.maxLife;
    p.color = opts.color ?? '#ffd166';
    p.size = opts.size ?? 22;
    p.bold = opts.bold ?? true;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.y += p.vy * dt;
      p.vy *= 0.97;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      const a = Math.min(1, t * 2); // fade out at end
      const s = 1 + (1 - t) * 0.4;
      ctx.globalAlpha = a;
      ctx.font = `${p.bold ? '900' : '700'} ${p.size * s}px -apple-system, "SF Pro", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.fillStyle = p.color;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }
}
