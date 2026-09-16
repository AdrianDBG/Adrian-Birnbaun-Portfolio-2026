/* ========================================================================== 
  ADRIÁN BIRNBAUN — PORTFOLIO
  main.js · v1
  ========================================================================== */

(function () {
  'use strict';

  const canvas = document.querySelector('.grain');
  const tickers = document.querySelectorAll('.ticker');
  const closeLink = document.querySelector('.page-close, .contact-close, .about-close, .projects-close');

  let isClosing = false;
  let dialogOwnedEscape = false;
  const isHomePage = /(?:^|\/)index\.html?$/.test(window.location.pathname);
  const closePage = function (event) {
    const isEscape = event.key === 'Escape'
      || event.key === 'Esc'
      || event.code === 'Escape'
      || event.which === 27
      || event.keyCode === 27;
    if (!isEscape || event.repeat || isClosing || isHomePage) return;

    /* An open dialog owns this ESC (its own handler closes it). */
    if (document.querySelector('dialog[open]')) return;
    /* Ignore an ESC that started on the previous page: its keyup/repeat
       can land here right after navigating (that used to bounce projects → home). */
    if (performance.now() < 600) return;

    isClosing = true;
    event.preventDefault();
    event.stopPropagation();
    goBack();
  };

  /* Close = go back one step (projects → home, project page → projects…).
     When the page was opened directly (no site history to return to),
     fall back to the close link's own destination. */
  /* Remember, per tab, that the visitor is browsing inside the portfolio.
     document.referrer is empty on file:// and on some hosts, so it can't be
     trusted on its own. */
  let cameFromSite = false;
  try {
    cameFromSite = sessionStorage.getItem('ab-nav') === '1'
      || (!!document.referrer && new URL(document.referrer).origin === window.location.origin);
    sessionStorage.setItem('ab-nav', '1');
  } catch (e) { /* storage blocked */ }
  const goBack = function () {
    const fallback = closeLink?.getAttribute('href') || 'index.html';
    /* inside a project, ESC / close always opens the projects page */
    /* ESC / close always goes to a fixed place: project → projects, projects/about/contact → home */
    window.location.assign(fallback); return;
    if (window.history.length > 1 && cameFromSite) {
      let left = false;
      const mark = function () { left = true; };
      window.addEventListener('pagehide', mark, { once: true });
      window.addEventListener('popstate', mark, { once: true });
      window.history.back();
      /* only if the browser really didn't move (e.g. no previous entry) */
      window.setTimeout(function () { if (!left) window.location.assign(fallback); }, 1500);
    } else {
      window.location.assign(fallback);
    }
  };

  if (closeLink) {
    closeLink.addEventListener('click', function (event) {
      event.preventDefault();
      isClosing = true;
      goBack();
    });
  }

  window.addEventListener('keydown', closePage, true);

  /* --------------------------------------------------------------------
     Projects field — pieces can be dragged anywhere inside the field.
     A press that moves less than 6px is a click and follows the link;
     anything more is a drag and the click is swallowed.
     -------------------------------------------------------------------- */
  const field = document.querySelector('.projects-field');

  if (field && window.matchMedia('(min-width: 40rem)').matches) {
    const DRAG_THRESHOLD = 6;
    let zTop = 1;

    field.querySelectorAll('.piece').forEach(function (piece) {
      const link = piece.querySelector('.piece__link');
      let start = null;
      let moved = false;

      /* No pointer capture: the click must still land on the link. Move and
         release are tracked on the document while a press is in progress. */
      const onMove = function (event) {
        if (!start) return;
        const dx = event.clientX - start.pointerX;
        const dy = event.clientY - start.pointerY;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

        if (!moved) {
          moved = true;
          piece.classList.add('is-dragging');
        }

        const bounds = field.getBoundingClientRect();
        const size = piece.getBoundingClientRect();
        let x = event.clientX - bounds.left - start.offsetX;
        let y = event.clientY - bounds.top - start.offsetY;
        x = Math.max(0, Math.min(bounds.width - size.width, x));
        y = Math.max(0, Math.min(bounds.height - size.height, y));

        piece.style.setProperty('--x', (x / bounds.width * 100).toFixed(2) + '%');
        piece.style.setProperty('--y', (y / bounds.height * 100).toFixed(2) + '%');
      };

      const onRelease = function () {
        start = null;
        piece.classList.remove('is-dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onRelease);
        document.removeEventListener('pointercancel', onRelease);
      };

      piece.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return;
        const rect = piece.getBoundingClientRect();
        start = {
          pointerX: event.clientX,
          pointerY: event.clientY,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top
        };
        moved = false;
        piece.style.zIndex = String(++zTop);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onRelease);
        document.addEventListener('pointercancel', onRelease);
      });

      link.addEventListener('click', function (event) {
        if (moved) {
          event.preventDefault();   /* it was a drag, not a click */
          moved = false;
        }
      });

      link.addEventListener('dragstart', function (event) {
        event.preventDefault();     /* no ghost image from the native link drag */
      });
    });
  }

  /* --------------------------------------------------------------------
     Back to top — shown after one screen of scrolling; smooth unless the
     visitor prefers reduced motion.
     -------------------------------------------------------------------- */
  const toTop = document.querySelector('.to-top');

  if (toTop) {
    const reducedScroll = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ticking = false;

    const update = function () {
      toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.8);
      ticking = false;
    };

    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();

    toTop.addEventListener('click', function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedScroll ? 'auto' : 'smooth' });
      const close = document.querySelector('.page-close');
      if (close) close.focus({ preventScroll: true });
    });
  }

  /* --------------------------------------------------------------------
     Lightbox — case-study figures open full screen; ← → move, ESC closes.
     -------------------------------------------------------------------- */
  const lightbox = document.querySelector('.lightbox');
  const figures = Array.from(document.querySelectorAll('.case-figure'));

  if (lightbox && figures.length && typeof lightbox.showModal === 'function') {
    const image = lightbox.querySelector('.lightbox__image');
    const caption = lightbox.querySelector('[data-lightbox-caption]');
    const count = lightbox.querySelector('[data-lightbox-count]');
    const pad = function (n) { return String(n).padStart(2, '0'); };
    let index = 0;
    let opener = null;

    function show(i) {
      index = (i + figures.length) % figures.length;
      const figure = figures[index];
      const source = figure.querySelector('img');
      const text = figure.querySelector('figcaption');
      const section = figure.closest('.case-section');
      const title = section ? section.querySelector('.case-section__title') : null;
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      caption.textContent = (title ? title.textContent.replace(/^\d+\s*/, '') + ' — ' : '') + (text ? text.textContent : '');
      count.textContent = pad(index + 1) + ' / ' + pad(figures.length);
    }

    figures.forEach(function (figure, i) {
      figure.querySelector('.case-figure__button').addEventListener('click', function (event) {
        opener = event.currentTarget;
        show(i);
        lightbox.showModal();
      });
    });

    lightbox.querySelectorAll('[data-lightbox-dir]').forEach(function (arrow) {
      arrow.addEventListener('click', function () {
        show(index + Number(arrow.dataset.dir));
      });
    });

    lightbox.querySelector('[data-lightbox-close]').addEventListener('click', function () {
      lightbox.close();
    });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) lightbox.close();   /* click on the dark = close */
    });

    lightbox.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') show(index + 1);
      if (event.key === 'ArrowLeft') show(index - 1);
    });

    lightbox.addEventListener('close', function () {
      image.src = '';
      if (opener) opener.focus();
    });
  }

  if (canvas) {
    const context = canvas.getContext('2d');
    const particles = [];
    const pointer = { x: 0, y: 0, active: false };
    const attractionRadius = 150;
    const maximumDisplacement = 24;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particleColor = getComputedStyle(document.body)
      .getPropertyValue('--grain-particle-color').trim() || '242, 242, 242';
    let pixelRatio = 1;
    let animationFrame;

    function createParticle() {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;

      return {
        originX: x,
        originY: y,
        x: x,
        y: y,
        velocityX: 0,
        velocityY: 0,
        size: 0.35 + Math.random() * 0.85,
        alpha: 0.12 + Math.random() * 0.38
      };
    }

    function resizeCanvas() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * pixelRatio);
      canvas.height = Math.floor(window.innerHeight * pixelRatio);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const count = Math.min(2200, Math.max(500, Math.floor(
        (window.innerWidth * window.innerHeight) / 1100
      )));
      particles.length = 0;
      for (let index = 0; index < count; index++) {
        particles.push(createParticle());
      }
    }

    function drawParticles() {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      particles.forEach(function (particle) {
        let targetX = particle.originX;
        let targetY = particle.originY;

        if (pointer.active) {
          const deltaX = pointer.x - particle.originX;
          const deltaY = pointer.y - particle.originY;
          const distance = Math.hypot(deltaX, deltaY);

          if (distance < attractionRadius && distance > 0) {
            const falloff = 1 - distance / attractionRadius;
            const displacement = maximumDisplacement * falloff * falloff;
            targetX += (deltaX / distance) * displacement;
            targetY += (deltaY / distance) * displacement;
          }
        }

        particle.velocityX += (targetX - particle.x) * 0.075;
        particle.velocityY += (targetY - particle.y) * 0.075;
        particle.velocityX *= 0.78;
        particle.velocityY *= 0.78;
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;

        context.fillStyle = 'rgba(' + particleColor + ', ' + particle.alpha + ')';
        context.fillRect(particle.x, particle.y, particle.size, particle.size);
      });

      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(drawParticles);
      }
    }

    window.addEventListener('pointermove', function (event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      pointer.active = false;
    }, { passive: true });

    window.addEventListener('resize', resizeCanvas, { passive: true });
    resizeCanvas();
    drawParticles();

    window.addEventListener('pagehide', function () {
      window.cancelAnimationFrame(animationFrame);
    }, { once: true });
  }

  if (!tickers.length) return;

  /**
   * Build (or rebuild) the two identical halves of one ticker.
   * @param {HTMLElement} ticker  the .ticker element (has data-text)
   */
  function buildTicker(ticker) {
    const text  = ticker.dataset.text || '';
    const track = ticker.querySelector('.ticker__track');
    if (!track || !text) return;

    // Start from a single item so we can measure its real width.
    track.innerHTML = '';
    const group = document.createElement('span');
    group.className = 'ticker__group';
    group.appendChild(makeItem(text));
    track.appendChild(group);

    const itemWidth = group.getBoundingClientRect().width || 1;
    const target    = ticker.getBoundingClientRect().width || window.innerWidth;

    // Enough copies to cover the visible width, plus one for safety.
    const copies = Math.ceil(target / itemWidth) + 1;
    for (let i = 1; i < copies; i++) {
      group.appendChild(makeItem(text));
    }

    // Second identical half → the -50% loop lands on an identical frame.
    track.appendChild(group.cloneNode(true));
  }

  /** One ticker text unit. Spacing comes from CSS (padding-inline-end). */
  function makeItem(text) {
    const item = document.createElement('span');
    item.textContent = text;
    return item;
  }

  function buildAll() {
    tickers.forEach(buildTicker);
  }

  // Build once fonts are ready so the measurement uses the real monospace.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(buildAll);
  } else {
    buildAll();
  }

  // Rebuild on resize (debounced) so coverage stays correct at any width.
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildAll, 150);
  }, { passive: true });
})();
