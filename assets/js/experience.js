/* =====================================================================
   HOOK STRATEGY — "The Crossing" (The Experience)
   A guided, hold-to-travel interactive tale in the spirit of Make Me Pulse's
   2019 "Nomadic Tribe": a start gate that unlocks a generative Web-Audio
   soundscape, then a meditative Three.js journey across dark water toward a
   new land — told in FOUR chapters. You PRESS AND HOLD to travel; release to
   rest at each shore, where the chapter's words settle in; hold again to
   continue. Tap / space / dots / arrows also work, and reduced-motion +
   no-WebGL fall back gracefully. Self-contained — no dependency on main.js.
   Content/SEO/a11y never depend on WebGL: the story is real DOM text.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('xp-canvas');

/* Four shores of the crossing — mood per chapter, blended by journey position.
   sky/fog = the water & air; ember = drifting motes; glow = island light;
   beacon = the leading "idea" light; amb = ambient fill. */
const CH = [
  { sky: 0x03110a, fog: 0.052, ember: 0x6fae74, glow: 0x2c6b3f, beacon: 0.45, amb: 0.22 }, // 0 open water — adrift
  { sky: 0x06170d, fog: 0.045, ember: 0xd8f404, glow: 0xd8f404, beacon: 1.35, amb: 0.40 }, // 1 the spark — the hook
  { sky: 0x083019, fog: 0.036, ember: 0x7cffb2, glow: 0x30cc64, beacon: 1.00, amb: 0.58 }, // 2 the crossing — the tribe
  { sky: 0x0b3f22, fog: 0.026, ember: 0xd8f404, glow: 0xa6ff5a, beacon: 1.55, amb: 0.78 }, // 3 new land — growth
];
const N = 4;
const anchorPos = (i) => (N > 1 ? i / (N - 1) : 0);

function isWebGLBlocked() {
  try { const c = document.createElement('canvas'); return !(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return true; }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ------------------------------------------------------------------ *
 * Generative Web-Audio soundscape (no audio files, no licensing).
 * Built lazily on the first user gesture so autoplay policy is honoured.
 * A calm evolving drone + sparse pentatonic bells + filtered wind.
 * ------------------------------------------------------------------ */
const Audio = (() => {
  let ctx = null, master = null, voices = [], wind = null, arpTimer = null, built = false, on = true;
  const PENT = [220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33]; // A-minor-ish pentatonic

  function build() {
    if (built) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    // Reverb-ish feedback delay for space
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.40;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

    // Drone: three detuned triangle osc (root, fifth, octave) through a lowpass with a slow LFO
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.6; lp.connect(master); lp.connect(delay);
    const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.045; lfoGain.gain.value = 220; lfo.connect(lfoGain); lfoGain.connect(lp.frequency); lfo.start();
    [110, 164.81, 220].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (i - 1) * 6;
      const g = ctx.createGain(); g.gain.value = 0.16; o.connect(g); g.connect(lp); o.start();
      voices.push(o);
    });

    // Wind / sea: filtered noise with a slow amplitude LFO
    const dur = 2; const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    const wlfo = ctx.createOscillator(); const wlfoG = ctx.createGain();
    wlfo.frequency.value = 0.07; wlfoG.gain.value = 0.035; wlfo.connect(wlfoG); wlfoG.connect(wg.gain); wlfo.start();
    wind.connect(bp); bp.connect(wg); wg.connect(master); wind.start();

    built = true;
    scheduleArp();
  }

  function scheduleArp() {
    const step = () => {
      if (ctx && on && master.gain.value > 0.001 && !RM) {
        const f = PENT[(Math.random() * PENT.length) | 0] * (Math.random() < 0.3 ? 2 : 1);
        pingInternal(f, 0.08);
      }
      arpTimer = setTimeout(step, 1800 + Math.random() * 3000);
    };
    arpTimer = setTimeout(step, 1400);
  }

  function pingInternal(freq, vol) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1.7);
  }

  return {
    start() { try { build(); if (ctx && ctx.state === 'suspended') ctx.resume(); fade(on ? 0.5 : 0, 1.6); } catch (e) {} },
    setOn(v) { on = v; fade(v ? 0.5 : 0, 0.6); },
    isOn() { return on; },
    ping(freq) { if (on) pingInternal(freq || 660, 0.11); },
    // a soft "arrival" chord when a shore is reached
    arrive() {
      if (!on) return;
      pingInternal(329.63, 0.10); setTimeout(() => pingInternal(493.88, 0.09), 90); setTimeout(() => pingInternal(659.25, 0.08), 190);
    },
    whoosh() {
      if (!ctx || !on) return;
      const dur = 0.7, sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr * dur, sr); const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      const t = ctx.currentTime; bp.frequency.setValueAtTime(280, t); bp.frequency.exponentialRampToValueAtTime(2200, t + dur);
      const g = ctx.createGain(); g.gain.value = 0.14;
      s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
    },
  };
  function fade(to, secs) { if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(to, t + secs); }
})();

/* ------------------------------------------------------------------ *
 * DOM chrome + shared journey state (works even if WebGL never boots)
 * ------------------------------------------------------------------ */
const gate = document.getElementById('xp-gate');
const chrome = document.getElementById('xp-chrome');
const dotsNav = document.getElementById('xp-dots');
const chapters = [...document.querySelectorAll('.xp-chapter')];
const storyEl = document.getElementById('xp-story');
const progressFill = document.getElementById('xp-progress-fill');
const hint = document.getElementById('xp-hint');
const soundBtn = document.getElementById('xp-sound');

// Continuous journey position 0..1, integrated by the loop. The WebGL scene
// and the DOM both read `journey.pos`.
const journey = { pos: 0, vel: 0, holding: false, auto: null };
let idx = 0;            // active/settled chapter (discrete)
let started = false;
let parked = false;     // resting at a shore; must release to depart again
let arrived = false;    // reached the final shore
let holdSource = null;  // 'pointer' | 'key' — which modality owns the current hold
let scene3d = null;     // set by init() if WebGL boots — { render, onChapter, drawStatic }

// travel feel (pos units are fractions of the whole journey)
const ACCEL = 0.16;     // hold acceleration  (pos/s^2)
const MAXV = 0.11;      // cruise speed       (pos/s)
const FRICTION = 0.86;  // per-frame decay on release (at 60fps)
const DOCK_EASE = 0.10; // start braking this far before a shore
const DOCK_SNAP = 0.006;// within this, snap & park

// Build clickable dots from the chapter count (guarded — module only fully
// wires up on the experience page; a missing container must not throw).
if (dotsNav) {
  chapters.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'xp-dot'; b.dataset.goto = String(i);
    b.setAttribute('aria-label', 'Chapter ' + (i + 1)); b.setAttribute('data-cursor', 'hover');
    b.addEventListener('click', (e) => { e.stopPropagation(); autoTo(i); });
    dotsNav.appendChild(b);
  });
}
const dots = dotsNav ? [...dotsNav.querySelectorAll('.xp-dot')] : [];

function setChapter(i) {
  const next = clamp(i, 0, N - 1);
  const changed = next !== idx;
  idx = next;
  // Toggle .is-active for visuals AND aria-hidden so a screen reader only sees
  // the current chapter and the polite live region announces each arrival.
  chapters.forEach((c, k) => { const on = k === idx; c.classList.toggle('is-active', on); c.setAttribute('aria-hidden', String(!on)); });
  dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));
  arrived = idx === N - 1;
  if (changed) { Audio.arrive(); if (scene3d) scene3d.onChapter(idx); }
}

// Send the journey to a specific shore (dots / arrow keys / tap) via a tween.
// The chapter text/dots update *immediately* (discrete feedback) while the
// camera glides to the shore behind it.
function autoTo(i) {
  const j = clamp(i, 0, N - 1);
  journey.holding = false; parked = false; holdSource = null; journey.vel = 0; journey.auto = anchorPos(j);
  setChapter(j);
  if (RM) { journey.pos = journey.auto; journey.auto = null; settleFrame(); }
}

/* ---- the travel integrator ---- */
function step(dt) {
  if (journey.auto != null) {
    // ease toward a requested shore (velocity held at rest during the glide)
    journey.vel = 0;
    journey.pos += (journey.auto - journey.pos) * Math.min(1, dt * 3.4);
    if (Math.abs(journey.auto - journey.pos) < 0.004) { journey.pos = journey.auto; journey.auto = null; }
  } else {
    // anchor strictly ahead of current position (the shore we're sailing toward)
    const legNext = clamp(Math.floor(journey.pos * (N - 1) + 1e-4) + 1, 0, N - 1);
    const nextP = anchorPos(legNext);
    if (journey.holding && !parked && journey.pos < 1) {
      journey.vel = Math.min(MAXV, journey.vel + ACCEL * dt);
    } else {
      journey.vel *= Math.pow(FRICTION, dt * 60);
      if (Math.abs(journey.vel) < 0.00025) journey.vel = 0;
    }
    // ease into the upcoming shore, then park exactly on it
    const dist = nextP - journey.pos;
    if (journey.vel > 0 && dist > 0 && dist < DOCK_EASE) {
      journey.vel = Math.min(journey.vel, dist * 1.6 + 0.004);
      if (dist < DOCK_SNAP) { journey.pos = nextP; journey.vel = 0; parked = true; }
    }
    journey.pos = clamp(journey.pos + journey.vel * dt, 0, 1);
    if (parked && !journey.holding) parked = false; // released → free to depart
  }
  updateHud();
}

function updateHud() {
  const nearest = Math.round(journey.pos * (N - 1));
  const atShore = Math.abs(journey.pos - anchorPos(nearest)) < 0.02 && Math.abs(journey.vel) < 0.01 && journey.auto == null;
  if (atShore && nearest !== idx) setChapter(nearest);
  const traveling = started && !atShore;
  if (storyEl) storyEl.classList.toggle('is-traveling', traveling);
  document.body.classList.toggle('xp-traveling', traveling);
  if (progressFill) progressFill.style.width = (journey.pos * 100).toFixed(1) + '%';
  if (hint) hint.hidden = !started || traveling || (nearest === N - 1 && atShore);
}

// One-shot settle used by reduced-motion / no-WebGL paths.
function settleFrame() { updateHud(); if (scene3d) scene3d.render(journey.pos, 0); }

/* ---- master loop (physics + optional WebGL render) ---- */
let rafId = 0, last = 0, elapsed = 0;
function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (!last) last = now;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; elapsed += dt;
  if (document.hidden) return;
  if (started && !RM) step(dt);
  if (scene3d) scene3d.render(journey.pos, elapsed);
}

function begin(withSound) {
  if (started || !gate) return;
  started = true;
  Audio.setOn(withSound);
  if (soundBtn) { soundBtn.setAttribute('aria-pressed', String(withSound)); soundBtn.classList.toggle('is-muted', !withSound); }
  Audio.start();
  gate.classList.add('is-gone');
  setTimeout(() => { gate.hidden = true; }, 800);
  if (chrome) chrome.hidden = false;
  if (dotsNav) dotsNav.hidden = false;
  document.body.classList.add('xp-started');
  setChapter(0);
  updateHud();
  // Move focus off the (now-hidden) gate button into the story so keyboard/SR
  // users keep their place and the first chapter is announced.
  if (storyEl) { try { storyEl.focus({ preventScroll: true }); } catch (e) { storyEl.focus(); } }
  // In reduced-motion / no-WebGL we don't run the travel loop; render one frame.
  if (RM || !scene3d) settleFrame();
}

/* ---- input: press & hold to travel ---- */
function isControl(t) { return t && t.closest && t.closest('a, button, input, [role="button"], .xp-chrome, .xp-dots'); }

function endHold() { journey.holding = false; parked = false; holdSource = null; }
// After a hold ends mid-water, glide to the NEAREST shore so the journey always
// comes to rest at a chapter — never stranded between shores with the text dimmed.
// (Past the midpoint of a leg you arrive at the next shore; before it you drift back.)
function settleToNearest() {
  if (RM || journey.auto != null) return;
  const n = clamp(Math.round(journey.pos * (N - 1)), 0, N - 1);
  journey.auto = anchorPos(n);
  setChapter(n);
}

const stage = document.getElementById('xp');
let downAt = 0, downX = 0, downY = 0, moved = false;
if (stage) {
  stage.addEventListener('pointerdown', (e) => {
    if (!started || isControl(e.target) || e.button > 0) return;
    downAt = e.timeStamp; downX = e.clientX; downY = e.clientY; moved = false;
    if (RM) { autoTo(idx + 1); return; }
    holdSource = 'pointer'; journey.holding = true; journey.auto = null;
  });
  stage.addEventListener('pointermove', (e) => {
    if (journey.holding && (Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8)) moved = true;
  }, { passive: true });
}
// Only a pointer may end a pointer-hold: a stray pointerup (second mouse button,
// a touch elsewhere, a click) must NOT cancel an active keyboard Space-hold.
window.addEventListener('pointerup', (e) => {
  if (holdSource !== 'pointer' || !journey.holding || (e && e.button > 0)) return;
  const tap = e && (e.timeStamp - downAt < 220) && !moved; // quick, still tap = advance one shore
  endHold();
  if (tap) autoTo(idx + 1); else settleToNearest();
});
window.addEventListener('pointercancel', () => { if (holdSource === 'pointer' && journey.holding) { endHold(); settleToNearest(); } });
window.addEventListener('blur', () => { if (journey.holding) { endHold(); settleToNearest(); } });

// Start-gate buttons
document.getElementById('xp-enter-sound')?.addEventListener('click', () => begin(true));
document.getElementById('xp-enter-silent')?.addEventListener('click', () => begin(false));

// Sound toggle
soundBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const on = !Audio.isOn();
  Audio.setOn(on);
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.classList.toggle('is-muted', !on);
});

// Replay — make the crossing again
document.getElementById('xp-replay')?.addEventListener('click', (e) => {
  e.stopPropagation();
  journey.holding = false; journey.auto = null; parked = false; arrived = false;
  journey.pos = 0; journey.vel = 0;
  setChapter(0); updateHud();
  if (RM || !scene3d) settleFrame();
});

// Keyboard: space = hold to travel; arrows/Home/End = jump between shores.
window.addEventListener('keydown', (e) => {
  const onControl = isControl(e.target);
  if (!started) {
    if ((e.key === 'Enter' || e.key === ' ') && !onControl) { e.preventDefault(); begin(true); }
    return;
  }
  if (onControl) return; // let focused controls keep their native Space/Enter
  if (e.key === ' ') {
    e.preventDefault();
    if (RM) { if (!e.repeat) autoTo(idx + 1); return; }
    if (!e.repeat) { holdSource = 'key'; journey.holding = true; journey.auto = null; }
    return;
  }
  if (e.repeat) return; // one shore per intentional press — don't machine-gun on key-repeat
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); autoTo(idx + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); autoTo(idx - 1); }
  else if (e.key === 'Home') { e.preventDefault(); autoTo(0); }
  else if (e.key === 'End') { e.preventDefault(); autoTo(N - 1); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ' && holdSource === 'key' && journey.holding) { endHold(); settleToNearest(); } });

// Minimal custom cursor (self-contained; brand-consistent)
(function cursor() {
  const el = document.getElementById('cursor');
  if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || RM) return;
  document.body.classList.add('has-cursor');
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  document.addEventListener('mouseover', (e) => { el.classList.toggle('is-hover', !!(e.target.closest && e.target.closest('[data-cursor="hover"]'))); }, { passive: true });
  (function tick() { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; el.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(tick); })();
})();

/* ------------------------------------------------------------------ *
 * WebGL world — a crossing across water toward a new land.
 * Comic/cel-shaded islands (toon gradient), a leading beacon "idea",
 * drifting embers, a gently rolling sea, bloom + film-grade post.
 * ------------------------------------------------------------------ */
function init(cv) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CH[0].sky, CH[0].fog);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);

  // A flowing crossing: skim low over the sea, then rise toward the new land.
  const WP = [
    new THREE.Vector3(0, 1.6, 10),
    new THREE.Vector3(-2.4, 1.1, -6),
    new THREE.Vector3(2.6, 0.9, -22),
    new THREE.Vector3(-1.8, 1.3, -38),
    new THREE.Vector3(1.4, 2.4, -52),
    new THREE.Vector3(0, 3.6, -66),
  ];
  const curve = new THREE.CatmullRomCurve3(WP, false, 'catmullrom', 0.2);
  const SEA_Y = -0.9;

  // ---- cel-shaded (comic) gradient for islands ----
  const gradTex = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gradTex.needsUpdate = true; gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;

  // ---- islands: one near each shore, plus a couple of distant ones ----
  const islands = [];
  const ISLE_U = [0.14, 0.30, 0.46, 0.62, 0.80, 0.95];
  ISLE_U.forEach((u, i) => {
    const cp = curve.getPointAt(u);
    const side = (i % 2 === 0 ? 1 : -1);
    const sc = 1.6 + (i * 0.35) + Math.abs(Math.sin(i * 2.3)) * 1.4;
    const g = new THREE.Group();
    g.position.set(cp.x + side * (4.5 + i * 0.6), SEA_Y, cp.z - 3 - i * 1.5);

    // mountain (flat, few sides → comic silhouette)
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(sc * 0.9, sc * (1.4 + Math.random() * 0.8), 5, 1),
      new THREE.MeshToonMaterial({ color: 0x0d3b21, gradientMap: gradTex })
    );
    cone.position.y = sc * 0.7; cone.rotation.y = i; g.add(cone);
    // a lower shoulder for shape
    const cone2 = new THREE.Mesh(
      new THREE.ConeGeometry(sc * 0.6, sc * 0.9, 5, 1),
      new THREE.MeshToonMaterial({ color: 0x0a2c18, gradientMap: gradTex })
    );
    cone2.position.set(sc * 0.55 * side, sc * 0.42, sc * 0.2); g.add(cone2);
    // glowing crown (foliage / life) — bright so bloom catches it
    const crownMat = new THREE.MeshBasicMaterial({ color: CH[0].glow });
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(sc * 0.34, 0), crownMat);
    crown.position.y = sc * (1.4 + 0.2); g.add(crown);

    scene.add(g);
    islands.push({ g, crownMat, u, sc });
  });

  // ---- the leading beacon: the "idea" that leads the crossing ----
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xd8f404 });
  const beacon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, isMobile ? 2 : 4), beaconMat);
  scene.add(beacon);
  const beaconHalo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xd8f404, wireframe: true, transparent: true, opacity: 0.18 }));
  scene.add(beaconHalo);
  const beaconLight = new THREE.PointLight(0xd8f404, 6, 26, 2); scene.add(beaconLight);

  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 6, 4); scene.add(key);
  const amb = new THREE.AmbientLight(0x2c6b3f, CH[0].amb); scene.add(amb);

  // ---- the sea: a big low-poly plane we gently ripple ----
  const SEG = isMobile ? 40 : 72;
  const seaGeo = new THREE.PlaneGeometry(220, 260, SEG, SEG);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice(0);
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x04160c, roughness: 0.75, metalness: 0.2, flatShading: true });
  const sea = new THREE.Mesh(seaGeo, seaMat); sea.position.set(0, SEA_Y, -28); scene.add(sea);

  // ---- drifting embers / motes ----
  const COUNT = isMobile ? 900 : 2200;
  const depth = 90;
  const pGeo = new THREE.BufferGeometry();
  const base = new Float32Array(COUNT * 3), pos = new Float32Array(COUNT * 3), scl = new Float32Array(COUNT), spd = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 2 + Math.random() * 12, th = Math.random() * Math.PI * 2;
    base[i*3] = Math.cos(th) * r; base[i*3+1] = Math.random() * 12 - 1; base[i*3+2] = 12 - Math.random() * depth;
    pos[i*3] = base[i*3]; pos[i*3+1] = base[i*3+1]; pos[i*3+2] = base[i*3+2];
    scl[i] = Math.random(); spd[i] = 0.1 + Math.random() * 0.5;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
  const ptMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: isMobile ? 14 : 20 }, uColor: { value: new THREE.Color(CH[0].ember) } },
    vertexShader: `uniform float uSize; attribute float aScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * aScale * (300.0 / -mv.z); vA = aScale; }`,
    fragmentShader: `precision mediump float; varying float vA; uniform vec3 uColor; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, smoothstep(0.5,0.0,d) * (0.05 + vA*0.16)); }`,
  });
  const points = new THREE.Points(pGeo, ptMat); scene.add(points);

  // ---- post ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 0.5 : 0.7, 0.7, 0.55);
  composer.addPass(bloom);
  const Grade = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uAb: { value: isMobile ? 1.0 : 1.8 }, uGrain: { value: isMobile ? 0.03 : 0.05 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `precision highp float; uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uAb; uniform float uGrain; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){ vec2 uv=vUv; vec2 dir=uv-0.5; float r2=dot(dir,dir); vec2 o=dir*r2*(uAb/uRes.x)*6.0;
        vec3 col=vec3(texture2D(tDiffuse,uv+o).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-o).b);
        col *= mix(0.62,1.0, smoothstep(0.95,0.15, r2*2.2));
        col += (h(uv*uRes + fract(uTime)*100.0)-0.5)*uGrain;
        gl_FragColor = vec4(col,1.0); }`,
  };
  const grade = new ShaderPass(Grade); grade.renderToScreen = true; composer.addPass(grade);

  function resize() {
    const w = cv.clientWidth, h = cv.clientHeight;
    renderer.setSize(w, h, false);
    const pd = Math.min(renderer.getPixelRatio(), 1.5);
    composer.setPixelRatio(pd); composer.setSize(w, h);
    grade.uniforms.uRes.value.set(w * pd, h * pd);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // pointer parallax + raycast highlight on the beacon
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-2, -2);
  const look = new THREE.Vector2(0, 0), lookT = new THREE.Vector2(0, 0);
  window.addEventListener('pointermove', (e) => {
    lookT.x = (e.clientX / innerWidth) * 2 - 1;
    lookT.y = -((e.clientY / innerHeight) * 2 - 1);
    ndc.x = lookT.x; ndc.y = lookT.y;
    if (started) { raycaster.setFromCamera(ndc, camera); cv.style.cursor = raycaster.intersectObject(beacon).length ? 'pointer' : ''; }
  }, { passive: true });

  const tmpA = new THREE.Color(), tmpB = new THREE.Color(), clear = new THREE.Color(), pcol = new THREE.Color(), gcol = new THREE.Color();
  const lookTarget = new THREE.Vector3(), aheadV = new THREE.Vector3(), beaconV = new THREE.Vector3();

  function render(pos, t) {
    const u = clamp(pos, 0, 1);
    // camera glides along the curve, looking a little ahead
    const cp = curve.getPointAt(u);
    aheadV.copy(curve.getPointAt(Math.min(u + 0.045, 1)));
    if (!RM) {
      camera.position.lerp(cp, 0.14);
      lookTarget.lerp(aheadV, 0.14);
      look.lerp(lookT, 0.05);
      camera.position.x += look.x * 0.6;
      camera.position.y += look.y * 0.4;
      camera.lookAt(lookTarget);
    } else {
      camera.position.copy(cp); camera.lookAt(aheadV);
    }

    // blend the mood between the two surrounding shores
    const sp = pos * (N - 1);
    const lo = Math.floor(sp), hi = Math.min(lo + 1, N - 1), f = sp - lo;
    const A = CH[lo], B = CH[hi];
    clear.set(A.sky).lerp(tmpB.set(B.sky), f); renderer.setClearColor(clear, 1); scene.fog.color.copy(clear);
    scene.fog.density = THREE.MathUtils.lerp(A.fog, B.fog, f);
    pcol.set(A.ember).lerp(tmpA.set(B.ember), f); ptMat.uniforms.uColor.value.copy(pcol);
    gcol.set(A.glow).lerp(tmpB.set(B.glow), f);
    amb.intensity = THREE.MathUtils.lerp(A.amb, B.amb, f);
    beaconLight.intensity = THREE.MathUtils.lerp(A.beacon, B.beacon, f) * 6;

    // beacon leads the crossing, bobbing just ahead
    beaconV.copy(aheadV); beaconV.y += 0.6 + (RM ? 0 : Math.sin(t * 1.3) * 0.18);
    beacon.position.copy(beaconV); beaconHalo.position.copy(beaconV); beaconLight.position.copy(beaconV);
    if (!RM) { beacon.rotation.y = t * 0.5; beacon.rotation.x = t * 0.25; beaconHalo.rotation.y = -t * 0.3; }
    const bp = 1 + (RM ? 0 : Math.sin(t * 2.0) * 0.08);
    beacon.scale.setScalar(bp);

    // islands: crowns brighten as the camera nears their shore
    for (const isle of islands) {
      const d = Math.abs(u - isle.u);
      const near = THREE.MathUtils.clamp(1 - d * 6, 0, 1);
      isle.crownMat.color.copy(gcol).multiplyScalar(0.35 + near * 0.9);
      if (!RM) isle.g.rotation.y = Math.sin(t * 0.1 + isle.sc) * 0.05;
    }

    // gently roll the sea
    if (!RM) {
      const arr = seaGeo.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = seaBase[i], z = seaBase[i + 2];
        arr[i + 1] = Math.sin(x * 0.12 + t * 0.6) * 0.18 + Math.cos(z * 0.1 + t * 0.4) * 0.18;
      }
      seaGeo.attributes.position.needsUpdate = true;
      // embers drift up + forward, wrapping
      const pa = pGeo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        const j = i * 3;
        pa[j + 1] = base[j + 1] + ((t * spd[i] * 0.4) % 12);
        pa[j] = base[j] + Math.sin(t * spd[i] + base[j + 2]) * 0.6;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    grade.uniforms.uTime.value = t;
    composer.render();
  }

  function drawStatic() { render(anchorPos(idx), 0); }
  scene3d = { render, onChapter() { if (RM) drawStatic(); }, drawStatic };

  // Ambient preview behind the gate + reduced-motion still frame.
  if (RM) { drawStatic(); window.addEventListener('resize', drawStatic, { passive: true }); }
  else { last = 0; requestAnimationFrame(loop); }
}

/* ---- boot ---- */
if (canvas && !isWebGLBlocked()) {
  const boot = () => { try { init(canvas); } catch (e) { console.warn('Experience WebGL failed', e); fallbackBg(); startLoopNoGL(); } };
  if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 700 }); else setTimeout(boot, 150);
} else {
  fallbackBg();
  startLoopNoGL();
}
// When WebGL is unavailable we still need the physics loop for progress/text.
function startLoopNoGL() { if (!RM) { last = 0; requestAnimationFrame(loop); } }
function fallbackBg() {
  if (canvas) canvas.style.background = 'radial-gradient(60% 60% at 60% 35%, rgba(48,204,100,0.22), transparent 70%), radial-gradient(50% 50% at 30% 70%, rgba(216,244,4,0.12), transparent 70%), #04160c';
}

// Fake "loading" progress on the gate so the enter buttons feel intentional
(function loading() {
  const pct = document.getElementById('xp-loading-pct');
  const wrap = document.getElementById('xp-loading');
  if (!pct) return;
  let p = 0;
  const tick = setInterval(() => {
    p = Math.min(100, p + Math.random() * 22);
    pct.textContent = Math.floor(p);
    if (p >= 100) { clearInterval(tick); if (wrap) wrap.classList.add('is-ready'); }
  }, 120);
})();
