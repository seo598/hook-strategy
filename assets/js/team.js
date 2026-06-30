/* =====================================================================
   HOOK STRATEGY — Team "constellation" (interactive 3D)
   Four disciplines as connected glowing nodes (a complete graph — every
   seat connected). Mouse-reactive rotation + raycast hover that syncs the
   floating chips and the role cards both ways. Brand palette, perf-guarded.
   ===================================================================== */
import * as THREE from 'three';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('team-canvas');
const stage  = document.getElementById('team-stage');

const ROLES = [
  { name: 'Strategy',    color: 0x30cc64 }, // emerald
  { name: 'Creative',    color: 0xd8f404 }, // neon
  { name: 'Performance', color: 0xfccc00 }, // golden
  { name: 'Engineering', color: 0x8fe6b0 }, // mint-green
];

// Defer the second WebGL context until the team section nears the viewport —
// keeps it off the critical path and avoids two live contexts at first paint.
if (canvas && stage && !blocked()) {
  const io = new IntersectionObserver((ents, obs) => {
    if (ents.some((e) => e.isIntersecting)) { obs.disconnect(); init(); }
  }, { rootMargin: '400px 0px' });
  io.observe(stage);
}

function blocked() {
  try { const c = document.createElement('canvas'); return !(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return true; }
}

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  const group = new THREE.Group();
  scene.add(group);

  // tetrahedron-ish node positions (good depth for parallax)
  const P = [
    new THREE.Vector3( 1.5,  1.25,  1.05),
    new THREE.Vector3( 1.55, -1.3,  -1.0),
    new THREE.Vector3(-1.6,  1.2,  -1.05),
    new THREE.Vector3(-1.45, -1.25, 1.2),
  ];

  // connecting lines — every pair (a fully connected team)
  const lp = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) lp.push(P[i].x,P[i].y,P[i].z, P[j].x,P[j].y,P[j].z);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x8fe6b0, transparent: true, opacity: 0.22 })));

  // central core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 1),
    new THREE.MeshBasicMaterial({ color: 0x30cc64, wireframe: true, transparent: true, opacity: 0.16 })
  );
  group.add(core);

  // nodes (sphere + additive glow halo)
  const nodes = ROLES.map((r, i) => {
    const g = new THREE.Group(); g.position.copy(P[i]);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), new THREE.MeshBasicMaterial({ color: r.color }));
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 24, 24),
      new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sphere.userData.idx = i;
    g.add(halo, sphere);
    group.add(g);
    return { g, sphere, halo, pos: P[i], scale: 1 };
  });

  // floating chips (projected each frame)
  const chips = ROLES.map((r, i) => {
    const d = document.createElement('span');
    d.className = 'team-chip'; d.textContent = r.name;
    stage.appendChild(d); return d;
  });

  // ---- interaction (raycast + role-card sync) ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let active = -1, selected = -1;
  const cards = [...document.querySelectorAll('[data-team-role]')];
  const focusY = P.map((p) => -Math.atan2(p.x, p.z)); // rotation that brings a node to the front

  function syncChips() {
    chips.forEach((c, k) => c.classList.toggle('is-active', k === active || k === selected));
  }
  function setActive(i) {
    if (i === active) return;
    active = i;
    cards.forEach((el) => el.classList.toggle('is-active', +el.dataset.teamRole === i));
    canvas.style.cursor = i >= 0 ? 'pointer' : '';
    syncChips();
  }
  function setSelected(i) {
    selected = (i === selected) ? -1 : i;
    cards.forEach((el) => {
      const k = +el.dataset.teamRole;
      el.classList.toggle('is-selected', k === selected);
      const btn = el.querySelector('.team-role__btn');
      if (btn) btn.setAttribute('aria-expanded', String(k === selected));
    });
    syncChips();
  }
  function hitTest(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(nodes.map((n) => n.sphere))[0];
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const hit = hitTest(e);
    setActive(hit ? hit.object.userData.idx : -1);
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => setActive(-1));
  canvas.addEventListener('click', (e) => { const hit = hitTest(e); setSelected(hit ? hit.object.userData.idx : -1); });
  cards.forEach((el) => {
    const i = +el.dataset.teamRole;
    el.addEventListener('mouseenter', () => setActive(i));
    el.addEventListener('mouseleave', () => setActive(-1));
    (el.querySelector('.team-role__btn') || el).addEventListener('click', () => setSelected(i));
  });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  // coalesce resize bursts (drags / devtools) into one GL viewport update per frame
  let rzScheduled = false;
  window.addEventListener('resize', () => {
    if (rzScheduled) return; rzScheduled = true;
    requestAnimationFrame(() => { rzScheduled = false; resize(); });
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(stage);

  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  let autoY = 0, last = 0;

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    const dt = Math.min(0.05, t - last); last = t;
    if (!reduce) {
      if (selected < 0) autoY += dt * 0.16;            // pause auto-spin while a node is selected
      const tY = selected >= 0 ? focusY[selected] : autoY + mouse.x * 0.5;
      const tX = selected >= 0 ? 0 : Math.sin(t * 0.3) * 0.12 + mouse.y * 0.35;
      group.rotation.y += (tY - group.rotation.y) * 0.07; // ease (no jump between auto/focus)
      group.rotation.x += (tX - group.rotation.x) * 0.07;
      core.rotation.y = -t * 0.3;
    }
    nodes.forEach((n, i) => {
      const tgt = selected === i ? 1.8 : (active === i ? 1.4 : 1);
      n.scale += (tgt - n.scale) * 0.12;
      n.g.scale.setScalar(n.scale);
      n.halo.material.opacity = (selected === i || active === i) ? 0.34 : 0.16;
    });

    renderer.render(scene, camera);

    // project node centers to screen → position chips
    const w = stage.clientWidth, h = stage.clientHeight;
    nodes.forEach((n, i) => {
      v.copy(n.pos); group.localToWorld(v); v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      chips[i].style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    });
  }
  frame();
  if (reduce) { resize(); renderer.render(scene, camera); }
}
