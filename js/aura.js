/* ==========================================================================
   ADRIÁN BIRNBAUN — PORTFOLIO
   aura.js · a dithered hand holding a glowing sphere (home preview)

   The hand is a photo turned into a luminance map (assets/aura/hand.png);
   the sphere is drawn live, so it can turn, breathe and react. Every frame
   both are pushed through a 4×4 ordered (Bayer) dither into four tones of
   cobalt and white, then scaled up with crisp square dots.

   Loop:  the sphere turns slowly, pulses, sheds a few motes of light, and
          its light breathes on the fingertips. Hovering a nav word
          gathers a little more energy.
   Click: on PROJECTS / ABOUT ME / CONTACT the loop ends — the sphere
          flares open, the hand fades, and the page follows the link.

   Placement: centred on the page, the sphere floating in the middle behind
   the words and the wrist leaving through the bottom edge. The palette tops
   out at a mid periwinkle (no white dots), so the white type keeps its
   contrast over it. The release is a shockwave that crosses the whole page.

   prefers-reduced-motion → still frame, links navigate immediately.
   ========================================================================== */

(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (v) { return (v + 0.5) / 16; });
  /* tone 0 is "no dot"; 1–4 run from deep cobalt to near white */
  var TONES = [null, [22, 32, 104], [40, 58, 180], [70, 96, 240], [146, 166, 255]];
  /* where the removed sphere sat in hand.png (fractions of the image width/height) */
  var SPHERE = { nx: 0.5029, ny: 0.2398, nr: 0.2705 };
  var ART_RATIO = 420 / 742;        /* hand.png width / height */
  var CELL = 3;                     /* CSS px per dither dot */
  var LEAVE_MS = 1000;

  /* ---- cheap deterministic noise ---------------------------------------- */
  function hash(x, y) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 17, y * 2.1 - 9) * 0.3 + vnoise(x * 4.3 - 31, y * 4.3 + 5) * 0.15;
  }

  function Aura(canvas, image) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = image;
    this.t = 0;
    this.last = 0;
    this.raf = 0;
    this.energy = 0;          /* 0 rest … 1 a nav word is hovered */
    this.energyTarget = 0;
    this.leaving = null;      /* time the release started */
    this.motes = [];
    this.reduced = global.matchMedia('(prefers-reduced-motion: reduce)');

    this.frame = this.frame.bind(this);
    this.schedule = this.schedule.bind(this);

    var self = this, timer = 0;
    var relayout = function () { clearTimeout(timer); timer = setTimeout(function () { self.layout(); self.render(); }, 100); };
    if (global.ResizeObserver) new ResizeObserver(relayout).observe(canvas);
    else global.addEventListener('resize', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

    document.addEventListener('visibilitychange', this.schedule);
    if (this.reduced.addEventListener) this.reduced.addEventListener('change', this.schedule);

    /* back/forward cache: coming back to the page starts the loop again */
    global.addEventListener('pageshow', function (e) {
      if (e.persisted) { self.leaving = null; self.canvas.classList.remove('is-leaving'); self.schedule(); }
    });

    this.bindNav();
    this.layout();
    this.render();
    this.schedule();
  }

  /* ---- placement, measured from the words --------------------------------- */
  Aura.prototype.layout = function () {
    var rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    var W = this.W = rect.width, H = this.H = rect.height;
    var dpr = this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);

    /* centred: the orb floats in the middle of the page, the wrist leaves
       through the bottom edge */
    var artH = Math.min(H * 1.28, (W * 0.86) / ART_RATIO);
    var artW = artH * ART_RATIO;
    var sr = SPHERE.nr * artW;
    var scx = W / 2;
    /* the orb sits on the middle of the word block */
    var scy = H * 0.5, words = document.querySelectorAll('.nav .word');
    if (words.length) {
      var t0 = words[0].getBoundingClientRect(), t1 = words[words.length - 1].getBoundingClientRect();
      scy = (t0.top + t1.bottom) / 2;
    }
    var top = scy - SPHERE.ny * artH;
    if (top + artH < H) { top = H - artH; scy = top + SPHERE.ny * artH; }
    this.art = { x: scx - SPHERE.nx * artW, y: top, w: artW, h: artH };
    this.sphere = { x: scx, y: scy, r: sr };
    /* how far the shockwave has to travel to leave every corner */
    this.reach = Math.max(Math.hypot(scx, scy), Math.hypot(W - scx, scy),
                          Math.hypot(scx, H - scy), Math.hypot(W - scx, H - scy));

    /* the dithered region is the whole page: the wave crosses all of it */
    var a = this.art, x0 = 0, y0 = 0, x1 = W, y1 = H;
    this.fadeSides = { l: false, r: false, t: false, b: false };
    var gw = this.gw = Math.max(1, Math.ceil((x1 - x0) / CELL));
    var gh = this.gh = Math.max(1, Math.ceil((y1 - y0) / CELL));
    this.region = { x: x0, y: y0, w: gw * CELL, h: gh * CELL };

    /* hand luminance sampled onto the dither grid */
    var src = document.createElement('canvas');
    src.width = gw; src.height = gh;
    var sc = src.getContext('2d');
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(this.image, (a.x - x0) / CELL, (a.y - y0) / CELL, a.w / CELL, a.h / CELL);
    var px = sc.getImageData(0, 0, gw, gh).data;
    var lum = this.hand = new Float32Array(gw * gh);
    for (var k = 0; k < gw * gh; k++) {
      var l0 = px[k * 4] / 255;
      lum[k] = l0 < 0.09 ? 0 : (l0 - 0.09) / 0.91;   /* black point: no stray speckle */
    }

    this.grid = document.createElement('canvas');
    this.grid.width = gw; this.grid.height = gh;
    this.gctx = this.grid.getContext('2d');
    this.pixels = this.gctx.createImageData(gw, gh);

    /* a dot mask: erase a 1px line between cells so they read as dots */
    var m = document.createElement('canvas');
    m.width = CELL * dpr; m.height = CELL * dpr;
    var mc = m.getContext('2d');
    mc.fillStyle = '#000';
    mc.fillRect(m.width - dpr, 0, dpr, m.height);
    mc.fillRect(0, m.height - dpr, m.width, dpr);
    this.mask = this.ctx.createPattern(m, 'repeat');
  };

  /* ---- motes of light shed by the sphere ---------------------------------- */
  Aura.prototype.spawnMote = function (burst) {
    var s = this.sphere, ang = Math.random() * TAU;
    var sp = burst ? 120 + Math.random() * 380 : 6 + Math.random() * 14;
    this.motes.push({
      x: s.x + Math.cos(ang) * s.r * 1.02, y: s.y + Math.sin(ang) * s.r * 1.02,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (burst ? 0 : 8),
      life: 0, max: burst ? 0.6 + Math.random() * 0.5 : 2.5 + Math.random() * 3, b: 0.55 + Math.random() * 0.45
    });
  };

  Aura.prototype.render = function () {
    if (!this.hand) return;
    var ctx = this.ctx, t = this.t, s = this.sphere, R = this.region;
    var gw = this.gw, gh = this.gh, data = this.pixels.data, hand = this.hand;

    /* release: 0 → 1 over LEAVE_MS */
    var out = 0;
    if (this.leaving !== null) out = Math.min(1, (performance.now() - this.leaving) / LEAVE_MS);
    var outE = 1 - Math.pow(1 - out, 3);

    var pulse = 0.5 + 0.5 * Math.sin(t * 1.25);
    var energy = this.energy;
    var bob = Math.sin(t * 0.9) * s.r * 0.035;
    var sx = s.x, sy = s.y + bob;
    var sr = s.r * (1 + 0.015 * pulse + 0.04 * energy + 1.5 * outE);
    /* the shockwave: from the orb to past the farthest corner */
    var ringP = 1 - Math.pow(1 - out, 1.2);   /* steadier than outE: you see it travel */
    var ringW = s.r * (0.14 + 0.55 * ringP);
    var ringR = s.r + ringP * (this.reach + ringW * 2.2);
    var ringA = 1.15 * (1 - 0.45 * out) * Math.min(1, out * 6);
    this.wave = this.leaving === null ? null : { x: sx, y: sy, r: ringR, w: ringW, a: ringA };
    var handLight = (0.8 + 0.2 * pulse + 0.15 * energy) * (1 - Math.min(1, out * 1.6));
    var glowAmp = 0.34 + 0.12 * pulse + 0.18 * energy;
    var spin = t * 0.28;
    var tick = Math.floor(t * 7);

    /* motes into a sparse lookup */
    var moteMap = {};
    for (var m = 0; m < this.motes.length; m++) {
      var mo = this.motes[m];
      var gx0 = Math.floor((mo.x - R.x) / CELL), gy0 = Math.floor((mo.y - R.y) / CELL);
      if (gx0 < 0 || gy0 < 0 || gx0 >= gw || gy0 >= gh) continue;
      var fade = Math.sin(Math.PI * Math.min(1, mo.life / mo.max));
      var key = gy0 * gw + gx0;
      moteMap[key] = Math.max(moteMap[key] || 0, mo.b * fade);
    }

    for (var gy = 0; gy < gh; gy++) {
      var y = R.y + (gy + 0.5) * CELL;
      for (var gx = 0; gx < gw; gx++) {
        var i = gy * gw + gx;
        var x = R.x + (gx + 0.5) * CELL;
        var v = hand[i] * handLight;

        var dx = x - sx, dy = y - sy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < sr) {
          /* a lit, slowly turning sphere: limb darkening + drifting texture */
          var q = d / sr, nz = Math.sqrt(1 - q * q);
          var lon = Math.atan2(dx, nz * sr) + spin;
          var lat = Math.asin(Math.max(-1, Math.min(1, dy / sr)));
          var tex = fbm(lon * 2.4 + 40, lat * 2.4 + t * 0.05);
          var sv = 0.46 + 0.46 * nz + 0.34 * (tex - 0.5) + 0.1 * pulse + 0.12 * energy;
          sv *= 1 - outE;                       /* the core empties as it opens */
          v = Math.max(v, sv);
        } else {
          /* halo */
          /* a tight halo that dies well before the words */
          var gl = Math.exp(-(d - sr) / (s.r * (0.16 + 0.25 * outE))) * glowAmp * (1 - outE) - 0.035;
          if (gl > 0) v += gl;
        }

        if (out) {                                /* the shockwave */
          var rd = (d - ringR) / ringW;
          v += Math.exp(-rd * rd) * ringA;
          /* a thinner echo just behind it, and a faint wash inside */
          var rd2 = (d - ringR * 0.82) / (ringW * 0.45);
          v += Math.exp(-rd2 * rd2) * ringA * 0.45;
          if (d < ringR) v += 0.05 * (1 - ringP);
        }

        var mv = moteMap[i];
        if (mv) v = Math.max(v, mv);

        /* living dither: a faint shimmer on the threshold */
        if (v > 0.06) v += (hash(gx * 7 + tick, gy * 13 - tick) - 0.5) * 0.05;
        if (out) v *= 1 - Math.max(0, out - 0.8) / 0.2;    /* the last moment: everything goes */
        var fs = this.fadeSides, edge = 1;
        if (fs.l) edge = Math.min(edge, gx / 14);
        if (fs.r) edge = Math.min(edge, (gw - 1 - gx) / 14);
        if (fs.t) edge = Math.min(edge, gy / 14);
        if (fs.b) edge = Math.min(edge, (gh - 1 - gy) / 14);
        if (edge < 1) v *= Math.max(0, edge);

        var idx = Math.floor(v * 4 + BAYER[(gx & 3) + ((gy & 3) << 2)]);
        var p = i * 4;
        if (idx <= 0) { data[p + 3] = 0; continue; }
        if (idx > 4) idx = 4;
        var c = TONES[idx];
        data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 255;
      }
    }

    this.gctx.putImageData(this.pixels, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.grid, R.x, R.y, R.w, R.h);
    /* cut the gaps between dots */
    ctx.globalCompositeOperation = 'destination-out';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.mask;
    ctx.save();
    ctx.translate(Math.round(R.x * this.dpr), Math.round(R.y * this.dpr));
    ctx.fillRect(0, 0, Math.ceil(R.w * this.dpr), Math.ceil(R.h * this.dpr));
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  };

  Aura.prototype.step = function (dt) {
    this.t += dt;
    var k = 1 - Math.exp(-3 * dt);
    this.energy += (this.energyTarget - this.energy) * k;

    if (this.leaving === null && this.motes.length < 26 && Math.random() < dt * 5) this.spawnMote(false);
    for (var i = this.motes.length - 1; i >= 0; i--) {
      var m = this.motes[i];
      m.life += dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.vy -= 3 * dt;                    /* motes rise, like warm air */
      if (m.life > m.max) this.motes.splice(i, 1);
    }
  };

  Aura.prototype.frame = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  Aura.prototype.schedule = function () {
    cancelAnimationFrame(this.raf);
    if (document.hidden) return;
    if (this.reduced.matches && this.leaving === null) { this.t = 1.2; this.render(); return; }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  /* ---- the three options end the loop ------------------------------------- */
  Aura.prototype.bindNav = function () {
    var self = this;
    document.querySelectorAll('.nav__link').forEach(function (link) {
      link.addEventListener('pointerenter', function () { self.energyTarget = 1; });
      link.addEventListener('pointerleave', function () { self.energyTarget = 0; });
      link.addEventListener('focus', function () { self.energyTarget = 1; });
      link.addEventListener('blur', function () { self.energyTarget = 0; });
      link.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (self.reduced.matches || self.leaving !== null) return;   /* go straight there */
        e.preventDefault();
        var href = link.href;
        self.leaving = performance.now();
        for (var n = 0; n < 70; n++) self.spawnMote(true);
        self.canvas.classList.add('is-leaving');
        document.body.classList.add('aura-leaving');
        self.schedule();
        setTimeout(function () { global.location.href = href; }, LEAVE_MS);
      });
    });
  };

  global.AuraBackground = Aura;

  var start = function () {
    var canvas = document.querySelector('canvas.aura');
    if (!canvas) return;
    var img = new Image();
    img.onload = function () {
      try { global.__aura = new Aura(canvas, img); } catch (err) { canvas.remove(); }
    };
    img.onerror = function () { canvas.remove(); };
    img.src = global.AURA_HAND || canvas.getAttribute('data-src');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}(window));
