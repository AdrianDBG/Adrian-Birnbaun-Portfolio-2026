/* ==========================================================================
   ADRIÁN BIRNBAUN — PORTFOLIO
   ocean.js · the field of drifting dots behind the home page

   No characters, no sprites: every dot is 1–3 px drawn on a canvas. They
   drift on a slow, divergence-free current (so they never bunch up in a
   corner) and scatter away from the pointer.

   Exposed as window.FishField; js/main.js starts it on index.html.
   ========================================================================== */

(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  /* One fish per this many pixels of canvas, within the bounds below. */
  var DENSITY = 3100;
  var MIN_FISH = 60;
  var MAX_FISH = 620;

  var FLEE_RADIUS = 170;     /* px — how far the cursor pushes */
  var FLEE_FORCE = 260;      /* px/s added at the very centre */
  var STEP = 1 / 60;

  /* Divergence-free current: the curl of a slowly drifting stream function.
     Same idea as a flow field, but with no sources or sinks. */
  var K1 = 1 / 260, K2 = 1 / 310, K3 = 1 / 190, CURRENT = 2600;

  function currentX(x, y, t) {
    return (-K2 * Math.sin(x * K1 + t * 0.07) * Math.sin(y * K2 - t * 0.05)
      + 0.5 * K3 * Math.cos((x + y) * K3 + t * 0.11)) * CURRENT;
  }

  function currentY(x, y, t) {
    return (-K1 * Math.cos(x * K1 + t * 0.07) * Math.cos(y * K2 - t * 0.05)
      - 0.5 * K3 * Math.cos((x + y) * K3 + t * 0.11)) * CURRENT;
  }

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  function FishField(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fish = [];
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.last = 0;
    this.acc = 0;
    this.raf = 0;
    this.visible = true;
    this.pointer = { x: 0, y: 0, active: false };
    this.reduced = global.matchMedia('(prefers-reduced-motion: reduce)');

    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerOut = this.onPointerOut.bind(this);
    this.onMotion = this.onMotion.bind(this);
    this.onVisibility = this.onVisibility.bind(this);

    if (global.ResizeObserver) {
      this.ro = new ResizeObserver(this.resize);
      this.ro.observe(canvas);
    } else {
      global.addEventListener('resize', this.resize);
    }
    if (global.IntersectionObserver) {
      this.io = new IntersectionObserver(function (entries) {
        this.visible = entries[0].isIntersecting;
        this.schedule();
      }.bind(this));
      this.io.observe(canvas);
    }

    global.addEventListener('pointermove', this.onPointerMove, { passive: true });
    global.addEventListener('pointerdown', this.onPointerMove, { passive: true });
    global.addEventListener('blur', this.onPointerOut);
    document.documentElement.addEventListener('pointerleave', this.onPointerOut);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.reduced.addEventListener) this.reduced.addEventListener('change', this.onMotion);

    this.resize();
    this.schedule();
  }

  FishField.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var wanted = Math.round(rect.width * rect.height / DENSITY);
    wanted = Math.max(MIN_FISH, Math.min(MAX_FISH, wanted));
    while (this.fish.length > wanted) this.fish.pop();
    while (this.fish.length < wanted) this.fish.push(this.spawn());

    if (this.reduced.matches) this.drawStill();
  };

  FishField.prototype.spawn = function () {
    var angle = rand(0, TAU);
    /* depth: 0 = far and faint, 1 = near, bigger and brighter */
    var depth = Math.pow(Math.random(), 1.6);
    var cruise = rand(16, 30) + depth * 16;
    return {
      x: rand(0, this.width || 1),
      y: rand(0, this.height || 1),
      vx: Math.cos(angle) * cruise,
      vy: Math.sin(angle) * cruise,
      angle: angle,
      cruise: cruise,
      size: 0.85 + depth * 1.5,
      alpha: 0.26 + depth * 0.56,
      wander: rand(0, TAU),
      wanderRate: rand(-0.5, 0.5)
    };
  };

  FishField.prototype.step = function (dt) {
    this.time += dt;

    var t = this.time;
    var pointer = this.pointer;
    var margin = 24;
    var W = this.width, H = this.height;

    for (var i = 0; i < this.fish.length; i++) {
      var f = this.fish[i];

      /* Where it would like to go: the current, plus a slow wander. */
      f.wander += f.wanderRate * dt;
      var dx = currentX(f.x, f.y, t) + Math.cos(f.wander) * 14;
      var dy = currentY(f.x, f.y, t) + Math.sin(f.wander) * 14;

      /* Normalise to its cruising speed. */
      var len = Math.hypot(dx, dy) || 1;
      dx = dx / len * f.cruise;
      dy = dy / len * f.cruise;

      /* Flee: strongest at the cursor, nothing past FLEE_RADIUS. */
      if (pointer.active) {
        var ax = f.x - pointer.x;
        var ay = f.y - pointer.y;
        var d = Math.hypot(ax, ay);
        if (d < FLEE_RADIUS) {
          var push = 1 - d / FLEE_RADIUS;
          push *= push;
          if (d < 0.001) { ax = Math.cos(f.angle); ay = Math.sin(f.angle); d = 1; }
          dx += ax / d * FLEE_FORCE * push;
          dy += ay / d * FLEE_FORCE * push;
        }
      }

      /* Ease the velocity towards that, so turns are smooth. */
      var k = 1 - Math.exp(-3.4 * dt);
      f.vx += (dx - f.vx) * k;
      f.vy += (dy - f.vy) * k;

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.angle = Math.atan2(f.vy, f.vx);

      /* Wrap around the edges. */
      if (f.x < -margin) f.x += W + margin * 2;
      else if (f.x > W + margin) f.x -= W + margin * 2;
      if (f.y < -margin) f.y += H + margin * 2;
      else if (f.y > H + margin) f.y -= H + margin * 2;
    }
  };

  FishField.prototype.render = function () {
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    for (var i = 0; i < this.fish.length; i++) {
      var f = this.fish[i];
      ctx.fillStyle = 'rgba(236, 240, 248, ' + f.alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, TAU);
      ctx.fill();
    }
  };

  FishField.prototype.frame = function (now) {
    var dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;

    var steps = 0;
    while (this.acc >= STEP && steps < 4) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 4) this.acc = 0;

    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  FishField.prototype.schedule = function () {
    cancelAnimationFrame(this.raf);
    if (!this.visible || document.hidden || this.reduced.matches) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  /* Reduced motion: let the school spread out, then show one still frame. */
  FishField.prototype.drawStill = function () {
    if (this.time < 3) for (var i = 0; i < 180; i++) this.step(STEP);
    this.render();
  };

  FishField.prototype.onPointerMove = function (event) {
    if (event.pointerType === 'touch') return;
    var rect = this.canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  };

  FishField.prototype.onPointerOut = function () {
    this.pointer.active = false;
  };

  FishField.prototype.onVisibility = function () {
    this.schedule();
  };

  FishField.prototype.onMotion = function () {
    if (this.reduced.matches) {
      cancelAnimationFrame(this.raf);
      this.drawStill();
    } else {
      this.schedule();
    }
  };

  global.FishField = FishField;
}(window));
