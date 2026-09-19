# MarbleBench Modular Garden — experimental v0.1

**Do not merge this branch or describe it as a completed continuous marble machine yet.** Its separate website is under development; the existing public `/` and `/3d/` are maintained independently. Tests verify narrow properties, not photographic realism, visual correctness on iPhone, or a fully closed course.

## Development

```sh
cd experiments/modular-garden
npm install
npm run check
npm run dev
npm run build
```

The production build uses the base `/marblebench-ios/modular/` for GitHub Pages. GitHub Actions on `feature/modular-garden-v2` builds an artifact but the Pages main workflow does not automatically publish it. An experiment preview needs a separate explicit deployment workflow.

## Controls

- **Orbit**: swipe canvas to rotate target; two fingers to pan / pinch to zoom. The settings panel scrolls normally (`touch-action: pan-y`); the canvas owns gestures (`touch-action: none`).
- **Explore**: left movement pad moves, swipe elsewhere on canvas looks around. The camera is free-moving without collision/navigation mesh yet; it can pass through scenery.
- **3rd Person**: follows a selected marble with a damped trailing camera and optional look offset.
- **1st Person**: tracks just ahead of marble surface in the velocity direction; damped viewpoint is a camera technique, not true marble material rotation or perception.
- **Next ball** selects stable entity ID. Lost marbles are removed and new marbles get new IDs rather than being teleported.
- **Renderer**: Three.js WebGPURenderer with WebGPU/auto and forced WebGL 2 modes; change requires reload. One renderer and one canvas per run. Not a native Metal or Neural Engine execution path.

## Physics and course (current)

Rapier WASM simulates CCD spheres, trimesh rails, real circular funnel opening, vertical loop geometry, and a spring-jointed dynamic trampoline pad. An independent kinematic elevator shelf climbs continuously with a motor timing law; **it is not a true step-indexed ratchet mechanism yet.** Static rail trimeshes eliminate artificial box-segment endcaps. Lower motorized return uses bounded forces rather than scripted positions. The buoyant pool uses analytic spherical-cap displaced volume and a flat transparent surface; there is no numerical fluid surface or volumetric CFD implementation yet. Ball density is in simulation-scaled units, not automatically coupled to a liquid in Rapier.

## Actual acceptance evidence

GitHub CI exercises JavaScript syntax, finite and bounded Rapier state, motor trajectory continuity, physical stage coverage, and build output. The 50-second simulation is diagnostic and stage visits are sampled; `loopProximity` is **not** loop completion. No test yet proves proper trampoline launch, elevator pick-up, passage from low return to top, closed recirculation, iPhone GPU performance, or correct first-person camera framing.

Notable fixed bugs: the old `/3d/` code relocated marbles directly at funnel transitions and on recycling. This branch avoids mutating positions for stage changes. Rapier `addForce()` persists until cleared: calling `resetForces(false)` before recalculating per-step water/conveyor force prevents run-away energy. Source: https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/ .

## Design & performance rules

1. One physical coordinate system and unit convention. Separate stable entity IDs, simulation state, interpolated render state, and UI state. Do not re-render React components for every physics tick.
2. Preserve identical geometry, physics inputs, resolution, and lighting when comparing WebGPU vs WebGL2. A backend toggle is not proof one backend wins.
3. Measure rAF cadence, p50/p95 frame intervals, ms per physics step, draw calls, resolution in megapixels, and sustained performance on an actual phone. The total browser memory budget is not exposed as physical 12 GB.
4. Batch marbles by instanced mesh, share materials/geometry, avoid WebGL + WebGPU duplicate scene graphs, and avoid GPU-to-CPU water-height readbacks per marble.
5. Prefer actual gravity/contacts and powered mechanical components over scripted jumps, velocity overrides, or decorative simulated water spray.
6. Only enable graphics effects, fluid solvers, and expensive transmission when a controlled benchmark establishes a useful quality/performance return.

## Pending before production

- Validate WebGPU and forced-WebGL2 boot and touch gestures on iPhone; test browser context loss/recovery.
- Correct return-lane capture, entrance to the lift, demonstrable loop traversal and spring trampoline behavior. Add failing regression tests for each.
- Implement a **step-based** elevator movement with visible motorized ratchet, and prove it transfers a marble from return to top at least once.
- Evaluate existing water implementations (Three.js GPU water, PlayCanvas, Particles4All) separately from core rigid bodies; select on real-device performance and coupling quality.
- Improve geometry/material detail, lighting, camera composition, and texture fidelity with measured mobile GPU cost.
- Add reproducible benchmarks and baseline results before making optimization claims.
