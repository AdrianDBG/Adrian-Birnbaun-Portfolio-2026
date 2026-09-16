# Adrián Birnbaun — Portfolio

Hand-coded, no frameworks. HTML + CSS + vanilla JS.
Graphic, digital, web and UX/UI designer · Buenos Aires.

```
portfolio/
├── index.html            home (hero · nav · grain)
├── projects.html         draggable project field
├── about.html · contact.html
├── hipodromo.html · loula.html · undici.html   case studies
├── css/style.css         all styling, driven by tokens in :root
├── js/main.js            ticker, drag, lightbox, ESC = back
└── assets/
    ├── logo*.jpg         project icons
    ├── HIP/web · Loula/web · placas undici/web   case-study images
    ├── Orest/            OREST — outdoor & streetwear one page
    ├── Loula/site/       Loula — fintech one page (ES)
    ├── Barrow/           Barrow — environmental reports redesign
    ├── OLGA/site/        OLGA — termos & stickers one page (ES)
    └── Art gallery/      Side B — posters & illustrations gallery
```

Heavy originals and working files stay local and are excluded in `.gitignore`.

## How the hover works

Each nav link has two independent layers:

```
.nav__link
├── .word     ← the huge word: opacity 1 → 0.13, blur 0 → 5px on hover
└── .ticker   ← small white mono line, always sharp, opacity 0 → 1 on hover
```

Blur is applied to `.word` only, never to the link or item, so the ticker is
never affected. Sibling items never change.

## Tuning

Everything lives in `:root` at the top of `style.css`: colours, fonts, type
sizes, margins, hover opacity/blur, easing, ticker speed and gap, grain opacity.

Ticker text: the `data-text` attribute on each `.ticker` in `index.html`.

## Adding pages

The nav already points at `projects.html`, `about.html`, `contact.html`. Reuse the
header and footer markup, keep `--margin` for the grid, and add page-level CSS
in a new section of `style.css` (or a second stylesheet).

## Fonts

Archivo 900 (display) and JetBrains Mono 400 via Google Fonts, with system
fallbacks. Swap the `<link>` in `index.html` and the `--font-*` tokens to change.
