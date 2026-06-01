// Simple screen-shake utility: returns (offsetX, offsetY) at any time.

export class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.duration = 0;
    this.elapsed = 0;
  }

  trigger(intensity = 6, duration = 0.25) {
    if (intensity > this.intensity) {
      this.intensity = intensity;
      this.duration = duration;
      this.elapsed = 0;
    }
  }

  update(dt) {
    if (this.duration <= 0) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.intensity = 0;
      this.duration = 0;
      this.elapsed = 0;
    }
  }

  getOffset() {
    if (this.duration <= 0) return [0, 0];
    const t = 1 - this.elapsed / this.duration; // 1 → 0
    const i = this.intensity * t * t;
    return [(Math.random() * 2 - 1) * i, (Math.random() * 2 - 1) * i];
  }
}
