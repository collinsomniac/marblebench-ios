# MarbleBench: iPhone performance audit and 3D design decisions

Date: 2026-09-18 (Phoenix). Status: research and experimental code, **not** a validated 120 FPS iPhone benchmark.

## Evidence ledger

Observed in user's physical iPhone screenshot of `/`: approximately **30 rAF callbacks/s**, **120 physics steps/s**, **0.35 ms/physics step**, **70 marbles**, **2x DPR**, **0 dropped physics steps**, **WebGPU marbles + Canvas tracks**. Do not report 30 as the phone's screen refresh or 0.35 as total frame cost. There is no deliberate 30 FPS limiter in `site/main.js`.

WebKit bug 215745 explicitly confirms intentional 30 FPS requestAnimationFrame throttling in iOS Low Power Mode (as implemented in 2020): https://bugs.webkit.org/show_bug.cgi?id=215745 . This is a **leading testable hypothesis**, not proof about iOS 27 or the user's phone. Safari 27 release notes: https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ . A Safari feature flag, `Prefer Page Rendering Updates near 60fps`, was publicly reported in early 2026; experimental setting, not app-controlled or guaranteed on each browser version: https://www.tomsguide.com/phones/iphones/enable-120hz-safari-on-iphone .

At 120 fixed simulation steps/s, 0.35 ms/step implies ~42 ms/s of **measured step time** or ~1.4 ms per presented frame at 30 callbacks/s if 4 steps/frame. This excludes JS allocation, Canvas drawing, WebGPU submission, compositing, GPU time, OS scheduling, and sleep/thermal effects. Do not infer the bottleneck from a single counter.

## First diagnostic protocol — no change to engine

1. Open `/diagnostics/` in Safari, foreground, screen awake. Record rAF-only FPS, p50/p95 intervals, and >40 ms counts for ~15 seconds.
2. Repeat with 2D fill and WebGL 2 clear. Compare the idle rAF baseline to `/` and `/3d/`.
3. Record iOS version, browser, Low Power Mode on/off, battery state, and any Safari feature flag changes. Repeat off/on power mode only if convenient; do not programmatically toggle settings or infer private OS flags from heuristics.
4. Run `/3d/` at the same orientation and rendering DPR (1.0 and 1.25), with water/particles on and off, and several fixed marble counts. Change one factor at a time. Use steady-state runs, not only startup readings.
5. Report actual rAF cadence; CPU physics time, render submission time, optional asynchronous GPU timing, rendered megapixels, draw calls, particles, contacts, missed sim steps, and failures/context loss. GPU timers may be absent and must show *unavailable*, never 0 ms.
6. Repeat a longer run to expose memory or thermal effects. Do not invent FPS, bandwidth, or browser-memory measurements.

## Actual architecture, not marketing claims

`/3d/` is a **custom WebGL 2 renderer** and an inspectable **approximate JavaScript sphere simulation**. It does not use React, Three.js, Rapier, WebGPU compute, a true fluid solver, constrained mechanical joints, or real collision-coupled gears yet. It uses shared low-poly sphere/box geometry, GPU instancing, one canvas, a shader-colored water sheet, analytic per-ball buoyancy, and bounded fountain/splash particles.

Known follow-up issues from source inspection: the 3D renderer copies/uploads its static box instances each frame; per-marble array literals and a new particle typed array allocate during rendering; box normals are rotated without inverse-scale correction; `smoothstep` particle edge arguments are reversed; GPU timer query objects are recreated repeatedly. These are *optimization/correctness hypotheses*, not measured causes of 30 FPS. Compare before and after patches and verify actual WebGL compilation on device.

## Rendering budgets and alternatives

* One shared canvas; avoid duplicated Canvas 2D/WebGPU full-frame drawing if both can be combined in a single render graph. Profile alpha/compositing settings; don't assume `alpha:false` is universally cheaper (MDN explicitly cautions it can be expensive).
* Decouple 120 Hz fixed physics from browser rAF; interpolate visuals between completed simulation states. No forced render FPS cap; report delivered callbacks and misses. If the browser schedules 30 callbacks/s, a faster physics solver does not make it display 120 distinct frames/s.
* Budget backing pixels: CSS width × CSS height × DPR²; DPR 2 is four times DPR 1 area. Count depth, color, offscreen, and transient attachments. Choose 1.0–1.25× as *initial experimental* quality, not a universal preset. Do not silently change resolution when comparing benchmarks.
* Group same mesh/material into instances: marble spheres, rail pieces, wheel parts, droplets. An instanced sphere with e.g. 14×10 segment geometry and a billboard/impostor with 2 triangles are different visual/fill/vertex tradeoffs; compare distant-marble quality before reducing geometry.
* Prefer stable GPU buffers and update only dynamic ranges; avoid full copies of static instance data each frame. Avoid `gl.readPixels`, `gl.finish`, sync shader queries, unbounded per-frame JS allocation, and gratuitous framebuffer passes in the live loop.
* WebGL 2 remains the portable diagnostic path. Safari 26 introduced WebGPU with compute, and Safari 27 refines WGSL support. Implement a WebGPU backend only behind capability tests; compute is promising for independent droplets/height-field cells, **not automatically** for coupled contacts and joints.
* iFixit documented 12 GB LPDDR5X in the iPhone 17 Pro (https://www.ifixit.com/Guide/iPhone%2B17%2BPro%2BChip%2BID/196117). This is not an allocation promise to Safari. WebGL does not provide a portable GPU VRAM query. Source: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices .

## Library acceptance tests

Three.js InstancedMesh natively provides one geometry/material with varying transforms and instance colors (https://threejs.org/docs/pages/InstancedMesh.html); compare against our custom instancing on IDENTICAL meshes, lighting, geometry count, resolution, camera, physics input, and scene complexity. React Three Fiber explicitly advises no `setState` in `useFrame`, reusable meshes/materials, and minimal mount/unmount churn: https://r3f.docs.pmnd.rs/advanced/pitfalls . R3F's authoring benefits are not equivalent to claims that it intrinsically makes the GPU faster/slower.

Rapier provides actual joints, sleeping bodies, sensors, collision events and optional CCD: https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/ . Newer SIMD WASM packages have reported 2–5× *within-Rapier historical package* gains, not a speedup relative to custom JS: https://www.dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/ . Compare physics quality (penetration, rolling, energy drift, stable piles) as well as ms/step. Avoid unconditional CCD on slow bodies, enabling threads before establishing the isolation headers, or GPU broad-phase without demonstrating benefit.

## Mechanical design / honest simulation classification

* Source inspiration: Paul Grundbacher's marble machines feature Archimedes lifts, water wheels, funnels, flip-flops and a governor brake: https://woodgears.ca/marbles/paul.html . Ryszard Grenda describes linked mixers, chain lifts, distributing flip-flops and ratcheted water wheels: https://woodgears.ca/reader/richard/marble_machine.html . Wintergatan's conveyor/elevator mechanism demonstrates legible recirculation: https://www.youtube.com/watch?v=Z7g5ZodD7ng .
* **Current approximations**: scripted recirculation, rotating paddle, oscillating switch, funnel guidance, flat shader water, per-sphere buoyancy, ballistic droplets.
* **Next true mechanisms**: torque-driven counterweighted seesaw; collision-triggered bell; one-way ratchet; constrained elevator; bifurcating gate; moving buckets; controllable catch-and-release. Rapier rigid bodies/joints/sensors are suitable candidates, but independently benchmark them.
* **Water progression**: flat procedural surface + analytic buoyancy (current) → small GPU height-field with localized splash impulses → visual foam/ripples + simple drag/current → full particle fluid ONLY if a specific gameplay interaction demands two-way coupling. Never describe the flat shader as fluid dynamics.
* **Particle progression**: bounded ballistic water spray (current) → pooled typed-array CPU simulation → GPU-resident particle update/instanced draw after measuring transfer overhead. Include droplets from fountain and marble-triggered impacts, and optionally wheel spray and dust as different sources.

## Gate to claim 'showcase quality'

Verify on physical iPhone: correct 3D rendering and camera gestures, mechanically coherent contacts, visible water crossings, diagnostic export, no unexplained context loss, steady-state p95 frame times at measured rAF cadence, memory under sustained load, and fair R3F/Three/Rapier reference comparisons. Until then the `/3d/` site remains an experimental reference, not a finished library-gallery-quality product.
