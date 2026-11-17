// Keyboard + mouse state with pointer lock. Game code reads intent from here,
// never from raw DOM events, so rebinding or pausing stays simple.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // consumed once per frame
    this.mouse = { dx: 0, dy: 0, left: false, leftPressed: false };
    this.locked = false;
    this.enabled = true;
    this.onLockChange = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;
      this.keys.add(code);
      this.pressed.add(code);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      if (code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = false; });

    window.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.leftPressed = true;
      if (e.button === 0) this.mouse.left = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.locked = false; });
  }

  lock() {
    if (this.locked) return;
    const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => this.canvas.requestPointerLock?.());
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  consume(code) { this.pressed.delete(code); }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.leftPressed = false;
  }

  clear() { this.keys.clear(); this.pressed.clear(); }
}
