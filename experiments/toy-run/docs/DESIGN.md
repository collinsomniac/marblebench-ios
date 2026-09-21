# Design, architecture and acceptance

## Reference language

The supplied photographs consistently show stacked cylindrical sleeves, repeatable
socket diameters, bright molded plastic, open lanes, broad spiral/funnel bowls,
small paddle wheels and stable feet. Transparent sets expose marbles through the
columns; opaque sets emphasize silhouettes and strong color blocks. Repeated
parts and understandable connections matter more than reproducing every gadget.

The official [Quercetti Migoga Elevator](https://www.quercettistore.com/products/migoga-elevator)
description corroborates the common chutes/bridges/columns/wheels/spirals/funnels
vocabulary and an elevator for recirculation. This implementation is inspired by
that family of toys. It is **not a dimensionally verified 1:1 replica**: no measured
kit or manufacturer CAD was supplied. A measured connector/part catalogue is a
future step, not a claim supported by photographs.

This first course deliberately establishes one continuous circuit before adding
switches, duplicate lanes, paddle wheels or a construction editor. The loop and
water are extensions to the reference vocabulary. Existing experimental tuning
is reference evidence, not an immutable specification.

## Physical model

All engine values are metres, seconds and kilograms. Design control points use
decimetres, converted once. Marbles have 12 mm radius and 2500 kg/m³ density;
gravity is 9.81 m/s². Rapier 0.20.0 steps at a fixed 240 Hz with CCD, eight solver
iterations and two maximum CCD substeps. The powered lift is kinematic; every
marble remains a dynamic rigid body throughout its life.

Contact geometry is generated once for both rendering and static trimesh
colliders, including the visible clear ramp lid. There are no spline-following
forces, positional snaps, velocity boosts or hidden recirculation teleports.
The lift injects energy through physical contact. The ramp/loop assembly adapts
the earlier branch's successful isolated gravity-fed geometry and validates it
as part of the complete course. A narrow upper feed was essential: a wide feed
allowed side-by-side contacts to dissipate loop-entry energy. A finite-duration
queue gate prevents a waiting marble from indefinitely blocking lift departure.

Chutes expose inlet/outlet position, tangent, normal, width and marble radius.
These metadata are groundwork for a piece catalogue, not yet a snap-together
editor or a proof that arbitrary module combinations are safe. Decorative
supports are excluded from physics. They still need visual clearance review.

The bowl uses angular damping to approximate rolling resistance. Water uses
spherical-cap displaced volume and linear drag, with visual damped ripples.
It is not a fluid solver: no displaced surface-volume conservation, splashes,
wetting or realistic coupled waves. The water-region stage remains traversable
when water forces are disabled. Stage counts are ordered spatial checks; they
are not full continuous contact/energy proofs of every trajectory.

## Browser architecture

- Static Vite bundle; pinned Three.js 0.180.0 and Rapier 0.20.0 with lockfile.
- Three WebGPURenderer selects WebGPU where available; `?backend=webgl2` explicitly
  selects its WebGL backend using the same scene and materials.
- Physics is independent of DOM/rendering and runs unchanged under Node tests.
- A bounded accumulator advances physics; rendering interpolates marble positions.
  Excess wall time is reported as dropped simulated seconds, not disguised as FPS.
  Hidden-tab transitions reset the accumulator to avoid catch-up bursts.
- Five color batches consolidate static plastic. Marbles use instancing. Water
  has a small mesh and at most eight ripple sources. No shadow maps, screen-space
  reflections, bloom, ambient-occlusion passes or scene-wide transparency.
- Rendering and physics load as separate chunks. Rapier compatibility WASM is
  embedded in its JS chunk; this is portable but expensive to download/parse.
  An external-WASM build should be evaluated before asserting best startup cost.
- Main-thread physics is intentional at this population. Worker migration needs
  measured frame-budget evidence and transfer/interpolation cost measurements.
  No worker, WebGPU compute, SIMD or GPU-timing benefit is claimed without data.
- DPR is capped and user adjustable. Diagnostics report rAF intervals, physics
  CPU time, draws, triangles, backing resolution, dropped time and losses. GPU
  timing is explicitly unavailable rather than inferred from rAF frequency.

Relevant primary documentation:
[Three WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html),
[Rapier integration parameters](https://rapier.rs/docs/user_guides/javascript/integration_parameters/),
[Rapier colliders](https://rapier.rs/docs/user_guides/javascript/colliders/).

## What still needs validation

1. Hosted visual/interaction checks on both renderer backends and narrow layouts.
2. Actual iPhone/Safari testing, thermal behavior, memory and repeated reset/context
   loss recovery. Headless Node timing cannot substitute for any of these.
3. An operating-envelope sweep beyond the default six marbles, varied starting
   offsets and larger populations. Exposed stress settings may jam or escape.
4. Mechanical appearance, mount details and measured toy proportions; the geometry
   is procedural engineering groundwork, not final molded-part CAD.
5. A contained pool with a physically consistent waterline and a better calibrated
   contact/rolling-resistance model. Current drag/damping are explicit approximations.
6. Optional offline packaging after browser parity. A ZIP of static assets is a
   clearer supported format than promising cross-browser executable single HTML.
   The pre-existing standalone/PWEB experiments are preserved for comparison.

The production site should not replace the earlier routes until these acceptance
limits are understood. A separate `/toy/` preview is the intended review surface.

## Deployment and review update — 2026-09-21

The initial preview job was rejected by the `github-pages` environment because
`redesign/nostalgic-marble-run` is not an allowed deployment branch. The existing
`main` Pages workflow now checks out an explicit tested toy commit and publishes
it at `/marblebench-ios/toy/`. The modular route is pinned to its previously
published `e030e27` revision and its regression suite remains a build gate. No
environment restrictions were changed. To release a later toy revision, validate
it, update the pinned checkout in the main workflow, then verify build-info.json.
The redundant branch deployment workflow was removed; branch CI still tests and
uploads the static build for review.

The cloud browser reached the deployed HTML and loaded the application, but both
automatic WebGPU fallback and explicit WebGL 2 failed to create a graphics
context. This is an observed limitation of that browser session, not evidence
of iPhone parity or an iPhone failure. Startup now reports graphics unavailability
clearly, offers WebGL 2 retry and a downloadable error report. Chunk-load failures
also offer retry. A failed renderer initialization no longer triggers a second
initialization through the animation-loop shutdown path.

Code review fixed stale instanced-marble culling, missing Explore keyboard input,
reversed strafing, sticky movement after blur, reset framing and camera-selector
synchronization. Draw counts now use per-frame drawCalls, backend labels survive
minification, pause avoids redundant water updates, and hidden-tab transitions
reset diagnostic windows. Nine tests cover physics, geometry and camera behavior.

Controls → Inside the machine → Save benchmark JSON exports up to 60 recent
measurement windows, actual window durations, frame p50/p95, physics CPU time,
dropped simulated time, backend, backing resolution, settings, stage/loss counts,
browser user agent and source commit. It makes no network upload. A failure report
is available even before rendering starts. This is a diagnostic capture, not yet
a controlled automatic benchmark suite.

Next priorities, in order:

1. Verify rendered startup, orbit/follow/first-person visibility, touch input,
   background/resume and repeated reset on iPhone Safari and Chrome. Capture both
   graphics backends at identical scene, time scale and resolution settings.
2. Validate the mechanical appearance and physical/visual clearances before adding
   more toys. Keep the passing six-marble circuit as a regression fixture.
3. Add a reproducible benchmark runner with warm-up and fixed scenarios, avoiding
   combined percentiles from per-window percentiles. Use phone data to decide
   whether physics, fill rate, materials or startup dominates.
4. Evaluate external WASM delivery: the embedded Rapier physics chunk remains
   about 1.08 MB gzip, versus about 184 KB gzip for Three. Worker migration and
   WebGPU compute require evidence of a bottleneck; neither is an automatic win.
5. Expand the measured piece catalogue, water containment and validated population
   envelope, then consider switches, paddle wheels and a construction editor.
