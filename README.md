# MarbleBench iOS — Marble Garden

An entirely client-side kinetic marble sculpture and experimental mobile browser performance lab. **Neither prototype has been benchmarked on a physical iPhone yet.** GitHub Pages serves the application as static assets with no backend.

## Play

- **Original 2D reference:** https://collinsomniac.github.io/marblebench-ios/
- **Experimental 3D garden:** https://collinsomniac.github.io/marblebench-ios/3d/

The 2D game remains the working baseline; the 3D route is an experimental WebGL 2 renderer and might uncover iOS shader/driver problems. The 3D version is not yet a WebGPU implementation, full rigid-body solver or computational fluid simulation. If a game cannot initialize, it shows a meaningful error rather than claiming to have loaded successfully.

## 3D experiment

`site/3d/` contains four first-party static resources: `index.html`, `physics.js`, `render.js`, and `main.js`. No npm, external JavaScript CDN, assets, API key or application server is needed to open the deployed game.

The sculpture combines an inclined track, vortex collector, rotating wheel, oscillating paddle, buoyant pool, fountain and marble-entry droplets. Marbles recirculate through a **guided return**, not a mechanically simulated lift. This reference physics is approximate; adding Rapier's real 3D colliders, dynamic joints and contact events is the next fidelity milestone.

**Controls:** `+ Marble`, Pause, Orbit, and Tune. Inside Tune: marble flow (default 0.7/s), capacity (90), rendered resolution (default up to 1.25× DPR), simulation speed, droplets, and water/particle toggles. Drag to orbit, pinch to zoom. Rendering has no imposed FPS limit, but browser scheduling and display refresh still control delivered frames. Metrics distinguish rAF callback intervals (p50/p95), CPU simulation cost, optional async GPU timer, draws/frame, steps/sec and backbuffer size. A missing GPU timer is shown as *unavailable*, not zero.

The one-canvas WebGL 2 renderer shares box and sphere geometries, batches instances, draws water with an inexpensive procedural shader and droplets with GPU point sprites. It does **not** access the iPhone Neural Engine or perform WebGPU compute physics. Review [3D research and limitations](docs/THREE_D_RESEARCH.md) for mechanical references, benchmarking rules and future React Three Fiber / Rapier comparison plans.

## Original 2D reference

The v0.2 prototype runs simplified CPU physics at 120 Hz with up to eight catch-up steps per frame. Canvas 2D starts immediately; WebGPU may render its marbles independently. This hybrid still redraws the Canvas backdrop, so apparent stutter may be due to main-thread work, frame pacing, GPU cost or browser scheduling—not an explicit 30 FPS cap.

Use the HTTPS URLs on iPhone. Downloading a local HTML file and opening it through Files or an in-chat preview is not a dependable browser execution workflow.

## Development and portable distribution

```bash
python3 -m http.server 8000 --directory site
# Visit http://localhost:8000/3d/
node tests/test_3d.mjs
python3 tools/build_3d.py
python3 tools/build.py
python3 -m unittest discover -s tests -v
```

`tools/build_3d.py` generates `dist/marblebench-3d.html` (self-contained single-file runtime) and `dist/marblebench-3d.pweb` (draft PortableWeb ZIP including original source). They are optional distribution artifacts; the deployed `/3d/` route uses regular browser modules and static files. The `.pweb` conforms to a subset of the independent draft [PortableWeb format](https://github.com/portableweb/spec); running this app in its generic viewer is not verified.

The legacy Python tests require Playwright and Chromium; `tests/test_3d.mjs` uses only Node.js. Headless Chromium available during initial development could not create WebGL contexts, so 3D shader compilation, actual rendering and physical-iPhone FPS remain unverified despite the numerical physics regression tests passing. The archived 2D app remains at `/` during validation.

GitHub Actions publishes the `site/` directory on pushes to `main`; see `.github/workflows/pages.yml`. All original project source is MIT licensed. Do not run untrusted third-party packages on this trusted application's origin.
