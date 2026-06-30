# Hook Strategy — Interactive 3D Agency Site

A zero-build, production-ready immersive marketing-agency website. Cinematic
WebGL hero, smooth scroll, scroll-driven storytelling, and a full dark-mode
design system — **no Node, no bundler, no install required.**

Open `index.html` through any static server and it runs.

---

## ▶ Run it locally

This site uses native ES modules + CDN imports, so it must be served over
`http://` (not opened as a `file://` path — browsers block module loading there).

```bash
# from this folder
python -m http.server 5173
# then open http://localhost:5173
```

Any static server works (`npx serve`, VS Code "Live Server", etc.).

---

## 🧱 Tech (all via CDN — nothing to install)

| Concern            | Library            | Source        |
|--------------------|--------------------|---------------|
| 3D / WebGL         | Three.js r160      | jsDelivr (importmap) |
| Post-processing    | EffectComposer + UnrealBloom | jsDelivr |
| Smooth scroll      | Lenis 1.1          | esm.sh        |
| Motion / scroll    | GSAP + ScrollTrigger | esm.sh      |
| Shaders            | Custom GLSL (simplex noise, fresnel) | inline |

Everything **degrades gracefully**: if a CDN is unreachable, content still
reveals (IntersectionObserver fallback) and the hero falls back to a CSS
gradient if WebGL is blocked.

---

## 📁 Structure

```
hook-strategy/
├── index.html              # semantic markup, SEO meta, schema.org, importmap
├── robots.txt              # crawlers + AI bots welcomed
├── sitemap.xml
└── assets/
    ├── css/style.css       # design system: tokens → components → sections
    └── js/
        ├── hero.js         # Three.js scene + GLSL shaders + bloom
        └── main.js         # Lenis, cursor, reveals, counters, nav, form
```

---

## 🎨 Design system — The Hook brand

Extracted from the real brand (`@thehookstrategies`, thehookstrategy.com).

- **Color** — dark-first, green-tinted. Canvas `#0C140F`; brand forest green
  `#163C2B`; signature lime/chartreuse accent `#C8ED4A`; warm paper `#F4EFE4`.
  Extended (from photography/campaigns): mustard `#E8B04B`, terracotta
  `#C8623B`, indigo `#5A4FD6`. All tokens live in `:root`.
- **Type** — Bricolage Grotesque (display) + Inter (body), fluid `clamp()`
  scale. Headlines are **lowercase** to match the brand voice
  ("where great ideas take the bait.").
- **Rhythm** — dark sections with warm-paper editorial bands
  (`.section--paper`) for contrast.
- **Motion** — single `--ease` curve, scroll-triggered reveals, magnetic
  buttons, custom cursor, word-by-word statement, animated counters.
- **3D** — forest-green GLSL object with a lime fresnel rim + restrained
  bloom on a near-black-green canvas. Recolor via `uA/uB/uC` in `hero.js`.

---

## ⚡ Performance & a11y notes

- Pixel ratio capped (≤2 desktop, ≤1.5 mobile); WebGL pauses when the hero
  scrolls out of view or the tab is hidden.
- `prefers-reduced-motion` fully respected (static hero frame, no transitions).
- Particle counts and geometry detail scale down on mobile.
- Semantic landmarks, skip link, ARIA on nav/menu/form, keyboard-focusable.
- Custom cursor only activates on fine pointers; touch gets device-orientation
  parallax instead.

---

## 🚀 Sections built (flagship)

Hero · Brand statement · Services · Capabilities · Process · Featured work ·
Case study · Results/stats · Why · Industries · Tech · Testimonials · Awards ·
Team · FAQ · Blog · Contact · Footer — all present and styled; hero + core
story are fully polished. Swap the placeholder copy/gradients for real brand
assets, case-study media, and a form endpoint when ready.

---

## 🔜 Productionizing

- Replace gradient placeholders (`[data-grad]`) with real imagery/video
  (use `loading="lazy"` + responsive `srcset`).
- Point the contact form at a real endpoint (Formspree, your API, etc.).
- Add an `assets/img/og.jpg` (1200×630) for social sharing.
- Self-host fonts + pin CDN versions for offline/repeatable builds.
- If you later add Node, this maps cleanly onto Next.js + React Three Fiber.
