# MarbleBench Modular Garden — experimental v0.1

**This is a physical-simulation experiment, not a completed continuous marble machine or a validated iPhone benchmark.** Existing `/` and `/3d/` remain preserved. The separate experimental preview is deployed through the authorized `main` GitHub Pages workflow, which checks out this feature branch without merging experimental source into `main`.

[Open the modular preview](https://collinsomniac.github.io/marblebench-ios/modular/) · [Physical/CI results](https://github.com/collinsomniac/marblebench-ios/actions/workflows/modular-garden-ci.yml) · [Source](https://github.com/collinsomniac/marblebench-ios/tree/feature/modular-garden-v2/experiments/modular-garden)

The preview does not update automatically after every feature-branch push: the `main` Pages workflow must run to publish a fresh bundle. Do not rerun the same Pages *job* after an artifact has been uploaded; a duplicate `github-pages` artifact caused a deployment failure previously. Start a new workflow run instead.

## Local development and diagnostics

```sh
cd experiments/modular-garden
npm install
npm run check
npm run bench:physics
npm run dev
npm run build
```

The production Vite base is `/marblebench-ios/modular/`. `npm install` is currently used rather than `npm ci`; committing a lockfile remains a reproducibility improvement. The optional benchmark reports Node/Rapier **headless CPU** step p50/p95 across three marble-flow conditions. It does not execute Three.js rendering, Safari, WebGPU, WebGL, or Metal; its RSS is a non-isolated process snapshot. GitHub CI records this benchmark without imposing hardware-dependent timing thresholds.

## Controls and accessibility

- **Orbit**: canvas swipe rotates, two-finger pan and pinch zoom. The settings panel uses `touch-action: pan-y` and native scrolling. Only canvas and explore movement pad capture camera gestures.
- **Explore**: lower-left joystick translates, canvas swipes look around; no navigation mesh or collision-aware camera yet.
- **Third Person / First Person**: velocity-directed follow cameras now use **58.75° vertical FOV instead of 47°**, a 25% increase. Third Person follows at an initial 2.85 metres, with adjustable distance. Orbit and Explore retain 47°.
- **Next ball** cycles stable IDs. Lost bodies are removed; replacement spheres spawn as new IDs, never instantaneously relocated between course modules.
- **Simulation pace** starts at **1.15×** as a reversible presentation preference. Set Tune → Simulation speed to 1.00× for physically comparable timing. Rapier still integrates at fixed 120 Hz in simulated time. Advancing simulation faster may require additional CPU steps per real second; it is not a performance optimization.
- **Renderer**: Three.js `WebGPURenderer`, auto WebGPU/WebGL 2 fallback or explicitly forced WebGL 2, one canvas per run. Switching backends reloads the scene. Actual backend, quality, timing and thermal behavior require measurement on the physical iPhone.

## Physical design and verified corrections

Rapier WASM supplies CCD spheres, continuous rail trimeshes, an annular funnel opening, loop geometry, and a dynamic spring-jointed trampoline. A powered shelf follows twelve eased upward motor steps with dwell periods; elevator **motion** is verified but marble pickup and recirculation are not. A full-width lower catcher, impact bumper and force-driven conveyor provide a return region. The pool remains a flat transparent surface plus analytic displaced-volume buoyancy and approximate drag/current—**not** a fluid solver.

The original funnel's outlet was only 1.53 marble diameters across. In a 60-second test it produced four observed exits from 32 entrants, peak occupancy 28, and median residence 25.7 seconds. Widening the actual outlet to 2.88 marble diameters and correcting the physical catch chute cut median residence below 0.5 seconds; the current test asserts at least eight exits, no more than eight simultaneous occupants and median residence under three seconds. The constructor now releases **one** initial marble, followed by a clearance-checked schedule at 0.48 per simulated second by default (about 2.083 seconds between releases). Unused spawn credit cannot produce a catch-up burst.

A previous post-funnel rail physically intersected the loop collider. Removing only the loop collider isolated the obstruction, but deleting the collider would defeat the physics requirement. We instead routed a separated, descending U-turn, extracted its centerline into `src/route-geometry.js`, and added a regression requiring the lead marble to approach the loop entrance within 18 simulated seconds while leaving the loop collider enabled. An alternate diagonal depth-lane merge **failed** that trial and raised losses, so it was reverted with its history retained. The remaining loop entrance still stops the lead marble; loop completion is not established.

Rapier `addForce()` persists until cleared, so water and conveyor forces are recomputed after `resetForces(false)` each fixed step. This fixed an earlier runaway-energy bug. API reference: https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/ .

## What tests mean—and do not mean

Current CI covers syntax, physical state continuity without funnel teleportation, bounded energy, water contact, individual funnel discharge/congestion, stable release cadence, follow-camera projection, motor trajectory, approach-to-loop entrance, and static production bundle creation. Stage `loopProximity` is not loop completion, and a nearby trampoline contact is not proof of a controlled rebound. No test yet proves a successful loop traversal, return from trampoline into water, elevator pickup, uninterrupted full circuit, visual correctness on an iPhone, cross-browser renderer support, thermal sustainability, real glass optics or real water dynamics.

For mobile comparisons, use **identical** simulation pace, active marble count, resolution, camera, quality and scene while switching WebGPU/forced WebGL 2. Record renderer identity, rAF p50/p95, physics milliseconds/step, draw calls, rendered megapixels, screenshot correctness, and several minutes of sustained behavior. The Copy snapshot control now includes all simulation settings, including pace, so traces remain interpretable.

## Next production gates

Resolve the actual loop-entry collider overlap and prove an entire loop trajectory rather than vicinity. Measure trampoline-pad impulse and landing consistency using contact events; prove the elevator picks up an existing marble, lifts it, and returns it to the top without relocation. Trace remaining losses, confirm all four touch modes on an iPhone, profile both browser rendering backends and resource/context recovery, then consider expensive water/lighting effects only with a reproducible device baseline.
