# MarbleBench modular garden: experimental preview and verification

The preview is published at <https://collinsomniac.github.io/marblebench-ios/modular/> by the existing `main` GitHub Pages workflow. Source lives separately on branch [`feature/modular-garden-v2`](https://github.com/collinsomniac/marblebench-ios/tree/feature/modular-garden-v2/experiments/modular-garden); the workflow checks it out, runs its tests and bundles it alongside the unchanged `/` and `/3d/` routes. A feature branch push alone does **not** redeploy Pages: start a *new* run of the `main` Pages workflow for subsequent builds. Re-running a completed Pages workflow job may leave duplicate `github-pages` artifacts in the same workflow run and cause `actions/deploy-pages` to fail. Prefer a fresh workflow dispatch or a new main-branch commit.

## What exists

- Four camera modes: Orbit (one-finger orbit, two-finger pan/pinch), Explore (left movement pad, right-side look), Third Person and First Person (follow stable marble IDs and actual velocity). Native scrolling remains enabled inside the settings panel; only the game canvas and movement pad capture touch gestures. The Explore camera is not yet collision-aware.
- Rapier WASM rigid-body marbles with continuous static triangle-mesh rail geometry, a real annular funnel opening, loop rail, spring-jointed trampoline, shallow buoyant pool and broad motorized return trough. The motor-driven elevator has a twelve-step, ease-and-dwell motion profile, not a simulated pawl-and-gear ratchet. It is **not yet verified to pick up and deliver a marble**.
- Three.js WebGPURenderer using WebGPU where available, with explicit forced WebGL 2 comparison. One canvas and one rendering backend per run. Visual fidelity is currently stylized, and there are no measured iPhone FPS, thermal, GPU or memory results.
- The pool uses analytic spherical-cap buoyancy and approximate current and drag plus a flat visual surface; it is **not** a height-field or full fluid simulation.

## What the automated tests establish

The feature branch's GitHub Actions workflow installs the dependencies, performs syntax checks, runs eight numerical tests, builds with Vite and uploads a static artifact. Across a 50-second simulated workload, the pre-ratchet reference recorded nine water entries, six marble losses and bounded peak speed (approximately 10.95 metres/second). Tests assert access to top, S-bend, funnel, water and lower return and reject speed or height beyond stated sanity thresholds. The ratchet timing test verifies twelve continuous rise steps and dwell, but that test does not prove successful marble pickup.

Stage counters called `loopProximity`, `trampoline`, or `lift` mean a body was observed in a region; **they do not prove loop completion, trampoline launch, or a full closed circuit**. Before promotion to the main game, record successful events for each feature and a marble returning from the lower track to the high outlet *without teleportation*, trace remaining marble losses and test the four camera modes on a physical iPhone.

## Loading and performance debt

The early build contains a multi-megabyte minified JS chunk from Three.js and Rapier. Code-split and cache optional resources as warranted by measured load and memory costs. Establish on-device rAF cadence, p50/p95 frame intervals, physics ms/step, rendered resolution, draw calls and sustained behavior before claiming GPU optimization or a WebGPU win. Commit a package lockfile and use `npm ci` for reproducible production builds. Camera clipping, context loss/recovery and accessibility remain to be tested.

## Deployment failure note

The first Pages run for the experimental route succeeded. A later rerun of the same workflow job failed only in the deploy action because it found **two artifacts named `github-pages`** under the same run ID. Source checkout, regression tests, bundling and upload passed. Resolve by creating a brand-new workflow run rather than re-running that run again.
