# MarbleBench Modular Garden — experimental v0.1

**This is a physical-simulation experiment, not a completed continuous marble machine or a validated iPhone benchmark.** Existing `/` and `/3d/` remain preserved. The experimental preview is deployed through the authorized `main` GitHub Pages workflow, which checks out this separate feature branch and builds it without merging source into `main`.

[Open the modular preview](https://collinsomniac.github.io/marblebench-ios/modular/) · [Physical/CI results](https://github.com/collinsomniac/marblebench-ios/actions/workflows/modular-garden-ci.yml) · [Source](https://github.com/collinsomniac/marblebench-ios/tree/feature/modular-garden-v2/experiments/modular-garden)

The preview does not update automatically after every feature-branch push: rerun the `main` Pages workflow to rebuild this experimental subpath. The feature branch's earlier Pages deployment workflow was removed after GitHub rejected it before any steps ran.

## Local development

```sh
cd experiments/modular-garden
npm install
npm run check
npm run dev
npm run build
```

Vite uses base `/marblebench-ios/modular/` in the production bundle. `npm install` is currently used rather than `npm ci`; committing a lockfile is an outstanding reproducibility improvement.

## Controls and accessibility

- **Orbit**: swipe on canvas to rotate the viewpoint, two-finger pan and pinch to zoom. Settings panel uses `touch-action: pan-y` and retains native scrolling. Only the canvas and explore movement pad capture camera gestures.
- **Explore**: joystick at lower left translates the viewpoint; swipes on the canvas turn/look. No navigation mesh or collision-aware camera yet.
- **3rd Person**: damped following camera behind selected marble, oriented from its physical velocity; **1st Person**: camera offset slightly ahead of its surface in its travel direction.
- **Next ball** cycles stable marble entity IDs. Lost marbles are removed and replacements spawn as new entities, never instantaneously relocated mid-course.
- **Renderer**: Three.js `WebGPURenderer`, auto WebGPU/WebGL 2 fallback or explicitly forced WebGL 2, one canvas per run. Switching backend reloads the scene; real backend identity, quality and timings require verification on the physical iPhone.

## Physics and course

Rapier WASM supplies CCD spheres, continuous rail trimeshes without box-segment endcaps, a funnel with an actual opening, loop geometry, and a dynamic spring-jointed trampoline. A powered kinematic shelf follows **twelve smoothly eased upward motor steps with dwell periods**; its motor supplies energy while Rapier manages the marble contacts. The step timing is verified independently, but the elevator has not yet been shown to pick up a marble and return it to the top. A physical full-width pool catcher, impact bumper, and force-driven conveyor form a lower return. The pool remains a flat transparent sheet plus analytic displaced-volume buoyancy and approximate drag/current—**not** a 3D fluid solver.

Rapier `addForce()` persists until cleared, so the motor and water forces are recomputed after `resetForces(false)` each fixed step. This resolved an earlier runaway-energy bug. Source: https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/ .

## What the tests actually prove

The suite verifies predictable step and gate trajectories, 120 Hz finite-state simulation, no instantaneous funnel relocation, bounded peak energy over 50 simulated seconds, actual water entry, stage coverage through the pool and lower return, and a buildable static website. The stage tracker reports `loopProximity`, which is **not** proof of successfully traversing the loop. Trampoline proximity is not proof of a controlled launch. No test yet establishes a successful elevator lift, one uninterrupted closed circuit, thermal sustainability, Safari/WebGPU/WebGL compatibility, true glass optics, or real water dynamics.

## Design and performance rules

1. Simulate in one metric coordinate system, maintain stable IDs, and separate fixed-step physics, interpolated rendering, and controls. Do not use React state updates for every ball on every frame.
2. Compare WebGPU/WebGL 2 at identical resolution, geometry, scene, simulation, light and quality; a toggle alone is not a benchmark.
3. Measure rAF cadence, p50/p95 intervals, CPU physics time, rendered megapixels, and sustained performance on the actual iPhone; don't infer browser memory limits from phone physical RAM.
4. Batch common meshes, share geometry/materials, avoid duplicate graphics contexts, avoid GPU readbacks for each marble, and load heavy optional assets only when necessary.
5. Prefer contact geometry and motors over hidden teleportation or scripted velocity overrides; distinguish analytic buoyancy, height-field water, and volumetric fluid accurately.

## Blocking production gates

Prove loop traversal, measured trampoline bounce, robust lift pickup and full recirculation; trace remaining marble losses. Validate all four touch/camera modes and both renderer backends on-device. Introduce the fluid-library experiment only after establishing a reproducible baseline. Record memory, graphical correctness, and p95 frame time before claiming performance improvements.
