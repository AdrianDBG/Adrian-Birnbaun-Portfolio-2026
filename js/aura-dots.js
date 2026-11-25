/* ==========================================================================
   aura-dots.js · home page (index.html)
   The same drifting dots as the live home (js/ocean.js, untouched), tinted
   periwinkle to match the hand, and carried outward by the sphere's
   shockwave when one of the three words is clicked.
   ========================================================================== */
(function (global) {
  'use strict';
  if (!global.FishField) return;
  var Base = global.FishField, TAU = Math.PI * 2;
  var RGB = '146, 166, 255';   /* the top tone of the hand's palette */

  function AuraDots(canvas) { this.lastWave = 0; Base.call(this, canvas); }
  AuraDots.prototype = Object.create(Base.prototype);
  AuraDots.prototype.constructor = AuraDots;

  AuraDots.prototype.render = function () {
    /* ride the shockwave: dots in its band move out with it */
    var aura = global.__aura, w = aura && aura.wave;
    if (w) {
      var dr = Math.max(0, w.r - (this.lastWave || w.r));
      this.lastWave = w.r;
      for (var i = 0; i < this.fish.length; i++) {
        var f = this.fish[i], ax = f.x - w.x, ay = f.y - w.y;
        var d = Math.hypot(ax, ay) || 1, k = (d - w.r) / (w.w * 1.4);
        var band = Math.exp(-k * k);
        f.x += ax / d * dr * band * 0.9;
        f.y += ay / d * dr * band * 0.9;
        f.glow = Math.max(f.glow || 0, band);
      }
    } else this.lastWave = 0;

    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    for (var j = 0; j < this.fish.length; j++) {
      var g = this.fish[j], glow = g.glow || 0;
      ctx.fillStyle = 'rgba(' + RGB + ', ' + Math.min(1, g.alpha + glow * 0.4).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.size * (1 + glow * 0.6), 0, TAU);
      ctx.fill();
      if (glow) g.glow = glow * 0.94;
    }
  };

  var start = function () {
    var canvas = document.querySelector('canvas.aura-dots');
    if (!canvas) return;
    try { new AuraDots(canvas); } catch (err) { canvas.remove(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}(window));
