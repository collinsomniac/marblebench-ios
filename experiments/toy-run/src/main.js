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
  rendererReady = false,
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
  ripples = [],
  history = [],
  waterTime = -1,
  lastError = null;
const backendName = () =>
  renderer?.backend?.isWebGPUBackend
    ? "WebGPU"
    : renderer?.backend?.isWebGLBackend
      ? "WebGL 2"
      : "uninitialized";
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
  lastError = { message: String(e?.message ?? e), stack: e?.stack ?? null };
  console.error(e);
  if (rendererReady) renderer.setAnimationLoop(null).catch(console.error);
  $("loading").hidden = false;
  $("phase").textContent =
    /getSupportedExtensions|WebGL|WebGPU|GPUAdapter/.test(e?.message ?? "")
      ? "3D graphics are unavailable in this browser session. Try Safari or Chrome with graphics support enabled."
      : `Could not continue: ${e?.message ?? e}`;
  $("save-error").hidden = false;
  $("retry").hidden = false;
  $("fallback").hidden = backend === "webgl2";
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
  waterTime = -1;
  history = [];
  frames = steps = physicsMs = 0;
  intervals = [];
  lastHud = performance.now();
  if (rig) {
    rig.resetView(sim.balls);
    $("mode").value = "orbit";
    $("next").hidden = true;
    $("caption").hidden = false;
    syncCameraUI();
  }
  paused = false;
  $("pause").textContent = "Ⅱ";
  $("pause").setAttribute("aria-label", "Pause simulation");
}
function waterVisual() {
  if (waterTime === sim.time) return;
  waterTime = sim.time;
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
    version: "toy-run-0.3",
    sourceCommit: __BUILD_COMMIT__,
    paused,
    sampleWindow: {
      seconds: history.reduce((sum, s) => sum + s.durationMs, 0) / 1000,
      samples: history,
    },
    error: lastError,
    capabilities: {
      secureContext: isSecureContext,
      webgpuAPI: !!navigator.gpu,
      devicePixelRatio: devicePixelRatio || 1,
      viewport: [innerWidth, innerHeight],
    },
    simulation: sim?.snapshot() ?? null,
    rendering: {
      backend: backendName(),
      requested: backend,
      width: renderer?.domElement.width ?? null,
      height: renderer?.domElement.height ?? null,
      dpr: renderer?.getPixelRatio() ?? null,
      ...latest,
    },
    userAgent: navigator.userAgent,
  };
}
function saveSnapshot() {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `marble-works-${Date.now()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function hud(t) {
  if (t - lastHud < 1000) return;
  const sorted = intervals.slice().sort((a, b) => a - b);
  latest = {
    durationMs: t - lastHud,
    raf: (frames * 1000) / (t - lastHud),
    p50: q(sorted, 0.5),
    p95: q(sorted, 0.95),
    physicsMs: steps ? physicsMs / steps : 0,
    steps,
    droppedSeconds: dropped,
    draws: renderer.info.render.drawCalls,
    triangles: renderer.info.render.triangles,
    gpuMs: null,
    errors,
  };
  history.push({ at: sim.time, paused, ...latest });
  if (history.length > 60) history.shift();
  $("readout").textContent =
    `${sim.balls.length} marbles · ${sim.laps} circuits · ${sim.losses} escaped${paused ? " · paused" : ""}`;
  $("metrics").textContent =
    `${latest.raf.toFixed(1)} rAF callbacks/s\nFrame p50 / p95: ${latest.p50?.toFixed(1) ?? "—"} / ${latest.p95?.toFixed(1) ?? "—"} ms\nPhysics: ${latest.physicsMs.toFixed(3)} ms/step\nDraws: ${latest.draws} · triangles: ${latest.triangles}\nDropped simulation: ${dropped.toFixed(3)} s\nGPU timer: unavailable\nLift: ${sim.lift.phase}\n${renderer?.domElement.width ?? null} × ${renderer?.domElement.height ?? null} pixels\n${Object.entries(
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
    if (sim.options.water) waterVisual();
    if ($("mode").value !== rig.mode) syncCameraUI();
    sim.course.water.visible = sim.options.water;
    renderer.render(scene, camera);
    frames++;
    hud(t);
  } catch (e) {
    fail(e);
  }
}
function syncCameraUI() {
  const mode = rig.mode;
  $("mode").value = mode;
  $("next").hidden = !["first", "third"].includes(mode);
  $("caption").hidden = mode !== "orbit";
  $("hint").textContent =
    mode === "explore"
      ? "WASD / ARROWS OR LEFT PAD TO MOVE · DRAG TO LOOK"
      : mode === "orbit"
        ? "DRAG TO ORBIT · SCROLL OR PINCH TO EXPLORE"
        : "DRAG TO LOOK · NEXT TO SWITCH MARBLES";
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
    rig.setMode($("mode").value, sim.balls);
    syncCameraUI();
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
  $("save").onclick = saveSnapshot;
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    last = 0;
    accumulator = 0;
    intervals = [];
    frames = steps = physicsMs = 0;
    lastHud = performance.now();
  });
  addEventListener("keydown", (e) => {
    if (e.code === "Escape") $("close").click();
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
$("save-error").onclick = saveSnapshot;
$("retry").onclick = () => location.reload();
$("fallback").onclick = () => {
  const url = new URL(location.href);
  url.searchParams.set("backend", "webgl2");
  location.assign(url);
};
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
    rendererReady = true;
    const onDeviceLost = renderer.onDeviceLost.bind(renderer);
    renderer.onDeviceLost = (info) => {
      onDeviceLost(info);
      fail(
        new Error(
          `${info.api ?? "Graphics"} device lost. Reload to restore the scene.`,
        ),
      );
    };
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    resize();
    rig = new CameraRig(camera, $("world"), $("movement"), $("thumb"));
    rig.distance = fitOrbitDistance(camera.aspect, camera.fov);
    ui();
    $("build").textContent =
      `${backendName()} · 240 Hz fixed physics · 24 mm marbles`;
    $("loading").hidden = true;
    lastHud = performance.now();
    await renderer.setAnimationLoop(tick);
    window.__MARBLE_WORKS__ = { snapshot };
  } catch (e) {
    fail(e);
  }
}
boot();
