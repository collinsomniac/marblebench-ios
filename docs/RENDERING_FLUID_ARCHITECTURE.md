# MarbleBench next architecture: rendering, fluids, physics and mobile lifecycle

Research date: 2026-09-18. This is an engineering decision record and **not** a claim that the referenced libraries are integrated or performance-validated on the user's physical iPhone.

## Evidence from a real iPhone

The provided 43.47-second iPhone recording is encoded as a 512×1112, 30 fps video. The game's *in-app HUD*, not an independent video measurement, reports approximately 59–60 requestAnimationFrame callbacks/s while configured at 1.00× drawing scale. The playback confirms UI and scene operation but cannot verify 60 distinct visual frames because the capture itself is 30 fps. The reference 3D scene uses a custom WebGL2 renderer, 14-longitude × 10-latitude instanced spheres, `antialias:false`, a handcrafted diffuse/specular GLSL material, and a sine-animated flat pool. No full fluid solver or PBR materials are currently integrated.

### Confirmed immediate scene change

The normal 3D startup now sets `sim.options.particles=false`, `sim.options.spray=0` and hides its fountain/spray configuration controls. The old particle code and deterministic physics regression remain as reference material rather than being represented as a real fluid simulation. Do not claim the spray removal improves FPS until measured.

## Candidate fluid implementations (separate appearance from mechanics)

| Candidate | Actual simulation and visuals | Integration / limitations | Acceptance test |
| --- | --- | --- | --- |
| Three.js `Water` / `WaterMesh` | Flat reflective water material, NOT fluid dynamics | `Water` is WebGLRenderer-only; `WaterMesh` is WebGPURenderer-only. Reflection pass and texture dimensions cost GPU time. | Compare appearance against blank water without claiming displacement. |
| Official Three.js `webgl_gpgpu_water` | GPU 2D height map of waves, interacting ducks | Example reads small render target back to CPU to move ducks; do NOT scale synchronous readback per marble per fixed step. WebGL float/half-float support must be checked on iOS. | Ripple propagation, pool-edge reflection, 1/10/100 objects, CPU–GPU stall analysis. |
| Official Three.js `webgpu_compute_water` | WebGPU compute-based interactive water | WGSL/TSL integration and actual iOS feature availability must be tested. | Same pool scene as WebGL2 at same effective grid and drawing resolution. |
| jeantimex/threejs-water | GPU wave equation height field, Fresnel reflection/refraction, caustics, interactive objects, pool shapes | MIT licensed, current code includes mobile-Safari half-float fallback and shader precision fixes; custom GLSL may require porting to TSL for WebGPURenderer. Verify integration boundaries, no universal drop-in guarantee. | Run standalone demo on physical iPhone, then isolate simulation from renderer. |
| willeastcott/webgpu-water-playcanvas | Evan Wallace water port with WebGPU and WebGL2 backends, buoyant sphere | MIT; source maintains GLSL and WGSL separately rather than identical compiled GPU programs. PlayCanvas integration is not the same as directly using Three.js. | Comparative reference demo; do not load two engines into production just to use it. |
| Full SPH/PBF volumetric solver | Allows splashes, overturning surfaces and flowing separate liquid bodies | No verified mature, drop-in, browser-based 3D rigid-body-coupled water package identified in this review. Consider only if the water *must pour or break*. | Require real integration proof, license, memory/thermal profile and rigid-fluid coupling. |

Sources: https://threejs.org/docs/pages/Water.html ; https://threejs.org/docs/pages/WaterMesh.html ; https://threejs.org/examples/webgl_gpgpu_water.html ; https://threejs.org/examples/webgpu_compute_water.html ; https://github.com/jeantimex/threejs-water ; https://github.com/willeastcott/webgpu-water-playcanvas .

**Selection gate:** Run the two existing interactive height-field demos on iPhone before porting either into MarbleBench. A GPU-simulated surface is a legitimate limited model; do not call it full 3D fluid dynamics. Stop the decorative water spray entirely. Aim for contained water with contact-generated ripples, believable optics, fluid-material response and a coherent physical outlet. No generic particles unless they communicate a necessary physical event.

## Physical coupling and material density

Rapier JavaScript computes collider mass/inertia from collider density and supports contacts, joints, sensors and `addForceAtPoint`, but its ordinary rigid-body API does not automatically solve 3D water. Integrate the submerged volume of a sphere with water density and gravity; apply force at a buoyancy center and drag relative to modeled fluid velocity. For a fully submerged sphere, buoyancy is rho_water * g * (4*pi*r^3/3). A solid soda-lime glass marble (about 2.5 g/cm³) sinks in freshwater (about 1 g/cm³): build a submerged return channel OR use hollow polypropylene-like spheres for a distinct surface-floating branch. Don't secretly increase a glass marble's buoyancy solely to force a preferred animation.

References: https://rapier.rs/docs/user_guides/javascript/rigid_bodies/ ; https://rapier.rs/docs/user_guides/javascript/rigid_body_mass_properties/ ; https://www.sciencedirect.com/topics/chemistry/soda-lime-glass ; https://pubchem.ncbi.nlm.nih.gov/compound/Polypropylene .

## One scene, fair API comparison

Adopt THREE `WebGPURenderer` and its `forceWebGL:true` option for an apples-to-apples WebGPU versus WebGL2 benchmark, while retaining the existing hand-coded WebGL2 renderer as a third control. The node/TSL material stack is shared within WebGPURenderer, but its ShaderMaterial/RawShaderMaterial/onBeforeCompile interfaces are unsupported. Don't assume the example GLSL water integrates without a port. Force backend selection at scene creation and recreate GPU resources when switching; never interleave two graphics contexts in the same production frame without a measured reason.

Fixed test dimensions: same course and frame of animation, identical number and types of marbles, identical physics snapshots, camera, material complexity, render target dimensions, AA modes, height-map resolution, reflection passes and colorspace. Compare p50/p95/p99 animation intervals, CPU rendering submissions, available asynchronous GPU timers, calls/triangles, memory-estimated render targets and context losses. Report `unavailable` for unsupported GPU timing. Distinguish startup, steady-state, and longer thermal tests. No arbitrary 30/60 fps clamp; actual rAF cadence can be OS-controlled.

References: https://threejs.org/manual/pages/webgpurenderer ; https://threejs.org/docs/pages/WebGPURenderer.html ; https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ .

## Materials, geometry, colorspace and quality

Current 14 × 10 sphere mesh is 280 triangles, which has visible silhouette faceting at close range. Benchmark representative 24 × 16 (768 triangles) and 32 × 24 (1536 triangles) alongside impostors only for distant small objects, with matched physical materials and instancing. Provide a physically coherent, lit environment: restrained HDR environment, one directional key, contact shadows if required, rough brushed rail, wood grain where visible, limited glass transmission. `MeshPhysicalMaterial` supports metal/anisotropy, clearcoat, transmission but extra features carry per-pixel costs. Resolve color-space handling in linear-light and output conversion, and test AA/quality tradeoffs (WebGL antialias currently false). Do not layer bloom, chromatic aberration, SSR and motion blur by default.

References: https://threejs.org/docs/pages/MeshPhysicalMaterial.html ; https://threejs.org/manual/pages/color-management.html ; https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices .

## Mechanical course / meaningful events

Construct a recognizable frame with high-elevation feed track, ball-triggered counterweighted seesaw, conditional split gate, tangent spiral/funnel, joint-driven ratchet and wheel, shallow branching pool (solid glass sinks, floaters travel at surface), true constrained lift, and return chute. Maintain energy and torque semantics and make powered actuators explicit. For each interaction, add a rigid-body/contact/sensor fixture and validate reaction to different incoming speeds; don't replace complex physics with arbitrary teleports while labeling it physically accurate. Rube Goldberg-style references from supplied images guide material composition and scene design; don't copy proprietary products or artwork wholesale.

Rapier's collider sensors, contact events, sleeping and collision groups allow the event layer to subscribe only to relevant transitions and skip unnecessary collision pairs: https://rapier.rs/docs/user_guides/javascript/collider_type/ ; https://rapier.rs/docs/user_guides/javascript/collider_active_events/ ; https://rapier.rs/docs/user_guides/javascript/collider_collision_groups/ .

## State, entities, resources and memory

Use stable entity IDs: `Marble` (semantic properties, persistent material, physics handle), `Mechanism` (joint and actuator handles), `WaterInteractor` (pool membership and current), `VisualInstance` (render-batch slot), `Lifetime` (owning system). Store high-churn numeric snapshots in reusable typed-array buffers where profiling justifies it, not one immutable React object per ball per frame. Stable slot/free-list allows constant-time creation/recycling; avoid expensive mount/unmount churn. React/R3F should own scene topology and GUI, not the hot physics and transform loop. Do not call React `setState` inside `useFrame`. Share geometries/materials/textures and *dispose at ownership boundaries*; monitor geometries, textures, framebuffers, render-target bytes and physics bodies separately. GPU allocation is not fully reported by browser APIs. Avoid retaining both ZIP archive and fully decompressed assets when using portable package loader.

References: https://r3f.docs.pmnd.rs/advanced/pitfalls ; https://threejs.org/manual/en/cleanup.html ; https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices .

## Asset and loading workflow

GitHub Pages remains a static HTTPS host; heavy build-time work belongs in CI (transpile, tree-shake, code-split, bake static materials, mesh-compress geometry, package KTX2/Basis Universal textures). Load startup-critical core and initial course first, defer hidden sections, avoid promising fake progress percentages. Stage indicators should be labeled as initialization stages; byte-level progress only when Content-Length/streaming can actually measure it. KTX2 can reduce download and GPU memory relative to decoded PNG/JPEG, but transcoding costs and format support need iPhone tests: https://www.khronos.org/news/press/khronos-ktx-2-0-textures-enable-compact-visually-rich-gltf-3d-assets . Keep packaged source distinct from executable runtime. Avoid serving an entire ZIP as a single blocking prerequisite when normal HTTP files can load progressively.

## Next release gates

1. Device baseline: 30/60 rAF diagnostics (including iOS low-power state) plus steady-state 3D HUD measurements.
2. Compare stock interactive water demos on the iPhone, note API capabilities and failure modes; document exact license notices.
3. Benchmark quality: 1.0/1.25/1.5/2.0 drawing scale, AA toggle, 14×10/24×16/32×24 spheres; record *p95* and total estimated framebuffer bytes.
4. Build shared Three.js scene + Rapier world. Verify rolling (angular motion), collisions, joints, pool events. Keep old scene as A/B reference, not simultaneous render layers.
5. Integrate height-field water, bidirectional contacts at bounded cost, no synchronous per-object GPU readbacks in frame loop.
6. Only after these pass, pursue material gallery quality, constrained mechanisms and carefully scoped secondary effects.

No FPS uplift, complete photorealism, or physically accurate water is asserted for the current release.
