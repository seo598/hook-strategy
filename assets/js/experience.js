/* =====================================================================
   HOOK STRATEGY — "The Experience"
   A guided, click-through interactive story (Make Me Pulse style):
   a start gate that unlocks a generative Web-Audio soundscape, then a
   Three.js camera-journey through 7 narrative chapters advanced by click /
   tap / keyboard / a raycast-clickable orb, with drag-to-look parallax,
   bloom + film-grade post, a sound toggle and chapter dots.
   Self-contained — no dependency on main.js. Content/SEO/a11y never depend
   on WebGL: the story text is real DOM, and there are full fallbacks.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('xp-canvas');

const CHAPTERS = [
  { a: 0x06170d, c: 0x2c6b3f, spread: 12, orb: 0.0, net: 0 }, // 0 the void
  { a: 0x0a0f14, c: 0x9a6b2f, spread: 16, orb: 0.15, net: 0 }, // 1 the noise
  { a: 0x06170d, c: 0xd8f404, spread: 8,  orb: 1.0, net: 0 }, // 2 the hook (orb emerges)
  { a: 0x0a2c18, c: 0x30cc64, spread: 7,  orb: 1.15, net: 0.4 }, // 3 the idea (crystallizes)
  { a: 0x0a2c18, c: 0x7cffb2, spread: 10, orb: 1.0, net: 1.0 }, // 4 the spread (network)
  { a: 0x084424, c: 0xd8f404, spread: 9,  orb: 1.1, net: 0.6 }, // 5 growth (ascend)
  { a: 0x06170d, c: 0xd8f404, spread: 11, orb: 1.4, net: 0.2 }, // 6 brand reveal
];
const N = CHAPTERS.length;

function isWebGLBlocked() {
  try { const c = document.createElement('canvas'); return !(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return true; }
}

/* ------------------------------------------------------------------ *
 * Generative Web-Audio soundscape (no audio files, no licensing).
 * Built lazily on the first user gesture so autoplay policy is honoured.
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
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.38;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

    // Drone: three detuned triangle osc (root, fifth, octave) through a lowpass with a slow LFO
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.6; lp.connect(master); lp.connect(delay);
    const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05; lfoGain.gain.value = 240; lfo.connect(lfoGain); lfoGain.connect(lp.frequency); lfo.start();
    [110, 164.81, 220].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = (i - 1) * 6;
      const g = ctx.createGain(); g.gain.value = 0.16; o.connect(g); g.connect(lp); o.start();
      voices.push(o);
    });

    // Wind: filtered noise with a slow amplitude LFO
    const dur = 2; const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    const wlfo = ctx.createOscillator(); const wlfoG = ctx.createGain();
    wlfo.frequency.value = 0.08; wlfoG.gain.value = 0.035; wlfo.connect(wlfoG); wlfoG.connect(wg.gain); wlfo.start();
    wind.connect(bp); bp.connect(wg); wg.connect(master); wind.start();

    built = true;
    scheduleArp();
  }

  function scheduleArp() {
    const step = () => {
      if (ctx && on && master.gain.value > 0.001 && !RM) {
        const f = PENT[(Math.random() * PENT.length) | 0] * (Math.random() < 0.3 ? 2 : 1);
        pingInternal(f, 0.09);
      }
      arpTimer = setTimeout(step, 1600 + Math.random() * 2600);
    };
    arpTimer = setTimeout(step, 1200);
  }

  function pingInternal(freq, vol) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1.5);
  }

  return {
    start() { try { build(); if (ctx && ctx.state === 'suspended') ctx.resume(); fade(on ? 0.5 : 0, 1.4); } catch (e) {} },
    setOn(v) { on = v; fade(v ? 0.5 : 0, 0.6); },
    isOn() { return on; },
    ping(freq) { if (on) pingInternal(freq || 660, 0.12); },
    whoosh() {
      if (!ctx || !on) return;
      const dur = 0.6, sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr * dur, sr); const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      const t = ctx.currentTime; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur);
      const g = ctx.createGain(); g.gain.value = 0.18;
      s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
    },
  };
  function fade(to, secs) { if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(to, t + secs); }
})();

/* ------------------------------------------------------------------ *
 * DOM chrome + state machine (works even if WebGL never boots)
 * ------------------------------------------------------------------ */
const gate = document.getElementById('xp-gate');
const chrome = document.getElementById('xp-chrome');
const dotsNav = document.getElementById('xp-dots');
const chapters = [...document.querySelectorAll('.xp-chapter')];
const progressFill = document.getElementById('xp-progress-fill');
const hint = document.getElementById('xp-hint');
const soundBtn = document.getElementById('xp-sound');

let idx = 0;        // active chapter (discrete)
let started = false;
let scene3d = null; // set by init() if WebGL boots — { advanceEffect }

// Build clickable dots (guarded — the module only fully wires up on the
// experience page; a missing container must not throw at import time)
if (dotsNav) {
  chapters.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'xp-dot'; b.dataset.goto = String(i);
    b.setAttribute('aria-label', 'Chapter ' + (i + 1)); b.setAttribute('data-cursor', 'hover');
    b.addEventListener('click', (e) => { e.stopPropagation(); goTo(i); });
    dotsNav.appendChild(b);
  });
}
const dots = dotsNav ? [...dotsNav.querySelectorAll('.xp-dot')] : [];

function syncChapter() {
  // Toggle .is-active for visuals AND aria-hidden so a screen reader only sees
  // the current chapter and the polite live region announces each advance.
  chapters.forEach((c, i) => { const on = i === idx; c.classList.toggle('is-active', on); c.setAttribute('aria-hidden', String(!on)); });
  dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
  if (progressFill) progressFill.style.width = (N > 1 ? (idx / (N - 1)) * 100 : 0).toFixed(1) + '%';
  if (hint) hint.hidden = (idx >= N - 1); // hide the advance hint on the final chapter
}

function goTo(i, dir) {
  const next = Math.max(0, Math.min(N - 1, i));
  if (next === idx) return;
  idx = next;
  syncChapter();
  Audio.whoosh();
  if (scene3d) scene3d.onChapter(idx);
}
function advance(step) { goTo(idx + step); }

function begin(withSound) {
  if (started || !gate) return;
  started = true;
  Audio.setOn(withSound);
  soundBtn.setAttribute('aria-pressed', String(withSound));
  soundBtn.classList.toggle('is-muted', !withSound);
  Audio.start();
  gate.classList.add('is-gone');
  setTimeout(() => { gate.hidden = true; }, 800);
  chrome.hidden = false; dotsNav.hidden = false; if (hint) hint.hidden = false;
  document.body.classList.add('xp-started');
  syncChapter();
  // Move focus off the (now-hidden) gate button into the story so keyboard/SR
  // users keep their place and the first chapter is announced.
  const story = document.getElementById('xp-story');
  if (story) { try { story.focus({ preventScroll: true }); } catch (e) { story.focus(); } }
}

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

// Replay
document.getElementById('xp-replay')?.addEventListener('click', (e) => { e.stopPropagation(); goTo(0); });

// Advance on click anywhere in the stage (but not on links/buttons/dots)
document.getElementById('xp')?.addEventListener('click', (e) => {
  if (!started) return;
  if (e.target.closest('a, button, .xp-dots, .xp-chrome')) return;
  if (idx >= N - 1) return; // last chapter: let the CTA take over
  advance(1);
  Audio.ping(720);
});

// Keyboard
window.addEventListener('keydown', (e) => {
  const onControl = e.target && e.target.closest && e.target.closest('button, a, input, [role="button"]');
  if (!started) {
    // Global Enter/Space starts *with sound* — but only when no gate button is
    // focused, so a keyboard user who tabbed to "Enter silent" actually gets silence.
    if ((e.key === 'Enter' || e.key === ' ') && !onControl) { e.preventDefault(); begin(true); }
    return;
  }
  // Never hijack keys meant for a focused control (sound toggle, replay, dots, links) —
  // let them receive their native Space/Enter activation.
  if (onControl) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); advance(1); Audio.ping(720); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); advance(-1); }
  else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
  else if (e.key === 'End') { e.preventDefault(); goTo(N - 1); }
});

// Minimal custom cursor (self-contained; brand-consistent)
(function cursor() {
  const el = document.getElementById('cursor');
  if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || RM) return;
  document.body.classList.add('has-cursor');
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  document.addEventListener('mouseover', (e) => { el.classList.toggle('is-hover', !!(e.target.closest && e.target.closest('[data-cursor="hover"]'))); }, { passive: true });
  (function loop() { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; el.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); })();
})();

/* ------------------------------------------------------------------ *
 * WebGL journey
 * ------------------------------------------------------------------ */
function init(canvas) {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06170d, 0.05);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);

  // camera path — one waypoint per chapter
  const waypoints = [];
  for (let i = 0; i < N; i++) waypoints.push(new THREE.Vector3(Math.sin(i * 0.8) * 3, Math.cos(i * 0.6) * 1.6 + (i >= 5 ? i * 0.4 : 0), -i * 9));
  const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.15);

  // central orb (the "hook") — clickable, morphs/pulses, grows through the story
  const orbGeo = new THREE.IcosahedronGeometry(1.1, isMobile ? 3 : 5);
  const orbMat = new THREE.MeshStandardMaterial({ color: 0x0a2c18, emissive: 0xd8f404, emissiveIntensity: 0.4, roughness: 0.35, metalness: 0.1, flatShading: true });
  const orb = new THREE.Mesh(orbGeo, orbMat);
  const orbAnchor = waypoints[2].clone().add(new THREE.Vector3(0, 0, -3)); // sits just ahead of the "hook" chapter
  orb.position.copy(orbAnchor);
  scene.add(orb);
  const orbHalo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), new THREE.MeshBasicMaterial({ color: 0xd8f404, wireframe: true, transparent: true, opacity: 0.12 }));
  orbHalo.position.copy(orbAnchor); scene.add(orbHalo);

  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(3, 4, 5); scene.add(key);
  scene.add(new THREE.AmbientLight(0x2c6b3f, 0.6));

  // particle field spanning the journey
  const COUNT = isMobile ? 1600 : 3600;
  const depth = (N - 1) * 9 + 14;
  const pGeo = new THREE.BufferGeometry();
  const base = new Float32Array(COUNT * 3), pos = new Float32Array(COUNT * 3), scl = new Float32Array(COUNT), spd = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 2 + Math.random() * 8, th = Math.random() * Math.PI * 2;
    base[i*3] = Math.cos(th) * r; base[i*3+1] = Math.sin(th) * r * 0.7; base[i*3+2] = -Math.random() * depth + 6;
    pos[i*3] = base[i*3]; pos[i*3+1] = base[i*3+1]; pos[i*3+2] = base[i*3+2];
    scl[i] = Math.random(); spd[i] = 0.15 + Math.random() * 0.6;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
  const ptMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: isMobile ? 12 : 16 }, uColor: { value: new THREE.Color(0xc9e88f) } },
    vertexShader: `uniform float uSize; attribute float aScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * aScale * (300.0 / -mv.z); vA = aScale; }`,
    fragmentShader: `precision mediump float; varying float vA; uniform vec3 uColor; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, smoothstep(0.5,0.0,d) * (0.04 + vA*0.12)); }`,
  });
  const points = new THREE.Points(pGeo, ptMat); scene.add(points);

  // network lines (fade in for the "spread" chapters)
  const netMat = new THREE.LineBasicMaterial({ color: 0x7cffb2, transparent: true, opacity: 0 });
  const netGeo = new THREE.BufferGeometry();
  const netN = isMobile ? 26 : 46; const netPts = [];
  for (let i = 0; i < netN; i++) {
    const a = new THREE.Vector3((Math.random()-0.5)*7, (Math.random()-0.5)*5, orbAnchor.z + (Math.random()-0.5)*8);
    const b = a.clone().add(new THREE.Vector3((Math.random()-0.5)*3, (Math.random()-0.5)*3, (Math.random()-0.5)*3));
    netPts.push(a.x,a.y,a.z, b.x,b.y,b.z);
  }
  netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
  const net = new THREE.LineSegments(netGeo, netMat); scene.add(net);

  // post
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), isMobile ? 0.4 : 0.55, 0.6, 0.6);
  composer.addPass(bloom);
  const Grade = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uAb: { value: isMobile ? 1.0 : 1.8 }, uGrain: { value: isMobile ? 0.03 : 0.05 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `precision highp float; uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uAb; uniform float uGrain; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){ vec2 uv=vUv; vec2 dir=uv-0.5; float r2=dot(dir,dir); vec2 o=dir*r2*(uAb/uRes.x)*6.0;
        vec3 col=vec3(texture2D(tDiffuse,uv+o).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-o).b);
        col *= mix(0.66,1.0, smoothstep(0.95,0.2, r2*2.2));
        col += (h(uv*uRes + fract(uTime)*100.0)-0.5)*uGrain;
        gl_FragColor = vec4(col,1.0); }`,
  };
  const grade = new ShaderPass(Grade); grade.renderToScreen = true; composer.addPass(grade);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const pd = Math.min(renderer.getPixelRatio(), 1.5);
    composer.setPixelRatio(pd); composer.setSize(w, h);
    grade.uniforms.uRes.value.set(w * pd, h * pd);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // pointer parallax + raycast click on the orb
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-2, -2);
  const look = new THREE.Vector2(0, 0), lookT = new THREE.Vector2(0, 0);
  window.addEventListener('pointermove', (e) => {
    lookT.x = (e.clientX / innerWidth) * 2 - 1;
    lookT.y = -((e.clientY / innerHeight) * 2 - 1);
    ndc.x = lookT.x; ndc.y = lookT.y;
    if (started) {
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(orb).length > 0;
      canvas.style.cursor = hit ? 'pointer' : '';
    }
  }, { passive: true });
  // clicking the orb specifically advances too (already covered by stage click, but give it a ping)
  canvas.addEventListener('click', () => {
    if (!started) return;
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(orb).length > 0) Audio.ping(880);
  });

  // visibility pause
  let tabVisible = !document.hidden;
  document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; });

  // per-chapter target state, lerped every frame
  const state = { p: 0, fog: 0.05 };
  const tmpA = new THREE.Color(), tmpB = new THREE.Color(), clear = new THREE.Color(), pcol = new THREE.Color();
  const lookTarget = new THREE.Vector3();
  const camLerp = RM ? 1 : 0.055;
  const clock = new THREE.Clock();

  function updateVisuals(t) {
    // ease the continuous position toward the discrete chapter index
    state.p += (idx - state.p) * camLerp;
    const u = N > 1 ? THREE.MathUtils.clamp(state.p / (N - 1), 0, 1) : 0;

    // camera along the curve, looking slightly ahead
    if (!RM) {
      const cp = curve.getPointAt(u);
      camera.position.lerp(cp, 0.25);
      lookTarget.lerp(curve.getPointAt(Math.min(u + 0.04, 1)), 0.25);
      // parallax
      look.lerp(lookT, 0.05);
      camera.position.x += look.x * 0.5;
      camera.position.y += look.y * 0.35;
      camera.lookAt(lookTarget);
    } else {
      camera.position.copy(curve.getPointAt(u));
      camera.lookAt(curve.getPointAt(Math.min(u + 0.04, 1)));
    }

    // blend chapter colours by fractional position
    const lo = Math.floor(state.p), hi = Math.min(lo + 1, N - 1), f = state.p - lo;
    const A = CHAPTERS[lo], B = CHAPTERS[hi];
    clear.set(A.a).lerp(tmpB.set(B.a), f); renderer.setClearColor(clear, 1); scene.fog.color.copy(clear);
    pcol.set(A.c).lerp(tmpA.set(B.c), f); ptMat.uniforms.uColor.value.copy(pcol);
    orbMat.emissive.copy(pcol);
    scene.fog.density = THREE.MathUtils.lerp(A.spread, B.spread, f) * 0.005;

    // orb: scale/glow ramps with the interpolated "orb" strength; pulse near the hook chapter
    const orbAmt = THREE.MathUtils.lerp(A.orb, B.orb, f);
    const pulse = 1 + Math.sin(t * 2.2) * 0.05 * orbAmt;
    orb.scale.setScalar(Math.max(0.001, orbAmt) * pulse);
    orbHalo.scale.setScalar(Math.max(0.001, orbAmt) * 1.35);
    orb.visible = orbHalo.visible = orbAmt > 0.02;
    orbMat.emissiveIntensity = 0.35 + orbAmt * 0.55;
    if (!RM) { orb.rotation.y = t * 0.25; orb.rotation.x = t * 0.12; orbHalo.rotation.y = -t * 0.1; }

    // network opacity
    netMat.opacity = THREE.MathUtils.lerp(A.net, B.net, f) * 0.5;

    // particle drift + spread breathing
    const spread = THREE.MathUtils.lerp(A.spread, B.spread, f) / 12;
    const arr = pGeo.attributes.position.array;
    if (!RM) {
      for (let i = 0; i < COUNT; i++) {
        const j = i * 3;
        arr[j]   = base[j]   * spread + Math.sin(t * spd[i] + base[j+2]) * 0.5;
        arr[j+1] = base[j+1] * spread + Math.cos(t * spd[i] * 0.8 + base[j+2]) * 0.5;
      }
      pGeo.attributes.position.needsUpdate = true;
      points.rotation.z = t * 0.01;
    }

    grade.uniforms.uTime.value = t;
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!tabVisible) return;
    updateVisuals(clock.getElapsedTime());
    composer.render();
  }
  // Reduced motion: render on demand (initial + each chapter change + resize)
  // instead of a perpetual rAF loop — a still image, not spinning GPU.
  function drawStatic() { state.p = idx; updateVisuals(clock.getElapsedTime()); composer.render(); }
  scene3d = { onChapter() { if (RM) drawStatic(); } };
  if (RM) { drawStatic(); window.addEventListener('resize', drawStatic, { passive: true }); }
  else { frame(); }
}

/* ---- boot ---- */
if (canvas && !isWebGLBlocked()) {
  const boot = () => { try { init(canvas); } catch (e) { console.warn('Experience WebGL failed', e); fallbackBg(); } };
  if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 700 }); else setTimeout(boot, 150);
} else {
  fallbackBg();
}
function fallbackBg() {
  if (canvas) canvas.style.background = 'radial-gradient(60% 60% at 60% 35%, rgba(48,204,100,0.22), transparent 70%), radial-gradient(50% 50% at 30% 70%, rgba(216,244,4,0.12), transparent 70%), #06170d';
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
