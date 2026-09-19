# MarbleBench 3D: architecture and mechanical study (experimental)

The existing `/` URL remains the 2D reference. `/3d/` is a new and unverified-on-iOS **WebGL 2** scene, intentionally built without third-party runtime dependencies to establish a measurable graphics baseline. It is not React, a full rigid-body solver, or computational fluid dynamics. No iPhone FPS claim is made.

## What the previous implementation actually did

`site/main.js` ran 120 Hz fixed-step CPU physics (up to eight catch-up steps) plus a **full-frame Canvas 2D backdrop every presented frame**. Even in WebGPU mode, only marbles were drawn on the GPU, on a separate transparent canvas. DPR was capped at 2, which can be four times the pixel area of 1×. There was no explicit 30 FPS limit; distinguish browser frame scheduling, GPU cost, display refresh, and physics throughput before attributing the user's perceived 30 FPS to one cause.

## Why a lightweight WebGL 2 3D baseline first?

Three.js + React Three Fiber is promising for authoring and future composition; it is not inherently too slow. R3F's performance guidance emphasizes `instancedMesh`, reusable geometries/materials and avoiding React state updates inside `useFrame`. Rapier offers real 3D rigid bodies, kinematic bodies, collision events and CCD. We should compare a *functionally equivalent* R3F/Three/Rapier scene against this baseline, not compare different scenes or physics fidelity and claim one framework is faster. WebGPU is a subsequent renderer option, not a guarantee of faster performance at low primitive counts.

The reference renderer uses one canvas, a static/dynamic instance buffer for box primitives, an instanced sphere buffer, one water surface draw, one droplet point draw. It does not create meshes per marble, does not fetch textures, and does not read the GPU back per frame. Current WebGL frame time measures `requestAnimationFrame` cadence separately from physics execution and optional `EXT_disjoint_timer_query_webgl2` GPU query results. A GPU timer's absence is displayed as unavailable, *not zero*.

A user-adjustable render pixel ratio allows experiments at lower or full device DPR, instead of assuming a single universal sweet spot. Water droplets can be disabled and have a hard allocation cap; persistent arrays are recycled or trimmed. GPU state, CSS display size, device DPR and simulation speed are independent controls.

## Mechanical inspiration and course roadmap

- **Continuous lift / return:** a chain elevator or Archimedes screw raises marbles from the base. The reference currently recirculates a marble at an invisible lower return gate. Real wheel/screw joints are future Rapier work.
- **Gravity branching:** a bistable seesaw, flip-flop distributor or counterweight chute chooses among routes. The reference has one oscillating kinematic switch; it is not yet mechanically coupled to a ball's weight.
- **Vortex funnel:** a widening collector slows and spirals marbles before feeding an internal chute. Current funnel uses a radial containment guide; future version should have a concave mesh and robust colliders.
- **Water garden:** marbles descend into a shallow basin, gain buoyancy and a weak current, then leave by a drain. The shader is a 2D sinusoidal optical effect and buoyancy is analytic per marble; there is no full fluid field or two-way fluid coupling.
- **Secondary particles:** fountain droplets and marble-entry splashes use short-lived GPU point sprites. Future comparisons: CPU ballistic droplets, GPU particle update, height-field ripples, SPH/PBF only when needed.
- **Sound / visible causality:** bells, xylophone taps, waterwheel, ratchet, pendulum, domino gate, and spring launchers should use real collision/constraint events as complexity increases. Avoid faking energy transfer while describing it as physically simulated.

References and useful design precedents:
- Ryszard Grenda's *Archimedes 2* marble machine includes lifting chain, Archimedes screw, mixers, a waterwheel and flip-flop distributor: https://woodgears.ca/reader/richard/marble_machine.html
- Ronald Walter's marble machine has gears, vortex funnel, flip-flop, counting and bells: https://woodgears.ca/reader/walters/marble_machine.html
- R3F scaling performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- R3F performance pitfalls: https://r3f.docs.pmnd.rs/advanced/pitfalls
- Three.js instancing: https://threejs.org/docs/#api/en/objects/InstancedMesh
- Rapier rigid bodies: https://rapier.rs/docs/user_guides/javascript/rigid_bodies/
- Rapier colliders: https://rapier.rs/docs/user_guides/javascript/colliders/
- WebGL2 GPU query specification: https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/

## Benchmarks: measurement before optimization

1. Record rAF interval median, p95 and delivered callbacks/sec. A display's nominal 120 Hz is not proof a browser will expose 120 rAF callbacks. In early 2026 users reported a Safari feature flag `Prefer Page Rendering Updates near 60fps`; this is platform-dependent, experimental, and should never be flipped silently by code.
2. Record CPU physics milliseconds/step and total steps/sec separately; 120 Hz fixed steps do not mean 120 presented frames.
3. Record optional **asynchronous** GPU elapsed time, number of draw calls, render resolution and marble/particle counts.
4. Vary DPR before changing solver details. Test at 0.75, 1, 1.25, 2 and actual device DPR. Compare visual quality, sustained thermals and frame-time distribution on the physical iPhone.
5. Compare reference physics and Rapier with identical geometry, restitution, marble counts and gravity; collision fidelity and stability are evaluated alongside timings.
6. Avoid early GPU compute physics for a small number of interconnected rigid bodies. Benchmark JS vs WASM/Rapier vs compute only when data transfer, GPU residency, solver dependencies, and scene scale justify it.

## Known limitations / next engineering tasks

- This reference is a **WebGL 2** implementation, not WebGPU. iPhone Safari/Chrome live test is pending.
- Water is an animated flat surface and per-ball force. It does not simulate wakes or wave transmission; splash particles are ballistic approximations.
- Bar paddles are kinematic approximations; the switch does not respond to applied ball torque, and the vortex/outlet and bottom return use guided transitions.
- Shader compilation and real presentation could not be tested in the current headless Chromium environment because WebGL contexts were unavailable. Node validates physics, bounds and deterministic reproducibility instead.
- Prefer a 3D Rapier-backed branch with coherent colliders, sleeping, CCD for fast marbles and real joints before advertising a fully physical course.
- Profile long-duration iPhone runs; thermal and memory limits need physical-device data.
