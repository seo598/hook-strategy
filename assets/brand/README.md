# Brand assets

## Logo

The HOOK logo is currently **recreated in code** (an HTML/CSS lockup: forest-green
rounded tile + lime `HOOK` in the Fredoka rounded typeface + `الهوك` in Baloo
Bhaijaan 2). It renders in the nav, preloader, and footer via the `.logo` class
(see `assets/css/style.css`, section 5b). It's a close match to the official mark.

### To use the OFFICIAL logo (pixel-perfect)

1. Save the official file here as **`logo.svg`** (preferred) or `logo.png`
   (transparent, ≥ 512px). An all-lime "HOOK" variant on transparent is ideal for
   dark backgrounds; a forest-on-transparent variant helps on the warm-paper sections.
2. Tell me (or do it yourself): replace each `.logo` lockup span in `index.html`
   with `<img src="assets/brand/logo.svg" alt="Hook Strategy" class="logo-img">`
   and add `.logo-img { width: var(--logo-size); height: auto; }`.

Also drop in (optional, for sharing/icons):
- `og.jpg` — 1200×630 social-share image (referenced by the OG/Twitter meta tags)
- `favicon` source if you want to replace the inline SVG favicon
