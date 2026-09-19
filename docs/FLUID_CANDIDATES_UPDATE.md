# Additional fluid candidates — research correction (2026-09-18)

The larger fluid-engine decision record remains `docs/RENDERING_FLUID_ARCHITECTURE.md`. The following developments materially change the candidate list and should be evaluated, **not represented as integrated or iPhone-benchmarked**.

## Particles4All: unified fluid and rigid bodies

https://github.com/matsuoka-601/Particles4All — MIT-licensed, created August 2026; https://particles4all.netlify.app/ . The README describes a WebGPU Position Based Dynamics solver where fluids and rigid bodies share a constraint loop; buoyancy emerges from particle interactions. Includes anisotropic surface reconstruction, screen-space rendering and surface tension. This is the closest match found to a solver where material behavior generates buoyancy intrinsically instead of attaching an analytic hydrostatic-force model to Rapier.

The author cautioned in August 2026 that a large scene needs a powerful GPU and reported Apple computer compatibility issues. The README has unfinished technical sections. Inspect its source and license, run *small* scene first, check iOS WGSL feature support, physical contact fidelity, source modularity, total GPU memory and long-run thermal behavior before considering integration. This is an experimental reference, not a validated drop-in module for Rapier or R3F.

Developer discussion: https://www.reddit.com/r/GraphicsProgramming/comments/1vvbqng/realtime_fluid_rigid_body_simulation_implemented/ .

## jeantimex/fluid: experimental 3D WebGPU SPH

https://github.com/jeantimex/fluid ; the February 2026 author post described multiple fluid surface reconstruction approaches but warned mobile performance could be problematic and explicitly discouraged loading the live 3D demo on phones due to possible crashes. Do **not** send the mobile demo to casual users without checking its current warning and device compatibility. Source: https://www.reddit.com/r/webgpu/comments/1r1qpld/webgpu_3d_fluid_simulation/ .

## Legacy LiquidFun and native Metal

https://github.com/google/liquidfun — 2D Box2D extension with particles and water. The upstream repository was archived read-only on February 13, 2026; it cannot solve our 3D course simply because it has iOS builds. Useful algorithmic precedent, not a primary production engine choice.

https://github.com/yangfengzzz/fluid-engine-Swift — native Swift/Metal project, not JavaScript/WebGPU and not usable as a normal Safari dependency. It can inform native-comparison research but requiring a Swift app defeats the no-install web sharing goal.

A Reddit demo that uses Metal on iOS does not establish the same app's browser portability. CPU AoS versus SoA also needs a profile rather than blanket assumptions: stable typed arrays help homogeneous hot data, but reorganizing small dynamic rigid-body sets without a measured bottleneck can waste engineering time.

## Selection rule

For the actual contained pool, compare the existing standalone `jeantimex/threejs-water`, official Three.js WebGL/WebGPU height-field examples, and PlayCanvas dual-backend water demo *on device*. For full volumetric pours or strong two-way coupling, evaluate Particles4All independently with a conservative scene, never replace Rapier based on a single visual demo. A rigorous benchmark must control fluid particle count/grid resolution, renderer resolution, marbles/colliders, lights, pass count, rAF cadence and measurement duration. Include accuracy and object interaction tests, not just FPS.
