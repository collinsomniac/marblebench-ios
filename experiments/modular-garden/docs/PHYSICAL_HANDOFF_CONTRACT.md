# MarbleBench physical handoff contract

Status: design + measured isolated assemblies; NOT proof of a complete production marble machine. This document governs how mechanisms connect. All distances in metres, g=9.81m/s², ball radius r=0.17m. Reference: `tests/gravity-fed-loop.test.js`, `tests/isolated-vortex.test.js`, `tests/funnel-diagnostic.test.js`.

## A module exports more than a mesh

Each module should define named **inlet** and **outlet** connectors with: centerline endpoint p, unit direction tangent t, track surface normal n, usable half-width, guard height, marble-radius clearance, minimum/maximum supported arrival speed, expected gravitational drop / supplied motor work, and provenance of its collision mesh. A matching connector must pass these independently tested gates:

1. **Position and tangent continuity:** endpoints touch within an explicit tolerance and tangents align in the direction of travel. Prefer a C¹ or smoother centerline. Continuous visual geometry alone is insufficient: colliders must be continuous at the same coordinates and not self-intersect.
2. **Finite-radius clearance:** reason about the *swept marble sphere*, not a mathematical point. An approaching sphere must not collide with a returning lane, sidewall, support, or otherwise invisible surface. Guard geometry is physical and has no hidden position/velocity overrides.
3. **Energy:** report entry speed, angular velocity and height. Compare physical drop m g Δh and initial energy with the energy needed at the next mechanism. A motorized elevator may supply energy explicitly; an unpowered rail must not. A point-mass ideal loop criterion `v_bottom >= sqrt(5*g*(R-r))` is only a reference: rolling inertia, 3D pitch, friction, impacts and finite-width tracks require stronger empirical checks.
4. **Contact and release:** measure contact near each intended seam, clearance, time spent, exit location/velocity, and failure modes (bounce out, lodge, fall off, drift into another lane). The operation 'appears near component' does not count as traversing it.
5. **Sustained flow:** 1, 4 and 30+ balls, adjustable release rates; measure ingress, successful egress, occupancy, residence-time percentiles, backlog, escapes and removal reason. Do not fix congestion by creating bodies directly after the obstacle.
6. **Fair performance:** same number of bodies, collision triangles, solver timestep/settings and world state when comparing implementations. Include CPU step p50/p95, renderer CPU/GPU timing if available, draw calls, generated geometry, DPR and sustained iPhone measurements. An empty static demo can be fast while the integrated course fails.

## Coin well, a surface of revolution rather than an engineered spiral

`src/vortex-profile.js` defines radius-independent-of-angle height `y(r)` and a finite open throat. The only local asymmetry is a short tangential inlet apron and retaining-lip gap; the main bowl does not prescribe a spiral or apply invisible inward acceleration. In isolation, a 2.5m/s tangential marble completed roughly 5.1–5.5 revolutions and exited via the open throat. The installed bowl was measured at 24 ingress/24 egress events over 60 simulated seconds, median tracker residence ~0.875s. **Tracker exits must still be separated from successful downstream collector pickup.** See test definitions before treating these as a full-course delivery rate.

The collector and next rail require a matched sloped transfer: a low-restitution floor, walls high enough for maximum observed rebound, open face where outgoing path begins, surface continuity, and a downhill grade. It is not enough to count that a body crossed below the throat.

## Loop: why a full circle collides with its own inlet

The old 0.70-radius planar loop begins at `(-2.57,1.53,-0.88)` and its lower-left return crosses the incoming rail, so test-only entry-speed injections as high as 9m/s still stall in the full course. An isolated planar loop at 7m/s makes >2 real revolutions; its correct apex center is y=2.23+0.70-0.17=2.76, *not* y=2.93. Geometry isolation and collider-removal tests established that the outbound rail was not the cause.

A 3D **depth-progressing loop** makes one vertical revolution while advancing e.g. 0.6–0.9m in z, physically separating outlet and inlet lanes. Isolated tests at ~7m/s reached apex and returned to bottom at both pitches; higher pitches generally demand greater speed. This design needs continuous tangent geometry at both ends and a connected downstream outlet.

The strongest assembly result is `tests/gravity-fed-loop.test.js`: a natural descending approach (NO injected velocity), depth-progressing loop, and exit; three starting heights (4.6, 5.4, 6.2) × two pitches (0.6, 0.9). All six trials recorded entry speed ~5.7–6.4m/s, apex reached, return to bottom, and exit threshold passed. This is not yet proof of stable contact along every centimeter or the exact next module, so keep the stronger full-course progression and collision requirements.

Production integration needs a post-funnel descent that preserves energy; the current late U-turn arrives near 2.61m/s, falls to ~1.96m/s at the loop bottom and does not reach the water. Do NOT simply add velocity or push a marble over the crest. Move geometry/raise source/lower loop while checking conflicts with return conveyor, trampoline and other modules.

## Rendering geometry and smoothness

Current `src/course.js` renders many box segments but collides against triangle strips. Gaps between *visible boxes* are not automatically collider holes. A proper reusable track extrusion should share a centerline and transported frame between smooth rendered surfaces and a collision mesh; keep guard surfaces as separate identifiable manifolds for material and contact analysis. Smooth normals and bevels affect rendering, not physics. Avoid triangle-seam ghost contacts (`FIX_INTERNAL_EDGES` is enabled where supported) but never expect that flag to repair a wrong junction. Any new continuous visual mesh needs a before/after device benchmark and inspection from front, back and below.

## Non-negotiable release gates

Do not merge experimental course into main/Pages while `energy.test.js` and `progression.test.js` fail: current full machine has zero water entries in 50s and substantial losses near elevator. To declare the complete sculpture: at least one continuous named marble ID must travel S-bend → natural coin well → physical catch/exit → full loop apex → loop exit → real trampoline collision and bounce → pool crossing → motorized return and actual elevator pickup → upper course. Verify no teleport, bounded energy/speed, and repeat over release rates and device sessions. The isolated mechanisms remain independently useful research results even while the integrated scene is blocked.
