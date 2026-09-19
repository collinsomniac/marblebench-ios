# MarbleBench iOS — Marble Garden

A fully client-side kinetic marble sculpture and an experimental iPhone browser-performance lab. The current **v0.2 reference prototype** is a simplified 2D JavaScript-physics game with optional WebGPU-instanced marbles and a complete Canvas 2D fallback. It is **not** a validated physical-iPhone benchmark or GPU physics engine.

## Play on iPhone

Once Pages is enabled and the deployment finishes, visit **https://collinsomniac.github.io/marblebench-ios/** in Safari or Chrome. The game is static: no application server, login, build tools, or ZIP extraction is needed on the phone.

**GitHub Pages setup:** in this repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. The included `.github/workflows/pages.yml` deploys the `site/` directory on pushes to `main`. The URL is a *target*, not a claim that Pages is live; a 404 indicates it has not been enabled/deployed yet. The first visit needs an internet connection; the optional service worker caches the app shell on a best-effort basis.

Downloading `dist/marble-garden.html` and opening it from the iOS Files app or a chat preview is **not** a reliable execution path: those interfaces may preview HTML without executing JavaScript and need not offer Safari in Open With. Use the HTTPS game URL instead.

## Controls and implementation

Tap the garden to release a marble, or use **+12 marbles**, **Pause**, **Bench**, or **Reset**. A simplified discrete 2D physics solver implements gravity, track segments, bumpers, rotating paddles, and a spatial-grid broad phase. Marbles recirculate via a teleport/reset mechanism rather than a physically simulated elevator. Fixed simulation timestep: 120 Hz, with at most eight catch-up steps per animation callback. Rendering follows `requestAnimationFrame` without an imposed frame-rate cap; the display and browser still limit actual presented frames.

Canvas 2D starts gameplay immediately. WebGPU initializes independently and may fail or hang without blocking the game. The FPS display estimates **rAF callback cadence, not presented/composited FPS**. The `Bench` control blocks the main thread briefly for a **CPU-only** 120-step microbenchmark; it does not time GPU work. Device-pixel ratio is currently capped at 2 to limit render-target memory, not frame rate.

The progress bar shows initialization stages, **not transferred bytes**. There are no large streamed models, audio, fonts, external JS dependencies, neural-network inference, native Neural Engine access, or threaded WASM in v0.2. Real iOS WebGPU, thermal, battery, memory, shader-compatibility, and sustained-performance tests remain to be performed.

## Repository

- `site/`: static HTTPS entry point (`index.html`, `main.js`, `sw.js`); publish this directory.
- `tools/build.py`: creates optional self-contained HTML and a ZIP-based draft PortableWeb `.pweb` package.
- `tests/test_smoke.py`: Chromium mobile-viewport tests; **not physical-device validation**.
- `docs/RESEARCH.md`: research and benchmark plan.
- `.github/workflows/pages.yml`: GitHub Actions Pages deployment.

```bash
python3 tools/build.py
python3 -m http.server 8000 --directory site
# Visit http://localhost:8000/
python3 -m unittest discover -s tests -v
```

Tests require the Playwright Python package plus a compatible Chromium executable (`/usr/bin/chromium` in the current test script). The generated `dist/` files are not required for GitHub Pages.

The optional `.pweb` follows the independent, **draft** [PortableWeb specification](https://github.com/portableweb/spec); its viewer's handling of this app, especially WebGPU, is not verified. Arbitrary untrusted bundles must not be executed under the same trusted origin as this game. Original project source is MIT licensed. No API keys or credentials are required.
