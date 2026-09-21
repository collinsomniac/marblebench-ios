import * as THREE from "three/webgpu";
import { ToySimulation, DT } from "./simulation.js";
import { CameraRig } from "./camera.js";
import { fitOrbitDistance } from "./framing.js";
const $ = (id) => document.getElementById(id),
  backend =
    new URLSearchParams(location.search).get("backend") === "webgl2"
      ? "webgl2"
      : "auto";
let renderer,
  scene,
  camera,
  rig,
  sim,
  R,
  last = 0,
  accumulator = 0,
  paused = false,
  scale = 1.25,
  lastHud = 0,
  frames = 0,
  physicsMs = 0,
  steps = 0,
  dropped = 0,
  intervals = [],
  errors = 0,
  latest = {},
  waterFrame = 0,
  lastWet = new Set(),
  ripples = [];
const q = (a, p) => (a.length ? a[Math.floor((a.length - 1) * p)] : null);
function resize() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, scale));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (rig?.mode === "orbit")
    rig.distance = fitOrbitDistance(camera.aspect, camera.fov);
}
function fail(e) {
  errors++;
  console.error(e);
  renderer?.setAnimationLoop(null);
  $("loading").hidden = false;
  $("phase").textContent = `Could not continue: ${e?.message ?? e}`;
  $("retry").hidden = false;
}
function reset() {
  const options = sim
    ? { ...sim.options }
    : { flow: 0.2, capacity: 6, speed: 1, water: true, elevator: true };
  sim?.dispose();
  sim = new ToySimulation(R, scene, options);
  Object.assign(sim.options, options);
  last = accumulator = dropped = 0;
  ripples = [];
  lastWet.clear();
  if (rig) {
    rig.setMode("orbit", sim.balls);
    $("mode").value = "orbit";
    $("next").hidden = true;
    $("caption").hidden = false;
  }
  paused = false;
  $("pause").textContent = "Ⅱ";
  $("pause").setAttribute("aria-label", "Pause simulation");
}
function waterVisual() {
  const wet = new Set(sim.balls.filter((b) => b.wet).map((b) => b.id));
  for (const b of sim.balls)
    if (wet.has(b.id) && !lastWet.has(b.id)) {
      const p = b.body.translation();
      ripples.push({ x: p.x, z: p.z, t: sim.time });
    }
  lastWet = wet;
  ripples = ripples.filter((r) => sim.time - r.t < 2.5).slice(-8);
  if (++waterFrame % 2) return;
  const a = sim.course.water.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    let d = 0;
    for (const r of ripples) {
      const age = sim.time - r.t,
        dist = Math.hypot(a.getX(i) - r.x, a.getZ(i) - r.z);
      d +=
        0.0012 *
        Math.exp(-age * 2 - dist * 12) *
        Math.sin(dist * 160 - age * 18);
    }
    a.setY(i, 0.234 + d);
  }
  a.needsUpdate = true;
}
function snapshot() {
  return {
    at: new Date().toISOString(),
    version: "toy-run-0.2",
    simulation: sim.snapshot(),
    rendering: {
      backend: renderer.backend.constructor.name,
      requested: backend,
      width: renderer.domElement.width,
      height: renderer.domElement.height,
      dpr: renderer.getPixelRatio(),
      ...latest,
    },
    userAgent: navigator.userAgent,
  };
}
function hud(t) {
  if (t - lastHud < 1000) return;
  const sorted = intervals.slice().sort((a, b) => a - b);
  latest = {
    raf: (frames * 1000) / (t - lastHud),
    p50: q(sorted, 0.5),
    p95: q(sorted, 0.95),
    physicsMs: steps ? physicsMs / steps : 0,
    steps,
    droppedSeconds: dropped,
    draws: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    gpuMs: null,
    errors,
  };
  $("readout").textContent =
    `${sim.balls.length} marbles · ${sim.laps} circuits · ${sim.losses} escaped${paused ? " · paused" : ""}`;
  $("metrics").textContent =
    `${latest.raf.toFixed(1)} rAF callbacks/s\nFrame p50 / p95: ${latest.p50?.toFixed(1) ?? "—"} / ${latest.p95?.toFixed(1) ?? "—"} ms\nPhysics: ${latest.physicsMs.toFixed(3)} ms/step\nDraws: ${latest.draws} · triangles: ${latest.triangles}\nDropped simulation: ${dropped.toFixed(3)} s\nGPU timer: unavailable\nLift: ${sim.lift.phase}\n${renderer.domElement.width} × ${renderer.domElement.height} pixels\n${Object.entries(
      sim.snapshot().stages,
    )
      .map(([k, v]) => k + ": " + v)
      .join("\n")}`;
  frames = steps = physicsMs = 0;
  intervals = [];
  lastHud = t;
}
function tick(t) {
  try {
    const elapsed = last ? (t - last) / 1000 : 0;
    last = t;
    if (elapsed > 0) intervals.push(elapsed * 1000);
    if (!paused) {
      const accepted = Math.min(elapsed, 0.1);
      dropped += Math.max(0, elapsed - accepted) * sim.options.speed;
      accumulator += accepted * sim.options.speed;
      let count = 0;
      while (accumulator >= DT && count < 48) {
        const start = performance.now();
        sim.step();
        physicsMs += performance.now() - start;
        accumulator -= DT;
        steps++;
        count++;
      }
      if (accumulator >= DT) {
        const discarded = Math.floor(accumulator / DT) * DT;
        dropped += discarded;
        accumulator -= discarded;
      }
    }
    const alpha = paused ? 1 : accumulator / DT;
    rig.update(Math.min(elapsed, 0.08), sim.balls, alpha);
    sim.sync(alpha, rig.mode === "first" ? rig.focusId : null);
    waterVisual();
    sim.course.water.visible = sim.options.water;
    renderer.render(scene, camera);
    frames++;
    hud(t);
  } catch (e) {
    fail(e);
  }
}
function ui() {
  $("settings").onclick = () => {
    const open = $("panel").hidden;
    $("panel").hidden = !open;
    $("settings").setAttribute("aria-expanded", String(open));
  };
  $("close").onclick = () => {
    $("panel").hidden = true;
    $("settings").setAttribute("aria-expanded", "false");
  };
  $("add").onclick = () => {
    if (!sim.spawn())
      $("readout").textContent = "Feed is occupied or capacity reached";
  };
  $("pause").onclick = () => {
    paused = !paused;
    accumulator = 0;
    $("pause").textContent = paused ? "▶" : "Ⅱ";
    $("pause").setAttribute(
      "aria-label",
      paused ? "Resume simulation" : "Pause simulation",
    );
  };
  $("reset").onclick = reset;
  $("mode").onchange = () => {
    const mode = rig.setMode($("mode").value, sim.balls);
    $("mode").value = mode;
    $("next").hidden = !["first", "third"].includes(mode);
    $("caption").hidden = mode !== "orbit";
    $("hint").textContent =
      mode === "explore"
        ? "LEFT PAD TO MOVE · DRAG TO LOOK"
        : mode === "orbit"
          ? "DRAG TO ORBIT · SCROLL OR PINCH TO EXPLORE"
          : "DRAG TO LOOK · NEXT TO SWITCH MARBLES";
  };
  $("next").onclick = () => rig.nextMarble(sim.balls);
  for (const id of ["flow", "capacity", "speed", "quality"])
    $(id).oninput = () => {
      const v = Number($(id).value);
      $(id + "Val").textContent =
        id === "capacity"
          ? v
          : id === "flow"
            ? v.toFixed(2) + " /s"
            : v.toFixed(2) + "×";
      if (id === "quality") {
        scale = v;
        resize();
      } else sim.options[id] = v;
    };
  for (const id of ["water", "elevator"])
    $(id).onchange = () => (sim.options[id] = $(id).checked);
  $("backend").value = backend;
  $("reload").onclick = () => {
    const url = new URL(location.href);
    url.searchParams.set("backend", $("backend").value);
    location.assign(url);
  };
  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot(), null, 2));
      $("copy").textContent = "Copied";
    } catch {
      $("metrics").textContent = JSON.stringify(snapshot(), null, 2);
      $("copy").textContent = "Snapshot shown above";
    }
  };
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    last = 0;
    accumulator = 0;
    intervals = [];
  });
  addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "BUTTON"].includes(e.target.tagName)) return;
    if (e.code === "Space") {
      e.preventDefault();
      $("pause").click();
    }
    if (e.code === "Escape") $("close").click();
  });
  $("world").addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    fail(new Error("Graphics context lost. Try again to rebuild the scene."));
  });
}
$("retry").onclick = () => location.reload();
async function boot() {
  try {
    $("phase").textContent = "Loading the physics engine…";
    R = (await import("@dimforge/rapier3d-compat")).default;
    await R.init();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f0e6);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc4bd9c, 2.6));
    const key = new THREE.DirectionalLight(0xfff4d9, 3.3);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc9eaff, 1.4);
    fill.position.set(2, 1, -2);
    scene.add(fill);
    camera = new THREE.PerspectiveCamera(
      48,
      innerWidth / innerHeight,
      0.003,
      20,
    );
    $("phase").textContent = "Connecting the tracks…";
    reset();
    renderer = new THREE.WebGPURenderer({
      canvas: $("world"),
      antialias: true,
      alpha: false,
      forceWebGL: backend === "webgl2",
    });
    await renderer.init();
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    resize();
    rig = new CameraRig(camera, $("world"), $("movement"), $("thumb"));
    rig.distance = fitOrbitDistance(camera.aspect, camera.fov);
    ui();
    $("build").textContent =
      `${renderer.backend.constructor.name} · 240 Hz fixed physics · 24 mm marbles`;
    $("loading").hidden = true;
    lastHud = performance.now();
    renderer.setAnimationLoop(tick);
    window.__MARBLE_WORKS__ = { snapshot };
  } catch (e) {
    fail(e);
  }
}
boot();
