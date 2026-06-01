// SceneManager — switches between scenes (Menu, Game, GameOver, etc.).

class _SceneManager {
  constructor() {
    this.current = null;
    this.scenes = {};
    this.shared = {}; // ctx, canvas, etc.
  }

  register(name, scene) {
    this.scenes[name] = scene;
    scene._mgr = this;
  }

  setShared(s) {
    this.shared = { ...this.shared, ...s };
  }

  switchTo(name, payload) {
    const next = this.scenes[name];
    if (!next) throw new Error('Unknown scene: ' + name);
    if (this.current && this.current.exit) this.current.exit();
    this.current = next;
    if (this.current.enter) this.current.enter(payload || {});
  }

  update(dt) {
    if (this.current && this.current.update) this.current.update(dt);
  }

  draw(ctx) {
    if (this.current && this.current.draw) this.current.draw(ctx);
  }
}

export const SceneManager = new _SceneManager();
