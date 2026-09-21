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
